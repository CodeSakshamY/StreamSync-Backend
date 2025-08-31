const { supabaseAdmin } = require('../config/supabase');

const addReview = async (req, res) => {
  try {
    const { memeId, rating, comment, isPublic = true } = req.body;

    if (!memeId || !rating) {
      return res.status(400).json({ message: 'Meme ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Check if meme exists
    const { data: meme, error: memeError } = await supabaseAdmin
      .from('memes')
      .select('id')
      .eq('id', memeId)
      .single();

    if (memeError || !meme) {
      return res.status(404).json({ message: 'Meme not found' });
    }

    // Check if user already reviewed this meme
    const { data: existingReview, error: reviewCheckError } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('meme_id', memeId)
      .eq('reviewer_id', req.user.id)
      .single();

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this meme' });
    }

    const { data: review, error: insertError } = await supabaseAdmin
      .from('reviews')
      .insert({
        meme_id: memeId,
        reviewer_id: req.user.id,
        rating,
        comment: comment || '',
        is_public: isPublic
      })
      .select(`
        *,
        reviewer:profiles!reviews_reviewer_id_fkey(username, avatar),
        meme:memes!reviews_meme_id_fkey(title)
      `)
      .single();

    if (insertError) {
      return res.status(500).json({ message: 'Error adding review' });
    }

    res.status(201).json({
      message: 'Review added successfully',
      review
    });

  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ message: 'Error adding review' });
  }
};

const listReviews = async (req, res) => {
  try {
    const { memeId, page = 1, limit = 10, sortBy = 'created_at' } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('reviews')
      .select(`
        *,
        reviewer:profiles!reviews_reviewer_id_fkey(username, avatar),
        meme:memes!reviews_meme_id_fkey(title, file_url),
        helpful_marks:review_helpful(user_id, is_helpful)
      `, { count: 'exact' })
      .eq('is_public', true);

    if (memeId) {
      query = query.eq('meme_id', memeId);
    }

    // Apply sorting
    const sortColumn = sortBy === 'helpful' ? 'created_at' : sortBy; // We'll handle helpful sorting separately
    query = query
      .order(sortColumn, { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: reviews, error, count } = await query;

    if (error) {
      return res.status(500).json({ message: 'Error fetching reviews' });
    }

    // Add helpful counts
    const reviewsWithCounts = reviews.map(review => ({
      ...review,
      helpful_count: review.helpful_marks?.filter(h => h.is_helpful).length || 0
    }));

    // Sort by helpful count if requested
    if (sortBy === 'helpful') {
      reviewsWithCounts.sort((a, b) => b.helpful_count - a.helpful_count);
    }

    // Calculate average rating if memeId is provided
    let averageRating = null;
    if (memeId) {
      const { data: ratingData, error: ratingError } = await supabaseAdmin
        .from('reviews')
        .select('rating')
        .eq('meme_id', memeId)
        .eq('is_public', true);

      if (!ratingError && ratingData.length > 0) {
        const sum = ratingData.reduce((acc, review) => acc + review.rating, 0);
        averageRating = {
          average: Math.round((sum / ratingData.length) * 10) / 10,
          total: ratingData.length
        };
      }
    }

    res.json({
      reviews: reviewsWithCounts,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
      averageRating
    });

  } catch (error) {
    console.error('List reviews error:', error);
    res.status(500).json({ message: 'Error fetching reviews' });
  }
};

const markHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { isHelpful } = req.body;
    const userId = req.user.id;

    if (typeof isHelpful !== 'boolean') {
      return res.status(400).json({ message: 'isHelpful must be a boolean' });
    }

    // Check if review exists
    const { data: review, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .select('id')
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Check if user already marked this review
    const { data: existingMark, error: markCheckError } = await supabaseAdmin
      .from('review_helpful')
      .select('id')
      .eq('review_id', reviewId)
      .eq('user_id', userId)
      .single();

    if (existingMark) {
      // Update existing mark
      const { error: updateError } = await supabaseAdmin
        .from('review_helpful')
        .update({ 
          is_helpful: isHelpful,
          marked_at: new Date().toISOString()
        })
        .eq('review_id', reviewId)
        .eq('user_id', userId);

      if (updateError) {
        return res.status(500).json({ message: 'Error updating helpful mark' });
      }
    } else {
      // Create new mark
      const { error: insertError } = await supabaseAdmin
        .from('review_helpful')
        .insert({
          review_id: reviewId,
          user_id: userId,
          is_helpful: isHelpful
        });

      if (insertError) {
        return res.status(500).json({ message: 'Error marking review as helpful' });
      }
    }

    // Get updated review data
    const { data: updatedReview, error: fetchError } = await supabaseAdmin
      .from('reviews')
      .select(`
        *,
        reviewer:profiles!reviews_reviewer_id_fkey(username, avatar),
        helpful_marks:review_helpful(user_id, is_helpful)
      `)
      .eq('id', reviewId)
      .single();

    if (fetchError) {
      return res.status(500).json({ message: 'Error fetching updated review' });
    }

    updatedReview.helpful_count = updatedReview.helpful_marks?.filter(h => h.is_helpful).length || 0;

    res.json({
      message: 'Review marked successfully',
      review: updatedReview
    });

  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({ message: 'Error marking review as helpful' });
  }
};

module.exports = {
  addReview,
  listReviews,
  markHelpful
};