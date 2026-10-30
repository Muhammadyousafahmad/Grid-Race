import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { IntroScene } from './scenes/IntroScene';
import { loadSavedTheme, THEME } from './config/Theme';

/**
 * Scenes keep their 800px board coordinate system while expanding the
 * viewport around it. This fills tall phone screens and wider desktops
 * without stretching the square board.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game-container',
  backgroundColor: THEME.colors.bgHex,
  scale: {
    mode: Phaser.Scale.RESIZE,
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
 * intended typography.
 */
async function boot(): Promise<void> {
  loadSavedTheme();
  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load("700 56px 'Space Grotesk'"),
        document.fonts.load("500 22px 'Space Grotesk'"),
        document.fonts.load("700 16px 'DM Sans'"),
        document.fonts.load("500 16px 'DM Sans'"),
        document.fonts.load("400 16px 'DM Sans'")
      ]);
      await document.fonts.ready;
    } catch (error) {
      console.error('Unable to load the game fonts.', error);
    }
  }

  new Phaser.Game(config);
}

void boot();
