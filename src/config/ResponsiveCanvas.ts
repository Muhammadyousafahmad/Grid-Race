import Phaser from 'phaser';

const MIN_TEXT_PIXELS = 15;

export interface SceneViewport {
  width: number;
  height: number;
  zoom: number;
}

export function getSceneViewport(scene: Phaser.Scene): SceneViewport {
  const { width, height } = scene.scale.gameSize;

  return {
    width,
    height,
    zoom: 1
  };
}

export function fitCameraToViewport(scene: Phaser.Scene): SceneViewport {
  const viewport = getSceneViewport(scene);
  scene.cameras.main.setZoom(1);
  scene.cameras.main.centerOn(viewport.width / 2, viewport.height / 2);
  return viewport;
}

export function applyReadableText(scene: Phaser.Scene): void {
  const fontScale = scene.cameras.main.zoom;
  const visit = (objects: Phaser.GameObjects.GameObject[]): void => {
    objects.forEach((object) => {
      if (object instanceof Phaser.GameObjects.Text) {
        const baseSize = object.getData('responsiveBaseFontSize')
          ?? Number.parseFloat(String(object.style.fontSize));
        if (Number.isFinite(baseSize)) {
          object.setData('responsiveBaseFontSize', baseSize);
          const minPixels = object.getData('responsiveMinPixels') ?? MIN_TEXT_PIXELS;
          object.setFontSize(Math.ceil(Math.max(baseSize, minPixels / fontScale)));
        }
      }

      if (object instanceof Phaser.GameObjects.Container) {
        visit(object.list);
      }
    });
  };

  visit(scene.children.list);
}
