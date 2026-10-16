import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { IntroScene } from './scenes/IntroScene';

/**
 * The game keeps a fixed 800x800 logical coordinate space (the board layout
 * and its unit tests depend on it). `Scale.FIT` uniformly scales that canvas
 * to any viewport — phone portrait/landscape, tablet, desktop or ultrawide —
 * and `CENTER_BOTH` letterboxes it against the page background.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game-container',
  backgroundColor: '#0a0c15',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 800,
    expandParent: false,
    autoRound: true
  },
  render: { antialias: true },
  scene: [IntroScene, MenuScene, GameScene]
};

/**
 * Boot only after the web fonts are available — canvas text is rasterised on
 * draw and cannot reflow later, so the first frame must already have the
 * intended typography. Falls back silently to system fonts when offline.
 */
async function boot(): Promise<void> {
  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load("700 56px 'Space Grotesk'"),
        document.fonts.load("700 22px 'Space Grotesk'"),
        document.fonts.load("700 16px 'Inter'"),
        document.fonts.load("500 16px 'Inter'"),
        document.fonts.load("400 16px 'Inter'")
      ]);
      await document.fonts.ready;
    } catch {
      /* Offline or unsupported — system font fallbacks already in THEME.fonts */
    }
  }

  new Phaser.Game(config);
}

void boot();

