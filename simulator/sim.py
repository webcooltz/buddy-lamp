# Buddy Lamp simulator
# Starts the real Node server (with a throwaway data dir) plus virtual lamps running the real
# client code (client/lamp.py) on a fake GPIO, and serves a web page to watch and poke them.
#
#   python simulator/sim.py          then open http://localhost:8765

import argparse
import collections
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "client"))
from lamp import Lamp  # noqa: E402
from fake_gpio import FakeGPIO  # noqa: E402

# Physical LEDs on every lamp: GPIO 3 is red, GPIO 17 is blue (see client/main.py)
LED_COLORS = {3: "red", 17: "blue"}
BUTTON_PIN = 2
FAMILY = "demo-family"
SECRET = "simulator-secret"
ERROR_FLASH_SECONDS = 2  # how long the UI keeps showing "error blink" after a lamp blinks

# (household, color, "mine" LED pin, "other" LED pin)
# A lamp's "mine" LED must be the one that matches its color, so the blue lamp swaps the pins.
LAMP_SPECS = [
    ("Johnson", "red", 3, 17),
    ("Smith", "blue", 17, 3),
]


ASSETS = {"/logo.png": ROOT / "assets" / "logo.png", "/favicon.png": ROOT / "assets" / "favicon.png"}


class Server:
    """The real Node server as a subprocess, with its own temp data dir."""

    def __init__(self, port):
        self.port = port
        self.url = f"http://localhost:{port}/messages"
        self.data_dir = Path(tempfile.mkdtemp(prefix="buddy-lamp-sim-"))
        self.proc = None

    @property
    def running(self):
        return self.proc is not None and self.proc.poll() is None

    def start(self):
        if self.running:
            return
        env = dict(os.environ, PORT=str(self.port), BUDDY_LAMP_DATA_DIR=str(self.data_dir),
                   BUDDY_LAMP_SECRET=SECRET)
        self.proc = subprocess.Popen(["node", "index.js"], cwd=ROOT / "server", env=env,
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):  # wait up to ~5s for it to answer (any reply, even 401, means it is up)
            try:
                requests.get(self.url, timeout=0.5)
                return
            except requests.exceptions.RequestException:
                if not self.running:
                    break
                time.sleep(0.1)
        raise RuntimeError("Node server did not start. Did you run `npm install` in /server?")

    def stop(self):
        if self.running:
            self.proc.terminate()
            self.proc.wait(timeout=5)

    def reset(self):
        self._messages_file.unlink(missing_ok=True)

    @property
    def _messages_file(self):
        return self.data_dir / f"messages-{FAMILY}.json"

    def messages(self):
        try:
            return json.loads(self._messages_file.read_text())
        except (OSError, ValueError):
            return []

    def cleanup(self):
        self.stop()
        shutil.rmtree(self.data_dir, ignore_errors=True)


