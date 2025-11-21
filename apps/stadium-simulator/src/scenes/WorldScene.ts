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
  private debugMode: boolean = false;
  private gridOverlay!: GridOverlay;

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

    // Launch StadiumScene first
    this.scene.launch('StadiumScene', {
      debugMode: this.debugMode,
      gridManager: this.gridManager,
    });

    // Wait for StadiumScene to be ready, then connect AIManager to GridOverlay
    const stadiumScene = this.scene.get('StadiumScene');
    if (stadiumScene && this.gridOverlay) {
      this.gridOverlay.setStadiumScene(stadiumScene);
      
      // Listen for stadiumReady event
      stadiumScene.events.once('stadiumReady', (data: any) => {
        console.log('[WorldScene] Received stadiumReady event');
        if (data.aiManager && this.gridOverlay) {
          this.gridOverlay.setAIManager(data.aiManager);
          console.log('[WorldScene] Connected AIManager to GridOverlay');
        }
      });
    }

    // Setup keyboard toggles for grid overlay
    const keyboard = this.input.keyboard;
    if (keyboard) {
      // G key: Toggle grid visibility
      keyboard.addKey('G').on('down', () => {
        if (this.gridOverlay) {
          const newVisibility = !this.gridOverlay.visible;
          this.gridOverlay.setDebugVisible(newVisibility);
          console.log(`[WorldScene] Grid overlay: ${newVisibility ? 'ON' : 'OFF'}`);
        }
      });

      // N key: Toggle navigation nodes (only if grid visible)
      keyboard.addKey('N').on('down', () => {
        if (this.gridOverlay) {
          this.gridOverlay.toggleNodes();
        }
      });

      // V key: Toggle vendor paths (only if grid visible)
      keyboard.addKey('V').on('down', () => {
        if (this.gridOverlay) {
          this.gridOverlay.toggleVendorPaths();
        }
      });
    }

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
