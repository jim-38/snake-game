import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Trophy, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Play, 
  Pause, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  Monitor,
  Flame,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { sound } from './sound.ts';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};
type Difficulty = 'easy' | 'normal' | 'fast';

const GRID_SIZE = 20; // 20 x 20 grid
const SPEEDS: Record<Difficulty, number> = {
  easy: 125,
  normal: 90,
  fast: 60,
};

export default function App() {
  // Game states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [applesEaten, setApplesEaten] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [wrapWalls, setWrapWalls] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [scanlines, setScanlines] = useState<boolean>(true);
  const [newHighScoreReached, setNewHighScoreReached] = useState<boolean>(false);

  // Canvas ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Snake mutable state held in refs for 60fps / tight loop accuracy
  const snakeRef = useRef<Position[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const foodRef = useRef<Position>({ x: 15, y: 10 });
  const goldenFoodRef = useRef<{ pos: Position; timer: number; maxTimer: number } | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastTickRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const tongueTimerRef = useRef<number>(0);

  // Load High Score and Sound Settings from localStorage
  useEffect(() => {
    const savedHighScore = localStorage.getItem('snake_highscore');
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore, 10) || 0);
    }
    const savedSound = localStorage.getItem('snake_sound');
    if (savedSound !== null) {
      const isMuted = savedSound === 'false';
      setSoundEnabled(!isMuted);
      sound.enabled = !isMuted;
    }
  }, []);

  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    sound.enabled = nextVal;
    localStorage.setItem('snake_sound', String(nextVal));
  };

  // Helper to generate food at empty spot
  const generateFood = useCallback((): Position => {
    const snake = snakeRef.current;
    let newFood: Position;
    let collision: boolean;
    let attempts = 0;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // Check collision with snake
      collision = snake.some(seg => seg.x === newFood.x && seg.y === newFood.y);
      // Check collision with golden food if exists
      if (goldenFoodRef.current && goldenFoodRef.current.pos.x === newFood.x && goldenFoodRef.current.pos.y === newFood.y) {
        collision = true;
      }
      attempts++;
    } while (collision && attempts < 200);

    return newFood;
  }, []);

  // Spawn particle explosion
  const spawnParticles = (x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 1.2 + Math.random() * 2.8;
      particlesRef.current.push({
        x: x + 0.5,
        y: y + 0.5,
        vx: Math.cos(angle) * speed * 0.08,
        vy: Math.sin(angle) * speed * 0.08,
        life: 1,
        maxLife: 20 + Math.random() * 15,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  };

  // Start new game
  const startGame = () => {
    sound.playStart();
    snakeRef.current = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    foodRef.current = generateFood();
    goldenFoodRef.current = null;
    particlesRef.current = [];
    setScore(0);
    setApplesEaten(0);
    setIsGameOver(false);
    setIsPaused(false);
    setIsPlaying(true);
    setNewHighScoreReached(false);
    lastTickRef.current = performance.now();
  };

  // Pause toggle
  const togglePause = () => {
    if (!isPlaying || isGameOver) return;
    setIsPaused(prev => !prev);
  };

  // Handle direction change safely
  const changeDirection = useCallback((newDir: Direction) => {
    const current = directionRef.current;
    if (newDir === 'UP' && current === 'DOWN') return;
    if (newDir === 'DOWN' && current === 'UP') return;
    if (newDir === 'LEFT' && current === 'RIGHT') return;
    if (newDir === 'RIGHT' && current === 'LEFT') return;

    if (nextDirectionRef.current !== newDir) {
      sound.playMove();
      nextDirectionRef.current = newDir;
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling when playing with arrow keys or space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (!isPlaying && (e.key === ' ' || e.key === 'Enter')) {
        startGame();
        return;
      }

      if (isGameOver && (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'r')) {
        startGame();
        return;
      }

      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        togglePause();
        return;
      }

      if (e.key.toLowerCase() === 'r') {
        startGame();
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          changeDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          changeDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          changeDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          changeDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isGameOver, isPaused, changeDirection]);

  // Touch Swipe on Canvas
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!isPlaying || isGameOver) {
      if (absX < 10 && absY < 10) {
        startGame();
      }
      return;
    }

    if (Math.max(absX, absY) > 20) {
      if (absX > absY) {
        changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        changeDirection(dy > 0 ? 'DOWN' : 'UP');
      }
    }
    touchStartRef.current = null;
  };

  // Game step logic (runs at speed interval)
  const gameTick = useCallback(() => {
    const snake = [...snakeRef.current];
    const head = { ...snake[0] };
    const currentDir = nextDirectionRef.current;
    directionRef.current = currentDir;

    // Next position
    switch (currentDir) {
      case 'UP':
        head.y -= 1;
        break;
      case 'DOWN':
        head.y += 1;
        break;
      case 'LEFT':
        head.x -= 1;
        break;
      case 'RIGHT':
        head.x += 1;
        break;
    }

    // Check Wall Collisions or Wrap
    if (wrapWalls) {
      if (head.x < 0) head.x = GRID_SIZE - 1;
      if (head.x >= GRID_SIZE) head.x = 0;
      if (head.y < 0) head.y = GRID_SIZE - 1;
      if (head.y >= GRID_SIZE) head.y = 0;
    } else {
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        handleGameOver();
        return;
      }
    }

    // Check Self Collision
    // Head colliding with any existing segment
    for (let i = 0; i < snake.length; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        handleGameOver();
        return;
      }
    }

    // Insert new head
    snake.unshift(head);

    // Check Food Collision
    const food = foodRef.current;
    let eatenRegular = false;
    let eatenGolden = false;

    if (head.x === food.x && head.y === food.y) {
      eatenRegular = true;
      sound.playEat();
      spawnParticles(head.x, head.y, '#ef4444', 16);
      foodRef.current = generateFood();
      setApplesEaten(prev => prev + 1);

      // Random chance to spawn Golden Apple (15% chance, if not already active)
      if (!goldenFoodRef.current && Math.random() < 0.25) {
        goldenFoodRef.current = {
          pos: generateFood(),
          timer: 60, // 60 ticks ~ 6 seconds
          maxTimer: 60,
        };
      }
    }

    // Check Golden Food Collision
    if (goldenFoodRef.current && head.x === goldenFoodRef.current.pos.x && head.y === goldenFoodRef.current.pos.y) {
      eatenGolden = true;
      sound.playGoldenEat();
      spawnParticles(head.x, head.y, '#eab308', 24);
      goldenFoodRef.current = null;
    }

    // Tick down golden food timer
    if (goldenFoodRef.current && !eatenGolden) {
      goldenFoodRef.current.timer -= 1;
      if (goldenFoodRef.current.timer <= 0) {
        goldenFoodRef.current = null;
      }
    }

    if (eatenRegular || eatenGolden) {
      // Calculate score increment
      const pointsGained = eatenGolden ? 50 : 10;
      setScore(prev => {
        const newScore = prev + pointsGained;
        if (newScore > highScore) {
          setHighScore(newScore);
          setNewHighScoreReached(true);
          localStorage.setItem('snake_highscore', String(newScore));
        }
        return newScore;
      });
      // Snake grows (do NOT pop tail)
    } else {
      // Snake moves normally, remove tail
      snake.pop();
    }

    snakeRef.current = snake;
  }, [wrapWalls, highScore, generateFood]);

  const handleGameOver = () => {
    sound.playGameOver();
    setIsGameOver(true);
    setIsPlaying(false);
  };

  // Rendering loop on HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;

    const render = (time: number) => {
      if (!isMounted) return;

      // Handle Game Tick speed
      if (isPlaying && !isPaused && !isGameOver) {
        const baseSpeed = SPEEDS[difficulty];
        // Slight dynamic speed ramp: 1ms faster for each 20 points, capped at 40ms
        const dynamicSpeed = Math.max(38, baseSpeed - Math.floor(score / 20) * 2);

        if (time - lastTickRef.current >= dynamicSpeed) {
          gameTick();
          lastTickRef.current = time;
        }
      }

      // Canvas dimensions
      const width = canvas.width;
      const height = canvas.height;
      const cellSize = width / GRID_SIZE;

      // Clear Screen
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle grid cells
      ctx.lineWidth = 1;
      for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
          const isEven = (x + y) % 2 === 0;
          ctx.fillStyle = isEven ? '#0a0f1d' : '#070b15';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }
      }

      // Draw grid borders
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath();
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.moveTo(i * cellSize, 0);
        ctx.lineTo(i * cellSize, height);
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(width, i * cellSize);
      }
      ctx.stroke();

      // Outer border highlight based on wall mode
      ctx.lineWidth = 3;
      ctx.strokeStyle = wrapWalls ? '#3b82f644' : '#ef444444';
      ctx.strokeRect(1.5, 1.5, width - 3, height - 3);

      // Draw Particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;
        p.size *= 0.96;

        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x * cellSize, p.y * cellSize, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        if (p.life >= p.maxLife || p.size < 0.2) {
          particles.splice(i, 1);
        }
      }

      // Draw Regular Food (Apple)
      const food = foodRef.current;
      const foodCenterX = food.x * cellSize + cellSize / 2;
      const foodCenterY = food.y * cellSize + cellSize / 2;
      const foodRadius = cellSize * 0.42;

      // Glow behind apple
      const foodGlow = ctx.createRadialGradient(
        foodCenterX, foodCenterY, 2,
        foodCenterX, foodCenterY, foodRadius * 1.8
      );
      foodGlow.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
      foodGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = foodGlow;
      ctx.fillRect(food.x * cellSize - cellSize / 2, food.y * cellSize - cellSize / 2, cellSize * 2, cellSize * 2);

      // Apple Body
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(foodCenterX, foodCenterY + 1, foodRadius, 0, Math.PI * 2);
      ctx.fill();

      // Apple Highlight
      ctx.fillStyle = '#fca5a5';
      ctx.beginPath();
      ctx.arc(foodCenterX - foodRadius * 0.35, foodCenterY - foodRadius * 0.3, foodRadius * 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Apple Stem & Leaf
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(foodCenterX, foodCenterY - foodRadius);
      ctx.quadraticCurveTo(foodCenterX + 2, foodCenterY - foodRadius - 4, foodCenterX + 3, foodCenterY - foodRadius - 5);
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(foodCenterX + 4, foodCenterY - foodRadius - 3, 3, 1.8, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw Golden Food if active
      if (goldenFoodRef.current) {
        const gf = goldenFoodRef.current;
        const gCenterX = gf.pos.x * cellSize + cellSize / 2;
        const gCenterY = gf.pos.y * cellSize + cellSize / 2;
        const gRadius = cellSize * 0.45;

        // Pulsing glow
        const pulse = 1 + 0.15 * Math.sin(time / 100);
        const gGlow = ctx.createRadialGradient(
          gCenterX, gCenterY, 2,
          gCenterX, gCenterY, gRadius * 2.2 * pulse
        );
        gGlow.addColorStop(0, 'rgba(234, 179, 8, 0.7)');
        gGlow.addColorStop(1, 'rgba(234, 179, 8, 0)');
        ctx.fillStyle = gGlow;
        ctx.fillRect(gf.pos.x * cellSize - cellSize, gf.pos.y * cellSize - cellSize, cellSize * 3, cellSize * 3);

        // Golden Star / Orb Body
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(gCenterX, gCenterY, gRadius, 0, Math.PI * 2);
        ctx.fill();

        // Inner Shine
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(gCenterX - gRadius * 0.3, gCenterY - gRadius * 0.3, gRadius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Bonus timer circular gauge
        const timerFraction = gf.timer / gf.maxTimer;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(gCenterX, gCenterY, gRadius + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * timerFraction);
        ctx.stroke();
      }

      // Draw Snake
      const snake = snakeRef.current;
      const currentDir = directionRef.current;

      // Draw snake segments from tail to head
      for (let i = snake.length - 1; i >= 0; i--) {
        const seg = snake[i];
        const isHead = i === 0;
        const segX = seg.x * cellSize;
        const segY = seg.y * cellSize;

        if (isHead) {
          // Snake Head with direction awareness
          const headCenterX = segX + cellSize / 2;
          const headCenterY = segY + cellSize / 2;
          const headRadius = cellSize * 0.48;

          // Head glow
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(headCenterX, headCenterY, headRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0; // reset

          // Cute Eyes positioning based on direction
          let eye1 = { x: 0, y: 0 };
          let eye2 = { x: 0, y: 0 };
          let pupilOffset = { x: 0, y: 0 };
          const eyeDist = cellSize * 0.2;
          const eyeForward = cellSize * 0.16;

          switch (currentDir) {
            case 'UP':
              eye1 = { x: headCenterX - eyeDist, y: headCenterY - eyeForward };
              eye2 = { x: headCenterX + eyeDist, y: headCenterY - eyeForward };
              pupilOffset = { x: 0, y: -1.5 };
              break;
            case 'DOWN':
              eye1 = { x: headCenterX - eyeDist, y: headCenterY + eyeForward };
              eye2 = { x: headCenterX + eyeDist, y: headCenterY + eyeForward };
              pupilOffset = { x: 0, y: 1.5 };
              break;
            case 'LEFT':
              eye1 = { x: headCenterX - eyeForward, y: headCenterY - eyeDist };
              eye2 = { x: headCenterX - eyeForward, y: headCenterY + eyeDist };
              pupilOffset = { x: -1.5, y: 0 };
              break;
            case 'RIGHT':
              eye1 = { x: headCenterX + eyeForward, y: headCenterY - eyeDist };
              eye2 = { x: headCenterX + eyeForward, y: headCenterY + eyeDist };
              pupilOffset = { x: 1.5, y: 0 };
              break;
          }

          // Eye Whites
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(eye1.x, eye1.y, cellSize * 0.13, 0, Math.PI * 2);
          ctx.arc(eye2.x, eye2.y, cellSize * 0.13, 0, Math.PI * 2);
          ctx.fill();

          // Pupils
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(eye1.x + pupilOffset.x, eye1.y + pupilOffset.y, cellSize * 0.07, 0, Math.PI * 2);
          ctx.arc(eye2.x + pupilOffset.x, eye2.y + pupilOffset.y, cellSize * 0.07, 0, Math.PI * 2);
          ctx.fill();

          // Cute flickering tongue
          tongueTimerRef.current += 1;
          if (tongueTimerRef.current % 30 < 15 && isPlaying && !isPaused) {
            ctx.strokeStyle = '#f43f5e';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            let startT = { x: headCenterX, y: headCenterY };
            let tipT = { x: headCenterX, y: headCenterY };
            const tLen = cellSize * 0.45;

            if (currentDir === 'UP') {
              startT = { x: headCenterX, y: headCenterY - headRadius };
              tipT = { x: headCenterX, y: startT.y - tLen };
              ctx.moveTo(startT.x, startT.y);
              ctx.lineTo(tipT.x, tipT.y);
              ctx.lineTo(tipT.x - 2, tipT.y - 3);
              ctx.moveTo(tipT.x, tipT.y);
              ctx.lineTo(tipT.x + 2, tipT.y - 3);
            } else if (currentDir === 'DOWN') {
              startT = { x: headCenterX, y: headCenterY + headRadius };
              tipT = { x: headCenterX, y: startT.y + tLen };
              ctx.moveTo(startT.x, startT.y);
              ctx.lineTo(tipT.x, tipT.y);
              ctx.lineTo(tipT.x - 2, tipT.y + 3);
              ctx.moveTo(tipT.x, tipT.y);
              ctx.lineTo(tipT.x + 2, tipT.y + 3);
            } else if (currentDir === 'LEFT') {
              startT = { x: headCenterX - headRadius, y: headCenterY };
              tipT = { x: startT.x - tLen, y: headCenterY };
              ctx.moveTo(startT.x, startT.y);
              ctx.lineTo(tipT.x, tipT.y);
              ctx.lineTo(tipT.x - 3, tipT.y - 2);
              ctx.moveTo(tipT.x, tipT.y);
              ctx.lineTo(tipT.x - 3, tipT.y + 2);
            } else if (currentDir === 'RIGHT') {
              startT = { x: headCenterX + headRadius, y: headCenterY };
              tipT = { x: startT.x + tLen, y: headCenterY };
              ctx.moveTo(startT.x, startT.y);
              ctx.lineTo(tipT.x, tipT.y);
              ctx.lineTo(tipT.x + 3, tipT.y - 2);
              ctx.moveTo(tipT.x, tipT.y);
              ctx.lineTo(tipT.x + 3, tipT.y + 2);
            }
            ctx.stroke();
          }
        } else {
          // Body segment: smooth gradient from emerald to teal
          const progress = i / snake.length; // 0 near head, 1 at tail
          const radius = Math.max(cellSize * 0.28, cellSize * (0.45 - progress * 0.12));
          const centerX = segX + cellSize / 2;
          const centerY = segY + cellSize / 2;

          // Color interpolation
          const greenG = Math.floor(185 - progress * 40);
          const blueB = Math.floor(129 + progress * 50);
          ctx.fillStyle = `rgb(16, ${greenG}, ${blueB})`;

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fill();

          // Connect segments with an oval bridge so body looks continuous
          const nextSeg = snake[i - 1];
          if (nextSeg) {
            const nextCenterX = nextSeg.x * cellSize + cellSize / 2;
            const nextCenterY = nextSeg.y * cellSize + cellSize / 2;
            // Only bridge if adjacent (not wrapping around borders)
            if (Math.abs(seg.x - nextSeg.x) <= 1 && Math.abs(seg.y - nextSeg.y) <= 1) {
              ctx.strokeStyle = `rgb(16, ${greenG}, ${blueB})`;
              ctx.lineWidth = radius * 1.8;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(centerX, centerY);
              ctx.lineTo(nextCenterX, nextCenterY);
              ctx.stroke();
            }
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isPaused, isGameOver, difficulty, score, wrapWalls, gameTick]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-3 sm:p-6 select-none font-sans">
      {/* Header Bar */}
      <header className="w-full max-w-xl flex items-center justify-between py-2 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-pixel text-sm font-bold shadow-sm shadow-emerald-500/10">
            S
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Classic Snake
              <span className="text-[10px] font-pixel px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                RETRO
              </span>
            </h1>
            <p className="text-xs text-slate-400">Pure HTML5 Canvas Arcade</p>
          </div>
        </div>

        {/* Header Quick Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setScanlines(!scanlines)}
            title="Toggle CRT Scanlines"
            className={`p-2 rounded-lg border transition-all text-xs flex items-center gap-1 ${
              scanlines
                ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">CRT</span>
          </button>

          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
            className={`p-2 rounded-lg border transition-all text-xs flex items-center gap-1 ${
              soundEnabled
                ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Game Container */}
      <main className="w-full max-w-xl flex flex-col items-center my-auto py-2">
        {/* Score & HUD Status Panel */}
        <div className="w-full grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Score</span>
            <span className="text-xl sm:text-2xl font-bold font-pixel text-emerald-400 mt-0.5">
              {score}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" /> Best
            </span>
            <span className="text-xl sm:text-2xl font-bold font-pixel text-amber-400 mt-0.5">
              {highScore}
            </span>
            {newHighScoreReached && (
              <span className="absolute top-1 right-1 text-[8px] bg-amber-500 text-slate-950 font-bold px-1 rounded animate-pulse">
                NEW!
              </span>
            )}
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Apples</span>
            <span className="text-xl sm:text-2xl font-bold font-pixel text-rose-400 mt-0.5">
              {applesEaten}
            </span>
          </div>
        </div>

        {/* Game Canvas Container */}
        <div
          className={`relative w-full aspect-square max-w-[440px] rounded-2xl p-2 bg-slate-900 border-2 border-slate-800 shadow-2xl shadow-emerald-950/20 flex items-center justify-center`}
        >
          {/* Inner Arcade Bezel */}
          <div
            className={`relative w-full h-full rounded-xl overflow-hidden arcade-screen ${
              scanlines ? 'scanlines' : ''
            }`}
          >
            <canvas
              ref={canvasRef}
              width={440}
              height={440}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="w-full h-full block cursor-pointer bg-slate-950"
            />

            {/* Start Screen Overlay */}
            {!isPlaying && !isGameOver && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-30">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3 animate-bounce">
                  <Play className="w-7 h-7 ml-1" />
                </div>
                <h2 className="text-xl font-bold font-pixel text-white mb-2">READY TO SLITHER?</h2>
                <p className="text-xs text-slate-300 max-w-xs mb-5">
                  Use Arrow keys, WASD, touch swipe or on-screen D-Pad to steer. Eat red apples and golden fruits!
                </p>
                <button
                  onClick={startGame}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-pixel text-xs tracking-wider transition-transform active:scale-95 shadow-lg shadow-emerald-500/30 flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" /> START GAME
                </button>
                <div className="mt-4 text-[10px] text-slate-500 font-mono">
                  [Space / Enter] to start
                </div>
              </div>
            )}

            {/* Paused Screen Overlay */}
            {isPlaying && isPaused && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-30">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3">
                  <Pause className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold font-pixel text-amber-300 mb-4">GAME PAUSED</h2>
                <div className="flex gap-3">
                  <button
                    onClick={togglePause}
                    className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" /> Resume
                  </button>
                  <button
                    onClick={startGame}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> Restart
                  </button>
                </div>
              </div>
            )}

            {/* Game Over Screen Overlay */}
            {isGameOver && (
              <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-2">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold font-pixel text-rose-500 mb-1">GAME OVER</h2>
                <p className="text-xs text-slate-400 mb-4">
                  {wrapWalls ? 'You bit yourself!' : 'Crashed into a wall or your own tail!'}
                </p>

                {newHighScoreReached && (
                  <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold animate-pulse">
                    <Sparkles className="w-3.5 h-3.5" /> NEW HIGH SCORE!
                  </div>
                )}

                <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-xl p-3 mb-5 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Final Score</span>
                    <span className="text-lg font-bold font-pixel text-emerald-400">{score}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">High Score</span>
                    <span className="text-lg font-bold font-pixel text-amber-400">{highScore}</span>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-pixel text-xs tracking-wider transition-transform active:scale-95 shadow-lg shadow-emerald-500/30 flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" /> PLAY AGAIN
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Options & Settings Toolbar */}
        <div className="w-full max-w-xl flex flex-wrap items-center justify-between gap-2 mt-3 px-1">
          {/* Difficulty selector */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 text-xs">
            <span className="text-[10px] uppercase font-semibold text-slate-400 px-2 flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-400" /> Speed:
            </span>
            {(['easy', 'normal', 'fast'] as Difficulty[]).map(d => (
              <button
                key={d}
                disabled={isPlaying && !isPaused}
                onClick={() => setDifficulty(d)}
                className={`px-2.5 py-1 rounded-lg capitalize text-xs font-medium transition-all ${
                  difficulty === d
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                } ${isPlaying && !isPaused ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Wall Mode Toggle */}
          <button
            onClick={() => setWrapWalls(!wrapWalls)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
              wrapWalls
                ? 'bg-blue-950/60 border-blue-600/40 text-blue-300'
                : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle wall wrap mode"
          >
            {wrapWalls ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Pass-Through Walls</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Solid Walls</span>
              </>
            )}
          </button>

          {/* Quick Play/Pause & Reset buttons */}
          {isPlaying && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={togglePause}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={startGame}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
                title="Restart"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* On-Screen Mobile Virtual D-Pad */}
        <div className="w-full max-w-[280px] mt-4 flex flex-col items-center">
          <button
            onClick={() => changeDirection('UP')}
            className="w-14 h-12 rounded-xl bg-slate-800/80 active:bg-emerald-600 border border-slate-700 active:border-emerald-500 flex items-center justify-center text-slate-200 active:text-white shadow-md active:scale-95 transition-all touch-manipulation cursor-pointer"
            aria-label="Up"
          >
            <ArrowUp className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-6 my-1">
            <button
              onClick={() => changeDirection('LEFT')}
              className="w-14 h-12 rounded-xl bg-slate-800/80 active:bg-emerald-600 border border-slate-700 active:border-emerald-500 flex items-center justify-center text-slate-200 active:text-white shadow-md active:scale-95 transition-all touch-manipulation cursor-pointer"
              aria-label="Left"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="w-10 h-10 rounded-full border border-slate-800 bg-slate-900/50 flex items-center justify-center text-[10px] text-slate-600 font-pixel">
              +
            </div>
            <button
              onClick={() => changeDirection('RIGHT')}
              className="w-14 h-12 rounded-xl bg-slate-800/80 active:bg-emerald-600 border border-slate-700 active:border-emerald-500 flex items-center justify-center text-slate-200 active:text-white shadow-md active:scale-95 transition-all touch-manipulation cursor-pointer"
              aria-label="Right"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
          <button
            onClick={() => changeDirection('DOWN')}
            className="w-14 h-12 rounded-xl bg-slate-800/80 active:bg-emerald-600 border border-slate-700 active:border-emerald-500 flex items-center justify-center text-slate-200 active:text-white shadow-md active:scale-95 transition-all touch-manipulation cursor-pointer"
            aria-label="Down"
          >
            <ArrowDown className="w-6 h-6" />
          </button>
        </div>
      </main>

      {/* Footer Instructions */}
      <footer className="w-full max-w-xl text-center text-slate-500 text-xs py-2 border-t border-slate-900 mt-2">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>🎮 <strong className="text-slate-400">Controls:</strong> Arrow Keys / WASD</span>
          <span>⏸️ <strong className="text-slate-400">Space:</strong> Pause</span>
          <span>🔄 <strong className="text-slate-400">R:</strong> Restart</span>
          <span>📱 <strong className="text-slate-400">Touch:</strong> Swipe or D-Pad</span>
        </div>
      </footer>
    </div>
  );
}
