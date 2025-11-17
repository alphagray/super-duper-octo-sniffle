import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { WorldScene } from './scenes/WorldScene';
import { StadiumScene } from './scenes/StadiumScene';
import { ScoreReportScene } from './scenes/ScoreReportScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GridOverlay } from './scenes/GridOverlay';

// Core game scenes
let scenes: Phaser.Types.Scenes.SceneType[] = [MenuScene, WorldScene, StadiumScene, ScoreReportScene, GameOverScene];

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
  scene: scenes,
  dom: {
    createContainer: true
  },
};

