const express = require('express');
const router = express.Router();

router.use('/messages', require('./messages'));

router.get('/', function(req, res) {
  res.send('welcome to buddy lamp :)');
});

router.get('*', (req, res) => {
  res.send('404: oops, bad request!');
});

module.exports = router;