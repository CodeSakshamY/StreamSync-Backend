const express = require('express');
const { upload, uploadFile, deleteFile } = require('../controllers/uploadController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All upload routes require authentication
router.use(authenticateToken);

router.post('/file', upload.single('file'), uploadFile);
router.delete('/file/:filename', deleteFile);

module.exports = router;