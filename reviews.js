const express = require('express');
const { addReview, listReviews, markHelpful } = require('../controllers/reviewController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public routes (with optional auth)
router.get('/list', optionalAuth, listReviews);

// Protected routes
router.post('/add', authenticateToken, addReview);
router.post('/:reviewId/helpful', authenticateToken, markHelpful);

module.exports = router;