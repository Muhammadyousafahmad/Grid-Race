import {
  GRID_SIZE,
  INITIAL_WALLS,
  PLAYER_1_START,
  PLAYER_1_GOAL_ROW,
  PLAYER_2_START,
  PLAYER_2_GOAL_ROW,
  PlayerId,
  WallOrientation,
  Coordinate,
  isInBounds,
  isWalkableCell,
  isIntersection
} from '../config/Constants';
import { hasPath } from './Pathfinding';

/**
 * Grid element status in the 17x17 matrix.
 */
export enum GridElement {
  EMPTY = 0,
  PLAYER_1 = 1,
  PLAYER_2 = 2,
  WALL = 3
}

/**
 * Placed wall record.
 */
export interface PlacedWall {
  row: number; // Intersection row (odd)
  col: number; // Intersection col (odd)
  orientation: 'H' | 'V';
  placedBy: PlayerId;
}

/**
 * Player state.
 */
export interface PlayerState {
  id: PlayerId;
  position: Coordinate;
  goalRow: number;
  wallsRemaining: number;
}

/**
 * 17x17 Board model for Grid Race.
 */
export class Board {
  private grid: number[][];
  private players: Record<PlayerId, PlayerState>;
  private activeWalls: PlacedWall[] = [];

  constructor() {
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(GridElement.EMPTY));

    this.players = {
      1: {
        id: 1,
        position: { row: PLAYER_1_START.row, col: PLAYER_1_START.col },
        goalRow: PLAYER_1_GOAL_ROW,
        wallsRemaining: INITIAL_WALLS
      },
      2: {
        id: 2,
        position: { row: PLAYER_2_START.row, col: PLAYER_2_START.col },
        goalRow: PLAYER_2_GOAL_ROW,
        wallsRemaining: INITIAL_WALLS
      }
    };

