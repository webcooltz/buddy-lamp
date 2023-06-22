const express = require('express');
const router = express.Router();

// router.use('/login', require('./login'));
router.use('/messages', require('./messages'));
// router.use('/api-docs', require('./swagger'));

router.get('/', function(req, res, next) {
  res.send('welcome :)');
});

router.get('*', (req, res) => {
  res.send('404: oops, bad request!');
});

module.exports = router;