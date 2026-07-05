import levelA from './levels/levelA.txt?raw';
import levelB from './levels/levelB.txt?raw';
import levelC from './levels/levelC.txt?raw';
import levelD from './levels/levelD.txt?raw';
import config from './config.json';

export const GRID_WIDTH = config.grid.width;
export const GRID_HEIGHT = config.grid.height;
export const TILE_SIZE = config.grid.tileSize;
export const HUD_HEIGHT = config.grid.hudHeight;
export const LOGICAL_WIDTH = GRID_WIDTH * TILE_SIZE;
export const LOGICAL_HEIGHT = GRID_HEIGHT * TILE_SIZE + HUD_HEIGHT;

export type MazeId = 'A' | 'B' | 'C' | 'D';
export type Direction = 'up' | 'down' | 'left' | 'right' | 'none';
export type GhostId = 'blinky' | 'pinky' | 'inky' | 'sue';
export type GhostMode = 'scatter' | 'chase' | 'frightened' | 'eatenFlash' | 'eyes' | 'respawning';

export type TileCoord = {
  x: number;
  y: number;
};

export type MazeDefinition = {
  id: MazeId;
  wallColor: string;
  passable: boolean[][];
  playerSpawn: TileCoord;
  ghostSpawns: Record<GhostId, TileCoord>;
  scatterTargets: Record<GhostId, TileCoord>;
  pellets: TileCoord[];
  powerPellets: TileCoord[];
};

export type EntityLike = {
  tile: TileCoord;
  direction: Direction;
};

export type GhostLike = EntityLike & {
  id: GhostId;
};

const MAZE_COLORS: Record<MazeId, string> = config.mazeColors;

const LEVEL_MAPS: Record<MazeId, string> = {
  A: levelA,
  B: levelB,
  C: levelC,
  D: levelD,
};

const GHOST_SPAWN_ORDER: GhostId[] = ['blinky', 'pinky', 'inky', 'sue'];

export const DIRECTIONS: Direction[] = ['up', 'left', 'down', 'right'];

export const DIRECTION_VECTORS: Record<Direction, TileCoord> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
  none: 'none',
};

