# -gets server color every 10 minutes
# -sets server color to your color when button is pressed

import time
import requests
try:
    import RPi.GPIO as GPIO
except ModuleNotFoundError:
    print("RPi module not found. Are you running on a Raspberry Pi?")

# change these
api_url = "https://YOUR_URL/"
my_household_name = "Johnson"
my_color = "red"
current_color = ""

# GPIO stuff
GPIO.setmode(GPIO.BCM)
# button
button_pin = 2  # GPIO pin connected to the button
GPIO.setup(button_pin, GPIO.IN)
button_pressed = False  # Flag to track button state
# LED
led_pin_number = 3
GPIO.setup(led_pin_number, GPIO.OUT)  # Set the LED pin as an output


def get_color(color_currently, led_pin):
    try:
        response = requests.get(api_url)
        if response.status_code == 200:
            print("200: Request successful!") 
            data = response.json()
            server_color = data.get("color")
            print("server_color: " + server_color)
            if server_color and server_color != my_color:
                color_currently = server_color
                print(f"color updated to {server_color}")
                GPIO.output(led_pin, GPIO.LOW)  # Turn off the LED
            elif server_color and server_color != my_color and server_color == color_currently:
                print(f"server color has not changed")
            elif server_color and server_color == my_color:
                print(f"server color is your color")
                GPIO.output(led_pin, GPIO.HIGH)  # Turn on the LED
            else:
                print(f"Other case")
        else:
            print("Request failed!")  # Handle the request failure scenario
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")

    return color_currently


def change_color(household_name, color, led_pin):
    try:
        payload = {
          "household": {
            "name": household_name,
            "color": color
          }
        }
        response = requests.post(api_url, json=payload)  # Send the HTTP POST request
        if response.status_code == 201:  # Check if the request was successful
            GPIO.output(led_pin, GPIO.HIGH)  # Turn on the LED
            print("201: Color change request successful!")
        else:
            print("Color change request failed!")  # Handle the request failure scenario
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")


def button_callback(channel, household_name, color, led_pin):
    global button_pressed
    if not button_pressed:
        button_pressed = True
        change_color(household_name, color, led_pin)  # Call change_color function


GPIO.add_event_detect(button_pin, GPIO.FALLING, callback=lambda channel: button_callback(channel, my_household_name, my_color, led_pin_number), bouncetime=300)

while True:
    current_color = get_color(current_color, led_pin_number)
    time.sleep(10)  # Wait for 10 minutes (600 seconds) before the next request
    button_pressed = False  # Reset button state

# Cleanup GPIO
GPIO.cleanup()
