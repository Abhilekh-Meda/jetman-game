'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/lib/types';

export default function Lobby() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push('/');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.session.user.id)
        .single();

      if (profile) {
        setUser(profile);
      }
      setLoading(false);
    };

    loadUser();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleGetMatched = () => {
    // TODO: Implement matchmaking
    router.push('/game/match');
  };

  const handleCreatePrivateGame = () => {
    // TODO: Implement private game creation
    router.push('/game/create');
  };

  const handleViewLeaderboard = () => {
    router.push('/leaderboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-2xl">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl w-full">
        <h1 className="text-5xl font-bold mb-12 text-white tracking-widest">JETMAN</h1>

        {user && (
          <div className="mb-12">
            <p className="text-xl text-gray-300 mb-2">👤 Welcome, {user.display_name}</p>
            <p className="text-lg text-gray-400 mb-1">ELO: {user.elo} 🏆</p>
            <p className="text-gray-400">W: {user.wins}  |  L: {user.losses}  |  Games: {user.games_played}</p>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGetMatched}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all duration-200"
          >
            🎮 GET MATCHED
          </button>

          <button
            onClick={handleCreatePrivateGame}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all duration-200"
          >
            🔗 CREATE PRIVATE GAME
          </button>

          <button
            onClick={handleViewLeaderboard}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all duration-200"
          >
            📊 VIEW LEADERBOARD
          </button>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-8 text-gray-400 hover:text-gray-300 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
