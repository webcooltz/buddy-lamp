const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message');

router.get('/', messageController.getCurrentColor);

// router.get('/:id', messageController.getSingle);

router.post('/', messageController.sendMessage);

// router.put('/:id', messageController.updateCharacter);

// router.delete('/:id', messageController.deleteCharacter);

module.exports = router;