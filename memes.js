const express = require('express');
const { addMeme, listMemes, getMeme, likeMeme } = require('../controllers/memeController');
const { upload } = require('../controllers/uploadController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public routes (with optional auth)
router.get('/list', optionalAuth, listMemes);
router.get('/:memeId', optionalAuth, getMeme);

// Protected routes
router.post('/add', authenticateToken, upload.single('file'), async (req, res, next) => {
  // Handle file upload first, then pass to meme controller
  if (req.file) {
    const { uploadFile } = require('../controllers/uploadController');
    // Store original res.json to capture upload response
    const originalJson = res.json;
    res.json = (data) => {
      if (data.file) {
        req.fileUrl = data.file.url;
        req.fileMetadata = {
          mimetype: data.file.mimetype,
          size: data.file.size,
          originalName: data.file.originalName
        };
        // Restore original res.json and continue to meme controller
        res.json = originalJson;
        next();
      } else {
        originalJson.call(res, data);
      }
    };
    uploadFile(req, res, next);
  } else {
    next();
  }
}, addMeme);
router.post('/:memeId/like', authenticateToken, likeMeme);

module.exports = router;