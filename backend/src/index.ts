import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Initialize Express and Socket.io
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// Types
interface AuthenticatedSocket {
  userId?: string;
  displayName?: string;
  elo?: number;
}

interface Player {
  id: string;
  displayName: string;
  elo: number;
  socketId: string;
  queuedAt: number;
}

// State
const playerSockets = new Map<string, string>(); // userId -> socketId
const queuedPlayers = new Map<string, Player>(); // userId -> Player
const activePlayers = new Map<string, string>(); // userId -> gameId
const gameSessions = new Map<string, any>();

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeGames: gameSessions.size,
    queuedPlayers: queuedPlayers.size,
  });
});

// Socket.io handlers
io.on('connection', (socket: any) => {
  console.log('Client connected:', socket.id);

  socket.on('authenticate', async (data: { token: string }) => {
    try {
      // Verify JWT token with Supabase
      const { data: authData, error } = await supabase.auth.getUser(data.token);

      if (error || !authData.user) {
        socket.emit('auth_error', { message: 'Invalid token' });
        return;
      }

      // Get user profile
      const { data: userProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (!userProfile) {
        socket.emit('auth_error', { message: 'User profile not found' });
        return;
      }

      // Store socket info
      (socket as AuthenticatedSocket).userId = authData.user.id;
      (socket as AuthenticatedSocket).displayName = userProfile.display_name;
      (socket as AuthenticatedSocket).elo = userProfile.elo;

      playerSockets.set(authData.user.id, socket.id);

      socket.emit('authenticated', {
        userId: authData.user.id,
        displayName: userProfile.display_name,
        elo: userProfile.elo,
      });

      console.log(`Authenticated: ${userProfile.display_name} (${authData.user.id})`);
    } catch (error) {
      console.error('Auth error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  });

  // Matchmaking
  socket.on('join_queue', (data: { userId: string; elo: number }) => {
    const userId = (socket as AuthenticatedSocket).userId;
    if (!userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const player: Player = {
      id: userId,
      displayName: (socket as AuthenticatedSocket).displayName || 'Unknown',
      elo: (socket as AuthenticatedSocket).elo || 1000,
      socketId: socket.id,
      queuedAt: Date.now(),
    };

    queuedPlayers.set(userId, player);
    console.log(`${player.displayName} joined queue. Queue size: ${queuedPlayers.size}`);
  });

  socket.on('leave_queue', () => {
    const userId = (socket as AuthenticatedSocket).userId;
    if (userId) {
      queuedPlayers.delete(userId);
      console.log(`Player ${userId} left queue`);
    }
  });

  // Game session
  socket.on('join_game_session', (data: { gameId: string; userId: string }) => {
    const userId = (socket as AuthenticatedSocket).userId;
    if (!userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const gameSession = gameSessions.get(data.gameId);
    if (!gameSession) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }

    // Add player to game
    if (!gameSession.playerBlue) {
      gameSession.playerBlue = userId;
      gameSession.status = 'ready';
    }

    socket.join(data.gameId);
    activePlayers.set(userId, data.gameId);

    // Notify both players
    io.to(data.gameId).emit('game_ready', {
      gameId: data.gameId,
      players: {
        red: gameSession.playerRed,
        blue: gameSession.playerBlue,
      },
    });

    console.log(`Player ${userId} joined game ${data.gameId}`);
  });

  // Game input
  socket.on('game_input', (data: { gameId: string; inputId: number; keys: Record<string, boolean> }) => {
    const userId = (socket as AuthenticatedSocket).userId;
    if (!userId) return;

    const gameSession = gameSessions.get(data.gameId);
    if (!gameSession) return;

    // Process input (will be handled by game engine)
    if (!gameSession.inputBuffer) gameSession.inputBuffer = {};
    if (!gameSession.inputBuffer[userId]) gameSession.inputBuffer[userId] = [];
    gameSession.inputBuffer[userId].push({
      id: data.inputId,
      keys: data.keys,
      timestamp: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    const userId = (socket as AuthenticatedSocket).userId;
    if (userId) {
      playerSockets.delete(userId);
      queuedPlayers.delete(userId);

      const gameId = activePlayers.get(userId);
      if (gameId) {
        const gameSession = gameSessions.get(gameId);
        if (gameSession) {
          gameSession.disconnectedPlayer = userId;
          gameSession.disconnectTimer = setTimeout(() => {
            // Auto-forfeit after 15 seconds
            const winnerId = userId === gameSession.playerRed ? gameSession.playerBlue : gameSession.playerRed;
            endMatch(gameId, winnerId, userId, true);
          }, 15000);

          io.to(gameId).emit('opponent_disconnected', { reconnectWindowSeconds: 15 });
        }
        activePlayers.delete(userId);
      }

      console.log(`Player ${userId} disconnected`);
    }
  });
});

// Matchmaking loop
setInterval(() => {
  const players = Array.from(queuedPlayers.values());
  if (players.length < 2) return;

  // Try to match players
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const player1 = players[i];
      const player2 = players[j];

      const waitTime = Date.now() - Math.max(player1.queuedAt, player2.queuedAt);
      let eloRange = 50;
      if (waitTime > 10000) eloRange = 100;
      if (waitTime > 30000) eloRange = 200;
      if (waitTime > 60000) eloRange = 999;

      if (Math.abs(player1.elo - player2.elo) <= eloRange) {
        // Match found!
        const gameId = generateGameId();
        const game = {
          id: gameId,
          playerRed: player1.id,
          playerBlue: player2.id,
          status: 'in_progress',
          startTime: Date.now(),
          scores: { red: 0, blue: 0 },
          inputBuffer: {},
          tick: 0,
          disconnectedPlayer: null,
          disconnectTimer: null,
        };

        gameSessions.set(gameId, game);
        queuedPlayers.delete(player1.id);
        queuedPlayers.delete(player2.id);

        // Notify both players
        io.to(player1.socketId).emit('match_found', {
          gameId,
          opponent: {
            id: player2.id,
            displayName: player2.displayName,
            elo: player2.elo,
          },
          yourColor: 'red',
          countdownStartsIn: 3,
        });

        io.to(player2.socketId).emit('match_found', {
          gameId,
          opponent: {
            id: player1.id,
            displayName: player1.displayName,
            elo: player1.elo,
          },
          yourColor: 'blue',
          countdownStartsIn: 3,
        });

        console.log(`Match found: ${player1.displayName} vs ${player2.displayName}`);
        break;
      }
    }
  }
}, 2000);

// Helper functions
function generateGameId(): string {
  return 'g_' + Math.random().toString(36).substr(2, 8);
}

function endMatch(gameId: string, winnerId: string, loserId: string, forfeit: boolean) {
  const gameSession = gameSessions.get(gameId);
  if (!gameSession) return;

  io.to(gameId).emit('match_end', {
    winnerId,
    loserId,
    forfeit,
  });

  gameSessions.delete(gameId);
}

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
