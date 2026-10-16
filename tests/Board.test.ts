import { describe, it, expect, beforeEach } from 'vitest';
import {
  GRID_SIZE,
  INITIAL_WALLS,
  PLAYER_1_START,
  PLAYER_1_GOAL_ROW,
  PLAYER_2_START,
  PLAYER_2_GOAL_ROW,
  isWalkableCell,
  isWallSlotOrIntersection,
  isIntersection,
  isHorizontalWallSlot,
  isVerticalWallSlot
} from '../src/config/Constants';
import { Board, GridElement } from '../src/logic/Board';

describe('Constants', () => {
  it('defines GRID_SIZE as 17', () => {
    expect(GRID_SIZE).toBe(17);
  });

  it('defines INITIAL_WALLS as 5', () => {
    expect(INITIAL_WALLS).toBe(5);
  });

  it('correctly classifies coordinate identifiers', () => {
    // Even indices are walkable cells (e.g., (0,0), (0,2), (16,16))
    expect(isWalkableCell(0, 0)).toBe(true);
    expect(isWalkableCell(16, 8)).toBe(true);
    expect(isWalkableCell(0, 8)).toBe(true);
    expect(isWalkableCell(1, 0)).toBe(false);
    expect(isWalkableCell(0, 1)).toBe(false);
    expect(isWalkableCell(1, 1)).toBe(false);

    // Odd indices are wall slots or intersections
    expect(isWallSlotOrIntersection(1, 0)).toBe(true);
    expect(isWallSlotOrIntersection(0, 1)).toBe(true);
    expect(isWallSlotOrIntersection(1, 1)).toBe(true);
    expect(isWallSlotOrIntersection(0, 0)).toBe(false);

    // Specific slot types
    expect(isHorizontalWallSlot(1, 0)).toBe(true);
    expect(isVerticalWallSlot(0, 1)).toBe(true);
    expect(isIntersection(1, 1)).toBe(true);
  });

  it('defines player starting positions and goal rows', () => {
    expect(PLAYER_1_START).toEqual({ row: 16, col: 8 });
    expect(PLAYER_1_GOAL_ROW).toBe(0);

    expect(PLAYER_2_START).toEqual({ row: 0, col: 8 });
    expect(PLAYER_2_GOAL_ROW).toBe(16);
  });
});

