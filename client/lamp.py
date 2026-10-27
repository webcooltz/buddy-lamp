# Lamp - Buddy Lamp logic (hardware-independent)
# Lamp.poll():
# -gets server color and adjusts the LEDs
# Lamp.change_color():
# -sets server color to your color
# Lamp.button_callback():
# -when button is pressed, calls change_color()
# Lamp.run():
# -polls forever, backing off while the server is unreachable
# Errors blink both LEDs twice, then the LEDs go back to what they showed.
#
# The GPIO module is passed in, so the same code runs on a Raspberry Pi (RPi.GPIO)
# or in the simulator (simulator/fake_gpio.py).

import threading
import time

import requests

VALID_COLORS = ["white", "blue", "red", "green"]
BLINK_TIMES = 2
BLINK_SECONDS = 0.15


def backoff_delay(base, failures, cap):
    """Seconds to wait after `failures` failed polls in a row: base, 2x, 4x... up to cap."""
    if failures <= 0:
        return base
    return min(cap, base * 2 ** min(failures, 16))


class Lamp:
    def __init__(self, gpio, api_url, family, secret, household_name, my_color,
                 button_pin=2, mine_led_pin=3, other_led_pin=17,
                 seconds_between_requests=5, max_backoff_seconds=60, request_timeout=10,
                 log=print, sleep=time.sleep):
        """
            Args:
                gpio: RPi.GPIO (or a compatible fake).
                api_url (str): Server messages URL.
                family (str): Family group; lamps with the same family share one color.
                secret (str): Shared password the server expects.
                household_name (str): Your household name.
                my_color (str): The color you send. One of VALID_COLORS.
                button_pin (int): GPIO (BCM) number of the button.
                mine_led_pin (int): GPIO number of the LED that shows YOUR color is active.
                other_led_pin (int): GPIO number of the LED that shows the OTHER color is active.
                seconds_between_requests (float): Poll interval while the server is healthy.
                max_backoff_seconds (float): Longest wait between polls while the server is failing.
                request_timeout (float): Seconds before an HTTP request gives up.
                log (callable): Where messages go (print by default).
                sleep (callable): Used for blink timing (replaced in tests).
        """
        self.gpio = gpio
        self.api_url = api_url
        self.family = family
        self._headers = {"X-Buddy-Family": family, "X-Buddy-Secret": secret}
        self.household_name = household_name
        self.my_color = my_color
        self.button_pin = button_pin
        self.mine_led_pin = mine_led_pin
        self.other_led_pin = other_led_pin
        self.seconds_between_requests = seconds_between_requests
        self.max_backoff_seconds = max_backoff_seconds
        self.request_timeout = request_timeout
        self.log = log
        self._sleep = sleep

        self.current_color = ""  # last color we know the server has
        self._mine_on = False
        self._other_on = False
        # The button callback runs on its own thread, so guard shared state and LED changes
        self._lock = threading.Lock()

    # ---GPIO stuff---
    def setup(self):
        """Configure pins and start listening for button presses."""
        gpio = self.gpio
        gpio.setmode(gpio.BCM)
        # GPIO 2 has a hardware pull-up on the Pi; the pull-up here makes other pins work too
        gpio.setup(self.button_pin, gpio.IN, pull_up_down=gpio.PUD_UP)
        gpio.setup(self.mine_led_pin, gpio.OUT)
        gpio.setup(self.other_led_pin, gpio.OUT)
        self._show(mine=False, other=False)
        gpio.add_event_detect(self.button_pin, gpio.FALLING,
                              callback=lambda channel: self.button_callback(), bouncetime=300)

    def cleanup(self):
        self.gpio.cleanup()

    def _show(self, mine, other):
        self._mine_on, self._other_on = mine, other
        self.gpio.output(self.mine_led_pin, self.gpio.HIGH if mine else self.gpio.LOW)
        self.gpio.output(self.other_led_pin, self.gpio.HIGH if other else self.gpio.LOW)

    def _show_color(self, color):
        """Light the LEDs for a server color."""
        if color == "white":  # no color set: everything off
            self._show(mine=False, other=False)
        elif color == self.my_color:
            self._show(mine=True, other=False)
        else:
            self._show(mine=False, other=True)

    def self_test(self):
        """Light each LED in turn so you can see the wiring works (run once on boot)."""
        with self._lock:
            for mine, other in ((True, False), (False, True)):
                self._show(mine, other)
                self._sleep(0.4)
            self._show(False, False)

    def blink_error(self):
        """Blink both LEDs twice, then restore whatever they were showing."""
        with self._lock:
            mine, other = self._mine_on, self._other_on
            for _ in range(BLINK_TIMES):
                self._show(True, True)
                self._sleep(BLINK_SECONDS)
                self._show(False, False)
                self._sleep(BLINK_SECONDS)
            self._show(mine, other)

    def _error(self, text):
        self.log(text)
        self.blink_error()

    # ---Server stuff---
    def poll(self):
        """
            Gets the color from the server and adjusts the LEDs.
            Always updates current_color so button presses compare against the real server state.

            Returns:
                bool: True if the server answered with a valid color.
        """
        try:
            response = requests.get(self.api_url, headers=self._headers, timeout=self.request_timeout)
            if response.status_code != 200:
                self._error(self._describe_failure("Request failed", response.status_code))
                return False
            server_color = response.json().get("color")
        except (requests.exceptions.RequestException, ValueError) as e:
            # ValueError: server replied with something that is not JSON
            self._error(f"Request error: {e}")
            return False

        if server_color not in VALID_COLORS:
            self._error(f"Unknown server color: {server_color!r}")
            return False

        with self._lock:
            changed = server_color != self.current_color
            self.current_color = server_color
            self._show_color(server_color)

        if changed:
            self.log(f"server color is now {server_color}")
        return True

    @staticmethod
    def _describe_failure(prefix, status):
        if status == 401:
            return f"{prefix} (401): the server rejected the secret. Check BUDDY_LAMP_SECRET."
        if status == 400:
            return f"{prefix} (400): check BUDDY_LAMP_FAMILY, name and color."
        return f"{prefix} ({status})"

    def change_color(self, color=None):
        """Sends your color to the server and adjusts the LEDs."""
        color = color or self.my_color
        if not self.household_name or not color:
            self._error("Household name or color is missing!")
            return
        if color not in VALID_COLORS:
            self._error("Invalid color value!")
            return
        if not self.api_url:
            self._error("API URL is missing!")
            return

        payload = {"household": {"name": self.household_name, "color": color}}
        try:
            response = requests.post(self.api_url, json=payload, headers=self._headers,
                                     timeout=self.request_timeout)
        except requests.exceptions.RequestException as e:
            self._error(f"Request error: {e}")
            return

        if response.status_code == 201:
            with self._lock:
                self.current_color = color
                self._show_color(color)
            self.log("Color change request successful!")
        else:
            self._error(self._describe_failure("Color change request failed", response.status_code))

    def button_callback(self):
        """
            When the button is pressed: calls change_color().
            Does nothing while your color is already the one showing on the lamp.
        """
        with self._lock:
            already_mine = self.current_color == self.my_color
        if already_mine:
            self.log("Your color is already active; nothing to send.")
        else:
            self.change_color()

    # ---Main loop---
    def run(self, stop_event=None):
        """Poll the server forever (or until stop_event is set). Backs off while polls keep failing."""
        stop_event = stop_event or threading.Event()
        failures = 0
        while not stop_event.is_set():
            failures = 0 if self.poll() else failures + 1
            delay = backoff_delay(self.seconds_between_requests, failures, self.max_backoff_seconds)
            stop_event.wait(delay)
