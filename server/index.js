const express = require('express');
const port = process.env.PORT || 3000;
var logger = require('morgan');
const bodyParser = require('body-parser');

const app = express();

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
  .use('/', require('./routes'));

app.listen(port);
console.log(`Server started on port ${port}`);