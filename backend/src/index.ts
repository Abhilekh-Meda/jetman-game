import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { ServerGameEngine } from './gameEngine';

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
const gameSessions = new Map<string, {
  id: string;
  playerRed: string;
  playerBlue: string;
  playerRedSocket: string;
  playerBlueSocket: string;
  engine: ServerGameEngine;
  status: 'countdown' | 'in_progress' | 'finished';
  countdownStartedAt: number;
  disconnectedPlayer: string | null;
  disconnectTimer: NodeJS.Timeout | null;
}>();

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeGames: gameSessions.size,
    queuedPlayers: queuedPlayers.size,
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { userId, email, displayName, avatarUrl } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (existingUser) {
      // User already exists, just return success
      return res.json({ success: true, isNew: false });
    }

    // Create new user
    const { error } = await supabase.from('users').insert([
      {
        id: userId,
        email,
        display_name: displayName || email.split('@')[0] || 'Player',
        avatar_url: avatarUrl || null,
        elo: 1000,
        games_played: 0,
        wins: 0,
        losses: 0,
      },
    ]);

    if (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }

    res.json({ success: true, isNew: true });
  } catch (error) {
    console.error('Error in auth/register:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/game/create', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify JWT token
    const { data: authData, error } = await supabase.auth.getUser(token);
    if (error || !authData.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (!userProfile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create game session (waiting for opponent)
    const gameId = generateGameId();
    const engine = new ServerGameEngine(gameId, authData.user.id, '', 1920, 1080);

    const gameSession = {
      id: gameId,
      playerRed: authData.user.id,
      playerBlue: '',
      playerRedSocket: '',
      playerBlueSocket: '',
      engine,
      status: 'countdown' as const,
      countdownStartedAt: Date.now(),
      disconnectedPlayer: null,
      disconnectTimer: null,
    };

    gameSessions.set(gameId, gameSession);

    res.json({
      gameId,
      link: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/game/${gameId}?invite=${authData.user.id}`,
    });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    // Get top players by ELO with at least 10 games played
    const { data: players, error } = await supabase
      .from('users')
      .select('id, display_name, elo, wins, losses, games_played')
      .gte('games_played', 10)
      .order('elo', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }

    const leaderboard = (players || []).map((player, index) => ({
      rank: index + 1,
      id: player.id,
      display_name: player.display_name,
      elo: player.elo,
      wins: player.wins,
      losses: player.losses,
      games_played: player.games_played,
      winRate: player.games_played > 0 ? (player.wins / player.games_played * 100).toFixed(1) : 0,
    }));

    res.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    const { data: user, error } = await supabase
      .from('users')
      .select('id, display_name, elo, wins, losses, games_played, avatar_url, created_at, last_played_at')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const winRate = user.games_played > 0 ? (user.wins / user.games_played * 100).toFixed(1) : 0;

    res.json({
      ...user,
      winRate,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.get('/api/users/:userId/matches', async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const { data: matches, error } = await supabase
      .from('matches')
      .select(
        'id, game_session_id, player_red_id, player_blue_id, winner_id, ' +
        'player_red_elo_before, player_blue_elo_before, player_red_elo_after, player_blue_elo_after, ' +
        'final_score_red, final_score_blue, duration_seconds, played_at'
      )
      .or(`player_red_id.eq.${userId},player_blue_id.eq.${userId}`)
      .order('played_at', { ascending: false })
      .limit(limit);

    if (error || !matches) {
      return res.status(500).json({ error: 'Failed to fetch matches' });
    }

    const matchHistory = matches.map((match: any) => ({
      ...match,
      isWin: match.winner_id === userId,
      opponentId: match.player_red_id === userId ? match.player_blue_id : match.player_red_id,
      userColor: match.player_red_id === userId ? 'red' : 'blue',
      eloChange: match.player_red_id === userId
        ? match.player_red_elo_after - match.player_red_elo_before
        : match.player_blue_elo_after - match.player_blue_elo_before,
      userScore: match.player_red_id === userId ? match.final_score_red : match.final_score_blue,
      opponentScore: match.player_red_id === userId ? match.final_score_blue : match.final_score_red,
    }));

    res.json({ matches: matchHistory });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
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
      gameSession.status = 'countdown';
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

    // Determine player color
    const color = userId === gameSession.playerRed ? 'red' : 'blue';
    if (color === 'red' && userId !== gameSession.playerRed) return;
    if (color === 'blue' && userId !== gameSession.playerBlue) return;

    // Add input to game engine
    gameSession.engine.addInput(color, {
      id: data.inputId,
      keys: {
        ArrowUp: data.keys.ArrowUp || false,
        ArrowLeft: data.keys.ArrowLeft || false,
        ArrowRight: data.keys.ArrowRight || false,
      },
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
        if (gameSession && gameSession.status !== 'finished') {
          gameSession.disconnectedPlayer = userId;

          // Clear previous timer if exists
          if (gameSession.disconnectTimer) {
            clearTimeout(gameSession.disconnectTimer);
          }

          // Set 30-second reconnection window
          gameSession.disconnectTimer = setTimeout(() => {
            // Auto-forfeit after 30 seconds of disconnection
            if (gameSession.disconnectedPlayer === userId) {
              const winnerId = userId === gameSession.playerRed ? gameSession.playerBlue : gameSession.playerRed;
              updatePlayerELO(gameSession, winnerId, userId);

              io.to(gameId).emit('opponent_forfeited', {
                winnerId,
                reason: 'disconnection_timeout',
              });

              gameSessions.delete(gameId);
              console.log(`Game ${gameId} forfeited: ${userId} disconnected for too long`);
            }
          }, 30000);

          // Notify opponent of disconnection
          io.to(gameId).emit('opponent_disconnected', {
            disconnectedPlayerId: userId,
            reconnectWindowSeconds: 30,
          });

          console.log(`Player ${userId} disconnected from game ${gameId}`);
        }
      }

      console.log(`Player ${userId} disconnected`);
    }
  });

  // Handle reconnection
  socket.on('reconnect_game', (data: { gameId: string; userId: string }) => {
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

    // Check if this player was disconnected
    if (gameSession.disconnectedPlayer === userId) {
      // Clear the disconnect timer
      if (gameSession.disconnectTimer) {
        clearTimeout(gameSession.disconnectTimer);
        gameSession.disconnectTimer = null;
      }

      gameSession.disconnectedPlayer = null;
      socket.join(data.gameId);

      // Update active players mapping
      activePlayers.set(userId, data.gameId);

      // Notify both players that the game continues
      io.to(data.gameId).emit('opponent_reconnected', {
        reconnectedPlayerId: userId,
        gameState: gameSession.engine.getState(),
      });

      console.log(`Player ${userId} reconnected to game ${data.gameId}`);
    } else {
      socket.emit('error', { message: 'You are not disconnected from this game' });
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
        const engine = new ServerGameEngine(gameId, player1.id, player2.id, 1920, 1080);

        const game = {
          id: gameId,
          playerRed: player1.id,
          playerBlue: player2.id,
          playerRedSocket: player1.socketId,
          playerBlueSocket: player2.socketId,
          engine,
          status: 'countdown' as const,
          countdownStartedAt: Date.now(),
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

// Game loop (30 TPS)
setInterval(() => {
  const now = Date.now();

  for (const [gameId, gameSession] of gameSessions.entries()) {
    // Handle countdown phase
    if (gameSession.status === 'countdown') {
      const countdownElapsed = now - gameSession.countdownStartedAt;
      const countdownSeconds = 3 - Math.floor(countdownElapsed / 1000);

      if (countdownSeconds <= 0) {
        // Start game
        gameSession.status = 'in_progress';
        gameSession.engine.start();
        io.to(gameId).emit('game_started', {
          gameId,
          initialState: gameSession.engine.getState(),
        });
        console.log(`Game ${gameId} started`);
      } else {
        // Send countdown tick
        io.to(gameId).emit('game_countdown', { countdown: countdownSeconds });
      }
    }

    // Handle in-progress game
    if (gameSession.status === 'in_progress') {
      // Tick the game engine
      gameSession.engine.tick_();

      // Check if game is over
      if (gameSession.engine.isGameOver()) {
        const winner = gameSession.engine.getWinner();
        gameSession.status = 'finished';

        const winnerId = winner === 'red' ? gameSession.playerRed : gameSession.playerBlue;
        const loserId = winner === 'red' ? gameSession.playerBlue : gameSession.playerRed;

        // Update ELO for both players
        updatePlayerELO(gameSession, winnerId, loserId);

        io.to(gameId).emit('match_end', {
          gameId,
          winnerId,
          loserId,
          finalScores: gameSession.engine.scores,
          duration: Math.floor((now - gameSession.countdownStartedAt) / 1000),
        });

        console.log(`Game ${gameId} ended. Winner: ${winner}`);

        // Clean up game session after a delay
        setTimeout(() => gameSessions.delete(gameId), 5000);
      }

      // Broadcast game state (30 Hz)
      const state = gameSession.engine.getState();
      const lastProcessedInputs = gameSession.engine.getLastProcessedInputIds();

      io.to(gameId).emit('game_state', {
        tick: state.tick,
        players: state.players,
        scores: state.scores,
        lastProcessedInputs,
      });
    }
  }
}, 1000 / 30); // 30 ticks per second

// Helper functions
function generateGameId(): string {
  return 'g_' + Math.random().toString(36).substr(2, 8);
}

function calculateELO(playerELO: number, opponentELO: number, won: boolean): number {
  const K = 32; // Standard K-factor
  const expectedScore = 1 / (1 + Math.pow(10, (opponentELO - playerELO) / 400));
  const actualScore = won ? 1 : 0;
  const eloChange = K * (actualScore - expectedScore);
  return Math.round(playerELO + eloChange);
}

async function updatePlayerELO(gameSession: any, winnerId: string, loserId: string) {
  try {
    // Get current ELO for both players
    const { data: winnerData } = await supabase
      .from('users')
      .select('elo, games_played, wins')
      .eq('id', winnerId)
      .single();

    const { data: loserData } = await supabase
      .from('users')
      .select('elo, games_played, losses')
      .eq('id', loserId)
      .single();

    if (!winnerData || !loserData) return;

    const winnerELOBefore = winnerData.elo;
    const loserELOBefore = loserData.elo;

    // Calculate new ELO
    const newWinnerELO = calculateELO(winnerELOBefore, loserELOBefore, true);
    const newLoserELO = calculateELO(loserELOBefore, winnerELOBefore, false);

    // Get final scores from game engine
    const finalScores = gameSession.engine.scores;

    // Update ELO and stats in database
    await Promise.all([
      supabase
        .from('users')
        .update({
          elo: newWinnerELO,
          games_played: (winnerData.games_played || 0) + 1,
          wins: (winnerData.wins || 0) + 1,
          last_played_at: new Date().toISOString(),
        })
        .eq('id', winnerId),
      supabase
        .from('users')
        .update({
          elo: newLoserELO,
          games_played: (loserData.games_played || 0) + 1,
          losses: (loserData.losses || 0) + 1,
          last_played_at: new Date().toISOString(),
        })
        .eq('id', loserId),
      // Record match in matches table
      supabase
        .from('matches')
        .insert({
          game_session_id: gameSession.id,
          player_red_id: gameSession.playerRed,
          player_blue_id: gameSession.playerBlue,
          winner_id: winnerId,
          player_red_elo_before: gameSession.playerRed === winnerId ? winnerELOBefore : loserELOBefore,
          player_blue_elo_before: gameSession.playerBlue === winnerId ? winnerELOBefore : loserELOBefore,
          player_red_elo_after: gameSession.playerRed === winnerId ? newWinnerELO : newLoserELO,
          player_blue_elo_after: gameSession.playerBlue === winnerId ? newWinnerELO : newLoserELO,
          final_score_red: finalScores.red,
          final_score_blue: finalScores.blue,
          match_type: 'ranked',
          duration_seconds: Math.floor((Date.now() - gameSession.countdownStartedAt) / 1000),
        }),
    ]);

    console.log(`Match recorded: ${winnerId} (${winnerELOBefore} -> ${newWinnerELO}), ${loserId} (${loserELOBefore} -> ${newLoserELO})`);
  } catch (error) {
    console.error('Error updating ELO:', error);
  }
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
