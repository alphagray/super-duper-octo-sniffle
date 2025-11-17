import Phaser from 'phaser';
import { GridManager } from '@/managers/GridManager';
import { GridOverlay } from '@/scenes/GridOverlay';
import { gameBalance } from '@/config/gameBalance';

export interface WorldSceneInitData {
  debugMode?: boolean;
}

/**
 * WorldScene serves as the foundational layer for the stadium simulator.
 * It owns the world grid, renders debug overlays, and launches StadiumScene as a parallel scene.
 */
export class WorldScene extends Phaser.Scene {
  private gridManager!: GridManager;
  private gridOverlay?: GridOverlay;
  private debugMode: boolean = false;

  constructor() {
    super({ key: 'WorldScene' });
  }

  init(data: WorldSceneInitData): void {
    this.debugMode = data?.debugMode || false;
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Instantiate grid manager with world dimensions
    this.gridManager = new GridManager({
      width,
      height,
    });

    // Create grid overlay for debug rendering
    this.gridOverlay = new GridOverlay(this, this.gridManager);

    // Setup keyboard toggle for grid overlay
    const toggleKey = gameBalance.grid.debug.toggleKey;
    if (toggleKey) {
      this.input.keyboard?.addKey(toggleKey).on('down', () => {
        if (this.gridOverlay) {
          const newVisibility = !this.gridOverlay.visible;
          this.gridOverlay.setDebugVisible(newVisibility);
          console.log(`[WorldScene] Grid overlay: ${newVisibility ? 'ON' : 'OFF'}`);
        }
      });
    }

    // Launch StadiumScene as parallel scene with grid reference (run mode only)
    this.scene.launch('StadiumScene', {
      debugMode: this.debugMode,
      gridManager: this.gridManager,
    });

    console.log(`[WorldScene] Initialized (mode=run, debug=${this.debugMode})`);
  }

  update(time: number, delta: number): void {
    // WorldScene update logic (currently minimal; grid manager is event-driven)
  }

  /**
   * Expose GridManager for external access (e.g., from StadiumScene via registry)
   */
  public getGridManager(): GridManager {
    return this.gridManager;
  }
}
