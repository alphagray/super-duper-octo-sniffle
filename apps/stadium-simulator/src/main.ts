import Phaser from 'phaser';
import { config } from './config';

// Create game instance
const game = new Phaser.Game(config);

// Check for demo mode parameters
try {
  const url = new URL(window.location.href);
  const demoMode = url.searchParams.get('demo');
  
  if (demoMode === 'section') {
    // Navigate to test section scene instead of default
    game.scene.start('TestSectionScene');
  }
} catch (e) {
  // Silently fail if URL parsing fails
}

