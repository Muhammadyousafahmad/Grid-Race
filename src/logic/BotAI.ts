import { Board } from './Board';
import {
  getShortestPath,
  getCandidateWalls,
  WallAction
} from './Pathfinding';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

/** The CPU always returns exactly one of these two action shapes. */
export type BotAction =
  | { type: 'MOVE'; to: [number, number] }
  | { type: 'WALL'; coords: [number, number]; orientation: 'H' | 'V' };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Chooses a uniformly random element from a non-empty array.
 * Returns undefined when the array is empty.
 */
function randomPick<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Returns the next step along the CPU's BFS shortest path, or null when
 * the path is empty / length is ≤ 1 (already at goal).
 */
function nextStepOnPath(
  board: Board,
  cpuStart: [number, number],
  cpuGoal: number
): [number, number] | null {
  const path = getShortestPath(board, cpuStart, cpuGoal);
  // path[0] is the current position; path[1] is the next step.
  return path.length >= 2 ? path[1] : null;
}

// ---------------------------------------------------------------------------
// BotAI class
// ---------------------------------------------------------------------------

/**
 * Extensible CPU decision engine for Grid Race.
 *
 * The CPU always plays as Player 2 (goal row 16).
 * The human always plays as Player 1 (goal row 0).
 *
 * Call `decideAction(board)` once per CPU turn to receive a `BotAction`.
 * The caller is responsible for executing the action on the board and
 * animating the result in the scene.
 */
export class BotAI {
  public readonly difficulty: Difficulty;

  /**
   * @param difficulty  One of 'EASY' | 'MEDIUM' | 'HARD'.
   */
  constructor(difficulty: Difficulty = 'MEDIUM') {
    this.difficulty = difficulty;
  }

  // -------------------------------------------------------------------------
  // Main entry point
  // -------------------------------------------------------------------------

  /**
   * Evaluates the current board state and returns the best action for the
   * CPU according to the selected difficulty tier.
   *
   * @param board  Live Board instance (not mutated — clones used internally).
   * @returns  A `BotAction` ready for the scene to execute.
   */
  public decideAction(board: Board): BotAction {
    switch (this.difficulty) {
      case 'EASY':   return this.decideEasy(board);
      case 'MEDIUM': return this.decideMedium(board);
      case 'HARD':   return this.decideHard(board);
    }
  }

  // -------------------------------------------------------------------------
  // EASY — probabilistic, partially flawed
  // -------------------------------------------------------------------------

  /**
   * Easy Mode:
   *  • 80 % → advance one step along CPU's BFS shortest path.
   *  • 10 % → make a random valid orthogonal move (flawed).
   *  • 10 % → place a random valid candidate wall (if walls remain).
   */
  private decideEasy(board: Board): BotAction {
    const cpuState  = board.getPlayer(2);
    const cpuPos:    [number, number] = [cpuState.position.row, cpuState.position.col];
    const cpuGoal   = cpuState.goalRow;

    const roll = Math.random();

    // ── 80 %: step forward on shortest path ──────────────────────────────
    if (roll < 0.80) {
      const next = nextStepOnPath(board, cpuPos, cpuGoal);
      const from: [number, number] = cpuPos;
      if (next && board.canMoveToken({ row: from[0], col: from[1] }, { row: next[0], col: next[1] })) {
        return { type: 'MOVE', to: next };
      }
      // BFS step was illegal (occupied / walled) → fall through to the
      // flawed branches below instead of wasting the turn.
    }

    // ── 10 %: random valid move ───────────────────────────────────────────
    if (roll < 0.90) {
      const moves = board.getValidMoves(2);
      const pick  = randomPick(moves);
      if (pick) return { type: 'MOVE', to: [pick.row, pick.col] };
    }

    // ── 10 %: random candidate wall ──────────────────────────────────────
    if (cpuState.wallsRemaining > 0) {
      // Use player's path to find walls that disrupt the opponent's route
      const p1State    = board.getPlayer(1);
      const p1Pos:     [number, number] = [p1State.position.row, p1State.position.col];
      const p1Path     = getShortestPath(board, p1Pos, p1State.goalRow);
      const candidates = getCandidateWalls(board, p1Path);
      const wall       = randomPick(candidates);
      if (wall) {
        return { type: 'WALL', coords: [wall.row, wall.col], orientation: wall.orientation };
      }
    }

    // ── Fallback: best legal move (jump-aware) ─────────────────────────────
    return this.makeMoveAction(board, cpuPos, cpuGoal);
  }

  // -------------------------------------------------------------------------
  // MEDIUM — reactive distance comparison
  // -------------------------------------------------------------------------

