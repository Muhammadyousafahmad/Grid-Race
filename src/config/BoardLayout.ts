/**
 * Board layout dimensions and coordinate conversion helpers.
 * Scaled and shifted to provide dedicated breathing room for the mobile action bar.
 */
export const BOARD_LAYOUT = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 800,
  CELL_SIZE: 60,
  WALL_GAP: 15,
  BOARD_START_X: 70,
  BOARD_START_Y: 72
} as const;

/**
 * Calculates the pixel center for any walkable cell (even row, even col).
 */
export function getCellCenter(row: number, col: number): { x: number; y: number } {
  const cellIndexX = col / 2;
  const cellIndexY = row / 2;
  const x = BOARD_LAYOUT.BOARD_START_X + cellIndexX * (BOARD_LAYOUT.CELL_SIZE + BOARD_LAYOUT.WALL_GAP) + BOARD_LAYOUT.CELL_SIZE / 2;
  const y = BOARD_LAYOUT.BOARD_START_Y + cellIndexY * (BOARD_LAYOUT.CELL_SIZE + BOARD_LAYOUT.WALL_GAP) + BOARD_LAYOUT.CELL_SIZE / 2;
  return { x, y };
}

/**
 * Calculates the pixel center for any intersection (odd row, odd col).
 */
export function getIntersectionCenter(row: number, col: number): { x: number; y: number } {
  const wCol = (col - 1) / 2;
  const wRow = (row - 1) / 2;
  const x = BOARD_LAYOUT.BOARD_START_X + (wCol + 1) * BOARD_LAYOUT.CELL_SIZE + wCol * BOARD_LAYOUT.WALL_GAP + BOARD_LAYOUT.WALL_GAP / 2;
  const y = BOARD_LAYOUT.BOARD_START_Y + (wRow + 1) * BOARD_LAYOUT.CELL_SIZE + wRow * BOARD_LAYOUT.WALL_GAP + BOARD_LAYOUT.WALL_GAP / 2;
  return { x, y };
}