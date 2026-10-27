# Run from the repo root: python -m unittest discover -s simulator/tests -v

import sys
import unittest
from pathlib import Path
from unittest import mock

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "client"))
sys.path.insert(0, str(ROOT / "simulator"))

from lamp import Lamp, backoff_delay  # noqa: E402
from fake_gpio import FakeGPIO  # noqa: E402

URL = "http://test/messages"
MINE, OTHER = 3, 17


def response(status=200, body=None, bad_json=False):
    r = mock.Mock(status_code=status)
    if bad_json:
        r.json.side_effect = ValueError("not json")
    else:
        r.json.return_value = body if body is not None else {}
    return r


class LampTest(unittest.TestCase):
    def setUp(self):
        self.gpio = FakeGPIO()
        self.logs = []
        self.sleeps = []
        self.lamp = Lamp(self.gpio, URL, "johnsons", "s3cret-pw", "Johnson", "red",
                         mine_led_pin=MINE, other_led_pin=OTHER,
                         log=self.logs.append, sleep=self.sleeps.append)
        self.lamp.setup()

    def leds(self):
        return (self.gpio.input(MINE), self.gpio.input(OTHER))

    def poll(self, color):
        with mock.patch("lamp.requests.get", return_value=response(body={"color": color})):
            self.lamp.poll()

    def test_leds_start_off(self):
        self.assertEqual(self.leds(), (0, 0))

    def test_poll_own_color_lights_mine(self):
        self.poll("red")
        self.assertEqual(self.leds(), (1, 0))

    def test_poll_other_color_lights_other(self):
        self.poll("blue")
        self.assertEqual(self.leds(), (0, 1))

    def test_poll_white_turns_everything_off(self):
        self.poll("red")
        self.poll("white")
        self.assertEqual(self.leds(), (0, 0))

    def test_poll_tracks_own_color_so_button_skips_post(self):
        # Regression: current_color used to stay stale when the server color was ours
        self.poll("red")
        self.assertEqual(self.lamp.current_color, "red")
        with mock.patch("lamp.requests.post") as post:
            self.lamp.button_callback()
        post.assert_not_called()

    def test_button_posts_after_server_reset_to_white(self):
        # Regression: after the server went white the button used to stay blocked
        self.poll("red")
        self.poll("white")
        with mock.patch("lamp.requests.post", return_value=response(201)) as post:
            self.lamp.button_callback()
        post.assert_called_once()
        self.assertEqual(self.leds(), (1, 0))

    def test_button_posts_color_and_lights_mine(self):
        self.poll("blue")
        with mock.patch("lamp.requests.post", return_value=response(201)) as post:
            self.lamp.button_callback()
        self.assertEqual(post.call_args.kwargs["json"],
                         {"household": {"name": "Johnson", "color": "red"}})
        self.assertEqual(self.leds(), (1, 0))
        self.assertEqual(self.lamp.current_color, "red")

    def test_failed_post_leaves_leds_alone(self):
        self.poll("blue")
        with mock.patch("lamp.requests.post", return_value=response(500)):
            self.lamp.button_callback()
        self.assertEqual(self.leds(), (0, 1))
        self.assertEqual(self.lamp.current_color, "blue")

    def test_network_errors_do_not_raise(self):
        with mock.patch("lamp.requests.get", side_effect=requests.exceptions.ConnectionError("down")):
            self.lamp.poll()
        with mock.patch("lamp.requests.post", side_effect=requests.exceptions.Timeout("slow")):
            self.lamp.button_callback()
        self.assertEqual(self.leds(), (0, 0))

    def test_bad_server_replies_do_not_raise(self):
        with mock.patch("lamp.requests.get", return_value=response(bad_json=True)):
            self.lamp.poll()
        with mock.patch("lamp.requests.get", return_value=response(body={})):  # no "color" key
            self.lamp.poll()
        with mock.patch("lamp.requests.get", return_value=response(500)):
            self.lamp.poll()
        self.assertEqual(self.leds(), (0, 0))

    def test_requests_send_family_and_secret_headers(self):
        with mock.patch("lamp.requests.get", return_value=response(body={"color": "white"})) as get:
            self.lamp.poll()
        self.assertEqual(get.call_args.kwargs["headers"],
                         {"X-Buddy-Family": "johnsons", "X-Buddy-Secret": "s3cret-pw"})
        with mock.patch("lamp.requests.post", return_value=response(201)) as post:
            self.lamp.change_color()
        self.assertEqual(post.call_args.kwargs["headers"]["X-Buddy-Family"], "johnsons")

    def test_secret_never_logged(self):
        with mock.patch("lamp.requests.get", return_value=response(401)):
            self.lamp.poll()
        self.assertFalse(any("s3cret-pw" in line for line in self.logs))
        self.assertTrue(any("secret" in line.lower() for line in self.logs))

    def test_requests_use_a_timeout(self):
        with mock.patch("lamp.requests.get", return_value=response(body={"color": "white"})) as get:
            self.lamp.poll()
        self.assertIn("timeout", get.call_args.kwargs)

    def blink_levels(self):
        """Record (mine, other) every time the LEDs change."""
        seen = []
        real_output = self.gpio.output

        def spy(pin, level):
            real_output(pin, level)
            if not seen or seen[-1] != self.leds():  # one _show() sets two pins
                seen.append(self.leds())
        self.gpio.output = spy
        return seen

    def test_poll_failure_blinks_twice_and_restores_leds(self):
        self.poll("red")  # mine on
        seen = self.blink_levels()
        with mock.patch("lamp.requests.get", side_effect=requests.exceptions.Timeout("slow")):
            self.assertFalse(self.lamp.poll())
        self.assertEqual(seen.count((1, 1)), 2)
        self.assertEqual(self.leds(), (1, 0))  # restored

    def test_failed_press_blinks(self):
        self.poll("blue")
        seen = self.blink_levels()
        with mock.patch("lamp.requests.post", return_value=response(500)):
            self.lamp.button_callback()
        self.assertEqual(seen.count((1, 1)), 2)
        self.assertEqual(self.leds(), (0, 1))

    def test_success_does_not_blink(self):
        seen = self.blink_levels()
        self.poll("red")
        self.assertNotIn((1, 1), seen)

    def test_self_test_lights_each_led_then_turns_off(self):
        seen = self.blink_levels()
        self.lamp.self_test()
        self.assertIn((1, 0), seen)
        self.assertIn((0, 1), seen)
        self.assertNotIn((1, 1), seen)
        self.assertEqual(self.leds(), (0, 0))

    def test_poll_returns_success_flag(self):
        with mock.patch("lamp.requests.get", return_value=response(body={"color": "red"})):
            self.assertTrue(self.lamp.poll())
        with mock.patch("lamp.requests.get", return_value=response(body={"color": "purple"})):
            self.assertFalse(self.lamp.poll())

    def test_debounce_swallows_rapid_presses(self):
        self.assertTrue(self.gpio.press_button(2))
        self.assertFalse(self.gpio.press_button(2))


class BackoffTest(unittest.TestCase):
    def test_grows_and_caps(self):
        delays = [backoff_delay(5, n, 60) for n in range(0, 7)]
        self.assertEqual(delays, [5, 10, 20, 40, 60, 60, 60])

    def test_run_backs_off_then_resets(self):
        gpio = FakeGPIO()
        lamp = Lamp(gpio, URL, "f", "secret-pw", "J", "red", seconds_between_requests=5,
                    max_backoff_seconds=60, log=lambda t: None, sleep=lambda s: None)
        lamp.setup()
        results = iter([False, False, False, True, False])
        waits = []

        class Stop:
            def __init__(self):
                self.n = 0

            def is_set(self):
                return self.n >= 5

            def wait(self, delay):
                waits.append(delay)
                self.n += 1

        with mock.patch.object(lamp, "poll", side_effect=lambda: next(results)):
            lamp.run(Stop())
        self.assertEqual(waits, [10, 20, 40, 5, 10])


if __name__ == "__main__":
    unittest.main()
