import Phaser from 'phaser';
import { Difficulty } from '../logic/BotAI';
import { NetworkController } from '../logic/NetworkController';
import { applyReadableText, fitCameraToViewport, SceneViewport } from '../config/ResponsiveCanvas';
import { isDarkMode, saveThemePreference, THEME } from '../config/Theme';

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
    name: 'EASY',
    category: 'SOLO · EASY',
    blurb: 'A relaxed opponent for learning the routes.',
    hex: '#28724d',
    accent: 0x28724d,
    shortcut: '1',
    iconType: 'circle'
  },
  {
    key: 'MEDIUM',
    name: 'MEDIUM',
    category: 'SOLO · MEDIUM',
    blurb: 'A rival that answers your moves with walls.',
    hex: '#315ea8',
    accent: 0x315ea8,
    shortcut: '2',
    iconType: 'diamond'
  },
  {
    key: 'HARD',
    name: 'HARD',
    category: 'SOLO · HARD',
    blurb: 'A sharp rival that plans several moves ahead.',
    hex: '#b83d2d',
    accent: 0xb83d2d,
    shortcut: '3',
    iconType: 'triangle'
  },
  {
    key: 'ONLINE',
    name: 'PLAY A FRIEND',
    category: 'ONLINE · 1V1',
    blurb: 'Create a room or join with your friend’s name.',
    hex: '#174a3f',
    accent: 0x174a3f,
    shortcut: '4',
    iconType: 'network'
  }
];

export class MenuScene extends Phaser.Scene {
  private launching = false;
  private isModalOpen = false;
  private pendingNetController: NetworkController | null = null;
  private activeHtmlInput: HTMLInputElement | null = null;
  private viewport: SceneViewport = { width: 800, height: 800, zoom: 1 };

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.viewport = fitCameraToViewport(this);
    this.launching = false;
    this.isModalOpen = false;
    this.pendingNetController = null;
    this.activeHtmlInput = null;

