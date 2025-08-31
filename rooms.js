const express = require('express');
const { 
  createRoom, 
  joinRoom, 
  leaveRoom, 
  getRooms, 
  getRoom 
} = require('../controllers/roomController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All room routes require authentication
router.use(authenticateToken);

router.post('/create', createRoom);
router.post('/:roomId/join', joinRoom);
router.post('/:roomId/leave', leaveRoom);
router.get('/', getRooms);
router.get('/:roomId', getRoom);

module.exports = router;