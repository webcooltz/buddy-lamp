# -gets server color every 10 minutes
# -sets server color to your color when button is pressed

import time
import requests
try:
    import RPi.GPIO as GPIO
except ModuleNotFoundError:
    print("RPi module not found. Are you running on a Raspberry Pi?")

# change these
api_url = "https://[YOUR_URL]"
my_household_name = "Johnson"
my_color = "red"
current_color = ""

# Button stuff
button_pin = 2  # GPIO pin connected to the button
GPIO.setmode(GPIO.BCM)
GPIO.setup(button_pin, GPIO.IN)


def get_color(color_currently):
    try:
        response = requests.get(api_url)  # Send the HTTP GET request
        if response.status_code == 200:  # Check if the request was successful
            print("Request successful!")  # Perform any desired actions upon a successful request
            data = response.json()  # Assuming the response is in JSON format
            server_color = data.get("color")
            print("server_color: " + server_color)
            if server_color and server_color != my_color and server_color != color_currently:
                color_currently = server_color
                print(f"color_currently updated to {server_color}")
        else:
            print("Request failed!")  # Handle the request failure scenario
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")

    return color_currently


def change_color(household_name, color):
    try:
        payload = {
          "household": {
            "name": household_name,
            "color": color
          }
        }
        response = requests.post(api_url, json=payload)  # Send the HTTP POST request
        if response.status_code == 201:  # Check if the request was successful
            print("Color change request successful!")
            # get_color(color)
        else:
            print("Color change request failed!")  # Handle the request failure scenario
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")


def button_callback(channel, household_name, color):
    change_color(household_name, color)


GPIO.add_event_detect(button_pin, GPIO.FALLING, callback=lambda channel: button_callback(channel, my_household_name, my_color), bouncetime=300)

while True:
    current_color = get_color(current_color)
    time.sleep(10)  # Wait for 10 minutes (600 seconds) before the next request
    pass

# Cleanup GPIO
GPIO.cleanup()
