'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { initializeSocket, getSocket, sendGameInput, onGameState, onMatchEnd, offGameState, offMatchEnd } from '@/lib/socket';
import GameCanvas from '@/components/GameCanvas';
import { ClientGameEngine } from '@/lib/gameEngine';
import { GameState } from '@/lib/types';

type GamePhase = 'loading' | 'countdown' | 'playing' | 'finished';

export default function GamePage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.id as string;

  const [phase, setPhase] = useState<GamePhase>('loading');
  const [countdown, setCountdown] = useState(3);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<any>(null);

  const engineRef = useRef<ClientGameEngine | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const inputSequenceRef = useRef(0);

  useEffect(() => {
    const initGame = async () => {
      try {
        // Get current user
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.push('/');
          return;
        }

        // Get user profile for color
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        // Initialize socket if not already done
        let socket = null;
        try {
          socket = getSocket();
        } catch {
          socket = initializeSocket(data.session.access_token);
        }

        // Join game session
        socket.emit('join_game_session', {
          gameId,
          userId: data.session.user.id,
        });

        // Listen for match_found to get color assignment
        socket.once('match_found', (data: any) => {
          // Initialize game engine
          engineRef.current = new ClientGameEngine(
            gameId,
            data.yourColor,
            window.innerWidth,
            window.innerHeight
          );
          setPhase('countdown');
        });

        // Listen for game countdown
        socket.on('game_countdown', (data: any) => {
          setCountdown(data.countdown);
        });

        // Listen for game start
        socket.on('game_started', (data: any) => {
          setPhase('playing');
          setCountdown(0);
        });

        // Listen for game state
        onGameState((state: any) => {
          if (engineRef.current) {
            engineRef.current.reconcile(state, state.lastProcessedInputs[engineRef.current.color]);
            setGameState(engineRef.current.getState());
          }
        });

        // Listen for match end
        onMatchEnd((result: any) => {
          setPhase('finished');
          setMatchResult(result);
        });

        return () => {
          offGameState(() => {});
          offMatchEnd(() => {});
        };
      } catch (err) {
        console.error('Game init error:', err);
        setError('Failed to initialize game');
      }
    };

    initGame();
  }, [gameId, router]);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game input loop
  useEffect(() => {
    if (phase !== 'playing' || !engineRef.current) return;

    const socket = getSocket();
    const inputInterval = setInterval(() => {
      if (engineRef.current) {
        const input = engineRef.current.handleInput(keysRef.current);
        socket.emit('game_input', {
          gameId,
          inputId: input.id,
          keys: input.keys,
        });
      }
    }, 16); // ~60 FPS

    return () => clearInterval(inputInterval);
  }, [phase, gameId]);

  const handleReturnToLobby = () => {
    router.push('/lobby');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-2xl mb-4">{error}</p>
          <button onClick={handleReturnToLobby} className="text-white underline">
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'countdown' || phase === 'playing') {
    return (
      <div className="relative w-screen h-screen">
        {gameState && (
          <GameCanvas
            players={gameState.players}
            scores={gameState.scores}
            isGameRunning={phase === 'playing'}
          />
        )}

        {phase === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-center text-white">
              <h2 className="text-6xl font-bold mb-4">{countdown > 0 ? countdown : 'GO!'}</h2>
              <p className="text-2xl">GET READY!</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'finished' && matchResult) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold text-white mb-4">MATCH COMPLETE</h1>

          <div className="bg-slate-800 rounded-lg p-8 mb-8">
            <p className="text-2xl font-bold text-white mb-4">
              {matchResult.winnerId ? '🏆 GAME OVER 🏆' : 'Draw'}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-red-500">
                <p className="text-lg font-bold">RED</p>
                <p className="text-3xl font-bold">{matchResult.finalScores.red}</p>
              </div>
              <div className="text-blue-500">
                <p className="text-lg font-bold">BLUE</p>
                <p className="text-3xl font-bold">{matchResult.finalScores.blue}</p>
              </div>
            </div>

            <p className="text-gray-400 mb-4">Duration: {matchResult.duration} seconds</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleReturnToLobby}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              RETURN TO LOBBY
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">JETMAN</h1>
        <p className="text-gray-300">Loading game...</p>
      </div>
    </div>
  );
}