class VirtualLamp:
    def __init__(self, index, name, color, mine_pin, other_pin, server_url, poll_seconds):
        self.index = index
        self.gpio = FakeGPIO()
        self.events = collections.deque(maxlen=40)
        self.last_error = 0.0
        self.lamp = Lamp(self.gpio, server_url, FAMILY, SECRET, name, color,
                         button_pin=BUTTON_PIN, mine_led_pin=mine_pin, other_led_pin=other_pin,
                         seconds_between_requests=poll_seconds, max_backoff_seconds=5,
                         request_timeout=2, log=self._log)
        # Remember when the lamp last blinked an error so the UI can show it
        real_blink = self.lamp.blink_error

        def blink_error():
            self.last_error = time.time()
            real_blink()
        self.lamp.blink_error = blink_error
        self.stop_event = threading.Event()
        self.thread = None

    def _log(self, text):
        text = text if len(text) <= 80 else text[:79] + "…"  # keep connection errors readable
        self.events.append({"t": time.strftime("%H:%M:%S"), "text": text})

    def start(self):
        self.lamp.setup()
        self._log("LED self-test")
        self.lamp.self_test()
        self.thread = threading.Thread(target=self.lamp.run, args=(self.stop_event,), daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()

    def press(self):
        pressed = self.gpio.press_button(BUTTON_PIN)
        self._log("button pressed" if pressed else "button press ignored (debounce)")
        return pressed

    def state(self):
        lamp = self.lamp
        return {
            "id": self.index,
            "name": lamp.household_name,
            "color": lamp.my_color,
            "knownServerColor": lamp.current_color or None,
            "family": lamp.family,
            "errorBlink": time.time() - self.last_error < ERROR_FLASH_SECONDS,
            "leds": [
                {"pin": pin, "color": LED_COLORS[pin], "on": self.gpio.input(pin) == FakeGPIO.HIGH,
                 "role": "yours" if pin == lamp.mine_led_pin else "other"}
                for pin in (lamp.mine_led_pin, lamp.other_led_pin)
            ],
            "events": list(self.events)[::-1],
        }


class App:
    def __init__(self, server, lamps):
        self.server = server
        self.lamps = lamps

    def state(self):
        messages = self.server.messages()
        color = (messages[-1].get("household") or {}).get("color", "white") if messages else "white"
        return {
            "server": {"running": self.server.running, "color": color, "url": self.server.url, "family": FAMILY,
                       "messages": messages[-15:][::-1]},
            "lamps": [lamp.state() for lamp in self.lamps],
        }


def make_handler(app, html):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status, body, content_type="application/json"):
            data = body if isinstance(body, bytes) else body.encode()
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == "/":
                self._send(200, html, "text/html; charset=utf-8")
            elif self.path in ASSETS:
                self._send(200, ASSETS[self.path].read_bytes(), "image/png")
            elif self.path == "/api/state":
                self._send(200, json.dumps(app.state()))
            else:
                self._send(404, '{"error":"not found"}')

        def do_POST(self):
            length = int(self.headers.get("Content-Length") or 0)
            try:
                body = json.loads(self.rfile.read(length) or b"{}")
            except ValueError:
                return self._send(400, '{"error":"bad json"}')
            try:
                if self.path == "/api/press":
                    app.lamps[int(body["lamp"])].press()
                elif self.path == "/api/server":
                    action = body.get("action")
                    if action == "stop":
                        app.server.stop()
                    elif action == "start":
                        app.server.start()
                    elif action == "reset":
                        app.server.reset()
                    else:
                        return self._send(400, '{"error":"unknown action"}')
                else:
                    return self._send(404, '{"error":"not found"}')
            except (KeyError, IndexError, ValueError, RuntimeError) as e:
                return self._send(400, json.dumps({"error": str(e)}))
            self._send(200, '{"ok":true}')

        def log_message(self, *args):
            pass

    return Handler


def main():
    parser = argparse.ArgumentParser(description="Buddy Lamp simulator")
    parser.add_argument("--port", type=int, default=8765, help="web UI port")
    parser.add_argument("--server-port", type=int, default=3100, help="port for the simulated server")
    parser.add_argument("--poll", type=float, default=1.0, help="seconds between lamp polls")
    args = parser.parse_args()

    if shutil.which("node") is None:
        sys.exit("node not found - install Node.js to run the simulated server.")

    server = Server(args.server_port)
    server.start()
    lamps = [VirtualLamp(i, *spec, server.url, args.poll) for i, spec in enumerate(LAMP_SPECS)]
    for lamp in lamps:
        lamp.start()

    html = (Path(__file__).parent / "ui.html").read_text(encoding="utf-8")
    httpd = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(App(server, lamps), html))
    print(f"Simulator running: http://localhost:{args.port}  (server on :{args.server_port}). Ctrl+C to quit.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        for lamp in lamps:
            lamp.stop()
        server.cleanup()


if __name__ == "__main__":
    main()
