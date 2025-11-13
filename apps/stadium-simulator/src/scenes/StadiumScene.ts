import Phaser from 'phaser';
import { GameStateManager } from '@/managers/GameStateManager';
import { WaveManager } from '@/managers/WaveManager';
import { VendorManager } from '@/managers/VendorManager';
import { StadiumSection } from '@/sprites/StadiumSection';
import { SectionConfig } from '@/types/GameTypes';
import { SeatManager } from '@/managers/SeatManager';

/**
 * StadiumScene renders the visual state of the stadium simulator
 * Orchestrates GameStateManager, WaveManager, VendorManager, and StadiumSection objects
 */
export class StadiumScene extends Phaser.Scene {
  private gameState: GameStateManager;
  private waveManager!: WaveManager;
  private vendorManager!: VendorManager;
  private seatManager!: SeatManager;
  private sectionAText?: Phaser.GameObjects.Text;
  private sectionBText?: Phaser.GameObjects.Text;
  private sectionCText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private countdownText?: Phaser.GameObjects.Text;
  private sections: StadiumSection[] = [];
  private demoMode: boolean = false;
  private successStreak: number = 0;

  constructor() {
    super({ key: 'StadiumScene' });
    this.gameState = new GameStateManager();
  }

  create(): void {
    // Initialize VendorManager first
    this.vendorManager = new VendorManager(this.gameState, 2);

    // Initialize SeatManager
    this.seatManager = new SeatManager(this);

    // Section config defaults
    const sectionConfig: SectionConfig = {
      width: 250,
      height: 200,
      rowCount: 4,
      seatsPerRow: 8,
      rowBaseHeightPercent: 0.15,
      startLightness: 62,
      autoPopulate: true,
    };

    // Create 3 stadium sections
    const sectionA = new StadiumSection(this, 200, 300, sectionConfig, 'A');
    const sectionB = new StadiumSection(this, 500, 300, sectionConfig, 'B');
    const sectionC = new StadiumSection(this, 800, 300, sectionConfig, 'C');
    this.sections = [sectionA, sectionB, sectionC];

    // Initialize SeatManager with sections
    this.seatManager.initializeSections(this.sections);
    if (sectionConfig.autoPopulate) {
      this.seatManager.populateAllSeats();
    }

    // Initialize WaveManager with VendorManager and SeatManager
    this.waveManager = new WaveManager(this.gameState, this.vendorManager, this.seatManager);
    this.successStreak = 0;

    // Title at top center
    this.add.text(this.cameras.main.centerX, 50, 'STADIUM SIMULATOR', {
      fontSize: '48px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    // Score display at top-right
    this.scoreText = this.add.text(900, 50, 'Score: 0', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(1, 0.5);

    // Countdown display at top-left
    this.countdownText = this.add.text(100, 50, '', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    // Section labels
    this.add.text(200, 250, 'Section A', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.sectionAText = this.add.text(200, 420, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.add.text(500, 250, 'Section B', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.sectionBText = this.add.text(500, 420, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.add.text(800, 250, 'Section C', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.sectionCText = this.add.text(800, 420, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    // Initial update of text displays
    this.updateDisplay();

    // Demo mode: read from URL param `?demo=true` so you can start with stable stats
    try {
      this.demoMode = new URL(window.location.href).searchParams.get('demo') === 'true';
    } catch (e) {
      this.demoMode = false;
    }

    // If demo mode, set sections to ideal values (max happiness, zero thirst)
    if (this.demoMode) {
      ['A', 'B', 'C'].forEach((id) => {
        // set happiness to max (100) and thirst to 0
        this.gameState.updateSectionStat(id, 'happiness', 100);
        this.gameState.updateSectionStat(id, 'thirst', 0);
      });
      // refresh display after forcing values
      this.updateDisplay();
    }

    // Add a small DOM button to toggle demo mode at runtime for quick testing
    const demoBtn = document.createElement('button');
    demoBtn.id = 'demo-mode-btn';
    demoBtn.textContent = this.demoMode ? 'Demo Mode: ON' : 'Demo Mode: OFF';
    demoBtn.style.position = 'absolute';
    demoBtn.style.top = '12px';
    demoBtn.style.left = '12px';
    demoBtn.style.zIndex = '9999';
    demoBtn.addEventListener('click', () => {
      this.demoMode = !this.demoMode;
      demoBtn.textContent = this.demoMode ? 'Demo Mode: ON' : 'Demo Mode: OFF';
    });
    document.body.appendChild(demoBtn);

    // Setup wave button listener
    const waveBtn = document.getElementById('wave-btn') as HTMLButtonElement;
    if (waveBtn) {
      waveBtn.addEventListener('click', () => {
        if (!this.waveManager.isActive()) {
          this.waveManager.startWave();
          waveBtn.disabled = true;
          waveBtn.textContent = 'WAVE IN PROGRESS...';
        }
      });
    }

    // Setup vendor button listeners
    ['A', 'B', 'C'].forEach(section => {
      document.getElementById(`v1-${section.toLowerCase()}`)?.addEventListener('click', () => {
        this.vendorManager.placeVendor(0, section);
      });
      document.getElementById(`v2-${section.toLowerCase()}`)?.addEventListener('click', () => {
        this.vendorManager.placeVendor(1, section);
      });
    });

    // Listen to VendorManager events for visual feedback
    this.vendorManager.on('vendorPlaced', (data: { vendorId: number; section: string }) => {
      const sectionIndex = data.section.charCodeAt(0) - 65; // A=0, B=1, C=2
      const section = this.sections[sectionIndex];
      section.placedVendor(data.vendorId);
      // Add "VENDOR HERE" text or icon at section position
      this.add.text(section.x, section.y - 80, '🍺 VENDOR', {
        fontSize: '20px'
      }).setOrigin(0.5).setName(`vendor-${data.vendorId}-indicator`);
    });

    this.vendorManager.on('serviceComplete', (data: { vendorId: number; section: string }) => {
      // Remove indicator
      const indicator = this.children.getByName(`vendor-${data.vendorId}-indicator`);
      indicator?.destroy();
    });

    // Listen to WaveManager events for visual feedback
    this.waveManager.on('waveStart', () => {
      this.successStreak = 0;
    });

    this.waveManager.on('sectionSuccess', async (data: { section: string; chance: number }) => {
      const sectionIndex = this.getSectionIndex(data.section);
      const section = this.sections[sectionIndex];

      // Increment success streak
      this.successStreak++;

      // Play the visual wave for fans in this section and await completion,
      // then trigger an immediate per-section poke jiggle.
      await section.playWave();
      const fans = section.getFans();
      fans.forEach((f) => f.pokeJiggle(0.9, 900));

      // Flash green effect after wave animation
      await section.flashSuccess();

      // Add screen shake on success streak (3 or more)
      if (this.successStreak >= 3) {
        this.cameras.main.shake(200, 0.005);
      }
    });

    this.waveManager.on('sectionFail', async (data: { section: string; chance: number }) => {
      const sectionIndex = this.getSectionIndex(data.section);
      const section = this.sections[sectionIndex];

      // Reset success streak
      this.successStreak = 0;

      // Also animate fans on section fail so the crowd still reacts,
      // await their completion and then poke-jiggle the section.
      await section.playWave();
      const fans = section.getFans();
      fans.forEach((f) => f.pokeJiggle(0.45, 700));

      // Flash red effect after wave animation
      await section.flashFail();
    });

    this.waveManager.on('waveComplete', () => {
      if (waveBtn) {
        waveBtn.disabled = false;
        waveBtn.textContent = 'START WAVE';
      }
      this.successStreak = 0;
    });
  }

  update(time: number, delta: number): void {
    // Update game state with elapsed time
    if (!this.demoMode) {
      this.gameState.updateStats(delta);
    }

    // Update vendor manager
    this.vendorManager.update(delta);

    // Update wave countdown if active
    if (this.waveManager.isActive()) {
      this.waveManager.updateCountdown(delta);
      
      // Update countdown display
      if (this.countdownText) {
        const countdown = Math.max(0, Math.ceil(this.waveManager.getCountdown()));
        this.countdownText.setText(`Wave: ${countdown}s`);
      }
    } else {
      if (this.countdownText) {
        this.countdownText.setText('');
      }
    }

    // Update score display
    if (this.scoreText) {
      this.scoreText.setText(`Score: ${this.waveManager.getScore()}`);
    }

    // Update visual displays
    this.updateDisplay();

    // Update fans visuals according to section stats
    const sectionIds = ['A', 'B', 'C'];
    for (let si = 0; si < 3; si++) {
      const section = this.sections[si];
      const sectionId = sectionIds[si];
      const sectionState = this.gameState.getSection(sectionId);
      // intensity: thirsty OR distracted (low attention)
      const thirstNorm = Phaser.Math.Clamp(sectionState.thirst / 100, 0, 1);
      const distractNorm = Phaser.Math.Clamp((100 - sectionState.attention) / 100, 0, 1);
      const intensity = Math.max(thirstNorm, distractNorm);

      section.updateFanIntensity(intensity);
    }
  }

  /**
   * Updates the text displays for all sections
   */
  private updateDisplay(): void {
    const sectionA = this.gameState.getSection('A');
    const sectionB = this.gameState.getSection('B');
    const sectionC = this.gameState.getSection('C');

    if (this.sectionAText) {
      this.sectionAText.setText(
        `Happiness: ${Math.round(sectionA.happiness)}\n` +
        `Thirst: ${Math.round(sectionA.thirst)}\n` +
        `Attention: ${Math.round(sectionA.attention)}`
      );
    }

    if (this.sectionBText) {
      this.sectionBText.setText(
        `Happiness: ${Math.round(sectionB.happiness)}\n` +
        `Thirst: ${Math.round(sectionB.thirst)}\n` +
        `Attention: ${Math.round(sectionB.attention)}`
      );
    }

    if (this.sectionCText) {
      this.sectionCText.setText(
        `Happiness: ${Math.round(sectionC.happiness)}\n` +
        `Thirst: ${Math.round(sectionC.thirst)}\n` +
        `Attention: ${Math.round(sectionC.attention)}`
      );
    }
  }

  /**
   * Maps section ID to array index
   * @param sectionId - The section identifier ('A', 'B', or 'C')
   * @returns The section index (0, 1, or 2)
   */
  private getSectionIndex(sectionId: string): number {
    const map: { [key: string]: number } = { 'A': 0, 'B': 1, 'C': 2 };
    return map[sectionId] || 0;
  }
}
