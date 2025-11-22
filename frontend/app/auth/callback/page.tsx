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
          // Register user with backend (ensures user table entry with service role)
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_GAME_SERVER_URL}/api/auth/register`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: data.session.user.id,
                email: data.session.user.email,
                displayName: data.session.user.user_metadata?.full_name ||
                            data.session.user.email?.split('@')[0] ||
                            'Player',
                avatarUrl: data.session.user.user_metadata?.avatar_url,
              }),
            });

            if (!response.ok) {
              console.error('Failed to register user with backend');
            }
          } catch (error) {
            console.error('Error calling register endpoint:', error);
            // Continue anyway - user auth succeeded
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
