// Purpose: Handle requests related to messages
// modules
const fs = require('fs');
const path = require('path');
// helpers
const logfileModule = require('../utilities/logfile');
// models
const Message = require('../models/message');
// filepaths
const counterPath = './results/counter.txt';
const messagesPath = './results/messages.json';
const colorPath = './results/color.txt';

// ----------- GET messages ------------ //

// receives
// -color
// -date
// gives
// -messages
const getCurrentColor = (req, res) => {
    readMessages()
        .then((messages) => {
            const currentColor = getLastColor(messages);
            const successMessage = `Success - Messages retrieved.`;
            console.log(successMessage);
            logfileModule.writeToLogfile(successMessage);
            res.status(200).json({
                currentColor: currentColor
            });
        })
        .catch((err) => {
            const errorMessage = `Error - Cannot get messages (at message.js getCurrentColor()):\n${err}`;
            console.error(errorMessage);
            logfileModule.writeToLogfile(errorMessage);
            res.status(500).json({ message: 'Failed to retrieve messages' });
        });
};

// Read messages from the JSON file
function readMessages() {
    return new Promise((resolve, reject) => {
        fs.readFile(messagesPath, 'utf8', (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    const errorMessage = `Error - File not found (at ${messagesPath}):\n${err}`;
                    console.error(errorMessage);
                    logfileModule.writeToLogfile(errorMessage);
                    resolve([]);
                } else {
                    const errorMessage = `Error - Other error:\n${err}`;
                    console.error(errorMessage);
                    logfileModule.writeToLogfile(errorMessage);
                    reject(err);
                }
            } else {
                const messages = JSON.parse(data);
                const successMessage = `Success - Messages parsed.`;
                console.log(successMessage);
                logfileModule.writeToLogfile(successMessage);
                resolve(messages);
            }
        });
    });
}

// Get the current color from the last message
function getLastColor(messages) {
    console.log("messages: ", messages);
    if (Array.isArray(messages) && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
            // get last color
            const currentColor = lastMessage.household.color;
            // write result
            const successMessage = `Success - Current color retrieved: ${currentColor}`;
            console.log(successMessage);
            logfileModule.writeToLogfile(successMessage);
            return currentColor;
    } else {
        const errorMessage = `Error - Cannot get current color (message.js - getCurrentColor.getCurrentColor()).`;
        console.error(errorMessage);
        logfileModule.writeToLogfile(errorMessage);
        return null;
    }
}

// ----------- POST message ------------ //

// POST request to /messages
// (user presses the lamp button)
// -receives: household
// -generates: id, date
const sendMessage = (req, res) => {
    // Generate a new ID
    const newId = generateId();
    // Get the current date and time
    const timestamp = new Date();

    // Create a new message instance with the generated ID and request body data
    const message = new Message(newId, req.body.household, timestamp);

    // Save the message to a JSON file
    saveMessage(message)
        .then(() => {
            const successMessage = `Success - Message sent.`;
            console.log(successMessage);
            logfileModule.writeToLogfile(successMessage);
            res.status(201).json({ message: 'Message sent successfully' });
        })
        .catch((err) => {
            const errorMessage = `Error - Cannot send message (at message.js - sendMessage()):\n${err}`;
            console.error(errorMessage);
            logfileModule.writeToLogfile(errorMessage);
            res.status(500).json({ message: 'Message failed to send' });
        });
};

// Generate a new numeric ID for the message
function generateId() {
    let counter = getCounter();
    counter++;
    // saveCounter(counter);
    return counter;
}

// Get the current value of the counter
// -Parses messages.json to get the last message ID
function getCounter() {
    if (fs.existsSync(messagesPath)) {
      const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
      if (Array.isArray(messages) && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.hasOwnProperty('id')) {
          const lastMessageId = parseInt(lastMessage.id);
          if (!isNaN(lastMessageId)) {
            return lastMessageId;
          }
        }
      }
    }
    return 1; // Default starting value if the counter file doesn't exist or is invalid
}

// Save the updated counter value
// function saveCounter(counter) {
//     const filePath = path.join(__dirname, counterPath);
//     fs.writeFileSync(filePath, counter.toString(), 'utf8');
// }

// Save the message to a JSON file
function saveMessage(message) {
    return new Promise((resolve, reject) => {
        // Read the existing data from the JSON file, if any
        let existingData = [];
        if (fs.existsSync(messagesPath)) {
            const data = fs.readFileSync(messagesPath, 'utf8');
            existingData = JSON.parse(data);
        }

        // Add the new message to the existing data
        existingData.push(message);

        // Write the updated data to the JSON file
        fs.writeFile(messagesPath, JSON.stringify(existingData, null, 2), 'utf8', (err) => {
            if (err) {
                const errorMessage = `Error - Cannot save message (at message.js - sendMessage.saveMessage()):\n${err}`;
                console.error(errorMessage);
                logfileModule.writeToLogfile(errorMessage);
                reject(err);
            } else {
                const successMessage = `Success - Message saved.`;
                console.log(successMessage);
                logfileModule.writeToLogfile(successMessage);
                resolve();
            }
        });
    });
}

module.exports = { getCurrentColor, sendMessage };