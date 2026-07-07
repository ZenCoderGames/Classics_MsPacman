import './styles.css';
import backgroundMusicUrl from '../audio/pacmanMusic.ogg';
import deathSfxUrl from '../audio/sfx/death_0.wav';
import eatFruitSfxUrl from '../audio/sfx/eat_fruit.wav';
import eatGhostSfxUrl from '../audio/sfx/eat_ghost.wav';
import eyesSfxUrl from '../audio/sfx/eyes.wav';
import frightSfxUrl from '../audio/sfx/fright.wav';
import msPacmanIdleUrl from '../art/MsPacMan_01.png';
import msPacmanChompUrl from '../art/MsPacMan_02.png';
import blinkyDownUrl from '../art/Ghosts/Blinky/Blinky1.png';
import blinkyRightUrl from '../art/Ghosts/Blinky/Blinky2.png';
import blinkyLeftUrl from '../art/Ghosts/Blinky/Blinky3.png';
import blinkyUpUrl from '../art/Ghosts/Blinky/Blinky4.png';
import pinkyDownUrl from '../art/Ghosts/Pinky/Pinky1.png';
import pinkyRightUrl from '../art/Ghosts/Pinky/Pinky2.png';
import pinkyLeftUrl from '../art/Ghosts/Pinky/Pinky3.png';
import pinkyUpUrl from '../art/Ghosts/Pinky/Pinky4.png';
import inkyDownUrl from '../art/Ghosts/Inky/Inky1.png';
import inkyRightUrl from '../art/Ghosts/Inky/Inky2.png';
import inkyLeftUrl from '../art/Ghosts/Inky/Inky3.png';
import inkyUpUrl from '../art/Ghosts/Inky/Inky4.png';
import sueDownUrl from '../art/Ghosts/Sue/Sue1.png';
import sueRightUrl from '../art/Ghosts/Sue/Sue2.png';
import sueLeftUrl from '../art/Ghosts/Sue/Sue3.png';
import sueUpUrl from '../art/Ghosts/Sue/Sue4.png';
import eyesUrl from '../art/Ghosts/Eyes.png';
import vulnerableDownUrl from '../art/Ghosts/Vulnerable/Vulnerable1.png';
import vulnerableRightUrl from '../art/Ghosts/Vulnerable/Vulnerable2.png';
import vulnerableLeftUrl from '../art/Ghosts/Vulnerable/Vulnerable3.png';
import vulnerableUpUrl from '../art/Ghosts/Vulnerable/Vulnerable4.png';
import cherryUrl from '../art/Cherry.png';
import strawberryUrl from '../art/Strawberry.png';
import config from './config.json';
import {
  DIRECTION_VECTORS,
  GRID_HEIGHT,
  GRID_WIDTH,
  HUD_HEIGHT,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  OPPOSITE,
  TILE_SIZE,
  chooseDirectionOnShortestPath,
  chooseDirectionToward,
  createMazeDefinition,
  getGhostTarget,
  getMazeIdForLevel,
  isPassable,
  isPlayerPassable,
  legalDirections,
  levelTuning,
  scoreForFruit,
  tileKey,
  wrapTile,
  type Direction,
  type GhostId,
  type GhostMode,
  type MazeDefinition,
  type TileCoord,
} from './gameLogic';

type GameStatus = 'menu' | 'ready' | 'playing' | 'paused' | 'lifeLost' | 'levelClear' | 'gameOver';

type Actor = {
  tile: TileCoord;
  pixel: { x: number; y: number };
  direction: Direction;
  nextDirection: Direction;
  speed: number;
};

type Ghost = Actor & {
  id: GhostId;
  mode: GhostMode;
  home: TileCoord;
  releaseDelay: number;
};

type Fruit = {
  active: boolean;
  tile: TileCoord;
  pixel: { x: number; y: number };
  direction: Direction;
  timer: number;
  spawnIndex: number;
  name: string;
  points: number;
  color: string;
};

type GhostKillEffect = {
  timer: number;
  duration: number;
};

type PickupBurst = {
  x: number;
  y: number;
  timer: number;
  duration: number;
  color: string;
  maxRadius: number;
};

type PickupJuice = {
  timer: number;
  duration: number;
  amplitude: number;
  flashColor: string;
  flashSeconds: number;
};

type FloatingScore = {
  x: number;
  y: number;
  text: string;
  timer: number;
  duration: number;
  color: string;
  fontSize: number;
  driftX: number;
  fadeSpeed: number;
};

const SCORE_POPUP_FONT = config.render.scorePopupFontFamily;

const GHOST_KILL_FREEZE_SECONDS = config.timing.ghostKillFreezeSeconds;
const GHOST_KILL_SHAKE_SECONDS = config.timing.ghostKillShakeSeconds;
const GHOST_RESPAWN_WAIT_SECONDS = config.timing.ghostRespawnWaitSeconds;
const PLAYER_DEATH_FREEZE_SECONDS = config.timing.playerDeathFreezeSeconds;
const PLAYER_DEATH_SHAKE_SECONDS = config.timing.playerDeathShakeSeconds;
const POWER_PELLET_FREEZE_SECONDS = config.timing.powerPelletFreezeSeconds;
const FRUIT_FREEZE_SECONDS = config.timing.fruitFreezeSeconds;
const WALL_OUTLINE_COLOR = config.render.wallOutlineColor;
const WALL_GLOW_COLOR = config.render.wallGlowColor;
const GHOST_EXIT_TILE: TileCoord = config.movement.ghostExitTile;
const PLAYER_SPRITE_SIZE = config.render.playerSpriteSize;

const canvas = requiredElement<HTMLCanvasElement>('game-canvas');
const scoreEl = requiredElement<HTMLElement>('score');
const levelEl = requiredElement<HTMLElement>('level');
const livesEl = requiredElement<HTMLElement>('lives');
const mazeEl = requiredElement<HTMLElement>('maze');
const finalScoreEl = requiredElement<HTMLElement>('final-score');
const menuOverlay = requiredElement<HTMLElement>('menu-overlay');
const pauseOverlay = requiredElement<HTMLElement>('pause-overlay');
const gameOverOverlay = requiredElement<HTMLElement>('game-over-overlay');
const playBtn = requiredElement<HTMLButtonElement>('play-btn');
const restartBtn = requiredElement<HTMLButtonElement>('restart-btn');
const soundBtn = requiredElement<HTMLButtonElement>('music-toggle');
const canvasContext = canvas.getContext('2d');

if (!canvasContext) {
  throw new Error('Canvas 2D context is unavailable.');
}

const ctx: CanvasRenderingContext2D = canvasContext;

canvas.width = LOGICAL_WIDTH;
canvas.height = LOGICAL_HEIGHT;
ctx.imageSmoothingEnabled = false;

const msPacmanIdleImage = loadImage(msPacmanIdleUrl);
const msPacmanChompImage = loadImage(msPacmanChompUrl);
const eyesImage = loadImage(eyesUrl);
const fruitImages: Partial<Record<string, HTMLImageElement>> = {
  Cherry: loadImage(cherryUrl),
  Strawberry: loadImage(strawberryUrl),
};
const vulnerableSprites = loadDirectionalSprites({
  down: vulnerableDownUrl,
  right: vulnerableRightUrl,
  left: vulnerableLeftUrl,
  up: vulnerableUpUrl,
});
const ghostSprites = loadGhostSprites({
  blinky: { down: blinkyDownUrl, right: blinkyRightUrl, left: blinkyLeftUrl, up: blinkyUpUrl },
  pinky: { down: pinkyDownUrl, right: pinkyRightUrl, left: pinkyLeftUrl, up: pinkyUpUrl },
  inky: { down: inkyDownUrl, right: inkyRightUrl, left: inkyLeftUrl, up: inkyUpUrl },
  sue: { down: sueDownUrl, right: sueRightUrl, left: sueLeftUrl, up: sueUpUrl },
});

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function loadImage(src: string): HTMLImageElement {
  const image = new Image();
  image.src = src;
  return image;
}

