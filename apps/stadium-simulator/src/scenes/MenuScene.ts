import Phaser from 'phaser';

/**
 * MenuScene provides the main menu for game mode selection
 * Players can choose between Eternal Mode (no timer) or Stadium Run (100s challenge)
 */
export class MenuScene extends Phaser.Scene {
  private debugMode: boolean = false;

  constructor() {
    super({ key: 'MenuScene' });
  }

  init(): void {
    // Parse URL parameters for debug mode
    try {
      const url = new URL(window.location.href);
      this.debugMode = url.searchParams.get('debug') === 'true';
      if (this.debugMode) {
        console.log('DEBUG MODE ENABLED');
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
  }

  preload(): void {
    // TODO: Add sprite loading in preload()
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Title
    const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      font: 'bold 64px Arial',
      color: '#ffffff',
      align: 'center',
    };
    this.add.text(centerX, 100, 'Stadium Wave', titleStyle).setOrigin(0.5);

    // Subtitle
    const subtitleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      font: '24px Arial',
      color: '#cccccc',
      align: 'center',
    };
    this.add.text(centerX, 170, 'Get the crowd to do the wave!', subtitleStyle).setOrigin(0.5);

    // Eternal Mode Button
    const eternalButtonBg = this.add.rectangle(centerX - 200, centerY, 300, 80, 0x0066cc);
    eternalButtonBg.setInteractive();
    eternalButtonBg.on('pointerover', () => {
      eternalButtonBg.setFillStyle(0x0088ff);
    });
    eternalButtonBg.on('pointerout', () => {
      eternalButtonBg.setFillStyle(0x0066cc);
    });
    eternalButtonBg.on('pointerdown', () => {
      this.launchGame('eternal');
    });

    const eternalButtonText = this.add.text(centerX - 200, centerY, 'Eternal Mode', {
      font: 'bold 28px Arial',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);

    const eternalSubtext = this.add.text(centerX - 200, centerY + 45, 'Practice without limits', {
      font: '14px Arial',
      color: '#cccccc',
      align: 'center',
    }).setOrigin(0.5);

    // Stadium Run Button
    const runButtonBg = this.add.rectangle(centerX + 200, centerY, 300, 80, 0xcc6600);
    runButtonBg.setInteractive();
    runButtonBg.on('pointerover', () => {
      runButtonBg.setFillStyle(0xff8800);
    });
    runButtonBg.on('pointerout', () => {
      runButtonBg.setFillStyle(0xcc6600);
    });
    runButtonBg.on('pointerdown', () => {
      this.launchGame('run');
    });

    const runButtonText = this.add.text(centerX + 200, centerY, 'Stadium Run', {
      font: 'bold 28px Arial',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);

    const runSubtext = this.add.text(centerX + 200, centerY + 45, '100 second challenge', {
      font: '14px Arial',
      color: '#cccccc',
      align: 'center',
    }).setOrigin(0.5);

    // Debug Info
    if (this.debugMode) {
      this.add.text(10, height - 20, 'DEBUG MODE', {
        font: '12px monospace',
        color: '#ffff00',
      });
    }
  }

  private launchGame(mode: 'eternal' | 'run'): void {
    this.scene.start('StadiumScene', { gameMode: mode, debugMode: this.debugMode });
  }

  update(): void {
    // Menu doesn't need update logic
  }
}

