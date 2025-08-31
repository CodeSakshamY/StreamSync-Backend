const { verifySupabaseToken, getUserProfile } = require('../utils/supabaseAuth');
const { supabaseAdmin } = require('../config/supabase');

// Store active connections
const activeConnections = new Map();
const roomConnections = new Map();

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const user = await verifySupabaseToken(token);
    const profile = await getUserProfile(user.id);
    
    socket.userId = user.id;
    socket.user = {
      id: user.id,
      email: user.email,
      ...profile
    };
    
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
};

const handleConnection = (io) => {
  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.username} connected (${socket.id})`);
    
    // Store connection
    activeConnections.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      connectedAt: new Date()
    });

    // Update user online status
    supabaseAdmin
      .from('profiles')
      .update({ 
        is_online: true,
        last_seen: new Date().toISOString()
      })
      .eq('id', socket.userId)
      .then(() => {
        console.log(`Updated online status for ${socket.user.username}`);
      });

    // Handle room joining
    socket.on('join-room', async (data) => {
      try {
        const { roomId } = data;
        
        // Validate room exists and user is participant
        const { data: room, error: roomError } = await supabaseAdmin
          .from('rooms')
          .select(`
            *,
            participants:room_participants!inner(
              user_id,
              is_active,
              user:profiles(username, avatar)
            )
          `)
          .eq('id', roomId)
          .single();
        
        if (roomError || !room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        const isParticipant = room.participants.some(
          p => p.user_id === socket.userId && p.is_active
        );

        if (!isParticipant) {
          socket.emit('error', { message: 'Not authorized to join this room' });
          return;
        }

        // Join socket room
        socket.join(roomId);
        socket.currentRoom = roomId;

        // Track room connections
        if (!roomConnections.has(roomId)) {
          roomConnections.set(roomId, new Set());
        }
        roomConnections.get(roomId).add(socket.userId);

        // Notify others in room
        socket.to(roomId).emit('user-joined', {
          user: {
            id: socket.user.id,
            username: socket.user.username,
            avatar: socket.user.avatar
          },
          timestamp: new Date()
        });

        // Send current room state to user
        socket.emit('room-state', {
          room,
          connectedUsers: Array.from(roomConnections.get(roomId))
        });

        console.log(`User ${socket.user.username} joined room ${roomId}`);

      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('error', { message: 'Error joining room' });
      }
    });

    // Handle video sync events
    socket.on('video-play', (data) => {
      if (socket.currentRoom) {
        // Update room state in database
        supabaseAdmin
          .from('rooms')
          .update({
            current_video: {
              ...data,
              is_playing: true,
              last_updated: new Date().toISOString()
            }
          })
          .eq('id', socket.currentRoom)
          .then(() => {
            socket.to(socket.currentRoom).emit('video-play', {
              ...data,
              triggeredBy: socket.user.username,
              timestamp: new Date()
            });
          });
      }
    });

    socket.on('video-pause', (data) => {
      if (socket.currentRoom) {
        // Update room state in database
        supabaseAdmin
          .from('rooms')
          .update({
            current_video: {
              ...data,
              is_playing: false,
              last_updated: new Date().toISOString()
            }
          })
          .eq('id', socket.currentRoom)
          .then(() => {
            socket.to(socket.currentRoom).emit('video-pause', {
              ...data,
              triggeredBy: socket.user.username,
              timestamp: new Date()
            });
          });
      }
    });

    socket.on('video-seek', (data) => {
      if (socket.currentRoom) {
        // Update room state in database
        supabaseAdmin
          .from('rooms')
          .update({
            current_video: {
              ...data,
              last_updated: new Date().toISOString()
            }
          })
          .eq('id', socket.currentRoom)
          .then(() => {
            socket.to(socket.currentRoom).emit('video-seek', {
              ...data,
              triggeredBy: socket.user.username,
              timestamp: new Date()
            });
          });
      }
    });

    // Handle chat messages
    socket.on('chat-message', async (data) => {
      try {
        if (!socket.currentRoom) {
          socket.emit('error', { message: 'Not in a room' });
          return;
        }

        const { message } = data;
        
        if (!message || message.trim().length === 0) {
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }

        // Store chat message in database
        const { data: chatMessage, error: chatError } = await supabaseAdmin
          .from('chat_messages')
          .insert({
            room_id: socket.currentRoom,
            user_id: socket.userId,
            message: message.trim()
          })
          .select(`
            *,
            user:profiles!chat_messages_user_id_fkey(username, avatar)
          `)
          .single();

        if (chatError) {
          socket.emit('error', { message: 'Error saving chat message' });
          return;
        }

        const chatResponse = {
          id: chatMessage.id,
          message: chatMessage.message,
          user: {
            id: chatMessage.user.id || socket.userId,
            username: chatMessage.user.username || socket.user.username,
            avatar: chatMessage.user.avatar || socket.user.avatar
          },
          timestamp: chatMessage.created_at,
          roomId: socket.currentRoom
        };

        // Broadcast to all users in the room (including sender)
        io.to(socket.currentRoom).emit('chat-message', chatResponse);

        console.log(`Chat message in room ${socket.currentRoom} from ${socket.user.username}`);

      } catch (error) {
        console.error('Chat message error:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    // Handle typing indicators
    socket.on('typing-start', () => {
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit('user-typing', {
          userId: socket.userId,
          username: socket.user.username,
          isTyping: true
        });
      }
    });

    socket.on('typing-stop', () => {
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit('user-typing', {
          userId: socket.userId,
          username: socket.user.username,
          isTyping: false
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.username} disconnected (${socket.id})`);
      
      // Remove from active connections
      activeConnections.delete(socket.userId);

      // Remove from room connections
      if (socket.currentRoom && roomConnections.has(socket.currentRoom)) {
        roomConnections.get(socket.currentRoom).delete(socket.userId);
        
        // Notify others in room
        socket.to(socket.currentRoom).emit('user-left', {
          user: {
            id: socket.user.id,
            username: socket.user.username,
            avatar: socket.user.avatar
          },
          timestamp: new Date()
        });

        // Clean up empty room connections
        if (roomConnections.get(socket.currentRoom).size === 0) {
          roomConnections.delete(socket.currentRoom);
        }
      }

      // Update user offline status
      await supabaseAdmin
        .from('profiles')
        .update({ 
          is_online: false,
          last_seen: new Date().toISOString()
        })
        .eq('id', socket.userId);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.user.username}:`, error);
    });
  });
};

module.exports = handleConnection;