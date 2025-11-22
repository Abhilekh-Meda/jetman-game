'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LeaderboardEntry } from '@/lib/types';

export default function LeaderboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();

        if (!session.session) {
          router.push('/');
          return;
        }

        // Get top 100 players
        const { data: topPlayers, error: topError } = await supabase
          .from('users')
          .select('id, display_name, elo, wins, losses, games_played')
          .gte('games_played', 10)
          .order('elo', { ascending: false })
          .limit(100);

        if (topError) {
          setError('Failed to load leaderboard');
          setLoading(false);
          return;
        }

        // Get current user's rank
        const { count, error: rankError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gt('elo', (topPlayers && topPlayers.length > 0 ? topPlayers[0].elo : 0))
          .gte('games_played', 10);

        // Get current user profile
        const { data: currentUser } = await supabase
          .from('users')
          .select('elo')
          .eq('id', session.session.user.id)
          .single();

        // Calculate entries with ranks
        const leaderboardEntries: LeaderboardEntry[] = (topPlayers || []).map((player, index) => ({
          rank: index + 1,
          id: player.id,
          display_name: player.display_name,
          elo: player.elo,
          wins: player.wins,
          losses: player.losses,
          games_played: player.games_played,
        }));

        setEntries(leaderboardEntries);

        // Set current user rank
        if (currentUser && leaderboardEntries.length > 0) {
          const userEntry = leaderboardEntries.find((e) => e.id === session.session.user.id);
          if (userEntry) {
            setCurrentUserRank(userEntry.rank);
          } else if (currentUser.elo < leaderboardEntries[leaderboardEntries.length - 1].elo) {
            setCurrentUserRank(100 + (count || 0));
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Leaderboard error:', err);
        setError('Failed to load leaderboard');
        setLoading(false);
      }
    };

    loadLeaderboard();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white text-2xl">Loading leaderboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 text-2xl mb-4">{error}</p>
          <button
            onClick={() => router.push('/lobby')}
            className="text-white underline hover:text-gray-300"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2 tracking-widest">🏆 LEADERBOARD 🏆</h1>
          <p className="text-gray-400">Top 100 Players by ELO Rating</p>
        </div>

        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 font-bold text-gray-400 bg-slate-900 border-b border-slate-700">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">Player</div>
            <div className="col-span-2">ELO</div>
            <div className="col-span-2">W/L</div>
            <div className="col-span-3">Games</div>
          </div>

          <div className="divide-y divide-slate-700">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors ${
                  currentUserRank === entry.rank
                    ? 'bg-yellow-500 bg-opacity-20 border-l-4 border-yellow-500'
                    : index % 2 === 0
                      ? 'bg-slate-800'
                      : 'bg-slate-750'
                }`}
              >
                <div className="col-span-1 font-bold text-white">#{entry.rank}</div>
                <div className="col-span-4 text-white truncate">{entry.display_name}</div>
                <div className="col-span-2 text-lg font-bold text-white">{entry.elo}</div>
                <div className="col-span-2 text-gray-400">
                  {entry.wins}/{entry.losses}
                </div>
                <div className="col-span-3 text-gray-400">{entry.games_played}</div>
              </div>
            ))}
          </div>
        </div>

        {currentUserRank && currentUserRank > 100 && (
          <div className="mt-8 text-center">
            <p className="text-gray-400 mb-4">Your Rank: #{currentUserRank}</p>
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/lobby')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            BACK TO LOBBY
          </button>
        </div>
      </div>
    </div>
  );
}
