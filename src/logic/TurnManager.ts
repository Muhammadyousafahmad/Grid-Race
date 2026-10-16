import { Board } from './Board';
import { Difficulty, BotAI } from './BotAI';
import { PlayerId } from '../config/Constants';

export const TURN_TIME_LIMIT = 15; // 15 seconds per turn

export type GameAction =
  | { type: 'MOVE'; to: [number, number] }
  | { type: 'WALL'; coords: [number, number]; orientation: 'H' | 'V' }
  | { type: 'TIMEOUT' };

export interface OpponentController {
  requestAction(board: Board): Promise<GameAction>;
}

export class BotController implements OpponentController {
  private readonly bot: BotAI;
  private readonly thinkMs: number;

  constructor(difficulty: Difficulty, thinkMs: number = 500) {
    this.bot = new BotAI(difficulty);
    this.thinkMs = thinkMs;
  }

  async requestAction(board: Board): Promise<GameAction> {
    await new Promise<void>((resolve) => setTimeout(resolve, this.thinkMs));
    return this.bot.decideAction(board) as GameAction;
  }
}

export type TurnPhase =
  | 'PLAYER_TURN'   // Local player's turn to act
  | 'OPPONENT_TURN' // Remote player or CPU thinking
  | 'GAME_OVER';

export type TurnManagerEvent =
  | { event: 'PHASE_CHANGED'; phase: TurnPhase }
  | { event: 'TIMER_TICK'; secondsRemaining: number; phase: TurnPhase }
  | { event: 'LOCAL_TIMEOUT' }
  | { event: 'OPPONENT_ACTION'; action: GameAction }
  | { event: 'PLAYER1_WIN' }
  | { event: 'PLAYER2_WIN' };

export type TurnEventCallback = (e: TurnManagerEvent) => void;

export class TurnManager {
  private board: Board;
  private opponent: OpponentController;
  private callback: TurnEventCallback;
  private phase: TurnPhase;
  public readonly localPlayerId: PlayerId;

  // Timer engine state
  private timeRemaining: number = TURN_TIME_LIMIT;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    board: Board,
    opponent: OpponentController,
    callback: TurnEventCallback,
    localPlayerId: PlayerId = 1
  ) {
    this.board = board;
    this.opponent = opponent;
    this.callback = callback;
    this.localPlayerId = localPlayerId;

    this.phase = localPlayerId === 1 ? 'PLAYER_TURN' : 'OPPONENT_TURN';
  }

  public start(): void {
    this.callback({ event: 'PHASE_CHANGED', phase: this.phase });
    this.resetAndStartTimer();

    if (this.phase === 'OPPONENT_TURN') {
      void this.runOpponentTurn();
    }
  }

  public getPhase(): TurnPhase {
    return this.phase;
  }

  public getTimeRemaining(): number {
    return this.timeRemaining;
  }

  public isPlayerTurn(): boolean {
    return this.phase === 'PLAYER_TURN';
  }

  public isGameOver(): boolean {
    return this.phase === 'GAME_OVER';
  }

  // ---------------------------------------------------------------------------
  // Timer Engine
  // ---------------------------------------------------------------------------

  private resetAndStartTimer(): void {
    this.stopTimer();
    if (this.phase === 'GAME_OVER') return;

    this.timeRemaining = TURN_TIME_LIMIT;
    this.callback({
      event: 'TIMER_TICK',
      secondsRemaining: this.timeRemaining,
      phase: this.phase
    });

    this.timerInterval = setInterval(() => {
      this.timeRemaining -= 1;

      this.callback({
        event: 'TIMER_TICK',
        secondsRemaining: Math.max(0, this.timeRemaining),
        phase: this.phase
      });

      if (this.timeRemaining <= 0) {
        this.handleTimeout();
      }
    }, 1000);
  }

  public stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private handleTimeout(): void {
    this.stopTimer();

    if (this.phase === 'PLAYER_TURN') {
      // Local player ran out of time -> forfeit turn
      this.callback({ event: 'LOCAL_TIMEOUT' });
      this.onLocalActionComplete({ type: 'TIMEOUT' });
    } else if (this.phase === 'OPPONENT_TURN') {
      // Safety watchdog: If network peer freezes and sends nothing after 17s
      this.callback({
        event: 'OPPONENT_ACTION',
        action: { type: 'TIMEOUT' }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Turn Lifecycle
  // ---------------------------------------------------------------------------

  public onLocalActionComplete(action?: GameAction): void {
    if (this.phase !== 'PLAYER_TURN') return;
    this.stopTimer();

    // Check if local player won before switching turn
    if (action?.type !== 'TIMEOUT' && this.board.hasPlayerWon(this.localPlayerId)) {
      this.setPhase('GAME_OVER');
      this.callback({ event: this.localPlayerId === 1 ? 'PLAYER1_WIN' : 'PLAYER2_WIN' });
      return;
    }

    this.setPhase('OPPONENT_TURN');
    this.resetAndStartTimer();
    void this.runOpponentTurn();
  }

  public onPlayer1ActionComplete(): void {
    this.onLocalActionComplete();
  }

  private async runOpponentTurn(): Promise<void> {
    let action: GameAction;
    try {
      action = await this.opponent.requestAction(this.board);
    } catch {
      action = { type: 'TIMEOUT' };
    }

    if (this.phase !== 'OPPONENT_TURN') return;
    this.callback({ event: 'OPPONENT_ACTION', action });
  }

  public onOpponentActionApplied(): void {
    if (this.phase !== 'OPPONENT_TURN') return;
    this.stopTimer();

    const opponentId: PlayerId = this.localPlayerId === 1 ? 2 : 1;
    if (this.board.hasPlayerWon(opponentId)) {
      this.setPhase('GAME_OVER');
      this.callback({ event: opponentId === 1 ? 'PLAYER1_WIN' : 'PLAYER2_WIN' });
      return;
    }

    this.setPhase('PLAYER_TURN');
    this.resetAndStartTimer();
  }

  private setPhase(next: TurnPhase): void {
    this.phase = next;
    this.callback({ event: 'PHASE_CHANGED', phase: next });
  }
}