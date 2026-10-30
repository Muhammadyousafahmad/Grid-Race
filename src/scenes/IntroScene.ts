import Phaser from 'phaser';
import { applyReadableText, fitCameraToViewport, SceneViewport } from '../config/ResponsiveCanvas';
import { THEME } from '../config/Theme';

export class IntroScene extends Phaser.Scene {
  private progress = 0;
  private progressFill!: Phaser.GameObjects.Graphics;
  private progressPercentText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private orbBlue!: Phaser.GameObjects.Container;
  private orbRed!: Phaser.GameObjects.Container;
  private isColliding = false;
  private finished = false;
  private logoBottom = 0;
  private viewport: SceneViewport = { width: 800, height: 800, zoom: 1 };
  private gridCenterX = 400;
  private gridCenterY = 400;
  private gridTravel = 112;
  private progressX = 400;
  private progressY = 600;
  private progressWidth = 340;

  constructor() {
    super({ key: 'IntroScene' });
  }

  create(): void {
    this.viewport = fitCameraToViewport(this);
    this.progress = 0;
    this.isColliding = false;
    this.finished = false;

    this.buildBackground();
    this.buildLogo();
    this.buildCyberGrid();
    this.buildOrbs();
    this.buildProgressBar();
    this.setupInteractivity();
    this.startLoadingSimulation();
    applyReadableText(this);

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  private handleResize(): void {
    this.viewport = fitCameraToViewport(this);
    this.scene.restart();
  }

  // ---------------------------------------------------------------------------
  // Background & Atmosphere
  // ---------------------------------------------------------------------------

  private buildBackground(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(THEME.colors.bg, 1);
    gfx.fillRect(0, 0, this.viewport.width, this.viewport.height);

    gfx.lineStyle(1, THEME.colors.border, 0.08);
    for (let i = 0; i < 8; i++) {
      gfx.strokeEllipse(this.viewport.width / 2, this.viewport.height / 2, 260 + i * 38, 200 + i * 32);
    }
  }

  private buildLogo(): void {
    const typeScale = Math.min(1, this.viewport.width / 520, this.viewport.height / 580);
    const titleSize = 64 * typeScale;
    const subtitleSize = Math.max(12, 16 * typeScale);
    const subtitleY = titleSize * 0.8;
    const logoY = Math.max(this.viewport.height * 0.17, titleSize * 0.9);
    this.logoBottom = logoY + Math.max(titleSize * 0.6, subtitleY + subtitleSize * 0.75);
    const logoContainer = this.add.container(this.viewport.width / 2, logoY - 5).setAlpha(0);

    const textGrid = this.add.text(0, 0, 'GRID RACE', {
      fontFamily: THEME.fonts.heading,
      fontSize: `${titleSize}px`,
      color: THEME.colors.textPrimary,
      fontStyle: 'bold',
      letterSpacing: 1
    }).setOrigin(0.5);

    const subtitle = this.add.text(0, subtitleY, 'TWO RUNNERS. ONE CHANGING ROUTE.', {
      fontFamily: THEME.fonts.body,
      fontSize: `${subtitleSize}px`,
      color: THEME.colors.textSecondary,
      fontStyle: 'bold',
      letterSpacing: Math.min(2, subtitleSize / 8)
    }).setOrigin(0.5);

    logoContainer.setDepth(5).add([textGrid, subtitle]);

    this.tweens.add({
      targets: logoContainer,
      alpha: 1,
      y: logoY,
      duration: 260,
      ease: 'Power2'
    });
  }

  // ---------------------------------------------------------------------------
  private buildCyberGrid(): void {
    const grid = this.add.graphics().setDepth(2);
    const cx = this.viewport.width / 2;
    const gridTop = this.logoBottom + 18;
    const bottom = this.viewport.height * 0.78 - 36;
    const size = Math.max(80, Math.min(
      420,
      this.viewport.width * 0.88,
      this.viewport.height * 0.4,
      bottom - gridTop
    ));
    const cy = gridTop + size / 2;
    this.gridCenterX = cx;
    this.gridCenterY = cy;
    this.gridTravel = Math.min(size * 0.44, Math.max(14, size / 2 - 18));
    const cell = size / 9;
    const left = cx - size / 2;
    const top = cy - size / 2;

    grid.fillStyle(THEME.colors.surface, 1);
    grid.fillRect(left - 10, top - 10, size + 20, size + 20);
    grid.lineStyle(1, THEME.colors.border, 0.45);
    grid.strokeRect(left - 10, top - 10, size + 20, size + 20);
    grid.fillStyle(THEME.colors.map, 1);
    grid.fillRect(left, top, size, size);
    grid.lineStyle(1, THEME.colors.border, 0.3);
    for (let i = 0; i <= 9; i++) {
      grid.lineBetween(left + i * cell, top, left + i * cell, top + size);
      grid.lineBetween(left, top + i * cell, left + size, top + i * cell);
    }

    grid.lineStyle(3, THEME.colors.accent, 0.7);
    grid.lineBetween(cx, top + size - cell / 2, cx, cy + cell);
    grid.lineBetween(cx, cy + cell, cx + cell, cy);
    grid.lineBetween(cx + cell, cy, cx, cy - cell);
    grid.lineBetween(cx, cy - cell, cx, top + cell / 2);

    grid.fillStyle(THEME.colors.border, 1);
    grid.fillRect(cx - 24, cy + cell - 3, 48, 6);
  }

  private buildOrbs(): void {
    this.orbBlue = this.makeOrb(THEME.colors.accent, THEME.colors.surface, 'YOU');
    this.orbRed = this.makeOrb(THEME.colors.danger, THEME.colors.surface, 'CPU');
    this.orbBlue.setDepth(10);
    this.orbRed.setDepth(10);
  }

  private makeOrb(outerCol: number, innerCol: number, label: string): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);

