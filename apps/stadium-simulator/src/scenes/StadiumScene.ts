import Phaser from 'phaser';
import { LoggerService } from '@/services/LoggerService';
import { GameStateManager, GameMode } from '@/managers/GameStateManager';
import { GameStateManagerWrapper } from '@/managers/wrappers/GameStateManagerWrapper';
import { WaveManager } from '@/managers/WaveManager'; // legacy direct (will be wrapped)
import { WaveManagerWrapper } from '@/managers/wrappers/WaveManagerWrapper';
import { VendorManager } from '@/managers/VendorManager';
import { VendorManagerWrapper } from '@/managers/wrappers/VendorManagerWrapper';
import { StadiumSection } from '@/sprites/StadiumSection';
import { Vendor } from '@/sprites/Vendor';
import { AnnouncerService } from '@/managers/AnnouncerService';
import { AnnouncerServiceWrapper } from '@/managers/wrappers/AnnouncerServiceWrapper';
import { SceneLogger } from '@/managers/SceneLogger';
import { SectionConfig } from '@/types/GameTypes';
import { SeatManager } from '@/managers/SeatManager';
import { SeatManagerWrapper } from '@/managers/wrappers/SeatManagerWrapper';
import { gameBalance } from '@/config/gameBalance';
import { ActorRegistry } from '@/actors/ActorRegistry';
import { ActorFactory } from '@/actors/ActorFactory';
import { SectionActor } from '@/actors/adapters/SectionActor';
import { FanActor } from '@/actors/adapters/FanActor';
import { GridManager } from '@/managers/GridManager';

/**
 * StadiumScene renders the visual state of the stadium simulator
 * Orchestrates GameStateManager, WaveManager, VendorManager, and StadiumSection objects
 */
export class StadiumScene extends Phaser.Scene {
  private rawGameState: GameStateManager;
  private gameState: GameStateManagerWrapper; // wrapped
  private waveManager!: WaveManagerWrapper; // wrapped wave manager for logging
  private vendorManager!: VendorManagerWrapper; // wrapper exposes unified logging
  private rawSeatManager!: SeatManager;
  private seatManager!: SeatManagerWrapper; // wrapped
  private announcer!: AnnouncerServiceWrapper;
  private gridManager?: GridManager;
  private sectionAText?: Phaser.GameObjects.Text;
  private sectionBText?: Phaser.GameObjects.Text;
  private sectionCText?: Phaser.GameObjects.Text;
  private sectionLabels: Phaser.GameObjects.Text[] = [];
  private scoreText?: Phaser.GameObjects.Text;
  private countdownText?: Phaser.GameObjects.Text;
  private sessionTimerText?: Phaser.GameObjects.Text;
  private sections: StadiumSection[] = [];
  private vendorSprites: Map<number, Vendor> = new Map(); // Track vendor visual sprites
  private demoMode: boolean = false;
  private debugMode: boolean = false;
  private successStreak: number = 0;
  private gameMode: GameMode = 'eternal';
  private sessionCountdownOverlay?: Phaser.GameObjects.Container;
  private waveStrengthMeter?: Phaser.GameObjects.Container;
  private forceSputterNextSection: boolean = false;
  private hasLoggedUpdate: boolean = false;
  private sceneLogger: SceneLogger;
  private actorRegistry: ActorRegistry;

  constructor() {
    super({ key: 'StadiumScene' });
    this.rawGameState = new GameStateManager();
    this.gameState = new GameStateManagerWrapper(this.rawGameState);
    this.sceneLogger = new SceneLogger();
    this.actorRegistry = new ActorRegistry();
  }

  init(data: any): void {
    // Get game mode and debug mode from scene data
    this.gameMode = data?.gameMode || 'eternal';
    this.debugMode = data?.debugMode || false;
    this.gridManager = data?.gridManager;

    if (this.debugMode) {
      console.log('StadiumScene initialized with mode:', this.gameMode);
      console.log('GridManager received:', this.gridManager ? 'YES' : 'NO');
    }
  }

