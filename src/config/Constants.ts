/**
 * Grid Race - Configuration Constants
 */

/**
 * Total grid size (17x17).
 * - Even indices (0, 2, 4, ..., 16) represent the 9x9 walkable board cells.
 * - Odd indices (1, 3, 5, ..., 15) represent wall slots and intersections.
 */
export const GRID_SIZE = 17;

/**
 * Number of cells in each dimension for playable tiles (9x9).
 */
export const BOARD_CELLS = 9;

/**
 * Initial wall inventory for each player.
 */
export const INITIAL_WALLS = 5;

/**
 * Player 1 initial spawn position: bottom center (row 16, col 8).
 * Player 1's objective is to reach the top row (row === 0).
 */
export const PLAYER_1_START = { row: 16, col: 8 } as const;
export const PLAYER_1_GOAL_ROW = 0;

/**
 * Player 2 (CPU) initial spawn position: top center (row 0, col 8).
 * Player 2's objective is to reach the bottom row (row === 16).
 */
export const PLAYER_2_START = { row: 0, col: 8 } as const;
export const PLAYER_2_GOAL_ROW = 16;

/**
 * Board slot types representing the 17x17 grid state.
 */
export enum SlotType {
  CELL = 0,         // Walkable cell (even row, even col)
  WALL_H = 1,       // Horizontal wall slot (odd row, even col)
  WALL_V = 2,       // Vertical wall slot (even row, odd col)
  INTERSECTION = 3  // Wall intersection (odd row, odd col)
}

/**
 * Wall orientations.
 */
export type WallOrientation = 'H' | 'V' | 'horizontal' | 'vertical';

/**
 * Player identifiers.
 */
export type PlayerId = 1 | 2;

/**
 * 2D Coordinate interface on the 17x17 grid.
 */
export interface Coordinate {
  row: number;
  col: number;
}

/**
 * Returns true if the coordinate is within the 17x17 board bounds.
 */
export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

/**
 * Coordinate identifier check:
 * Even indices (0, 2, ... 16) are walkable cells.
 */
export function isWalkableCell(row: number, col: number): boolean {
  return isInBounds(row, col) && row % 2 === 0 && col % 2 === 0;
}

/**
 * Coordinate identifier check:
 * Odd indices (1, 3, ... 15) are wall slots or intersections.
 */
export function isWallSlotOrIntersection(row: number, col: number): boolean {
  return isInBounds(row, col) && (row % 2 === 1 || col % 2 === 1);
}

/**
 * Returns true if (row, col) is a wall intersection point (odd row, odd col).
 */
export function isIntersection(row: number, col: number): boolean {
  return isInBounds(row, col) && row % 2 === 1 && col % 2 === 1;
}

/**
 * Returns true if (row, col) is a horizontal wall segment (odd row, even col).
 */
export function isHorizontalWallSlot(row: number, col: number): boolean {
  return isInBounds(row, col) && row % 2 === 1 && col % 2 === 0;
}

/**
 * Returns true if (row, col) is a vertical wall segment (even row, odd col).
 */
export function isVerticalWallSlot(row: number, col: number): boolean {
  return isInBounds(row, col) && row % 2 === 0 && col % 2 === 1;
}

