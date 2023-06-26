import RPi.GPIO as GPIO

# Set the GPIO mode
GPIO.setmode(GPIO.BCM)

# Define the GPIO pin connected to the button
button_pin = 2

# Set up the button pin as an input
GPIO.setup(button_pin, GPIO.IN)


def button_callback(channel):
    print('Button pressed')
    print('Pin: ' + str(button_pin))


# Add event detection for button press
GPIO.add_event_detect(button_pin, GPIO.FALLING, callback=button_callback, bouncetime=300)

# Keep the program running
while True:
    pass

# Cleanup GPIO
GPIO.cleanup()
