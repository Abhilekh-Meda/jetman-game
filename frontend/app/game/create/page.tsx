'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CreateGamePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameLink, setGameLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createGame = async () => {
      try {
        // Get auth token
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.push('/');
          return;
        }

        // Call backend to create game
        const response = await fetch(`${process.env.NEXT_PUBLIC_GAME_SERVER_URL}/api/game/create`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${data.session.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to create game');
        }

        const result = await response.json();
        setGameId(result.gameId);
        setGameLink(result.link);
        setLoading(false);
      } catch (err) {
        console.error('Error creating game:', err);
        setError('Failed to create game. Please try again.');
        setLoading(false);
      }
    };

    createGame();
  }, [router]);

  const handleCopyLink = () => {
    if (gameLink) {
      navigator.clipboard.writeText(gameLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartGame = () => {
    if (gameId) {
      router.push(`/game/${gameId}`);
    }
  };

  const handleBackToLobby = () => {
    router.push('/lobby');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">JETMAN</h1>
          <p className="text-white text-2xl">Creating your private game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold text-white mb-4">JETMAN</h1>
          <p className="text-red-500 text-2xl mb-8">{error}</p>
          <button
            onClick={handleBackToLobby}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-2xl w-full">
        <h1 className="text-5xl font-bold mb-12 text-white tracking-widest">JETMAN</h1>

        <div className="bg-slate-800 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Private Game Ready!</h2>

          <div className="mb-8">
            <p className="text-gray-400 mb-3">Share this link with your opponent:</p>
            <div className="bg-slate-900 rounded p-4 mb-4">
              <p className="text-white text-sm break-all font-mono">{gameLink}</p>
            </div>
            <button
              onClick={handleCopyLink}
              className={`w-full py-2 px-4 rounded font-bold transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-white'
              }`}
            >
              {copied ? '✓ Copied to clipboard' : 'Copy Link'}
            </button>
          </div>

          <p className="text-gray-400 text-sm mb-6">
            Game ID: <span className="text-white font-mono">{gameId}</span>
          </p>

          <div className="space-y-3">
            <button
              onClick={handleStartGame}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 px-6 rounded-lg transition-all"
            >
              🎮 WAIT FOR OPPONENT IN GAME
            </button>

            <button
              onClick={handleBackToLobby}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              ← Back to Lobby
            </button>
          </div>
        </div>

        <p className="text-gray-500 text-sm">
          Once your opponent joins using the link, the game will automatically start with a 3-second countdown
        </p>
      </div>
    </div>
  );
}
