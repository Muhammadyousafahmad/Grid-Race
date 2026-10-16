import Phaser from 'phaser';
import { Board } from '../logic/Board';
import { hasPath } from '../logic/Pathfinding';
import { Difficulty } from '../logic/BotAI';
import { NetworkController } from '../logic/NetworkController';
import {
  TurnManager,
  BotController,
  OpponentController,
  GameAction,
  TurnManagerEvent,
  TURN_TIME_LIMIT
} from '../logic/TurnManager';
import {
  GRID_SIZE,
  Coordinate,
  isWalkableCell,
  PlayerId,
  INITIAL_WALLS
} from '../config/Constants';
import {
  BOARD_LAYOUT,
  getCellCenter,
  getIntersectionCenter
} from '../config/BoardLayout';
import { THEME, mixColor } from '../config/Theme';

export interface GameSceneData {
  difficulty?: Difficulty;
  network?: NetworkController;
  localPlayerId?: PlayerId;
}

export class GameScene extends Phaser.Scene {
  private board!: Board;
  private turnManager!: TurnManager;
  private networkController: NetworkController | null = null;
  private localPlayerId: PlayerId = 1;

  private readonly cellSize = BOARD_LAYOUT.CELL_SIZE;
  private readonly wallGap  = BOARD_LAYOUT.WALL_GAP;
  private readonly bX       = BOARD_LAYOUT.BOARD_START_X;
  private readonly bY       = BOARD_LAYOUT.BOARD_START_Y;

  private player1Token!: Phaser.GameObjects.Container;
  private cpuToken!: Phaser.GameObjects.Container;
  private highlightContainer!: Phaser.GameObjects.Container;
  private wallPreviewGfx!: Phaser.GameObjects.Graphics;
  private placedWallsGfx!: Phaser.GameObjects.Graphics;

  private hudTurnPillGfx!: Phaser.GameObjects.Graphics;
  private hudTurnDot!: Phaser.GameObjects.Arc;
  private hudTurnText!: Phaser.GameObjects.Text;
  private p1Pips: Phaser.GameObjects.Arc[] = [];
  private cpuPips: Phaser.GameObjects.Arc[] = [];
  private bannerContainer!: Phaser.GameObjects.Container;

  // Mobile Bottom Bar Controls
  private isObstacleMode = false;
  private obstacleBtnGfx!: Phaser.GameObjects.Graphics;
  private obstacleBtnText!: Phaser.GameObjects.Text;
  private flipBtnGfx!: Phaser.GameObjects.Graphics;
  private flipBtnText!: Phaser.GameObjects.Text;

  private animating = false;
  private activeOrientation: 'H' | 'V' = 'H';
  private selectedWallSlot: { row: number; col: number } | null = null;

  constructor() { super({ key: 'GameScene' }); }

  create(data?: GameSceneData): void {
    this.board = new Board();
    this.animating = false;
    this.activeOrientation = 'H';
    this.selectedWallSlot = null;
    this.isObstacleMode = false;

    this.networkController = data?.network ?? null;
    this.localPlayerId = data?.localPlayerId ?? 1;

    let controller: OpponentController;
    if (this.networkController) {
      controller = this.networkController;
    } else {
      controller = new BotController(data?.difficulty ?? 'MEDIUM');
    }

    this.turnManager = new TurnManager(
      this.board,
      controller,
      (e) => this.onTurnEvent(e),
      this.localPlayerId
    );

    this.buildBackground();
    this.buildTopHUD();
    this.buildBoardCells();
    this.buildTokens();
    this.buildMobileBottomBar(data?.difficulty);
    this.setupGlobalPointer();
    this.setupKeys();

    this.placedWallsGfx = this.add.graphics().setDepth(6);
    this.wallPreviewGfx = this.add.graphics().setDepth(15);
    this.highlightContainer = this.add.container(0, 0).setDepth(5);
    this.bannerContainer = this.add.container(0, 0).setDepth(50);

    this.turnManager.start();
    this.refreshMoveHighlights();
  }

