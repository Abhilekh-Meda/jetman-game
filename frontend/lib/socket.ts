import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function initializeSocket(token: string): Socket {
  const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'http://localhost:3001';

  socket = io(serverUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Connected to game server, authenticating...');
    // Emit authenticate event with token
    socket!.emit('authenticate', { token });
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected from game server:', reason);
  });

  return socket;
}

export function getSocket(): Socket {
  if (!socket) {
    throw new Error('Socket not initialized. Call initializeSocket first.');
  }
  return socket;
}

export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Matchmaking events
export function joinQueue(userId: string, elo: number) {
  getSocket().emit('join_queue', { userId, elo });
}

export function leaveQueue() {
  getSocket().emit('leave_queue');
}

// Game session events
export function joinGameSession(gameId: string, userId: string) {
  getSocket().emit('join_game_session', { gameId, userId });
}

export function sendGameInput(gameId: string, inputId: number, keys: Record<string, boolean>) {
  getSocket().emit('game_input', { gameId, inputId, keys });
}

// Event listeners
export function onMatchFound(callback: (data: any) => void) {
  getSocket().on('match_found', callback);
}

export function onGameStarted(callback: (data: any) => void) {
  getSocket().on('game_started', callback);
}

export function onGameState(callback: (data: any) => void) {
  getSocket().on('game_state', callback);
}

export function onRoundEnd(callback: (data: any) => void) {
  getSocket().on('round_end', callback);
}

export function onMatchEnd(callback: (data: any) => void) {
  getSocket().on('match_end', callback);
}

export function onOpponentDisconnected(callback: (data: any) => void) {
  getSocket().on('opponent_disconnected', callback);
}

export function onOpponentReconnected(callback: () => void) {
  getSocket().on('opponent_reconnected', callback);
}

export function onGameCancelled(callback: (data: any) => void) {
  getSocket().on('game_cancelled', callback);
}

// Cleanup
export function offMatchFound(callback: (data: any) => void) {
  getSocket().off('match_found', callback);
}

export function offGameState(callback: (data: any) => void) {
  getSocket().off('game_state', callback);
}

export function offRoundEnd(callback: (data: any) => void) {
  getSocket().off('round_end', callback);
}

export function offMatchEnd(callback: (data: any) => void) {
  getSocket().off('match_end', callback);
}

export function offOpponentDisconnected(callback: (data: any) => void) {
  getSocket().off('opponent_disconnected', callback);
}

export function offOpponentReconnected(callback: () => void) {
  getSocket().off('opponent_reconnected', callback);
}

export function offGameCancelled(callback: (data: any) => void) {
  getSocket().off('game_cancelled', callback);
}
