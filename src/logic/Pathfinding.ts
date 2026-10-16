import { Board, GridElement } from './Board';
import { GRID_SIZE, isInBounds } from '../config/Constants';

/**
 * Represents a proposed or candidate wall placement action.
 */
export interface WallAction {
  row: number; // Intersection row (odd)
  col: number; // Intersection col (odd)
  orientation: 'H' | 'V';
}

/**
 * Checks whether an entity starting at startCoord can reach targetRow using Breadth-First Search (BFS).
 *
 * Traverses only orthogonal neighbors (step of 2 units in the 17x17 matrix)
 * and verifies that no placed wall exists on the intermediate odd index.
 *
 * @param board The Board instance containing the current 17x17 grid state.
 * @param startCoord Starting coordinate as [row, col] tuple.
 * @param targetRow The destination row index (e.g., 0 for Player 1, 16 for CPU).
 * @returns boolean True if an unblocked path to targetRow exists, false otherwise.
 */
export function hasPath(
  board: Board,
  startCoord: [number, number],
  targetRow: number
): boolean {
  const [startRow, startCol] = startCoord;

  // Immediate check if already at target row
  if (startRow === targetRow) {
    return true;
  }

  // Retrieve current 17x17 matrix snapshot
  const grid = board.getGrid();

  // Visited matrix for the 17x17 grid
  const visited: boolean[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(false)
  );

  const queue: [number, number][] = [[startRow, startCol]];
  visited[startRow][startCol] = true;

  // Orthogonal directions (up, down, left, right)
  // dr, dc = 2 units step on walkable cells
  // wallR, wallC = intermediate odd index for wall slot
  const directions = [
    { dr: -2, dc: 0, wallR: -1, wallC: 0 }, // Up (North)
    { dr: 2, dc: 0, wallR: 1, wallC: 0 },   // Down (South)
    { dr: 0, dc: -2, wallR: 0, wallC: -1 }, // Left (West)
    { dr: 0, dc: 2, wallR: 0, wallC: 1 }    // Right (East)
  ];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;

    if (r === targetRow) {
      return true;
    }

    for (const dir of directions) {
      const nextR = r + dir.dr;
      const nextC = c + dir.dc;
      const wallR = r + dir.wallR;
      const wallC = c + dir.wallC;

      // Must be within 17x17 bounds
      if (!isInBounds(nextR, nextC)) {
        continue;
      }

      // Check if already visited
      if (visited[nextR][nextC]) {
        continue;
      }

      // Check if wall blocks the intermediate slot
      if (grid[wallR][wallC] === GridElement.WALL) {
        continue;
      }

      visited[nextR][nextC] = true;
      queue.push([nextR, nextC]);
    }
  }

  return false;
}

/**
 * Returns the exact array of coordinates representing the shortest step-by-step
 * route to the goal row using BFS parent tracking.
 * Returns an empty array if no path exists.
 *
 * @param board The Board instance containing the current 17x17 grid state.
 * @param start Starting coordinate as [row, col] tuple.
 * @param targetRow The destination row index (0 for Player 1, 16 for CPU).
 * @returns Array of [row, col] coordinates from start to goal row.
 */
