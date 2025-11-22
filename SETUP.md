# Jetman - Setup & Development Guide

## Project Structure

```
jetman-game/
├── frontend/              # Next.js 14 App Router
│   ├── app/             # Pages and routes
│   ├── components/      # React components (GameCanvas.tsx)
│   ├── lib/             # Utilities (supabase, socket, types)
│   └── package.json
│
├── backend/              # Node.js + Express + Socket.io
│   ├── src/
│   │   └── index.ts    # Main server with Socket.io handlers
│   ├── tsconfig.json
│   └── package.json
│
├── shared/               # Shared code between frontend and backend
│   ├── types.ts        # TypeScript interfaces
│   └── physics.ts      # Physics constants and functions
│
└── SETUP.md            # This file
```

## Prerequisites

- **Node.js 20+** (installed via nvm or direct download)
- **Supabase Project** (free tier available at supabase.com)
- **Google OAuth Application** (from Google Cloud Console)

## Step 1: Supabase Setup

### Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note down your `SUPABASE_URL` and `SUPABASE_ANON_KEY`

### Enable Google OAuth
1. In Supabase Dashboard → Authentication → Providers
2. Enable "Google" provider
3. Add Google OAuth credentials from Google Cloud Console
4. Set Redirect URLs:
   - `http://localhost:3000/auth/callback` (development)
   - `https://jetman.app/auth/callback` (production)

### Create Database Tables

Run this SQL in Supabase SQL Editor:

```sql
-- Users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  elo INTEGER DEFAULT 1000 NOT NULL,
  games_played INTEGER DEFAULT 0 NOT NULL,
  wins INTEGER DEFAULT 0 NOT NULL,
  losses INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_played_at TIMESTAMP WITH TIME ZONE
);

-- Matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_session_id TEXT NOT NULL,
  player_red_id UUID NOT NULL REFERENCES public.users(id),
  player_blue_id UUID NOT NULL REFERENCES public.users(id),
  winner_id UUID NOT NULL REFERENCES public.users(id),
  player_red_elo_before INTEGER NOT NULL,
  player_blue_elo_before INTEGER NOT NULL,
  player_red_elo_after INTEGER NOT NULL,
  player_blue_elo_after INTEGER NOT NULL,
  final_score_red INTEGER NOT NULL,
  final_score_blue INTEGER NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'ranked',
  forfeit BOOLEAN DEFAULT FALSE,
  duration_seconds INTEGER,
  played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_users_elo ON public.users(elo DESC);
CREATE INDEX idx_users_games ON public.users(games_played DESC);
CREATE INDEX idx_matches_player_red ON public.matches(player_red_id);
CREATE INDEX idx_matches_player_blue ON public.matches(player_blue_id);

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view user profiles
CREATE POLICY "Anyone can view user profiles"
  ON public.users FOR SELECT
  USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Allow anyone to view matches
CREATE POLICY "Anyone can view matches"
  ON public.matches FOR SELECT
  USING (true);
```

## Step 2: Frontend Setup

### Create Environment File

```bash
cd frontend
cp .env.local.example .env.local
```

Edit `.env.local` and add:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_GAME_SERVER_URL=http://localhost:3001
```

### Install & Run

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:3000

## Step 3: Backend Setup

### Create Environment File

```bash
cd backend
cp .env.example .env
```

Edit `.env` and add:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Install & Run

```bash
cd backend
npm install
npm run build
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

Backend runs at http://localhost:3001

## Development Workflow

### Running Both Services

In separate terminal windows:

**Terminal 1: Frontend**
```bash
cd frontend
source ~/.nvm/nvm.sh && nvm use 24.11.0
npm run dev
```

**Terminal 2: Backend**
```bash
cd backend
source ~/.nvm/nvm.sh && nvm use 24.11.0
npm run dev
```

### Testing

1. Open http://localhost:3000 in your browser
2. Click "Sign In with Google"
3. Complete the OAuth flow
4. You should be redirected to /lobby
5. Your profile should appear (auto-created on first login)

## Current Features Implemented

✅ **Phase 1-2:** Project setup, authentication, landing page
✅ **Phase 4:** Socket.io server with matchmaking queue
✅ **Phase 8:** Basic lobby with user stats
✅ **Phase 14:** Environment configuration

## Next Steps to Complete

1. **Phase 5:** Complete matchmaking implementation
   - Refine socket event handling
   - Add player-to-game assignment
   - Implement countdown

2. **Phase 3-4:** Game engine
   - Implement server-side physics (30 TPS)
   - Implement client-side prediction and reconciliation
   - State synchronization

3. **Phase 6-7:** Game flow
   - Private game creation
   - Game countdown UI
   - Round system with score tracking
   - Match end and results screen

4. **Phase 9-10:** Ranking system
   - Leaderboard view
   - ELO calculations
   - Match result recording

5. **Phase 11:** Disconnection handling
6. **Phase 12:** Database schema optimization
7. **Phase 13:** REST API endpoints
8. **Phase 15-16:** Testing and deployment

## Troubleshooting

### Port Already in Use
If port 3000 or 3001 is already in use:
```bash
# Find process on port 3001
lsof -i :3001
# Kill it
kill -9 <PID>
```

### Supabase Connection Error
- Check that your `SUPABASE_URL` and keys are correct
- Verify the project is running
- Check network connectivity

### Socket.io Connection Error
- Ensure backend is running on :3001
- Check `NEXT_PUBLIC_GAME_SERVER_URL` matches backend URL
- Check browser console for error messages

## Key Resources

- [Next.js 14 Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Socket.io Docs](https://socket.io/docs/v4/)
- [Express.js Docs](https://expressjs.com/)

## Notes

- Physics engine is shared between client and server in `/shared/physics.ts`
- All Socket.io event handlers are in `backend/src/index.ts`
- Frontend components use Tailwind CSS
- TypeScript is used throughout for type safety