    // Mark player positions in the grid
    this.grid[PLAYER_1_START.row][PLAYER_1_START.col] = GridElement.PLAYER_1;
    this.grid[PLAYER_2_START.row][PLAYER_2_START.col] = GridElement.PLAYER_2;
  }

  /**
   * Returns a copy of the 17x17 board grid.
   */
  public getGrid(): number[][] {
    return this.grid.map((row) => [...row]);
  }

  /**
   * Returns state for specified player.
   */
  public getPlayer(playerId: PlayerId): Readonly<PlayerState> {
    return {
      ...this.players[playerId],
      position: { ...this.players[playerId].position }
    };
  }

  /**
   * Returns the current coordinate for a player.
   */
  public getPlayerPosition(playerId: PlayerId): Coordinate {
    return { ...this.players[playerId].position };
  }

  /**
   * Returns walls remaining for a player.
   */
  public getWallsRemaining(playerId: PlayerId): number {
    return this.players[playerId].wallsRemaining;
  }

  /**
   * Returns all active placed walls.
   */
  public getActiveWalls(): ReadonlyArray<PlacedWall> {
    return [...this.activeWalls];
  }

  /**
   * Normalizes orientation to 'H' or 'V'.
   */
  public normalizeOrientation(orientation: WallOrientation): 'H' | 'V' {
    if (orientation === 'H' || orientation === 'horizontal') return 'H';
    if (orientation === 'V' || orientation === 'vertical') return 'V';
    throw new Error(`Invalid wall orientation: ${orientation}`);
  }

  /**
   * Resolves the canonical intersection coordinate (odd row, odd col)
   * for a wall request given (r, c) and orientation.
   */
  public resolveWallIntersection(r: number, c: number, orientation: 'H' | 'V'): Coordinate | null {
    if (isIntersection(r, c)) {
      return { row: r, col: c };
    }

    if (orientation === 'H') {
      // If (r, c) is the start segment (odd row, even col), intersection is (r, c + 1)
      if (r % 2 === 1 && c % 2 === 0) {
        return { row: r, col: c + 1 };
      }
    } else {
      // If (r, c) is the start segment (even row, odd col), intersection is (r + 1, c)
      if (r % 2 === 0 && c % 2 === 1) {
        return { row: r + 1, col: c };
      }
    }

    return null;
  }

  /**
   * Gets the 3 grid coordinates occupied by a 3-unit long wall centered at intersection (r, c).
   * Covers two adjacent cell borders and the intersection between them.
   * e.g., horizontal wall at intersection (1, 1) spans (1, 0), (1, 1), and (1, 2).
   */
  public getWallSegments(intersectionR: number, intersectionC: number, orientation: 'H' | 'V'): Coordinate[] {
    if (orientation === 'H') {
      return [
        { row: intersectionR, col: intersectionC - 1 },
        { row: intersectionR, col: intersectionC },
        { row: intersectionR, col: intersectionC + 1 }
      ];
    } else {
      return [
        { row: intersectionR - 1, col: intersectionC },
        { row: intersectionR, col: intersectionC },
        { row: intersectionR + 1, col: intersectionC }
      ];
    }
  }

  /**
   * Speculatively places a wall into the 17x17 matrix without committing inventory or activeWalls.
   * Returns a rollback function to revert changes if path checks fail, or null if the slot is invalid.
   */
  public speculativePlaceWall(r: number, c: number, orientation: WallOrientation): (() => void) | null {
    const normOrientation = this.normalizeOrientation(orientation);
    const intersection = this.resolveWallIntersection(r, c, normOrientation);
    if (!intersection) {
      return null;
    }

    if (!this.isWallSlotAvailable(intersection.row, intersection.col, normOrientation, false)) {
      return null;
    }

    const segments = this.getWallSegments(intersection.row, intersection.col, normOrientation);
    for (const seg of segments) {
      this.grid[seg.row][seg.col] = GridElement.WALL;
    }

    return () => {
      for (const seg of segments) {
        this.grid[seg.row][seg.col] = GridElement.EMPTY;
      }
    };
  }

  /**
   * Permanently commits an already speculatively placed or validated wall for a player.
   * Decrements player's wall inventory and records the placed wall.
   */
  public commitWall(playerId: PlayerId, r: number, c: number, orientation: WallOrientation): boolean {
    const player = this.players[playerId];
    if (!player || player.wallsRemaining <= 0) {
      return false;
    }

    const normOrientation = this.normalizeOrientation(orientation);
    const intersection = this.resolveWallIntersection(r, c, normOrientation);
    if (!intersection) {
      return false;
    }

    const segments = this.getWallSegments(intersection.row, intersection.col, normOrientation);
    for (const seg of segments) {
      this.grid[seg.row][seg.col] = GridElement.WALL;
    }

    player.wallsRemaining -= 1;
    this.activeWalls.push({
      row: intersection.row,
      col: intersection.col,
      orientation: normOrientation,
      placedBy: playerId
    });

    return true;
  }

  /**
   * Checks if a wall slot is available to place a wall.
   * Can accept either intersection coordinate (odd, odd) or wall slot coordinate.
   * 
   * @param r Row index
   * @param c Column index
   * @param orientation 'H' | 'V' | 'horizontal' | 'vertical'
   * @param checkPath If true, also ensures that neither player is completely trapped.
   */
  public isWallSlotAvailable(
    r: number,
    c: number,
    orientation: WallOrientation,
    checkPath: boolean = false
  ): boolean {
    const normOrientation = this.normalizeOrientation(orientation);
    const intersection = this.resolveWallIntersection(r, c, normOrientation);
    if (!intersection) {
      return false;
    }

    const { row: ir, col: ic } = intersection;

    // Intersections must be between 1 and GRID_SIZE - 2 (e.g. 1 to 15)
    if (ir < 1 || ir > GRID_SIZE - 2 || ic < 1 || ic > GRID_SIZE - 2) {
      return false;
    }

    const segments = this.getWallSegments(ir, ic, normOrientation);

    // Verify all segments are within bounds and currently empty
    for (const seg of segments) {
      if (!isInBounds(seg.row, seg.col)) return false;
      if (this.grid[seg.row][seg.col] === GridElement.WALL) return false;
    }

    // Optional check: ensure wall placement doesn't completely block any player from goal
    if (checkPath) {
      return this.wouldWallAllowPath(ir, ic, normOrientation);
    }

    return true;
  }

  /**
   * Places a wall for a player if valid and if player has walls remaining.
   * Returns true on success, false otherwise.
   */
  public placeWall(
    playerId: PlayerId,
    r: number,
    c: number,
    orientation: WallOrientation,
    enforcePathCheck: boolean = true
  ): boolean {
    const player = this.players[playerId];
    if (!player || player.wallsRemaining <= 0) {
      return false;
    }

    const normOrientation = this.normalizeOrientation(orientation);
    const intersection = this.resolveWallIntersection(r, c, normOrientation);
    if (!intersection) {
      return false;
    }

    if (!this.isWallSlotAvailable(intersection.row, intersection.col, normOrientation, enforcePathCheck)) {
      return false;
    }

    const segments = this.getWallSegments(intersection.row, intersection.col, normOrientation);
    for (const seg of segments) {
      this.grid[seg.row][seg.col] = GridElement.WALL;
    }

    player.wallsRemaining -= 1;
    this.activeWalls.push({
      row: intersection.row,
      col: intersection.col,
      orientation: normOrientation,
      placedBy: playerId
    });

    return true;
  }

  /**
   * Checks whether a token can move from 'from' to 'to'.
   * Follows standard Grid Race / Quoridor movement rules:
   * - Orthogonal step of 2 units (if no wall in between and target is empty).
   * - Jump over opponent if adjacent:
   *   - Straight jump (if no wall behind opponent).
   *   - Diagonal jump (if straight jump is blocked by a wall or board boundary).
   */
  public canMoveToken(from: Coordinate, to: Coordinate): boolean {
    if (!isWalkableCell(from.row, from.col) || !isWalkableCell(to.row, to.col)) {
      return false;
    }

    if (from.row === to.row && from.col === to.col) {
      return false;
    }

    // Target cannot be occupied by any player
    if (
      this.grid[to.row][to.col] === GridElement.PLAYER_1 ||
      this.grid[to.row][to.col] === GridElement.PLAYER_2
    ) {
      return false;
    }

    const dRow = to.row - from.row;
    const dCol = to.col - from.col;

    // 1. Direct orthogonal move (distance 2)
    if ((Math.abs(dRow) === 2 && dCol === 0) || (dRow === 0 && Math.abs(dCol) === 2)) {
      const intermediateRow = from.row + dRow / 2;
      const intermediateCol = from.col + dCol / 2;

      // Check if wall slot is blocked
      if (this.grid[intermediateRow][intermediateCol] === GridElement.WALL) {
        return false;
      }

      return true;
    }

    // 2. Jump moves over opponent
    const validMovesFromFrom = this.getValidMovesFrom(from);
    return validMovesFromFrom.some((m) => m.row === to.row && m.col === to.col);
  }

  /**
   * Computes all valid move destinations for a token at a given walkable cell.
   */
  public getValidMovesFrom(from: Coordinate): Coordinate[] {
    const validMoves: Coordinate[] = [];
    if (!isWalkableCell(from.row, from.col)) return validMoves;

    const directions = [
      { dr: -2, dc: 0, wallR: -1, wallC: 0 }, // Up
      { dr: 2, dc: 0, wallR: 1, wallC: 0 },   // Down
      { dr: 0, dc: -2, wallR: 0, wallC: -1 }, // Left
      { dr: 0, dc: 2, wallR: 0, wallC: 1 }    // Right
    ];

    for (const dir of directions) {
      const nextR = from.row + dir.dr;
      const nextC = from.col + dir.dc;
      const wallR = from.row + dir.wallR;
      const wallC = from.col + dir.wallC;

      // Must be within bounds
      if (!isInBounds(nextR, nextC)) continue;

      // Path to adjacent cell must not be blocked by wall
      if (this.grid[wallR][wallC] === GridElement.WALL) continue;

      const cellContent = this.grid[nextR][nextC];

      if (cellContent === GridElement.EMPTY) {
        // Unoccupied adjacent cell: standard move
        validMoves.push({ row: nextR, col: nextC });
      } else if (cellContent === GridElement.PLAYER_1 || cellContent === GridElement.PLAYER_2) {
        // Occupied by opponent: evaluate jump
        const opponentPos = { row: nextR, col: nextC };

        // Straight jump destination
        const straightJumpR = opponentPos.row + dir.dr;
        const straightJumpC = opponentPos.col + dir.dc;
        const straightWallR = opponentPos.row + dir.wallR;
        const straightWallC = opponentPos.col + dir.wallC;

        const straightInBounds = isInBounds(straightJumpR, straightJumpC);
        const straightBlockedByWall = straightInBounds && this.grid[straightWallR][straightWallC] === GridElement.WALL;

        if (straightInBounds && !straightBlockedByWall && this.grid[straightJumpR][straightJumpC] === GridElement.EMPTY) {
          // Straight jump is possible
          validMoves.push({ row: straightJumpR, col: straightJumpC });
        } else {
          // Straight jump is blocked by wall or board edge -> Diagonal jumps allowed
          const diagonalDirs = dir.dr !== 0
            ? [
                { dr: 0, dc: -2, wallR: 0, wallC: -1 },
                { dr: 0, dc: 2, wallR: 0, wallC: 1 }
              ]
            : [
                { dr: -2, dc: 0, wallR: -1, wallC: 0 },
                { dr: 2, dc: 0, wallR: 1, wallC: 0 }
              ];

          for (const diag of diagonalDirs) {
            const diagR = opponentPos.row + diag.dr;
            const diagC = opponentPos.col + diag.dc;
            const diagWallR = opponentPos.row + diag.wallR;
            const diagWallC = opponentPos.col + diag.wallC;

            if (isInBounds(diagR, diagC) && this.grid[diagWallR][diagWallC] !== GridElement.WALL) {
              if (this.grid[diagR][diagC] === GridElement.EMPTY) {
                validMoves.push({ row: diagR, col: diagC });
              }
            }
          }
        }
      }
    }

    return validMoves;
  }

  /**
   * Returns all valid moves for the specified player.
   */
  public getValidMoves(playerId: PlayerId): Coordinate[] {
    const player = this.players[playerId];
    if (!player) return [];
    return this.getValidMovesFrom(player.position);
  }

  /**
   * Moves a player's token to coordinate 'to'.
   * Returns true if move was valid and executed, false otherwise.
   */
  public moveToken(playerId: PlayerId, to: Coordinate): boolean {
    const player = this.players[playerId];
    if (!player) return false;

    if (!this.canMoveToken(player.position, to)) {
      return false;
    }

    // Clear old position
    this.grid[player.position.row][player.position.col] = GridElement.EMPTY;

    // Set new position
    player.position = { row: to.row, col: to.col };
    this.grid[to.row][to.col] = playerId === 1 ? GridElement.PLAYER_1 : GridElement.PLAYER_2;

    return true;
  }

  /**
   * Checks whether the specified player has reached their goal row.
   */
  public hasPlayerWon(playerId: PlayerId): boolean {
    const player = this.players[playerId];
    return player ? player.position.row === player.goalRow : false;
  }

  /**
   * Returns the winner (1 or 2), or null if game is still in progress.
   */
  public getWinner(): PlayerId | null {
    if (this.hasPlayerWon(1)) return 1;
    if (this.hasPlayerWon(2)) return 2;
    return null;
  }

  /**
   * Checks if game has ended.
   */
  public isGameOver(): boolean {
    return this.getWinner() !== null;
  }

  /**
   * Uses BFS to check whether player has an unblocked path to their goal row.
   */
  public hasPathToGoal(playerId: PlayerId): boolean {
    const player = this.players[playerId];
    if (!player) return false;
    return hasPath(this, [player.position.row, player.position.col], player.goalRow);
  }

  /**
   * Checks if placing a wall at the given intersection would keep paths open for both players.
   */
  private wouldWallAllowPath(intersectionR: number, intersectionC: number, orientation: 'H' | 'V'): boolean {
    const segments = this.getWallSegments(intersectionR, intersectionC, orientation);

    // Temporarily place wall
    for (const seg of segments) {
      this.grid[seg.row][seg.col] = GridElement.WALL;
    }

    const p1HasPath = this.hasPathToGoal(1);
    const p2HasPath = this.hasPathToGoal(2);

    // Revert wall placement
    for (const seg of segments) {
      this.grid[seg.row][seg.col] = GridElement.EMPTY;
    }

    return p1HasPath && p2HasPath;
  }

  /**
   * Resets the board to initial starting configuration.
   */
  public reset(): void {
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(GridElement.EMPTY));

    this.players = {
      1: {
        id: 1,
        position: { row: PLAYER_1_START.row, col: PLAYER_1_START.col },
        goalRow: PLAYER_1_GOAL_ROW,
        wallsRemaining: INITIAL_WALLS
      },
      2: {
        id: 2,
        position: { row: PLAYER_2_START.row, col: PLAYER_2_START.col },
        goalRow: PLAYER_2_GOAL_ROW,
        wallsRemaining: INITIAL_WALLS
      }
    };

    this.activeWalls = [];

    this.grid[PLAYER_1_START.row][PLAYER_1_START.col] = GridElement.PLAYER_1;
    this.grid[PLAYER_2_START.row][PLAYER_2_START.col] = GridElement.PLAYER_2;
  }

  /**
   * Deep clone of the board for AI simulation, minimax, or backtracking.
   */
  public clone(): Board {
    const cloned = new Board();
    cloned.grid = this.grid.map((row) => [...row]);
    cloned.players = {
      1: {
        id: 1,
        position: { ...this.players[1].position },
        goalRow: this.players[1].goalRow,
        wallsRemaining: this.players[1].wallsRemaining
      },
      2: {
        id: 2,
        position: { ...this.players[2].position },
        goalRow: this.players[2].goalRow,
        wallsRemaining: this.players[2].wallsRemaining
      }
    };
    cloned.activeWalls = this.activeWalls.map((w) => ({ ...w }));
    return cloned;
  }
}