describe('Board Model', () => {
  let board: Board;

  beforeEach(() => {
    board = new Board();
  });

  it('initializes a 17x17 grid', () => {
    const grid = board.getGrid();
    expect(grid.length).toBe(17);
    expect(grid[0].length).toBe(17);
  });

  it('places Player 1 at (16, 8) with goal row 0 and 5 walls', () => {
    const p1 = board.getPlayer(1);
    expect(p1.position).toEqual({ row: 16, col: 8 });
    expect(p1.goalRow).toBe(0);
    expect(p1.wallsRemaining).toBe(5);

    const grid = board.getGrid();
    expect(grid[16][8]).toBe(GridElement.PLAYER_1);
  });

  it('places Player 2 at (0, 8) with goal row 16 and 5 walls', () => {
    const p2 = board.getPlayer(2);
    expect(p2.position).toEqual({ row: 0, col: 8 });
    expect(p2.goalRow).toBe(16);
    expect(p2.wallsRemaining).toBe(5);

    const grid = board.getGrid();
    expect(grid[0][8]).toBe(GridElement.PLAYER_2);
  });

  describe('canMoveToken', () => {
    it('allows valid orthogonal moves of distance 2', () => {
      // P1 starts at (16, 8). Valid moves are (14, 8), (16, 6), (16, 10)
      expect(board.canMoveToken({ row: 16, col: 8 }, { row: 14, col: 8 })).toBe(true);
      expect(board.canMoveToken({ row: 16, col: 8 }, { row: 16, col: 6 })).toBe(true);
      expect(board.canMoveToken({ row: 16, col: 8 }, { row: 16, col: 10 })).toBe(true);
    });

    it('rejects moves into wall slots or off-grid', () => {
      expect(board.canMoveToken({ row: 16, col: 8 }, { row: 15, col: 8 })).toBe(false);
      expect(board.canMoveToken({ row: 16, col: 8 }, { row: 18, col: 8 })).toBe(false);
    });

    it('blocks movement when a wall is in between', () => {
      // Place horizontal wall at intersection (15, 7) or (15, 9)
      // Horizontal wall at (15, 7) covers (15, 6), (15, 7), (15, 8)
      // which is between row 16 and row 14 at col 8!
      expect(board.isWallSlotAvailable(15, 7, 'H')).toBe(true);
      board.placeWall(1, 15, 7, 'H', false);

      // Path between (16, 8) and (14, 8) has wall at (15, 8)
      expect(board.canMoveToken({ row: 16, col: 8 }, { row: 14, col: 8 })).toBe(false);

      // Lateral moves should still be possible
      expect(board.canMoveToken({ row: 16, col: 8 }, { row: 16, col: 6 })).toBe(true);
    });

    it('supports jumping over opponent', () => {
      // Move P1 to (2, 8) facing P2 at (0, 8)
      board.moveToken(1, { row: 14, col: 8 });
      board.moveToken(1, { row: 12, col: 8 });
      board.moveToken(1, { row: 10, col: 8 });
      board.moveToken(1, { row: 8, col: 8 });
      board.moveToken(1, { row: 6, col: 8 });
      board.moveToken(1, { row: 4, col: 8 });
      board.moveToken(1, { row: 2, col: 8 });

      // Opponent P2 is at (0, 8), P1 is at (2, 8).
      // Behind P2 is off-board (-2, 8).
      // Since straight jump is blocked by the top edge, diagonal jumps are permitted:
      // P1 can jump to (0, 6) or (0, 10)
      expect(board.canMoveToken({ row: 2, col: 8 }, { row: 0, col: 6 })).toBe(true);
      expect(board.canMoveToken({ row: 2, col: 8 }, { row: 0, col: 10 })).toBe(true);
    });
  });

  describe('moveToken', () => {
    it('successfully moves player token and updates grid', () => {
      const moved = board.moveToken(1, { row: 14, col: 8 });
      expect(moved).toBe(true);

      const p1 = board.getPlayer(1);
      expect(p1.position).toEqual({ row: 14, col: 8 });

      const grid = board.getGrid();
      expect(grid[16][8]).toBe(GridElement.EMPTY);
      expect(grid[14][8]).toBe(GridElement.PLAYER_1);
    });

    it('rejects invalid moves', () => {
      const moved = board.moveToken(1, { row: 10, col: 8 });
      expect(moved).toBe(false);
      expect(board.getPlayerPosition(1)).toEqual({ row: 16, col: 8 });
    });
  });

  describe('isWallSlotAvailable and placeWall', () => {
    it('checks horizontal wall slot availability at intersection', () => {
      expect(board.isWallSlotAvailable(1, 1, 'H')).toBe(true);
      expect(board.isWallSlotAvailable(1, 1, 'V')).toBe(true);
    });

    it('places wall and decrements inventory', () => {
      expect(board.getWallsRemaining(1)).toBe(5);
      const placed = board.placeWall(1, 7, 7, 'H');
      expect(placed).toBe(true);
      expect(board.getWallsRemaining(1)).toBe(4);

      const grid = board.getGrid();
      expect(grid[7][6]).toBe(GridElement.WALL);
      expect(grid[7][7]).toBe(GridElement.WALL);
      expect(grid[7][8]).toBe(GridElement.WALL);
    });

    it('prevents overlapping or intersecting walls', () => {
      board.placeWall(1, 7, 7, 'H');

      // Cannot place horizontal wall again at same spot
      expect(board.isWallSlotAvailable(7, 7, 'H')).toBe(false);

      // Cannot cross with vertical wall at same intersection
      expect(board.isWallSlotAvailable(7, 7, 'V')).toBe(false);

      // Cannot overlap adjacent horizontal wall sharing segment
      expect(board.isWallSlotAvailable(7, 5, 'H')).toBe(false);
    });

    it('rejects wall placement when player has no walls left', () => {
      board.placeWall(1, 1, 1, 'H');
      board.placeWall(1, 3, 1, 'H');
      board.placeWall(1, 5, 1, 'H');
      board.placeWall(1, 7, 1, 'H');
      board.placeWall(1, 9, 1, 'H');
      expect(board.getWallsRemaining(1)).toBe(0);

      const excessPlace = board.placeWall(1, 11, 1, 'H');
      expect(excessPlace).toBe(false);
    });
  });

  describe('Pathfinding and Winning condition', () => {
    it('verifies initial path exists to goal for both players', () => {
      expect(board.hasPathToGoal(1)).toBe(true);
      expect(board.hasPathToGoal(2)).toBe(true);
    });

    it('detects player winning when reaching goal row', () => {
      expect(board.isGameOver()).toBe(false);
      expect(board.getWinner()).toBeNull();

      // Teleport P1 to goal row for test
      board.moveToken(1, { row: 14, col: 8 });
      // Direct position set for test
      (board as any).players[1].position = { row: 0, col: 8 };

      expect(board.hasPlayerWon(1)).toBe(true);
      expect(board.getWinner()).toBe(1);
      expect(board.isGameOver()).toBe(true);
    });
  });
});

