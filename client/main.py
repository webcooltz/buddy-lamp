# Main - Buddy Lamp
# Runs on the Raspberry Pi. All the logic lives in lamp.py; settings come from client/.env (see config.py).
# Want to try it without a Pi? See ../simulator (python simulator/sim.py).

import signal
import sys

from config import ConfigError, load_config
from lamp import Lamp

try:
    import RPi.GPIO as GPIO
except ModuleNotFoundError:
    sys.exit("RPi module not found. Are you running on a Raspberry Pi? "
             "(To try the lamp without one, run the simulator: python simulator/sim.py)")

if __name__ == "__main__":
    try:
        config = load_config()
    except ConfigError as e:
        sys.exit(f"Config error: {e}")

    lamp = Lamp(GPIO, config["api_url"], config["family"], config["secret"],
                config["household_name"], config["my_color"],
                button_pin=config["button_pin"], mine_led_pin=config["mine_led_pin"],
                other_led_pin=config["other_led_pin"])
    # systemd stops the service with SIGTERM; exit normally so GPIO gets cleaned up
    signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(0))
    lamp.setup()
    lamp.self_test()
    try:
        lamp.run()
    except KeyboardInterrupt:
        pass
    finally:
        lamp.cleanup()
