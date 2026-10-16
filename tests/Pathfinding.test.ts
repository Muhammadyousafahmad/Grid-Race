import { describe, it, expect, beforeEach } from 'vitest';
import { Board, GridElement } from '../src/logic/Board';
import { hasPath, getShortestPath, getCandidateWalls } from '../src/logic/Pathfinding';

describe('Pathfinding & BFS hasPath', () => {
  let board: Board;

  beforeEach(() => {
    board = new Board();
  });

  it('detects unblocked paths from initial player positions', () => {
    // P1 at (16, 8) heading to row 0
    expect(hasPath(board, [16, 8], 0)).toBe(true);

    // CPU at (0, 8) heading to row 16
    expect(hasPath(board, [0, 8], 16)).toBe(true);
  });

  it('respects placed walls and finds alternative routes', () => {
    // Place horizontal wall directly ahead of P1 at intersection (15, 7)
    // Covers (15, 6), (15, 7), (15, 8), which blocks moving north from (16, 8) to (14, 8)
    board.placeWall(1, 15, 7, 'H', false);

    // Path to row 0 should still exist by stepping laterally (east or west)
    expect(hasPath(board, [16, 8], 0)).toBe(true);
  });

  it('detects when an entity is completely enclosed and blocked', () => {
    const blockedBoard = board.clone();
    (blockedBoard as any).grid[1][8] = GridElement.WALL; // South blocked
    (blockedBoard as any).grid[0][7] = GridElement.WALL; // West blocked
    (blockedBoard as any).grid[0][9] = GridElement.WALL; // East blocked

    expect(hasPath(blockedBoard, [0, 8], 16)).toBe(false);
  });
});

describe('getShortestPath', () => {
  let board: Board;

  beforeEach(() => {
    board = new Board();
  });

  it('returns the exact array of coordinates representing the shortest route', () => {
    const path = getShortestPath(board, [16, 8], 0);

    // Initial board with no walls: straight line north takes 8 steps = 9 coordinates
    expect(path.length).toBe(9);
    expect(path[0]).toEqual([16, 8]);
    expect(path[path.length - 1][0]).toBe(0);

    // Ensure consecutive coordinates are valid orthogonal moves of distance 2
    for (let i = 0; i < path.length - 1; i++) {
      const [r1, c1] = path[i];
      const [r2, c2] = path[i + 1];
      const dist = Math.abs(r1 - r2) + Math.abs(c1 - c2);
      expect(dist).toBe(2);
    }
  });

  it('returns [start] when already at target row', () => {
    const path = getShortestPath(board, [0, 8], 0);
    expect(path).toEqual([[0, 8]]);
  });

  it('returns empty array when target row is unreachable', () => {
    const blockedBoard = board.clone();
    (blockedBoard as any).grid[1][8] = GridElement.WALL;
    (blockedBoard as any).grid[0][7] = GridElement.WALL;
    (blockedBoard as any).grid[0][9] = GridElement.WALL;

    const path = getShortestPath(blockedBoard, [0, 8], 16);
    expect(path).toEqual([]);
  });

  it('navigates around walls using BFS parent tracking', () => {
    // Block direct route north from (16, 8) with horizontal wall at (15, 7)
    board.placeWall(1, 15, 7, 'H', false);

    const path = getShortestPath(board, [16, 8], 0);
    expect(path.length).toBeGreaterThan(9); // Detour takes extra steps
    expect(path[0]).toEqual([16, 8]);
    expect(path[path.length - 1][0]).toBe(0);

    // Verify it does not step directly to (14, 8) through the wall at (15, 8)
    expect(path[1]).not.toEqual([14, 8]);
  });
});

