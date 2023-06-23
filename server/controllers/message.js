/* Message Controller
    -Purpose: Handle requests related to messages
    -Contains functions:
        -GET getCurrentColor()
            -get the current color from the last message (from the ./results/messages.json file)
            -client queries it every X interval
        -POST sendMessage()
            -receives: household
            -generates: id, date
            -creates and saves a new message to the ./results/messages.json file
            -client sends it when the user presses the lamp button
*/

// ---Imports/dependencies ---
const fs = require('fs');
// ---Helpers---
const logfileModule = require('../utilities/logfile');
// ---Models---
const Message = require('../models/message');
// ---Filepaths---
const messagesPath = './results/messages.json';

// ----------- GET messages ------------ //

/* getCurrentColor():
    -get the current color from the last message and return it
    -uses: readMessages(), getLastColor()
*/
const getCurrentColor = (req, res) => {
    readMessages()
        .then((messages) => {
            let currentColor = "white";

            console.log(`messages: ${messages}`);

            // if no messages, return white
            if (messages.length === 0) {
                const warningMessage = `Warning - Cannot get current color (message.js - getCurrentColor()): No messages found.`;
                console.log(warningMessage);
                logfileModule.writeToLogfile(warningMessage);

                res.status(200).json({
                    color: currentColor
                });
            } else {
                currentColor = getLastColor(messages);
                currentColor = !currentColor ? "white" : currentColor;

                const successMessage = `Success - Current color retrieved: ${currentColor}`;
                console.log(successMessage);
                logfileModule.writeToLogfile(successMessage);

                res.status(200).json({
                    color: currentColor
                });
            }
        })
        .catch((err) => {
            const errorMessage = `Error - Cannot get current color (at message.js getCurrentColor()):\n${err}`;
            console.error(errorMessage);
            logfileModule.writeToLogfile(errorMessage);

            res.status(500).json({ message: "Failed to retrieve color" });
        });
};

/* readMessages():
    -read the messages.json file
    -return the messages
*/
function readMessages() {
    return new Promise((resolve, reject) => {
        fs.readFile(messagesPath, 'utf8', (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') { // file not found
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
            } else if (data === '') { // empty file
                const warningMessage = `Warning - File is empty (at ${messagesPath}).`;
                console.error(warningMessage);
                logfileModule.writeToLogfile(warningMessage);

                resolve([]);
            } else { // file contains data
                const messages = JSON.parse(data);

                console.log(`messages: ${messages}`);

                if (Array.isArray(messages)) {
                    const successMessage = `Success - Messages parsed.`;
                    console.log(successMessage);
                    logfileModule.writeToLogfile(successMessage);

                    resolve(messages);
                } else {
                    const errorMessage = `Error - Messages not parsed.`;
                    console.error(errorMessage);
                    logfileModule.writeToLogfile(errorMessage);

                    reject(err);
                }
            }
        });
    });
}

/* getLastColor():
    -get the last color from the messages (returned from readMessages())
*/
function getLastColor(messages) {
    if (Array.isArray(messages) && messages.length > 0) {
        // get color from last message
        const lastMessage = messages[messages.length - 1];
        let currentColor;

        if (!lastMessage) {
            currentColor = "white";

            const warningMessage = `Warning - Could not get current color (message.js - getCurrentColor()): No color found. White used.`;
            console.log(warningMessage);
            logfileModule.writeToLogfile(warningMessage);
        } else {
            currentColor = lastMessage.household.color
            
            const successMessage = `Success - Current color retrieved: ${currentColor}`;
            console.log(successMessage);
            logfileModule.writeToLogfile(successMessage);
        }

        return currentColor;
    } else {
        const errorMessage = `Error - Cannot get current color (message.js - getCurrentColor.getCurrentColor()).`;
        console.error(errorMessage);
        logfileModule.writeToLogfile(errorMessage);

        return null;
    }
}

// ----------- POST message ------------ //

/* sendMessage()
    -receives: household
    -generates: id, date
    -saves message
    -Uses: generateId(), saveMessage()
*/
const sendMessage = (req, res) => {
    // Create a new message
    // -Generate a new ID
    // -Generate a timestamp
    const newId = generateId();
    const timestamp = new Date();
    const message = new Message(newId, timestamp, req.body.household);

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

/* generateId():
    -Generate a new numeric ID for the message
    -Uses: getLastID()
*/
function generateId() {
    let counter = getLastID();
    counter++;
    return counter;
}

/* getLastID():
    -Get the current value of the counter from the messages JSON file
    -Parses messages.json to get the last message ID
*/
function getLastID() {
    if (fs.existsSync(messagesPath)) {
        const messagesJSON = fs.readFileSync(messagesPath, 'utf8');
        
        if (messagesJSON.length > 0) {
            const messages = JSON.parse(messagesJSON);
            const lastMessageId = parseInt(messages[messages.length - 1].id);
            // if the last message ID is a number, return it -- otherwise, return 1
            return !isNaN(lastMessageId) ? lastMessageId : 1;
      }
    }
    // Default starting value
    return 0;
}

/* saveMessage():
    -Save the message to the ./results/messages JSON file
*/
function saveMessage(message) {
    return new Promise((resolve, reject) => {
        let existingData = [];

        // Read the existing data from the JSON file, if any
        if (fs.existsSync(messagesPath)) {
            const data = fs.readFileSync(messagesPath, 'utf8');
            existingData = data.length > 0 ? JSON.parse(data) : [];
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