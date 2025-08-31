
-- Messages Table
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  content text,
  image_url text,
  created_at timestamp default now()
);

-- Posts Table
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  title text,
  image_url text,
  created_at timestamp default now()
);

-- Enable Realtime
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table posts;
