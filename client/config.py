# Config - reads client/.env (and environment variables) for the lamp.
# Plain stdlib so the Pi needs no extra packages. Real environment variables win over the file.

import os
import re
from pathlib import Path

VALID_COLORS = ["white", "blue", "red", "green"]
FAMILY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")
MAX_NAME_LENGTH = 32


class ConfigError(Exception):
    pass


def load_env_file(path):
    """Parse KEY=VALUE lines (# comments, optional quotes) into os.environ without overriding it."""
    path = Path(path)
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key.strip(), value)


def _get_int(name, default):
    raw = os.environ.get(name)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        raise ConfigError(f"{name} must be a whole number, got {raw!r}")


def load_config(env_path=None):
    """Return the lamp settings as a dict, or raise ConfigError with a message that says what to fix."""
    load_env_file(env_path or Path(__file__).with_name(".env"))
    env = os.environ

    missing = [k for k in ("BUDDY_LAMP_URL", "BUDDY_LAMP_FAMILY", "BUDDY_LAMP_NAME",
                           "BUDDY_LAMP_COLOR", "BUDDY_LAMP_SECRET") if not env.get(k)]
    if missing:
        raise ConfigError("Missing in client/.env: " + ", ".join(missing)
                          + " (copy .env.example to .env and fill it in)")

    url = env["BUDDY_LAMP_URL"].strip()
    if not url.startswith(("http://", "https://")):
        raise ConfigError("BUDDY_LAMP_URL must start with http:// or https://")

    family = env["BUDDY_LAMP_FAMILY"].strip().lower()
    if not FAMILY_PATTERN.match(family):
        raise ConfigError("BUDDY_LAMP_FAMILY must be 1-32 characters: a-z, 0-9, - or _")

    name = env["BUDDY_LAMP_NAME"].strip()
    if not 1 <= len(name) <= MAX_NAME_LENGTH:
        raise ConfigError(f"BUDDY_LAMP_NAME must be 1-{MAX_NAME_LENGTH} characters")

    color = env["BUDDY_LAMP_COLOR"].strip().lower()
    if color not in VALID_COLORS or color == "white":
        raise ConfigError("BUDDY_LAMP_COLOR must be one of: " + ", ".join(c for c in VALID_COLORS if c != "white"))

    return {
        "api_url": url,
        "family": family,
        "household_name": name,
        "my_color": color,
        "secret": env["BUDDY_LAMP_SECRET"],
        "button_pin": _get_int("BUDDY_LAMP_BUTTON_PIN", 2),
        "mine_led_pin": _get_int("BUDDY_LAMP_MINE_LED_PIN", 3),
        "other_led_pin": _get_int("BUDDY_LAMP_OTHER_LED_PIN", 17),
    }
