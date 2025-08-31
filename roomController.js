const { supabaseAdmin } = require('../config/supabase');

const createRoom = async (req, res) => {
  try {
    const { name, description, settings } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Room name is required' });
    }

    // Create room
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .insert({
        name,
        description: description || '',
        host_id: req.user.id,
        settings: {
          is_private: settings?.isPrivate || false,
          allow_chatting: settings?.allowChatting !== false,
          allow_memes: settings?.allowMemes !== false,
          max_participants: settings?.maxParticipants || 50
        },
        is_active: true
      })
      .select()
      .single();

    if (roomError) {
      return res.status(500).json({ message: 'Error creating room' });
    }

    // Add host as participant
    const { error: participantError } = await supabaseAdmin
      .from('room_participants')
      .insert({
        room_id: room.id,
        user_id: req.user.id,
        is_active: true
      });

    if (participantError) {
      console.error('Error adding host as participant:', participantError);
    }

    // Get room with populated data
    const { data: roomWithData, error: fetchError } = await supabaseAdmin
      .from('rooms')
      .select(`
        *,
        host:profiles!rooms_host_id_fkey(username, avatar),
        participants:room_participants!inner(
          user_id,
          joined_at,
          is_active,
          user:profiles(username, avatar, is_online)
        )
      `)
      .eq('id', room.id)
      .single();

    if (fetchError) {
      return res.status(500).json({ message: 'Error fetching room data' });
    }

    res.status(201).json({
      message: 'Room created successfully',
      room: roomWithData
    });

  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Error creating room' });
  }
};

const joinRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    // Check if room exists and is active
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('*, participants:room_participants(user_id, is_active)')
      .eq('id', roomId)
      .eq('is_active', true)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ message: 'Room not found or inactive' });
    }

    // Check if user is already in the room
    const existingParticipant = room.participants.find(
      p => p.user_id === userId
    );

    if (existingParticipant) {
      // Reactivate if inactive
      if (!existingParticipant.is_active) {
        const { error: updateError } = await supabaseAdmin
          .from('room_participants')
          .update({ 
            is_active: true,
            joined_at: new Date().toISOString()
          })
          .eq('room_id', roomId)
          .eq('user_id', userId);

        if (updateError) {
          return res.status(500).json({ message: 'Error rejoining room' });
        }
      }
    } else {
      // Check room capacity
      const activeParticipants = room.participants.filter(p => p.is_active).length;
      if (activeParticipants >= room.settings.max_participants) {
        return res.status(400).json({ message: 'Room is full' });
      }

      // Add new participant
      const { error: insertError } = await supabaseAdmin
        .from('room_participants')
        .insert({
          room_id: roomId,
          user_id: userId,
          is_active: true
        });

      if (insertError) {
        return res.status(500).json({ message: 'Error joining room' });
      }
    }

    // Get updated room data
    const { data: updatedRoom, error: fetchError } = await supabaseAdmin
      .from('rooms')
      .select(`
        *,
        host:profiles!rooms_host_id_fkey(username, avatar),
        participants:room_participants!inner(
          user_id,
          joined_at,
          is_active,
          user:profiles(username, avatar, is_online)
        )
      `)
      .eq('id', roomId)
      .single();

    if (fetchError) {
      return res.status(500).json({ message: 'Error fetching room data' });
    }

    res.json({
      message: 'Joined room successfully',
      room: updatedRoom
    });

  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ message: 'Error joining room' });
  }
};

const leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const { error } = await supabaseAdmin
      .from('room_participants')
      .update({ is_active: false })
      .eq('room_id', roomId)
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ message: 'Error leaving room' });
    }

    res.json({ message: 'Left room successfully' });

  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ message: 'Error leaving room' });
  }
};

const getRooms = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('rooms')
      .select(`
        *,
        host:profiles!rooms_host_id_fkey(username, avatar),
        participants:room_participants!inner(
          user_id,
          is_active,
          user:profiles(username, avatar, is_online)
        )
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: rooms, error, count } = await query;

    if (error) {
      return res.status(500).json({ message: 'Error fetching rooms' });
    }

    res.json({
      rooms,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });

  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ message: 'Error fetching rooms' });
  }
};

const getRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const { data: room, error } = await supabaseAdmin
      .from('rooms')
      .select(`
        *,
        host:profiles!rooms_host_id_fkey(username, avatar),
        participants:room_participants!inner(
          user_id,
          joined_at,
          is_active,
          user:profiles(username, avatar, is_online)
        )
      `)
      .eq('id', roomId)
      .eq('is_active', true)
      .single();

    if (error || !room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json({ room });

  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ message: 'Error fetching room' });
  }
};

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  getRooms,
  getRoom
};