export function tileKey(tile: TileCoord): string {
  return `${tile.x},${tile.y}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function squaredDistance(a: TileCoord, b: TileCoord): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function getMazeIdForLevel(level: number): MazeId {
  if (level <= config.mazeRotation.AUntil) return 'A';
  if (level <= config.mazeRotation.BUntil) return 'B';
  if (level <= config.mazeRotation.CUntil) return 'C';
  if (level <= config.mazeRotation.DUntil) return 'D';
  return Math.floor((level - config.mazeRotation.repeatStart) / config.mazeRotation.repeatGroupSize) % 2 === 0 ? 'C' : 'D';
}

export function scoreForFruit(level: number): { name: string; points: number; color: string } {
  return config.fruit.table.find((entry) => level <= entry.maxLevel) ?? config.fruit.table[config.fruit.table.length - 1];
}

export function levelTuning(level: number): {
  playerSpeed: number;
  ghostSpeed: number;
  frightenedSpeed: number;
  eyesSpeed: number;
  frightenedDuration: number;
} {
  const ramp = Math.min(level - 1, config.levelTuning.ghostRampMaxLevels);
  return {
    playerSpeed:
      config.levelTuning.playerBaseSpeed +
      Math.min(level - 1, config.levelTuning.playerRampMaxLevels) * config.levelTuning.playerRampPerLevel,
    ghostSpeed: config.levelTuning.ghostBaseSpeed + ramp * config.levelTuning.ghostRampPerLevel,
    frightenedSpeed: Math.max(
      config.levelTuning.frightenedMinSpeed,
      config.levelTuning.frightenedBaseSpeed - ramp * config.levelTuning.frightenedSpeedLossPerLevel,
    ),
    eyesSpeed: config.levelTuning.eyesSpeed,
    frightenedDuration: Math.max(
      0,
      config.levelTuning.frightenedBaseDuration -
        Math.floor((level - 1) / config.levelTuning.frightenedDurationLossEveryLevels),
    ),
  };
}

export function createMazeDefinition(id: MazeId): MazeDefinition {
  const rows = parseLevelRows(LEVEL_MAPS[id], id);
  const passable = Array.from({ length: GRID_HEIGHT }, () => Array(GRID_WIDTH).fill(false) as boolean[]);
  const pellets: TileCoord[] = [];
  const powerPellets: TileCoord[] = [];
  const ghostSpawns: Record<GhostId, TileCoord> = {
    blinky: config.defaultSpawns.ghosts.blinky,
    pinky: config.defaultSpawns.ghosts.pinky,
    inky: config.defaultSpawns.ghosts.inky,
    sue: config.defaultSpawns.ghosts.sue,
  };
  let playerSpawn: TileCoord = config.defaultSpawns.player;
  let enemySpawnIndex = 0;

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const cell = rows[y][x];
      passable[y][x] = cell !== config.levelSymbols.wall;

      if (cell === config.levelSymbols.food) {
        pellets.push({ x, y });
      } else if (cell === config.levelSymbols.powerFood) {
        powerPellets.push({ x, y });
      } else if (cell === config.levelSymbols.playerSpawn) {
        playerSpawn = { x, y };
      } else if (cell === config.levelSymbols.enemySpawn) {
        const ghostId = GHOST_SPAWN_ORDER[Math.min(enemySpawnIndex, GHOST_SPAWN_ORDER.length - 1)];
        ghostSpawns[ghostId] = { x, y };
        enemySpawnIndex += 1;
      }
    }
  }

  return {
    id,
    wallColor: MAZE_COLORS[id],
    passable,
    playerSpawn,
    ghostSpawns,
    scatterTargets: {
      blinky: config.scatterTargets.blinky,
      pinky: config.scatterTargets.pinky,
      inky: config.scatterTargets.inky,
      sue: config.scatterTargets.sue,
    },
    pellets,
    powerPellets,
  };
}

function parseLevelRows(levelText: string, id: MazeId): string[] {
  const rows = levelText.replace(/\r/g, '').split('\n').filter((row) => row.length > 0);
  if (rows.length !== GRID_HEIGHT) {
    throw new Error(`Level ${id} must contain exactly ${GRID_HEIGHT} rows; received ${rows.length}.`);
  }

  return rows.map((row, index) => {
    if (row.length > GRID_WIDTH) {
      throw new Error(`Level ${id} row ${index + 1} must be ${GRID_WIDTH} columns or fewer; received ${row.length}.`);
    }

    return row.padEnd(GRID_WIDTH, ' ');
  });
}

export function isPassable(maze: MazeDefinition, tile: TileCoord): boolean {
  if (tile.x < 0) {
    return tile.y >= 0 && tile.y < GRID_HEIGHT && maze.passable[tile.y][0];
  }

  if (tile.x >= GRID_WIDTH) {
    return tile.y >= 0 && tile.y < GRID_HEIGHT && maze.passable[tile.y][GRID_WIDTH - 1];
  }

  if (tile.y < 0) {
    return tile.x >= 0 && tile.x < GRID_WIDTH && maze.passable[0][tile.x];
  }

  if (tile.y >= GRID_HEIGHT) {
    return tile.x >= 0 && tile.x < GRID_WIDTH && maze.passable[GRID_HEIGHT - 1][tile.x];
  }

  return maze.passable[tile.y][tile.x];
}

export function wrapTile(tile: TileCoord): TileCoord {
  if (tile.x < 0) return { x: GRID_WIDTH - 1, y: tile.y };
  if (tile.x >= GRID_WIDTH) return { x: 0, y: tile.y };
  if (tile.y < 0) return { x: tile.x, y: GRID_HEIGHT - 1 };
  if (tile.y >= GRID_HEIGHT) return { x: tile.x, y: 0 };
  return tile;
}

export function legalDirections(
  maze: MazeDefinition,
  tile: TileCoord,
  currentDirection: Direction,
  allowReverse: boolean,
): Direction[] {
  return DIRECTIONS.filter((direction) => {
    if (!allowReverse && currentDirection !== 'none' && direction === OPPOSITE[currentDirection]) {
      return false;
    }

    const vector = DIRECTION_VECTORS[direction];
    return isPassable(maze, { x: tile.x + vector.x, y: tile.y + vector.y });
  });
}

export function chooseDirectionToward(
  maze: MazeDefinition,
  tile: TileCoord,
  currentDirection: Direction,
  target: TileCoord,
  allowReverse: boolean,
): Direction {
  const options = legalDirections(maze, tile, currentDirection, allowReverse);
  const legal = options.length > 0 ? options : legalDirections(maze, tile, currentDirection, true);
  if (legal.length === 0) return 'none';

  return legal.reduce((best, direction) => {
    const vector = DIRECTION_VECTORS[direction];
    const next = { x: tile.x + vector.x, y: tile.y + vector.y };
    const bestVector = DIRECTION_VECTORS[best];
    const bestNext = { x: tile.x + bestVector.x, y: tile.y + bestVector.y };
    return squaredDistance(next, target) < squaredDistance(bestNext, target) ? direction : best;
  }, legal[0]);
}

export function getGhostTarget(
  ghost: GhostLike,
  player: EntityLike,
  blinkyTile: TileCoord,
  scatterTargets: Record<GhostId, TileCoord>,
): TileCoord {
  if (ghost.id === 'blinky') return { ...player.tile };
  if (ghost.id === 'pinky') {
    const vector = DIRECTION_VECTORS[player.direction];
    return {
      x: clamp(player.tile.x + vector.x * config.ai.pinkyAheadTiles, 0, GRID_WIDTH - 1),
      y: clamp(player.tile.y + vector.y * config.ai.pinkyAheadTiles, 0, GRID_HEIGHT - 1),
    };
  }
  if (ghost.id === 'inky') {
    const vector = DIRECTION_VECTORS[player.direction];
    const ahead = {
      x: player.tile.x + vector.x * config.ai.inkyAheadTiles,
      y: player.tile.y + vector.y * config.ai.inkyAheadTiles,
    };
    return {
      x: clamp(ahead.x + (ahead.x - blinkyTile.x), 0, GRID_WIDTH - 1),
      y: clamp(ahead.y + (ahead.y - blinkyTile.y), 0, GRID_HEIGHT - 1),
    };
  }

  return squaredDistance(ghost.tile, player.tile) > config.ai.sueScatterDistanceSquared ? { ...player.tile } : scatterTargets.sue;
}