    const ring = this.add.circle(0, 0, 15, innerCol, 1);
    ring.setStrokeStyle(3, outerCol);
    const core = this.add.circle(0, 0, 10, outerCol, 1);
    const text = this.add.text(0, 0, label, {
      fontFamily: THEME.fonts.heading,
      fontSize: '8px',
      color: THEME.colors.onAccent,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    text.setData('responsiveMinPixels', 10);

    c.add([ring, core, text]);

    return c;
  }

  // ---------------------------------------------------------------------------
  private buildProgressBar(): void {
    const cx = this.viewport.width / 2;
    const cy = this.viewport.height * 0.78;
    const w = Math.min(460, this.viewport.width * 0.54);
    const h = 12;
    this.progressX = cx;
    this.progressY = cy;
    this.progressWidth = w;

    const bgGfx = this.add.graphics().setDepth(15);
    bgGfx.fillStyle(THEME.colors.surfaceRaised, 1);
    bgGfx.fillRect(cx - w / 2, cy - h / 2, w, h);
    bgGfx.lineStyle(1, THEME.colors.borderSoft, 1);
    bgGfx.strokeRect(cx - w / 2, cy - h / 2, w, h);

    this.progressFill = this.add.graphics().setDepth(16);

    this.statusText = this.add.text(cx, cy - 20, 'PLOTTING THE OPENING ROUTE...', {
      fontFamily: THEME.fonts.body,
      fontSize: '16px',
      color: THEME.colors.textSecondary,
      fontStyle: 'bold',
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(17);

    this.progressPercentText = this.add.text(cx, cy + 22, '0%', {
      fontFamily: THEME.fonts.heading,
      fontSize: '18px',
      color: THEME.colors.accentHex,
      fontStyle: 'bold',
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(17);

    const skipHint = this.add.text(cx, Math.min(this.viewport.height - 22, this.viewport.height * 0.92), 'TAP · SPACE · ENTER TO SKIP', {
      fontFamily: THEME.fonts.body,
      fontSize: '15px',
      color: THEME.colors.textMuted,
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(17);

    this.tweens.add({
      targets: skipHint,
      alpha: { from: 0.3, to: 0.8 },
      duration: 700,
      yoyo: true,
      repeat: -1
    });
  }

  private updateProgressBar(val: number): void {
    const maxW = this.progressWidth - 4;
    const h = 14;
    const curW = Math.max(0, maxW * val);

    this.progressFill.clear();

    this.progressFill.fillStyle(THEME.colors.accent, 1);
    this.progressFill.fillRect(this.progressX - maxW / 2, this.progressY - h / 2, curW, h);

    this.progressPercentText.setText(`${Math.round(val * 100)}%`);

    if (val > 0.4 && val < 0.8) {
      this.statusText.setText('PLOTTING THE SHORTEST ROUTE...');
    } else if (val >= 0.8) {
      this.statusText.setText('MAP READY');
      this.statusText.setColor(THEME.colors.successHex);
      this.progressPercentText.setColor(THEME.colors.successHex);
    }
  }

  // ---------------------------------------------------------------------------
  // Frame Update Loop (Orb Orbiting)
  // ---------------------------------------------------------------------------

  update(_time: number, _delta: number): void {
    if (this.isColliding) return;

    const cx = this.gridCenterX;
    const cy = this.gridCenterY;
    const t = this.progress;
    this.orbBlue.setPosition(cx, cy + this.gridTravel - t * this.gridTravel * 1.7);
    this.orbRed.setPosition(cx, cy - this.gridTravel + t * this.gridTravel * 1.7);
  }

  // ---------------------------------------------------------------------------
  // Loading Simulation & Impact Sequence
  // ---------------------------------------------------------------------------

  private startLoadingSimulation(): void {
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 640,
      ease: 'Cubic.easeInOut',
      onUpdate: (tw) => {
        this.progress = tw.getValue()??0;
        this.updateProgressBar(this.progress);
      },
      onComplete: () => {
        this.triggerCollisionAndFinish();
      }
    });
  }

  private triggerCollisionAndFinish(): void {
    if (this.finished) return;
    this.finished = true;
    this.isColliding = true;

    this.cameras.main.fadeOut(140, 244, 240, 228);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }

  private setupInteractivity(): void {
    // Click or keypress immediately skips the intro
    this.input.on('pointerdown', () => this.skipIntro());
    this.input.keyboard?.on('keydown-SPACE', () => this.skipIntro());
    this.input.keyboard?.on('keydown-ENTER', () => this.skipIntro());
  }

  private skipIntro(): void {
    if (this.finished) return;
    this.finished = true;
    this.cameras.main.fadeOut(140, 244, 240, 228);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }

}