export function getShortestPath(
  board: Board,
  start: [number, number],
  targetRow: number
): [number, number][] {
  const [startRow, startCol] = start;

  if (startRow === targetRow) {
    return [start];
  }

  const grid = board.getGrid();
  const visited: boolean[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(false)
  );
  const parent: Map<string, [number, number]> = new Map();

  const queue: [number, number][] = [[startRow, startCol]];
  visited[startRow][startCol] = true;

  const directions = [
    { dr: -2, dc: 0, wallR: -1, wallC: 0 },
    { dr: 2, dc: 0, wallR: 1, wallC: 0 },
    { dr: 0, dc: -2, wallR: 0, wallC: -1 },
    { dr: 0, dc: 2, wallR: 0, wallC: 1 }
  ];

  let reachedGoalCoord: [number, number] | null = null;

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;

    if (r === targetRow) {
      reachedGoalCoord = [r, c];
      break;
    }

    for (const dir of directions) {
      const nextR = r + dir.dr;
      const nextC = c + dir.dc;
      const wallR = r + dir.wallR;
      const wallC = c + dir.wallC;

      if (!isInBounds(nextR, nextC) || visited[nextR][nextC]) {
        continue;
      }

      if (grid[wallR][wallC] === GridElement.WALL) {
        continue;
      }

      visited[nextR][nextC] = true;
      parent.set(`${nextR},${nextC}`, [r, c]);
      queue.push([nextR, nextC]);
    }
  }

  if (!reachedGoalCoord) {
    return [];
  }

  // Reconstruct path from goal back to start using parent tracking
  const path: [number, number][] = [];
  let curr: [number, number] | undefined = reachedGoalCoord;

  while (curr) {
    path.unshift(curr);
    if (curr[0] === startRow && curr[1] === startCol) {
      break;
    }
    curr = parent.get(`${curr[0]},${curr[1]}`);
  }

  return path;
}

/**
 * Inspects wall slots directly adjacent to the coordinates in opponentPath,
 * filters out illegal walls (overlaps, out of bounds, or walls that fail the full blockade check),
 * and returns the focused array of viable candidate walls for the CPU to evaluate.
 *
 * This targeted evaluation eliminates lag on Hard difficulty by focusing only on walls
 * that directly disrupt or border the opponent's planned route, avoiding full 100+ slot scans.
 *
 * @param board The Board instance containing the current 17x17 grid state.
 * @param opponentPath Step-by-step route coordinates of the opponent.
 * @returns Array of legal, non-blocking WallAction candidates.
 */
export function getCandidateWalls(
  board: Board,
  opponentPath: [number, number][]
): WallAction[] {
  if (!opponentPath || opponentPath.length === 0) {
    return [];
  }

  const candidateWalls: WallAction[] = [];
  const visitedKeys = new Set<string>();

  const p1Pos = board.getPlayerPosition(1);
  const p2Pos = board.getPlayerPosition(2);
  const p1Goal = board.getPlayer(1).goalRow;
  const p2Goal = board.getPlayer(2).goalRow;

  const orientations: ('H' | 'V')[] = ['H', 'V'];

  for (const [r, c] of opponentPath) {
    // Intersections directly adjacent to walkable cell (r, c)
    // Walkable cells have even indices; adjacent intersections have odd indices at (r ± 1, c ± 1)
    for (const dr of [-1, 1]) {
      for (const dc of [-1, 1]) {
        const ir = r + dr;
        const ic = c + dc;

        // Valid intersection range is 1 to 15
        if (ir < 1 || ir > GRID_SIZE - 2 || ic < 1 || ic > GRID_SIZE - 2) {
          continue;
        }

        for (const orientation of orientations) {
          const key = `${ir},${ic},${orientation}`;
          if (visitedKeys.has(key)) {
            continue;
          }
          visitedKeys.add(key);

          // 1. Basic availability check (bounds and no overlap/crossing)
          if (!board.isWallSlotAvailable(ir, ic, orientation, false)) {
            continue;
          }

          // 2. Strict blockade check via speculative placement
          const rollback = board.speculativePlaceWall(ir, ic, orientation);
          if (!rollback) {
            continue;
          }

          const p1HasPath = hasPath(board, [p1Pos.row, p1Pos.col], p1Goal);
          const cpuHasPath = hasPath(board, [p2Pos.row, p2Pos.col], p2Goal);

          // Always rollback speculative placement
          rollback();

          // If either player's path is blocked, reject candidate
          if (!p1HasPath || !cpuHasPath) {
            continue;
          }

          candidateWalls.push({
            row: ir,
            col: ic,
            orientation
          });
        }
      }
    }
  }

  return candidateWalls;
}
