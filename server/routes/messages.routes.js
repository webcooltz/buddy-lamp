const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', messageController.getCurrentColor);

router.post('/', messageController.sendMessage);

module.exports = router;
