import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { WorldScene } from './scenes/WorldScene';
import { StadiumScene } from './scenes/StadiumScene';
import { ScoreReportScene } from './scenes/ScoreReportScene';
import { GameOverScene } from './scenes/GameOverScene';

import { SpeechBubbleDemoScene } from './scenes/SpeechBubbleDemoScene';

// Detect debug mode from URL before exporting config
let scenes: Phaser.Types.Scenes.SceneType[] = [MenuScene, WorldScene, StadiumScene, ScoreReportScene, GameOverScene, SpeechBubbleDemoScene];
try {
  const url = new URL(window.location.href);
  const demoMode = url.searchParams.get('demo');
  if (demoMode === 'debug' || demoMode === 'speech') {
    scenes = [SpeechBubbleDemoScene];
  }
} catch (e) {
  // fallback to default scenes
}

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

