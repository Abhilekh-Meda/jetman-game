import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  return { data, error };
}

export async function getLeaderboard(limit: number = 100) {
  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, elo, wins, losses, games_played')
    .gte('games_played', 10)
    .order('elo', { ascending: false })
    .limit(limit);

  return { data, error };
}

export async function getUserRank(userElo: number) {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .gt('elo', userElo)
    .gte('games_played', 10);

  if (error) return { rank: null, error };
  return { rank: (count || 0) + 1, error: null };
}