describe('getCandidateWalls & Filtering', () => {
  let board: Board;

  beforeEach(() => {
    board = new Board();
  });

  it('returns empty array if opponentPath is empty', () => {
    const candidates = getCandidateWalls(board, []);
    expect(candidates).toEqual([]);
  });

  it('returns a focused array of viable candidate walls adjacent to opponentPath', () => {
    // P1 shortest path heading to row 0
    const p1Path = getShortestPath(board, [16, 8], 0);
    expect(p1Path.length).toBe(9);

    const candidates = getCandidateWalls(board, p1Path);

    // Focused subset: far less than full 128 wall scan (8x8x2 = 128)
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThan(50);

    // Verify every candidate returned is legal
    for (const wall of candidates) {
      // Must be available on board (not overlapping/out of bounds)
      expect(board.isWallSlotAvailable(wall.row, wall.col, wall.orientation, false)).toBe(true);

      // Must be odd intersection indices
      expect(wall.row % 2).toBe(1);
      expect(wall.col % 2).toBe(1);
    }
  });

  it('filters out walls that overlap or intersect existing placed walls', () => {
    const p1Path = getShortestPath(board, [16, 8], 0);

    // Place a horizontal wall at (15, 7)
    board.placeWall(1, 15, 7, 'H', false);

    const candidates = getCandidateWalls(board, p1Path);

    // (15, 7, 'H') cannot be a candidate (exact match)
    const exactMatch = candidates.find(
      (w) => w.row === 15 && w.col === 7 && w.orientation === 'H'
    );
    expect(exactMatch).toBeUndefined();

    // (15, 7, 'V') cannot be a candidate (intersection crossing)
    const crossMatch = candidates.find(
      (w) => w.row === 15 && w.col === 7 && w.orientation === 'V'
    );
    expect(crossMatch).toBeUndefined();

    // (15, 5, 'H') cannot be a candidate (shares segment 15, 6)
    const overlapMatch = candidates.find(
      (w) => w.row === 15 && w.col === 5 && w.orientation === 'H'
    );
    expect(overlapMatch).toBeUndefined();
  });

  it('filters out walls that fail the full blockade check', () => {
    // Move P1 to (16, 0) - goal row is 0
    (board as any).players[1].position = { row: 16, col: 0 };
    (board as any).grid[16][8] = GridElement.EMPTY;
    (board as any).grid[16][0] = GridElement.PLAYER_1;

    // Place horizontal wall at (15, 1), which blocks North moves from (16, 0) and (16, 2)
    board.placeWall(2, 15, 1, 'H', false);

    // P1's current path from (16, 0) to goal row 0
    const p1Path = getShortestPath(board, [16, 0], 0);
    expect(p1Path.length).toBeGreaterThan(0);

    // Placing vertical wall at (15, 3) would completely trap P1 in {(16,0), (16,2)}
    // getCandidateWalls MUST filter it out!
    const candidates = getCandidateWalls(board, p1Path);
    const trappingWall = candidates.find(
      (w) => w.row === 15 && w.col === 3 && w.orientation === 'V'
    );
    expect(trappingWall).toBeUndefined();

    // Any candidate returned must preserve open paths for both players
    for (const wall of candidates) {
      const rollback = board.speculativePlaceWall(wall.row, wall.col, wall.orientation);
      expect(rollback).not.toBeNull();

      expect(hasPath(board, [16, 0], 0)).toBe(true);
      expect(hasPath(board, [0, 8], 16)).toBe(true);

      rollback!();
    }
  });
});

describe('Wall Placement & Strict Blockade Rule', () => {
  let board: Board;

  beforeEach(() => {
    board = new Board();
  });

  it('spans 3 matrix units covering two cell borders and intersection', () => {
    const hSegments = board.getWallSegments(1, 1, 'H');
    expect(hSegments).toEqual([
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 }
    ]);

    const vSegments = board.getWallSegments(1, 1, 'V');
    expect(vSegments).toEqual([
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 2, col: 1 }
    ]);
  });

  it('prevents walls from intersecting or overlapping', () => {
    const placed = board.placeWall(1, 3, 3, 'H');
    expect(placed).toBe(true);

    expect(board.isWallSlotAvailable(3, 3, 'V')).toBe(false);
    expect(board.isWallSlotAvailable(3, 3, 'H')).toBe(false);
    expect(board.isWallSlotAvailable(3, 1, 'H')).toBe(false);
  });

  it('speculatively places wall, tests blockade, and rolls back if path is blocked', () => {
    (board as any).players[2].position = { row: 0, col: 0 };
    (board as any).grid[0][8] = GridElement.EMPTY;
    (board as any).grid[0][0] = GridElement.PLAYER_2;

    const wall1Placed = board.placeWall(1, 1, 1, 'H', false);
    expect(wall1Placed).toBe(true);
    expect(hasPath(board, [0, 0], 16)).toBe(true);

    const rollback = board.speculativePlaceWall(1, 3, 'V');
    expect(rollback).not.toBeNull();
    expect(hasPath(board, [0, 0], 16)).toBe(false);

    rollback!();
    expect(hasPath(board, [0, 0], 16)).toBe(true);
  });

  it('permanently commits wall and decrements inventory when valid', () => {
    const initialWalls = board.getWallsRemaining(1);
    expect(initialWalls).toBe(5);

    const rollback = board.speculativePlaceWall(7, 7, 'H');
    expect(rollback).not.toBeNull();

    expect(hasPath(board, [16, 8], 0)).toBe(true);
    expect(hasPath(board, [0, 8], 16)).toBe(true);

    const committed = board.commitWall(1, 7, 7, 'H');
    expect(committed).toBe(true);
    expect(board.getWallsRemaining(1)).toBe(4);
    expect(board.getActiveWalls().length).toBe(1);
  });
});
