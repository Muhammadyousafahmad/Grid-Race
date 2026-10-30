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
import { applyReadableText, fitCameraToViewport, SceneViewport } from '../config/ResponsiveCanvas';
import { THEME } from '../config/Theme';

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

  private viewport: SceneViewport = { width: 800, height: 800, zoom: 1 };
  private hudHeight = 68;
  private boardScale = 1;
  private boardOffsetX = 0;
  private boardOffsetY = 0;
  private boardLayer!: Phaser.GameObjects.Container;
  private backgroundGfx!: Phaser.GameObjects.Graphics;
  private boardPlateGfx!: Phaser.GameObjects.Graphics;
  private topBarGfx!: Phaser.GameObjects.Graphics;
  private hudPillX = 0;
  private hudPillWidth = 0;
  private playerOneChip!: Phaser.GameObjects.Container;
  private playerTwoChip!: Phaser.GameObjects.Container;
  private exitButton!: Phaser.GameObjects.Text;
  private bottomBar!: Phaser.GameObjects.Container;
  private bottomBarGfx!: Phaser.GameObjects.Graphics;
  private modeText!: Phaser.GameObjects.Text;
  private obstacleHit!: Phaser.GameObjects.Rectangle;
  private orientationHit!: Phaser.GameObjects.Rectangle;
  private obstacleCenterX = 0;
  private orientationCenterX = 0;
  private buttonCenterY = 0;
  private buttonWidth = 0;
  private bottomBarHeight = 98;

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
    this.viewport = fitCameraToViewport(this);
    this.board = new Board();
    this.animating = false;
    this.activeOrientation = 'H';
    this.selectedWallSlot = null;
    this.isObstacleMode = false;

    this.networkController = data?.network ?? null;
    this.localPlayerId = data?.localPlayerId ?? 1;
    this.boardLayer = this.add.container(0, 0).setDepth(5);

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
    this.boardLayer.add([this.placedWallsGfx, this.wallPreviewGfx, this.highlightContainer]);
    this.bannerContainer = this.add.container(0, 0).setDepth(50);

    this.layoutResponsiveScene();
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });

    this.turnManager.start();
    this.refreshMoveHighlights();
    applyReadableText(this);
  }

  private handleResize(): void {
    this.viewport = fitCameraToViewport(this);
    this.layoutResponsiveScene();
    applyReadableText(this);
  }

  private layoutResponsiveScene(): void {
    const narrow = this.viewport.width < 620;
    const shortWide = !narrow && this.viewport.height < 500;
    this.hudHeight = narrow ? 112 : (shortWide ? 56 : 68);
    this.bottomBarHeight = narrow ? 122 : (shortWide ? 80 : 104);
    this.boardScale = Math.min(
      1.2,
      (this.viewport.width - 24) / 688,
      (this.viewport.height - this.hudHeight - this.bottomBarHeight - 12) / 682
    );
    this.boardOffsetX = this.viewport.width / 2 - 400 * this.boardScale;
    const boardCenterY = this.hudHeight + (this.viewport.height - this.hudHeight - this.bottomBarHeight) / 2;
    this.boardOffsetY = boardCenterY - 402 * this.boardScale;
    this.boardLayer.setPosition(this.boardOffsetX, this.boardOffsetY).setScale(this.boardScale);

    if (this.backgroundGfx) {
      this.backgroundGfx.clear();
      this.backgroundGfx.fillStyle(THEME.colors.bg, 1);
      this.backgroundGfx.fillRect(0, 0, this.viewport.width, this.viewport.height);
      this.backgroundGfx.lineStyle(1, THEME.colors.border, 0.07);
      for (let i = 0; i < 7; i++) {
        this.backgroundGfx.strokeEllipse(
          this.viewport.width / 2,
          this.viewport.height / 2,
          460 + i * 48,
          320 + i * 38
        );
      }
    }

    if (this.boardPlateGfx) {
      const boardW = 9 * this.cellSize + 8 * this.wallGap;
      this.boardPlateGfx.clear();
      this.boardPlateGfx.fillStyle(THEME.colors.surface, 1);
      this.boardPlateGfx.fillRect(this.bX - 14, this.bY - 11, boardW + 28, boardW + 22);
      this.boardPlateGfx.lineStyle(2, THEME.colors.border, 1);
      this.boardPlateGfx.strokeRect(this.bX - 14, this.bY - 11, boardW + 28, boardW + 22);
    }

    if (this.topBarGfx) this.layoutTopHUD();
    if (this.bottomBar) {
      this.layoutBottomBar();
      this.drawObstacleButton();
      this.drawOrientationButton();
    }
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
          this.localPlayerId === 1 ? THEME.colors.success : THEME.colors.danger
        );
        break;

      case 'PLAYER2_WIN':
        this.showBanner(
          this.localPlayerId === 2 ? 'VICTORY!' : 'DEFEAT',
          this.localPlayerId === 2 ? 'You reached the opposite edge first.' : 'Player 2 reached the goal first.',
          this.localPlayerId === 2 ? THEME.colors.success : THEME.colors.danger
        );
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Double-Click / Tap-to-Place Pointer Tracking
  // ---------------------------------------------------------------------------

  private getNearestIntersection(x: number, y: number): { row: number; col: number } | null {
    const boardX = (x - this.boardOffsetX) / this.boardScale;
    const boardY = (y - this.boardOffsetY) / this.boardScale;
    let bestDist = Infinity;
    let bestSlot: { row: number; col: number } | null = null;

    for (let r = 1; r < GRID_SIZE; r += 2) {
      for (let c = 1; c < GRID_SIZE; c += 2) {
        const center = getIntersectionCenter(r, c);
        const dist = Phaser.Math.Distance.Between(boardX, boardY, center.x, center.y);
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
      const boardY = (pointer.y - this.boardOffsetY) / this.boardScale;
      if (this.isObstacleMode && boardY > 64 && boardY < 746
        && pointer.y < this.viewport.height - this.bottomBarHeight) {
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
      const boardY = (pointer.y - this.boardOffsetY) / this.boardScale;
      if (pointer.isDown && this.isObstacleMode && boardY > 64 && boardY < 746
        && pointer.y < this.viewport.height - this.bottomBarHeight) {
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
      this.showTemporaryToast('Invalid wall. Both players need an open route.', THEME.colors.danger);
      return false;
    }

    rollback();
    if (!this.board.commitWall(this.localPlayerId, row, col, orientation)) return false;

    const action: GameAction = { type: 'WALL', coords: [row, col], orientation };
    this.networkController?.sendAction(action);

    this.drawWall(row, col, orientation, this.localPlayerId === 1 ? THEME.colors.accent : THEME.colors.danger);
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

    const pillY = this.viewport.width < 540 ? 65 : 14;
    this.hudTurnPillGfx.clear();
    this.hudTurnPillGfx.fillStyle(THEME.colors.surfaceRaised, 1);
    this.hudTurnPillGfx.fillRect(this.hudPillX, pillY, this.hudPillWidth, 36);

    const borderColor = isWarning
      ? THEME.colors.danger
      : (isMyTurn ? THEME.colors.accent : THEME.colors.danger);
    const textHex = isWarning
      ? THEME.colors.dangerHex
      : (isMyTurn ? THEME.colors.accentHex : THEME.colors.dangerHex);

    this.hudTurnPillGfx.lineStyle(1.5, borderColor, isWarning ? 1 : 0.85);
    this.hudTurnPillGfx.strokeRect(this.hudPillX, pillY, this.hudPillWidth, 36);

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
    this.showTemporaryToast('Time expired. Your turn was skipped.', THEME.colors.danger);
  }

  private showTemporaryToast(msg: string, color: number): void {
    const mobile = this.viewport.width < 620;
    const toastWidth = Math.min(520, this.viewport.width - 32);
    const toastHeight = mobile ? 72 : 56;
    const toastY = mobile ? this.hudHeight + 40 : 120;
    const toast = this.add.container(this.viewport.width / 2, toastY).setDepth(40);
    const bg = this.add.graphics();
    bg.fillStyle(THEME.colors.border, 1);
    bg.fillRect(-toastWidth / 2, -toastHeight / 2, toastWidth, toastHeight);
    bg.lineStyle(1, color, 1);
    bg.strokeRect(-toastWidth / 2, -toastHeight / 2, toastWidth, toastHeight);

    const txt = this.add.text(0, 0, msg, {
      fontFamily: THEME.fonts.heading,
      fontSize: '16px',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: toastWidth - 24 }
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
    this.backgroundGfx = this.add.graphics();
    this.boardPlateGfx = this.add.graphics();
    this.boardLayer.add(this.boardPlateGfx);
    this.layoutResponsiveScene();
  }

  private layoutTopHUD(): void {
    const centerX = this.viewport.width / 2;
    const rightEdge = this.viewport.width;
    const mobile = this.viewport.width < 540;
    const shortWide = !mobile && this.viewport.height < 500;
    const pillWidth = Math.min(360, this.viewport.width * 0.42);
    this.hudPillWidth = pillWidth;
    this.hudPillX = centerX - pillWidth / 2;

    this.topBarGfx.clear();
    this.topBarGfx.fillStyle(THEME.colors.border, 1);
    this.topBarGfx.fillRect(0, 0, this.viewport.width, this.hudHeight);
    this.topBarGfx.lineStyle(1, THEME.colors.borderSoft, 1);
    this.topBarGfx.lineBetween(0, this.hudHeight, this.viewport.width, this.hudHeight);

    if (mobile) {
      const mobilePillWidth = Math.min(220, this.viewport.width * 0.64);
      this.hudPillWidth = mobilePillWidth;
      this.hudPillX = centerX - mobilePillWidth / 2;
      this.hudTurnPillGfx.clear();
      this.hudTurnPillGfx.fillStyle(THEME.colors.bg, 1);
      this.hudTurnPillGfx.fillRect(this.hudPillX, 65, mobilePillWidth, 36);
      this.hudTurnPillGfx.lineStyle(1, THEME.colors.borderSoft, 1);
      this.hudTurnPillGfx.strokeRect(this.hudPillX, 65, mobilePillWidth, 36);
      this.hudTurnDot.setPosition(this.hudPillX + 18, 83);
      this.hudTurnText.setPosition(centerX + 16, 83);
      this.playerOneChip.setPosition(12, 27);
      this.playerTwoChip.setPosition(rightEdge - 12, 27);
      this.layoutPips(this.p1Pips, 'left', true);
      this.layoutPips(this.cpuPips, 'right', true);
      this.exitButton.setPosition(rightEdge - 12, 83);
      return;
    }

    this.hudTurnPillGfx.clear();
    this.hudTurnPillGfx.fillStyle(THEME.colors.bg, 1);
    this.hudTurnPillGfx.fillRect(this.hudPillX, 14, pillWidth, 36);
    this.hudTurnPillGfx.lineStyle(1, THEME.colors.borderSoft, 1);
    this.hudTurnPillGfx.strokeRect(this.hudPillX, 14, pillWidth, 36);
    this.hudTurnDot.setPosition(this.hudPillX + 24, 32);
    this.hudTurnText.setPosition(centerX + 8, 32);
    this.playerOneChip.setPosition(16, 32);
    this.playerTwoChip.setPosition(rightEdge - 16, 32);
    this.layoutPips(this.p1Pips, 'left', false);
    this.layoutPips(this.cpuPips, 'right', false);
    this.exitButton.setPosition(rightEdge - 16, shortWide ? 48 : 55);
  }

  private layoutPips(pips: Phaser.GameObjects.Arc[], side: 'left' | 'right', mobile: boolean): void {
    pips.forEach((pip, index) => {
      const start = mobile ? 62 : 68;
      const spacing = mobile ? 6 : 13;
      const direction = side === 'left' ? 1 : -1;
      pip.setPosition(direction * (start + index * spacing), 0);
      pip.setScale(mobile ? 0.6 : 1);
    });
  }

  private buildTopHUD(): void {
    this.topBarGfx = this.add.graphics().setDepth(20);
    this.hudTurnPillGfx = this.add.graphics().setDepth(21);
    this.hudTurnDot = this.add.circle(0, 0, 6, THEME.colors.accent).setDepth(22);
    this.hudTurnText = this.add.text(0, 0, `YOUR TURN · ${TURN_TIME_LIMIT}s`, {
      fontFamily: THEME.fonts.heading,
      fontSize: '18px',
      color: THEME.colors.textPrimary,
      fontStyle: 'bold',
      letterSpacing: 0.4
    }).setOrigin(0.5).setDepth(22);

    const p1Label = this.localPlayerId === 1 ? 'YOU' : 'P1';
    const p2Label = this.networkController ? (this.localPlayerId === 2 ? 'YOU' : 'P2') : 'CPU';
    const playerOne = this.buildChip(p1Label, THEME.colors.accent, 'left');
    const playerTwo = this.buildChip(p2Label, THEME.colors.danger, 'right');
    this.playerOneChip = playerOne.container;
    this.playerTwoChip = playerTwo.container;
    this.p1Pips = playerOne.pips;
    this.cpuPips = playerTwo.pips;

    this.exitButton = this.add.text(0, 0, 'EXIT', {
      fontFamily: THEME.fonts.heading,
      fontSize: '14px',
      color: THEME.colors.onAccent,
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(25).setInteractive({ useHandCursor: true });

    this.exitButton.on('pointerdown', () => {
      this.turnManager.stopTimer();
      this.networkController?.disconnect();
      this.scene.start('MenuScene');
    });

    this.layoutTopHUD();
  }

  private buildChip(
    label: string,
    color: number,
    side: 'left' | 'right'
  ): { container: Phaser.GameObjects.Container; pips: Phaser.GameObjects.Arc[] } {
    const container = this.add.container(0, 0).setDepth(21);
    const iconX = side === 'left' ? 11 : -11;
    const labelX = side === 'left' ? 24 : -24;
    const pipStart = side === 'left' ? 68 : -68;
    const iconGfx = this.add.graphics();
    iconGfx.fillStyle(color, 1);
    iconGfx.fillCircle(iconX, 0, 7);
    const playerLabel = this.add.text(labelX, 0, label, {
      fontFamily: THEME.fonts.heading,
      fontSize: '16px',
      color: THEME.colors.onAccent,
      fontStyle: 'bold'
    }).setOrigin(side === 'left' ? 0 : 1, 0.5);

    const pips: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < INITIAL_WALLS; i++) {
      const x = side === 'left' ? pipStart + i * 13 : pipStart - i * 13;
      pips.push(this.add.circle(x, 0, 5, color, 1));
    }
    container.add([iconGfx, playerLabel, ...pips]);
    return { container, pips };
  }

  // ---------------------------------------------------------------------------
  // Clean Mobile Bottom Bar (No Confirm Button Needed)
  // ---------------------------------------------------------------------------

  private buildMobileBottomBar(difficulty?: Difficulty): void {
    this.bottomBar = this.add.container(0, 0).setDepth(20);
    this.bottomBarGfx = this.add.graphics();
    this.obstacleBtnGfx = this.add.graphics();
    this.obstacleBtnText = this.add.text(0, 0, '', {
      fontFamily: THEME.fonts.heading,
      fontSize: '18px',
      fontStyle: 'bold',
      align: 'center',
      lineSpacing: 0
    }).setOrigin(0.5);
    this.obstacleHit = this.add.rectangle(0, 0, 0, 0, 0, 0).setInteractive({ useHandCursor: true });
    this.obstacleHit.on('pointerdown', () => this.toggleObstacleMode());
    this.flipBtnGfx = this.add.graphics();
    this.flipBtnText = this.add.text(0, 0, '', {
      fontFamily: THEME.fonts.heading,
      fontSize: '18px',
      fontStyle: 'bold',
      align: 'center',
      lineSpacing: 0
    }).setOrigin(0.5);
    this.orientationHit = this.add.rectangle(0, 0, 0, 0, 0, 0).setInteractive({ useHandCursor: true });
    this.orientationHit.on('pointerdown', () => this.cycleOrientation());
    const modeTag = this.networkController ? `P2P: ${this.networkController.roomCode}` : (difficulty ?? 'BOT');
    this.modeText = this.add.text(0, 0, modeTag, {
      fontFamily: THEME.fonts.body,
      fontSize: '17px',
      color: THEME.colors.textMuted,
      fontStyle: 'bold'
    }).setOrigin(1, 0.5);

    this.bottomBar.add([
      this.bottomBarGfx,
      this.obstacleBtnGfx,
      this.obstacleBtnText,
      this.obstacleHit,
      this.flipBtnGfx,
      this.flipBtnText,
      this.orientationHit,
      this.modeText
    ]);

    this.layoutBottomBar();
    this.drawObstacleButton();
    this.drawOrientationButton();
  }

  private layoutBottomBar(): void {
    const mobile = this.viewport.width < 620;
    const shortWide = !mobile && this.viewport.height < 500;
    const centerY = mobile ? 82 : (shortWide ? 40 : 68);
    this.buttonWidth = mobile
      ? (this.viewport.width - 40) / 2
      : Math.min(300, this.viewport.width * 0.36);
    this.obstacleCenterX = mobile ? this.viewport.width * 0.25 : this.viewport.width * 0.24;
    this.orientationCenterX = mobile ? this.viewport.width * 0.75 : this.viewport.width * 0.62;
    this.buttonCenterY = centerY;
    this.bottomBar.setPosition(0, this.viewport.height - this.bottomBarHeight);

    this.bottomBarGfx.clear();
    this.bottomBarGfx.fillStyle(THEME.colors.surface, 1);
    this.bottomBarGfx.fillRect(0, 0, this.viewport.width, this.bottomBarHeight);
    this.bottomBarGfx.lineStyle(1, THEME.colors.border, 1);
    this.bottomBarGfx.lineBetween(0, 0, this.viewport.width, 0);

    this.obstacleBtnText.setPosition(this.obstacleCenterX, centerY);
    this.obstacleHit
      .removeInteractive()
      .setPosition(this.obstacleCenterX, centerY)
      .setSize(this.buttonWidth, 82)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, this.buttonWidth, 82),
        Phaser.Geom.Rectangle.Contains
      );
    if (this.obstacleHit.input) this.obstacleHit.input.cursor = 'pointer';
    this.flipBtnText.setPosition(this.orientationCenterX, centerY);
    this.orientationHit
      .removeInteractive()
      .setPosition(this.orientationCenterX, centerY)
      .setSize(this.buttonWidth, 82)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, this.buttonWidth, 82),
        Phaser.Geom.Rectangle.Contains
      );
    if (this.orientationHit.input) this.orientationHit.input.cursor = 'pointer';
    this.modeText.setPosition(this.viewport.width - 18, 20);
  }

  private drawObstacleButton(): void {
    this.obstacleBtnGfx.clear();
    const active = this.isObstacleMode;
    const bgCol = active ? THEME.colors.bgDeep : THEME.colors.surfaceRaised;
    const borderCol = active ? THEME.colors.accent : THEME.colors.border;
    const x = this.obstacleCenterX - this.buttonWidth / 2;
    const y = this.buttonCenterY - 38;

    this.obstacleBtnGfx.fillStyle(bgCol, 1);
    this.obstacleBtnGfx.fillRoundedRect(x, y, this.buttonWidth, 76, 10);
    this.obstacleBtnGfx.lineStyle(1.8, borderCol, 1);
    this.obstacleBtnGfx.strokeRoundedRect(x, y, this.buttonWidth, 76, 10);

    const mobile = this.viewport.width < 620;
    this.obstacleBtnText.setText(active
      ? (mobile ? 'TAP BOARD\nPLACE WALL' : 'TAP BOARD · PLACE WALL')
      : (mobile && this.buttonWidth < 120 ? 'WALL' : 'PLACE A WALL'));
    this.obstacleBtnText.setColor(active ? THEME.colors.accentHex : THEME.colors.textPrimary);
  }

  private toggleObstacleMode(): void {
    if (!this.turnManager.isPlayerTurn() || this.animating || this.turnManager.isGameOver()) return;
    if (this.board.getWallsRemaining(this.localPlayerId) <= 0) {
      this.showTemporaryToast('No walls remaining.', THEME.colors.danger);
      return;
    }

    this.isObstacleMode = !this.isObstacleMode;
    this.drawObstacleButton();

    if (this.isObstacleMode) {
      this.highlightContainer.removeAll(true);
      this.showTemporaryToast('Tap the selected slot again to place the wall.', THEME.colors.accent);
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
    const rgb = isH ? THEME.colors.accent : THEME.colors.danger;
    const hex = isH ? THEME.colors.accentHex : THEME.colors.dangerHex;

    this.flipBtnGfx.clear();
    this.flipBtnGfx.fillStyle(THEME.colors.surfaceRaised, 1);
    const x = this.orientationCenterX - this.buttonWidth / 2;
    const y = this.buttonCenterY - 38;
    this.flipBtnGfx.fillRoundedRect(x, y, this.buttonWidth, 76, 10);
    this.flipBtnGfx.lineStyle(1.8, rgb, 0.9);
    this.flipBtnGfx.strokeRoundedRect(x, y, this.buttonWidth, 76, 10);

    const mobile = this.viewport.width < 620;
    this.flipBtnText.setText(mobile
      ? `${isH ? 'HORIZONTAL' : 'VERTICAL'}\nWALL`
      : `WALL: ${isH ? 'HORIZONTAL' : 'VERTICAL'}`);
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

        gfx.fillStyle((r + c) % 4 === 0 ? THEME.colors.surfaceRaised : THEME.colors.bg, 1);
        gfx.fillRect(x - h, y - h, this.cellSize, this.cellSize);
        gfx.lineStyle(1, THEME.colors.border, 0.25);
        gfx.strokeRect(x - h, y - h, this.cellSize, this.cellSize);

        if (r === 0) {
          gfx.fillStyle(THEME.colors.accent, 0.1);
          gfx.fillRect(x - h + 1, y - h + 1, this.cellSize - 2, this.cellSize - 2);
        } else if (r === 16) {
          gfx.fillStyle(THEME.colors.danger, 0.1);
          gfx.fillRect(x - h + 1, y - h + 1, this.cellSize - 2, this.cellSize - 2);
        }

        const hit = this.add.rectangle(x, y, this.cellSize, this.cellSize, 0, 0)
          .setDepth(2).setInteractive({ useHandCursor: true });

        hit.on('pointerdown', () => {
          this.handleCellClick(r, c);
        });
        this.boardLayer.add(hit);
      }
    }
    this.boardLayer.add(gfx);
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
    this.player1Token = this.makeToken(16, 8, THEME.colors.accent, THEME.colors.bg, 'YOU', 'circle');
    this.cpuToken = this.makeToken(
      0, 8, THEME.colors.danger, THEME.colors.bg,
      this.networkController ? 'P2' : 'CPU', 'diamond'
    );
    this.boardLayer.add([this.player1Token, this.cpuToken]);
  }

  private makeToken(
    row: number,
    col: number,
    outerColor: number,
    innerColor: number,
    label: string,
    shape: 'circle' | 'diamond'
  ): Phaser.GameObjects.Container {
    const { x, y } = getCellCenter(row, col);
    const c = this.add.container(x, y);

    const base = this.add.circle(0, 0, 20, innerColor);
    base.setStrokeStyle(4, outerColor);
    const inner = shape === 'circle'
      ? this.add.circle(0, 0, 9, outerColor)
      : this.add.polygon(0, 0, [0, -11, 11, 0, 0, 11, -11, 0], outerColor);
    const text = this.add.text(0, 0, label, {
      fontFamily: THEME.fonts.heading,
      fontSize: label.length > 3 ? '8px' : '10px',
      color: THEME.colors.textPrimary,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    text.setData('responsiveMinPixels', 10);

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
      hl.fillStyle(THEME.colors.accent, 0.2);
      hl.fillRect(x - h, y - h, this.cellSize, this.cellSize);
      hl.lineStyle(2, THEME.colors.accent, 0.95);
      hl.strokeRect(x - h, y - h, this.cellSize, this.cellSize);

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
      this.showTemporaryToast('Opponent ran out of time. Their turn was skipped.', THEME.colors.danger);
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
      this.drawWall(r, col, action.orientation, opponentId === 1 ? THEME.colors.accent : THEME.colors.danger);
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
    this.wallPreviewGfx.fillStyle(available ? THEME.colors.accent : THEME.colors.danger, 0.8);
    this.wallPreviewGfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, 4);
    this.wallPreviewGfx.lineStyle(2, THEME.colors.border, 0.95);
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
    this.placedWallsGfx.lineStyle(1.5, THEME.colors.bg, 0.8);
    this.placedWallsGfx.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 4);
  }

  private flashReject(r: number, col: number, orientation: 'H' | 'V'): void {
    const { x, y } = getIntersectionCenter(r, col);
    const wLen = this.cellSize * 2 + this.wallGap;
    const isH  = orientation === 'H';
    const w = isH ? wLen : this.wallGap;
    const h = isH ? this.wallGap : wLen;

    const flash = this.add.graphics().setDepth(25);
    this.boardLayer.add(flash);
    flash.fillStyle(THEME.colors.danger, 0.9);
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

    const centerX = this.viewport.width / 2;
    const centerY = this.viewport.height / 2;
    const panelWidth = Math.min(560, this.viewport.width - 64);
    const panelHeight = 280;
    const overlay = this.add.graphics();
    overlay.fillStyle(THEME.colors.overlay, 0.78);
    overlay.fillRect(0, 0, this.viewport.width, this.viewport.height);

    const panel = this.add.graphics();
    panel.fillStyle(THEME.colors.surface, 1);
    panel.fillRect(centerX - panelWidth / 2, centerY - panelHeight / 2, panelWidth, panelHeight);
    panel.lineStyle(2, color, 1);
    panel.strokeRect(centerX - panelWidth / 2, centerY - panelHeight / 2, panelWidth, panelHeight);

    const t1 = this.add.text(centerX, centerY - 55, title, {
      fontFamily: THEME.fonts.heading,
      fontSize: '38px',
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const t2 = this.add.text(centerX, centerY - 5, subtitle, {
      fontFamily: THEME.fonts.body,
      fontSize: '18px',
      color: THEME.colors.textSecondary,
      align: 'center',
      wordWrap: { width: panelWidth - 64 }
    }).setOrigin(0.5);

    const btnBg = this.add.graphics();
    btnBg.fillStyle(THEME.colors.accent, 1);
    btnBg.fillRect(centerX - 120, centerY + 48, 240, 56);

    const btnText = this.add.text(centerX, centerY + 76, 'BACK TO MENU', {
      fontFamily: THEME.fonts.heading,
      fontSize: '18px',
      color: THEME.colors.onAccent,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const btnHit = this.add.rectangle(centerX, centerY + 76, 240, 60, 0, 0).setInteractive({ useHandCursor: true });

    btnHit.on('pointerdown', () => {
      this.networkController?.disconnect();
      this.scene.start('MenuScene');
    });

    this.bannerContainer.add([overlay, panel, t1, t2, btnBg, btnText, btnHit]);
    applyReadableText(this);
  }
}