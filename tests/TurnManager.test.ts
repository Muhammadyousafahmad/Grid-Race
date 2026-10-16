import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Board } from '../src/logic/Board';
import {
  TurnManager,
  BotController,
  TurnPhase,
  TurnManagerEvent,
  GameAction,
  OpponentController
} from '../src/logic/TurnManager';

// ─────────────────────────────────────────────────────────────────────────────
// Stub controller that resolves immediately (0 ms) with a preset action
// ─────────────────────────────────────────────────────────────────────────────
class StubController implements OpponentController {
  private action: GameAction;
  constructor(action: GameAction = { type: 'MOVE', to: [2, 8] }) {
    this.action = action;
  }
  async requestAction(_board: Board): Promise<GameAction> {
    return this.action;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: collect events synchronously after awaiting a micro-task tick
// ─────────────────────────────────────────────────────────────────────────────
async function flushPromises(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// TurnManager – phase transitions
// ─────────────────────────────────────────────────────────────────────────────
describe('TurnManager – phase transitions', () => {
  let board: Board;
  let events: TurnManagerEvent[];
  let tm: TurnManager;

  beforeEach(() => {
    board  = new Board();
    events = [];
    tm     = new TurnManager(board, new StubController(), (e) => events.push(e));
  });

  it('starts in PLAYER_TURN phase', () => {
    expect(tm.getPhase()).toBe('PLAYER_TURN');
    expect(tm.isPlayerTurn()).toBe(true);
    expect(tm.isGameOver()).toBe(false);
  });

  it('transitions to OPPONENT_TURN when player action completes', async () => {
    board.moveToken(1, { row: 14, col: 8 }); // legal move for P1
    tm.onPlayer1ActionComplete();

    // Phase should flip to OPPONENT_TURN immediately (synchronously)
    const phaseEvt = events.find(e => e.event === 'PHASE_CHANGED' && (e as { phase: TurnPhase }).phase === 'OPPONENT_TURN');
    expect(phaseEvt).toBeDefined();
  });

  it('emits OPPONENT_ACTION after requestAction resolves', async () => {
    board.moveToken(1, { row: 14, col: 8 });
    tm.onPlayer1ActionComplete();

    await flushPromises();

    const actionEvt = events.find(e => e.event === 'OPPONENT_ACTION') as
      { event: 'OPPONENT_ACTION'; action: GameAction } | undefined;
    expect(actionEvt).toBeDefined();
    expect(actionEvt!.action.type).toBe('MOVE');
  });

  it('returns to PLAYER_TURN after opponent action is applied', async () => {
    board.moveToken(1, { row: 14, col: 8 });
    tm.onPlayer1ActionComplete();

    await flushPromises();

    // Scene would have called onOpponentActionApplied() after animating
    board.moveToken(2, { row: 2, col: 8 }); // apply the stub action
    tm.onOpponentActionApplied();

    expect(tm.getPhase()).toBe('PLAYER_TURN');
    expect(tm.isPlayerTurn()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TurnManager – win detection
// ─────────────────────────────────────────────────────────────────────────────
describe('TurnManager – win detection', () => {
  let board: Board;
  let events: TurnManagerEvent[];
  let tm: TurnManager;

  beforeEach(() => {
    board  = new Board();
    events = [];
  });

  it('emits PLAYER1_WIN when P1 reaches row 0 after their action', () => {
    tm = new TurnManager(board, new StubController(), (e) => events.push(e));

    // Teleport P1 to row 0 to simulate winning move
    (board as any).players[1].position = { row: 0, col: 8 };

    tm.onPlayer1ActionComplete();

    expect(tm.getPhase()).toBe('GAME_OVER');
    const win = events.find(e => e.event === 'PLAYER1_WIN');
    expect(win).toBeDefined();
  });

  it('emits PLAYER2_WIN when CPU reaches row 16 after its action', async () => {
    // CPU's stub action moves to (2, 8) — won't win in default state
    // Instead, teleport CPU to row 16 before onOpponentActionApplied
    const stubAction: GameAction = { type: 'MOVE', to: [16, 8] };
    tm = new TurnManager(board, new StubController(stubAction), (e) => events.push(e));

    board.moveToken(1, { row: 14, col: 8 });
    tm.onPlayer1ActionComplete();
    await flushPromises();

    // Teleport CPU to winning position in board model
    (board as any).players[2].position = { row: 16, col: 8 };

    tm.onOpponentActionApplied();

    expect(tm.getPhase()).toBe('GAME_OVER');
    const loss = events.find(e => e.event === 'PLAYER2_WIN');
    expect(loss).toBeDefined();
  });

  it('ignores player actions once game is over', () => {
    tm = new TurnManager(board, new StubController(), (e) => events.push(e));
    (board as any).players[1].position = { row: 0, col: 8 };
    tm.onPlayer1ActionComplete(); // triggers GAME_OVER

    events.length = 0; // clear

    // Should be silently ignored
    tm.onPlayer1ActionComplete();
    expect(events.length).toBe(0);
    expect(tm.getPhase()).toBe('GAME_OVER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BotController – interface compliance
// ─────────────────────────────────────────────────────────────────────────────
describe('BotController', () => {
  it('resolves with a legal GameAction after the artificial delay', async () => {
    vi.useFakeTimers();

    const board = new Board();
    const ctrl  = new BotController('EASY', 500);

    const resultPromise = ctrl.requestAction(board);

    vi.advanceTimersByTime(500);
    const action = await resultPromise;

    expect(['MOVE', 'WALL']).toContain(action.type);

    vi.useRealTimers();
  });

  it('accepts all three difficulty levels without throwing', async () => {
    vi.useFakeTimers();
    const board = new Board();

    for (const diff of ['EASY', 'MEDIUM', 'HARD'] as const) {
      const ctrl = new BotController(diff, 0);
      const p = ctrl.requestAction(board);
      vi.advanceTimersByTime(1);
      const action = await p;
      expect(['MOVE', 'WALL']).toContain(action.type);
    }

    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OpponentController – wall action path
// ─────────────────────────────────────────────────────────────────────────────
describe('TurnManager – opponent WALL action', () => {
  it('handles a WALL action emitted by the opponent controller', async () => {
    const board  = new Board();
    const events: TurnManagerEvent[] = [];

    const wallAction: GameAction = { type: 'WALL', coords: [7, 7], orientation: 'H' };
    const tm = new TurnManager(board, new StubController(wallAction), (e) => events.push(e));

    board.moveToken(1, { row: 14, col: 8 });
    tm.onPlayer1ActionComplete();

    await flushPromises();

    const actionEvt = events.find(e => e.event === 'OPPONENT_ACTION') as
      { event: 'OPPONENT_ACTION'; action: GameAction } | undefined;
    expect(actionEvt).toBeDefined();
    expect(actionEvt!.action.type).toBe('WALL');
    if (actionEvt!.action.type === 'WALL') {
      expect(actionEvt!.action.coords).toEqual([7, 7]);
      expect(actionEvt!.action.orientation).toBe('H');
    }
  });
});

