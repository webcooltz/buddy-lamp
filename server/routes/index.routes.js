/* index.routes.js */

// ---Imports/dependencies---
const express = require('express');
const router = express.Router();

// Messages routes - Main (requires secret + family)
router.use('/messages', require('./messages.routes'));

// Health check (no auth) - for Render / uptime monitors
router.get('/health', function(req, res) {
  res.status(200).json({ status: 'ok' });
});

// Default route
router.get('/', function(req, res) {
  res.send('welcome to buddy lamp :)');
});

// 404 route
router.use((req, res) => {
  res.status(404).send('404: oops, bad request!');
});

module.exports = router;
