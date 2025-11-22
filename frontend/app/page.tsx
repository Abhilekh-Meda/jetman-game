'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push('/lobby');
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/lobby');
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [router]);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error('Sign in error:', error);
        alert('Failed to sign in. Please try again.');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-6xl font-bold mb-6 text-white tracking-widest">JETMAN</h1>

        <p className="text-2xl text-gray-300 mb-12 leading-relaxed">
          Competitive 2-Player Jetpack Combat
        </p>

        <p className="text-lg text-gray-400 mb-16">
          Knock your opponent into the walls and climb the global leaderboard.<br />
          Test your skills in fast-paced, physics-based aerial duels.
        </p>

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-4 px-12 rounded-lg text-xl transition-colors duration-200 mb-8"
        >
          {loading ? 'Signing in...' : 'Sign In with Google'}
        </button>

        <div className="mt-12 text-gray-500 text-sm">
          <p>Arrow Keys or WASD to move and rotate</p>
          <p className="mt-2">Challenge friends or climb the ranked ladder</p>
        </div>
      </div>
    </div>
  );
}
