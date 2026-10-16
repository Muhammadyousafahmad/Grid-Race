import Phaser from 'phaser';
import { THEME, mixColor } from '../config/Theme';

export class IntroScene extends Phaser.Scene {
  private progress = 0;
  private progressFill!: Phaser.GameObjects.Graphics;
  private progressPercentText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private orbBlue!: Phaser.GameObjects.Container;
  private orbRed!: Phaser.GameObjects.Container;
  private orbitAngle = 0;
  private isColliding = false;
  private finished = false;

  constructor() {
    super({ key: 'IntroScene' });
  }

  create(): void {
    this.progress = 0;
    this.orbitAngle = 0;
    this.isColliding = false;
    this.finished = false;

    this.buildBackground();
    this.buildLogo();
    this.buildCyberGrid();
    this.buildOrbs();
    this.buildProgressBar();
    this.setupInteractivity();
    this.startLoadingSimulation();
  }

  // ---------------------------------------------------------------------------
  // Background & Atmosphere
  // ---------------------------------------------------------------------------

  private buildBackground(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(THEME.colors.bg, 1);
    gfx.fillRect(0, 0, 800, 800);

    const BANDS = 40;
    const bandH = 800 / BANDS;
    for (let i = 0; i < BANDS; i++) {
      gfx.fillStyle(mixColor(0x0e1428, THEME.colors.bgDeep, i / (BANDS - 1)), 1);
      gfx.fillRect(0, i * bandH, 800, bandH + 1);
    }

    // Perspective grid background lines
    gfx.lineStyle(1, 0x1b233d, 0.45);
    for (let x = 0; x <= 800; x += 40) gfx.lineBetween(x, 0, x, 800);
    for (let y = 0; y <= 800; y += 40) gfx.lineBetween(0, y, 800, y);

    // Vignette / ambient glows
    this.softGlow(gfx, 240, 420, THEME.colors.accent, 220);
    this.softGlow(gfx, 560, 420, THEME.colors.danger, 220);
  }

