import Phaser from 'phaser';
import { Difficulty } from '../logic/BotAI';
import { NetworkController } from '../logic/NetworkController';
import { THEME, mixColor } from '../config/Theme';

interface MenuCard {
  key: string;
  name: string;
  category: string;
  blurb: string;
  hex: string;
  accent: number;
  shortcut: string;
  iconType: 'circle' | 'diamond' | 'triangle' | 'network';
}

const CARDS: MenuCard[] = [
  {
    key: 'EASY',
    name: 'CASUAL BOT',
    category: 'SOLO · EASY',
    blurb: 'Forgiving AI. Follows shortest BFS path and rarely blocks.',
    hex: '#4ade80',
    accent: 0x4ade80,
    shortcut: '1',
    iconType: 'circle'
  },
  {
    key: 'MEDIUM',
    name: 'TACTICIAN',
    category: 'SOLO · MEDIUM',
    blurb: 'Reactive rival. Places walls the moment you pull ahead.',
    hex: '#38bdf8',
    accent: 0x38bdf8,
    shortcut: '2',
    iconType: 'diamond'
  },
  {
    key: 'HARD',
    name: 'SABOTEUR',
    category: 'SOLO · HARD',
    blurb: 'Ruthless heuristic engine. Dissects and blocks your best route.',
    hex: '#f87171',
    accent: 0xf87171,
    shortcut: '3',
    iconType: 'triangle'
  },
  {
    key: 'ONLINE',
    name: 'ONLINE 1v1',
    category: 'P2P MULTIPLAYER',
    blurb: 'Create a custom room name or join a friend worldwide.',
    hex: '#c084fc',
    accent: 0xc084fc,
    shortcut: '4',
    iconType: 'network'
  }
];

export class MenuScene extends Phaser.Scene {
  private launching = false;
  private isModalOpen = false;
  private pendingNetController: NetworkController | null = null;
  private activeHtmlInput: HTMLInputElement | null = null;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.launching = false;
    this.isModalOpen = false;
    this.pendingNetController = null;
    this.activeHtmlInput = null;

