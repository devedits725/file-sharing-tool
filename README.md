# DropRoom — Room-Based File Sharing

Upload a file → get a 6-character room code → anyone with the code can download it.

---

## 🚀 Supabase Setup

This project uses Supabase for storage and database. Follow these steps to set it up:

### 1. Create a Supabase Project
Go to [Supabase](https://supabase.com/) and create a new project.

### 2. Create the `rooms` Table
In the Supabase SQL Editor, run the following SQL:

```sql
create table rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  file_name text not null,
  file_path text not null,
  file_size int8 not null,
  mime_type text,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  download_count int4 default 0,
  is_active bool default true
);

-- Create an index on room_code for faster lookups
create index idx_rooms_room_code on rooms(room_code);
```

### 3. Create the `rooms` Storage Bucket
1. Go to **Storage** in the Supabase dashboard.
2. Create a new bucket called `rooms`.
3. Set the bucket to **Public** (or configure appropriate RLS policies for authenticated access if preferred).
   - *Note: For this app to work simply, ensure the bucket is public or has "Select" and "Insert" policies enabled for anonymous users.*

### 4. Configure Environment Variables
Create a `.env` file in the root directory (use `.env.example` as a template):

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. Add Env Variables on Vercel
If deploying to Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the project settings under **Environment Variables**.

---

## 🖥️ Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will be live at: http://localhost:5173

---

## Features

- 📤 Drag & drop or click-to-upload
- 🏠 Auto-generated 6-char room codes (e.g. XK92PL)
- 📥 Join any room by entering the code
- ⏰ Rooms expire automatically after 24 hours
- 📊 Download count tracking
- 🔗 Shareable link with ?room= query param
- 🗑 Host can delete the room at any time