  private softGlow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, color: number, maxR: number): void {
    for (let i = 4; i >= 1; i--) {
      g.fillStyle(color, 0.022);
      g.fillCircle(cx, cy, (maxR * i) / 4);
    }
  }

  // ---------------------------------------------------------------------------
  // Logo: "GRID" (Cyan Blue) & "RACE" (Neon Red)
  // ---------------------------------------------------------------------------

  private buildLogo(): void {
    const logoContainer = this.add.container(400, 150).setAlpha(0);

    // Glowing backing flare
    const flare = this.add.graphics();
    flare.fillStyle(0x38bdf8, 0.08);
    flare.fillCircle(-110, 0, 90);
    flare.fillStyle(0xf87171, 0.08);
    flare.fillCircle(110, 0, 90);

    const textGrid = this.add.text(-12, 0, 'GRID', {
      fontFamily: THEME.fonts.heading,
      fontSize: '54px',
      color: '#38bdf8',
      fontStyle: 'bold',
      letterSpacing: 6
    }).setOrigin(1, 0.5);

    const textRace = this.add.text(12, 0, 'RACE', {
      fontFamily: THEME.fonts.heading,
      fontSize: '54px',
      color: '#f87171',
      fontStyle: 'bold',
      letterSpacing: 6
    }).setOrigin(0, 0.5);

    const subtitle = this.add.text(0, 42, 'TACTICAL PATHFINDING PROTOCOL', {
      fontFamily: THEME.fonts.body,
      fontSize: '11px',
      color: '#94a3b8',
      fontStyle: 'bold',
      letterSpacing: 4
    }).setOrigin(0.5);

    logoContainer.add([flare, textGrid, textRace, subtitle]);

    this.tweens.add({
      targets: logoContainer,
      alpha: 1,
      y: 165,
      duration: 800,
      ease: 'Power2'
    });
  }

  // ---------------------------------------------------------------------------
  // Central Cyber Grid Arena Preview
  // ---------------------------------------------------------------------------

  private buildCyberGrid(): void {
    const grid = this.add.graphics().setDepth(2);
    const cx = 400;
    const cy = 415;
    const size = 220;
    const half = size / 2;

    // Outer cyber border
    grid.lineStyle(2, 0x2b3557, 0.85);
    grid.strokeRoundedRect(cx - half, cy - half, size, size, 16);

    grid.fillStyle(THEME.colors.surface, 0.65);
    grid.fillRoundedRect(cx - half, cy - half, size, size, 16);

    // Inner concentric circuits
    grid.lineStyle(1.2, 0x1e2947, 0.9);
    grid.strokeRoundedRect(cx - half + 30, cy - half + 30, size - 60, size - 60, 10);
    grid.strokeRoundedRect(cx - half + 65, cy - half + 65, size - 130, size - 130, 8);

    // Crosshairs & wall slot indicators
    grid.lineStyle(1, 0x38bdf8, 0.35);
    grid.lineBetween(cx - half, cy, cx + half, cy);
    grid.lineStyle(1, 0xf87171, 0.35);
    grid.lineBetween(cx, cy - half, cx, cy + half);

    // Corner decorative nodes
    const corners = [
      { x: cx - half, y: cy - half },
      { x: cx + half, y: cy - half },
      { x: cx - half, y: cy + half },
      { x: cx + half, y: cy + half }
    ];

    grid.fillStyle(0x38bdf8, 0.9);
    corners.forEach((pt) => grid.fillCircle(pt.x, pt.y, 3));
  }

  // ---------------------------------------------------------------------------
  // Blue and Red Interactive Racing Orbs
  // ---------------------------------------------------------------------------

  private buildOrbs(): void {
    this.orbBlue = this.makeOrb(0x1d4ed8, 0x38bdf8, 'P1');
    this.orbRed = this.makeOrb(0xb91c1c, 0xf87171, 'CPU');
    this.orbBlue.setDepth(10);
    this.orbRed.setDepth(10);
  }

  private makeOrb(outerCol: number, innerCol: number, label: string): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);

    const glow = this.add.circle(0, 0, 22, innerCol, 0.2);
    const ring = this.add.circle(0, 0, 16, outerCol, 1);
    const core = this.add.circle(0, 0, 11, innerCol, 1);
    const text = this.add.text(0, 0, label, {
      fontFamily: THEME.fonts.heading,
      fontSize: '9px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    c.add([glow, ring, core, text]);

    this.tweens.add({
      targets: glow,
      scale: { from: 0.85, to: 1.25 },
      alpha: { from: 0.15, to: 0.35 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    return c;
  }

  // ---------------------------------------------------------------------------
  // Futuristic Progress Bar
  // ---------------------------------------------------------------------------

  private buildProgressBar(): void {
    const cx = 400;
    const cy = 600;
    const w = 340;
    const h = 14;

    const bgGfx = this.add.graphics();
    bgGfx.fillStyle(0x0e1322, 0.9);
    bgGfx.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 7);
    bgGfx.lineStyle(1.5, 0x2b3557, 0.9);
    bgGfx.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 7);

    this.progressFill = this.add.graphics();

    this.statusText = this.add.text(cx, cy - 20, 'INITIALIZING GAME MATRIX...', {
      fontFamily: THEME.fonts.body,
      fontSize: '11px',
      color: '#94a3b8',
      fontStyle: 'bold',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.progressPercentText = this.add.text(cx, cy + 22, '0%', {
      fontFamily: THEME.fonts.heading,
      fontSize: '13px',
      color: '#38bdf8',
      fontStyle: 'bold',
      letterSpacing: 1
    }).setOrigin(0.5);

    const skipHint = this.add.text(cx, 720, 'CLICK ANYWHERE TO SKIP', {
      fontFamily: THEME.fonts.body,
      fontSize: '10px',
      color: '#475569',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.tweens.add({
      targets: skipHint,
      alpha: { from: 0.3, to: 0.8 },
      duration: 700,
      yoyo: true,
      repeat: -1
    });
  }

  private updateProgressBar(val: number): void {
    const cx = 400;
    const cy = 600;
    const maxW = 336;
    const h = 10;
    const curW = Math.max(0, maxW * val);

    this.progressFill.clear();

    // Segmented / gradient cyber fill
    this.progressFill.fillStyle(0x38bdf8, 1);
    this.progressFill.fillRoundedRect(cx - maxW / 2, cy - h / 2, curW, h, 5);

    this.progressPercentText.setText(`${Math.round(val * 100)}%`);

    if (val > 0.4 && val < 0.8) {
      this.statusText.setText('SYNCHRONIZING PATHFINDING BFS...');
    } else if (val >= 0.8) {
      this.statusText.setText('SYSTEM READY');
      this.statusText.setColor('#4ade80');
      this.progressPercentText.setColor('#4ade80');
    }
  }

  // ---------------------------------------------------------------------------
  // Frame Update Loop (Orb Orbiting)
  // ---------------------------------------------------------------------------

  update(_time: number, delta: number): void {
    if (this.isColliding) return;

    // Orbit speed accelerates as loading nears completion
    const speed = 0.0028 + this.progress * 0.004;
    this.orbitAngle += speed * delta;

    const radius = 78;
    const cx = 400;
    const cy = 415;

    this.orbBlue.setPosition(
      cx + Math.cos(this.orbitAngle) * radius,
      cy + Math.sin(this.orbitAngle) * (radius * 0.7)
    );

    this.orbRed.setPosition(
      cx + Math.cos(this.orbitAngle + Math.PI) * radius,
      cy + Math.sin(this.orbitAngle + Math.PI) * (radius * 0.7)
    );
  }

  // ---------------------------------------------------------------------------
  // Loading Simulation & Impact Sequence
  // ---------------------------------------------------------------------------

  private startLoadingSimulation(): void {
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 2100,
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

    const cx = 400;
    const cy = 415;

    // 1. Orbs accelerate toward center
    this.tweens.add({
      targets: [this.orbBlue, this.orbRed],
      x: cx,
      y: cy,
      duration: 240,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.playImpactAudio();

        // 2. Flash, screen shake & shockwave
        this.cameras.main.shake(220, 0.015);
        this.cameras.main.flash(200, 255, 255, 255);

        const shockwave = this.add.circle(cx, cy, 10, 0x38bdf8, 0.9).setDepth(20);
        this.tweens.add({
          targets: shockwave,
          radius: 180,
          alpha: 0,
          duration: 350,
          ease: 'Power2',
          onComplete: () => shockwave.destroy()
        });

        // 3. Smooth fade out to MenuScene
        this.time.delayedCall(300, () => {
          this.cameras.main.fadeOut(350, 10, 12, 21);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('MenuScene');
          });
        });
      }
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
    this.cameras.main.fadeOut(200, 10, 12, 21);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('MenuScene');
    });
  }

  // ---------------------------------------------------------------------------
  // Web Audio Procedural Sound Effect
  // ---------------------------------------------------------------------------

  private playImpactAudio(): void {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();

      // Deep kick / rumble
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.28);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      /* Safe fallback if audio context is blocked */
    }
  }
}