    this.drawResponsiveLayout();
    this.setupShortcuts();
    applyReadableText(this);

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });
  }

  private handleResize(): void {
    this.viewport = fitCameraToViewport(this);
    if (!this.isModalOpen) this.scene.restart();
  }

  private drawResponsiveLayout(): void {
    const phone = this.viewport.width < 620;
    const portraitPhone = phone && this.viewport.height > this.viewport.width * 1.15;
    const landscapePhone = phone && !portraitPhone;
    const shortPortraitPhone = portraitPhone && this.viewport.height < 700;
    const compactWide = !phone && this.viewport.height < 520;
    const mediumWide = !phone && this.viewport.height >= 520 && this.viewport.height < 760;
    const maxContentWidth = this.viewport.width >= 1500 ? 1840 : 1200;
    const contentWidth = Math.min(this.viewport.width - 80, maxContentWidth);
    const contentLeft = (this.viewport.width - contentWidth) / 2;
    let footerY: number;
    let cardX: number;
    let cardTop: number;
    let cardWidth: number;
    let cardHeight: number;
    let cardGap: number;
    let columns: number;
    let mapX: number;
    let mapY: number;
    let mapSize: number;
    let showMapLabels = true;
    let showMapCaption = true;

    if (portraitPhone) {
      const cardGapX = 12;
      const cardSide = (this.viewport.width - 40 - cardGapX) / 2;
      footerY = this.viewport.height - (shortPortraitPhone ? 40 : 112);
      cardTop = shortPortraitPhone ? 154 : 188;
      cardWidth = cardSide;
      cardHeight = shortPortraitPhone ? 72 : 92;
      cardGap = 8;
      columns = 2;
      cardX = this.viewport.width / 2;
      mapY = cardTop + cardHeight * 2 + cardGap + (shortPortraitPhone ? 34 : 50);
      mapSize = Math.max(0, Math.min(
        this.viewport.width - 48,
        footerY - mapY - (shortPortraitPhone ? 24 : 94)
      ));
      mapX = (this.viewport.width - mapSize) / 2;
      showMapLabels = !shortPortraitPhone;
      showMapCaption = !shortPortraitPhone;
    } else if (landscapePhone) {
      footerY = this.viewport.height - 42;
      cardWidth = (this.viewport.width * 0.53 - 50) / 2;
      cardHeight = 78;
      cardGap = 8;
      columns = 2;
      cardTop = 132;
      cardX = this.viewport.width * 0.27;
      mapSize = Math.min(190, this.viewport.height - 210);
      mapX = this.viewport.width - mapSize - 34;
      mapY = 92;
    } else if (compactWide) {
      const left = contentLeft;
      const shortWide = this.viewport.height < 520;
      footerY = this.viewport.height - (shortWide ? 44 : 54);
      mapSize = Math.min(240, Math.max(150, this.viewport.height - 380), contentWidth * 0.34);
      const gridWidth = contentWidth - mapSize - 48;
      cardWidth = (gridWidth - 12) / 2;
      cardHeight = shortWide ? 64 : 82;
      cardGap = shortWide ? 8 : 10;
      columns = 2;
      cardTop = shortWide ? 188 : 214;
      cardX = left + gridWidth / 2;
      mapX = left + gridWidth + 48;
      mapY = cardTop;
      showMapLabels = false;
      showMapCaption = false;
    } else if (mediumWide) {
      const left = contentLeft;
      footerY = this.viewport.height - 44;
      mapY = 224;
      mapSize = Math.max(180, Math.min(
        300,
        this.viewport.height - mapY - 150,
        contentWidth * 0.3
      ));
      const gridWidth = contentWidth - mapSize - 48;
      cardWidth = gridWidth;
      cardHeight = 72;
      cardGap = 8;
      columns = 1;
      cardTop = 210;
      cardX = left + gridWidth / 2;
      mapX = left + gridWidth + 48;
    } else {
      const left = contentLeft;
      footerY = Math.max(200, this.viewport.height - 110);
      cardTop = this.viewport.height < 820 ? 228 : 252;
      cardWidth = 360;
      cardHeight = this.viewport.height < 820 ? 78 : 94;
      cardGap = this.viewport.height < 820 ? 10 : 12;
      columns = 1;
      cardX = left + cardWidth / 2;
      mapY = 250;
      mapSize = Math.min(520, this.viewport.height - mapY - 200, contentWidth - 48 - cardWidth);
      mapSize = Math.max(240, mapSize);
      cardWidth = contentWidth - mapSize - 48;
      cardX = left + cardWidth / 2;
      mapX = left + cardWidth + 48;
    }

    this.drawBackground();
    this.drawHeader();
    this.drawCardsGrid(cardX, cardTop, cardWidth, cardHeight, cardGap, columns);
    if (mapSize > 0) this.drawRouteMap(mapX, mapY, mapSize, phone, showMapLabels, showMapCaption);
    this.drawFooter(footerY);
  }

  private drawBackground(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(THEME.colors.bg, 1);
    gfx.fillRect(0, 0, this.viewport.width, this.viewport.height);

    gfx.lineStyle(1, THEME.colors.border, 0.07);
    for (let i = 0; i < 7; i++) {
      gfx.strokeEllipse(this.viewport.width * 0.78, this.viewport.height * 0.37, 300 + i * 44, 230 + i * 38);
    }
  }

  private drawHeader(): void {
    const phone = this.viewport.width < 620;
    const portraitPhone = phone && this.viewport.height > this.viewport.width * 1.15;
    const landscapePhone = phone && !portraitPhone;
    const shortPortraitPhone = portraitPhone && this.viewport.height < 700;
    const shortWide = !phone && this.viewport.height < 520;
    const contentWidth = Math.min(this.viewport.width - 80, this.viewport.width >= 1500 ? 1840 : 1200);
    const left = phone ? 20 : (this.viewport.width - contentWidth) / 2;
    const titleY = shortPortraitPhone ? 12 : (portraitPhone ? 22 : (landscapePhone ? 12 : 44));
    const headlineY = shortPortraitPhone ? 40 : (portraitPhone ? 56 : (landscapePhone ? 42 : 102));
    const headlineSize = phone
      ? (shortPortraitPhone ? '24px' : (portraitPhone ? '32px' : '26px'))
      : (this.viewport.width < 700 ? '30px' : (this.viewport.width < 900 ? '36px' : '46px'));
    const subtitle = shortWide
      ? 'Two runners. One grid. Every wall changes the route.'
      : 'Two runners. One shared grid. Every wall opens a new way through.';
    const headline = shortPortraitPhone
      ? 'Read the route.\nChange the race.'
      : (portraitPhone ? 'Read the route.\nChange the race.' : 'Read the route. Change the race.');

    this.add.text(left, titleY, 'GRID RACE', {
      fontFamily: THEME.fonts.heading,
      fontSize: phone ? '20px' : '28px',
      color: THEME.colors.textPrimary,
      fontStyle: 'bold',
      letterSpacing: 1
    });

    this.add.text(left, headlineY, headline, {
      fontFamily: THEME.fonts.heading,
      fontSize: headlineSize,
      color: THEME.colors.textPrimary,
      fontStyle: 'bold',
      lineSpacing: -2,
      wordWrap: { width: this.viewport.width - left * 2 }
    });

    const subtitleY = shortPortraitPhone ? 100 : (portraitPhone ? 132 : (landscapePhone ? 78 : 161));
    this.add.text(left + 2, subtitleY, subtitle, {
      fontFamily: THEME.fonts.body,
      fontSize: shortPortraitPhone || shortWide ? '14px' : (portraitPhone ? '16px' : (landscapePhone ? '14px' : '19px')),
      color: THEME.colors.textSecondary,
      wordWrap: {
        width: landscapePhone
          ? this.viewport.width * 0.55
          : (shortPortraitPhone ? this.viewport.width - left * 2 : this.viewport.width - left * 2)
      }
    });

    const themeButtonWidth = phone ? 104 : 118;
    const themeButtonHeight = phone ? 36 : 40;
    const themeButton = this.add.container(
      this.viewport.width - left,
      titleY + (landscapePhone ? 0 : 4)
    );
    const buttonGfx = this.add.graphics();
    const iconGfx = this.add.graphics();
    const buttonLabel = this.add.text(18, 0, isDarkMode() ? 'LIGHT' : 'DARK', {
      fontFamily: THEME.fonts.heading,
      fontSize: phone ? '13px' : '14px',
      color: THEME.colors.textPrimary,
      fontStyle: 'bold',
      letterSpacing: 0.8
    }).setOrigin(0, 0.5);
    const redrawButton = (): void => {
      buttonGfx.clear();
      buttonGfx.fillStyle(THEME.colors.surfaceRaised, 1);
      buttonGfx.fillRoundedRect(-themeButtonWidth, 0, themeButtonWidth, themeButtonHeight, 7);
      buttonGfx.lineStyle(1, THEME.colors.borderSoft, 1);
      buttonGfx.strokeRoundedRect(-themeButtonWidth, 0, themeButtonWidth, themeButtonHeight, 7);

      iconGfx.clear();
      const iconX = -themeButtonWidth + 18;
      const iconY = themeButtonHeight / 2;
      iconGfx.lineStyle(1.5, THEME.colors.accent, 1);
      if (isDarkMode()) {
        iconGfx.fillStyle(THEME.colors.accent, 1);
        iconGfx.fillCircle(iconX, iconY, 6);
        iconGfx.fillStyle(THEME.colors.surfaceRaised, 1);
        iconGfx.fillCircle(iconX + 4, iconY - 3, 6);
      } else {
        iconGfx.fillStyle(THEME.colors.accent, 1);
        iconGfx.fillCircle(iconX, iconY, 4);
        for (let ray = 0; ray < 8; ray++) {
          const angle = (Math.PI * 2 * ray) / 8;
          iconGfx.lineBetween(
            iconX + Math.cos(angle) * 7,
            iconY + Math.sin(angle) * 7,
            iconX + Math.cos(angle) * 9,
            iconY + Math.sin(angle) * 9
          );
        }
      }
      buttonLabel.setText(isDarkMode() ? 'LIGHT' : 'DARK');
      buttonLabel.setPosition(-themeButtonWidth + 36, themeButtonHeight / 2);
    };
    redrawButton();
    const buttonHit = this.add.rectangle(
      -themeButtonWidth / 2,
      themeButtonHeight / 2,
      themeButtonWidth,
      themeButtonHeight,
      0,
      0
    ).setInteractive({ useHandCursor: true });
    buttonHit.on('pointerdown', () => {
      saveThemePreference(!isDarkMode());
      this.scene.restart();
    });
    themeButton.add([buttonGfx, iconGfx, buttonLabel, buttonHit]);
  }

  private drawRouteMap(
    x: number,
    y: number,
    size: number,
    mobile: boolean,
    showLabels = true,
    showCaption = true
  ): void {
    const gfx = this.add.graphics();
    const cellSize = size / 9;
    const boardSize = size;
    const center = (row: number, col: number) => ({
      x: x + col * cellSize + cellSize / 2,
      y: y + row * cellSize + cellSize / 2
    });

    gfx.fillStyle(THEME.colors.surface, 1);
    gfx.fillRect(x - 12, y - 12, boardSize + 24, boardSize + 24);
    gfx.lineStyle(1, THEME.colors.border, 0.35);
    gfx.strokeRect(x - 12, y - 12, boardSize + 24, boardSize + 24);

    gfx.fillStyle(THEME.colors.map, 1);
    gfx.fillRect(x, y, boardSize, boardSize);
    gfx.lineStyle(1, THEME.colors.border, 0.25);
    for (let i = 0; i <= 9; i++) {
      gfx.lineBetween(x + i * cellSize, y, x + i * cellSize, y + boardSize);
      gfx.lineBetween(x, y + i * cellSize, x + boardSize, y + i * cellSize);
    }

    const route = [
      center(8, 4), center(7, 4), center(6, 4), center(6, 3),
      center(5, 3), center(4, 3), center(4, 4), center(3, 4),
      center(2, 4), center(1, 4), center(0, 4)
    ];
    gfx.lineStyle(Math.max(3, cellSize * 0.075), THEME.colors.accent, 0.7);
    for (let i = 1; i < route.length; i++) {
      gfx.lineBetween(route[i - 1].x, route[i - 1].y, route[i].x, route[i].y);
    }

    const wall = center(5, 4);
    gfx.fillStyle(THEME.colors.border, 1);
    gfx.fillRect(wall.x - cellSize * 0.7, wall.y - cellSize * 0.08, cellSize * 1.4, cellSize * 0.16);

    const start = center(8, 4);
    const finish = center(0, 4);
    gfx.fillStyle(THEME.colors.accent, 1);
    gfx.fillCircle(start.x, start.y, cellSize * 0.28);
    gfx.lineStyle(Math.max(3, cellSize * 0.08), THEME.colors.surface, 1);
    gfx.strokeCircle(start.x, start.y, cellSize * 0.28);

    gfx.fillStyle(THEME.colors.danger, 1);
    gfx.fillPoints([
      { x: finish.x, y: finish.y - cellSize * 0.3 },
      { x: finish.x + cellSize * 0.3, y: finish.y },
      { x: finish.x, y: finish.y + cellSize * 0.3 },
      { x: finish.x - cellSize * 0.3, y: finish.y }
    ], true);
    gfx.lineStyle(Math.max(3, cellSize * 0.08), THEME.colors.surface, 1);
    gfx.strokePoints([
      { x: finish.x, y: finish.y - cellSize * 0.3 },
      { x: finish.x + cellSize * 0.3, y: finish.y },
      { x: finish.x, y: finish.y + cellSize * 0.3 },
      { x: finish.x - cellSize * 0.3, y: finish.y }
    ], true);

    if (showLabels) {
      this.add.text(x, y - 36, 'START', {
        fontFamily: THEME.fonts.heading,
        fontSize: mobile ? '18px' : '17px',
        color: THEME.colors.accentHex,
        fontStyle: 'bold',
        letterSpacing: 1
      });
      this.add.text(x + boardSize, y - 36, 'FINISH', {
        fontFamily: THEME.fonts.heading,
        fontSize: mobile ? '18px' : '17px',
        color: THEME.colors.dangerHex,
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(1, 0);
    }

    if (showCaption) {
      this.add.text(x, y + size + 27, mobile ? 'WALLS CHANGE ROUTES' : 'A WALL CHANGES THE ROUTE', {
        fontFamily: THEME.fonts.heading,
        fontSize: mobile ? '16px' : '18px',
        color: THEME.colors.textPrimary,
        fontStyle: 'bold',
        letterSpacing: 1
      });
      this.add.text(x, y + size + 56, 'Keep both routes open.', {
        fontFamily: THEME.fonts.body,
        fontSize: '16px',
        color: THEME.colors.textSecondary
      });
    }
  }

  private drawCardsGrid(
    x: number,
    top: number,
    width: number,
    height: number,
    gap: number,
    columns: number
  ): void {
    CARDS.forEach((spec, i) => {
      const column = i % columns;
      const row = Math.floor(i / columns);
      const cardX = x + (column - (columns - 1) / 2) * (width + 12);
      this.buildCard(cardX, top + height / 2 + row * (height + gap), width, height, spec);
    });
  }

  private buildCard(cx: number, cy: number, w: number, h: number, spec: MenuCard): void {
    const container = this.add.container(cx, cy);
    const gfx = this.add.graphics();
    const narrowCard = w < 220;
    const compact = narrowCard || (this.viewport.width >= 620 && this.viewport.height < 760);
    const shortRow = h < 84 && !narrowCard;
    const accent = spec.key === 'EASY'
      ? THEME.colors.success
      : spec.key === 'MEDIUM'
        ? THEME.colors.accent
        : spec.key === 'HARD'
          ? THEME.colors.danger
          : THEME.colors.border;
    const accentHex = Phaser.Display.Color.IntegerToColor(accent).rgba;

    const draw = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? THEME.colors.surfaceRaised : THEME.colors.surface, 1);
      gfx.fillRect(-w / 2, -h / 2, w, h);
      gfx.lineStyle(hover ? 2 : 1, hover ? accent : THEME.colors.borderSoft, 1);
      gfx.strokeRect(-w / 2, -h / 2, w, h);
      gfx.fillStyle(accent, 1);
      gfx.fillRect(-w / 2, -h / 2, 5, h);
    };

    draw(false);

    const iconGfx = this.add.graphics();
    const ix = -w / 2 + (compact ? 20 : 34);
    const iy = 0;
    iconGfx.fillStyle(accent, 1);

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
      iconGfx.lineStyle(1.2, accent, 0.7);
      iconGfx.lineBetween(ix - 5, iy - 5, ix + 5, iy - 5);
      iconGfx.lineBetween(ix - 5, iy - 5, ix, iy + 6);
      iconGfx.lineBetween(ix + 5, iy - 5, ix, iy + 6);
    }

    const textLeft = -w / 2 + (narrowCard ? 36 : 68);
    const categoryText = this.add.text(textLeft, -h / 2 + (shortRow ? 8 : (compact ? 11 : 14)), narrowCard ? '' : spec.category, {
      fontFamily: THEME.fonts.body,
      fontSize: shortRow ? '12px' : '14px',
      color: accentHex,
      fontStyle: 'bold',
      letterSpacing: compact ? 0 : 2
    });

    const cardName = narrowCard && spec.key === 'ONLINE' ? 'FRIEND' : spec.name;
    const nameText = this.add.text(textLeft, -h / 2 + (narrowCard ? 18 : (shortRow ? 25 : 42)), cardName, {
      fontFamily: THEME.fonts.heading,
      fontSize: narrowCard ? '18px' : (shortRow ? '20px' : '24px'),
      color: THEME.colors.textPrimary,
      fontStyle: 'bold',
      letterSpacing: 0.4
    });

    const compactBlurb: Record<MenuCard['key'], string> = {
      EASY: 'Easy start.',
      MEDIUM: 'Uses walls.',
      HARD: 'Plans ahead.',
      ONLINE: 'Play 1v1.'
    };
    const blurb = narrowCard ? compactBlurb[spec.key as MenuCard['key']] : spec.blurb;
    const blurbText = this.add.text(textLeft, -h / 2 + (narrowCard ? 48 : (shortRow ? 50 : 70)), blurb, {
      fontFamily: THEME.fonts.body,
      fontSize: narrowCard ? (w < 145 ? '13px' : '14px') : (shortRow ? '15px' : '16px'),
      color: THEME.colors.textSecondary,
      lineSpacing: 1,
      wordWrap: { width: w - (narrowCard ? 46 : 110) }
    });

    const shortcutText = this.add.text(w / 2 - (narrowCard ? 14 : 32), -h / 2 + (shortRow ? 12 : (compact ? 12 : 16)), narrowCard ? '' : spec.shortcut, {
      fontFamily: THEME.fonts.heading,
      fontSize: compact ? '15px' : '19px',
      color: THEME.colors.textPrimary,
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

  private drawFooter(top: number): void {
    const phone = this.viewport.width < 620;
    const portraitPhone = phone && this.viewport.height > this.viewport.width * 1.15;
    const landscapePhone = phone && !portraitPhone;
    const shortPortraitPhone = portraitPhone && this.viewport.height < 700;
    const compactWide = !phone && this.viewport.height < 760;
    const contentWidth = Math.min(this.viewport.width - 80, this.viewport.width >= 1500 ? 1840 : 1200);
    const left = phone ? 20 : (this.viewport.width - contentWidth) / 2;
    const rule = this.add.graphics();
    rule.lineStyle(1, THEME.colors.border, 0.35);
    rule.lineBetween(left, top, this.viewport.width - left, top);

    if (shortPortraitPhone) {
      this.add.text(left + 2, top + 8, 'TAP A CARD TO PLAY', {
        fontFamily: THEME.fonts.body,
        fontSize: '14px',
        color: THEME.colors.textPrimary,
        fontStyle: 'bold'
      });
      return;
    }

    if (landscapePhone || compactWide) {
      this.add.text(left, top + 8, '1 EASY     2 MEDIUM     3 HARD     4 FRIEND ROOM', {
        fontFamily: THEME.fonts.body,
        fontSize: phone ? '14px' : '16px',
        color: THEME.colors.textPrimary,
        fontStyle: 'bold'
      });
      return;
    }

    this.add.text(left + 2, top + (portraitPhone ? 8 : 18), 'CHOOSE A RIVAL', {
      fontFamily: THEME.fonts.heading,
      fontSize: '18px',
      color: THEME.colors.textPrimary,
      fontStyle: 'bold',
      letterSpacing: 1
    });

    this.add.text(
      left + 2,
      top + (portraitPhone ? 34 : 48),
      portraitPhone ? 'Move. Place a wall. Keep both routes open.' : 'Move one space or place a wall. Block the route, never the finish.',
      {
      fontFamily: THEME.fonts.body,
      fontSize: '16px',
      color: THEME.colors.textSecondary,
      wordWrap: { width: this.viewport.width - left * 2 }
      }
    );

    if (portraitPhone) {
      this.add.text(left + 2, top + 60, 'KEYS  1 EASY · 2 MEDIUM', {
        fontFamily: THEME.fonts.body,
        fontSize: '14px',
        color: THEME.colors.textMuted,
        fontStyle: 'bold',
        letterSpacing: 0.4
      });
      this.add.text(left + 2, top + 80, '3 HARD · 4 FRIEND ROOM', {
        fontFamily: THEME.fonts.body,
        fontSize: '14px',
        color: THEME.colors.textMuted,
        fontStyle: 'bold',
        letterSpacing: 0.4
      });
      return;
    }

    this.add.text(left + 2, top + 83, 'KEYS  1 EASY     2 MEDIUM     3 HARD     4 FRIEND ROOM', {
      fontFamily: THEME.fonts.body,
      fontSize: '15px',
      color: THEME.colors.textMuted,
      fontStyle: 'bold',
      letterSpacing: 0.7
    });
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
    const cx = this.viewport.width / 2;
    const cy = this.viewport.height / 2;

    const modal = this.add.container(cx, cy).setDepth(100);
    const overlay = this.add.rectangle(
      0, 0, this.viewport.width, this.viewport.height, THEME.colors.overlay, 0.84
    ).setInteractive();

    const panelW = Math.min(640, this.viewport.width - 32);
    const panelH = 410;
    const modalInputWidth = Math.min(280, panelW - 40);
    const modalCodeWidth = Math.min(300, panelW - 40);
    const modalActionWidth = Math.min(240, panelW - 40);
    const modalPasteWidth = Math.min(220, panelW - 40);
    const panel = this.add.graphics();
    panel.fillStyle(THEME.colors.surface, 1);
    panel.fillRect(-panelW / 2, -panelH / 2, panelW, panelH);
    panel.lineStyle(2, THEME.colors.border, 1);
    panel.strokeRect(-panelW / 2, -panelH / 2, panelW, panelH);

    const contentContainer = this.add.container(0, 0);

    const closeModal = () => {
      this.removeMobileInput();
      if (this.pendingNetController) {
        this.pendingNetController.disconnect();
        this.pendingNetController = null;
      }
      this.isModalOpen = false;
      this.scale.off('resize', handleModalResize, this);
      modal.destroy();
    };

    const handleModalResize = (): void => {
      this.viewport = fitCameraToViewport(this);
      closeModal();
      this.scene.restart();
    };
    this.scale.on('resize', handleModalResize, this);

    modal.add([overlay, panel, contentContainer]);

    // ── VIEW 1: Choice ────────────────────────────────────────────────────────
    const showChoiceView = () => {
      this.removeMobileInput();
      contentContainer.removeAll(true);

      const title = this.add.text(0, -150, 'ONLINE MULTIPLAYER', {
        fontFamily: THEME.fonts.heading,
        fontSize: '22px',
        color: THEME.colors.textPrimary,
        fontStyle: 'bold',
        letterSpacing: 2
      }).setOrigin(0.5);

      const sub = this.add.text(0, -118, 'Select an action to start a 1v1 match:', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: THEME.colors.textSecondary
      }).setOrigin(0.5);

      // Button A: Host Room
      const hostBtnBox = this.add.graphics();
      hostBtnBox.fillStyle(THEME.colors.surfaceRaised, 1);
      const choiceButtonWidth = Math.min(400, panelW - 32);
      hostBtnBox.fillRect(-choiceButtonWidth / 2, -90, choiceButtonWidth, 84);
      hostBtnBox.lineStyle(1.5, THEME.colors.accent, 0.9);
      hostBtnBox.strokeRect(-choiceButtonWidth / 2, -90, choiceButtonWidth, 84);

      const hostTitle = this.add.text(0, -63, 'CREATE ROOM · HOST BLUE', {
        fontFamily: THEME.fonts.heading,
        fontSize: '16px',
        color: THEME.colors.accentHex,
        fontStyle: 'bold',
        letterSpacing: 0.4,
        wordWrap: { width: choiceButtonWidth - 16 },
        align: 'center'
      }).setOrigin(0.5);

      const hostSub = this.add.text(0, -38, 'Share your room name with a friend.', {
        fontFamily: THEME.fonts.body,
        fontSize: '14px',
        color: THEME.colors.textSecondary,
        wordWrap: { width: choiceButtonWidth - 16 },
        align: 'center'
      }).setOrigin(0.5);

      const hostHit = this.add.rectangle(0, -48, choiceButtonWidth, 84, 0, 0)
        .setInteractive({ useHandCursor: true });
      hostHit.on('pointerdown', () => showHostSetupView());

      // Button B: Join Room
      const joinBtnBox = this.add.graphics();
      joinBtnBox.fillStyle(THEME.colors.surfaceRaised, 1);
      joinBtnBox.fillRect(-choiceButtonWidth / 2, 6, choiceButtonWidth, 84);
      joinBtnBox.lineStyle(1.5, THEME.colors.danger, 0.9);
      joinBtnBox.strokeRect(-choiceButtonWidth / 2, 6, choiceButtonWidth, 84);

      const joinTitle = this.add.text(0, 34, 'JOIN ROOM · PLAY RED', {
        fontFamily: THEME.fonts.heading,
        fontSize: '16px',
        color: THEME.colors.dangerHex,
        fontStyle: 'bold',
        letterSpacing: 0.4,
        wordWrap: { width: choiceButtonWidth - 16 },
        align: 'center'
      }).setOrigin(0.5);

      const joinSub = this.add.text(0, 60, 'Enter the room name from your friend.', {
        fontFamily: THEME.fonts.body,
        fontSize: '14px',
        color: THEME.colors.textSecondary,
        wordWrap: { width: choiceButtonWidth - 16 },
        align: 'center'
      }).setOrigin(0.5);

      const joinHit = this.add.rectangle(0, 48, choiceButtonWidth, 84, 0, 0)
        .setInteractive({ useHandCursor: true });
      joinHit.on('pointerdown', () => showJoinInputView());

      const cancel = this.add.text(0, 155, '← BACK TO MAIN MENU', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: THEME.colors.textMuted,
        fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      cancel.on('pointerdown', closeModal);

      contentContainer.add([title, sub, hostBtnBox, hostTitle, hostSub, hostHit, joinBtnBox, joinTitle, joinSub, joinHit, cancel]);
      applyReadableText(this);
    };

    // ── VIEW 2: Host Room Setup ───────────────────────────────────────────────
    const showHostSetupView = () => {
      contentContainer.removeAll(true);
      let roomName = Math.random().toString(36).substring(2, 7).toUpperCase();

      const title = this.add.text(0, -150, 'CREATE ROOM', {
        fontFamily: THEME.fonts.heading,
        fontSize: '20px',
        color: THEME.colors.textPrimary,
        fontStyle: 'bold',
        letterSpacing: 2
      }).setOrigin(0.5);

      const sub = this.add.text(0, -118, 'Tap box to edit room name on phone keyboard:', {
        fontFamily: THEME.fonts.body,
        fontSize: '11px',
        color: THEME.colors.textSecondary
      }).setOrigin(0.5);

      const nameBox = this.add.graphics();
      nameBox.fillStyle(THEME.colors.surface, 1);
      nameBox.fillRect(-modalInputWidth / 2, -88, modalInputWidth, 56);
      nameBox.lineStyle(1.8, THEME.colors.accent, 0.95);
      nameBox.strokeRect(-modalInputWidth / 2, -88, modalInputWidth, 56);

      const roomText = this.add.text(0, -60, roomName, {
        fontFamily: THEME.fonts.heading,
        fontSize: '26px',
        color: THEME.colors.accentHex,
        fontStyle: 'bold',
        letterSpacing: 5
      }).setOrigin(0.5);

      const updateDisplay = () => {
        roomText.setText(roomName.length > 0 ? roomName : 'TAP TO TYPE');
        roomText.setColor(roomName.length > 0 ? THEME.colors.accentHex : THEME.colors.textMuted);
      };

      // Tapping the box opens the mobile software keyboard
      const inputHit = this.add.rectangle(0, -60, modalInputWidth, 56, 0, 0)
        .setInteractive({ useHandCursor: true });
      inputHit.on('pointerdown', () => {
        this.attachMobileInput(roomName, 8, (val) => {
          roomName = val;
          updateDisplay();
        });
      });

      // Randomize Button
      const randBtn = this.add.text(0, -12, 'RANDOMIZE ROOM NAME', {
        fontFamily: THEME.fonts.body,
        fontSize: '11px',
        color: THEME.colors.textSecondary,
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      randBtn.on('pointerdown', () => {
        roomName = Math.random().toString(36).substring(2, 7).toUpperCase();
        updateDisplay();
      });

      // Start Hosting Button
      const launchBtnBox = this.add.graphics();
      launchBtnBox.fillStyle(THEME.colors.accent, 1);
      launchBtnBox.fillRect(-modalActionWidth / 2, 32, modalActionWidth, 48);

      const launchBtnText = this.add.text(0, 56, 'START HOSTING', {
        fontFamily: THEME.fonts.heading,
        fontSize: '14px',
        color: THEME.colors.onAccent,
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5);

      const launchHit = this.add.rectangle(0, 56, modalActionWidth, 48, 0, 0)
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
        color: THEME.colors.textMuted,
        fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      back.on('pointerdown', showChoiceView);

      contentContainer.add([title, sub, nameBox, roomText, inputHit, randBtn, launchBtnBox, launchBtnText, launchHit, back]);
      applyReadableText(this);
    };

    // ── VIEW 3: Host Waiting View ─────────────────────────────────────────────
    const showHostWaitingView = async (finalRoomName: string) => {
      this.removeMobileInput();
      contentContainer.removeAll(true);

      const title = this.add.text(0, -150, 'ROOM LIVE', {
        fontFamily: THEME.fonts.heading,
        fontSize: '20px',
        color: THEME.colors.textPrimary,
        fontStyle: 'bold',
        letterSpacing: 2
      }).setOrigin(0.5);

      const sub = this.add.text(0, -118, 'Your friend must enter this exact Room Name:', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: THEME.colors.textSecondary
      }).setOrigin(0.5);

      const codePlate = this.add.graphics();
      codePlate.fillStyle(THEME.colors.surface, 1);
      codePlate.fillRect(-modalCodeWidth / 2, -85, modalCodeWidth, 56);
      codePlate.lineStyle(2, THEME.colors.accent, 1);
      codePlate.strokeRect(-modalCodeWidth / 2, -85, modalCodeWidth, 56);

      const codeText = this.add.text(0, -57, finalRoomName, {
        fontFamily: THEME.fonts.heading,
        fontSize: '28px',
        color: THEME.colors.accentHex,
        fontStyle: 'bold',
        letterSpacing: 6
      }).setOrigin(0.5);

      // Copy Button
      const copyBtnBox = this.add.graphics();
      copyBtnBox.fillStyle(THEME.colors.surfaceRaised, 1);
      copyBtnBox.fillRect(-modalActionWidth / 2, -10, modalActionWidth, 42);
      copyBtnBox.lineStyle(1.2, THEME.colors.accent, 0.9);
      copyBtnBox.strokeRect(-modalActionWidth / 2, -10, modalActionWidth, 42);

      const copyBtnText = this.add.text(0, 11, 'COPY ROOM NAME', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: THEME.colors.accentHex,
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5);

      const copyHit = this.add.rectangle(0, 11, modalActionWidth, 42, 0, 0)
        .setInteractive({ useHandCursor: true });

      copyHit.on('pointerdown', () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(finalRoomName).then(() => {
            copyBtnBox.clear();
            copyBtnBox.fillStyle(THEME.colors.success, 1);
            copyBtnBox.fillRect(-modalActionWidth / 2, -10, modalActionWidth, 42);
            copyBtnBox.lineStyle(1.2, THEME.colors.success, 1);
            copyBtnBox.strokeRect(-modalActionWidth / 2, -10, modalActionWidth, 42);
            copyBtnText.setText('ROOM NAME COPIED');
            copyBtnText.setColor(THEME.colors.onAccent);
            this.time.delayedCall(2000, () => {
              copyBtnBox.clear();
              copyBtnBox.fillStyle(THEME.colors.surfaceRaised, 1);
              copyBtnBox.fillRect(-modalActionWidth / 2, -10, modalActionWidth, 42);
              copyBtnBox.lineStyle(1.2, THEME.colors.accent, 0.9);
              copyBtnBox.strokeRect(-modalActionWidth / 2, -10, modalActionWidth, 42);
              copyBtnText.setText('COPY ROOM NAME');
              copyBtnText.setColor(THEME.colors.accentHex);
            });
          }).catch(() => {});
        }
      });

      const waitingDot = this.add.circle(-115, 72, 6, THEME.colors.success);
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
        color: THEME.colors.successHex,
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const cancelBtn = this.add.text(0, 155, 'Cancel Room', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: THEME.colors.textMuted,
        fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      cancelBtn.on('pointerdown', () => {
        this.pendingNetController?.disconnect();
        this.pendingNetController = null;
        showChoiceView();
      });

      contentContainer.add([title, sub, codePlate, codeText, copyBtnBox, copyBtnText, copyHit, waitingDot, waitingText, cancelBtn]);
      applyReadableText(this);

      this.pendingNetController = new NetworkController(true, finalRoomName);
      try {
        await this.pendingNetController.initialize();
        this.isModalOpen = false;
        const net = this.pendingNetController;
        this.pendingNetController = null;
        this.scene.start('GameScene', { network: net, localPlayerId: 1 });
      } catch (err) {
        waitingText.setText('Error initializing room. Check WebSockets.');
        waitingText.setColor(THEME.colors.dangerHex);
      }
    };

    // ── VIEW 4: Join Room View ────────────────────────────────────────────────
    const showJoinInputView = () => {
      contentContainer.removeAll(true);
      let typedCode = '';

      const title = this.add.text(0, -150, 'JOIN ROOM', {
        fontFamily: THEME.fonts.heading,
        fontSize: '20px',
        color: THEME.colors.textPrimary,
        fontStyle: 'bold',
        letterSpacing: 2
      }).setOrigin(0.5);

      const sub = this.add.text(0, -118, 'Tap box to type room name on phone keyboard:', {
        fontFamily: THEME.fonts.body,
        fontSize: '11px',
        color: THEME.colors.textSecondary
      }).setOrigin(0.5);

      const inputBox = this.add.graphics();
      inputBox.fillStyle(THEME.colors.surface, 1);
      inputBox.fillRect(-modalInputWidth / 2, -88, modalInputWidth, 56);
      inputBox.lineStyle(1.8, THEME.colors.danger, 0.95);
      inputBox.strokeRect(-modalInputWidth / 2, -88, modalInputWidth, 56);

      const displayCodeText = this.add.text(0, -60, 'TAP TO TYPE', {
        fontFamily: THEME.fonts.heading,
        fontSize: '22px',
        color: THEME.colors.textMuted,
        fontStyle: 'bold',
        letterSpacing: 4
      }).setOrigin(0.5);

      const updateInputDisplay = () => {
        if (typedCode.length === 0) {
          displayCodeText.setText('TAP TO TYPE');
          displayCodeText.setColor(THEME.colors.textMuted);
        } else {
          displayCodeText.setText(typedCode);
          displayCodeText.setColor(THEME.colors.dangerHex);
        }
      };

      const inputHit = this.add.rectangle(0, -60, modalInputWidth, 56, 0, 0)
        .setInteractive({ useHandCursor: true });
      inputHit.on('pointerdown', () => {
        this.attachMobileInput(typedCode, 8, (val) => {
          typedCode = val;
          updateInputDisplay();
        });
      });

      // Paste Button
      const pasteBtnBox = this.add.graphics();
      pasteBtnBox.fillStyle(THEME.colors.surfaceRaised, 1);
      pasteBtnBox.fillRect(-modalPasteWidth / 2, -14, modalPasteWidth, 36);
      pasteBtnBox.lineStyle(1.2, THEME.colors.accent, 0.9);
      pasteBtnBox.strokeRect(-modalPasteWidth / 2, -14, modalPasteWidth, 36);

      const pasteBtnText = this.add.text(0, 4, 'PASTE ROOM NAME', {
        fontFamily: THEME.fonts.body,
        fontSize: '11px',
        color: THEME.colors.accentHex,
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5);

      const pasteHit = this.add.rectangle(0, 4, modalPasteWidth, 36, 0, 0)
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
        color: THEME.colors.dangerHex,
        align: 'center'
      }).setOrigin(0.5);

      const connectBtnBox = this.add.graphics();
      connectBtnBox.fillStyle(THEME.colors.danger, 1);
      connectBtnBox.fillRect(-modalActionWidth / 2, 58, modalActionWidth, 46);

      const connectBtnText = this.add.text(0, 81, 'CONNECT & JOIN', {
        fontFamily: THEME.fonts.heading,
        fontSize: '14px',
        color: THEME.colors.onAccent,
        fontStyle: 'bold',
        letterSpacing: 1
      }).setOrigin(0.5);

      const connectHit = this.add.rectangle(0, 81, modalActionWidth, 46, 0, 0)
        .setInteractive({ useHandCursor: true });

      const handleConnect = async () => {
        if (typedCode.length < 3) {
          statusLabel.setText('Room name must be at least 3 characters.');
          return;
        }

        this.removeMobileInput();
        connectHit.disableInteractive();
        statusLabel.setText(`Connecting to ${typedCode}...`);
        statusLabel.setColor(THEME.colors.accentHex);

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
          statusLabel.setColor(THEME.colors.dangerHex);
          connectHit.setInteractive({ useHandCursor: true });
        }
      };

      connectHit.on('pointerdown', handleConnect);

      const backBtn = this.add.text(0, 155, '← Back', {
        fontFamily: THEME.fonts.body,
        fontSize: '12px',
        color: THEME.colors.textMuted,
        fontStyle: 'bold'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      backBtn.on('pointerdown', showChoiceView);

      contentContainer.add([title, sub, inputBox, displayCodeText, inputHit, pasteBtnBox, pasteBtnText, pasteHit, statusLabel, connectBtnBox, connectBtnText, connectHit, backBtn]);
      applyReadableText(this);
    };

    showChoiceView();
  }
}