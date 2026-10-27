# Run from the repo root: python -m unittest discover -s simulator/tests -v

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "client"))

import config  # noqa: E402

GOOD = """
# a comment
BUDDY_LAMP_URL=https://example.com/messages
BUDDY_LAMP_FAMILY=Johnson-Family
BUDDY_LAMP_SECRET="quoted secret"
BUDDY_LAMP_NAME=Johnson
BUDDY_LAMP_COLOR=red
"""


class ConfigTest(unittest.TestCase):
    def load(self, text, env=None):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / ".env"
            path.write_text(text, encoding="utf-8")
            with mock.patch.dict(os.environ, env or {}, clear=True):
                return config.load_config(path)

    def test_loads_and_normalizes(self):
        c = self.load(GOOD)
        self.assertEqual(c["family"], "johnson-family")
        self.assertEqual(c["secret"], "quoted secret")
        self.assertEqual((c["button_pin"], c["mine_led_pin"], c["other_led_pin"]), (2, 3, 17))

    def test_real_env_overrides_file(self):
        self.assertEqual(self.load(GOOD, {"BUDDY_LAMP_COLOR": "blue"})["my_color"], "blue")

    def test_pins_configurable(self):
        c = self.load(GOOD + "BUDDY_LAMP_MINE_LED_PIN=17\nBUDDY_LAMP_OTHER_LED_PIN=3\n")
        self.assertEqual((c["mine_led_pin"], c["other_led_pin"]), (17, 3))

    def test_missing_values_listed(self):
        with self.assertRaisesRegex(config.ConfigError, "BUDDY_LAMP_SECRET"):
            self.load(GOOD.replace('BUDDY_LAMP_SECRET="quoted secret"', ""))

    def test_rejects_bad_values(self):
        for old, new, pattern in [
            ("BUDDY_LAMP_COLOR=red", "BUDDY_LAMP_COLOR=purple", "COLOR"),
            ("BUDDY_LAMP_COLOR=red", "BUDDY_LAMP_COLOR=white", "COLOR"),
            ("BUDDY_LAMP_FAMILY=Johnson-Family", "BUDDY_LAMP_FAMILY=../x", "FAMILY"),
            ("BUDDY_LAMP_NAME=Johnson", "BUDDY_LAMP_NAME=" + "x" * 33, "NAME"),
            ("https://example.com/messages", "example.com/messages", "URL"),
        ]:
            with self.subTest(new=new):
                with self.assertRaisesRegex(config.ConfigError, pattern):
                    self.load(GOOD.replace(old, new))

    def test_bad_pin_number(self):
        with self.assertRaisesRegex(config.ConfigError, "BUTTON_PIN"):
            self.load(GOOD + "BUDDY_LAMP_BUTTON_PIN=two\n")


if __name__ == "__main__":
    unittest.main()
