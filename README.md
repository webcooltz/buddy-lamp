# buddy-lamp

A wifi lamp project.

## Server

### Setup

* Download the buddy-lamp folder (only onto one machine in the network).
* Put buddy-lamp folder in the Documents folder.
* Follow the directions below to start up the server on boot.

### Port Forwarding

* You will need to forward ports on your router to allow the server to be accessed from outside your home network.

### Start Server on Boot

#### Create Server Start Script

* Create a shell script called start-server.sh in ~/Documents:
`nano ~/Documents/start-server.sh`

* Paste the following into it:
```
#!/bin/bash

# Navigate to the server folder
cd /home/pi/Documents/buddy-lamp/server || { echo "Server folder not found!"; exit 1; }

# Run npm (use full path to npm)
 /usr/bin/npm run start
```

* Make the script executable:
`chmod +x ~/Documents/start-server.sh`

* Create a systemd service:
`sudo nano /etc/systemd/system/buddy-lamp.service`

* Paste the following into it:
```
[Unit]
Description=Buddy Lamp Node Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Documents/buddy-lamp/server
ExecStart=/home/pi/Documents/start-server.sh
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

#### Enable and Start the Service

* Reload systemd to detect the new service:
`sudo systemctl daemon-reload`

* Enable the service to start on boot:
`sudo systemctl enable buddy-lamp.service`

* Start the service immediately:
`sudo systemctl start buddy-lamp.service`

* Check its status:
`sudo systemctl status buddy-lamp.service`

## Client Setup

### Installing/Running

* Download the `client` repo to your Raspberry Pi.
* Alter the values (see the section below this).
* Open a terminal, go to the directory where the file is.
* Run `python main.py`.

### Customizing

Hard-coding
* Hard-code the values for API URL, household name, and lamp color.
<img width="246" height="92" alt="image" src="https://github.com/user-attachments/assets/b094d7ce-7fe7-48a5-b04a-539bc4cb198a" />
