import Phaser from 'phaser';
import { GameStateManager } from '@/managers/GameStateManager';
import { WaveManager } from '@/managers/WaveManager';
import { VendorManager } from '@/managers/VendorManager';
import { Fan } from '@/sprites/Fan';

/**
 * StadiumScene renders the visual state of the stadium simulator
 * Uses GameStateManager for all game logic
 */
export class StadiumScene extends Phaser.Scene {
  private gameState: GameStateManager;
  private waveManager!: WaveManager;
  private vendorManager!: VendorManager;
  private sectionAText?: Phaser.GameObjects.Text;
  private sectionBText?: Phaser.GameObjects.Text;
  private sectionCText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private countdownText?: Phaser.GameObjects.Text;
  private sectionRects!: Phaser.GameObjects.Rectangle[];
  private sectionFans: Fan[][] = [];
  private demoMode: boolean = false;
  private successStreak: number = 0;

  constructor() {
    super({ key: 'StadiumScene' });
    this.gameState = new GameStateManager();
  }

  create(): void {
    // Initialize VendorManager first
    this.vendorManager = new VendorManager(this.gameState, 2);

    // Initialize WaveManager with VendorManager for interference checks
    this.waveManager = new WaveManager(this.gameState, this.vendorManager);

    // Initialize section rectangles array
    this.sectionRects = [];
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

    // Section A - Blue
    const rectA = this.add.rectangle(200, 300, 250, 200, 0x4a90e2);
    this.sectionRects.push(rectA);
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

    // Section B - Blue (match A)
    const rectB = this.add.rectangle(500, 300, 250, 200, 0x4a90e2);
    this.sectionRects.push(rectB);
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

    // Section C - Blue (match A)
    const rectC = this.add.rectangle(800, 300, 250, 200, 0x4a90e2);
    this.sectionRects.push(rectC);
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

    // Populate fans for each section (4 rows x 8 cols)
    this.populateSection(0, rectA, 'A');
    this.populateSection(1, rectB, 'B');
    this.populateSection(2, rectC, 'C');

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
      const rect = this.sectionRects[sectionIndex];
      // Add "VENDOR HERE" text or icon
      this.add.text(rect.x, rect.y - 80, '🍺 VENDOR', {
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
      const rect = this.sectionRects[sectionIndex];

      // Increment success streak
      this.successStreak++;

      // Flash green with alpha tween
      this.tweens.add({
        targets: rect,
        alpha: 0.5,
        duration: 200,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          rect.alpha = 1;
        }
      });

      // Add particle burst using simple circles
      this.createParticleBurst(rect.x, rect.y, 0x00ff00);

      // Add screen shake on success streak (3 or more)
      if (this.successStreak >= 3) {
        this.cameras.main.shake(200, 0.005);
      }

      // Play the visual wave for fans in this section and await completion,
      // then trigger an immediate per-section poke jiggle.
      await this.playSectionWave(sectionIndex);
      const fans = this.sectionFans[sectionIndex] || [];
      fans.forEach((f) => f.pokeJiggle(0.9, 900));
    });

    this.waveManager.on('sectionFail', async (data: { section: string; chance: number }) => {
      const sectionIndex = this.getSectionIndex(data.section);
      const rect = this.sectionRects[sectionIndex];

      // Reset success streak
      this.successStreak = 0;

      // Flash red with fill color change
      const originalColor = rect.fillColor;
      this.tweens.add({
        targets: rect,
        alpha: 0.7,
        duration: 300,
        yoyo: true,
        onStart: () => {
          rect.setFillStyle(0xff0000);
        },
        onComplete: () => {
          rect.setFillStyle(originalColor);
          rect.alpha = 1;
        }
      });

      // Also animate fans on section fail so the crowd still reacts,
      // await their completion and then poke-jiggle the section.
      await this.playSectionWave(sectionIndex);
      const fansFail = this.sectionFans[sectionIndex] || [];
      fansFail.forEach((f) => f.pokeJiggle(0.45, 700));
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
      const fans = this.sectionFans[si] || [];
      const sectionId = sectionIds[si];
      const section = this.gameState.getSection(sectionId);
      // intensity: thirsty OR distracted (low attention)
      const thirstNorm = Phaser.Math.Clamp(section.thirst / 100, 0, 1);
      const distractNorm = Phaser.Math.Clamp((100 - section.attention) / 100, 0, 1);
      const intensity = Math.max(thirstNorm, distractNorm);

      fans.forEach((fan) => {
        fan.setIntensity(intensity);
      });
    }
  }

  private populateSection(sectionIndex: number, rect: Phaser.GameObjects.Rectangle, sectionId: string): void {
    const rows = 4;
    const cols = 8;
    const fans: Fan[] = [];

    const width = rect.width || 250;
    const height = rect.height || 200;
    const startX = rect.x - width / 2;
    const startY = rect.y - height / 2;
    const cellW = width / cols;
    const cellH = height / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + cellW * c + cellW / 2;
        const y = startY + cellH * r + cellH / 2;
        const fan = new Fan(this, x, y, 26);
        fans.push(fan);
      }
    }

    this.sectionFans[sectionIndex] = fans;
  }

  private playSectionWave(sectionIndex: number): Promise<void> {
    const fans = this.sectionFans[sectionIndex] || [];
    const cols = 8;
    const promises: Promise<void>[] = [];
    fans.forEach((fan, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      const delay = c * 45 + r * 10;
      promises.push(fan.playWave(delay));
    });
    return Promise.all(promises).then(() => undefined);
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

  /**
   * Creates a particle burst effect at the specified location
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param color - Particle color
   */
  private createParticleBurst(x: number, y: number, color: number): void {
    // Create simple circle particles
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 100 + Math.random() * 50;
      
      const particle = this.add.circle(x, y, 4, color);
      
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 600,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }
}
