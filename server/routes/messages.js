const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message');

router.get('/', messageController.getCurrentColor);

router.post('/', messageController.sendMessage);

module.exports = router;