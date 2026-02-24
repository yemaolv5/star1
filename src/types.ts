export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

export enum EnemyType {
  BASIC = 'BASIC',
  FAST = 'FAST',
  HEAVY = 'HEAVY',
}

export enum PowerUpType {
  TRIPLE_SHOT = 'TRIPLE_SHOT',
  SHIELD = 'SHIELD',
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity extends Point {
  width: number;
  height: number;
}

export interface Player extends Entity {
  health: number;
  maxHealth: number;
  speed: number;
  shield: boolean;
  invulnerable: boolean;
  invulnerableTimer: number;
  tripleShotTimer: number;
}

export interface Bullet extends Point {
  vx: number;
  vy: number;
  radius: number;
  color: string;
  damage: number;
  isPlayer: boolean;
}

export interface Enemy extends Entity {
  type: EnemyType;
  health: number;
  maxHealth: number;
  speed: number;
  scoreValue: number;
  color: string;
  lastShot: number;
  shootInterval: number;
}

export interface PowerUp extends Entity {
  type: PowerUpType;
  speed: number;
}

export interface Particle extends Point {
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: string;
}

export interface GameStats {
  score: number;
  level: number;
  enemiesKilled: number;
  enemiesEscaped: number;
  powerUpsCollected: number;
  startTime: number;
}
