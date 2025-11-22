'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase will handle the callback automatically
        // Just redirect to the lobby if authenticated
        const { data } = await supabase.auth.getSession();

        if (data.session) {
          // Create user profile if first login
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.session.user.id)
            .single();

          if (!profile) {
            // First login - create profile
            const { error } = await supabase.from('users').insert([
              {
                id: data.session.user.id,
                email: data.session.user.email,
                display_name: data.session.user.user_metadata?.full_name ||
                             data.session.user.email?.split('@')[0] ||
                             'Player',
                avatar_url: data.session.user.user_metadata?.avatar_url,
                elo: 1000,
                games_played: 0,
                wins: 0,
                losses: 0,
              },
            ]);

            if (error && error.code !== 'PGRST116') {
              // PGRST116 is duplicate key error, which means it already exists
              console.error('Error creating profile:', error);
            }
          }

          router.push('/lobby');
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        router.push('/');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">JETMAN</h1>
        <p className="text-gray-300">Authenticating...</p>
      </div>
    </div>
  );
}
