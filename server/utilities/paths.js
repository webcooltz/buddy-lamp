// Where runtime data (messages, logfile) lives.
// Override with BUDDY_LAMP_DATA_DIR (the simulator and tests use this to avoid touching real data).
const fs = require('fs');
const path = require('path');

const dataDir = process.env.BUDDY_LAMP_DATA_DIR || path.join(__dirname, '..', 'results');
fs.mkdirSync(dataDir, { recursive: true });

// Each family keeps its own color history. `family` must already be validated (see middleware/auth.js).
const messagesPathFor = (family) => path.join(dataDir, `messages-${family}.json`);

module.exports = {
  dataDir,
  messagesPathFor,
  logfilePath: path.join(dataDir, 'logfile.txt')
};