  /**
   * Medium Mode (Reactive):
   *  Let D_cpu = getShortestPath(CPU → goal).length − 1
   *      D_player = getShortestPath(Player → goal).length − 1
   *
   *  • If D_cpu ≤ D_player → advance one step.
   *  • Else if CPU has walls → find a candidate wall that increases
   *    D_player by ≥ 2 without increasing D_cpu → place it.
   *  • Otherwise → advance one step.
   */
  private decideMedium(board: Board): BotAction {
    const cpuState = board.getPlayer(2);
    const p1State  = board.getPlayer(1);

    const cpuPos: [number, number] = [cpuState.position.row, cpuState.position.col];
    const p1Pos:  [number, number] = [p1State.position.row,  p1State.position.col];

    const cpuPath = getShortestPath(board, cpuPos, cpuState.goalRow);
    const p1Path  = getShortestPath(board, p1Pos,  p1State.goalRow);

    // Distances are (path.length − 1) steps; 0 means already at goal.
    const dCpu    = Math.max(0, cpuPath.length - 1);
    const dPlayer = Math.max(0, p1Path.length  - 1);

    // ── CPU is ahead or level → just step ────────────────────────────────
    if (dCpu <= dPlayer) {
      return this.makeMoveAction(board, cpuPos, cpuState.goalRow);
    }

    // ── CPU is behind → try to place an impeding wall ────────────────────
    if (cpuState.wallsRemaining > 0 && p1Path.length > 0) {
      const candidates = getCandidateWalls(board, p1Path);

      for (const wall of candidates) {
        const result = this.evaluateWall(board, wall, cpuPos, p1Pos, cpuState.goalRow, p1State.goalRow);
        if (!result) continue;

        const { newDPlayer, newDCpu } = result;

        // Criteria: player distance increases by ≥ 2, CPU distance must NOT increase
        if ((newDPlayer - dPlayer) >= 2 && newDCpu <= dCpu) {
          return { type: 'WALL', coords: [wall.row, wall.col], orientation: wall.orientation };
        }
      }
    }

    // ── No good wall found → step forward ────────────────────────────────
    return this.makeMoveAction(board, cpuPos, cpuState.goalRow);
  }

  // -------------------------------------------------------------------------
  // HARD — heuristic saboteur, maximises net advantage score
  // -------------------------------------------------------------------------

  /**
   * Hard Mode (Heuristic Saboteur):
   *  Score = D_player − D_cpu  (higher = more advantageous for CPU)
   *
   *  Simulate two categories of action:
   *    A) Step forward → compute resulting Score
   *    B) Each candidate wall → compute resulting Score
   *
   *  Place a wall when it creates a NET Score gain of ≥ 2 versus the current
   *  board (it costs one turn to place a wall, so +2 gain with ≤ 0–2 own-cost
   *  is the break-even arithmetic that actually wins the race), or in
   *  emergency defence: P1 is 1–2 steps from the goal, we are behind, and
   *  the wall buys P1 ≥ 2 extra steps at an own-cost of ≤ 2.
   *  Otherwise take the action (step or best wall) that maximises Score.
   */
  private decideHard(board: Board): BotAction {
    const cpuState = board.getPlayer(2);
    const p1State  = board.getPlayer(1);

    const cpuPos: [number, number] = [cpuState.position.row, cpuState.position.col];
    const p1Pos:  [number, number] = [p1State.position.row,  p1State.position.col];

    const cpuPath = getShortestPath(board, cpuPos, cpuState.goalRow);
    const p1Path  = getShortestPath(board, p1Pos,  p1State.goalRow);

    const dCpu    = Math.max(0, cpuPath.length - 1);
    const dPlayer = Math.max(0, p1Path.length  - 1);
    const baseScore = dPlayer - dCpu;

    // ── Evaluate the best legal forward move (jump-aware) ─────────────────
    let bestAction: BotAction = this.makeMoveAction(board, cpuPos, cpuState.goalRow);
    let bestScore  = baseScore; // Placeholder — recomputed below

    // Compute score after stepping. The destination is guaranteed legal
    // (may be the two-cell jump over P1 when they meet head-on).
    const nextStep = this.chooseBestMove(board, cpuPos, cpuState.goalRow);
    if (nextStep[0] !== cpuPos[0] || nextStep[1] !== cpuPos[1]) {
      const simBoard = board.clone();
      simBoard.moveToken(2, { row: nextStep[0], col: nextStep[1] });

      const simCpuPos = nextStep;
      const simDCpu   = Math.max(0, getShortestPath(simBoard, simCpuPos, cpuState.goalRow).length - 1);
      const simP1Pos: [number, number] = [p1State.position.row, p1State.position.col];
      const simDPlayer = Math.max(0, getShortestPath(simBoard, simP1Pos, p1State.goalRow).length - 1);

      bestScore  = simDPlayer - simDCpu;
      bestAction = { type: 'MOVE', to: nextStep };
    }

    // ── Evaluate candidate walls ──────────────────────────────────────────
    if (cpuState.wallsRemaining > 0 && p1Path.length > 0) {
      const candidates = getCandidateWalls(board, p1Path);

      // Fallback pressure walls — only used when no race-winning wall was
      // found, and only when racing already loses:
      //  • Emergency defence — P1 is 1–2 steps from the goal and we trail:
      //    buy ≥ 2 extra steps even at a small own cost.
      //  • Roadblock pressure — P1 is close (≤ 3 steps) and we trail: cost-
      //    free walls on P1's forward line force the rusher around.  The
      //    race math makes a +1 detour turn-neutral (it cannot flip the
      //    outcome against perfect play), but it never weakens our own
      //    race, breaks the rusher's rhythm, invites human mistakes, and
      //    is what a saboteur should visibly be doing.
      let bestFallback: { action: BotAction; score: number } | null = null;

      for (const wall of candidates) {
        const result = this.evaluateWall(board, wall, cpuPos, p1Pos, cpuState.goalRow, p1State.goalRow);
        if (!result) continue;

        const wallScore = result.newDPlayer - result.newDCpu;
        const p1Gain    = result.newDPlayer - dPlayer;
        const ownCost   = result.newDCpu - dCpu;

        // Main rule — NET advantage ≥ 2.  A wall costs one turn, so the
        // break-even arithmetic for a race we trail or have level is
        // (gain on P1) − (own distance cost) ≥ 2 (e.g. +2/+0, +3/+1, +4/+2
        // all win; +2/+1 loses by exactly one turn).  The old ≥ 3 gate
        // almost never fired because walls on the shared centre column
        // slowed BOTH players equally (net 0).
        const netDelta = wallScore - baseScore;
        if (netDelta >= 2 && wallScore > bestScore) {
          bestScore  = wallScore;
          bestAction = { type: 'WALL', coords: [wall.row, wall.col], orientation: wall.orientation };
        }

        // Emergency defence — P1 is 1–2 steps from the goal and we trail.
        if (dCpu > dPlayer && dPlayer <= 2 && p1Gain >= 2 && ownCost <= 2) {
          const score = 100 + p1Gain;
          if (!bestFallback || score > bestFallback.score) {
            bestFallback = {
              action: { type: 'WALL', coords: [wall.row, wall.col], orientation: wall.orientation },
              score
            };
          }
        }
        // Roadblock pressure — P1 is close and we trail; take the
        // strongest cost-free detour on their forward line.
        else if (dCpu > dPlayer && dPlayer <= 3 && p1Gain >= 1 && ownCost === 0) {
          const score = p1Gain;
          if (!bestFallback || score > bestFallback.score) {
            bestFallback = {
              action: { type: 'WALL', coords: [wall.row, wall.col], orientation: wall.orientation },
              score
            };
          }
        }
      }

      // Take the best pressure wall unless a strong race-winning wall was
      // already found this turn.
      if (bestFallback && bestAction.type !== 'WALL') {
        bestAction = bestFallback.action;
      }
    }

    return bestAction;
  }

