// ---Dependencies---
const fs = require('fs');
// ---File Paths---
const logfilePath = "./results/logfile.txt";

// Main function
const writeToLogfile = (dataToBeLogged) => {
  fs.readFile(logfilePath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error reading logfile.\nPath: ${logfilePath}\nError: ${err}`);
      return;
    } else {
      const lines = data.trim().split('\n');
      const lastLine = lines[lines.length - 1];

      if (lastLine && lastLine.includes(dataToBeLogged)) {
        // If the last line matches the new log entry, append to it
        const updatedLine = `${lastLine} (x${getCount(lastLine) + 1})`;
        lines[lines.length - 1] = updatedLine;
      } else {
        // If the last line does not match, append the new log entry as a new line
        // add timestamp
        dataToBeLogged = dataToBeLogged + " - " + new Date().toLocaleString();
        lines.push(dataToBeLogged);
      }

      const outputData = lines.join('\n') + '\n';

      fs.writeFile(logfilePath, outputData, 'utf8', (err) => {
        if (err) {
          console.error(`Error writing to logfile.\nPath: ${logfilePath}\nError: ${err}`);
        } else {
          console.log(`Data written to logfile: ${logfilePath}`);
        }
      }); 
    }
  });
};

const getCount = (line) => {
  const match = line.match(/(x(\d+))/);
  return match ? parseInt(match[2]) : 0;
};

module.exports = { writeToLogfile };