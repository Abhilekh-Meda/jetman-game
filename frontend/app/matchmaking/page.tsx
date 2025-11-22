'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { initializeSocket, getSocket, joinQueue, leaveQueue, onMatchFound, offMatchFound } from '@/lib/socket';

export default function MatchmakingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const elo = parseInt(searchParams.get('elo') || '1000');

  const [waitTime, setWaitTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startMatchmaking = async () => {
      try {
        // Get current user
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.push('/');
          return;
        }

        // Initialize socket if not already done
        let socket = null;
        try {
          socket = getSocket();
        } catch {
          socket = initializeSocket(data.session.access_token);
        }

        // Wait for authentication
        await new Promise((resolve) => {
          socket.once('authenticated', resolve);
        });

        // Listen for match found
        onMatchFound((data: any) => {
          // Redirect to game page
          router.push(`/game/${data.gameId}`);
        });

        // Join queue
        joinQueue(userId || data.session.user.id, elo);
        setLoading(false);

        return () => {
          offMatchFound(() => {});
        };
      } catch (err) {
        console.error('Matchmaking error:', err);
        setError('Failed to start matchmaking');
        setLoading(false);
      }
    };

    startMatchmaking();
  }, [router, userId, elo]);

  // Update wait time
  useEffect(() => {
    if (loading) return;

    const timer = setInterval(() => {
      setWaitTime((t) => t + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [loading]);

  const handleCancel = () => {
    leaveQueue();
    router.push('/lobby');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-2xl">Initializing matchmaking...</p>
        </div>
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold mb-12 text-white tracking-widest">JETMAN</h1>

        <div className="mb-8">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-2xl text-gray-300 mb-4">FINDING OPPONENT...</p>
          <div className="w-8 h-8 border-4 border-gray-400 border-t-red-600 rounded-full animate-spin mx-auto"></div>
        </div>

        <div className="bg-slate-800 rounded-lg p-8 mb-8">
          <p className="text-gray-400 mb-4">Searching for players near</p>
          <p className="text-3xl font-bold text-white mb-4">ELO {elo}</p>
          <p className="text-gray-400">±{waitTime > 60000 ? '∞' : waitTime > 30000 ? '200' : waitTime > 10000 ? '100' : '50'}</p>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-gray-400">Time in queue</p>
            <p className="text-4xl font-bold text-white">{formatTime(waitTime)}</p>
          </div>
        </div>

        <button
          onClick={handleCancel}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
        >
          CANCEL MATCHMAKING
        </button>

        <div className="mt-8 text-gray-500 text-sm">
          <p>The ELO range expands over time to find you a match faster</p>
        </div>
      </div>
    </div>
  );
}
