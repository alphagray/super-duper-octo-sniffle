import Phaser from 'phaser';
import { config } from './config';
import { initDevPanel } from './ui/DevPanel';

// Initialize dev panel (only in development mode)
initDevPanel();

// Check for demo mode parameters before creating game
let demoMode: string | null = null;
try {
  const url = new URL(window.location.href);
  demoMode = url.searchParams.get('demo');
} catch (e) {
  // Silently fail if URL parsing fails
}

// Create game instance
const game = new Phaser.Game(config);

// Stop default scene and start appropriate demo scene
if (demoMode === 'section') {
  game.scene.stop('StadiumScene');
  game.scene.start('TestSectionScene');
} else if (demoMode === 'debug') {
  game.scene.stop('StadiumScene');
  game.scene.start('TestSectionDebugScene');
} else if (demoMode === 'speech') {
  game.scene.stop('StadiumScene');
  game.scene.start('SpeechBubbleDemoScene');
}