  private onTurnEvent(e: TurnManagerEvent): void {
    switch (e.event) {
      case 'PHASE_CHANGED':
        this.isObstacleMode = false;
        this.drawObstacleButton();
        if (e.phase === 'PLAYER_TURN') {
          this.refreshMoveHighlights();
        } else {
          this.highlightContainer.removeAll(true);
          this.clearWallSelection();
        }
        break;

      case 'TIMER_TICK':
        this.updateHUDTimer(e.secondsRemaining, e.phase);
        break;

      case 'LOCAL_TIMEOUT':
        this.handleLocalTimeout();
        break;

      case 'OPPONENT_ACTION':
        this.executeOpponentAction(e.action);
        break;

      case 'PLAYER1_WIN':
        this.showBanner(
          this.localPlayerId === 1 ? 'VICTORY!' : 'DEFEAT',
          this.localPlayerId === 1 ? 'You reached the opposite edge first.' : 'Player 1 reached the goal first.',
          this.localPlayerId === 1 ? 0x4ade80 : 0xf87171
        );
        break;

      case 'PLAYER2_WIN':
        this.showBanner(
          this.localPlayerId === 2 ? 'VICTORY!' : 'DEFEAT',
          this.localPlayerId === 2 ? 'You reached the opposite edge first.' : 'Player 2 reached the goal first.',
          this.localPlayerId === 2 ? 0x4ade80 : 0xf87171
        );
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Double-Click / Tap-to-Place Pointer Tracking
  // ---------------------------------------------------------------------------

  private getNearestIntersection(x: number, y: number): { row: number; col: number } | null {
    let bestDist = Infinity;
    let bestSlot: { row: number; col: number } | null = null;

    for (let r = 1; r < GRID_SIZE; r += 2) {
      for (let c = 1; c < GRID_SIZE; c += 2) {
        const center = getIntersectionCenter(r, c);
        const dist = Phaser.Math.Distance.Between(x, y, center.x, center.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestSlot = { row: r, col: c };
        }
      }
    }
    return bestSlot;
  }

  private setupGlobalPointer(): void {
    // 1. Pointer Down: Click to aim / Double-click to place
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isObstacleMode && pointer.y > 64 && pointer.y < 746) {
        const slot = this.getNearestIntersection(pointer.x, pointer.y);
        if (slot) {
          // If tapping the already selected obstacle -> DOUBLE CLICK: Place it!
          if (this.selectedWallSlot && this.selectedWallSlot.row === slot.row && this.selectedWallSlot.col === slot.col) {
            this.confirmSelectedWallPlacement();
          } else {
            // First click -> aim and preview at this slot
            this.selectWallSlot(slot.row, slot.col);
          }
        }
      }
    });

