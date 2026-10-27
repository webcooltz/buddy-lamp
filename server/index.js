// Server entry point

// ---Imports/dependencies---
const path = require('path');
// Load server/.env first (real environment variables win over the file)
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const express = require('express');
const logger = require('morgan');

// ---Helpers---
const logfileModule = require('./utilities/logfile');

// ---Vars---
const port = process.env.PORT || 3000;
const app = express();
const SHUTDOWN_TIMEOUT_MS = 10000;

// --Use middleware--
app
  .use(express.json({ limit: '10kb' }))
  .use(logger('dev'))
  .use('/', require('./routes/index.routes'))
  // Malformed JSON bodies etc.
  .use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    const status = err.status || 500;
    res.status(status).json({ message: status === 400 ? 'Bad request body' : 'Server error' });
  });

/* shutdown():
    -stop accepting connections, let in-flight requests finish, then call done()
    -drops idle keep-alive connections right away and everything else after a timeout
*/
function shutdown(server, done, timeoutMs = SHUTDOWN_TIMEOUT_MS) {
  const timer = setTimeout(() => server.closeAllConnections(), timeoutMs);
  timer.unref();
  server.close(() => {
    clearTimeout(timer);
    done();
  });
  server.closeIdleConnections();
}

// ---Start server--
// Only listen when run directly (so tests can require the app)
if (require.main === module) {
  const secret = process.env.BUDDY_LAMP_SECRET;
  if (!secret || secret.length < 8) {
    console.error('Error - BUDDY_LAMP_SECRET must be set (8+ characters) in server/.env. See server/.env.example.');
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
  // listen() reports failures (e.g. port in use) as an event, not an exception
  server.on('error', (err) => {
    const errorMessage = `Error - Cannot start server:\n${err}`;
    console.error(errorMessage);
    logfileModule.writeToLogfile(errorMessage);
    process.exit(1);
  });

  // systemd / Render send SIGTERM on stop and redeploy; Ctrl+C sends SIGINT
  ['SIGTERM', 'SIGINT'].forEach((signal) => {
    process.once(signal, () => {
      console.log(`${signal} received, shutting down...`);
      shutdown(server, () => process.exit(0));
    });
  });
}

module.exports = app;
module.exports.shutdown = shutdown;
