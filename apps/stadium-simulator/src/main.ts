import Phaser from 'phaser';
import { config } from './config';
import { initDevPanel } from './ui/DevPanel';

// Initialize dev panel (only in development mode)
initDevPanel();

// Create game instance
// Note: Demo mode scene selection is now handled in config.ts
const game = new Phaser.Game(config);

