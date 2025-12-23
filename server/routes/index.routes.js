/* index.routes.js */

// ---Imports/dependencies---
const express = require('express');
const router = express.Router();

// Messages routes - Main
router.use('/messages', require('./messages.routes'));

// Default route
router.get('/', function(req, res) {
  res.send('welcome to buddy lamp :)');
});

// 404 route
router.get('*', (req, res) => {
  res.send('404: oops, bad request!');
});

module.exports = router;