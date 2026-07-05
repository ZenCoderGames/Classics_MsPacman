import './styles.css';
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
  chooseDirectionToward,
  createMazeDefinition,
  getGhostTarget,
  getMazeIdForLevel,
  isPassable,
  legalDirections,
  levelTuning,
  scoreForFruit,
  squaredDistance,
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

type FloatingScore = {
  x: number;
  y: number;
  text: string;
  timer: number;
  duration: number;
};

const GHOST_KILL_FREEZE_SECONDS = config.timing.ghostKillFreezeSeconds;
const GHOST_KILL_SHAKE_SECONDS = config.timing.ghostKillShakeSeconds;
const GHOST_RESPAWN_WAIT_SECONDS = config.timing.ghostRespawnWaitSeconds;
const PLAYER_DEATH_FREEZE_SECONDS = config.timing.playerDeathFreezeSeconds;
const PLAYER_DEATH_SHAKE_SECONDS = config.timing.playerDeathShakeSeconds;
const WALL_OUTLINE_COLOR = config.render.wallOutlineColor;
const WALL_INNER_COLOR = config.render.wallInnerColor;
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

function drawText(text: string, x: number, y: number, align: CanvasTextAlign = 'center'): void {
  ctx.fillStyle = '#fff8c4';
  ctx.font = '8px "Courier New", monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function getShakeOffset(timer: number, duration: number): { x: number; y: number } {
  if (timer <= 0) return { x: 0, y: 0 };
  const elapsed = duration - timer;
  const progress = Math.min(1, elapsed / duration);
  const amplitude = config.shake.amplitude * (1 - progress);
  return {
    x: Math.sin(elapsed * config.shake.xFrequency) * amplitude,
    y: Math.cos(elapsed * config.shake.yFrequency) * amplitude * config.shake.yScale,
  };
}

function drawRoundedWallRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number },
): void {
  const topLeft = Math.min(radii.topLeft, width / 2, height / 2);
  const topRight = Math.min(radii.topRight, width / 2, height / 2);
  const bottomRight = Math.min(radii.bottomRight, width / 2, height / 2);
  const bottomLeft = Math.min(radii.bottomLeft, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + topLeft, y);
  ctx.lineTo(x + width - topRight, y);

  if (topRight > 0) {
    ctx.arc(x + width - topRight, y + topRight, topRight, -Math.PI / 2, 0);
  } else {
    ctx.lineTo(x + width, y);
  }

  ctx.lineTo(x + width, y + height - bottomRight);

  if (bottomRight > 0) {
    ctx.arc(x + width - bottomRight, y + height - bottomRight, bottomRight, 0, Math.PI / 2);
  } else {
    ctx.lineTo(x + width, y + height);
  }

  ctx.lineTo(x + bottomLeft, y + height);

  if (bottomLeft > 0) {
    ctx.arc(x + bottomLeft, y + height - bottomLeft, bottomLeft, Math.PI / 2, Math.PI);
  } else {
    ctx.lineTo(x, y + height);
  }

  ctx.lineTo(x, y + topLeft);

  if (topLeft > 0) {
    ctx.arc(x + topLeft, y + topLeft, topLeft, Math.PI, (3 * Math.PI) / 2);
  } else {
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
}

class ArcadeAudio {
  private audioContext: AudioContext | null = null;
  private muted = false;

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  beep(
    frequency: number,
    duration = config.audio.defaultBeepDuration,
    type: OscillatorType = 'square',
    gain = config.audio.defaultBeepGain,
  ): void {
    if (this.muted) return;
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
  private ghostKillEffects = new Map<GhostId, GhostKillEffect>();
  private playerDeathFlashTimer = 0;
  private playerDeathShakeTimer = 0;
  private floatingScores: FloatingScore[] = [];
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
    this.audio.beep(config.audio.start.frequency, config.audio.start.duration, config.audio.start.type as OscillatorType);
  }

  togglePause(): void {
    if (this.status === 'playing') {
      this.status = 'paused';
    } else if (this.status === 'paused') {
      this.status = 'playing';
    }
    this.showOverlays();
  }

  private bindEvents(): void {
    playBtn.addEventListener('click', () => this.startNewGame());
    restartBtn.addEventListener('click', () => this.startNewGame());
    soundBtn.addEventListener('click', () => this.toggleMute());

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
      if (this.readyTimer <= 0) this.status = 'playing';
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
          this.readyTimer = config.timing.lifeRestartReadySeconds;
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

    if (this.ghostKillFreezeTimer > 0) {
      this.ghostKillFreezeTimer = Math.max(0, this.ghostKillFreezeTimer - delta);
      this.ghostKillShakeTimer = Math.max(0, this.ghostKillShakeTimer - delta);
      this.updateGhostKillEffects(delta);
      this.updateHud();
      return;
    }

    this.updateGhostKillEffects(delta);
    this.ghostKillShakeTimer = Math.max(0, this.ghostKillShakeTimer - delta);

    const tuning = levelTuning(this.level);
    this.player.speed = tuning.playerSpeed;
    this.updateModeTimers(delta);
    this.movePlayer(delta);
    this.updateGhosts(delta);
    this.updateFruit(delta);
    this.collectPellets();
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
        if (ghost.mode === 'scatter' || ghost.mode === 'chase' || ghost.mode === 'frightened') {
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
    this.readyTimer = config.timing.readySeconds;
    this.status = 'ready';
    this.fruit = null;
    this.fruitSpawnedAt.clear();
    this.ghostKillEffects.clear();
    this.ghostKillFreezeTimer = 0;
    this.ghostKillShakeTimer = 0;
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
    this.ghostKillEffects.clear();
    this.ghostKillFreezeTimer = 0;
    this.ghostKillShakeTimer = 0;
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
      if (ghost.mode === 'eatenFlash') continue;

      if (ghost.mode === 'respawning') {
        ghost.releaseDelay = Math.max(0, ghost.releaseDelay - delta);
        if (ghost.releaseDelay > 0) continue;

        ghost.mode = this.currentGhostMode;
        ghost.direction = 'left';
      }

      ghost.releaseDelay = Math.max(0, ghost.releaseDelay - delta);
      if (ghost.releaseDelay > 0 && ghost.id !== 'blinky') continue;

      if (ghost.mode === 'eyes' && squaredDistance(ghost.tile, ghost.home) <= 1) {
        ghost.tile = { ...ghost.home };
        ghost.pixel = tileCenter(ghost.home);
        ghost.direction = 'none';
        ghost.mode = 'respawning';
        ghost.releaseDelay = GHOST_RESPAWN_WAIT_SECONDS;
        continue;
      }

      const speed =
        ghost.mode === 'eyes'
          ? tuning.eyesSpeed
          : ghost.mode === 'frightened'
            ? tuning.frightenedSpeed
            : tuning.ghostSpeed +
              (ghost.id === 'blinky' && this.pellets.size < config.movement.blinkyElroyPelletThreshold
                ? config.movement.blinkyElroySpeedBonus
                : 0);

      this.moveActor(ghost, delta, speed, false, (actor, tile) => {
        const currentGhost = actor as Ghost;

        if (currentGhost.mode !== 'eyes' && this.isGhostInSpawnArea(tile)) {
          currentGhost.direction = chooseDirectionToward(this.maze, tile, currentGhost.direction, GHOST_EXIT_TILE, true);
          return;
        }

        if (currentGhost.mode === 'frightened') {
          currentGhost.direction = this.chooseRandomGhostDirection(currentGhost, tile);
          return;
        }

        const target =
          currentGhost.mode === 'eyes'
            ? currentGhost.home
            : this.currentGhostMode === 'scatter'
              ? this.maze.scatterTargets[currentGhost.id]
              : getGhostTarget(currentGhost, this.player, blinky.tile, this.maze.scatterTargets);

        currentGhost.direction = chooseDirectionToward(
          this.maze,
          tile,
          currentGhost.direction,
          target,
          currentGhost.mode === 'eyes',
        );
      });
    }
  }

  private updateGhostKillEffects(delta: number): void {
    for (const [ghostId, effect] of this.ghostKillEffects) {
      effect.timer = Math.max(0, effect.timer - delta);
      if (effect.timer > 0) continue;

      const ghost = this.ghosts.find((candidate) => candidate.id === ghostId);
      if (ghost && ghost.mode === 'eatenFlash') {
        ghost.mode = 'eyes';
      }

      this.ghostKillEffects.delete(ghostId);
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
    const area = config.movement.playerBlockedArea;
    const inGhostHouse = tile.x >= area.minX && tile.x <= area.maxX && tile.y >= area.minY && tile.y <= area.maxY;
    return !inGhostHouse && isPassable(this.maze, tile);
  }

  private isGhostInSpawnArea(tile: TileCoord): boolean {
    const area = config.movement.ghostSpawnArea;
    return tile.x >= area.minX && tile.x <= area.maxX && tile.y >= area.minY && tile.y <= area.maxY;
  }

  private collectPellets(): void {
    const key = tileKey(this.player.tile);
    if (this.pellets.delete(key)) {
      this.addScore(config.scoring.pellet);
      this.spawnScorePopup(config.scoring.pellet);
      this.pelletsEaten += 1;
      this.audio.beep(
        config.audio.pellet.baseFrequency + (this.pelletsEaten % 2) * config.audio.pellet.alternateFrequencyOffset,
        config.audio.pellet.duration,
        config.audio.pellet.type as OscillatorType,
        config.audio.pellet.gain,
      );
    }

    if (this.powerPellets.delete(key)) {
      this.addScore(config.scoring.powerPellet);
      this.pelletsEaten += 1;
      this.triggerFrightened();
    }

    this.maybeSpawnFruit();

    if (this.pellets.size === 0 && this.powerPellets.size === 0) {
      this.status = 'levelClear';
      this.stateTimer = config.timing.readySeconds;
      this.audio.beep(
        config.audio.levelClear.frequency,
        config.audio.levelClear.duration,
        config.audio.levelClear.type as OscillatorType,
        config.audio.levelClear.gain,
      );
    }
  }

  private spawnScorePopup(points: number): void {
    const center = tileCenter(this.player.tile);
    this.floatingScores.push({
      x: center.x,
      y: center.y,
      text: String(points),
      timer: config.render.scorePopupDuration,
      duration: config.render.scorePopupDuration,
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
    this.audio.beep(
      config.audio.powerPellet.frequency,
      config.audio.powerPellet.duration,
      config.audio.powerPellet.type as OscillatorType,
      config.audio.powerPellet.gain,
    );
  }

  private maybeSpawnFruit(): void {
    const thresholds = config.fruit.spawnThresholds;
    const threshold = thresholds.find((value) => this.pelletsEaten >= value && !this.fruitSpawnedAt.has(value));
    if (!threshold || this.fruit?.active) return;

    this.fruitSpawnedAt.add(threshold);
    const fruitScore = scoreForFruit(this.level);
    const spawn = config.fruit.spawnTile;
    this.fruit = {
      active: true,
      tile: spawn,
      pixel: tileCenter(spawn),
      direction: 'right',
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
        this.addScore(scores[Math.min(this.ghostChain, scores.length - 1)]);
        this.ghostChain += 1;
        ghost.mode = 'eatenFlash';
        ghost.direction = OPPOSITE[ghost.direction];
        this.ghostKillFreezeTimer = GHOST_KILL_FREEZE_SECONDS;
        this.ghostKillShakeTimer = GHOST_KILL_SHAKE_SECONDS;
        this.ghostKillEffects.set(ghost.id, {
          timer: GHOST_KILL_FREEZE_SECONDS,
          duration: GHOST_KILL_FREEZE_SECONDS,
        });
        this.audio.beep(
          config.audio.ghostEaten.baseFrequency + this.ghostChain * config.audio.ghostEaten.chainFrequencyStep,
          config.audio.ghostEaten.duration,
          config.audio.ghostEaten.type as OscillatorType,
          config.audio.ghostEaten.gain,
        );
      } else if (ghost.mode !== 'eyes' && ghost.mode !== 'eatenFlash' && ghost.mode !== 'respawning') {
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
      this.audio.beep(
        config.audio.fruitEaten.frequency,
        config.audio.fruitEaten.duration,
        config.audio.fruitEaten.type as OscillatorType,
        config.audio.fruitEaten.gain,
      );
      this.fruit.active = false;
    }
  }

  private loseLife(): void {
    this.lives -= 1;
    this.status = 'lifeLost';
    this.stateTimer = PLAYER_DEATH_FREEZE_SECONDS;
    this.playerDeathFlashTimer = PLAYER_DEATH_FREEZE_SECONDS;
    this.playerDeathShakeTimer = PLAYER_DEATH_SHAKE_SECONDS;
    this.audio.beep(
      config.audio.playerDeath.frequency,
      config.audio.playerDeath.duration,
      config.audio.playerDeath.type as OscillatorType,
      config.audio.playerDeath.gain,
    );
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
    menuOverlay.classList.toggle('hidden', this.status !== 'menu' && this.status !== 'ready');
    pauseOverlay.classList.toggle('hidden', this.status !== 'paused');
    gameOverOverlay.classList.toggle('hidden', this.status !== 'gameOver');
    if (this.status === 'ready') {
      menuOverlay.querySelector('.prompt-title')!.textContent = 'READY!';
      playBtn.classList.add('hidden');
    } else {
      menuOverlay.querySelector('.prompt-title')!.textContent = 'READY!';
      playBtn.classList.remove('hidden');
    }
  }

  private render(): void {
    ctx.fillStyle = '#00000a';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    const ghostShake = getShakeOffset(this.ghostKillShakeTimer, GHOST_KILL_SHAKE_SECONDS);
    const playerShake = getShakeOffset(this.playerDeathShakeTimer, PLAYER_DEATH_SHAKE_SECONDS);

    ctx.save();
    ctx.translate(ghostShake.x + playerShake.x, ghostShake.y + playerShake.y);
    this.drawMaze();
    this.drawPellets();
    if (this.fruit?.active) this.drawFruit(this.fruit);
    for (const ghost of this.ghosts) this.drawGhostSprite(ghost);
    this.drawPlayer();
    this.drawFloatingScores();

    if (this.status === 'ready') drawText('READY!', LOGICAL_WIDTH / 2, HUD_HEIGHT + 17 * TILE_SIZE, 'center');
    if (this.status === 'levelClear') drawText('LEVEL CLEAR', LOGICAL_WIDTH / 2, HUD_HEIGHT + 17 * TILE_SIZE, 'center');
    ctx.restore();
  }

  private drawMaze(): void {
    ctx.save();
    ctx.shadowColor = WALL_GLOW_COLOR;
    ctx.shadowBlur = 5;
    ctx.fillStyle = WALL_OUTLINE_COLOR;
    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      for (let x = 0; x < GRID_WIDTH; x += 1) {
        if (this.maze.passable[y][x]) continue;
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE + HUD_HEIGHT;
        drawRoundedWallRect(px, py, TILE_SIZE, TILE_SIZE, this.getWallCornerRadii(x, y, config.render.wallOuterCornerRadius));
      }
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = config.render.wallInnerGlowColor;
    ctx.shadowBlur = 2;
    ctx.fillStyle = WALL_INNER_COLOR;
    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      for (let x = 0; x < GRID_WIDTH; x += 1) {
        if (!this.isWallTile(x, y)) continue;

        const inset = config.render.wallInset;
        const leftInset = this.isWallTile(x - 1, y) ? 0 : inset;
        const rightInset = this.isWallTile(x + 1, y) ? 0 : inset;
        const topInset = this.isWallTile(x, y - 1) ? 0 : inset;
        const bottomInset = this.isWallTile(x, y + 1) ? 0 : inset;
        const px = x * TILE_SIZE + leftInset;
        const py = y * TILE_SIZE + HUD_HEIGHT + topInset;
        const width = TILE_SIZE - leftInset - rightInset;
        const height = TILE_SIZE - topInset - bottomInset;

        if (width > 0 && height > 0) {
          drawRoundedWallRect(px, py, width, height, this.getWallCornerRadii(x, y, config.render.wallInnerCornerRadius));
        }
      }
    }
    ctx.restore();

  }

  private isWallTile(x: number, y: number): boolean {
    return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT && !this.maze.passable[y][x];
  }

  private getWallCornerRadii(
    x: number,
    y: number,
    radius: number,
  ): { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number } {
    return {
      topLeft: this.isOuterWallCorner(x - 1, y, x, y - 1, x - 1, y - 1) ? radius : 0,
      topRight: this.isOuterWallCorner(x + 1, y, x, y - 1, x + 1, y - 1) ? radius : 0,
      bottomRight: this.isOuterWallCorner(x + 1, y, x, y + 1, x + 1, y + 1) ? radius : 0,
      bottomLeft: this.isOuterWallCorner(x - 1, y, x, y + 1, x - 1, y + 1) ? radius : 0,
    };
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
      const alpha = Math.min(1, popup.timer / (popup.duration * 0.35));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = config.render.scorePopupColor;
      ctx.font = `${config.render.scorePopupFontSize}px "Courier New", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(popup.text, popup.x, popup.y);
      ctx.restore();
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

    if (!sprite.complete || sprite.naturalWidth === 0) {
      return;
    }

    ctx.save();
    ctx.translate(this.player.pixel.x, this.player.pixel.y);
    this.applyPlayerSpriteTransform();
    ctx.filter = deathFlashOn ? config.render.deathFlashFilter : 'none';
    drawScaledSprite(sprite, 0, 0, PLAYER_SPRITE_SIZE, config.render.playerScale);
    ctx.restore();
  }

  private applyPlayerSpriteTransform(): void {
    if (this.player.direction === 'left') {
      ctx.scale(-1, 1);
      return;
    }

    if (this.player.direction === 'up') {
      ctx.rotate(-Math.PI / 2);
      return;
    }

    if (this.player.direction === 'down') {
      ctx.rotate(Math.PI / 2);
    }
  }

  private drawGhostSprite(ghost: Ghost): void {
    const direction = ghost.direction === 'none' ? 'down' : ghost.direction;
    const sprite = ghostSprites[ghost.id][direction];
    if (!sprite.complete || sprite.naturalWidth === 0) {
      return;
    }

    const frightenedFlashOn =
      ghost.mode === 'frightened' &&
      Math.floor(performance.now() / config.timing.frightenedFlashMs) % 2 === 0;
    const killEffect = this.ghostKillEffects.get(ghost.id);
    const killFlashOn = killEffect
      ? Math.floor((killEffect.duration - killEffect.timer) / config.timing.flashIntervalSeconds) % 2 === 0
      : false;

    let filter = 'none';
    if (ghost.mode === 'eyes') {
      filter = 'brightness(3) saturate(0)';
    } else if (ghost.mode === 'eatenFlash') {
      filter = killFlashOn ? 'brightness(3) saturate(0)' : 'hue-rotate(200deg) saturate(2.5) brightness(0.9)';
    } else if (ghost.mode === 'frightened') {
      filter = frightenedFlashOn ? config.render.frightenedGhostFlashFilter : config.render.frightenedGhostFilter;
    }

    ctx.save();
    ctx.filter = filter;
    drawScaledSprite(sprite, ghost.pixel.x, ghost.pixel.y, config.render.ghostSpriteSize, config.render.ghostScale);
    ctx.restore();
  }

  private drawFruit(fruit: Fruit): void {
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
