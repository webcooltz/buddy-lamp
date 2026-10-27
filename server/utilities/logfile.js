// ---Dependencies---
const fs = require('fs');
// ---File Paths---
const { logfilePath } = require('./paths');
// ---Const---
const MAX_LINES = 500;

// Main function
// Synchronous on purpose: concurrent async read/write cycles used to clobber each other.
const writeToLogfile = (dataToBeLogged) => {
  try {
    let lines = [];
    if (fs.existsSync(logfilePath)) {
      const data = fs.readFileSync(logfilePath, 'utf8').trim();
      lines = data ? data.split('\n') : [];
    }

    const lastLine = lines[lines.length - 1];

    if (lastLine && lastLine.includes(dataToBeLogged)) {
      // If the last line matches the new log entry, bump its repeat count
      lines[lines.length - 1] = `${stripCount(lastLine)} (x${getCount(lastLine) + 1})`;
    } else {
      // Otherwise add a new timestamped line
      lines.push(`${dataToBeLogged} - ${new Date().toLocaleString()}`);
    }

    // Keep the file (and SD card wear) bounded
    lines = lines.slice(-MAX_LINES);
    fs.writeFileSync(logfilePath, lines.join('\n') + '\n', 'utf8');
  } catch (err) {
    console.error(`Error writing to logfile.\nPath: ${logfilePath}\nError: ${err}`);
  }
};

const countPattern = / \(x(\d+)\)$/;

const getCount = (line) => {
  const match = line.match(countPattern);
  return match ? parseInt(match[1], 10) : 1;
};

const stripCount = (line) => line.replace(countPattern, '');

module.exports = { writeToLogfile };
