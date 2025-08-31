-- Supabase Database Schema for Meme Video App

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{"notifications": true, "dark_mode": false}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  current_video JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{"is_private": false, "allow_chatting": true, "allow_memes": true, "max_participants": 50}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Room participants table
CREATE TABLE IF NOT EXISTS room_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(room_id, user_id)
);

-- Memes table
CREATE TABLE IF NOT EXISTS memes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_type TEXT CHECK (file_type IN ('image', 'video', 'gif')) NOT NULL,
  file_size INTEGER NOT NULL,
  tags TEXT[] DEFAULT '{}',
  views INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  moderation_status TEXT CHECK (moderation_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meme likes table
CREATE TABLE IF NOT EXISTS meme_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meme_id UUID REFERENCES memes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  liked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meme_id, user_id)
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meme_id UUID REFERENCES memes(id) ON DELETE CASCADE NOT NULL,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meme_id, reviewer_id)
);

-- Review helpful marks table
CREATE TABLE IF NOT EXISTS review_helpful (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  is_helpful BOOLEAN NOT NULL,
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_rooms_host_id ON rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_rooms_is_active ON rooms(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_memes_creator_id ON memes(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memes_room_id ON memes(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memes_tags ON memes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_memes_public_approved ON memes(is_public, moderation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meme_likes_meme_id ON meme_likes(meme_id);
CREATE INDEX IF NOT EXISTS idx_meme_likes_user_id ON meme_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_meme_id ON reviews(meme_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews(reviewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_helpful_review_id ON review_helpful(review_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE memes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meme_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_helpful ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Rooms policies
CREATE POLICY "Anyone can view active public rooms" ON rooms FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users can create rooms" ON rooms FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Room hosts can update their rooms" ON rooms FOR UPDATE USING (auth.uid() = host_id);

-- Room participants policies
CREATE POLICY "Anyone can view room participants" ON room_participants FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join rooms" ON room_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own participation" ON room_participants FOR UPDATE USING (auth.uid() = user_id);

-- Memes policies
CREATE POLICY "Anyone can view public approved memes" ON memes FOR SELECT USING (is_public = true AND moderation_status = 'approved');
CREATE POLICY "Authenticated users can create memes" ON memes FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update their own memes" ON memes FOR UPDATE USING (auth.uid() = creator_id);

-- Meme likes policies
CREATE POLICY "Anyone can view meme likes" ON meme_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like memes" ON meme_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own likes" ON meme_likes FOR DELETE USING (auth.uid() = user_id);

-- Reviews policies
CREATE POLICY "Anyone can view public reviews" ON reviews FOR SELECT USING (is_public = true);
CREATE POLICY "Authenticated users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Reviewers can update their own reviews" ON reviews FOR UPDATE USING (auth.uid() = reviewer_id);

-- Review helpful policies
CREATE POLICY "Anyone can view helpful marks" ON review_helpful FOR SELECT USING (true);
CREATE POLICY "Authenticated users can mark reviews as helpful" ON review_helpful FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own helpful marks" ON review_helpful FOR UPDATE USING (auth.uid() = user_id);

-- Chat messages policies
CREATE POLICY "Room participants can view chat messages" ON chat_messages 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_participants 
      WHERE room_id = chat_messages.room_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );
CREATE POLICY "Authenticated users can send chat messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_memes_updated_at BEFORE UPDATE ON memes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for memes (run this in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('memes', 'memes', true);

-- Storage policies (run this in Supabase dashboard)
-- CREATE POLICY "Anyone can view meme files" ON storage.objects FOR SELECT USING (bucket_id = 'memes');
-- CREATE POLICY "Authenticated users can upload meme files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'memes' AND auth.role() = 'authenticated');
-- CREATE POLICY "Users can delete their own meme files" ON storage.objects FOR DELETE USING (bucket_id = 'memes' AND auth.uid()::text = (storage.foldername(name))[1]);