import { describe, expect, it } from 'vitest';
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  chooseDirectionOnShortestPath,
  chooseDirectionToward,
  createMazeDefinition,
  findShortestPath,
  getGhostTarget,
  getMazeIdForLevel,
  isPassable,
  isPlayerPassable,
  scoreForFruit,
  wrapTile,
} from './gameLogic';

describe('maze rotation', () => {
  it('uses the planned level-to-maze schedule', () => {
    expect(getMazeIdForLevel(1)).toBe('A');
    expect(getMazeIdForLevel(2)).toBe('A');
    expect(getMazeIdForLevel(3)).toBe('B');
    expect(getMazeIdForLevel(6)).toBe('C');
    expect(getMazeIdForLevel(10)).toBe('D');
    expect(getMazeIdForLevel(14)).toBe('C');
    expect(getMazeIdForLevel(18)).toBe('D');
  });
});

describe('maze generation', () => {
  it('creates a 28 by 31 playable grid with pellets and power pellets', () => {
    const maze = createMazeDefinition('A');

    expect(maze.passable).toHaveLength(GRID_HEIGHT);
    expect(maze.passable.every((row) => row.length === GRID_WIDTH)).toBe(true);
    expect(maze.pellets.length).toBeGreaterThan(100);
    expect(maze.powerPellets).toHaveLength(4);
    expect(maze.passable[maze.playerSpawn.y][maze.playerSpawn.x]).toBe(true);
  });
});

describe('fruit score table', () => {
  it('matches the GDD progression', () => {
    expect(scoreForFruit(1)).toMatchObject({ name: 'Cherry', points: 100 });
    expect(scoreForFruit(2)).toMatchObject({ name: 'Strawberry', points: 200 });
    expect(scoreForFruit(4)).toMatchObject({ name: 'Orange', points: 500 });
    expect(scoreForFruit(6)).toMatchObject({ name: 'Pretzel', points: 700 });
    expect(scoreForFruit(8)).toMatchObject({ name: 'Apple', points: 1000 });
    expect(scoreForFruit(10)).toMatchObject({ name: 'Pear', points: 2000 });
    expect(scoreForFruit(11)).toMatchObject({ name: 'Banana', points: 5000 });
  });
});

describe('ghost house passability', () => {
  const maze = createMazeDefinition('A');

  it('blocks only ghost-house interior cells for the player', () => {
    expect(isPlayerPassable(maze, maze.ghostSpawns.blinky)).toBe(false);
    expect(isPlayerPassable(maze, { x: 13, y: 13 })).toBe(false);
    expect(isPlayerPassable(maze, { x: 18, y: 12 })).toBe(true);
    expect(isPlayerPassable(maze, { x: 18, y: 13 })).toBe(true);
    expect(isPlayerPassable(maze, { x: 19, y: 14 })).toBe(true);
    expect(isPlayerPassable(maze, { x: 5, y: 14 })).toBe(true);
    expect(isPlayerPassable(maze, maze.playerSpawn)).toBe(true);
  });
});

describe('edge wrapping', () => {
  const maze = createMazeDefinition('A');
  const tunnelRow = 14;

  it('allows moving off-grid through passable edge cells', () => {
    expect(isPassable(maze, { x: -1, y: tunnelRow })).toBe(true);
    expect(isPassable(maze, { x: GRID_WIDTH, y: tunnelRow })).toBe(true);
  });

  it('blocks moving off-grid through wall edge cells', () => {
    expect(isPassable(maze, { x: -1, y: 0 })).toBe(false);
    expect(isPassable(maze, { x: GRID_WIDTH, y: 0 })).toBe(false);
    expect(isPassable(maze, { x: 0, y: -1 })).toBe(false);
    expect(isPassable(maze, { x: 0, y: GRID_HEIGHT })).toBe(false);
  });

  it('teleports to the opposite side of the maze', () => {
    expect(wrapTile({ x: -1, y: tunnelRow })).toEqual({ x: GRID_WIDTH - 1, y: tunnelRow });
    expect(wrapTile({ x: GRID_WIDTH, y: tunnelRow })).toEqual({ x: 0, y: tunnelRow });
  });
});

describe('ghost targeting', () => {
  const maze = createMazeDefinition('A');
  const player = { tile: { x: 10, y: 10 }, direction: 'right' as const };

  it('targets Blinky directly at the player', () => {
    const target = getGhostTarget(
      { id: 'blinky', tile: { x: 1, y: 1 }, direction: 'left' },
      player,
      { x: 1, y: 1 },
      maze.scatterTargets,
    );

    expect(target).toEqual(player.tile);
  });

  it('targets Pinky ahead of the player', () => {
    const target = getGhostTarget(
      { id: 'pinky', tile: { x: 1, y: 1 }, direction: 'left' },
      player,
      { x: 1, y: 1 },
      maze.scatterTargets,
    );

    expect(target).toEqual({ x: 14, y: 10 });
  });

  it('uses Sue scatter behavior when close', () => {
    const target = getGhostTarget(
      { id: 'sue', tile: { x: 11, y: 10 }, direction: 'left' },
      player,
      { x: 1, y: 1 },
      maze.scatterTargets,
    );

    expect(target).toEqual(maze.scatterTargets.sue);
  });
});

describe('eyes pathfinding', () => {
  it('finds an A* route from the maze back to the ghost spawn', () => {
    const maze = createMazeDefinition('A');
    const start = { x: 1, y: 1 };
    const home = maze.ghostSpawns.blinky;
    const path = findShortestPath(maze, start, home);

    expect(path.length).toBeGreaterThan(1);
    expect(path[0]).toEqual(start);
    expect(path[path.length - 1]).toEqual(home);
  });

  it('chooses the first step along the shortest path', () => {
    const maze = createMazeDefinition('A');
    const start = { x: 1, y: 1 };
    const home = maze.ghostSpawns.blinky;
    const path = findShortestPath(maze, start, home);
    const direction = chooseDirectionOnShortestPath(maze, start, 'left', home, true);

    expect(path.length).toBeGreaterThan(1);
    expect(direction).not.toBe('none');
  });
});

describe('direction choice', () => {
  it('chooses a legal direction that moves closer to the target', () => {
    const maze = createMazeDefinition('A');
    const direction = chooseDirectionToward(maze, { x: 6, y: 8 }, 'left', { x: 6, y: 1 }, false);

    expect(direction).toBe('up');
  });
});
