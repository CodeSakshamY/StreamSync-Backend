# Meme Video Backend API with Supabase

A comprehensive Node.js backend for a real-time video streaming and meme sharing application, powered by Supabase for database, authentication, and storage.

## Features

- **Authentication**: Supabase Auth with JWT tokens
- **Real-time Communication**: WebSocket support for video sync and chat
- **File Management**: Supabase Storage for video and image uploads
- **Database**: Supabase PostgreSQL with Row Level Security
- **API Endpoints**: RESTful APIs for all core functionality
- **Security**: CORS enabled, RLS policies, secure file uploads

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project
- NPM or Yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your Supabase configuration:
   - Set your Supabase URL
   - Set your Supabase anon key
   - Set your Supabase service role key
   - Configure frontend URL for CORS

4. Set up the database schema:
   - Copy the contents of `database/schema.sql`
   - Run it in your Supabase SQL editor
   - Create the storage bucket for memes in Supabase dashboard

5. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## Database Setup

Run the SQL schema in your Supabase project:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `database/schema.sql`
4. Execute the query

### Storage Setup

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called `memes`
3. Make it public
4. Set up the storage policies as shown in the schema file

## API Endpoints

### Authentication
- `POST /auth/signup` - User registration (creates Supabase auth user + profile)
- `POST /auth/login` - User login (returns Supabase session token)
- `POST /auth/logout` - User logout (protected)
- `GET /auth/profile` - Get user profile (protected)

### Rooms
- `POST /rooms/create` - Create a new room (protected)
- `POST /rooms/:roomId/join` - Join a room (protected)
- `POST /rooms/:roomId/leave` - Leave a room (protected)
- `GET /rooms` - List all rooms (protected)
- `GET /rooms/:roomId` - Get room details (protected)

### Memes
- `POST /memes/add` - Add a new meme (protected, with file upload)
- `GET /memes/list` - List memes (public, optional auth)
- `GET /memes/:memeId` - Get meme details (public, optional auth)
- `POST /memes/:memeId/like` - Like/unlike a meme (protected)

### Reviews
- `POST /reviews/add` - Add a review (protected)
- `GET /reviews/list` - List reviews (public, optional auth)
- `POST /reviews/:reviewId/helpful` - Mark review as helpful (protected)

### File Upload
- `POST /upload/file` - Upload file to Supabase Storage (protected)
- `DELETE /upload/file/:filename` - Delete file from Supabase Storage (protected)

## WebSocket Events

### Client to Server
- `join-room` - Join a specific room
- `video-play` - Trigger video play for all participants
- `video-pause` - Trigger video pause for all participants
- `video-seek` - Sync video seek position
- `chat-message` - Send chat message to room
- `typing-start` - Indicate user is typing
- `typing-stop` - Indicate user stopped typing

### Server to Client
- `user-joined` - User joined the room
- `user-left` - User left the room
- `video-play` - Video play event
- `video-pause` - Video pause event
- `video-seek` - Video seek event
- `chat-message` - New chat message
- `user-typing` - User typing indicator
- `room-state` - Current room state
- `error` - Error message

## Supabase Integration

### Authentication
- Uses Supabase Auth for user management
- JWT tokens for API authentication
- Automatic user profile creation on signup

### Database
- PostgreSQL with Row Level Security (RLS)
- Real-time subscriptions for live updates
- Optimized queries with proper indexing

### Storage
- Supabase Storage for file uploads
- Public bucket for meme files
- Automatic URL generation for uploaded files

### Real-time Features
- Supabase Realtime for live chat updates
- WebSocket integration for video synchronization
- Live user presence tracking

## File Upload

Supports image and video uploads with the following formats:
- Images: JPEG, PNG, GIF, WebP
- Videos: MP4, WebM, OGG
- Maximum file size: 100MB

Files are uploaded directly to Supabase Storage and served via CDN.

## Environment Variables

See `.env.example` for all required environment variables.

## Development

The server includes automatic restart with nodemon in development mode:

```bash
npm run dev
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use your production Supabase project
3. Configure proper CORS origins
4. Set up Supabase Storage policies
5. Enable RLS on all tables

## Security Features

- Supabase Auth with JWT tokens
- Row Level Security (RLS) on all tables
- Input validation and sanitization
- CORS protection
- File type validation for uploads
- Secure file storage with Supabase Storage

## Supabase Configuration

Make sure to:
1. Enable Row Level Security on all tables
2. Set up the storage bucket with proper policies
3. Configure authentication settings in Supabase dashboard
4. Set up real-time subscriptions if needed