import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  GameState, 
  EnemyType, 
  PowerUpType, 
  Player, 
  Bullet, 
  Enemy, 
  PowerUp, 
  Particle, 
  Achievement, 
  GameStats 
} from './types';
import { 
  Trophy, 
  Shield, 
  Zap, 
  Heart, 
  Pause, 
  Play, 
  RotateCcw, 
  X, 
  Keyboard, 
  MousePointer2, 
  Info,
  AlertTriangle,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 900;
const PLAYER_SIZE = 40;
const BULLET_SPEED = 8;
const ENEMY_SPAWN_RATE = 1500; // ms
const POWERUP_SPAWN_RATE = 10000; // ms

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_blood', title: '第一滴血', description: '击毁第一架敌机', unlocked: false, icon: 'target' },
  { id: 'survivor', title: '生存者', description: '在一次游戏中存活超过60秒', unlocked: false, icon: 'shield' },
  { id: 'power_hungry', title: '能量渴望', description: '收集5个道具', unlocked: false, icon: 'zap' },
  { id: 'ace_pilot', title: '王牌飞行员', description: '达到第5关', unlocked: false, icon: 'award' },
  { id: 'unscathed', title: '毫发无伤', description: '在不损失生命的情况下击毁20架敌机', unlocked: false, icon: 'heart' },
];

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    level: 1,
    enemiesKilled: 0,
    enemiesEscaped: 0,
    powerUpsCollected: 0,
    startTime: 0,
  });
  const [achievements, setAchievements] = useState<Achievement[]>(INITIAL_ACHIEVEMENTS);
  const [activeAchievement, setActiveAchievement] = useState<Achievement | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [levelUpMessage, setLevelUpMessage] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(0);

  // Image Assets
  const imagesRef = useRef<{
    player: HTMLImageElement | null;
    enemyBasic: HTMLImageElement | null;
    enemyFast: HTMLImageElement | null;
    enemyHeavy: HTMLImageElement | null;
  }>({
    player: null,
    enemyBasic: null,
    enemyFast: null,
    enemyHeavy: null,
  });

  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Load Images
  useEffect(() => {
    const loadImg = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => reject();
      });
    };

    Promise.allSettled([
      loadImg('/assets/player.png').then(img => imagesRef.current.player = img),
      loadImg('/assets/enemy_basic.png').then(img => imagesRef.current.enemyBasic = img),
      loadImg('/assets/enemy_fast.png').then(img => imagesRef.current.enemyFast = img),
      loadImg('/assets/enemy_heavy.png').then(img => imagesRef.current.enemyHeavy = img),
    ]).then(() => {
      setImagesLoaded(true);
    });
  }, []);
  
  // Game Entities
  const playerRef = useRef<Player>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 100,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    health: 3,
    maxHealth: 3,
    speed: 6,
    shield: false,
    invulnerable: false,
    invulnerableTimer: 0,
    tripleShotTimer: 0,
  });
  
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<{x: number, y: number, size: number, speed: number}[]>([]);
  
  // Controls
  const keysRef = useRef<Record<string, boolean>>({});
  const touchPosRef = useRef<{x: number, y: number} | null>(null);

  // Initialize Stars
  useEffect(() => {
    const stars = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2,
        speed: Math.random() * 2 + 0.5,
      });
    }
    starsRef.current = stars;
  }, []);

  // Sound Synthesis
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playShootSound = () => {
    if (!isSoundEnabled || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  };

  const playExplosionSound = () => {
    if (!isSoundEnabled || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    source.start();
  };

  // Handle Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
      if (e.code === 'KeyP' && (gameState === GameState.PLAYING || gameState === GameState.PAUSED)) {
        setGameState(prev => prev === GameState.PLAYING ? GameState.PAUSED : GameState.PLAYING);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (gameState !== GameState.PLAYING) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        // Map mouse position to canvas coordinates
        const x = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
        const y = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
        
        // Only update if within or near the canvas
        if (x >= -50 && x <= CANVAS_WIDTH + 50 && y >= -50 && y <= CANVAS_HEIGHT + 50) {
          playerRef.current.x = x - playerRef.current.width / 2;
          playerRef.current.y = y - playerRef.current.height / 2;
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) keysRef.current['MouseDown'] = true;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) keysRef.current['MouseDown'] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState]);

  const unlockAchievement = useCallback((id: string) => {
    setAchievements(prev => {
      const index = prev.findIndex(a => a.id === id);
      if (index !== -1 && !prev[index].unlocked) {
        const newAchievements = [...prev];
        newAchievements[index] = { ...newAchievements[index], unlocked: true };
        setActiveAchievement(newAchievements[index]);
        setTimeout(() => setActiveAchievement(null), 3000);
        return newAchievements;
      }
      return prev;
    });
  }, []);

  const createExplosion = (x: number, y: number, color: string, count = 15) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        radius: Math.random() * 3 + 1,
        color,
        life: 1,
        maxLife: 1,
      });
    }
  };

  const spawnEnemy = useCallback(() => {
    const typeRoll = Math.random();
    let type = EnemyType.BASIC;
    let color = '#3b82f6';
    let health = 1;
    let speed = 2 + (stats.level * 0.2);
    let scoreValue = 100;

    if (typeRoll > 0.85) {
      type = EnemyType.HEAVY;
      color = '#ef4444';
      health = 3;
      speed = 1 + (stats.level * 0.1);
      scoreValue = 300;
    } else if (typeRoll > 0.65) {
      type = EnemyType.FAST;
      color = '#fbbf24';
      health = 1;
      speed = 4 + (stats.level * 0.3);
      scoreValue = 200;
    }

    enemiesRef.current.push({
      x: Math.random() * (CANVAS_WIDTH - 40),
      y: -50,
      width: 40,
      height: 40,
      type,
      health,
      maxHealth: health,
      speed,
      scoreValue,
      color,
      lastShot: 0,
      shootInterval: 2000 - (stats.level * 100),
    });
  }, [stats.level]);

  const spawnPowerUp = useCallback(() => {
    const type = Math.random() > 0.5 ? PowerUpType.TRIPLE_SHOT : PowerUpType.SHIELD;
    powerUpsRef.current.push({
      x: Math.random() * (CANVAS_WIDTH - 30),
      y: -50,
      width: 30,
      height: 30,
      type,
      speed: 2,
    });
  }, []);

  const resetGame = () => {
    initAudio();
    playerRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 100,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      health: 3,
      maxHealth: 3,
      speed: 6,
      shield: false,
      invulnerable: false,
      invulnerableTimer: 0,
      tripleShotTimer: 0,
    };
    bulletsRef.current = [];
    enemiesRef.current = [];
    powerUpsRef.current = [];
    particlesRef.current = [];
    setStats({
      score: 0,
      level: 1,
      enemiesKilled: 0,
      enemiesEscaped: 0,
      powerUpsCollected: 0,
      startTime: Date.now(),
    });
    setGameState(GameState.PLAYING);
  };

  const update = useCallback((deltaTime: number) => {
    if (gameState !== GameState.PLAYING) return;

    // Update Player
    const p = playerRef.current;
    if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) p.x -= p.speed;
    if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) p.x += p.speed;
    if (keysRef.current['ArrowUp'] || keysRef.current['KeyW']) p.y -= p.speed;
    if (keysRef.current['ArrowDown'] || keysRef.current['KeyS']) p.y += p.speed;

    // Touch controls
    if (touchPosRef.current) {
      const dx = touchPosRef.current.x - (p.x + p.width / 2);
      const dy = touchPosRef.current.y - (p.y + p.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Direct follow with speed limit
      if (dist > 5) {
        const moveX = (dx / dist) * p.speed * 1.5;
        const moveY = (dy / dist) * p.speed * 1.5;
        p.x += moveX;
        p.y += moveY;
      }
    }

    // Constraints
    p.x = Math.max(0, Math.min(CANVAS_WIDTH - p.width, p.x));
    p.y = Math.max(0, Math.min(CANVAS_HEIGHT - p.height, p.y));

    // Timers
    if (p.invulnerableTimer > 0) p.invulnerableTimer -= deltaTime;
    else p.invulnerable = false;
    
    if (p.tripleShotTimer > 0) p.tripleShotTimer -= deltaTime;

    // Shooting
    if (keysRef.current['Space'] || keysRef.current['MouseDown'] || touchPosRef.current) {
      const now = Date.now();
      if (!p.lastShot || now - p.lastShot > 200) {
        playShootSound();
        if (p.tripleShotTimer > 0) {
          bulletsRef.current.push(
            { x: p.x + p.width / 2, y: p.y, vx: 0, vy: -BULLET_SPEED, radius: 4, color: '#00ffff', damage: 1, isPlayer: true },
            { x: p.x + p.width / 2, y: p.y, vx: -2, vy: -BULLET_SPEED, radius: 4, color: '#00ffff', damage: 1, isPlayer: true },
            { x: p.x + p.width / 2, y: p.y, vx: 2, vy: -BULLET_SPEED, radius: 4, color: '#00ffff', damage: 1, isPlayer: true }
          );
        } else {
          bulletsRef.current.push({
            x: p.x + p.width / 2,
            y: p.y,
            vx: 0,
            vy: -BULLET_SPEED,
            radius: 4,
            color: '#ffffff',
            damage: 1,
            isPlayer: true
          });
        }
        p.lastShot = now;
      }
    }

    // Update Bullets
    bulletsRef.current.forEach((b, i) => {
      b.x += b.vx;
      b.y += b.vy;
      if (b.y < -20 || b.y > CANVAS_HEIGHT + 20) bulletsRef.current.splice(i, 1);
    });

    // Update Enemies
    enemiesRef.current.forEach((e, i) => {
      e.y += e.speed;
      
      // Enemy Shooting
      const now = Date.now();
      if (now - e.lastShot > e.shootInterval) {
        bulletsRef.current.push({
          x: e.x + e.width / 2,
          y: e.y + e.height,
          vx: 0,
          vy: 4,
          radius: 4,
          color: '#ff4444',
          damage: 1,
          isPlayer: false
        });
        e.lastShot = now;
      }

      if (e.y > CANVAS_HEIGHT) {
        enemiesRef.current.splice(i, 1);
        setStats(prev => ({ 
          ...prev, 
          enemiesEscaped: prev.enemiesEscaped + 1,
          score: Math.max(0, prev.score - 50)
        }));
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 1000);
      }

      // Collision with Player
      if (!p.invulnerable && 
          p.x < e.x + e.width && p.x + p.width > e.x &&
          p.y < e.y + e.height && p.y + p.height > e.y) {
        
        if (p.shield) {
          p.shield = false;
          playExplosionSound();
          createExplosion(p.x + p.width/2, p.y + p.height/2, '#00ffff', 20);
        } else {
          p.health--;
          playExplosionSound();
          createExplosion(p.x + p.width/2, p.y + p.height/2, '#ffffff', 20);
          if (p.health <= 0) {
            setGameState(GameState.GAME_OVER);
          } else {
            p.invulnerable = true;
            p.invulnerableTimer = 2000;
          }
        }
        enemiesRef.current.splice(i, 1);
      }

      // Collision with Bullets
      bulletsRef.current.forEach((b, bi) => {
        if (b.isPlayer && 
            b.x > e.x && b.x < e.x + e.width &&
            b.y > e.y && b.y < e.y + e.height) {
          
          e.health -= b.damage;
          bulletsRef.current.splice(bi, 1);
          
          if (e.health <= 0) {
            playExplosionSound();
            createExplosion(e.x + e.width / 2, e.y + e.height / 2, e.color);
            enemiesRef.current.splice(i, 1);
            setStats(prev => {
              const newKills = prev.enemiesKilled + 1;
              const newScore = prev.score + e.scoreValue;
              
              // Achievements
              if (newKills === 1) unlockAchievement('first_blood');
              if (newKills === 20 && p.health === p.maxHealth) unlockAchievement('unscathed');
              
              // Level Up
              if (newKills % 15 === 0) {
                setLevelUpMessage(true);
                setTimeout(() => setLevelUpMessage(false), 2000);
                enemiesRef.current = []; // Clear screen
                if (prev.level + 1 === 5) unlockAchievement('ace_pilot');
                return { ...prev, enemiesKilled: newKills, score: newScore, level: prev.level + 1 };
              }
              
              return { ...prev, enemiesKilled: newKills, score: newScore };
            });
          }
        }
      });
    });

    // Update PowerUps
    powerUpsRef.current.forEach((pu, i) => {
      pu.y += pu.speed;
      if (pu.y > CANVAS_HEIGHT) powerUpsRef.current.splice(i, 1);

      if (p.x < pu.x + pu.width && p.x + p.width > pu.x &&
          p.y < pu.y + pu.height && p.y + p.height > pu.y) {
        
        if (pu.type === PowerUpType.TRIPLE_SHOT) p.tripleShotTimer = 10000;
        if (pu.type === PowerUpType.SHIELD) p.shield = true;
        
        powerUpsRef.current.splice(i, 1);
        setStats(prev => {
          const newCount = prev.powerUpsCollected + 1;
          if (newCount === 5) unlockAchievement('power_hungry');
          return { ...prev, powerUpsCollected: newCount };
        });
      }
    });

    // Bullet hits player
    bulletsRef.current.forEach((b, i) => {
      if (!b.isPlayer && !p.invulnerable &&
          b.x > p.x && b.x < p.x + p.width &&
          b.y > p.y && b.y < p.y + p.height) {
        
        bulletsRef.current.splice(i, 1);
        if (p.shield) {
          p.shield = false;
          playExplosionSound();
          createExplosion(p.x + p.width/2, p.y + p.height/2, '#00ffff', 20);
        } else {
          p.health--;
          playExplosionSound();
          createExplosion(p.x + p.width/2, p.y + p.height/2, '#ffffff', 20);
          if (p.health <= 0) {
            setGameState(GameState.GAME_OVER);
          } else {
            p.invulnerable = true;
            p.invulnerableTimer = 2000;
          }
        }
      }
    });

    // Update Particles
    particlesRef.current.forEach((pa, i) => {
      pa.x += pa.vx;
      pa.y += pa.vy;
      pa.life -= deltaTime / 1000;
      if (pa.life <= 0) particlesRef.current.splice(i, 1);
    });

    // Update Stars
    starsRef.current.forEach(s => {
      s.y += s.speed;
      if (s.y > CANVAS_HEIGHT) s.y = 0;
    });

    // Survival Achievement
    if (Date.now() - stats.startTime > 60000) unlockAchievement('survivor');

  }, [gameState, stats, unlockAchievement]);

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Stars
    ctx.fillStyle = '#ffffff';
    starsRef.current.forEach(s => {
      ctx.globalAlpha = s.speed / 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Particles
    particlesRef.current.forEach(pa => {
      ctx.globalAlpha = pa.life;
      ctx.fillStyle = pa.color;
      ctx.beginPath();
      ctx.arc(pa.x, pa.y, pa.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Player
    const p = playerRef.current;
    if (!p.invulnerable || Math.floor(Date.now() / 100) % 2 === 0) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = p.tripleShotTimer > 0 ? '#00ffff' : '#ffffff';

      if (imagesRef.current.player) {
        ctx.drawImage(imagesRef.current.player, p.x, p.y, p.width, p.height);
      } else {
        // Fallback to shapes
        ctx.fillStyle = p.tripleShotTimer > 0 ? '#00ffff' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(p.x + p.width / 2, p.y);
        ctx.lineTo(p.x + p.width, p.y + p.height);
        ctx.lineTo(p.x, p.y + p.height);
        ctx.closePath();
        ctx.fill();
      }

      // Shield
      if (p.shield) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x + p.width / 2, p.y + p.height / 2, p.width * 0.8, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.shadowBlur = 0;
    }

    // Draw Bullets
    bulletsRef.current.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw Enemies
    enemiesRef.current.forEach(e => {
      ctx.shadowBlur = 10;
      ctx.shadowColor = e.color;

      let img: HTMLImageElement | null = null;
      if (e.type === EnemyType.BASIC) img = imagesRef.current.enemyBasic;
      else if (e.type === EnemyType.FAST) img = imagesRef.current.enemyFast;
      else if (e.type === EnemyType.HEAVY) img = imagesRef.current.enemyHeavy;

      if (img) {
        ctx.drawImage(img, e.x, e.y, e.width, e.height);
      } else {
        // Fallback to shapes
        ctx.fillStyle = e.color;
        if (e.type === EnemyType.BASIC) {
          ctx.fillRect(e.x, e.y, e.width, e.height);
        } else if (e.type === EnemyType.FAST) {
          ctx.beginPath();
          ctx.moveTo(e.x + e.width / 2, e.y + e.height);
          ctx.lineTo(e.x + e.width, e.y);
          ctx.lineTo(e.x, e.y);
          ctx.closePath();
          ctx.fill();
        } else if (e.type === EnemyType.HEAVY) {
          ctx.fillRect(e.x, e.y, e.width, e.height);
          ctx.fillStyle = '#000000';
          ctx.fillRect(e.x + 5, e.y + 5, e.width - 10, e.height - 10);
          ctx.fillStyle = e.color;
          ctx.fillRect(e.x + 10, e.y + 10, e.width - 20, e.height - 20);
        }
      }
      
      ctx.shadowBlur = 0;
    });

    // Draw PowerUps
    powerUpsRef.current.forEach(pu => {
      ctx.shadowBlur = 15;
      ctx.shadowColor = pu.type === PowerUpType.TRIPLE_SHOT ? '#fbbf24' : '#00ffff';
      ctx.fillStyle = pu.type === PowerUpType.TRIPLE_SHOT ? '#fbbf24' : '#00ffff';
      
      ctx.beginPath();
      ctx.arc(pu.x + pu.width / 2, pu.y + pu.height / 2, pu.width / 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText(pu.type === PowerUpType.TRIPLE_SHOT ? 'T' : 'S', pu.x + pu.width / 2, pu.y + pu.height / 2 + 4);
      
      ctx.shadowBlur = 0;
    });

  }, []);

  const animate = useCallback((time: number) => {
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    update(deltaTime);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) draw(ctx);

    requestRef.current = requestAnimationFrame(animate);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // Spawning Timers
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;
    
    const enemyTimer = setInterval(spawnEnemy, ENEMY_SPAWN_RATE / (1 + stats.level * 0.1));
    const powerUpTimer = setInterval(spawnPowerUp, POWERUP_SPAWN_RATE);
    
    return () => {
      clearInterval(enemyTimer);
      clearInterval(powerUpTimer);
    };
  }, [gameState, spawnEnemy, spawnPowerUp, stats.level]);

  return (
    <div className="relative w-full h-screen flex items-center justify-center bg-black overflow-hidden font-sans">
      {/* Dynamic Star Background (Static Canvas Layer) */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="max-h-full aspect-[8/9] bg-[#050505] shadow-2xl border border-white/5"
        onTouchStart={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            touchPosRef.current = {
              x: (e.touches[0].clientX - rect.left) * (CANVAS_WIDTH / rect.width),
              y: (e.touches[0].clientY - rect.top) * (CANVAS_HEIGHT / rect.height)
            };
          }
        }}
        onTouchMove={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            touchPosRef.current = {
              x: (e.touches[0].clientX - rect.left) * (CANVAS_WIDTH / rect.width),
              y: (e.touches[0].clientY - rect.top) * (CANVAS_HEIGHT / rect.height)
            };
          }
        }}
        onTouchEnd={() => {
          touchPosRef.current = null;
        }}
      />

      {/* HUD */}
      {gameState !== GameState.START && (
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-2">
            <div className="glass p-4 rounded-2xl flex flex-col gap-2 min-w-[150px]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-display text-white/60 uppercase tracking-widest">Score</span>
                <span className="text-xl font-display font-bold text-white">{stats.score}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-display text-white/60 uppercase tracking-widest">Level</span>
                <span className="text-xl font-display font-bold text-blue-400">{stats.level}</span>
              </div>
            </div>
            {/* Sound Toggle */}
            <button 
              onClick={() => {
                initAudio();
                setIsSoundEnabled(!isSoundEnabled);
              }}
              className="glass p-3 rounded-xl pointer-events-auto hover:bg-white/20 transition-colors flex items-center justify-center text-white/60"
            >
              {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>

          <div className="glass p-4 rounded-2xl flex flex-col gap-3 min-w-[150px]">
            <div className="flex gap-2">
              {[...Array(playerRef.current.maxHealth)].map((_, i) => (
                <Heart 
                  key={i} 
                  size={20} 
                  className={i < playerRef.current.health ? "fill-red-500 text-red-500" : "text-white/20"} 
                />
              ))}
            </div>
            <div className="flex gap-2">
              <div className={`p-1.5 rounded-lg ${playerRef.current.tripleShotTimer > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-white/20'}`}>
                <Zap size={16} />
              </div>
              <div className={`p-1.5 rounded-lg ${playerRef.current.shield ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/20'}`}>
                <Shield size={16} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar (Desktop Only) */}
      <div className="hidden xl:flex absolute left-8 top-1/2 -translate-y-1/2 flex-col gap-6 w-64">
        <div className="glass p-6 rounded-3xl">
          <h3 className="font-display text-sm font-bold mb-4 flex items-center gap-2">
            <Keyboard size={18} className="text-blue-400" />
            操作指南
          </h3>
          <ul className="text-xs text-white/60 space-y-3">
            <li className="flex justify-between"><span>移动</span> <span className="text-white font-mono">鼠标 / WASD</span></li>
            <li className="flex justify-between"><span>射击</span> <span className="text-white font-mono">左键 / 空格</span></li>
            <li className="flex justify-between"><span>暂停</span> <span className="text-white font-mono">P 键</span></li>
          </ul>
        </div>

        <div className="glass p-6 rounded-3xl">
          <h3 className="font-display text-sm font-bold mb-4 flex items-center gap-2">
            <Zap size={18} className="text-yellow-400" />
            道具说明
          </h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400 shrink-0">T</div>
              <div>
                <p className="text-xs font-bold">三向子弹</p>
                <p className="text-[10px] text-white/40">增强火力，持续10秒</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">S</div>
              <div>
                <p className="text-xs font-bold">能量护盾</p>
                <p className="text-[10px] text-white/40">抵挡一次任何伤害</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Screens */}
      <AnimatePresence>
        {gameState === GameState.START && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50"
          >
            <div className="max-w-md w-full p-8 glass-dark rounded-[2.5rem] text-center">
              <motion.h1 
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                className="text-4xl md:text-5xl font-display font-black mb-2 tracking-tighter bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent"
              >
                YEMAOLV
              </motion.h1>
              <p className="text-blue-400 font-display text-sm tracking-[0.3em] mb-8 uppercase">星际先锋</p>
              
              <div className="mb-8 text-left space-y-4">
                <div className="glass p-4 rounded-2xl">
                  <h3 className="text-xs font-bold text-blue-400 uppercase mb-2 flex items-center gap-2">
                    <Info size={14} /> 游戏特性
                  </h3>
                  <ul className="text-[11px] text-white/60 space-y-1 list-disc list-inside">
                    <li>多种敌机：基础型、快速型、重型</li>
                    <li>道具系统：三向子弹 (T) 与 能量护盾 (S)</li>
                    <li>关卡升级：难度随关卡提升，挑战极限</li>
                    <li>成就系统：解锁 5 种独特成就</li>
                    <li>视觉特效：动态星空、粒子爆炸与玻璃态 UI</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <button 
                  onClick={() => resetGame()}
                  className="w-full py-4 bg-white text-black font-display font-bold rounded-2xl hover:bg-blue-400 transition-colors flex items-center justify-center gap-2 group"
                >
                  <Play size={20} className="group-hover:scale-110 transition-transform" />
                  开始航行
                </button>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
                    <Keyboard size={16} className="text-white/40 mb-2" />
                    <p className="text-[10px] text-white/40 uppercase">Desktop</p>
                    <p className="text-xs font-medium">WASD + Space</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
                    <MousePointer2 size={16} className="text-white/40 mb-2" />
                    <p className="text-[10px] text-white/40 uppercase">Mobile</p>
                    <p className="text-xs font-medium">Touch to Move</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-white/20 text-[10px] uppercase tracking-widest">
                <Info size={12} />
                难度随关卡自动提升
              </div>
            </div>
          </motion.div>
        )}

        {gameState === GameState.PAUSED && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-40"
          >
            <div className="p-8 glass-dark rounded-[2rem] text-center min-w-[280px]">
              <h2 className="text-2xl font-display font-bold mb-6">游戏暂停</h2>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setGameState(GameState.PLAYING)}
                  className="py-3 bg-white text-black font-display font-bold rounded-xl hover:bg-blue-400 transition-colors"
                >
                  继续游戏
                </button>
                <button 
                  onClick={() => setGameState(GameState.START)}
                  className="py-3 bg-white/10 text-white font-display font-bold rounded-xl hover:bg-white/20 transition-colors"
                >
                  退出
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === GameState.GAME_OVER && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-xl z-50"
          >
            <div className="max-w-lg w-full p-10 glass-dark rounded-[3rem] text-center">
              <h2 className="text-4xl font-display font-black mb-8 text-red-500">任务失败</h2>
              
              <div className="grid grid-cols-2 gap-6 mb-10">
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/40 uppercase tracking-widest mb-1">最终得分</p>
                  <p className="text-3xl font-display font-bold">{stats.score}</p>
                </div>
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/40 uppercase tracking-widest mb-1">最高关卡</p>
                  <p className="text-3xl font-display font-bold">{stats.level}</p>
                </div>
              </div>

              <div className="mb-10 text-left">
                <h3 className="text-xs font-display font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Trophy size={14} />
                  已解锁成就
                </h3>
                <div className="flex flex-wrap gap-2">
                  {achievements.filter(a => a.unlocked).length > 0 ? (
                    achievements.filter(a => a.unlocked).map(a => (
                      <div key={a.id} className="px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-[10px] font-bold text-blue-400">
                        {a.title}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-white/20 italic">暂无成就解锁</p>
                  )}
                </div>
              </div>

              <button 
                onClick={() => resetGame()}
                className="w-full py-4 bg-white text-black font-display font-bold rounded-2xl hover:bg-blue-400 transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw size={20} />
                重新开始
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 pointer-events-none z-30">
        <AnimatePresence>
          {showWarning && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-6 py-3 bg-red-500/20 border border-red-500/40 rounded-full flex items-center gap-2 text-red-400 font-bold text-sm"
            >
              <AlertTriangle size={16} />
              敌机逃脱！扣除 50 分
            </motion.div>
          )}
          {levelUpMessage && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-4xl font-display font-black text-blue-400 italic tracking-tighter"
            >
              LEVEL UP!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Achievement Popup */}
      <AnimatePresence>
        {activeAchievement && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="absolute bottom-8 right-8 p-4 glass rounded-2xl flex items-center gap-4 z-50 animate-slide-in-right"
          >
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-500">
              <Trophy size={24} />
            </div>
            <div>
              <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest">成就解锁</p>
              <p className="text-sm font-bold">{activeAchievement.title}</p>
              <p className="text-[10px] text-white/40">{activeAchievement.description}</p>
            </div>
            <button onClick={() => setActiveAchievement(null)} className="text-white/20 hover:text-white">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Controls Overlay */}
      {gameState === GameState.PLAYING && (
        <div className="absolute bottom-8 right-8 xl:hidden">
          <button 
            onClick={() => setGameState(GameState.PAUSED)}
            className="w-14 h-14 glass rounded-full flex items-center justify-center text-white/60"
          >
            <Pause size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