  // -------------------------------------------------------------------------
  // Shared utilities
  // -------------------------------------------------------------------------

  /**
   * Returns the strongest LEGAL destination: picks from getValidMoves(2)
   * (which includes jump-overs of an adjacent opponent) the move with the
   * shortest BFS distance to the goal.
   *
   * The raw BFS "next step" is token-blind — when it points at the
   * opponent's occupied cell, moveToken() rejects it and the CPU wastes
   * its turn; it also misses the two-cell jump, which is the key racing
   * advantage in head-to-head approach situations.
   */
  private chooseBestMove(board: Board, cpuPos: [number, number], cpuGoal: number): [number, number] {
    const moves = board.getValidMoves(2);
    if (moves.length === 0) return cpuPos;

    let best: [number, number] = [moves[0].row, moves[0].col];
    let bestLen = Infinity;
    for (const m of moves) {
      const len = getShortestPath(board, [m.row, m.col], cpuGoal).length;
      if (len > 0 && len < bestLen) {
        bestLen = len;
        best = [m.row, m.col];
      }
    }
    return best;
  }

  /**
   * Returns a MOVE action following the best legal step toward the goal.
   * Stays in place only when no legal moves exist at all.
   */
  private makeMoveAction(
    board: Board,
    cpuPos: [number, number],
    cpuGoal: number
  ): BotAction {
    return { type: 'MOVE', to: this.chooseBestMove(board, cpuPos, cpuGoal) };
  }

  /**
   * Speculatively places `wall` on a board clone and measures the resulting
   * distances for both players.
   *
   * Returns null if the speculative placement fails (overlap / blockade).
   */
  private evaluateWall(
    board: Board,
    wall: WallAction,
    cpuPos: [number, number],
    p1Pos:  [number, number],
    cpuGoal: number,
    p1Goal:  number
  ): { newDCpu: number; newDPlayer: number } | null {
    const simBoard = board.clone();
    const rollback = simBoard.speculativePlaceWall(wall.row, wall.col, wall.orientation);
    if (!rollback) return null; // slot already taken or creates blockade

    const newCpuPath    = getShortestPath(simBoard, cpuPos, cpuGoal);
    const newP1Path     = getShortestPath(simBoard, p1Pos,  p1Goal);

    rollback();

    // Unreachable paths are treated as infinite distance (999)
    const newDCpu    = newCpuPath.length > 0 ? newCpuPath.length - 1 : 999;
    const newDPlayer = newP1Path.length  > 0 ? newP1Path.length  - 1 : 999;

    return { newDCpu, newDPlayer };
  }
}