type DirectionalSpriteUrls = Record<Exclude<Direction, 'none'>, string>;

function loadDirectionalSprites(urls: DirectionalSpriteUrls): Record<Exclude<Direction, 'none'>, HTMLImageElement> {
  return {
    down: loadImage(urls.down),
    right: loadImage(urls.right),
    left: loadImage(urls.left),
    up: loadImage(urls.up),
  };
}

function loadGhostSprites(
  urls: Record<GhostId, DirectionalSpriteUrls>,
): Record<GhostId, Record<Exclude<Direction, 'none'>, HTMLImageElement>> {
  return {
    blinky: loadDirectionalSprites(urls.blinky),
    pinky: loadDirectionalSprites(urls.pinky),
    inky: loadDirectionalSprites(urls.inky),
    sue: loadDirectionalSprites(urls.sue),
  };
}

function drawScaledSprite(
  sprite: HTMLImageElement,
  x: number,
  y: number,
  baseSize: number,
  scale: number,
): void {
  const sourceWidth = sprite.naturalWidth;
  const sourceHeight = sprite.naturalHeight;
  const displayWidth = baseSize * scale;
  const displayHeight = (sourceHeight / sourceWidth) * displayWidth;

  ctx.drawImage(
    sprite,
    0,
    0,
    sourceWidth,
    sourceHeight,
    x - displayWidth / 2,
    y - displayHeight / 2,
    displayWidth,
    displayHeight,
  );
}

function applyDirectionalSpriteTransform(direction: Direction): void {
  if (direction === 'left') {
    ctx.scale(-1, 1);
    return;
  }

  if (direction === 'up') {
    ctx.rotate(-Math.PI / 2);
    return;
  }

  if (direction === 'down') {
    ctx.rotate(Math.PI / 2);
  }
}

function randomScorePopupColor(): string {
  const colors = config.render.scorePopupColors;
  return colors[Math.floor(Math.random() * colors.length)];
}

function scorePopupVisuals(popup: FloatingScore): { scale: number; alpha: number; x: number; y: number } {
  const elapsed = popup.duration - popup.timer;
  const popT = Math.min(elapsed / config.render.scorePopupPopSeconds, 1);
  const scale = 0.35 + popT * 0.65 + Math.sin(popT * Math.PI) * 0.22;
  const fadeWindow = config.render.scorePopupFadeDurationRatio / popup.fadeSpeed;
  const alpha = Math.min(1, popup.timer / (popup.duration * fadeWindow));
  const drift = popup.driftX * Math.min(elapsed / popup.duration, 1);

  return {
    scale,
    alpha,
    x: popup.x + drift,
    y: popup.y,
  };
}

