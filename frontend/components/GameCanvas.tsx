'use client';

import { useEffect, useRef, useState } from 'react';
import { Player } from '@/lib/types';

interface GameCanvasProps {
  players: {
    red: Player;
    blue: Player;
  };
  scores: {
    red: number;
    blue: number;
  };
  isGameRunning: boolean;
  onInput?: (input: { thrust: boolean; rotateLeft: boolean; rotateRight: boolean }) => void;
}

const PHYSICS = {
  GRAVITY: 0.18,
  THRUST_POWER: 0.45,
  ROTATION_ACCEL: 0.008,
  ANGULAR_DRAG: 0.95,
  DRAG: 0.99,
  BOUNCE: 0.4,
  PLAYER_WIDTH: 30,
  PLAYER_HEIGHT: 60,
  PLAYER_RADIUS: 28,
  PLAYER_MASS: 2,
  COLLISION_FORCE: 1.3,
} as const;

const GAME_CONFIG = {
  PLATFORM_WIDTH: 120,
  PLATFORM_HEIGHT: 20,
  PLATFORM_Y_RATIO: 0.6,
} as const;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  size: number;
}

export default function GameCanvas({ players, scores, isGameRunning, onInput }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const particlesRef = useRef<Particle[]>([]);
  const animationIdRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Input handling
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Game loop
    const gameLoop = () => {
      // Render background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw platforms
      drawPlatforms(ctx, canvas.width, canvas.height);

      // Draw particles
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        p.size *= 0.95;

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw players
      drawPlayer(ctx, players.red, 'red');
      drawPlayer(ctx, players.blue, 'blue');

      // Draw HUD
      drawHUD(ctx, canvas, scores);

      animationIdRef.current = requestAnimationFrame(gameLoop);
    };

    // Send input to game engine
    const inputLoop = setInterval(() => {
      if (onInput) {
        onInput({
          thrust: keysRef.current['ArrowUp'] || keysRef.current['KeyW'] || false,
          rotateLeft: keysRef.current['ArrowLeft'] || keysRef.current['KeyA'] || false,
          rotateRight: keysRef.current['ArrowRight'] || keysRef.current['KeyD'] || false,
        });
      }
    }, 16); // ~60fps input reporting

    gameLoop();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(inputLoop);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [onInput]);

  return (
    <canvas
      ref={canvasRef}
      className="block w-screen h-screen bg-slate-900"
      style={{ display: 'block' }}
    />
  );
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, type: 'red' | 'blue') {
  if (player.dead) return;

  const color = type === 'red' ? '#ff4d4d' : '#4d79ff';
  const { PLAYER_RADIUS, PLAYER_WIDTH, PLAYER_HEIGHT } = PHYSICS;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  // Draw player body
  ctx.fillStyle = color;
  ctx.fillRect(-PLAYER_WIDTH / 2, -PLAYER_HEIGHT / 2, PLAYER_WIDTH, PLAYER_HEIGHT);

  // Draw player outline
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-PLAYER_WIDTH / 2, -PLAYER_HEIGHT / 2, PLAYER_WIDTH, PLAYER_HEIGHT);

  // Draw cockpit
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(0, -PLAYER_HEIGHT / 4, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlatforms(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const { PLATFORM_WIDTH, PLATFORM_HEIGHT, PLATFORM_Y_RATIO } = GAME_CONFIG;
  const platformY = height * PLATFORM_Y_RATIO;

  // Left platform
  const leftX = 50;
  ctx.fillStyle = '#666';
  ctx.fillRect(leftX, platformY, PLATFORM_WIDTH, PLATFORM_HEIGHT);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.strokeRect(leftX, platformY, PLATFORM_WIDTH, PLATFORM_HEIGHT);

  // Right platform
  const rightX = width - 50 - PLATFORM_WIDTH;
  ctx.fillStyle = '#666';
  ctx.fillRect(rightX, platformY, PLATFORM_WIDTH, PLATFORM_HEIGHT);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.strokeRect(rightX, platformY, PLATFORM_WIDTH, PLATFORM_HEIGHT);
}

function drawHUD(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, scores: { red: number; blue: number }) {
  // Score text
  ctx.fillStyle = '#ff4d4d';
  ctx.font = 'bold 2rem "Courier New"';
  ctx.textAlign = 'left';
  ctx.fillText(`RED: ${scores.red}`, 40, 40);

  ctx.fillStyle = '#4d79ff';
  ctx.font = 'bold 2rem "Courier New"';
  ctx.textAlign = 'right';
  ctx.fillText(`BLUE: ${scores.blue}`, canvas.width - 40, 40);

  // Progress bar background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(canvas.width / 2 - 200, 60, 400, 30);

  // Progress bar fill
  const maxScore = 10;
  const redFill = (scores.red / maxScore) * 400;
  ctx.fillStyle = '#ff4d4d';
  ctx.fillRect(canvas.width / 2 - 200, 60, redFill, 30);

  const blueFill = (scores.blue / maxScore) * 400;
  ctx.fillStyle = '#4d79ff';
  ctx.fillRect(canvas.width / 2 - 200 + 400 - blueFill, 60, blueFill, 30);

  // Border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(canvas.width / 2 - 200, 60, 400, 30);

  // Center text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 1rem "Courier New"';
  ctx.textAlign = 'center';
  ctx.fillText('FIRST TO 10', canvas.width / 2, 82);
}
