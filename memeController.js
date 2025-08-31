const { supabaseAdmin } = require('../config/supabase');

const addMeme = async (req, res) => {
  try {
    const { title, description, tags, roomId, isPublic = true } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    if (!req.fileUrl) {
      return res.status(400).json({ message: 'File upload required' });
    }

    // Determine file type from URL or metadata
    let fileType = 'image';
    if (req.fileMetadata?.mimetype) {
      if (req.fileMetadata.mimetype.startsWith('video/')) {
        fileType = 'video';
      } else if (req.fileMetadata.mimetype === 'image/gif') {
        fileType = 'gif';
      }
    }

    const { data: meme, error } = await supabaseAdmin
      .from('memes')
      .insert({
        title,
        description: description || '',
        creator_id: req.user.id,
        room_id: roomId || null,
        file_url: req.fileUrl,
        file_type: fileType,
        file_size: req.fileMetadata?.size || 0,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        is_public: isPublic,
        moderation_status: 'approved'
      })
      .select(`
        *,
        creator:profiles!memes_creator_id_fkey(username, avatar)
      `)
      .single();

    if (error) {
      return res.status(500).json({ message: 'Error adding meme' });
    }

    res.status(201).json({
      message: 'Meme added successfully',
      meme
    });

  } catch (error) {
    console.error('Add meme error:', error);
    res.status(500).json({ message: 'Error adding meme' });
  }
};

const listMemes = async (req, res) => {
  try {
    const { page = 1, limit = 20, roomId, tags, search, sortBy = 'created_at' } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('memes')
      .select(`
        *,
        creator:profiles!memes_creator_id_fkey(username, avatar),
        room:rooms!memes_room_id_fkey(name),
        likes:meme_likes(user_id)
      `, { count: 'exact' })
      .eq('is_public', true)
      .eq('moderation_status', 'approved');

    // Filter by room
    if (roomId) {
      query = query.eq('room_id', roomId);
    }

    // Filter by tags
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query = query.overlaps('tags', tagArray);
    }

    // Search in title and description
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting and pagination
    const sortColumn = sortBy === 'likes' ? 'created_at' : sortBy; // We'll handle likes sorting separately
    query = query
      .order(sortColumn, { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: memes, error, count } = await query;

    if (error) {
      return res.status(500).json({ message: 'Error fetching memes' });
    }

    // Add like counts to memes
    const memesWithCounts = memes.map(meme => ({
      ...meme,
      like_count: meme.likes?.length || 0
    }));

    // Sort by likes if requested
    if (sortBy === 'likes') {
      memesWithCounts.sort((a, b) => b.like_count - a.like_count);
    }

    res.json({
      memes: memesWithCounts,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });

  } catch (error) {
    console.error('List memes error:', error);
    res.status(500).json({ message: 'Error fetching memes' });
  }
};

const getMeme = async (req, res) => {
  try {
    const { memeId } = req.params;

    const { data: meme, error } = await supabaseAdmin
      .from('memes')
      .select(`
        *,
        creator:profiles!memes_creator_id_fkey(username, avatar),
        room:rooms!memes_room_id_fkey(name),
        likes:meme_likes(user_id)
      `)
      .eq('id', memeId)
      .single();

    if (error || !meme) {
      return res.status(404).json({ message: 'Meme not found' });
    }

    // Increment view count
    await supabaseAdmin
      .from('memes')
      .update({ views: (meme.views || 0) + 1 })
      .eq('id', memeId);

    // Add like count
    meme.like_count = meme.likes?.length || 0;

    res.json({ meme });

  } catch (error) {
    console.error('Get meme error:', error);
    res.status(500).json({ message: 'Error fetching meme' });
  }
};

const likeMeme = async (req, res) => {
  try {
    const { memeId } = req.params;
    const userId = req.user.id;

    // Check if meme exists
    const { data: meme, error: memeError } = await supabaseAdmin
      .from('memes')
      .select('id')
      .eq('id', memeId)
      .single();

    if (memeError || !meme) {
      return res.status(404).json({ message: 'Meme not found' });
    }

    // Check if user already liked this meme
    const { data: existingLike, error: likeCheckError } = await supabaseAdmin
      .from('meme_likes')
      .select('id')
      .eq('meme_id', memeId)
      .eq('user_id', userId)
      .single();

    let isLiked = false;

    if (existingLike) {
      // Remove like
      const { error: deleteError } = await supabaseAdmin
        .from('meme_likes')
        .delete()
        .eq('meme_id', memeId)
        .eq('user_id', userId);

      if (deleteError) {
        return res.status(500).json({ message: 'Error removing like' });
      }
    } else {
      // Add like
      const { error: insertError } = await supabaseAdmin
        .from('meme_likes')
        .insert({
          meme_id: memeId,
          user_id: userId
        });

      if (insertError) {
        return res.status(500).json({ message: 'Error adding like' });
      }
      isLiked = true;
    }

    // Get updated meme data
    const { data: updatedMeme, error: fetchError } = await supabaseAdmin
      .from('memes')
      .select(`
        *,
        creator:profiles!memes_creator_id_fkey(username, avatar),
        likes:meme_likes(user_id)
      `)
      .eq('id', memeId)
      .single();

    if (fetchError) {
      return res.status(500).json({ message: 'Error fetching updated meme' });
    }

    updatedMeme.like_count = updatedMeme.likes?.length || 0;

    res.json({
      message: isLiked ? 'Meme liked' : 'Like removed',
      meme: updatedMeme,
      isLiked
    });

  } catch (error) {
    console.error('Like meme error:', error);
    res.status(500).json({ message: 'Error liking meme' });
  }
};

module.exports = {
  addMeme,
  listMemes,
  getMeme,
  likeMeme
};