function drawScorePopupText(text: string, x: number, y: number, fontSize: number, color: string, scale: number, alpha: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.font = `${fontSize}px ${SCORE_POPUP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillText(text, 2, 3);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawCountdown(value: number, readyTimer: number): void {
  const stepElapsed = readyTimer - (value - 1);
  const popT = Math.min(stepElapsed / 0.22, 1);
  const scale = 0.55 + popT * 0.45 + Math.sin(popT * Math.PI) * 0.18;
  const fontSize = config.render.countdownFontSize;
  const centerX = LOGICAL_WIDTH / 2;
  const centerY = LOGICAL_HEIGHT / 2 + 42;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.font = `${fontSize}px ${SCORE_POPUP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const label = String(value);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillText(label, 2, 3);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 4;
  ctx.strokeText(label, 0, 0);
  ctx.fillStyle = value === 1 ? '#ff79bd' : '#65d6ff';
  ctx.fillText(label, 0, 0);
  ctx.restore();
}

function drawLevelBanner(level: number): void {
  ctx.save();
  ctx.font = `${config.render.levelBannerFontSize}px ${SCORE_POPUP_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillText(`LEVEL ${level}`, LOGICAL_WIDTH / 2 + 2, LOGICAL_HEIGHT / 2 + 3);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeText(`LEVEL ${level}`, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
  ctx.fillStyle = '#ffe861';
  ctx.fillText(`LEVEL ${level}`, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
  ctx.restore();
}

function tileCenter(tile: TileCoord): { x: number; y: number } {
  return {
    x: tile.x * TILE_SIZE + TILE_SIZE / 2,
    y: tile.y * TILE_SIZE + TILE_SIZE / 2 + HUD_HEIGHT,
  };
}

function tileCenterForMovement(tile: TileCoord): { x: number; y: number } {
  if (tile.x < 0) {
    return { x: -TILE_SIZE / 2, y: tile.y * TILE_SIZE + TILE_SIZE / 2 + HUD_HEIGHT };
  }

  if (tile.x >= GRID_WIDTH) {
    return { x: LOGICAL_WIDTH + TILE_SIZE / 2, y: tile.y * TILE_SIZE + TILE_SIZE / 2 + HUD_HEIGHT };
  }

  if (tile.y < 0) {
    return { x: tile.x * TILE_SIZE + TILE_SIZE / 2, y: HUD_HEIGHT - TILE_SIZE / 2 };
  }

  if (tile.y >= GRID_HEIGHT) {
    return { x: tile.x * TILE_SIZE + TILE_SIZE / 2, y: HUD_HEIGHT + GRID_HEIGHT * TILE_SIZE + TILE_SIZE / 2 };
  }

  return tileCenter(tile);
}

function makeActor(tile: TileCoord, speed: number, direction: Direction = 'left'): Actor {
  return {
    tile: { ...tile },
    pixel: tileCenter(tile),
    direction,
    nextDirection: direction,
    speed,
  };
}

function getShakeOffset(timer: number, duration: number, amplitude = config.shake.amplitude): { x: number; y: number } {
  if (timer <= 0) return { x: 0, y: 0 };
  const elapsed = duration - timer;
  const progress = Math.min(1, elapsed / duration);
  const currentAmplitude = amplitude * (1 - progress);
  return {
    x: Math.sin(elapsed * config.shake.xFrequency) * currentAmplitude,
    y: Math.cos(elapsed * config.shake.yFrequency) * currentAmplitude * config.shake.yScale,
  };
}

type SfxId = 'eyes' | 'eatFruit' | 'death' | 'eatGhost' | 'fright';

const SFX_URLS: Record<SfxId, string> = {
  eyes: eyesSfxUrl,
  eatFruit: eatFruitSfxUrl,
  death: deathSfxUrl,
  eatGhost: eatGhostSfxUrl,
  fright: frightSfxUrl,
};

class ArcadeAudio {
  private audioContext: AudioContext | null = null;
  private muted = false;
  private gameplaySfxBlocked = false;
  private readonly music = new Audio(backgroundMusicUrl);
  private musicStarted = false;
  private musicPaused = false;
  private musicLoadBound = false;
  private readonly sfxBuffers = new Map<SfxId, AudioBuffer>();
  private sfxReady: Promise<void> | null = null;

  constructor() {
    this.music.loop = true;
    this.music.volume = config.audio.musicVolume;
    this.music.preload = 'auto';
    this.bindMusicLoadRetry();
    this.music.load();
    void this.ensureSfxLoaded();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  unlock(): void {
    this.resumeContext();
    void this.ensureSfxLoaded();
    this.startMusic();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.syncMusicPlayback();
  }

  setMusicPaused(paused: boolean): void {
    this.musicPaused = paused;
    this.syncMusicPlayback();
  }

  startMusic(): void {
    if (this.muted) return;
    this.musicStarted = true;
    this.tryPlayMusic();
  }

  private bindMusicLoadRetry(): void {
    if (this.musicLoadBound) return;
    this.musicLoadBound = true;

    const retry = (): void => {
      if (this.musicStarted && !this.muted && !this.musicPaused) {
        this.tryPlayMusic();
      }
    };

    this.music.addEventListener('canplaythrough', retry);
    this.music.addEventListener('loadeddata', retry);
  }

  private tryPlayMusic(): void {
    if (this.muted || !this.musicStarted || this.musicPaused) {
      this.music.pause();
      return;
    }

    void this.music.play().catch(() => {
      // Retry once media finishes loading or on the next user interaction.
    });
  }

  private syncMusicPlayback(): void {
    this.tryPlayMusic();
  }

  private resumeContext(): void {
    if (this.muted) return;
    this.audioContext ??= new AudioContext();
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
  }

  setGameplaySfxBlocked(blocked: boolean): void {
    this.gameplaySfxBlocked = blocked;
  }

  beep(
    frequency: number,
    duration = config.audio.defaultBeepDuration,
    type: OscillatorType = 'square',
    gain = config.audio.defaultBeepGain,
  ): void {
    if (this.muted) return;
    this.resumeContext();
    this.audioContext ??= new AudioContext();
    const oscillator = this.audioContext.createOscillator();
    const volume = this.audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    volume.gain.value = gain;
    oscillator.connect(volume);
    volume.connect(this.audioContext.destination);
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playGameplayBeep(
    frequency: number,
    duration = config.audio.defaultBeepDuration,
    type: OscillatorType = 'square',
    gain = config.audio.defaultBeepGain,
  ): void {
    if (this.muted || this.gameplaySfxBlocked) return;
    this.beep(frequency, duration, type, gain);
  }

  playPellet(high: boolean): void {
    if (this.muted || this.gameplaySfxBlocked) return;
    this.audioContext ??= new AudioContext();
    const pellet = config.audio.pellet;
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const lowPass = this.audioContext.createBiquadFilter();
    const volume = this.audioContext.createGain();
    const frequency = pellet.baseFrequency + (high ? pellet.alternateFrequencyOffset : 0);

    oscillator.type = pellet.type as OscillatorType;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(frequency * 0.82, 40), now + pellet.duration);
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(pellet.lowPassFrequency, now);
    lowPass.Q.setValueAtTime(0.6, now);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(config.audio.sfxVolume.pelletEat, now + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + pellet.duration);

    oscillator.connect(lowPass);
    lowPass.connect(volume);
    volume.connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + pellet.duration + 0.02);
  }

  playEyesRetreat(): void {
    this.playSample('eyes');
  }

  playGhostEaten(): void {
    if (this.gameplaySfxBlocked) return;
    this.playSample('eatGhost');
  }

  playPlayerDeath(): void {
    this.playSample('death');
  }

  playChomp(high: boolean, eatingPellet = false): void {
    if (this.muted || this.gameplaySfxBlocked) return;
    this.audioContext ??= new AudioContext();
    const chomp = config.audio.chomp;
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const volume = this.audioContext.createGain();
    const startFrequency = high ? chomp.highFrequency : chomp.lowFrequency;
    const endFrequency = startFrequency * 0.68;
    const volumeMultiplier = eatingPellet ? chomp.eatingVolumeMultiplier : chomp.idleVolumeMultiplier;

    oscillator.type = chomp.type as OscillatorType;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFrequency, 40), now + chomp.duration);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(
      config.audio.sfxVolume.chomp * volumeMultiplier,
      now + 0.004,
    );
    volume.gain.exponentialRampToValueAtTime(0.0001, now + chomp.duration);

    oscillator.connect(volume);
    volume.connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + chomp.duration + 0.01);
  }

  playPowerPellet(): void {
    this.playSample('fright');
  }

  playFruitEaten(): void {
    if (this.gameplaySfxBlocked) return;
    this.playSample('eatFruit');
  }

  private ensureSfxLoaded(): Promise<void> {
    if (!this.sfxReady) {
      this.sfxReady = this.loadSfxBuffers();
    }
    return this.sfxReady;
  }

  private async loadSfxBuffers(): Promise<void> {
    this.resumeContext();
    this.audioContext ??= new AudioContext();
    const context = this.audioContext;

    await Promise.all(
      (Object.entries(SFX_URLS) as [SfxId, string][]).map(async ([id, url]) => {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        this.sfxBuffers.set(id, await context.decodeAudioData(data));
      }),
    );
  }

  private playSample(id: SfxId, volumeMultiplier = 1): void {
    if (this.muted) return;

    void this.ensureSfxLoaded().then(() => {
      if (this.muted) return;
      if (id !== 'eyes' && id !== 'fright' && this.gameplaySfxBlocked) return;

      const buffer = this.sfxBuffers.get(id);
      if (!buffer) return;

      this.resumeContext();
      const context = this.audioContext!;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = config.audio.sfxVolume[id] * volumeMultiplier;
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
    });
  }
}

class MsPacmanGame {
  private status: GameStatus = 'menu';
  private maze: MazeDefinition = createMazeDefinition('A');
  private pellets = new Set<string>();
  private powerPellets = new Set<string>();
  private player = makeActor(this.maze.playerSpawn, config.levelTuning.playerBaseSpeed, 'left');
  private ghosts: Ghost[] = [];
  private fruit: Fruit | null = null;
  private level = 1;
  private lives = 3;
  private score = 0;
  private highScore = Number(localStorage.getItem('mspacman.highScore.v1') ?? '0');
  private extraLifeAwarded = false;
  private pelletsEaten = 0;
  private readyTimer = config.timing.readySeconds;
  private modeTimer = config.timing.initialScatterSeconds;
  private currentGhostMode: 'scatter' | 'chase' = 'scatter';
  private frightenedTimer = 0;
  private ghostChain = 0;
  private stateTimer = 0;
  private ghostKillFreezeTimer = 0;
  private ghostKillShakeTimer = 0;
  private powerPelletFreezeTimer = 0;
  private fruitFreezeTimer = 0;
  private ghostKillEffects = new Map<GhostId, GhostKillEffect>();
  private playerDeathFlashTimer = 0;
  private playerDeathShakeTimer = 0;
  private floatingScores: FloatingScore[] = [];
  private pickupBursts: PickupBurst[] = [];
  private pickupJuice: PickupJuice | null = null;
  private lastChompTick = -1;
  private lastCountdownTick = 0;
  private pelletChompBoostTimer = 0;
  private fruitSpawnedAt = new Set<number>();
  private requestedDirection: Direction = 'left';
  private lastFrame = 0;
  private accumulator = 0;
  private readonly fixedStep = 1 / 60;
  private readonly audio = new ArcadeAudio();

  constructor() {
    this.resetLevel(true);
    this.bindEvents();
    this.updateHud();
    requestAnimationFrame((time) => this.frame(time));
  }

  startNewGame(): void {
    this.status = 'ready';
    this.level = 1;
    this.lives = 3;
    this.score = 0;
    this.extraLifeAwarded = false;
    this.resetLevel(true);
    this.showOverlays();
    this.audio.unlock();
    this.audio.beep(config.audio.start.frequency, config.audio.start.duration, config.audio.start.type as OscillatorType);
  }

  togglePause(): void {
    if (this.status === 'playing') {
      this.status = 'paused';
      this.audio.setMusicPaused(true);
    } else if (this.status === 'paused') {
      this.status = 'playing';
      this.audio.setMusicPaused(false);
    }
    this.showOverlays();
  }

  private bindEvents(): void {
    const unlockAudio = (): void => {
      this.audio.unlock();
    };

    playBtn.addEventListener('click', () => this.startNewGame());
    restartBtn.addEventListener('click', () => this.startNewGame());
    soundBtn.addEventListener('click', () => {
      this.toggleMute();
      unlockAudio();
    });

    for (const eventName of ['pointerdown', 'keydown'] as const) {
      window.addEventListener(eventName, unlockAudio, { once: true });
    }

    window.addEventListener('keydown', (event) => {
      const direction = keyToDirection(event.key);
      if (direction !== 'none') {
        event.preventDefault();
        this.requestedDirection = direction;
        this.player.nextDirection = direction;
        if (this.status === 'menu') this.startNewGame();
        return;
      }

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (this.status === 'menu' || this.status === 'gameOver') this.startNewGame();
      }

      if (event.key.toLowerCase() === 'p' || event.key === 'Escape') {
        event.preventDefault();
        this.togglePause();
      }

      if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        this.toggleMute();
      }
    });
  }

  private toggleMute(): void {
    this.audio.setMuted(!this.audio.isMuted);
    soundBtn.textContent = `Sound: ${this.audio.isMuted ? 'Off' : 'On'}`;
  }

  private frame(time: number): void {
    const delta = Math.min((time - this.lastFrame) / 1000 || 0, 0.25);
    this.lastFrame = time;
    this.accumulator += delta;

    while (this.accumulator >= this.fixedStep) {
      this.update(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }

    this.render();
    requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  private update(delta: number): void {
    if (this.status === 'ready') {
      this.readyTimer -= delta;
      const countdownValue = Math.max(1, Math.ceil(this.readyTimer));
      if (countdownValue !== this.lastCountdownTick) {
        this.lastCountdownTick = countdownValue;
        this.audio.beep(280 + countdownValue * 120, 0.09, 'sine', 0.022);
      }
      if (this.readyTimer <= 0) {
        this.status = 'playing';
        this.lastCountdownTick = 0;
      }
      this.showOverlays();
      return;
    }

    if (this.status === 'lifeLost') {
      this.stateTimer -= delta;
      this.playerDeathFlashTimer = Math.max(0, this.playerDeathFlashTimer - delta);
      this.playerDeathShakeTimer = Math.max(0, this.playerDeathShakeTimer - delta);
      if (this.stateTimer <= 0) {
        if (this.lives <= 0) {
          this.endGame();
        } else {
          this.resetActorsOnly();
          this.status = 'ready';
          this.readyTimer = config.timing.countdownSeconds;
          this.lastCountdownTick = 0;
        }
      }
      return;
    }

    if (this.status === 'levelClear') {
      this.stateTimer -= delta;
      if (this.stateTimer <= 0) {
        this.level += 1;
        this.resetLevel(true);
      }
      return;
    }

    if (this.status !== 'playing') return;

    if (this.fruitFreezeTimer > 0) {
      this.fruitFreezeTimer = Math.max(0, this.fruitFreezeTimer - delta);
      this.updatePickupJuice(delta);
      this.updateFloatingScores(delta);
      this.updateHud();
      return;
    }

    if (this.powerPelletFreezeTimer > 0) {
      this.powerPelletFreezeTimer = Math.max(0, this.powerPelletFreezeTimer - delta);
      if (this.powerPelletFreezeTimer === 0) {
        this.triggerFrightened();
      }
      this.updatePickupJuice(delta);
      this.updateFloatingScores(delta);
      this.updateHud();
      return;
    }

    if (this.ghostKillFreezeTimer > 0) {
      this.ghostKillFreezeTimer = Math.max(0, this.ghostKillFreezeTimer - delta);
      this.ghostKillShakeTimer = Math.max(0, this.ghostKillShakeTimer - delta);
      this.updateEyesRetreatSfx();
      this.updateGhostKillEffects(delta);
      this.updateGhosts(delta);
      this.updatePickupJuice(delta);
      this.updateFloatingScores(delta);
      this.checkCollisions();
      this.updateHud();
      return;
    }

    this.updateGhostKillEffects(delta);
    this.ghostKillShakeTimer = Math.max(0, this.ghostKillShakeTimer - delta);
    this.updateEyesRetreatSfx();
    this.pelletChompBoostTimer = Math.max(0, this.pelletChompBoostTimer - delta);

    const tuning = levelTuning(this.level);
    const playerSpeedMultiplier =
      this.frightenedTimer > 0 ? config.levelTuning.powerPelletPlayerSpeedMultiplier : 1;
    this.player.speed = tuning.playerSpeed * playerSpeedMultiplier;
    this.updateModeTimers(delta);
    this.movePlayer(delta);
    this.updatePlayerChompSound();
    this.updateGhosts(delta);
    this.updateFruit(delta);
    this.collectPellets();
    this.updatePickupJuice(delta);
    this.updateFloatingScores(delta);
    this.checkCollisions();
    this.updateHud();
  }

  private updateModeTimers(delta: number): void {
    if (this.frightenedTimer > 0) {
      this.frightenedTimer = Math.max(0, this.frightenedTimer - delta);
      if (this.frightenedTimer === 0) {
        for (const ghost of this.ghosts) {
          if (ghost.mode === 'frightened') ghost.mode = this.currentGhostMode;
        }
        this.ghostChain = 0;
      }
    }

    this.modeTimer -= delta;
    if (this.modeTimer <= 0) {
      this.currentGhostMode = this.currentGhostMode === 'scatter' ? 'chase' : 'scatter';
      this.modeTimer = this.currentGhostMode === 'scatter' ? config.timing.scatterSeconds : config.timing.chaseSeconds;
      for (const ghost of this.ghosts) {
        if (ghost.mode === 'scatter' || ghost.mode === 'chase') {
          ghost.direction = OPPOSITE[ghost.direction];
          ghost.mode = this.currentGhostMode;
        }
      }
    }
  }

  private resetLevel(freshPellets: boolean): void {
    this.maze = createMazeDefinition(getMazeIdForLevel(this.level));
    this.currentGhostMode = 'scatter';
    this.modeTimer = config.timing.initialScatterSeconds;
    this.frightenedTimer = 0;
    this.ghostChain = 0;
    this.readyTimer = config.timing.countdownSeconds;
    this.status = 'ready';
    this.lastCountdownTick = 0;
    this.fruit = null;
    this.fruitSpawnedAt.clear();
    this.ghostKillEffects.clear();
    this.ghostKillFreezeTimer = 0;
    this.ghostKillShakeTimer = 0;
    this.powerPelletFreezeTimer = 0;
    this.fruitFreezeTimer = 0;
    this.pelletChompBoostTimer = 0;
    this.playerDeathFlashTimer = 0;
    this.playerDeathShakeTimer = 0;
    this.pelletsEaten = 0;

    if (freshPellets) {
      this.pellets = new Set(this.maze.pellets.map(tileKey));
      this.powerPellets = new Set(this.maze.powerPellets.map(tileKey));
    }

    this.resetActorsOnly();
    this.showOverlays();
    this.updateHud();
  }

  private resetActorsOnly(): void {
    const tuning = levelTuning(this.level);
    this.player = makeActor(this.maze.playerSpawn, tuning.playerSpeed, 'left');
    this.player.nextDirection = this.requestedDirection;
    this.ghosts = [
      this.makeGhost('blinky', config.movement.ghostReleaseDelays.blinky, 'left'),
      this.makeGhost('pinky', config.movement.ghostReleaseDelays.pinky, 'up'),
      this.makeGhost('inky', config.movement.ghostReleaseDelays.inky, 'up'),
      this.makeGhost('sue', config.movement.ghostReleaseDelays.sue, 'up'),
    ];
    this.frightenedTimer = 0;
    this.floatingScores = [];
    this.pickupBursts = [];
    this.pickupJuice = null;
    this.lastChompTick = -1;
    this.ghostKillEffects.clear();
    this.ghostKillFreezeTimer = 0;
    this.ghostKillShakeTimer = 0;
    this.powerPelletFreezeTimer = 0;
    this.fruitFreezeTimer = 0;
    this.pelletChompBoostTimer = 0;
    this.playerDeathFlashTimer = 0;
    this.playerDeathShakeTimer = 0;
  }

  private makeGhost(id: GhostId, releaseDelay: number, direction: Direction): Ghost {
    const spawn = this.maze.ghostSpawns[id];
    return {
      ...makeActor(spawn, levelTuning(this.level).ghostSpeed, direction),
      id,
      mode: this.currentGhostMode,
      home: { ...spawn },
      releaseDelay,
    };
  }

  private movePlayer(delta: number): void {
    this.moveActor(this.player, delta, this.player.speed, true, (actor, tile) => {
      if (this.canMovePlayer(tile, actor.nextDirection)) actor.direction = actor.nextDirection;
      if (!this.canMovePlayer(tile, actor.direction)) actor.direction = 'none';
    });
  }

  private updateGhosts(delta: number): void {
    const tuning = levelTuning(this.level);
    const blinky = this.ghosts.find((ghost) => ghost.id === 'blinky') ?? this.ghosts[0];

    for (const ghost of this.ghosts) {
      if (ghost.mode === 'respawning') {
        ghost.releaseDelay = Math.max(0, ghost.releaseDelay - delta);
        if (ghost.releaseDelay > 0) continue;

        ghost.mode = this.currentGhostMode;
        ghost.direction = 'left';
      }

      if (ghost.mode === 'eyes') {
        this.moveGhostEyes(ghost, delta, tuning.eyesSpeed * config.levelTuning.eyesSpeedMultiplier);
        continue;
      }

      if (this.ghostKillFreezeTimer > 0) continue;

      ghost.releaseDelay = Math.max(0, ghost.releaseDelay - delta);
      if (ghost.releaseDelay > 0 && ghost.id !== 'blinky') continue;

      const speed =
        ghost.mode === 'frightened'
          ? tuning.frightenedSpeed
          : tuning.ghostSpeed +
            (ghost.id === 'blinky' && this.pellets.size < config.movement.blinkyElroyPelletThreshold
              ? config.movement.blinkyElroySpeedBonus
              : 0);

      this.moveActor(ghost, delta, speed, false, (actor, tile) => {
        const currentGhost = actor as Ghost;

        if (this.isGhostInSpawnArea(tile)) {
          currentGhost.direction = chooseDirectionToward(this.maze, tile, currentGhost.direction, GHOST_EXIT_TILE, true);
          return;
        }

        if (currentGhost.mode === 'frightened') {
          currentGhost.direction = this.chooseRandomGhostDirection(currentGhost, tile);
          return;
        }

        const target =
          this.currentGhostMode === 'scatter'
            ? this.maze.scatterTargets[currentGhost.id]
            : getGhostTarget(currentGhost, this.player, blinky.tile, this.maze.scatterTargets);

        currentGhost.direction = chooseDirectionToward(
          this.maze,
          tile,
          currentGhost.direction,
          target,
          false,
        );
      });
    }
  }

  private moveGhostEyes(ghost: Ghost, delta: number, speed: number): void {
    if (ghost.tile.x === ghost.home.x && ghost.tile.y === ghost.home.y) {
      ghost.pixel = tileCenter(ghost.home);
      ghost.direction = 'none';
      ghost.mode = 'respawning';
      ghost.releaseDelay = GHOST_RESPAWN_WAIT_SECONDS;
      return;
    }

    const startTile = { ...ghost.tile };
    this.moveActor(ghost, delta, speed, false, (actor, tile) => {
      const currentGhost = actor as Ghost;
      currentGhost.direction = chooseDirectionOnShortestPath(
        this.maze,
        tile,
        currentGhost.direction,
        currentGhost.home,
        true,
      );
    });

    if (startTile.x === ghost.tile.x && startTile.y === ghost.tile.y) return;

    const enteredSpawnArea =
      !this.isGhostInSpawnArea(startTile) && this.isGhostInSpawnArea(ghost.tile);
    const stillOutsideSpawnArea = ghost.mode === 'eyes' && !this.isGhostInSpawnArea(ghost.tile);

    if (stillOutsideSpawnArea || enteredSpawnArea) {
      this.audio.playEyesRetreat();
    }
  }

  private isEyesRetreatBlockingSfx(): boolean {
    return this.ghosts.some(
      (ghost) => ghost.mode === 'eyes' && !this.isGhostInSpawnArea(ghost.tile),
    );
  }

  private updateEyesRetreatSfx(): void {
    this.audio.setGameplaySfxBlocked(this.isEyesRetreatBlockingSfx());
  }

  private updateGhostKillEffects(delta: number): void {
    for (const [ghostId, effect] of this.ghostKillEffects) {
      effect.timer = Math.max(0, effect.timer - delta);
      if (effect.timer <= 0) {
        this.ghostKillEffects.delete(ghostId);
      }
    }
  }

  private chooseRandomGhostDirection(ghost: Ghost, tile: TileCoord): Direction {
    const legal = legalDirections(this.maze, tile, ghost.direction, false);
    const options = legal.length > 0 ? legal : legalDirections(this.maze, tile, ghost.direction, true);
    if (options.length === 0) return 'none';
    const seed = (tile.x * 17 + tile.y * 31 + Math.floor(performance.now() / config.timing.randomTurnFrameMs)) % options.length;
    return options[seed];
  }

  private moveActor(
    actor: Actor,
    delta: number,
    speed: number,
    isPlayer: boolean,
    chooseDirection: (actor: Actor, tile: TileCoord) => void,
  ): void {
    const center = tileCenter(actor.tile);
    const atCenter = Math.hypot(actor.pixel.x - center.x, actor.pixel.y - center.y) <= config.movement.centerTolerance;

    if (atCenter) {
      actor.pixel = { ...center };
      chooseDirection(actor, actor.tile);
    }

    if (actor.direction === 'none') return;

    const vector = DIRECTION_VECTORS[actor.direction];
    const targetTile = {
      x: actor.tile.x + vector.x,
      y: actor.tile.y + vector.y,
    };

    const targetIsLegal = isPlayer ? this.isLegalPlayerTile(targetTile) : isPassable(this.maze, targetTile);
    if (!targetIsLegal) {
      actor.pixel = { ...center };
      actor.direction = 'none';
      return;
    }

    const targetCenter = tileCenterForMovement(targetTile);
    const distanceToTarget = Math.hypot(targetCenter.x - actor.pixel.x, targetCenter.y - actor.pixel.y);
    const movement = speed * delta;

    if (movement >= distanceToTarget) {
      const wrappedTile = wrapTile(targetTile);
      actor.tile = wrappedTile;
      actor.pixel = tileCenter(wrappedTile);
      return;
    }

    actor.pixel.x += vector.x * movement;
    actor.pixel.y += vector.y * movement;
  }

  private canMovePlayer(tile: TileCoord, direction: Direction): boolean {
    const vector = DIRECTION_VECTORS[direction];
    return this.isLegalPlayerTile({ x: tile.x + vector.x, y: tile.y + vector.y });
  }

  private isLegalPlayerTile(tile: TileCoord): boolean {
    return isPlayerPassable(this.maze, tile);
  }

  private isGhostInSpawnArea(tile: TileCoord): boolean {
    const area = config.movement.ghostSpawnArea;
    return tile.x >= area.minX && tile.x <= area.maxX && tile.y >= area.minY && tile.y <= area.maxY;
  }

  private collectPellets(): void {
    const key = tileKey(this.player.tile);
    if (this.pellets.delete(key)) {
      this.addScore(config.scoring.pellet);
      this.spawnScorePopup(config.scoring.pellet, tileCenter(this.player.tile), {
        fadeSpeed: config.render.scorePopupPelletFadeSpeed,
      });
      this.pelletsEaten += 1;
      this.pelletChompBoostTimer = (config.timing.playerAnimationFrameMs / 1000) * 3;
      this.audio.playPellet(this.pelletsEaten % 2 === 0);
    }

    if (this.powerPellets.delete(key)) {
      this.addScore(config.scoring.powerPellet);
      this.spawnScorePopup(config.scoring.powerPellet, tileCenter(this.player.tile), {
        fadeSpeed: config.render.scorePopupPelletFadeSpeed,
      });
      this.triggerPickupJuice('powerPellet', this.player.pixel.x, this.player.pixel.y);
      this.pelletsEaten += 1;
      this.audio.playPowerPellet();
      this.powerPelletFreezeTimer = POWER_PELLET_FREEZE_SECONDS;
    }

    this.maybeSpawnFruit();

    if (this.pellets.size === 0 && this.powerPellets.size === 0) {
      this.status = 'levelClear';
      this.stateTimer = config.timing.levelClearFlashSeconds;
      this.audio.beep(
        config.audio.levelClear.frequency,
        config.audio.levelClear.duration,
        config.audio.levelClear.type as OscillatorType,
        config.audio.levelClear.gain,
      );
    }
  }

  private spawnScorePopup(
    points: number,
    position: { x: number; y: number } = tileCenter(this.player.tile),
    options: { fadeSpeed?: number } = {},
  ): void {
    const fontSize =
      points >= config.scoring.ghostChain[0]
        ? config.render.ghostScorePopupFontSize
        : config.render.scorePopupFontSize;

    this.floatingScores.push({
      x: position.x,
      y: position.y,
      text: String(points),
      timer: config.render.scorePopupDuration,
      duration: config.render.scorePopupDuration,
      color: randomScorePopupColor(),
      fontSize,
      driftX: (Math.random() - 0.5) * 16,
      fadeSpeed: options.fadeSpeed ?? 1,
    });
  }

  private updateFloatingScores(delta: number): void {
    this.floatingScores = this.floatingScores
      .map((popup) => ({
        ...popup,
        timer: popup.timer - delta,
        y: popup.y - config.render.scorePopupRiseSpeed * delta,
      }))
      .filter((popup) => popup.timer > 0);
  }

  private triggerFrightened(): void {
    const duration = levelTuning(this.level).frightenedDuration;
    if (duration <= 0) return;
    this.frightenedTimer = duration;
    this.ghostChain = 0;
    for (const ghost of this.ghosts) {
      if (ghost.mode === 'scatter' || ghost.mode === 'chase' || ghost.mode === 'frightened') {
        ghost.direction = OPPOSITE[ghost.direction];
        ghost.mode = 'frightened';
      }
    }
  }

  private triggerPickupJuice(kind: 'powerPellet' | 'cherry', x: number, y: number): void {
    const juice = config.juice[kind];
    this.pickupJuice = {
      timer: juice.shakeSeconds,
      duration: juice.shakeSeconds,
      amplitude: juice.shakeAmplitude,
      flashColor: juice.flashColor,
      flashSeconds: juice.flashSeconds,
    };
    this.pickupBursts.push({
      x,
      y,
      timer: juice.burstSeconds,
      duration: juice.burstSeconds,
      color: juice.burstColor,
      maxRadius: juice.burstMaxRadius,
    });
  }

  private updatePickupJuice(delta: number): void {
    if (this.pickupJuice) {
      this.pickupJuice.timer = Math.max(0, this.pickupJuice.timer - delta);
      if (this.pickupJuice.timer <= 0) {
        this.pickupJuice = null;
      }
    }

    this.pickupBursts = this.pickupBursts
      .map((burst) => ({ ...burst, timer: burst.timer - delta }))
      .filter((burst) => burst.timer > 0);
  }

  private updatePlayerChompSound(): void {
    if (this.player.direction === 'none') {
      this.lastChompTick = -1;
      return;
    }

    const tick = Math.floor(performance.now() / config.timing.playerAnimationFrameMs);
    if (tick === this.lastChompTick) return;

    this.lastChompTick = tick;
    this.audio.playChomp(tick % 2 === 0, this.pelletChompBoostTimer > 0);
  }

  private maybeSpawnFruit(): void {
    const thresholds = config.fruit.spawnThresholds;
    const threshold = thresholds.find((value) => this.pelletsEaten >= value && !this.fruitSpawnedAt.has(value));
    if (!threshold || this.fruit?.active) return;

    this.fruitSpawnedAt.add(threshold);
    const fruitScore = scoreForFruit(this.level);
    const spawnCandidates = this.maze.fruitSpawnTiles;
    const spawn =
      spawnCandidates.length > 0
        ? spawnCandidates[Math.floor(Math.random() * spawnCandidates.length)]
        : config.fruit.spawnTile;
    const direction: Direction = spawn.x <= 1 ? 'right' : spawn.x >= GRID_WIDTH - 2 ? 'left' : 'right';
    this.fruit = {
      active: true,
      tile: spawn,
      pixel: tileCenter(spawn),
      direction,
      timer: config.fruit.durationSeconds,
      spawnIndex: this.fruitSpawnedAt.size,
      ...fruitScore,
    };
  }

  private updateFruit(delta: number): void {
    if (!this.fruit?.active) return;
    this.fruit.timer -= delta;
    if (this.fruit.timer <= 0) {
      this.fruit.active = false;
      return;
    }

    const actor: Actor = {
      tile: this.fruit.tile,
      pixel: this.fruit.pixel,
      direction: this.fruit.direction,
      nextDirection: this.fruit.direction,
      speed: config.fruit.speed,
    };

    this.moveActor(actor, delta, config.fruit.speed, false, (_actor, tile) => {
      const directions = legalDirections(this.maze, tile, actor.direction, false);
      actor.direction = directions[(tile.x + tile.y + this.fruit!.spawnIndex) % Math.max(1, directions.length)] ?? actor.direction;
    });

    this.fruit.tile = actor.tile;
    this.fruit.pixel = actor.pixel;
    this.fruit.direction = actor.direction;
  }

  private checkCollisions(): void {
    for (const ghost of this.ghosts) {
      const dx = ghost.pixel.x - this.player.pixel.x;
      const dy = ghost.pixel.y - this.player.pixel.y;
      if (Math.hypot(dx, dy) > config.collision.playerGhostRadius) continue;

      if (ghost.mode === 'frightened') {
        const scores = config.scoring.ghostChain;
        const points = scores[Math.min(this.ghostChain, scores.length - 1)];
        this.addScore(points);
        this.spawnScorePopup(points, { x: ghost.pixel.x, y: ghost.pixel.y });
        this.ghostChain += 1;
        ghost.mode = 'eyes';
        ghost.direction = OPPOSITE[ghost.direction];
        this.ghostKillFreezeTimer = GHOST_KILL_FREEZE_SECONDS;
        this.ghostKillShakeTimer = GHOST_KILL_SHAKE_SECONDS;
        this.ghostKillEffects.set(ghost.id, {
          timer: GHOST_KILL_FREEZE_SECONDS,
          duration: GHOST_KILL_FREEZE_SECONDS,
        });
        this.audio.playGhostEaten();
        if (!this.isGhostInSpawnArea(ghost.tile)) {
          this.audio.playEyesRetreat();
        }
      } else if (ghost.mode !== 'eyes' && ghost.mode !== 'respawning') {
        this.loseLife();
        return;
      }
    }

    if (
      this.fruit?.active &&
      Math.hypot(this.fruit.pixel.x - this.player.pixel.x, this.fruit.pixel.y - this.player.pixel.y) <
        config.collision.fruitRadius
    ) {
      this.addScore(this.fruit.points);
      this.spawnScorePopup(this.fruit.points, { x: this.fruit.pixel.x, y: this.fruit.pixel.y });
      this.triggerPickupJuice('cherry', this.fruit.pixel.x, this.fruit.pixel.y);
      this.audio.playFruitEaten();
      this.fruit.active = false;
      this.fruitFreezeTimer = FRUIT_FREEZE_SECONDS;
    }
  }

  private loseLife(): void {
    this.lives -= 1;
    this.status = 'lifeLost';
    this.stateTimer = PLAYER_DEATH_FREEZE_SECONDS;
    this.playerDeathFlashTimer = PLAYER_DEATH_FREEZE_SECONDS;
    this.playerDeathShakeTimer = PLAYER_DEATH_SHAKE_SECONDS;
    this.audio.playPlayerDeath();
    this.updateHud();
  }

  private endGame(): void {
    this.status = 'gameOver';
    this.highScore = Math.max(this.highScore, this.score);
    localStorage.setItem('mspacman.highScore.v1', String(this.highScore));
    finalScoreEl.textContent = `Final score: ${this.score}`;
    this.showOverlays();
    this.updateHud();
  }

  private addScore(points: number): void {
    this.score += points;
    if (!this.extraLifeAwarded && this.score >= config.scoring.extraLifeScore) {
      this.extraLifeAwarded = true;
      this.lives += 1;
      this.audio.beep(
        config.audio.extraLife.frequency,
        config.audio.extraLife.duration,
        config.audio.extraLife.type as OscillatorType,
        config.audio.extraLife.gain,
      );
    }
  }

  private updateHud(): void {
    scoreEl.textContent = String(this.score);
    levelEl.textContent = String(this.level);
    livesEl.textContent = String(Math.max(0, this.lives));
    mazeEl.textContent = this.maze.id;
  }

  private showOverlays(): void {
    menuOverlay.classList.toggle('hidden', this.status !== 'menu');
    pauseOverlay.classList.toggle('hidden', this.status !== 'paused');
    gameOverOverlay.classList.toggle('hidden', this.status !== 'gameOver');
  }

  private render(): void {
    ctx.fillStyle = '#00000a';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    const ghostShake = getShakeOffset(this.ghostKillShakeTimer, GHOST_KILL_SHAKE_SECONDS);
    const playerShake = getShakeOffset(this.playerDeathShakeTimer, PLAYER_DEATH_SHAKE_SECONDS);
    const pickupShake = this.pickupJuice
      ? getShakeOffset(this.pickupJuice.timer, this.pickupJuice.duration, this.pickupJuice.amplitude)
      : { x: 0, y: 0 };

    ctx.save();
    ctx.translate(
      ghostShake.x + playerShake.x + pickupShake.x,
      ghostShake.y + playerShake.y + pickupShake.y,
    );
    this.drawMaze();
    this.drawPellets();
    if (this.fruit?.active) this.drawFruit(this.fruit);
    for (const ghost of this.ghosts) this.drawGhostSprite(ghost);
    this.drawPlayer();
    this.drawPickupBursts();
    this.drawFloatingScores();

    if (this.status === 'ready') {
      drawLevelBanner(this.level);
      drawCountdown(Math.max(1, Math.ceil(this.readyTimer)), this.readyTimer);
    }
    ctx.restore();

    this.drawPickupFlash();
    this.drawLevelClearFlash();
  }

  private drawLevelClearFlash(): void {
    if (this.status !== 'levelClear') return;

    const total = config.timing.levelClearFlashSeconds;
    const count = config.timing.levelClearFlashCount;
    const elapsed = total - this.stateTimer;
    const segmentDuration = total / (count * 2);
    const segment = Math.floor(elapsed / segmentDuration);

    if (segment >= count * 2) return;
    if (segment % 2 === 1) return;

    const segmentProgress = (elapsed % segmentDuration) / segmentDuration;
    const alpha = (1 - segmentProgress) * 0.42;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff8c4';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.restore();
  }

  private drawPickupBursts(): void {
    for (const burst of this.pickupBursts) {
      const progress = 1 - burst.timer / burst.duration;
      const radius = burst.maxRadius * progress;
      const alpha = (1 - progress) * 0.75;

      ctx.save();
      ctx.strokeStyle = burst.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3 + (1 - progress) * 2;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = burst.color;
      ctx.globalAlpha = alpha * 0.18;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawPickupFlash(): void {
    if (!this.pickupJuice) return;

    const flashElapsed = this.pickupJuice.duration - this.pickupJuice.timer;
    const flashProgress = flashElapsed / this.pickupJuice.flashSeconds;
    if (flashProgress >= 1) return;

    ctx.save();
    ctx.globalAlpha = (1 - flashProgress) * 0.85;
    ctx.fillStyle = this.pickupJuice.flashColor;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.restore();
  }

  private drawMaze(): void {
    ctx.save();
    ctx.shadowColor = WALL_GLOW_COLOR;
    ctx.shadowBlur = 3;
    this.drawWallOutlines();
    ctx.restore();
  }

  private drawWallOutlines(): void {
    const thickness = config.render.wallShellOutlineWidth;
    const radius = config.render.wallOuterCornerRadius;
    ctx.fillStyle = WALL_OUTLINE_COLOR;

    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      for (let x = 0; x < GRID_WIDTH; x += 1) {
        if (!this.isWallTile(x, y)) continue;

        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE + HUD_HEIGHT;
        const leftOpen = !this.isWallTile(x - 1, y);
        const rightOpen = !this.isWallTile(x + 1, y);
        const topOpen = !this.isWallTile(x, y - 1);
        const bottomOpen = !this.isWallTile(x, y + 1);

        const roundTopLeft = topOpen && leftOpen && this.isOuterWallCorner(x - 1, y, x, y - 1, x - 1, y - 1);
        const roundTopRight = topOpen && rightOpen && this.isOuterWallCorner(x + 1, y, x, y - 1, x + 1, y - 1);
        const roundBottomRight =
          bottomOpen && rightOpen && this.isOuterWallCorner(x + 1, y, x, y + 1, x + 1, y + 1);
        const roundBottomLeft =
          bottomOpen && leftOpen && this.isOuterWallCorner(x - 1, y, x, y + 1, x - 1, y + 1);

        if (topOpen) {
          const startX = px + (roundTopLeft ? radius : 0);
          const endX = px + TILE_SIZE - (roundTopRight ? radius : 0);
          ctx.fillRect(startX, py, endX - startX, thickness);
        }

        if (bottomOpen) {
          const startX = px + (roundBottomLeft ? radius : 0);
          const endX = px + TILE_SIZE - (roundBottomRight ? radius : 0);
          ctx.fillRect(startX, py + TILE_SIZE - thickness, endX - startX, thickness);
        }

        if (leftOpen) {
          const startY = py + (roundTopLeft ? radius : 0);
          const endY = py + TILE_SIZE - (roundBottomLeft ? radius : 0);
          ctx.fillRect(px, startY, thickness, endY - startY);
        }

        if (rightOpen) {
          const startY = py + (roundTopRight ? radius : 0);
          const endY = py + TILE_SIZE - (roundBottomRight ? radius : 0);
          ctx.fillRect(px + TILE_SIZE - thickness, startY, thickness, endY - startY);
        }

        if (roundTopLeft) {
          this.fillWallCornerArc(px + radius, py + radius, radius, thickness, Math.PI, (3 * Math.PI) / 2);
        }
        if (roundTopRight) {
          this.fillWallCornerArc(px + TILE_SIZE - radius, py + radius, radius, thickness, (3 * Math.PI) / 2, 0);
        }
        if (roundBottomRight) {
          this.fillWallCornerArc(px + TILE_SIZE - radius, py + TILE_SIZE - radius, radius, thickness, 0, Math.PI / 2);
        }
        if (roundBottomLeft) {
          this.fillWallCornerArc(px + radius, py + TILE_SIZE - radius, radius, thickness, Math.PI / 2, Math.PI);
        }
      }
    }
  }

  private fillWallCornerArc(
    centerX: number,
    centerY: number,
    radius: number,
    thickness: number,
    startAngle: number,
    endAngle: number,
  ): void {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.arc(centerX, centerY, Math.max(0, radius - thickness), endAngle, startAngle, true);
    ctx.closePath();
    ctx.fill();
  }

  private isWallTile(x: number, y: number): boolean {
    return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT && !this.maze.passable[y][x];
  }

  private isOuterWallCorner(
    sideAX: number,
    sideAY: number,
    sideBX: number,
    sideBY: number,
    diagonalX: number,
    diagonalY: number,
  ): boolean {
    return (
      !this.isWallTile(sideAX, sideAY) &&
      !this.isWallTile(sideBX, sideBY) &&
      !this.isWallTile(diagonalX, diagonalY)
    );
  }

  private drawPellets(): void {
    ctx.save();
    ctx.shadowColor = config.render.pelletGlowColor;
    ctx.shadowBlur = config.render.pelletGlowBlur;
    ctx.fillStyle = config.render.pelletColor;
    const pelletRadius = config.render.pelletSize / 2;
    for (const key of this.pellets) {
      const [x, y] = key.split(',').map(Number);
      const centerX = x * TILE_SIZE + TILE_SIZE / 2;
      const centerY = HUD_HEIGHT + y * TILE_SIZE + TILE_SIZE / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pelletRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowColor = config.render.powerPelletGlowColor;
    ctx.fillStyle = config.render.powerPelletColor;
    const pulse = Math.sin(performance.now() / 130) * config.render.powerPelletPulse;
    for (const key of this.powerPellets) {
      const [x, y] = key.split(',').map(Number);
      const size = config.render.powerPelletSize + pulse * 2;
      const centerX = x * TILE_SIZE + TILE_SIZE / 2;
      const centerY = HUD_HEIGHT + y * TILE_SIZE + TILE_SIZE / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawFloatingScores(): void {
    for (const popup of this.floatingScores) {
      const visuals = scorePopupVisuals(popup);
      drawScorePopupText(popup.text, visuals.x, visuals.y, popup.fontSize, popup.color, visuals.scale, visuals.alpha);
    }
  }

  private drawPlayer(): void {
    const isMoving = this.player.direction !== 'none';
    const sprite =
      isMoving && Math.floor(performance.now() / config.timing.playerAnimationFrameMs) % 2 === 0
        ? msPacmanChompImage
        : msPacmanIdleImage;
    const deathFlashOn =
      this.playerDeathFlashTimer > 0 &&
      Math.floor((PLAYER_DEATH_FREEZE_SECONDS - this.playerDeathFlashTimer) / config.timing.flashIntervalSeconds) % 2 === 0;
    const pickupFlashOn =
      this.pickupJuice !== null && this.pickupJuice.duration - this.pickupJuice.timer < 0.12;

    if (!sprite.complete || sprite.naturalWidth === 0) {
      return;
    }

    ctx.save();
    ctx.translate(this.player.pixel.x, this.player.pixel.y);
    applyDirectionalSpriteTransform(this.player.direction);
    ctx.filter = deathFlashOn
      ? config.render.deathFlashFilter
      : pickupFlashOn
        ? 'brightness(1.85) saturate(1.35)'
        : 'none';
    drawScaledSprite(sprite, 0, 0, PLAYER_SPRITE_SIZE, config.render.playerScale);
    ctx.restore();
  }

  private drawGhostSprite(ghost: Ghost): void {
    if (ghost.mode === 'eyes') {
      if (!eyesImage.complete || eyesImage.naturalWidth === 0) {
        return;
      }

      const killEffect = this.ghostKillEffects.get(ghost.id);
      const killFlashOn = killEffect
        ? Math.floor((killEffect.duration - killEffect.timer) / config.timing.flashIntervalSeconds) % 2 === 0
        : false;

      ctx.save();
      ctx.filter = killFlashOn ? 'brightness(3) saturate(0)' : 'none';
      drawScaledSprite(
        eyesImage,
        ghost.pixel.x,
        ghost.pixel.y,
        config.render.ghostSpriteSize,
        config.render.ghostScale * config.render.eyesScale,
      );
      ctx.restore();
      return;
    }

    const direction = ghost.direction === 'none' ? 'down' : ghost.direction;

    if (
      this.powerPelletFreezeTimer > 0 &&
      ghost.mode !== 'eyes' &&
      ghost.mode !== 'respawning'
    ) {
      const sprite = ghostSprites[ghost.id][direction];
      if (!sprite.complete || sprite.naturalWidth === 0) {
        return;
      }

      const flashOn =
        Math.floor(performance.now() / (config.timing.flashIntervalSeconds * 1000)) % 2 === 0;

      ctx.save();
      ctx.filter = flashOn ? 'brightness(3) saturate(0)' : 'none';
      drawScaledSprite(sprite, ghost.pixel.x, ghost.pixel.y, config.render.ghostSpriteSize, config.render.ghostScale);
      ctx.restore();
      return;
    }

    if (ghost.mode === 'frightened') {
      const sprite = vulnerableSprites[direction];
      if (!sprite.complete || sprite.naturalWidth === 0) {
        return;
      }

      const frightenedFlashOn =
        this.frightenedTimer < 2 &&
        Math.floor(performance.now() / config.timing.frightenedFlashMs) % 2 === 0;

      ctx.save();
      ctx.filter = frightenedFlashOn ? config.render.frightenedGhostFlashFilter : 'none';
      drawScaledSprite(sprite, ghost.pixel.x, ghost.pixel.y, config.render.ghostSpriteSize, config.render.ghostScale);
      ctx.restore();
      return;
    }

    const sprite = ghostSprites[ghost.id][direction];
    if (!sprite.complete || sprite.naturalWidth === 0) {
      return;
    }

    ctx.save();
    drawScaledSprite(sprite, ghost.pixel.x, ghost.pixel.y, config.render.ghostSpriteSize, config.render.ghostScale);
    ctx.restore();
  }

  private getFruitScale(name: string): number {
    const multipliers: Partial<Record<string, number>> = {
      Cherry: config.render.cherryScaleMultiplier,
      Strawberry: config.render.strawberryScaleMultiplier,
    };
    return config.render.fruitScale * (multipliers[name] ?? 1);
  }

  private drawFruit(fruit: Fruit): void {
    const sprite = fruitImages[fruit.name];
    if (sprite?.complete && sprite.naturalWidth > 0) {
      const bounceY = Math.sin(performance.now() / config.render.fruitBouncePeriodMs + fruit.spawnIndex) *
        config.render.fruitBounceAmplitude;
      drawScaledSprite(
        sprite,
        fruit.pixel.x,
        fruit.pixel.y + bounceY,
        config.render.fruitSpriteSize,
        this.getFruitScale(fruit.name),
      );
      return;
    }

    ctx.fillStyle = fruit.color;
    ctx.beginPath();
    ctx.arc(fruit.pixel.x, fruit.pixel.y, config.render.fruitRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = config.render.fruitLeafColor;
    ctx.fillRect(
      fruit.pixel.x + config.render.fruitLeafOffset.x,
      fruit.pixel.y + config.render.fruitLeafOffset.y,
      config.render.fruitLeafSize.width,
      config.render.fruitLeafSize.height,
    );
  }
}

function keyToDirection(key: string): Direction {
  if (key === 'ArrowUp' || key.toLowerCase() === 'w') return 'up';
  if (key === 'ArrowDown' || key.toLowerCase() === 's') return 'down';
  if (key === 'ArrowLeft' || key.toLowerCase() === 'a') return 'left';
  if (key === 'ArrowRight' || key.toLowerCase() === 'd') return 'right';
  return 'none';
}

new MsPacmanGame();