    this.drawBackground();
    this.drawHeader();
    this.drawCardsGrid();
    this.drawFooter();
    this.setupShortcuts();
  }

  private drawBackground(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(THEME.colors.bg, 1);
    gfx.fillRect(0, 0, 800, 800);

    const BANDS = 48;
    const bandH = 800 / BANDS;
    for (let i = 0; i < BANDS; i++) {
      gfx.fillStyle(mixColor(0x0e1428, THEME.colors.bgDeep, i / (BANDS - 1)), 1);
      gfx.fillRect(0, i * bandH, 800, bandH + 1);
    }

    gfx.lineStyle(1, 0x1b233d, 0.45);
    for (let x = 0; x <= 800; x += 40) gfx.lineBetween(x, 0, x, 800);
    for (let y = 0; y <= 800; y += 40) gfx.lineBetween(0, y, 800, y);

    this.softGlow(gfx, 120, 100, THEME.colors.accent, 260);
    this.softGlow(gfx, 680, 680, 0xc084fc, 240);
  }

  private softGlow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, color: number, maxR: number): void {
    for (let i = 4; i >= 1; i--) {
      g.fillStyle(color, 0.02);
      g.fillCircle(cx, cy, (maxR * i) / 4);
    }
  }

  private drawHeader(): void {
    const cx = 400;

    const badgeW = 210;
    const badgeH = 24;
    const badge = this.add.graphics();
    badge.fillStyle(THEME.colors.accent, 0.08);
    badge.fillRoundedRect(cx - badgeW / 2, 45, badgeW, badgeH, 12);
    badge.lineStyle(1, THEME.colors.accent, 0.4);
    badge.strokeRoundedRect(cx - badgeW / 2, 45, badgeW, badgeH, 12);

    this.add.text(cx, 57, 'COMPETITIVE RACING ENGINE', {
      fontFamily: THEME.fonts.body,
      fontSize: '9px',
      color: THEME.colors.accentHex,
      fontStyle: 'bold',
      letterSpacing: 2
    }).setOrigin(0.5);

    const titleContainer = this.add.container(cx, 108);
    const titleGrid = this.add.text(-10, 0, 'GRID', {
      fontFamily: THEME.fonts.heading,
      fontSize: '48px',
      color: '#38bdf8',
      fontStyle: 'bold',
      letterSpacing: 6
    }).setOrigin(1, 0.5);

    const titleRace = this.add.text(10, 0, 'RACE', {
      fontFamily: THEME.fonts.heading,
      fontSize: '48px',
      color: '#f87171',
      fontStyle: 'bold',
      letterSpacing: 6
    }).setOrigin(0, 0.5);

    titleContainer.add([titleGrid, titleRace]);

    this.add.text(cx, 146, 'Outmaneuver your opponent. Deploy walls. Claim their home row.', {
      fontFamily: THEME.fonts.body,
      fontSize: '12px',
      color: THEME.colors.textSecondary
    }).setOrigin(0.5);
  }

  private drawCardsGrid(): void {
    const w = 346;
    const h = 175;
    const col1X = 222;
    const col2X = 578;
    const row1Y = 270;
    const row2Y = 460;

    const positions = [
      { x: col1X, y: row1Y },
      { x: col2X, y: row1Y },
      { x: col1X, y: row2Y },
      { x: col2X, y: row2Y }
    ];

    CARDS.forEach((spec, i) => {
      this.buildCard(positions[i].x, positions[i].y, w, h, spec);
    });
  }

  private buildCard(cx: number, cy: number, w: number, h: number, spec: MenuCard): void {
    const container = this.add.container(cx, cy);
    const gfx = this.add.graphics();

    const draw = (hover: boolean) => {
      gfx.clear();
      if (hover) {
        gfx.fillStyle(0x000000, 0.5);
        gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 8, w, h, 14);
      }
      gfx.fillStyle(hover ? 0x161c2e : THEME.colors.surface, 1);
      gfx.fillRoundedRect(-w / 2, -h / 2, w, h, 14);

      gfx.lineStyle(hover ? 2 : 1.2, spec.accent, hover ? 1 : 0.35);
      gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);

      gfx.fillStyle(spec.accent, hover ? 1 : 0.7);
      gfx.fillRoundedRect(-w / 2 + 3, -h / 2 + 16, 4, h - 32, 2);

      gfx.fillStyle(0x0a0c15, 1);
      gfx.fillRoundedRect(w / 2 - 38, -h / 2 + 14, 24, 24, 6);
      gfx.lineStyle(1, THEME.colors.borderSoft, 1);
      gfx.strokeRoundedRect(w / 2 - 38, -h / 2 + 14, 24, 24, 6);
    };

    draw(false);

    const iconGfx = this.add.graphics();
    const ix = -w / 2 + 32;
    const iy = -h / 2 + 32;
    iconGfx.fillStyle(spec.accent, 1);

    if (spec.iconType === 'circle') {
      iconGfx.fillCircle(ix, iy, 8);
    } else if (spec.iconType === 'diamond') {
      iconGfx.fillPoints([
        { x: ix, y: iy - 9 }, { x: ix + 9, y: iy },
        { x: ix, y: iy + 9 }, { x: ix - 9, y: iy }
      ], true);
    } else if (spec.iconType === 'triangle') {
      iconGfx.fillTriangle(ix, iy - 9, ix + 9, iy + 8, ix - 9, iy + 8);
    } else {
      iconGfx.fillCircle(ix - 5, iy - 5, 3.5);
      iconGfx.fillCircle(ix + 5, iy - 5, 3.5);
      iconGfx.fillCircle(ix, iy + 6, 3.5);
      iconGfx.lineStyle(1.2, spec.accent, 0.7);
      iconGfx.lineBetween(ix - 5, iy - 5, ix + 5, iy - 5);
      iconGfx.lineBetween(ix - 5, iy - 5, ix, iy + 6);
      iconGfx.lineBetween(ix + 5, iy - 5, ix, iy + 6);
    }

    const categoryText = this.add.text(-w / 2 + 50, -h / 2 + 25, spec.category, {
      fontFamily: THEME.fonts.body,
      fontSize: '9px',
      color: spec.hex,
      fontStyle: 'bold',
      letterSpacing: 2
    });

    const nameText = this.add.text(-w / 2 + 24, -h / 2 + 58, spec.name, {
      fontFamily: THEME.fonts.heading,
      fontSize: '18px',
      color: THEME.colors.textPrimary,
      fontStyle: 'bold',
      letterSpacing: 1
    });

    const blurbText = this.add.text(-w / 2 + 24, -h / 2 + 90, spec.blurb, {
      fontFamily: THEME.fonts.body,
      fontSize: '11px',
      color: THEME.colors.textSecondary,
      lineSpacing: 4,
      wordWrap: { width: w - 48 }
    });

    const shortcutText = this.add.text(w / 2 - 26, -h / 2 + 26, spec.shortcut, {
      fontFamily: THEME.fonts.heading,
      fontSize: '12px',
      color: THEME.colors.textSecondary,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    container.add([gfx, iconGfx, categoryText, nameText, blurbText, shortcutText]);

    const hit = this.add.rectangle(cx, cy, w, h, 0, 0)
      .setInteractive({ useHandCursor: true });

    hit.on('pointerover', () => {
      if (this.isModalOpen) return;
      draw(true);
      this.tweens.add({ targets: container, y: cy - 4, scale: 1.015, duration: 140, ease: 'Power2' });
    });

    hit.on('pointerout', () => {
      draw(false);
      this.tweens.add({ targets: container, y: cy, scale: 1, duration: 160, ease: 'Power2' });
    });

    hit.on('pointerdown', () => {
      if (!this.isModalOpen) this.handleSelection(spec.key);
    });
  }

  private drawFooter(): void {
    const cx = 400;
    const rule = this.add.graphics();
    rule.lineStyle(1, 0x1e2742, 0.8);
    rule.lineBetween(cx - 240, 580, cx + 240, 580);

    this.add.text(cx, 608, 'TAP OR PRESS  [ 1 · 2 · 3 · 4 ]  TO PLAY', {
      fontFamily: THEME.fonts.heading,
      fontSize: '11px',
      color: THEME.colors.textMuted,
      fontStyle: 'bold',
      letterSpacing: 2
    }).setOrigin(0.5);

    this.add.text(cx, 642, 'Turn Rules: Move token 1 step  ·  OR place a wall border to divert opponent.', {
      fontFamily: THEME.fonts.body,
      fontSize: '11px',
      color: THEME.colors.textSecondary
    }).setOrigin(0.5);

    this.add.text(cx, 664, 'Strict Blockade Rule: Neither player can ever be completely boxed in.', {
      fontFamily: THEME.fonts.body,
      fontSize: '10px',
      color: THEME.colors.textMuted
    }).setOrigin(0.5);
  }

  private setupShortcuts(): void {
    const kb = this.input.keyboard;
    kb?.on('keydown-ONE', () => !this.isModalOpen && this.handleSelection('EASY'));
    kb?.on('keydown-TWO', () => !this.isModalOpen && this.handleSelection('MEDIUM'));
    kb?.on('keydown-THREE', () => !this.isModalOpen && this.handleSelection('HARD'));
    kb?.on('keydown-FOUR', () => !this.isModalOpen && this.handleSelection('ONLINE'));
  }

  private handleSelection(key: string): void {
    if (this.launching || this.isModalOpen) return;

    if (key === 'ONLINE') {
      this.openOnlineLobby();
    } else {
      this.launching = true;
      this.scene.start('GameScene', { difficulty: key as Difficulty });
    }
  }

  // ---------------------------------------------------------------------------
  // Mobile Software Keyboard Bridge
  // ---------------------------------------------------------------------------

  private attachMobileInput(initialValue: string, maxLength: number, onUpdate: (val: string) => void): void {
    this.removeMobileInput();

    const input = document.createElement('input');
    input.type = 'text';
    input.value = initialValue;
    input.maxLength = maxLength;
    input.autocomplete = 'off';
    input.autocapitalize = 'characters';
    input.spellcheck = false;

    // Invisible positioning over document body
    input.style.position = 'fixed';
    input.style.top = '10px';
    input.style.left = '50%';
    input.style.transform = 'translateX(-50%)';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.style.zIndex = '9999';

    document.body.appendChild(input);
    input.focus();

    input.addEventListener('input', () => {
      const clean = input.value.replace(/[^a-zA-Z0-9]/g, '').substring(0, maxLength).toUpperCase();
      input.value = clean;
      onUpdate(clean);
    });

    this.activeHtmlInput = input;
  }

  private removeMobileInput(): void {
    if (this.activeHtmlInput) {
      this.activeHtmlInput.blur();
      this.activeHtmlInput.remove();
      this.activeHtmlInput = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Online Multiplayer Modal
  // ---------------------------------------------------------------------------

  private openOnlineLobby(): void {
    this.isModalOpen = true;
    const cx = 400;
    const cy = 400;

    const modal = this.add.container(cx, cy).setDepth(100);
    const overlay = this.add.rectangle(0, 0, 800, 800, 0x05070e, 0.88).setInteractive();

    const panelW = 520;
    const panelH = 410;
    const panel = this.add.graphics();
    panel.fillStyle(THEME.colors.surface, 1);
    panel.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);
    panel.lineStyle(1.5, 0xc084fc, 0.85);
    panel.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18);

    const contentContainer = this.add.container(0, 0);

    const closeModal = () => {
      this.removeMobileInput();
      if (this.pendingNetController) {
        this.pendingNetController.disconnect();
        this.pendingNetController = null;
      }
      this.isModalOpen = false;
      modal.destroy();
    };

    modal.add([overlay, panel, contentContainer]);

    // ── VIEW 1: Choice ────────────────────────────────────────────────────────
    const showChoiceView = () => {
      this.removeMobileInput();
      contentContainer.removeAll(true);

      const title = this.add.text(0, -150, 'ONLINE MULTIPLAYER', {
        fontFamily: THEME.fonts.heading,
        fontSize: '22px',
        color: '#f8fafc',
        fontStyle: 'bold',
        letterSpacing: 2
      }).setOrigin(0.5);

      const sub = this.add.text(0, -118, 'Select an action to start a 1v1 match:', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: '#94a3b8'
      }).setOrigin(0.5);

      // Button A: Host Room
      const hostBtnBox = this.add.graphics();
      hostBtnBox.fillStyle(0x161f36, 1);
      hostBtnBox.fillRoundedRect(-200, -85, 400, 74, 12);
      hostBtnBox.lineStyle(1.5, 0x38bdf8, 0.7);
      hostBtnBox.strokeRoundedRect(-200, -85, 400, 74, 12);

      const hostTitle = this.add.text(0, -62, 'CREATE A ROOM (Host as Blue)', {
        fontFamily: THEME.fonts.heading,
        fontSize: '14px',
        color: '#38bdf8',
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5);

      const hostSub = this.add.text(0, -40, 'Name your own room or use an auto-generated code', {
        fontFamily: THEME.fonts.body,
        fontSize: '10px',
        color: '#94a3b8'
      }).setOrigin(0.5);

      const hostHit = this.add.rectangle(0, -48, 400, 74, 0, 0)
        .setInteractive({ useHandCursor: true });
      hostHit.on('pointerdown', () => showHostSetupView());

      // Button B: Join Room
      const joinBtnBox = this.add.graphics();
      joinBtnBox.fillStyle(0x161f36, 1);
      joinBtnBox.fillRoundedRect(-200, 10, 400, 74, 12);
      joinBtnBox.lineStyle(1.5, 0xf87171, 0.7);
      joinBtnBox.strokeRoundedRect(-200, 10, 400, 74, 12);

      const joinTitle = this.add.text(0, 33, 'JOIN A ROOM (Play as Red)', {
        fontFamily: THEME.fonts.heading,
        fontSize: '14px',
        color: '#f87171',
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5);

      const joinSub = this.add.text(0, 55, 'Enter the room name created by your friend', {
        fontFamily: THEME.fonts.body,
        fontSize: '10px',
        color: '#94a3b8'
      }).setOrigin(0.5);

      const joinHit = this.add.rectangle(0, 47, 400, 74, 0, 0)
        .setInteractive({ useHandCursor: true });
      joinHit.on('pointerdown', () => showJoinInputView());

      const cancel = this.add.text(0, 155, '← BACK TO MAIN MENU', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: '#64748b',
        fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      cancel.on('pointerdown', closeModal);

      contentContainer.add([title, sub, hostBtnBox, hostTitle, hostSub, hostHit, joinBtnBox, joinTitle, joinSub, joinHit, cancel]);
    };

    // ── VIEW 2: Host Room Setup ───────────────────────────────────────────────
    const showHostSetupView = () => {
      contentContainer.removeAll(true);
      let roomName = Math.random().toString(36).substring(2, 7).toUpperCase();

      const title = this.add.text(0, -150, 'CREATE ROOM', {
        fontFamily: THEME.fonts.heading,
        fontSize: '20px',
        color: '#f8fafc',
        fontStyle: 'bold',
        letterSpacing: 2
      }).setOrigin(0.5);

      const sub = this.add.text(0, -118, 'Tap box to edit room name on phone keyboard:', {
        fontFamily: THEME.fonts.body,
        fontSize: '11px',
        color: '#94a3b8'
      }).setOrigin(0.5);

      const nameBox = this.add.graphics();
      nameBox.fillStyle(0x0a0c15, 1);
      nameBox.fillRoundedRect(-140, -88, 280, 56, 12);
      nameBox.lineStyle(1.8, 0x38bdf8, 0.95);
      nameBox.strokeRoundedRect(-140, -88, 280, 56, 12);

      const roomText = this.add.text(0, -60, roomName, {
        fontFamily: THEME.fonts.heading,
        fontSize: '26px',
        color: '#38bdf8',
        fontStyle: 'bold',
        letterSpacing: 5
      }).setOrigin(0.5);

      const updateDisplay = () => {
        roomText.setText(roomName.length > 0 ? roomName : 'TAP TO TYPE');
        roomText.setColor(roomName.length > 0 ? '#38bdf8' : '#475569');
      };

      // Tapping the box opens the mobile software keyboard
      const inputHit = this.add.rectangle(0, -60, 280, 56, 0, 0)
        .setInteractive({ useHandCursor: true });
      inputHit.on('pointerdown', () => {
        this.attachMobileInput(roomName, 8, (val) => {
          roomName = val;
          updateDisplay();
        });
      });

      // Randomize Button
      const randBtn = this.add.text(0, -12, '🎲 RANDOMIZE NAME', {
        fontFamily: THEME.fonts.body,
        fontSize: '11px',
        color: '#94a3b8',
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      randBtn.on('pointerdown', () => {
        roomName = Math.random().toString(36).substring(2, 7).toUpperCase();
        updateDisplay();
      });

      // Start Hosting Button
      const launchBtnBox = this.add.graphics();
      launchBtnBox.fillStyle(0x38bdf8, 1);
      launchBtnBox.fillRoundedRect(-120, 32, 240, 48, 12);

      const launchBtnText = this.add.text(0, 56, 'START HOSTING', {
        fontFamily: THEME.fonts.heading,
        fontSize: '14px',
        color: '#08101c',
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5);

      const launchHit = this.add.rectangle(0, 56, 240, 48, 0, 0)
        .setInteractive({ useHandCursor: true });

      launchHit.on('pointerdown', () => {
        if (roomName.trim().length >= 3) {
          this.removeMobileInput();
          showHostWaitingView(roomName.trim());
        }
      });

      const back = this.add.text(0, 155, '← Back', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: '#64748b',
        fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      back.on('pointerdown', showChoiceView);

      contentContainer.add([title, sub, nameBox, roomText, inputHit, randBtn, launchBtnBox, launchBtnText, launchHit, back]);
    };

    // ── VIEW 3: Host Waiting View ─────────────────────────────────────────────
    const showHostWaitingView = async (finalRoomName: string) => {
      this.removeMobileInput();
      contentContainer.removeAll(true);

      const title = this.add.text(0, -150, 'ROOM LIVE', {
        fontFamily: THEME.fonts.heading,
        fontSize: '20px',
        color: '#f8fafc',
        fontStyle: 'bold',
        letterSpacing: 2
      }).setOrigin(0.5);

      const sub = this.add.text(0, -118, 'Your friend must enter this exact Room Name:', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: '#94a3b8'
      }).setOrigin(0.5);

      const codePlate = this.add.graphics();
      codePlate.fillStyle(0x0a0c15, 1);
      codePlate.fillRoundedRect(-150, -85, 300, 56, 12);
      codePlate.lineStyle(2, 0x38bdf8, 1);
      codePlate.strokeRoundedRect(-150, -85, 300, 56, 12);

      const codeText = this.add.text(0, -57, finalRoomName, {
        fontFamily: THEME.fonts.heading,
        fontSize: '28px',
        color: '#38bdf8',
        fontStyle: 'bold',
        letterSpacing: 6
      }).setOrigin(0.5);

      // Copy Button
      const copyBtnBox = this.add.graphics();
      copyBtnBox.fillStyle(0x1e293b, 1);
      copyBtnBox.fillRoundedRect(-120, -10, 240, 42, 10);
      copyBtnBox.lineStyle(1.2, 0x38bdf8, 0.8);
      copyBtnBox.strokeRoundedRect(-120, -10, 240, 42, 10);

      const copyBtnText = this.add.text(0, 11, '📋 COPY ROOM NAME', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: '#38bdf8',
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5);

      const copyHit = this.add.rectangle(0, 11, 240, 42, 0, 0)
        .setInteractive({ useHandCursor: true });

      copyHit.on('pointerdown', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(finalRoomName).then(() => {
            copyBtnBox.clear();
            copyBtnBox.fillStyle(0x14532d, 1);
            copyBtnBox.fillRoundedRect(-120, -10, 240, 42, 10);
            copyBtnBox.lineStyle(1.2, 0x4ade80, 1);
            copyBtnBox.strokeRoundedRect(-120, -10, 240, 42, 10);
            copyBtnText.setText('✓ COPIED!');
            copyBtnText.setColor('#4ade80');
            this.time.delayedCall(2000, () => {
              copyBtnBox.clear();
              copyBtnBox.fillStyle(0x1e293b, 1);
              copyBtnBox.fillRoundedRect(-120, -10, 240, 42, 10);
              copyBtnBox.lineStyle(1.2, 0x38bdf8, 0.8);
              copyBtnBox.strokeRoundedRect(-120, -10, 240, 42, 10);
              copyBtnText.setText('📋 COPY ROOM NAME');
              copyBtnText.setColor('#38bdf8');
            });
          }).catch(() => {});
        }
      });

      const waitingDot = this.add.circle(-115, 72, 6, 0x4ade80);
      this.tweens.add({
        targets: waitingDot,
        alpha: { from: 1, to: 0.2 },
        duration: 500,
        yoyo: true,
        repeat: -1
      });

      const waitingText = this.add.text(0, 72, 'Waiting for guest to join...', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: '#4ade80',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const cancelBtn = this.add.text(0, 155, 'Cancel Room', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: '#64748b',
        fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      cancelBtn.on('pointerdown', () => {
        this.pendingNetController?.disconnect();
        this.pendingNetController = null;
        showChoiceView();
      });

      contentContainer.add([title, sub, codePlate, codeText, copyBtnBox, copyBtnText, copyHit, waitingDot, waitingText, cancelBtn]);

      this.pendingNetController = new NetworkController(true, finalRoomName);
      try {
        await this.pendingNetController.initialize();
        this.isModalOpen = false;
        const net = this.pendingNetController;
        this.pendingNetController = null;
        this.scene.start('GameScene', { network: net, localPlayerId: 1 });
      } catch (err) {
        waitingText.setText('Error initializing room. Check WebSockets.');
        waitingText.setColor('#f87171');
      }
    };

    // ── VIEW 4: Join Room View ────────────────────────────────────────────────
    const showJoinInputView = () => {
      contentContainer.removeAll(true);
      let typedCode = '';

      const title = this.add.text(0, -150, 'JOIN ROOM', {
        fontFamily: THEME.fonts.heading,
        fontSize: '20px',
        color: '#f8fafc',
        fontStyle: 'bold',
        letterSpacing: 2
      }).setOrigin(0.5);

      const sub = this.add.text(0, -118, 'Tap box to type room name on phone keyboard:', {
        fontFamily: THEME.fonts.body,
        fontSize: '11px',
        color: '#94a3b8'
      }).setOrigin(0.5);

      const inputBox = this.add.graphics();
      inputBox.fillStyle(0x0a0c15, 1);
      inputBox.fillRoundedRect(-140, -88, 280, 56, 12);
      inputBox.lineStyle(1.8, 0xf87171, 0.95);
      inputBox.strokeRoundedRect(-140, -88, 280, 56, 12);

      const displayCodeText = this.add.text(0, -60, 'TAP TO TYPE', {
        fontFamily: THEME.fonts.heading,
        fontSize: '22px',
        color: '#475569',
        fontStyle: 'bold',
        letterSpacing: 4
      }).setOrigin(0.5);

      const updateInputDisplay = () => {
        if (typedCode.length === 0) {
          displayCodeText.setText('TAP TO TYPE');
          displayCodeText.setColor('#475569');
        } else {
          displayCodeText.setText(typedCode);
          displayCodeText.setColor('#f87171');
        }
      };

      const inputHit = this.add.rectangle(0, -60, 280, 56, 0, 0)
        .setInteractive({ useHandCursor: true });
      inputHit.on('pointerdown', () => {
        this.attachMobileInput(typedCode, 8, (val) => {
          typedCode = val;
          updateInputDisplay();
        });
      });

      // Paste Button
      const pasteBtnBox = this.add.graphics();
      pasteBtnBox.fillStyle(0x1e293b, 1);
      pasteBtnBox.fillRoundedRect(-110, -14, 220, 36, 8);
      pasteBtnBox.lineStyle(1.2, 0x38bdf8, 0.8);
      pasteBtnBox.strokeRoundedRect(-110, -14, 220, 36, 8);

      const pasteBtnText = this.add.text(0, 4, '📋 PASTE ROOM NAME', {
        fontFamily: THEME.fonts.body,
        fontSize: '11px',
        color: '#38bdf8',
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5);

      const pasteHit = this.add.rectangle(0, 4, 220, 36, 0, 0)
        .setInteractive({ useHandCursor: true });

      pasteHit.on('pointerdown', async () => {
        if (navigator.clipboard?.readText) {
          try {
            const clip = await navigator.clipboard.readText();
            const clean = clip.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
            if (clean.length > 0) {
              typedCode = clean;
              updateInputDisplay();
            }
          } catch {}
        }
      });

      const statusLabel = this.add.text(0, 34, '', {
        fontFamily: THEME.fonts.body,
        fontSize: '11px',
        color: '#f87171',
        align: 'center'
      }).setOrigin(0.5);

      const connectBtnBox = this.add.graphics();
      connectBtnBox.fillStyle(0xf87171, 1);
      connectBtnBox.fillRoundedRect(-120, 58, 240, 46, 12);

      const connectBtnText = this.add.text(0, 81, 'CONNECT & JOIN', {
        fontFamily: THEME.fonts.heading,
        fontSize: '14px',
        color: '#08101c',
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5);

      const connectHit = this.add.rectangle(0, 81, 240, 46, 0, 0)
        .setInteractive({ useHandCursor: true });

      const handleConnect = async () => {
        if (typedCode.length < 3) {
          statusLabel.setText('Room name must be at least 3 characters.');
          return;
        }

        this.removeMobileInput();
        connectHit.disableInteractive();
        statusLabel.setText(`Connecting to ${typedCode}...`);
        statusLabel.setColor('#38bdf8');

        this.pendingNetController = new NetworkController(false, typedCode);
        try {
          await this.pendingNetController.initialize();
          this.isModalOpen = false;
          const net = this.pendingNetController;
          this.pendingNetController = null;
          this.scene.start('GameScene', { network: net, localPlayerId: 2 });
        } catch (err: unknown) {
          const errorType = (err as { type?: string })?.type;
          const msg = errorType === 'peer-unavailable'
            ? 'Room not found! Verify name and ensure Host is waiting.'
            : 'Connection timed out. Check network.';
          statusLabel.setText(msg);
          statusLabel.setColor('#f87171');
          connectHit.setInteractive({ useHandCursor: true });
        }
      };

      connectHit.on('pointerdown', handleConnect);

      const backBtn = this.add.text(0, 155, '← Back', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: '#64748b',
        fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      backBtn.on('pointerdown', showChoiceView);

      contentContainer.add([title, sub, inputBox, displayCodeText, inputHit, pasteBtnBox, pasteBtnText, pasteHit, statusLabel, connectBtnBox, connectBtnText, connectHit, backBtn]);
    };

    showChoiceView();
  }
}