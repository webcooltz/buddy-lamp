/* Message Controller
    -Purpose: Handle requests related to messages
    -Contains functions:
        -GET getCurrentColor()
            -get the current color from the last message (from the messages.json file)
            -client queries it every X interval
        -POST sendMessage()
            -receives: household
            -generates: id, date
            -creates and saves a new message to the messages.json file
            -client sends it when the user presses the lamp button
*/

// ---Imports/dependencies ---
const fs = require('fs');
// ---Helpers---
const logfileModule = require('../utilities/logfile');
const { messagesPathFor } = require('../utilities/paths');
// ---Models---
const Message = require('../models/message.model');
// ---Const---
const WHITE_COLOR = "white";
const BLUE_COLOR = "blue";
const RED_COLOR = "red";
const GREEN_COLOR = "green";
const validColors = [WHITE_COLOR, BLUE_COLOR, RED_COLOR, GREEN_COLOR];
// Only the latest messages matter (the color comes from the last one); cap the file size
const MAX_MESSAGES = 100;
const MAX_NAME_LENGTH = 32;

// ----------- GET messages ------------ //

/* GET - getCurrentColor():
    -get the current color from the family's last message and return it
    -clients poll this every few seconds, so success is not logged (it would flood the logfile)
*/
const getCurrentColor = (req, res) => {
    try {
        const messages = readMessages(messagesPathFor(req.family));
        const color = getLastColor(messages);

        res.status(200).json({ color });
    } catch (err) {
        const errorMessage = `Error - Cannot get current color (at message.controller.js getCurrentColor()):\n${err}`;
        console.error(errorMessage);
        logfileModule.writeToLogfile(errorMessage);

        res.status(500).json({ message: "Failed to retrieve color" });
    }
};

/* HELPER - readMessages():
    -read a family's messages file
    -returns the messages array ([] if the file is missing or empty)
    -throws if the file exists but is not a valid messages array
*/
function readMessages(messagesPath) {
    let data;
    try {
        data = fs.readFileSync(messagesPath, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') { // file not found: no messages yet
            return [];
        }
        throw err;
    }

    if (data.trim() === '') { // empty file
        return [];
    }

    const messages = JSON.parse(data);
    if (!Array.isArray(messages)) {
        throw new Error(`${messagesPath} does not contain a JSON array.`);
    }
    return messages;
}

/* HELPER getLastColor():
    -get the color of the last message that has one (white if there is none)
*/
function getLastColor(messages) {
    const lastMessage = messages[messages.length - 1];
    const color = lastMessage?.household?.color;
    return validColors.includes(color) ? color : WHITE_COLOR;
}

// ----------- POST message ------------ //

/* POST - sendMessage()
    -receives: household ({ name, color })
    -generates: id, date
    -saves message
*/
const sendMessage = (req, res) => {
    const household = req.body?.household;

    if (!household || typeof household !== 'object') {
        return res.status(400).json({ message: "Missing household" });
    }

    const name = typeof household.name === 'string' ? household.name.trim() : '';
    if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
        return res.status(400).json({ message: `Household name must be 1-${MAX_NAME_LENGTH} characters` });
    }

    // use only valid colors (whichever LEDs we have assigned)
    if (!validateColor(household.color)) {
        return res.status(400).json({ message: "Invalid color value" });
    }

    try {
        const messagesPath = messagesPathFor(req.family);
        const messages = readMessages(messagesPath);
        const message = new Message(
            generateId(messages),
            new Date(),
            { name, color: household.color } // drop unexpected fields
        );

        messages.push(message);
        writeMessages(messagesPath, messages.slice(-MAX_MESSAGES));

        const successMessage = `Success - Message sent (${req.family}/${name}: ${household.color}).`;
        console.log(successMessage);
        logfileModule.writeToLogfile(successMessage);

        res.status(201).json({ message: 'Message sent successfully' });
    } catch (err) {
        const errorMessage = `Error - Cannot send message (at message.controller.js sendMessage()):\n${err}`;
        console.error(errorMessage);
        logfileModule.writeToLogfile(errorMessage);

        res.status(500).json({ message: 'Message failed to send' });
    }
};

// ------------- Helper functions ------------- //

/* generateId():
    -Generate a new numeric ID: one more than the last message's ID
*/
function generateId(messages) {
    const lastId = parseInt(messages[messages.length - 1]?.id, 10);
    return Number.isNaN(lastId) ? 1 : lastId + 1;
}

/* writeMessages():
    -Write to a temp file then rename, so a crash mid-write can't leave a corrupt messages.json
    -Synchronous, so two requests can never interleave a read-modify-write
*/
function writeMessages(messagesPath, messages) {
    const tmpPath = `${messagesPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(messages, null, 2), 'utf8');
    fs.renameSync(tmpPath, messagesPath);
}

function validateColor(color) {
    return validColors.includes(color);
}

module.exports = { getCurrentColor, sendMessage };
