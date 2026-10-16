import { describe, it, expect } from 'vitest';
import {
  BOARD_LAYOUT,
  getCellCenter,
  getIntersectionCenter
} from '../src/config/BoardLayout';

describe('BoardLayout Coordinates & Geometry', () => {
  it('defines 800x800 canvas dimensions and cell/gap sizes', () => {
    expect(BOARD_LAYOUT.CANVAS_WIDTH).toBe(800);
    expect(BOARD_LAYOUT.CANVAS_HEIGHT).toBe(800);
    expect(BOARD_LAYOUT.CELL_SIZE).toBe(62);
    expect(BOARD_LAYOUT.WALL_GAP).toBe(16);
  });

  it('calculates cell center coordinates correctly for starting positions', () => {
    // Player 1 at row 16, col 8
    const p1Center = getCellCenter(16, 8);
    expect(p1Center.x).toBe(400); // Perfectly centered horizontally on 800px canvas
    expect(p1Center.y).toBe(730);

    // CPU at row 0, col 8
    const cpuCenter = getCellCenter(0, 8);
    expect(cpuCenter.x).toBe(400); // Perfectly centered horizontally on 800px canvas
    expect(cpuCenter.y).toBe(106);
  });

  it('maintains consistent cell sizes and wall gap spacing across all 9x9 cells', () => {
    // Distance between adjacent cells (row distance 2) should be cellSize (62) + wallGap (16) = 78
    const cell0_0 = getCellCenter(0, 0);
    const cell0_2 = getCellCenter(0, 2);
    const cell2_0 = getCellCenter(2, 0);

    expect(cell0_2.x - cell0_0.x).toBe(78);
    expect(cell2_0.y - cell0_0.y).toBe(78);
  });

  it('calculates intersection centers precisely halfway between adjacent cells', () => {
    // Intersection at (1, 1) is between cell (0, 0) and cell (2, 2)
    const int1_1 = getIntersectionCenter(1, 1);
    const cell0_0 = getCellCenter(0, 0);
    const cell2_2 = getCellCenter(2, 2);

    expect(int1_1.x).toBe((cell0_0.x + cell2_2.x) / 2);
    expect(int1_1.y).toBe((cell0_0.y + cell2_2.y) / 2);
  });
});

