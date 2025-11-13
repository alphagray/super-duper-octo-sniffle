import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { StadiumScene } from './scenes/StadiumScene';
import { GameOverScene } from './scenes/GameOverScene';
import { TestSectionScene } from './scenes/TestSectionScene';

export const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  parent: 'game-container',
  backgroundColor: '#2d2d2d',
  pixelArt: true,
  antialias: false,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [StadiumScene, MenuScene, GameOverScene, TestSectionScene],
};
