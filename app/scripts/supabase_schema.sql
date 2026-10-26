-- =====================================================================
-- Agar.sol (NomNom) Supabase Database Schema
-- Optional: Run this in your Supabase SQL Editor if you want persistent
-- global high scores, player statistics, and match history.
-- =====================================================================

-- 1. Global High Scores & Leaderboard
CREATE TABLE IF NOT EXISTS public.leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name VARCHAR(32) NOT NULL,
    wallet_address VARCHAR(64),
    peak_mass BIGINT NOT NULL DEFAULT 0,
    kills INTEGER NOT NULL DEFAULT 0,
    sol_won NUMERIC(12, 6) DEFAULT 0,
    skin_id VARCHAR(32) DEFAULT 'solana',
    room_id VARCHAR(64) DEFAULT 'global',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Performance index for instant top leaderboard queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_peak_mass ON public.leaderboard (peak_mass DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_kills ON public.leaderboard (kills DESC);

-- 3. Game Match Sessions (Cash out & undelegation audit logs)
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(64) NOT NULL,
    deposit_sol NUMERIC(12, 6) NOT NULL DEFAULT 0,
    payout_sol NUMERIC(12, 6) NOT NULL DEFAULT 0,
    final_mass BIGINT NOT NULL DEFAULT 0,
    kills INTEGER NOT NULL DEFAULT 0,
    survival_seconds INTEGER DEFAULT 0,
    extracted BOOLEAN DEFAULT FALSE,
    tx_signature VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

-- 5. Public Read Policy (Anyone can see leaderboard)
CREATE POLICY "Public read leaderboard" 
ON public.leaderboard FOR SELECT 
TO public USING (true);

-- 6. Insert policy for authenticated or anon players
CREATE POLICY "Public insert leaderboard" 
ON public.leaderboard FOR INSERT 
TO public WITH CHECK (true);

-- 7. Public read game sessions
CREATE POLICY "Public read game_sessions" 
ON public.game_sessions FOR SELECT 
TO public USING (true);

CREATE POLICY "Public insert game_sessions" 
ON public.game_sessions FOR INSERT 
TO public WITH CHECK (true);

-- 8. Enable Realtime Broadcast for Multiplayer
-- Note: Realtime Broadcast channels (room_*) work out of the box on all new Supabase projects!
