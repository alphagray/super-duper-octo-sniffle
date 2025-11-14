import Phaser from 'phaser';
import { GameStateManager, GameMode } from '@/managers/GameStateManager';
import { WaveManager } from '@/managers/WaveManager';
import { VendorManager } from '@/managers/VendorManager';
import { StadiumSection } from '@/sprites/StadiumSection';
import { AnnouncerService } from '@/managers/AnnouncerService';
import { SectionConfig } from '@/types/GameTypes';
import { SeatManager } from '@/managers/SeatManager';
import { gameBalance } from '@/config/gameBalance';

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
  private sessionTimerText?: Phaser.GameObjects.Text;
  private sections: StadiumSection[] = [];
  private demoMode: boolean = false;
  private debugMode: boolean = false;
  private successStreak: number = 0;
  private gameMode: GameMode = 'eternal';
  private sessionCountdownOverlay?: Phaser.GameObjects.Container;
  private waveStrengthMeter?: Phaser.GameObjects.Container;
  private forceSputterNextSection: boolean = false;
  private debugEventLog: string[] = [];
  private hasLoggedUpdate: boolean = false;

  constructor() {
    super({ key: 'StadiumScene' });
    this.gameState = new GameStateManager();
  }

  init(data: any): void {
    // Get game mode and debug mode from scene data
    this.gameMode = data?.gameMode || 'eternal';
    this.debugMode = data?.debugMode || false;

    if (this.debugMode) {
      console.log('StadiumScene initialized with mode:', this.gameMode);
    }
  }

  create(): void {
    // Initialize GameStateManager with the selected mode
    this.gameState.startSession(this.gameMode);

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

    const announcerService = new AnnouncerService();
    announcerService
      .getCommentary(JSON.stringify({ event: 'waveStart' }))
      .then((result) => {
        console.log('[AnnouncerService test] raw result:', result);
      })
      .catch((error) => {
        console.error('[AnnouncerService test] request failed:', error);
      });

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

    // Session timer display (run mode only)
    if (this.gameMode === 'run') {
      this.sessionTimerText = this.add.text(512, 20, '100s', {
        fontSize: '28px',
        fontFamily: 'Arial',
        color: '#ffff00',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0);
    }

    // Countdown display at top-left
    this.countdownText = this.add.text(100, 50, '', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    // Create wave strength meter (will be shown on wave start)
    this.createWaveStrengthMeter();

    // Section labels
    this.add.text(200, 140, 'Section A', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    const statOffsetY = 300 + 100 + gameBalance.waveAutonomous.sectionStatOffsetY; // section Y + baseline offset + config offset
    this.sectionAText = this.add.text(200, statOffsetY, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.add.text(500, 140, 'Section B', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.sectionBText = this.add.text(500, statOffsetY, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.add.text(800, 140, 'Section C', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.sectionCText = this.add.text(800, statOffsetY, '', {
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

    // Show session countdown overlay before game starts (3 second countdown)
    if (this.gameMode === 'run') {
      this.showSessionCountdownOverlay();
    } else {
      // In eternal mode, start immediately
      this.gameState.activateSession();
    }

    // Setup wave button listener
    const waveBtn = document.getElementById('wave-btn') as HTMLButtonElement;
    if (waveBtn) {
      // Only show START WAVE button in debug mode for autonomous wave system
      const debugMode = new URL(window.location.href).searchParams.get('demo') === 'debug';
      if (!debugMode) {
        waveBtn.style.display = 'none';
      } else {
        // Debug mode: clicking starts a wave from a random section
        waveBtn.addEventListener('click', () => {
          if (!this.waveManager.isActive()) {
            const sections = this.gameState.getSections();
            const randomSection = sections[Math.floor(Math.random() * sections.length)];
            const wave = this.waveManager.createWave(randomSection.id);
            this.showIncomingCue(randomSection.id);
            waveBtn.disabled = true;
            waveBtn.textContent = 'WAVE IN PROGRESS...';
          }
        });
      }
    }    // Setup Force Sputter button
    const forceSputter = () => {
      if (!this.waveManager.isActive() && this.gameState.getSessionState() === 'active') {
        this.forceSputterNextSection = true;
        this.waveManager.startWave();
        if (waveBtn) {
          waveBtn.disabled = true;
          waveBtn.textContent = 'WAVE IN PROGRESS...';
        }
        console.log('[DEBUG] Force Sputter initiated - will degrade strength on section B');
      }
    };

    // Add keyboard shortcut for force sputter (press 'S')
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.S).on('down', forceSputter);

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

    // Listen to GameStateManager events
    this.gameState.on('sessionStateChanged', (data: { state: string }) => {
      if (data.state === 'complete') {
        this.endSession();
      }
    });

    // Listen to WaveManager events for visual feedback
    this.waveManager.on('waveStart', () => {
      this.successStreak = 0;
      // Show wave strength meter
      if (this.waveStrengthMeter) {
        this.waveStrengthMeter.setVisible(true);
      }
    });

    // Listen to wave strength changes
    this.waveManager.on('waveStrengthChanged', (data: { strength: number }) => {
      this.updateWaveStrengthMeter(data.strength);
    });

    this.waveManager.on('sectionWave', async (data: { section: string; strength: number; direction: 'left' | 'right' }) => {
      const sectionIndex = this.getSectionIndex(data.section);
      const section = this.sections[sectionIndex];
      section.resetFanWaveState();

      const forced = this.waveManager.consumeForcedFlags();
      let waveStrength = data.strength;
      const direction = data.direction || 'right'; // Default to right if not specified
      const cfg = gameBalance.waveClassification;
      const baseRecoveryBonus = gameBalance.waveStrength.recoveryBonus;
      const boosterType = this.waveManager.getLastBoosterType();
      const participationMultiplier = boosterType === 'participation' ? this.waveManager.getWaveBoosterMultiplier() : 1;

      if (forced.sputter) {
        const degr = cfg.forcedSputterDegradationMin + Math.random() * (cfg.forcedSputterDegradationMax - cfg.forcedSputterDegradationMin);
        waveStrength = Math.max(0, waveStrength - degr);
        this.addDebugEvent(`[${data.section}] FORCED SPUTTER degrade=${Math.round(degr)}`);
      }
      if (forced.death) {
        waveStrength = cfg.forcedDeathStrength;
        this.addDebugEvent(`[${data.section}] FORCED DEATH strength=${waveStrength}`);
      }

      const rows = section.getRows();
      const maxColumns = rows[0]?.getSeats().length ?? 8;
      let totalFans = 0;
      let totalParticipatingFans = 0;
      let successCount = 0;
      let sputterCount = 0;
      let deathCount = 0;
      let previousColumnState: 'success' | 'sputter' | 'death' = 'success';

      // Determine column iteration order based on wave direction
      const columnOrder = direction === 'left' 
        ? Array.from({ length: maxColumns }, (_, i) => maxColumns - 1 - i) // Right to left: [7,6,5,4,3,2,1,0]
        : Array.from({ length: maxColumns }, (_, i) => i); // Left to right: [0,1,2,3,4,5,6,7]

      console.log(`[Wave Animation] Section ${data.section}: animating ${direction} (columns: ${columnOrder.slice(0, 3).join(',')}...)`);

      for (let idx = 0; idx < maxColumns; idx++) {
        const col = columnOrder[idx];
        const fanStates = section.calculateColumnParticipation(col, waveStrength * participationMultiplier);
        let columnParticipating = 0;
        for (const st of fanStates) {
          totalFans++;
          if (st.willParticipate) {
            totalParticipatingFans++;
            columnParticipating++;
          }
        }
        const columnRate = fanStates.length > 0 ? columnParticipating / fanStates.length : 0;
        const columnState = this.waveManager.classifyColumn(columnRate);
        this.waveManager.recordColumnState(data.section, col, columnRate, columnState);
        this.waveManager.pushColumnParticipation(columnRate);

        // Enhanced recovery (previous sputter -> current success)
        if (previousColumnState === 'sputter' && columnState === 'success') {
          const enhanced = this.waveManager.calculateEnhancedRecovery(previousColumnState, columnState); // returns recoveryPowerMultiplier or 0
          if (enhanced > 0) {
            const recoveryMultiplier = 1 + enhanced + (boosterType === 'recovery' ? (this.waveManager.getWaveBoosterMultiplier() - 1) : 0);
            const bonus = baseRecoveryBonus * recoveryMultiplier;
            waveStrength = Math.min(100, waveStrength + bonus);
            this.waveManager.setWaveStrength(waveStrength);
            this.addDebugEvent(`[${data.section}] Enhanced Recovery +${Math.round(bonus)} → ${Math.round(waveStrength)}`);
          }
        }

        if (columnState === 'success') successCount++; else if (columnState === 'sputter') sputterCount++; else deathCount++;
        previousColumnState = columnState;

        let visualState: 'full' | 'sputter' | 'death' = columnState === 'success' ? 'full' : (columnState === 'sputter' ? 'sputter' : 'death');
        await section.playColumnAnimation(col, fanStates, visualState, waveStrength);

        if (idx < maxColumns - 1) {
          await new Promise(res => this.time.delayedCall(gameBalance.waveTiming.columnDelay, res));
        }
      }

      const participationRate = totalFans > 0 ? totalParticipatingFans / totalFans : 0;
      let sectionState: 'success' | 'sputter' | 'death' = 'death';
      if (successCount >= sputterCount && successCount >= deathCount) sectionState = 'success';
      else if (sputterCount >= deathCount) sectionState = 'sputter';
      else sectionState = 'death';
      if (forced.death) sectionState = 'death';

      if (sectionState === 'success') this.successStreak++; else this.successStreak = 0;

      this.addDebugEvent(`[${data.section}] ${sectionState.toUpperCase()} cols S:${successCount} SP:${sputterCount} D:${deathCount} rate=${Math.round(participationRate*100)}%`);
      this.waveManager.adjustWaveStrength(sectionState, participationRate);
      this.waveManager.setLastSectionWaveState(sectionState);

      const fans = section.getFans();
      fans.forEach(f => {
        if (f._lastWaveParticipated) {
          f.pokeJiggle(sectionState === 'success' ? 0.9 : 0.45, sectionState === 'success' ? 900 : 700);
        }
      });

      if (sectionState === 'success') {
        section.flashSuccess();
        if (this.successStreak >= 3) this.cameras.main.shake(200, 0.005);
      } else {
        section.flashFail();
      }

      this.updateDebugStats();
    });

    this.waveManager.on('waveComplete', () => {
      this.gameState.incrementCompletedWaves();
      if (waveBtn) {
        waveBtn.disabled = false;
        waveBtn.textContent = 'START WAVE';
      }
      this.successStreak = 0;
      // Hide wave strength meter
      if (this.waveStrengthMeter) {
        this.waveStrengthMeter.setVisible(false);
      }
    });

    // Create debug panel
    this.createDebugPanel();
  }


  update(time: number, delta: number): void {
    // Debug: Log once to confirm update is running
    if (!this.hasLoggedUpdate) {
      console.log('[StadiumScene] UPDATE LOOP IS RUNNING');
      console.log('[StadiumScene] waveAutonomous.enabled =', gameBalance.waveAutonomous.enabled);
      console.log('[StadiumScene] Wave manager active =', this.waveManager.isActive());
      this.hasLoggedUpdate = true;
    }

    // Update session timer if active
    if (this.gameState.getSessionState() === 'active') {
      this.gameState.updateSession(delta);
      
      // Update session timer display
      if (this.sessionTimerText && this.gameMode === 'run') {
        const timeRemaining = this.gameState.getSessionTimeRemaining();
        const seconds = Math.max(0, Math.ceil(timeRemaining / 1000));
        this.sessionTimerText.setText(`${seconds}s`);
      }
    }

    // Update fan stats (thirst decay, happiness, attention)
    // Only update stats when session is actually active (not during countdown)
    if (!this.demoMode && this.gameState.getSessionState() === 'active') {
      this.sections.forEach(section => {
        section.updateFanStats(delta);
      });

      // Sync section-level stats from fan aggregates for UI display
      const sectionIds = ['A', 'B', 'C'];
      for (let si = 0; si < 3; si++) {
        const section = this.sections[si];
        const sectionId = sectionIds[si];
        const aggregate = section.getAggregateStats();
        
        // Update GameStateManager with aggregate values for UI display
        this.gameState.updateSectionStat(sectionId, 'happiness', aggregate.happiness);
        this.gameState.updateSectionStat(sectionId, 'thirst', aggregate.thirst);
        this.gameState.updateSectionStat(sectionId, 'attention', aggregate.attention);
      }
    }

    // Update vendor manager
    this.vendorManager.update(delta);

    // Check for autonomous wave triggering (only when session is active)
    if (gameBalance.waveAutonomous.enabled && 
        !this.waveManager.isActive() && 
        this.gameState.getSessionState() === 'active') {
      const triggerSection = this.waveManager.checkWaveProbability();
      if (triggerSection) {
        const wave = this.waveManager.createWave(triggerSection);
        this.showIncomingCue(triggerSection);
        console.log(`[Autonomous Wave] Started from section ${triggerSection}, Wave ID: ${wave.id}`);
      }
    }

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

    // Update fans visuals based on their personal thirst
    this.sections.forEach(section => {
      section.updateFanIntensity(); // No parameter = use personal thirst
    });

    // Update debug panel stats
    this.updateDebugStats();
  }

  /**
   * Show incoming wave cue visual
   * @param sectionId - Section where wave will start
   */
  private showIncomingCue(sectionId: string): void {
    // TODO: Implement visual cue
    // - Blue blink effect on section sprite
    // - Countdown text below section (using sectionStatOffsetY from config)
    // - Duration from gameBalance.waveAutonomous.incomingCueDuration
    console.log(`[Incoming Cue] Wave starting from section ${sectionId}`);
  }

  /**
   * Play wave start particle effect
   * @param x - X position
   * @param y - Y position
   */
  private playWaveStartEffect(x: number, y: number): void {
    // TODO: Implement particle spray using Phaser.GameObjects.Particles
    // - Simple upward spray of particles
    // - Short duration (1-2 seconds)
    console.log(`[Particle Effect] Wave start at (${x}, ${y})`);
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
   * Shows the session countdown overlay (3-2-1-GO!)
   * Only used for run mode before session starts
   */
  private showSessionCountdownOverlay(): void {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // Create overlay container with semi-transparent background
    this.sessionCountdownOverlay = this.add.container(0, 0);
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    this.sessionCountdownOverlay.add(bg);

    const countdownText = this.add.text(centerX, centerY, '3', {
      fontSize: `${gameBalance.ui.countdownFontSize}px`,
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.sessionCountdownOverlay.add(countdownText);

    // Animate countdown
    let countdown = 3;
    const countdownLoop = this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        countdown--;
        countdownText.setText(countdown > 0 ? countdown.toString() : 'GO!');
        countdownText.setAlpha(1);

        // Flash effect
        this.tweens.add({
          targets: countdownText,
          alpha: 0,
          duration: 800,
          ease: 'Power2.easeOut',
        });

        // Scale effect
        this.tweens.add({
          targets: countdownText,
          scale: 0.5,
          duration: 1000,
          ease: 'Back.easeOut',
        });

        if (countdown === 0) {
          // After final countdown, hide overlay and activate session
          this.time.delayedCall(500, () => {
            this.sessionCountdownOverlay?.setVisible(false);
            this.gameState.activateSession();
            // Set session start time for autonomous wave delay
            this.waveManager.setSessionStartTime(Date.now());
          });
        }
      },
    });
  }

  /**
   * Create the wave strength meter in bottom-left corner
   * Styled like a tiny pixel art version of the Great Wave off Kanagawa
   */
  private createWaveStrengthMeter(): void {
    const padding = 20;
    const meterWidth = gameBalance.ui.meterWidth;
    const meterHeight = gameBalance.ui.meterHeight;
    const panelWidth = gameBalance.ui.meterPanelWidth;
    const panelHeight = gameBalance.ui.meterPanelHeight;

    const meterX = padding + panelWidth / 2;
    const meterY = this.cameras.main.height - padding - panelHeight / 2;

    this.waveStrengthMeter = this.add.container(meterX, meterY);
    this.waveStrengthMeter.setVisible(false);
    this.waveStrengthMeter.setDepth(1000);

    // Background panel (dark with border)
    const panelBg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x001a33);
    panelBg.setStrokeStyle(1, 0x0066ff);
    this.waveStrengthMeter.add(panelBg);

    // Create gradient background for meter (dark blue to lighter blue)
    const baseColor = 0x003366; // Dark blue
    const lightColor = 0x0055aa; // ~20% lighter blue
    
    // Meter background with gradient effect (simulate with two rectangles)
    const meterBgDark = this.add.rectangle(
      0,
      -meterHeight / 4,
      meterWidth,
      meterHeight / 2,
      baseColor
    );
    const meterBgLight = this.add.rectangle(
      0,
      meterHeight / 4,
      meterWidth,
      meterHeight / 2,
      lightColor
    );
    this.waveStrengthMeter.add(meterBgDark);
    this.waveStrengthMeter.add(meterBgLight);

    // Meter fill (white, will be updated in height)
    const meterFill = this.add.rectangle(
      0,
      0,
      meterWidth - 2,
      0,
      0xffffff
    );
    meterFill.setOrigin(0.5, 0.5);
    meterFill.setName('meter-fill');
    this.waveStrengthMeter.add(meterFill);

    // Add speckled foam effect on top (random white/light blue pixels)
    this.addWaveFoamEffect();

    // Numeric display to the right of meter
    const strengthText = this.add.text(meterWidth / 2 + 15, 0, '70', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0, 0.5);
    strengthText.setName('strength-value');
    this.waveStrengthMeter.add(strengthText);
  }

  /**
   * Add speckled foam effect to wave meter (pixel art foam)
   */
  private addWaveFoamEffect(): void {
    const foamColors = [0xffffff, 0xccddff]; // White and light blue
    const meterWidth = gameBalance.ui.meterWidth;
    const meterHeight = gameBalance.ui.meterHeight;
    const foamDensity = 0.15; // 15% of pixels are foam

    for (let y = -meterHeight / 2; y < meterHeight / 2; y += 2) {
      for (let x = -meterWidth / 2; x < meterWidth / 2; x += 2) {
        if (Math.random() < foamDensity) {
          const foamColor = foamColors[Math.floor(Math.random() * foamColors.length)];
          const foamSpeck = this.add.rectangle(x, y, 2, 2, foamColor);
          foamSpeck.setOrigin(0, 0);
          if (this.waveStrengthMeter) {
            this.waveStrengthMeter.add(foamSpeck);
          }
        }
      }
    }
  }

  /**
   * Update the wave strength meter visual
   */
  private updateWaveStrengthMeter(strength: number): void {
    if (!this.waveStrengthMeter) return;

    const meterFill = this.waveStrengthMeter.getByName('meter-fill') as Phaser.GameObjects.Rectangle;
    const strengthText = this.waveStrengthMeter.getByName('strength-value') as Phaser.GameObjects.Text;

    if (meterFill && strengthText) {
      const meterHeight = gameBalance.ui.meterHeight;
      const fillHeight = (strength / 100) * meterHeight;
      const newY = meterHeight / 2 - (meterHeight - fillHeight) / 2;

      this.tweens.add({
        targets: meterFill,
        height: fillHeight,
        y: newY,
        duration: 200,
        ease: 'Power2.easeOut',
      });

      strengthText.setText(Math.round(strength).toString());
    }
  }

  /**
   * End the session and transition to score report
   */
  private endSession(): void {
    const sessionScore = this.gameState.calculateSessionScore();

    if (this.debugMode) {
      console.log('Session ended with score:', sessionScore);
    }

    // Transition to ScoreReportScene
    this.scene.start('ScoreReportScene', { sessionScore });
  }

  /**
   * Create DOM-based debug panel for wave testing
   */
  private createDebugPanel(): void {
    // Create debug panel container
    const debugPanel = document.createElement('div');
    debugPanel.id = 'wave-debug-panel';
    debugPanel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #00ff00;
      border-radius: 8px;
      padding: 15px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #00ff00;
      z-index: 1000;
      display: none;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Wave Debug';
    title.style.cssText = 'margin: 0 0 10px 0; color: #00ff00; font-size: 16px;';
    debugPanel.appendChild(title);

    // Controls container
    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = 'margin-bottom: 10px; display: flex; flex-direction: column; gap: 6px;';

    // Wave strength override
    const strengthRow = document.createElement('div');
    strengthRow.style.cssText = 'display:flex;align-items:center;gap:4px;';
    const strengthInput = document.createElement('input');
    strengthInput.type = 'number';
    strengthInput.min = '0';
    strengthInput.max = '100';
    strengthInput.placeholder = 'Strength';
    strengthInput.style.cssText = 'flex:1;background:#000;border:1px solid #0f0;color:#0f0;padding:2px 4px;font-size:11px;';
    const applyStrengthBtn = document.createElement('button');
    applyStrengthBtn.textContent = 'APPLY';
    applyStrengthBtn.style.cssText = 'background:#020;border:1px solid #0f0;color:#0f0;font-size:11px;padding:2px 6px;cursor:pointer;';
    applyStrengthBtn.onclick = () => {
      const val = parseFloat(strengthInput.value);
      if (!isNaN(val)) {
        this.waveManager.setWaveStrength(val);
        this.addDebugEvent(`[DEBUG] Override strength=${val}`);
        this.updateDebugStats();
      }
    };
    const clearStrengthBtn = document.createElement('button');
    clearStrengthBtn.textContent = 'CLR';
    clearStrengthBtn.style.cssText = 'background:#200;border:1px solid #f00;color:#f00;font-size:11px;padding:2px 6px;cursor:pointer;';
    clearStrengthBtn.onclick = () => {
      strengthInput.value = '';
    };
    strengthRow.appendChild(strengthInput);
    strengthRow.appendChild(applyStrengthBtn);
    strengthRow.appendChild(clearStrengthBtn);
    controlsDiv.appendChild(strengthRow);

    // Force Sputter + Auto-Recover
    const sputterRow = document.createElement('div');
    sputterRow.style.cssText = 'display:flex;align-items:center;gap:4px;';
    const forceSputterBtn = document.createElement('button');
    forceSputterBtn.textContent = 'Force Sputter';
    forceSputterBtn.style.cssText = 'background:#222;border:1px solid #ff0;color:#ff0;font-size:11px;padding:2px 6px;cursor:pointer;flex:1;';
    const autoRecoverChk = document.createElement('input');
    autoRecoverChk.type = 'checkbox';
    const autoRecoverLbl = document.createElement('label');
    autoRecoverLbl.textContent = 'Auto-Recover';
    autoRecoverLbl.style.cssText = 'font-size:11px;';
    autoRecoverLbl.prepend(autoRecoverChk);
    forceSputterBtn.onclick = () => {
      this.waveManager.setForceSputter(true);
      if (autoRecoverChk.checked) {
        this.waveManager.applyWaveBooster('recovery');
        this.addDebugEvent('[DEBUG] Recovery booster applied');
      }
      this.startWaveWithDisable(forceSputterBtn);
      this.addDebugEvent('[DEBUG] Forced sputter requested');
      this.updateDebugStats();
    };
    sputterRow.appendChild(forceSputterBtn);
    sputterRow.appendChild(autoRecoverLbl);
    controlsDiv.appendChild(sputterRow);

    // Force Death
    const deathRow = document.createElement('div');
    deathRow.style.cssText = 'display:flex;align-items:center;gap:4px;';
    const forceDeathBtn = document.createElement('button');
    forceDeathBtn.textContent = 'Force Death';
    forceDeathBtn.style.cssText = 'background:#400;border:1px solid #f00;color:#f00;font-size:11px;padding:2px 6px;cursor:pointer;flex:1;';
    forceDeathBtn.onclick = () => {
      this.waveManager.setForceDeath(true);
      this.startWaveWithDisable(forceDeathBtn);
      this.addDebugEvent('[DEBUG] Forced death requested');
      this.updateDebugStats();
    };
    deathRow.appendChild(forceDeathBtn);
    controlsDiv.appendChild(deathRow);

    // Booster buttons (momentum, recovery, participation)
    const boosterRow = document.createElement('div');
    boosterRow.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
    const boosterTypes: Array<{ key: 'momentum'|'recovery'|'participation'; label: string; color: string }> = [
      { key: 'momentum', label: 'Momentum +%', color: '#0af' },
      { key: 'recovery', label: 'Recovery +%', color: '#0f8' },
      { key: 'participation', label: 'Participation +%', color: '#fa0' },
    ];
    boosterTypes.forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.style.cssText = `background:#111;border:1px solid ${b.color};color:${b.color};font-size:11px;padding:2px 6px;cursor:pointer;flex:1;`;
      btn.onclick = () => {
        this.waveManager.applyWaveBooster(b.key);
        this.addDebugEvent(`[DEBUG] Booster applied: ${b.key}`);
        this.updateDebugStats();
      };
      boosterRow.appendChild(btn);
    });
    controlsDiv.appendChild(boosterRow);

    debugPanel.appendChild(controlsDiv);

    // Stats / events display
    const statsDiv = document.createElement('div');
    statsDiv.id = 'debug-stats';
    statsDiv.style.cssText = `
      border: 1px solid #00ff00;
      padding: 10px;
      font-size: 11px;
      line-height: 1.6;
      max-height: 400px;
      overflow-y: auto;
    `;
    debugPanel.appendChild(statsDiv);

    // Append to body
    document.body.appendChild(debugPanel);

    // Store reference for keyboard toggle
    let debugPanelVisible = false;

    // Add keyboard key for toggling debug panel
    const dKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    if (dKey) {
      dKey.on('down', () => {
        debugPanelVisible = !debugPanelVisible;
        debugPanel.style.display = debugPanelVisible ? 'block' : 'none';
        console.log('[DEBUG PANEL]', debugPanelVisible ? 'VISIBLE' : 'HIDDEN');
      });
    }

    console.log('[DEBUG PANEL] Created. Press D to toggle. Press S to force sputter.');

    // Clean up on scene shutdown
    this.events.on('shutdown', () => {
      debugPanel.remove();
    });
  }

  /**
   * Update debug panel statistics display
   */
  private updateDebugStats(): void {
    const statsDiv = document.getElementById('debug-stats');
    if (!statsDiv) return;

    const score = this.waveManager.getScore();
    const recentEvents = this.debugEventLog.slice(-8).reverse();
    const eventsHtml = recentEvents.length > 0 
      ? recentEvents.map(e => `<div>${e}</div>`).join('')
      : '<div style="color: #666;">No events yet</div>';

    // Column state grid (only in debug mode)
    let columnGridHtml = '';
    if (this.debugMode && gameBalance.waveClassification.enableColumnGrid) {
      const records = this.waveManager.getColumnStateRecords();
      const grouped: Record<string, Array<{ col: number; state: string; part: number }>> = {};
      records.forEach(r => {
        if (!grouped[r.sectionId]) grouped[r.sectionId] = [];
        grouped[r.sectionId].push({ col: r.columnIndex, state: r.state, part: r.participation });
      });
      columnGridHtml = Object.keys(grouped).map(sectionId => {
        const cols = grouped[sectionId]
          .sort((a,b)=>a.col-b.col)
          .map(c => `<span style='display:inline-block;width:32px;'>${c.col}:${c.state[0].toUpperCase()}(${Math.round(c.part*100)}%)</span>`)
          .join('');
        return `<div><strong>${sectionId}</strong> ${cols}</div>`;
      }).join('');
      if (!columnGridHtml) {
        columnGridHtml = '<div style="color:#333;">No columns yet</div>';
      }
      columnGridHtml = `<div style='margin-top:8px;border-top:1px solid #00ff00;padding-top:6px;'>
        <strong>Column States:</strong>
        <div style='margin-top:4px;'>${columnGridHtml}</div>
      </div>`;
    }

    statsDiv.innerHTML = `
      <div><strong>Score:</strong> ${score}</div>
      <div style="margin-top: 10px; border-top: 1px solid #00ff00; padding-top: 10px;">
        <strong>Recent Events:</strong>
        <div style="margin-top: 5px;">
          ${eventsHtml}
        </div>
      </div>
      ${columnGridHtml}
    `;
  }

  /** Helper to start wave from debug control and disable source button briefly */
  private startWaveWithDisable(btn: HTMLButtonElement): void {
    if (btn.disabled) return;
    btn.disabled = true;
    this.waveManager.startWave();
    this.time.delayedCall(1500, () => { btn.disabled = false; });
  }

  /**
   * Add event to debug log
   */
  private addDebugEvent(message: string): void {
    this.debugEventLog.push(message);
    // Keep only last 20 events
    if (this.debugEventLog.length > 20) {
      this.debugEventLog.shift();
    }
    // Mirror to console for scrollable history
    if (this.debugMode) {
      // Unified prefix for easier grep
      console.log(`[DBG] ${message}`);
    }
  }
}

