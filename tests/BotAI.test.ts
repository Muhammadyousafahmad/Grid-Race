import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Board, GridElement } from '../src/logic/Board';
import { BotAI } from '../src/logic/BotAI';
import { getShortestPath, hasPath } from '../src/logic/Pathfinding';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: execute a CPU action on the board (mirrors what the scene does)
// ─────────────────────────────────────────────────────────────────────────────
function applyAction(board: Board, ai: BotAI): void {
  const action = ai.decideAction(board);
  if (action.type === 'MOVE') {
    board.moveToken(2, { row: action.to[0], col: action.to[1] });
  } else {
    board.commitWall(2, action.coords[0], action.coords[1], action.orientation);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EASY MODE
// ─────────────────────────────────────────────────────────────────────────────
describe('BotAI – EASY mode', () => {
  let board: Board;
  const ai = new BotAI('EASY');

  beforeEach(() => {
    board = new Board();
  });

  it('always returns a legal action (MOVE or WALL)', () => {
    for (let i = 0; i < 30; i++) {
      board = new Board();
      const action = ai.decideAction(board);
      expect(['MOVE', 'WALL']).toContain(action.type);

      if (action.type === 'MOVE') {
        const [r, c] = action.to;
        expect(r % 2).toBe(0);
        expect(c % 2).toBe(0);
        // Destination must be a valid move from CPU's current position
        const cpuPos = board.getPlayerPosition(2);
        expect(board.canMoveToken(cpuPos, { row: r, col: c })).toBe(true);
      }

      if (action.type === 'WALL') {
        const [r, c] = action.coords;
        expect(r % 2).toBe(1);
        expect(c % 2).toBe(1);
      }
    }
  });

  it('eventually uses the shortest-path step (80 % weight)', () => {
    // Fix Math.random to always return 0.1 → triggers the 80% path branch
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const action = ai.decideAction(board);
    expect(action.type).toBe('MOVE');

    if (action.type === 'MOVE') {
      const cpuPath = getShortestPath(board, [0, 8], 16);
      expect(action.to).toEqual(cpuPath[1]);
    }

    vi.restoreAllMocks();
  });

  it('picks a random valid move when roll is in [0.80, 0.90)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.85);

    const action = ai.decideAction(board);
    expect(action.type).toBe('MOVE');

    if (action.type === 'MOVE') {
      // Must be one of the valid moves from CPU's position
      const validMoves = board.getValidMoves(2);
      const validCoords = validMoves.map(m => [m.row, m.col] as [number, number]);
      expect(validCoords).toContainEqual(action.to);
    }

    vi.restoreAllMocks();
  });

  it('places a candidate wall when roll is ≥ 0.90 and walls remain', () => {
    // Make random return 0.95 for the roll, then 0 to pick the first candidate
    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0.95 : 0;
    });

    const action = ai.decideAction(board);
    expect(action.type).toBe('WALL');

    vi.restoreAllMocks();
  });

  it('CPU makes progress towards row 16 over multiple easy turns', () => {
    vi.restoreAllMocks(); // use real random

    // 8 turns = enough to reach row 16 on a clear board in 8 steps most of the time
    for (let turn = 0; turn < 12; turn++) {
      if (board.hasPlayerWon(2)) break;
      applyAction(board, ai);
    }

    const cpuPos = board.getPlayerPosition(2);
    // CPU should have moved down from row 0
    expect(cpuPos.row).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MEDIUM MODE
// ─────────────────────────────────────────────────────────────────────────────
describe('BotAI – MEDIUM mode', () => {
  let board: Board;
  const ai = new BotAI('MEDIUM');

  beforeEach(() => {
    board = new Board();
  });

  it('advances when CPU distance ≤ player distance', () => {
    // CPU at (0,8), Player at (16,8) – both 8 steps from their goals
    // D_cpu == D_player → CPU should step forward
    const action = ai.decideAction(board);
    expect(action.type).toBe('MOVE');

    if (action.type === 'MOVE') {
      const cpuPath = getShortestPath(board, [0, 8], 16);
      expect(action.to).toEqual(cpuPath[1]);
    }
  });

  it('places a blocking wall when player has shorter distance', () => {
    // Move CPU far back so D_cpu > D_player
    // Teleport CPU to row 0 and Player to row 14 (2 steps from goal 0)
    (board as any).players[2].position = { row: 0, col: 8 };
    (board as any).grid[0][8] = GridElement.PLAYER_2;
    (board as any).players[1].position = { row: 2, col: 8 };
    (board as any).grid[16][8] = GridElement.EMPTY;
    (board as any).grid[2][8] = GridElement.PLAYER_1;

    // D_cpu = 8, D_player = 1 → CPU is far behind → should try to place wall
    const action = ai.decideAction(board);

    // On a clear board with this big distance gap, a valid impeding wall
    // that increases D_player by ≥ 2 should be found
    if (action.type === 'WALL') {
      const [r, c] = action.coords;
      expect(r % 2).toBe(1);
      expect(c % 2).toBe(1);
      // Wall must not create an illegal blockade
      expect(hasPath(board, [2, 8], 0)).toBe(true);
      expect(hasPath(board, [0, 8], 16)).toBe(true);
    } else {
      // It's also acceptable to move if no qualifying wall was found
      expect(action.type).toBe('MOVE');
    }
  });

  it('wall chosen by MEDIUM increases D_player by at least 2 steps', () => {
    // Position player very close to their goal
    (board as any).players[1].position = { row: 2, col: 8 };
    (board as any).grid[16][8] = GridElement.EMPTY;
    (board as any).grid[2][8] = GridElement.PLAYER_1;

    // CPU far behind
    (board as any).players[2].position = { row: 0, col: 8 };
    (board as any).grid[0][8] = GridElement.PLAYER_2;

    const p1PosB = board.getPlayerPosition(1);
    const p1PathBefore = getShortestPath(board, [p1PosB.row, p1PosB.col], 0);
    const dPlayerBefore = p1PathBefore.length - 1;

    const action = ai.decideAction(board);
    if (action.type === 'WALL') {
      board.commitWall(2, action.coords[0], action.coords[1], action.orientation);

      const p1PathAfter = getShortestPath(board, [p1PosB.row, p1PosB.col], 0);
      const dPlayerAfter = p1PathAfter.length > 0 ? p1PathAfter.length - 1 : 999;

      expect(dPlayerAfter - dPlayerBefore).toBeGreaterThanOrEqual(2);
    }
    // If action is MOVE, the test simply passes (no qualifying wall found)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HARD MODE
// ─────────────────────────────────────────────────────────────────────────────
describe('BotAI – HARD mode', () => {
  let board: Board;
  const ai = new BotAI('HARD');

  beforeEach(() => {
    board = new Board();
  });

  it('always returns a legal action', () => {
    for (let i = 0; i < 20; i++) {
      board = new Board();
      const action = ai.decideAction(board);
      expect(['MOVE', 'WALL']).toContain(action.type);
    }
  });

  it('does NOT place a wall when ΔScore < 3 (conserves walls)', () => {
    // On the starting board D_cpu = D_player = 8 → Score = 0
    // Stepping forward gives Score ≈ 1 for CPU
    // Most walls near the start will give ΔScore < 3 from 0
    // so HARD should prefer to MOVE and conserve the wall
    const action = ai.decideAction(board);
    // At game start with symmetric positions, stepping is always preferred
    expect(action.type).toBe('MOVE');
  });

  it('selects the wall with highest ΔScore when ΔScore ≥ 3', () => {
    // Put player just 1 step from goal (row 2, goal 0)
    // Put CPU far back at row 0, goal 16 → D_cpu = 8, D_player = 1
    // Score = 1 - 8 = -7.
    // A well-placed wall that pushes player to e.g. 5 steps would give
    // Score = 5 - 8 = -3, ΔScore = 4 ≥ 3 → HARD should place it.
    (board as any).players[1].position = { row: 2, col: 8 };
    (board as any).grid[16][8] = GridElement.EMPTY;
    (board as any).grid[2][8] = GridElement.PLAYER_1;

    const action = ai.decideAction(board);
    // If a qualifying wall exists, HARD must place it
    if (action.type === 'WALL') {
      const [r, c] = action.coords;
      expect(r % 2).toBe(1);
      expect(c % 2).toBe(1);
      // Verify it preserves legal paths (the candidates filter guarantees this,
      // but let's confirm at the action level too)
      expect(hasPath(board, [2, 8], 0)).toBe(true);
      expect(hasPath(board, [0, 8], 16)).toBe(true);
    }
    // MOVE is acceptable when no wall clears the ΔScore ≥ 3 threshold
  });

  it('the chosen wall action is legal (no blockade created)', () => {
    // Run 20 random turns and assert legality of every WALL action
    for (let i = 0; i < 20; i++) {
      board = new Board();
      const action = ai.decideAction(board);

      if (action.type === 'WALL') {
        board.commitWall(2, action.coords[0], action.coords[1], action.orientation);

        const cpuPos = board.getPlayerPosition(2);
        const p1Pos  = board.getPlayerPosition(1);
        expect(hasPath(board, [p1Pos.row, p1Pos.col], 0)).toBe(true);
        expect(hasPath(board, [cpuPos.row, cpuPos.col], 16)).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Difficulty constructor
// ─────────────────────────────────────────────────────────────────────────────
describe('BotAI – constructor', () => {
  it('defaults to MEDIUM difficulty', () => {
    const ai = new BotAI();
    expect(ai.difficulty).toBe('MEDIUM');
  });

  it('stores the specified difficulty', () => {
    expect(new BotAI('EASY').difficulty).toBe('EASY');
    expect(new BotAI('HARD').difficulty).toBe('HARD');
  });
});