  create(): void {
    // Initialize GameStateManager (wrapped) with the selected mode
    this.gameState.startSession(this.gameMode);

    // Initialize VendorManager (inner) then wrap
    const rawVendorManager = new VendorManager(this.rawGameState, 2, this.gridManager);
    this.vendorManager = new VendorManagerWrapper(rawVendorManager);

    // Initialize SeatManager
    this.rawSeatManager = new SeatManager(this, this.gridManager);
    this.seatManager = new SeatManagerWrapper(this.rawSeatManager);

    // Section config defaults (width snapped to grid so seats align with columns)
    const seatsPerRow = 8;
    const { cellSize } = this.gridManager ? this.gridManager.getWorldSize() : { cellSize: 32 } as any;
    const sectionWidthSnapped = seatsPerRow * cellSize;
    const sectionConfig: SectionConfig = {
      width: sectionWidthSnapped,
      height: 200,
      rowCount: 4,
      seatsPerRow,
      rowBaseHeightPercent: 0.15,
      startLightness: 62,
      autoPopulate: true,
    };

    // Dynamic single-row section layout centered on screen, aligned to grid
    const gsSections = this.rawGameState.getSections();
    const sectionIdsDyn = gsSections.map(s => s.id);
    const gapCells = 2; // configurable gap (cells) between sections
    const sectionGapPx = cellSize * gapCells;
    const n = sectionIdsDyn.length;
    const totalRowWidth = n * sectionConfig.width + Math.max(0, n - 1) * sectionGapPx;
    // Compute left edge for first section, then snap to nearest grid boundary to eliminate outer gutters
    const desiredLeftEdge = this.cameras.main.centerX - totalRowWidth / 2;
    const origin = this.gridManager ? this.gridManager.getOrigin() : { x: 0, y: 0 };
    const snappedLeftEdge = origin.x + Math.round((desiredLeftEdge - origin.x) / cellSize) * cellSize;
    const startX = Math.round(snappedLeftEdge + sectionConfig.width / 2);

    // Compute ground-aligned Y so the bottom row's floor sits on a grid cell per groundLine
    const rowCountCfg = sectionConfig.rowCount ?? 4;
    const bottomRowHeight = Math.floor(sectionConfig.height / rowCountCfg);
    const floorOffsetFromCenter = sectionConfig.height / 2 - bottomRowHeight * 0.15; // see SectionRow.getFloorY
    let groundY = 300; // fallback
    if (this.gridManager) {
      const rows = this.gridManager.getRowCount();
      const groundRowsFromBottom = gameBalance.grid.groundLine?.rowsFromBottom ?? 0;
      const groundRowIndex = Math.max(0, rows - 1 - groundRowsFromBottom);
      groundY = this.gridManager.gridToWorld(groundRowIndex, 0).y;
    }
    const sectionCenterY = Math.round(groundY - floorOffsetFromCenter);

    // Instantiate sections dynamically
    this.sections = sectionIdsDyn.map((id, i) => {
      const x = startX + i * (sectionConfig.width + sectionGapPx);
      return new StadiumSection(this, x, sectionCenterY, sectionConfig, id);
    });

    // Register sections as actors
    const sectionIds = sectionIdsDyn;
    this.sections.forEach((section, idx) => {
      const sectionId = sectionIds[idx];
      const actorId = ActorFactory.generateId('section', sectionId);
      const sectionActor = new SectionActor(actorId, section, sectionId, 'section', false);
      this.actorRegistry.register(sectionActor);
    });

    // Initialize SeatManager with sections
    this.seatManager.initializeSections(this.sections);
    if (sectionConfig.autoPopulate) {
      this.seatManager.populateAllSeats();
    }

    // Initialize VendorManager (wrapper delegates) with sections for pathfinding
    this.vendorManager.initializeSections(this.sections);

    // Listen to vendor events BEFORE spawning (important!)
    this.setupVendorEventListeners();

    // Spawn initial vendors (2 good-quality drink vendors by default)
    this.vendorManager.spawnInitialVendors();

    // Initialize WaveManager via wrapper for unified logging
    this.waveManager = new WaveManagerWrapper(this.rawGameState, rawVendorManager, this.rawSeatManager, this.gridManager);
    this.waveManager.setScene(this); // Set scene reference for WaveSprite spawning
    this.successStreak = 0;

    this.announcer = new AnnouncerServiceWrapper(new AnnouncerService());
    this.announcer.getCommentary(JSON.stringify({ event: 'waveStart' }))
      .then(result => console.log('[AnnouncerServiceWrapper test] result:', result))
      .catch(err => console.error('[AnnouncerServiceWrapper test] error', err));

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

    // Section labels – anchored to section positions so they follow layout
    const labelNames = ['Section A', 'Section B', 'Section C'];
    this.sectionLabels = [];
    for (let i = 0; i < this.sections.length && i < 3; i++) {
      const sec = this.sections[i];
      const labelY = sec.y - sectionConfig.height / 2 - 16;
      const label = this.add.text(sec.x, labelY, labelNames[i], {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#ffffff',
      }).setOrigin(0.5, 0.5);
      this.sectionLabels.push(label);
    }

    // Section stat overlays – positioned just below each section
    const statsOffset = gameBalance.waveAutonomous.sectionStatOffsetY;
    const makeStatsText = (x: number, y: number) => this.add.text(x, y, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0);
    if (this.sections[0]) {
      const y = this.sections[0].y + sectionConfig.height / 2 + statsOffset;
      this.sectionAText = makeStatsText(this.sections[0].x, y);
    }
    if (this.sections[1]) {
      const y = this.sections[1].y + sectionConfig.height / 2 + statsOffset;
      this.sectionBText = makeStatsText(this.sections[1].x, y);
    }
    if (this.sections[2]) {
      const y = this.sections[2].y + sectionConfig.height / 2 + statsOffset;
      this.sectionCText = makeStatsText(this.sections[2].x, y);
    }

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
        this.waveManager.setForceSputter(true);
        // Ensure a Wave instance exists so the WaveSprite can spawn
        const origin = this.pickOriginSectionId();
        this.waveManager.createWave(origin);
        if (waveBtn) {
          waveBtn.disabled = true;
          waveBtn.textContent = 'WAVE IN PROGRESS...';
        }
        console.log(`[DEBUG] Force Sputter initiated - will degrade strength (origin ${origin})`);
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
      // Note: WaveSprite now spawns when countdown reaches zero, not here
    });

    // Listen to wave strength changes
    this.waveManager.on('waveStrengthChanged', (data: { strength: number }) => {
      this.updateWaveStrengthMeter(data.strength);
    });

    // Grid-column-based wave participation (triggered as wave moves through grid)
    this.waveManager.on('columnWaveReached', (data: { sectionId: string; gridCol: number; worldX: number; seatIds: string[]; seatCount: number }) => {
      const sectionIndex = this.getSectionIndex(data.sectionId);
      const section = this.sections[sectionIndex];
      if (data.seatIds.length === 0) return;
      const firstSeatId = data.seatIds[0];
      const parts = firstSeatId.split('-');
      if (parts.length < 4) return;
      const columnIndex = parseInt(parts[3], 10);
      if (isNaN(columnIndex)) return;

      // Use waveStrength and visualState from event payload
      const waveStrength = data.waveStrength ?? this.waveManager.getCurrentWaveStrength();
      const visualState = data.visualState ?? 'full';
      const participationMultiplier = 1; // TODO: Apply boosters if needed
      // Calculate participation for this specific column
      const fanStates = section.calculateColumnParticipation(columnIndex, waveStrength * participationMultiplier);
      if (fanStates.length === 0) return;
      let columnParticipating = 0;
      for (const st of fanStates) {
        if (st.willParticipate) {
          columnParticipating++;
        }
      }
      const columnRate = fanStates.length > 0 ? columnParticipating / fanStates.length : 0;
      const columnState = this.waveManager.classifyColumn(columnRate);
      // Record column state for analytics
      this.waveManager.recordColumnState(data.sectionId, columnIndex, columnRate, columnState);
      this.waveManager.pushColumnParticipation(columnRate);
      // Trigger animation for this column immediately (no await - fire and forget)
      section.playColumnAnimation(columnIndex, fanStates, visualState, waveStrength);
      // Log every few columns to reduce spam
      if (this.waveManager['currentGridColumnIndex'] % 5 === 0) {
        console.log(`[Column Wave] Section ${data.sectionId} col ${columnIndex}: ${columnState} (${Math.round(columnRate*100)}%)`);
      }
    });

    // Legacy section-wide wave event (kept for compatibility, but may be deprecated)
    // Only use this to reset per-section fan state; actual animations happen per column
    this.waveManager.on('sectionWave', async (data: { section: string; strength: number; direction: 'left' | 'right' }) => {
      const sectionIndex = this.getSectionIndex(data.section);
      const section = this.sections[sectionIndex];
      section.resetFanWaveState();
      // Column-driven flow handles participation and animations; nothing else here
      return;
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
    
    // Update vendor visual positions
    this.updateVendorPositions();

    // Tick wave sprite movement and events (sprite-driven propagation)
    this.waveManager.update(delta);

    // Check for autonomous wave triggering (only when session is active)
    if (gameBalance.waveAutonomous.enabled && 
        !this.waveManager.isActive() && 
        this.gameState.getSessionState() === 'active') {
      const triggerSection = this.waveManager.checkWaveProbability();
      if (triggerSection) {
        const wave = this.waveManager.createWave(triggerSection);
        this.showIncomingCue(triggerSection);
        this.sceneLogger.log('debug', `[Wave] Autonomous start section ${triggerSection} waveId=${wave.id}`);
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

    // Keep labels and stats anchored to sections (in case layout shifts)
    if (this.sections.length) {
      const cfgHeight = 200; // matches sectionConfig.height
      const statsOffset = gameBalance.waveAutonomous.sectionStatOffsetY;
      for (let i = 0; i < this.sections.length && i < this.sectionLabels.length; i++) {
        const sec = this.sections[i];
        const label = this.sectionLabels[i];
        label.setPosition(sec.x, sec.y - cfgHeight / 2 - 16);
      }
      if (this.sections[0] && this.sectionAText) {
        this.sectionAText.setPosition(this.sections[0].x, this.sections[0].y + cfgHeight / 2 + statsOffset);
      }
      if (this.sections[1] && this.sectionBText) {
        this.sectionBText.setPosition(this.sections[1].x, this.sections[1].y + cfgHeight / 2 + statsOffset);
      }
      if (this.sections[2] && this.sectionCText) {
        this.sectionCText.setPosition(this.sections[2].x, this.sections[2].y + cfgHeight / 2 + statsOffset);
      }
    }

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
    bg.setOrigin(0, 0)
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

    // Clean up actor registry
    this.actorRegistry.clear();

    // Transition to ScoreReportScene
    this.scene.start('ScoreReportScene', { sessionScore });
  }

  /**
   * Get public access to actor registry (for UI/debugger)
   */
  public getActorRegistry(): ActorRegistry {
    return this.actorRegistry;
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
        this.sceneLogger.log('debug', `[DEBUG] Override strength=${val}`);
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
        this.sceneLogger.log('debug', '[DEBUG] Recovery booster applied');
      }
      this.startWaveWithDisable(forceSputterBtn);
      this.sceneLogger.log('debug', '[DEBUG] Forced sputter requested');
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
      // Ensure a Wave instance exists so the WaveSprite can spawn
      const origin = this.pickOriginSectionId();
      this.waveManager.createWave(origin);
      // Briefly disable button to prevent rapid repeat
      forceDeathBtn.disabled = true;
      this.time.delayedCall(1500, () => { forceDeathBtn.disabled = false; });
      this.sceneLogger.log('debug', `[DEBUG] Forced death requested (origin ${origin})`);
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
        this.sceneLogger.log('debug', `[DEBUG] Booster applied: ${b.key}`);
        this.updateDebugStats();
      };
      boosterRow.appendChild(btn);
    });
    controlsDiv.appendChild(boosterRow);

    // Dynamic logging controls (panel + console)
    const categories = ['scene:stadium','manager:wave','manager:vendor','manager:gameState','manager:seat','service:announcer','actor:vendor','actor:fan','actor:mascot'];
    const loggingContainer = document.createElement('div');
    loggingContainer.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-top:8px;padding-top:8px;border-top:1px solid #00ff00;';
    const header = document.createElement('div');
    header.textContent = 'Logging Controls';
    header.style.cssText = 'font-weight:bold;color:#0ff;font-size:12px;';
    loggingContainer.appendChild(header);

    const logger = LoggerService.instance();
    logger.setConsoleEnabled(false); // default off
    categories.forEach(cat => {
      // default flags false
      logger.setPanelCategory(cat, false);
      logger.setConsoleCategory(cat, false);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;';
      const label = document.createElement('span');
      label.textContent = cat.replace(/^(manager:|service:)/,'');
      label.style.cssText = 'width:90px;color:#ccc;';
      const panelChk = document.createElement('input');
      panelChk.type = 'checkbox';
      panelChk.onchange = () => {
        logger.setPanelCategory(cat, panelChk.checked);
        this.sceneLogger.log('debug', `[LOG PANEL] ${cat} => ${panelChk.checked?'on':'off'}`);
        this.updateDebugStats();
      };
      const panelLbl = document.createElement('label');
      panelLbl.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:4px;';
      panelLbl.appendChild(panelChk);
      panelLbl.appendChild(document.createTextNode('Panel'));
      const consoleChk = document.createElement('input');
      consoleChk.type = 'checkbox';
      consoleChk.onchange = () => {
        logger.setConsoleCategory(cat, consoleChk.checked);
        // if any console checkbox toggled on, enable global console
        const anyOn = categories.some(c => logger.getConsoleCategories()[c]);
        logger.setConsoleEnabled(anyOn);
        this.sceneLogger.log('debug', `[LOG CONSOLE] ${cat} => ${consoleChk.checked?'on':'off'}`);
      };
      const consoleLbl = document.createElement('label');
      consoleLbl.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:4px;';
      consoleLbl.appendChild(consoleChk);
      consoleLbl.appendChild(document.createTextNode('Console'));
      row.appendChild(label);
      row.appendChild(panelLbl);
      row.appendChild(consoleLbl);
      loggingContainer.appendChild(row);
    });
    controlsDiv.appendChild(loggingContainer);

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

    // Add keyboard key for toggling wave sprite visibility (W key)
    const wKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    if (wKey) {
      wKey.on('down', () => {
        const newValue = !gameBalance.waveSprite.visible;
        gameBalance.waveSprite.visible = newValue;
        console.log('[WAVE SPRITE]', newValue ? 'VISIBLE' : 'HIDDEN');
      });
    }

    console.log('[DEBUG PANEL] Created. Press D to toggle. Press S to force sputter. Press W to toggle wave sprite.');

    // Clean up on scene shutdown
    this.events.on('shutdown', () => {
      debugPanel.remove();
    });
  }

  /**
   * Update debug panel statistics display (displays curated scene logs from SceneLogger + filtered manager logs)
   */
  private updateDebugStats(): void {
    const statsDiv = document.getElementById('debug-stats');
    if (!statsDiv) return;

    const score = this.waveManager.getScore();
    
    // Show last 8 scene:stadium logs as "Recent Events" 
    const logger = LoggerService.instance();
    const allLogs = logger.getBuffer();
    const sceneEvents = allLogs.filter(l => l.category === 'scene:stadium').slice(-8).reverse();
    const eventsHtml = sceneEvents.length > 0 
      ? sceneEvents.map((e: any) => `<div>${e.message}</div>`).join('')
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

    // Recent log events (global logger buffer) filtered by panel category toggles
    const panelCategories = logger.getPanelCategories ? logger.getPanelCategories() : {} as Record<string, boolean>;
    const filteredLogs = allLogs.filter(l => {
      if (Object.prototype.hasOwnProperty.call(panelCategories, l.category)) {
        return !!panelCategories[l.category];
      }
      return true; // show uncategorized logs
    });
    const rawLogs = filteredLogs.slice(-30).reverse();
    const levelColors: Record<string,string> = {
      trace: '#888',
      debug: '#0af',
      info: '#0f0',
      event: '#0ff',
      warn: '#ff0',
      error: '#f00'
    };
    const logsHtml = rawLogs.map(l => {
      const color = levelColors[l.level] || '#ccc';
      const ts = new Date(l.ts).toLocaleTimeString(undefined,{hour12:false});
      return `<div style='white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>`+
        `<span style='color:${color};'>[${l.level.toUpperCase()}]</span> `+
        `<span style='color:#666;'>${ts}</span> `+
        `<span style='color:#0ff;'>${l.category}</span> `+
        `${l.message}`+
        `</div>`;
    }).join('');
    const logsSection = `<div style='margin-top:8px;border-top:1px solid #044;padding-top:6px;'>`
      + `<strong style='color:#0ff;'>Recent Logs (${rawLogs.length}/${filteredLogs.length} shown):</strong>`
      + `<div style='margin-top:4px;max-height:160px;overflow-y:auto;'>${logsHtml || '<div style="color:#333;">No logs yet</div>'}</div>`
      + `</div>`;

    statsDiv.innerHTML = `
      <div><strong>Score:</strong> ${score}</div>
      <div style="margin-top: 10px; border-top: 1px solid #00ff00; padding-top: 10px;">
        <strong>Recent Events:</strong>
        <div style="margin-top: 5px;">
          ${eventsHtml}
        </div>
      </div>
      ${columnGridHtml}
      ${logsSection}
    `;
  }

  /** Helper to start wave from debug control and disable source button briefly */
  private startWaveWithDisable(btn: HTMLButtonElement): void {
    if (btn.disabled) return;
    btn.disabled = true;
    // Create a wave from the best origin so WaveSprite will spawn
    const origin = this.pickOriginSectionId();
    this.waveManager.createWave(origin);
    this.time.delayedCall(1500, () => { btn.disabled = false; });
  }

  /** Pick an origin section for debug starts (highest happiness, fallback 'A') */
  private pickOriginSectionId(): string {
    const sections = this.gameState.getSections();
    if (!sections || sections.length === 0) return 'A';
    let best = sections[0];
    for (let i = 1; i < sections.length; i++) {
      if (sections[i].happiness > best.happiness) best = sections[i];
    }
    return best.id;
  }

  /**
   * Setup vendor event listeners
   */
  private setupVendorEventListeners(): void {
    // Listen for vendor spawned events to create visual sprites
    this.vendorManager.on('vendorSpawned', (data: { vendorId: number; profile: any }) => {
      this.sceneLogger.log('debug', `[Vendor] Spawned vendor ${data.vendorId}`);
      const { vendorId, profile } = data;
      
      // Position vendors spread out near sections (equidistant from center)
      const vendorCount = this.vendorSprites.size;
      const spacing = 250; // pixels between vendors
      const startX = this.cameras.main.centerX - (spacing / 2) + (vendorCount * spacing);
      const startY = 550; // front corridor area
      
      // Create vendor visual sprite
      const vendorSprite = new Vendor(this, startX, startY);
      vendorSprite.setDepth(1000); // Render above fans
      this.sceneLogger.log('debug', `[Vendor] Sprite created at (${startX}, ${startY})`);
      
      // Store reference
      this.vendorSprites.set(vendorId, vendorSprite);
      this.sceneLogger.log('debug', `[Vendor] Total sprites: ${this.vendorSprites.size}`);
      
      // Add sprite to scene
      this.add.existing(vendorSprite);
      
      // Update vendor instance position in manager
      const instance = this.vendorManager.getVendorInstance(vendorId);
      if (instance) {
        instance.position.x = startX;
        instance.position.y = startY;
      }
      
      this.sceneLogger.log('debug', `[Vendor] Profile type=${profile.type} quality=${profile.qualityTier}`);

      // Rebuild vendor controls dynamically
      this.rebuildVendorControls();
    });

    // Listen for vendor state changes to update visuals
    this.vendorManager.on('vendorReachedTarget', (data: { vendorId: number; position: any }) => {
      this.sceneLogger.log('debug', `[Vendor] Vendor ${data.vendorId} reached target`);
    });

    this.vendorManager.on('serviceComplete', (data: { vendorId: number; fanServed?: boolean }) => {
      const sprite = this.vendorSprites.get(data.vendorId);
      if (sprite) {
        sprite.setMovementState('cooldown');
      }
      this.sceneLogger.log('debug', `[Vendor] Vendor ${data.vendorId} completed service`);
    });

    this.vendorManager.on('vendorDistracted', (data: { vendorId: number }) => {
      const sprite = this.vendorSprites.get(data.vendorId);
      if (sprite) {
        sprite.setMovementState('distracted');
      }
      this.sceneLogger.log('debug', `[Vendor] Vendor ${data.vendorId} got distracted!`);
    });

    // Vendor section assignment
    this.vendorManager.on('vendorSectionAssigned', (data: { vendorId: number; sectionIdx: number }) => {
      this.sceneLogger.log('debug', `[Vendor] Vendor ${data.vendorId} assigned to section ${['A','B','C'][data.sectionIdx]}`);
      // Update UI highlight
      this.rebuildVendorControls();
    });

    // Scan attempt events
    this.vendorManager.on('vendorScanAttempt', (data: { vendorId: number; assignedSectionIdx?: number }) => {
      const sec = data.assignedSectionIdx !== undefined ? ['A','B','C'][data.assignedSectionIdx] : 'ALL';
      this.sceneLogger.log('debug', `[Vendor] Vendor ${data.vendorId} scanning (scope=${sec})`);
    });
    this.vendorManager.on('vendorTargetSelected', (data: { vendorId: number; sectionIdx: number; rowIdx: number; colIdx: number }) => {
      this.sceneLogger.log('debug', `[Vendor] Vendor ${data.vendorId} target selected S=${['A','B','C'][data.sectionIdx]} R=${data.rowIdx} C=${data.colIdx}`);
    });
    this.vendorManager.on('vendorNoTarget', (data: { vendorId: number; assignedSectionIdx?: number }) => {
      const sec = data.assignedSectionIdx !== undefined ? ['A','B','C'][data.assignedSectionIdx] : 'ALL';
      this.sceneLogger.log('debug', `[Vendor] Vendor ${data.vendorId} no target found (scope=${sec})`);
    });
  }

  /**
   * Update vendor visual positions based on manager state
   */
  private updateVendorPositions(): void {
    for (const [vendorId, sprite] of this.vendorSprites) {
      const instance = this.vendorManager.getVendorInstance(vendorId);
      if (!instance) continue;

      // Update sprite position to match instance position
      sprite.setPosition(instance.position.x, instance.position.y);

      // Update sprite state to match vendor state
      sprite.setMovementState(instance.state);
    }
  }

  /**
   * Dynamically rebuild vendor assignment controls based on active vendors
   */
  private rebuildVendorControls(): void {
    const controlsRoot = document.getElementById('controls');
    if (!controlsRoot) return;
    // Clear previous dynamic vendor controls (keep wave button if present)
    // Remove all children then recreate
    controlsRoot.innerHTML = '';
    // Optionally re-add wave button if it existed
    const waveBtn = document.createElement('button');
    waveBtn.id = 'wave-btn';
    waveBtn.textContent = 'START WAVE';
    waveBtn.style.display = 'none';
    controlsRoot.appendChild(waveBtn);

    const vendorInstances = Array.from(this.vendorManager.getVendorInstances().entries());
    vendorInstances.forEach(([vendorId, instance], idx) => {
      const row = document.createElement('div');
      row.className = 'vendor-controls';
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;';
      const label = document.createElement('span');
      label.className = 'vendor-label';
      label.textContent = `Vendor ${vendorId}:`;
      label.style.cssText = 'font-size:12px;color:#ccc;';
      row.appendChild(label);

      // Determine serviceable sections (drink => all sections; later types may differ)
      const serviceableSectionIndices: number[] = [0,1,2];
      serviceableSectionIndices.forEach(sIdx => {
        const btn = document.createElement('button');
        btn.className = 'vendor-btn';
        btn.textContent = `Section ${['A','B','C'][sIdx]}`;
        btn.style.cssText = 'background:#111;border:1px solid #555;color:#eee;font-size:11px;padding:2px 6px;cursor:pointer;';
        if (instance.assignedSectionIdx === sIdx) {
          btn.style.border = '1px solid #0ff';
          btn.style.background = '#033';
        }
        btn.onclick = () => {
          this.vendorManager.assignVendorToSection(vendorId, sIdx);
        };
        row.appendChild(btn);
      });

      controlsRoot.appendChild(row);
    });
  }
}