    // 2. Pointer Move: Drag to slide preview smoothly across slots
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && this.isObstacleMode && pointer.y > 64 && pointer.y < 746) {
        const slot = this.getNearestIntersection(pointer.x, pointer.y);
        if (slot && (!this.selectedWallSlot || this.selectedWallSlot.row !== slot.row || this.selectedWallSlot.col !== slot.col)) {
          this.selectWallSlot(slot.row, slot.col);
        }
      }
    });
  }

  private selectWallSlot(row: number, col: number): void {
    this.selectedWallSlot = { row, col };
    this.previewWallAt(row, col);
  }

  private clearWallSelection(): void {
    this.selectedWallSlot = null;
    this.hideWallPreview();
  }

  private confirmSelectedWallPlacement(): void {
    if (!this.selectedWallSlot || !this.turnManager.isPlayerTurn() || this.animating || this.turnManager.isGameOver()) return;
    const { row, col } = this.selectedWallSlot;
    if (this.tryPlaceWall(row, col, this.activeOrientation)) {
      this.isObstacleMode = false;
      this.drawObstacleButton();
      this.clearWallSelection();
    }
  }

  private tryPlaceWall(row: number, col: number, orientation: 'H' | 'V'): boolean {
    if (this.board.getWallsRemaining(this.localPlayerId) <= 0) return false;

    const rollback = this.board.speculativePlaceWall(row, col, orientation);
    if (!rollback) {
      this.flashReject(row, col, orientation);
      return false;
    }

    const p1Pos  = this.board.getPlayerPosition(1);
    const cpuPos = this.board.getPlayerPosition(2);
    const p1ok   = hasPath(this.board, [p1Pos.row, p1Pos.col], 0);
    const cpuOk  = hasPath(this.board, [cpuPos.row, cpuPos.col], 16);

    if (!p1ok || !cpuOk) {
      rollback();
      this.flashReject(row, col, orientation);
      this.showTemporaryToast('Illegal! Wall would trap a player.', 0xf87171);
      return false;
    }

    rollback();
    if (!this.board.commitWall(this.localPlayerId, row, col, orientation)) return false;

    const action: GameAction = { type: 'WALL', coords: [row, col], orientation };
    this.networkController?.sendAction(action);

    this.drawWall(row, col, orientation, this.localPlayerId === 1 ? 0x38bdf8 : 0xf87171);
    this.hideWallPreview();
    this.turnManager.onLocalActionComplete(action);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Timer & Top HUD
  // ---------------------------------------------------------------------------

  private updateHUDTimer(seconds: number, phase: 'PLAYER_TURN' | 'OPPONENT_TURN' | 'GAME_OVER'): void {
    if (phase === 'GAME_OVER') {
      this.hudTurnText.setText('GAME OVER');
      this.hudTurnText.setColor(THEME.colors.neutralHex);
      return;
    }

    const isMyTurn = phase === 'PLAYER_TURN';
    const isWarning = seconds <= 5;

    const turnLabel = isMyTurn ? 'YOUR TURN' : (this.networkController ? 'OPPONENT' : 'CPU');
    this.hudTurnText.setText(`${turnLabel} · ${seconds}s`);

    this.hudTurnPillGfx.clear();
    this.hudTurnPillGfx.fillStyle(THEME.colors.surfaceRaised, 1);
    this.hudTurnPillGfx.fillRoundedRect(220, 14, 360, 36, 18);

    const borderColor = isWarning
      ? THEME.colors.danger
      : (isMyTurn ? THEME.colors.accent : 0xa855f7);
    const textHex = isWarning
      ? THEME.colors.dangerHex
      : (isMyTurn ? THEME.colors.accentHex : '#c084fc');

    this.hudTurnPillGfx.lineStyle(1.8, borderColor, isWarning ? 1 : 0.75);
    this.hudTurnPillGfx.strokeRoundedRect(220, 14, 360, 36, 18);

    this.hudTurnText.setColor(textHex);
    this.hudTurnDot.setFillStyle(borderColor, 1);

    if (isWarning && seconds > 0) {
      this.playTickSynth(320 + (5 - seconds) * 60, 0.05);
      this.tweens.add({
        targets: [this.hudTurnText, this.hudTurnDot],
        scale: { from: 1.08, to: 1 },
        duration: 200,
        ease: 'Power1'
      });
    }

    const p1 = this.board.getWallsRemaining(1);
    const cpu = this.board.getWallsRemaining(2);
    this.p1Pips.forEach((pip, i) => pip.setFillStyle(i < p1 ? THEME.colors.accent : THEME.colors.border, i < p1 ? 1 : 0.4));
    this.cpuPips.forEach((pip, i) => pip.setFillStyle(i < cpu ? THEME.colors.danger : THEME.colors.border, i < cpu ? 1 : 0.4));
  }

  private handleLocalTimeout(): void {
    this.isObstacleMode = false;
    this.drawObstacleButton();
    this.clearWallSelection();
    this.networkController?.sendAction({ type: 'TIMEOUT' });
    this.showTemporaryToast('⏰ TIME EXPIRED! Turn skipped.', 0xf87171);
  }

  private showTemporaryToast(msg: string, color: number): void {
    const toast = this.add.container(400, 120).setDepth(40);
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0c15, 0.95);
    bg.fillRoundedRect(-180, -18, 360, 36, 18);
    bg.lineStyle(1.5, color, 1);
    bg.strokeRoundedRect(-180, -18, 360, 36, 18);

    const txt = this.add.text(0, 0, msg, {
      fontFamily: THEME.fonts.heading,
      fontSize: '12px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold'
    }).setOrigin(0.5);

    toast.add([bg, txt]);

    this.tweens.add({
      targets: toast,
      y: 110,
      alpha: { from: 1, to: 0 },
      delay: 1400,
      duration: 500,
      ease: 'Power2',
      onComplete: () => toast.destroy()
    });
  }

  // ---------------------------------------------------------------------------
  // Background & Header
  // ---------------------------------------------------------------------------

  private buildBackground(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(THEME.colors.bg, 1);
    gfx.fillRect(0, 0, 800, 800);

    const BANDS = 40;
    const bandH = 800 / BANDS;
    for (let i = 0; i < BANDS; i++) {
      gfx.fillStyle(mixColor(0x10162b, THEME.colors.bgDeep, i / (BANDS - 1)), 1);
      gfx.fillRect(0, i * bandH, 800, bandH + 1);
    }

    const boardW = 9 * this.cellSize + 8 * this.wallGap;
    const plateX = this.bX - 14;
    const plateY = this.bY - 11;
    gfx.fillStyle(THEME.colors.surface, 1);
    gfx.fillRoundedRect(plateX, plateY, boardW + 28, boardW + 22, 16);
    gfx.lineStyle(1.5, THEME.colors.border, 1);
    gfx.strokeRoundedRect(plateX, plateY, boardW + 28, boardW + 22, 16);
  }

  private buildTopHUD(): void {
    const topBar = this.add.graphics().setDepth(20);
    topBar.fillStyle(THEME.colors.surface, 1);
    topBar.fillRect(0, 0, 800, 64);
    topBar.lineStyle(1, THEME.colors.borderSoft, 1);
    topBar.lineBetween(0, 64, 800, 64);

    this.hudTurnPillGfx = this.add.graphics().setDepth(21);
    this.hudTurnDot = this.add.circle(248, 32, 5, THEME.colors.accent).setDepth(22);
    this.hudTurnText = this.add.text(400, 32, `YOUR TURN · ${TURN_TIME_LIMIT}s`, {
      fontFamily: THEME.fonts.heading,
      fontSize: '13px',
      color: THEME.colors.textPrimary,
      fontStyle: 'bold',
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(22);

    const p1Label = this.localPlayerId === 1 ? 'YOU' : 'P1';
    const p2Label = this.networkController ? (this.localPlayerId === 2 ? 'YOU' : 'P2') : 'CPU';

    this.p1Pips = this.buildChip(16, 32, p1Label, THEME.colors.accent, 'left');
    this.cpuPips = this.buildChip(784, 32, p2Label, THEME.colors.danger, 'right');

    const menuBtn = this.add.text(784, 18, 'EXIT', {
      fontFamily: THEME.fonts.heading,
      fontSize: '10px',
      color: THEME.colors.textMuted,
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(25).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerdown', () => {
      this.turnManager.stopTimer();
      this.networkController?.disconnect();
      this.scene.start('MenuScene');
    });
  }

  private buildChip(x: number, y: number, label: string, color: number, side: 'left' | 'right'): Phaser.GameObjects.Arc[] {
    const depth = 21;
    const g = this.add.graphics().setDepth(depth);
    const avX = side === 'left' ? x + 11 : x - 11;
    g.fillStyle(color, 1);
    g.fillCircle(avX, y, 6);

    const labelX = side === 'left' ? x + 24 : x - 24;
    this.add.text(labelX, y, label, {
      fontFamily: THEME.fonts.heading,
      fontSize: '11px',
      color: THEME.colors.textPrimary,
      fontStyle: 'bold'
    }).setOrigin(side === 'left' ? 0 : 1, 0.5).setDepth(depth);

    const pipStart = side === 'left' ? x + 68 : x - 68;
    const pips: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < INITIAL_WALLS; i++) {
      const px = side === 'left' ? pipStart + i * 11 : pipStart - i * 11;
      pips.push(this.add.circle(px, y, 4, color, 1).setDepth(depth));
    }
    return pips;
  }

  // ---------------------------------------------------------------------------
  // Clean Mobile Bottom Bar (No Confirm Button Needed)
  // ---------------------------------------------------------------------------

  private buildMobileBottomBar(difficulty?: Difficulty): void {
    const bar = this.add.container(0, 746).setDepth(20);

    const bg = this.add.graphics();
    bg.fillStyle(THEME.colors.surface, 1);
    bg.fillRect(0, 0, 800, 54);
    bg.lineStyle(1.5, THEME.colors.borderSoft, 1);
    bg.lineBetween(0, 0, 800, 0);

    // Button 1: Obstacle Mode Toggle
    this.obstacleBtnGfx = this.add.graphics();
    this.obstacleBtnText = this.add.text(175, 27, '', {
      fontFamily: THEME.fonts.heading,
      fontSize: '13px',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const obstacleHit = this.add.rectangle(175, 27, 260, 42, 0, 0).setInteractive({ useHandCursor: true });
    obstacleHit.on('pointerdown', () => this.toggleObstacleMode());

    // Button 2: Orientation Toggle
    this.flipBtnGfx = this.add.graphics();
    this.flipBtnText = this.add.text(485, 27, '', {
      fontFamily: THEME.fonts.heading,
      fontSize: '13px',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const flipHit = this.add.rectangle(485, 27, 260, 42, 0, 0).setInteractive({ useHandCursor: true });
    flipHit.on('pointerdown', () => this.cycleOrientation());

    // Mode Tag
    const modeTag = this.networkController ? `P2P: ${this.networkController.roomCode}` : (difficulty ?? 'BOT');
    const modeText = this.add.text(776, 27, modeTag, {
      fontFamily: THEME.fonts.body,
      fontSize: '11px',
      color: THEME.colors.textMuted,
      fontStyle: 'bold'
    }).setOrigin(1, 0.5);

    bar.add([bg, this.obstacleBtnGfx, this.obstacleBtnText, obstacleHit, this.flipBtnGfx, this.flipBtnText, flipHit, modeText]);

    this.drawObstacleButton();
    this.drawOrientationButton();
  }

  private drawObstacleButton(): void {
    this.obstacleBtnGfx.clear();
    const active = this.isObstacleMode;
    const bgCol = active ? 0x1d3557 : THEME.colors.surfaceRaised;
    const borderCol = active ? THEME.colors.accent : THEME.colors.border;

    this.obstacleBtnGfx.fillStyle(bgCol, 1);
    this.obstacleBtnGfx.fillRoundedRect(45, 6, 260, 42, 10);
    this.obstacleBtnGfx.lineStyle(1.8, borderCol, 1);
    this.obstacleBtnGfx.strokeRoundedRect(45, 6, 260, 42, 10);

    this.obstacleBtnText.setText(active ? '🧱 OBSTACLE: ON' : '🧱 ADD OBSTACLE');
    this.obstacleBtnText.setColor(active ? THEME.colors.accentHex : '#94a3b8');
  }

  private toggleObstacleMode(): void {
    if (!this.turnManager.isPlayerTurn() || this.animating || this.turnManager.isGameOver()) return;
    if (this.board.getWallsRemaining(this.localPlayerId) <= 0) {
      this.showTemporaryToast('No walls remaining!', 0xf87171);
      return;
    }

    this.isObstacleMode = !this.isObstacleMode;
    this.drawObstacleButton();

    if (this.isObstacleMode) {
      this.highlightContainer.removeAll(true);
      this.showTemporaryToast('Double-click/tap obstacle to place!', 0x38bdf8);
      if (!this.selectedWallSlot) {
        this.selectWallSlot(7, 7);
      }
    } else {
      this.clearWallSelection();
      this.refreshMoveHighlights();
    }
  }

  private drawOrientationButton(): void {
    const isH = this.activeOrientation === 'H';
    const rgb = isH ? THEME.colors.accent : 0xf43f5e;
    const hex = isH ? THEME.colors.accentHex : '#f43f5e';

    this.flipBtnGfx.clear();
    this.flipBtnGfx.fillStyle(THEME.colors.surfaceRaised, 1);
    this.flipBtnGfx.fillRoundedRect(355, 6, 260, 42, 10);
    this.flipBtnGfx.lineStyle(1.8, rgb, 0.9);
    this.flipBtnGfx.strokeRoundedRect(355, 6, 260, 42, 10);

    this.flipBtnText.setText(`🔄 ${isH ? 'HORIZONTAL' : 'VERTICAL'}`);
    this.flipBtnText.setColor(hex);
  }

  private cycleOrientation(): void {
    this.activeOrientation = this.activeOrientation === 'H' ? 'V' : 'H';
    this.drawOrientationButton();
    if (this.selectedWallSlot) {
      this.previewWallAt(this.selectedWallSlot.row, this.selectedWallSlot.col);
    }
  }

  // ---------------------------------------------------------------------------
  // Board Movement & Walkable Cells
  // ---------------------------------------------------------------------------

  private buildBoardCells(): void {
    const gfx = this.add.graphics().setDepth(1);
    for (let r = 0; r < GRID_SIZE; r += 2) {
      for (let c = 0; c < GRID_SIZE; c += 2) {
        const { x, y } = getCellCenter(r, c);
        const h = this.cellSize / 2;

        gfx.fillStyle(0x1b2138, 1);
        gfx.fillRoundedRect(x - h, y - h, this.cellSize, this.cellSize, 8);
        gfx.lineStyle(1, 0x2b3557, 0.95);
        gfx.strokeRoundedRect(x - h, y - h, this.cellSize, this.cellSize, 8);

        if (r === 0) {
          gfx.fillStyle(THEME.colors.accent, 0.08);
          gfx.fillRoundedRect(x - h + 2, y - h + 2, this.cellSize - 4, this.cellSize - 4, 6);
        } else if (r === 16) {
          gfx.fillStyle(THEME.colors.danger, 0.08);
          gfx.fillRoundedRect(x - h + 2, y - h + 2, this.cellSize - 4, this.cellSize - 4, 6);
        }

        const hit = this.add.rectangle(x, y, this.cellSize, this.cellSize, 0, 0)
          .setDepth(2).setInteractive({ useHandCursor: true });

        hit.on('pointerdown', () => {
          this.handleCellClick(r, c);
        });
      }
    }
  }

  private handleCellClick(row: number, col: number): void {
    if (this.isObstacleMode) return;

    this.clearWallSelection();
    if (!this.turnManager.isPlayerTurn() || this.animating || this.turnManager.isGameOver()) return;
    if (!isWalkableCell(row, col)) return;

    const myPos = this.board.getPlayerPosition(this.localPlayerId);
    const dest: Coordinate = { row, col };
    if (!this.board.canMoveToken(myPos, dest)) return;
    if (!this.board.moveToken(this.localPlayerId, dest)) return;

    const action: GameAction = { type: 'MOVE', to: [row, col] };
    this.networkController?.sendAction(action);

    this.animating = true;
    this.highlightContainer.removeAll(true);
    this.hideWallPreview();

    const targetToken = this.localPlayerId === 1 ? this.player1Token : this.cpuToken;
    const { x, y } = getCellCenter(row, col);

    this.tweens.add({
      targets: targetToken,
      x, y,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.animating = false;
        this.turnManager.onLocalActionComplete(action);
      }
    });
  }

  private buildTokens(): void {
    this.player1Token = this.makeToken(16, 8, 0x1d4ed8, 0x38bdf8, 'P1');
    this.cpuToken     = this.makeToken(0,  8, 0xb91c1c, 0xf87171, this.networkController ? 'P2' : 'CPU');
  }

  private makeToken(row: number, col: number, outerColor: number, innerColor: number, label: string): Phaser.GameObjects.Container {
    const { x, y } = getCellCenter(row, col);
    const c = this.add.container(x, y);

    const base = this.add.circle(0, 0, 20, outerColor);
    const inner = this.add.circle(0, 0, 14, innerColor);
    const text = this.add.text(0, 0, label, {
      fontFamily: THEME.fonts.heading,
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    c.add([base, inner, text]);
    c.setDepth(10);
    return c;
  }

  private setupKeys(): void {
    this.input.keyboard?.on('keydown-R', () => this.cycleOrientation());
    this.input.keyboard?.on('keydown-SPACE', () => this.cycleOrientation());
  }

  private refreshMoveHighlights(): void {
    this.highlightContainer.removeAll(true);
    if (!this.turnManager.isPlayerTurn() || this.animating || this.turnManager.isGameOver() || this.isObstacleMode) return;

    for (const move of this.board.getValidMoves(this.localPlayerId)) {
      const { x, y } = getCellCenter(move.row, move.col);
      const h = this.cellSize / 2;

      const hl = this.add.graphics();
      hl.fillStyle(0x38bdf8, 0.28);
      hl.fillRoundedRect(x - h, y - h, this.cellSize, this.cellSize, 7);
      hl.lineStyle(2, 0x38bdf8, 0.95);
      hl.strokeRoundedRect(x - h, y - h, this.cellSize, this.cellSize, 7);

      const zone = this.add.rectangle(x, y, this.cellSize, this.cellSize, 0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.handleCellClick(move.row, move.col);
      });

      this.highlightContainer.add([hl, zone]);
    }
  }

  private executeOpponentAction(action: GameAction): void {
    if (this.turnManager.isGameOver()) return;

    const opponentId: PlayerId = this.localPlayerId === 1 ? 2 : 1;
    const targetToken = opponentId === 1 ? this.player1Token : this.cpuToken;

    if (action.type === 'TIMEOUT') {
      this.showTemporaryToast('⏰ Opponent ran out of time! Turn skipped.', 0xf87171);
      this.turnManager.onOpponentActionApplied();
      return;
    }

    if (action.type === 'MOVE') {
      const [row, col] = action.to;
      this.board.moveToken(opponentId, { row, col });

      const { x, y } = getCellCenter(row, col);
      this.animating = true;
      this.tweens.add({
        targets: targetToken,
        x, y,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          this.animating = false;
          this.turnManager.onOpponentActionApplied();
        }
      });
    } else {
      const [r, col] = action.coords;
      this.board.commitWall(opponentId, r, col, action.orientation);
      this.drawWall(r, col, action.orientation, opponentId === 1 ? 0x38bdf8 : 0xf87171);
      this.turnManager.onOpponentActionApplied();
    }
  }

  private previewWallAt(r: number, col: number): void {
    const { x, y } = getIntersectionCenter(r, col);
    const wLen = this.cellSize * 2 + this.wallGap;
    const isH  = this.activeOrientation === 'H';
    const w = isH ? wLen : this.wallGap;
    const h = isH ? this.wallGap : wLen;

    const available = this.board.isWallSlotAvailable(r, col, this.activeOrientation, false);

    this.wallPreviewGfx.clear();
    this.wallPreviewGfx.fillStyle(available ? 0x38bdf8 : 0xef4444, 0.6);
    this.wallPreviewGfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, 4);
    this.wallPreviewGfx.lineStyle(2, available ? 0xffffff : 0xef4444, 0.95);
    this.wallPreviewGfx.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 4);
  }

  private hideWallPreview(): void {
    this.wallPreviewGfx.clear();
  }

  private drawWall(r: number, col: number, orientation: 'H' | 'V', color: number): void {
    const { x, y } = getIntersectionCenter(r, col);
    const wLen = this.cellSize * 2 + this.wallGap;
    const isH  = orientation === 'H';
    const w = isH ? wLen : this.wallGap;
    const h = isH ? this.wallGap : wLen;

    this.placedWallsGfx.fillStyle(color, 1);
    this.placedWallsGfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, 4);
    this.placedWallsGfx.lineStyle(1.5, 0xffffff, 0.6);
    this.placedWallsGfx.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 4);
  }

  private flashReject(r: number, col: number, orientation: 'H' | 'V'): void {
    const { x, y } = getIntersectionCenter(r, col);
    const wLen = this.cellSize * 2 + this.wallGap;
    const isH  = orientation === 'H';
    const w = isH ? wLen : this.wallGap;
    const h = isH ? this.wallGap : wLen;

    const flash = this.add.graphics().setDepth(25);
    flash.fillStyle(0xef4444, 0.9);
    flash.fillRoundedRect(x - w / 2, y - h / 2, w, h, 4);
    this.tweens.add({ targets: flash, alpha: 0, duration: 320, ease: 'Power2', onComplete: () => flash.destroy() });
  }

  private playTickSynth(freq: number, duration: number): void {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  private showBanner(title: string, subtitle: string, color: number): void {
    this.turnManager.stopTimer();
    this.highlightContainer.removeAll(true);
    this.clearWallSelection();
    this.bannerContainer.removeAll(true);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x03040a, 0.85);
    overlay.fillRect(0, 0, 800, 800);

    const panel = this.add.graphics();
    panel.fillStyle(THEME.colors.surface, 1);
    panel.fillRoundedRect(172, 266, 456, 268, 18);
    panel.lineStyle(1.5, color, 0.85);
    panel.strokeRoundedRect(172, 266, 456, 268, 18);

    const t1 = this.add.text(400, 360, title, {
      fontFamily: THEME.fonts.heading,
      fontSize: '32px',
      color: '#' + color.toString(16).padStart(6, '0'),
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const t2 = this.add.text(400, 400, subtitle, {
      fontFamily: THEME.fonts.body,
      fontSize: '14px',
      color: THEME.colors.textSecondary
    }).setOrigin(0.5);

    const btnBg = this.add.graphics();
    btnBg.fillStyle(color, 1);
    btnBg.fillRoundedRect(305, 450, 190, 42, 10);

    const btnText = this.add.text(400, 471, 'BACK TO MENU', {
      fontFamily: THEME.fonts.heading,
      fontSize: '13px',
      color: THEME.colors.onAccent,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const btnHit = this.add.rectangle(400, 471, 190, 42, 0, 0).setInteractive({ useHandCursor: true });

    btnHit.on('pointerdown', () => {
      this.networkController?.disconnect();
      this.scene.start('MenuScene');
    });

    this.bannerContainer.add([overlay, panel, t1, t2, btnBg, btnText, btnHit]);
  }
}