# Fake RPi.GPIO - just enough of the API that client/lamp.py uses.
# Pin states live in memory, and press_button() fires the registered callback like a real edge would.

import threading
import time


class FakeGPIO:
    BCM = "BCM"
    IN = "IN"
    OUT = "OUT"
    HIGH = 1
    LOW = 0
    PUD_UP = "PUD_UP"
    FALLING = "FALLING"

    def __init__(self):
        self.modes = {}
        self.levels = {}
        self._callbacks = {}  # pin -> (callback, bouncetime ms)
        self._last_event = {}  # pin -> time of the last accepted press

    # ---RPi.GPIO API---
    def setmode(self, mode):
        pass

    def setup(self, pin, mode, pull_up_down=None):
        self.modes[pin] = mode
        self.levels.setdefault(pin, self.LOW)

    def output(self, pin, level):
        if self.modes.get(pin) != self.OUT:
            raise RuntimeError(f"GPIO {pin} is not set up as an output")
        self.levels[pin] = level

    def input(self, pin):
        return self.levels.get(pin, self.LOW)

    def add_event_detect(self, pin, edge, callback=None, bouncetime=0):
        self._callbacks[pin] = (callback, bouncetime)

    def cleanup(self):
        self.modes.clear()
        self.levels.clear()
        self._callbacks.clear()

    # ---Simulator API---
    def press_button(self, pin):
        """Simulate a button press (falling edge). Returns False if swallowed by debounce."""
        callback, bouncetime = self._callbacks.get(pin, (None, 0))
        if callback is None:
            return False
        now = time.monotonic()
        last = self._last_event.get(pin)
        if last is not None and (now - last) * 1000 < bouncetime:
            return False
        self._last_event[pin] = now
        # RPi.GPIO runs callbacks on its own thread; do the same
        threading.Thread(target=callback, args=(pin,), daemon=True).start()
        return True
