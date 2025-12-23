// Server entry point

// ---Imports/dependencies---
const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');

// ---Helpers---
const logfileModule = require('./utilities/logfile');

// ---Vars---
const port = 3000;
const app = express();

// --Use middleware--
app
  .use(bodyParser.json())
  .use(logger('dev'))
  .use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PATCH, PUT, DELETE, OPTIONS'
    );
    next();
  })
  .use('/', require('./routes/index.routes'));
  
// ---Start server--
try {
  app.listen(port);
  console.log(`Server listening on port ${port}`);
} catch (err) {
  const errorMessage = `Error - Cannot start server:\n${err}`;
  console.error(errorMessage);
  logfileModule.writeToLogfile(errorMessage);
}