import Phaser from 'phaser';
import { GameStateManager } from '@/managers/GameStateManager';
import { WaveManager } from '@/managers/WaveManager';
import { AIManager } from '@/managers/AIManager';
import { StadiumSection } from '@/sprites/StadiumSection';
import { Vendor } from '@/sprites/Vendor';
import { Mascot } from '@/sprites/Mascot';
import { VendorState } from '@/managers/interfaces';
import { AnnouncerService } from '@/managers/AnnouncerService';

import { gameBalance } from '@/config/gameBalance';
import { ActorRegistry } from '@/actors/ActorRegistry';
import { ActorFactory } from '@/actors/ActorFactory';
import { SectionActor } from '@/actors/adapters/SectionActor';
import { StairsActor } from '@/actors/adapters/StairsActor';
import { GroundActor } from '@/actors/adapters/GroundActor';
import { SkyboxActor } from '@/actors/adapters/SkyboxActor';
import { FanActor } from '@/actors/adapters/FanActor';
import { GridManager } from '@/managers/GridManager';
import { LevelService } from '@/services/LevelService';
import { GridOverlay } from '@/scenes/GridOverlay';
import { TargetingIndicator } from '@/components/TargetingIndicator';

/**
 * StadiumScene renders the visual state of the stadium simulator
 * Orchestrates GameStateManager, WaveManager, AIManager, and Actor system
 */
export class StadiumScene extends Phaser.Scene {
  private gameState: GameStateManager;
  private waveManager!: WaveManager;
  private aiManager!: AIManager;
  private announcer!: AnnouncerService;
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
  private mascots: Mascot[] = []; // Track mascot sprites
  private mascotSectionMap: Map<string, Mascot> = new Map(); // Track which mascot is in which section
  private autoRotationMode: boolean = false; // Auto-rotation mode for mascots
  private mascotKeys: Phaser.Input.Keyboard.Key[] = []; // Track keyboard keys for cleanup
  private demoMode: boolean = false;
  private debugMode: boolean = false;
  private successStreak: number = 0;
  private sessionCountdownOverlay?: Phaser.GameObjects.Container;
  private waveStrengthMeter?: Phaser.GameObjects.Container;
  private forceSputterNextSection: boolean = false;
  private hasLoggedUpdate: boolean = false;
  private actorRegistry: ActorRegistry;
  private levelData?: any; // Store level data for section ID lookups
  private skyboxActor?: any;
  private groundActor?: any;
  private gridOverlay?: GridOverlay;
  public targetingIndicator!: TargetingIndicator;

  constructor() {
    super({ key: 'StadiumScene' });
    this.gameState = new GameStateManager();
    this.actorRegistry = new ActorRegistry();
  }

  init(data: any): void {
    // Get debug mode from scene data
    this.debugMode = data?.debugMode || false;
    this.gridManager = data?.gridManager;

    if (this.debugMode) {
      console.log('StadiumScene initialized in run mode');
      console.log('GridManager received:', this.gridManager ? 'YES' : 'NO');
    }
  }

  async create(): Promise<void> {

    // Load level data (sections, seats, fans, vendors)
    const levelData = await LevelService.loadLevel();
    this.levelData = levelData; // Cache for later use
    console.log('[StadiumScene] Level data loaded:', levelData);

    // Attach actorRegistry to the scene instance for WaveManager access
    (this as any).actorRegistry = this.actorRegistry;

    // Create visual environment (ground and skybox) before sections
    const canvasWidth = this.cameras.main.width;
    const canvasHeight = this.cameras.main.height;

    const gridHeight = gameBalance.grid.cellSize * gameBalance.grid.groundLine.rowsFromBottom;
    const groundLineY = canvasHeight - gridHeight;

    // const groundLineY = gameBalance.grid.groundLine.enabled ? gameBalance.grid.groundLine.rowsFromBottom * canvasHeight : canvasHeight * 0.6; // Ground starts at 60% down the canvas
    
    canvasHeight * 0.6; // Ground starts at 60% down the canvas

    // Create skybox
    const skyboxActor = new SkyboxActor({
      id: ActorFactory.generateId('skybox', 'main'),
      scene: this,
      groundLineY,
      width: canvasWidth,
      topColor: gameBalance.visual.skyTopColor,
      bottomColor: gameBalance.visual.skyBottomColor
    });
    this.actorRegistry.register(skyboxActor);
    this.skyboxActor = skyboxActor;

    // Create ground
    const groundHeight = canvasHeight - groundLineY;
    const groundActor = new GroundActor({
      id: ActorFactory.generateId('ground', 'main'),
      scene: this,
      groundLineY,
      width: canvasWidth,
      height: groundHeight,
      color: gameBalance.visual.groundColor
    });
    this.actorRegistry.register(groundActor);
    this.groundActor = groundActor;

    // Initialize GameStateManager with level sections
    this.gameState.initializeSections(levelData.sections);
    this.gameState.startSession();

    // Initialize AIManager
    this.aiManager = new AIManager(this.gameState, 2, this.gridManager, this.actorRegistry);

    // Create SectionActors from level data (Actor-first, data-driven!)
    const sectionActors: SectionActor[] = [];
    levelData.sections.forEach((sectionData) => {
      const actorId = ActorFactory.generateId('section', sectionData.id);
      const sectionActor = new SectionActor(
        actorId,
        this,
        sectionData,
        this.gridManager,
        'section',
        false
      );
      sectionActor.populateFromData(sectionData.fans);
      this.actorRegistry.register(sectionActor);
      sectionActors.push(sectionActor);
      this.sections.push(sectionActor.getSection());
    });

    // Create StairsActors from level data
    if (levelData.stairs && this.gridManager) {
      levelData.stairs.forEach((stairData) => {
        const actorId = ActorFactory.generateId('stairs', stairData.id);
        // Calculate world bounds from grid bounds
        const topLeft = this.gridManager!.gridToWorld(stairData.gridTop, stairData.gridLeft);
        const bottomRight = this.gridManager!.gridToWorld(
          stairData.gridTop + stairData.height - 1,
          stairData.gridLeft + stairData.width - 1
        );
        const cellSize = this.gridManager!.getWorldSize().cellSize;
        const worldBounds = {
          x: (topLeft.x + bottomRight.x) / 2,
          y: (topLeft.y + bottomRight.y) / 2,
          width: stairData.width * cellSize,
          height: stairData.height * cellSize
        };
        
        const stairsActor = new StairsActor({
          id: actorId,
          gridBounds: {
            left: stairData.gridLeft,
            top: stairData.gridTop,
            width: stairData.width,
            height: stairData.height
          },
          connectsSections: stairData.connectsSections,
          worldBounds,
          scene: this
        });
        
        this.actorRegistry.register(stairsActor);
        
        // Mark stair cells as passable in grid (Phase 2.2 - Option A)
        // Stairs are passable for pathfinding (don't mark as occupied)
        // GridManager.addOccupant marks cells as occupied, so we skip that for stairs
      });
    }

    // Initialize AIManager with sections for pathfinding
    this.aiManager.initializeSections(this.sections);

    // Listen to vendor events BEFORE spawning (important!)
    this.setupVendorEventListeners();

    // Spawn vendors at positions from level data
    if (levelData.vendors && this.gridManager) {
      levelData.vendors.forEach((vendorData, idx) => {
        const profile = this.aiManager.createVendor(vendorData.type as any, 'good');
        const worldPos = this.gridManager!.gridToWorld(vendorData.gridRow, vendorData.gridCol);
        console.log(`[Vendor Init] Vendor ${profile.id} at grid (${vendorData.gridRow}, ${vendorData.gridCol}) -> world (${worldPos.x}, ${worldPos.y})`);
        
        const instance = {
          profile,
          state: 'idle' as VendorState,
          position: { x: worldPos.x, y: worldPos.y },
          currentSegmentIndex: 0,
          scanTimer: 0,
          stateTimer: 0,
          distractionCheckTimer: 0,
          attentionAuraActive: false,
          lastServiceTime: 0,
        };
        this.aiManager.getVendorInstances().set(profile.id, instance);
        
        // Directly create vendor sprite for initialization (no need for event)
        const vendorSprite = new Vendor(this, worldPos.x, worldPos.y);
        vendorSprite.setDepth(1000); // Render above fans
        this.add.existing(vendorSprite);
        this.vendorSprites.set(profile.id, vendorSprite);
        console.log(`[Vendor Init] Created sprite for vendor ${profile.id}, total sprites: ${this.vendorSprites.size}`);
      });
      
      // Rebuild vendor controls to show buttons immediately
      this.rebuildVendorControls();
    }

    // Initialize WaveManager (no longer needs SeatManager)
    this.waveManager = new WaveManager(this.gameState, this.aiManager, this.gridManager, this.actorRegistry);
    this.waveManager.setScene(this); // Set scene reference for WaveSprite spawning
    this.waveManager.setSessionStartTime(Date.now()); // Set session start time for autonomous wave delay
    this.successStreak = 0;

    this.announcer = new AnnouncerService();
    this.announcer.getCommentary(JSON.stringify({ event: 'waveStart' }))
      .then(result => console.log('[AnnouncerService test] result:', result))
      .catch(err => console.error('[AnnouncerService test] error', err));

    // Title at top center
    // this is too cluttered for now.
    // this.add.text(this.cameras.main.centerX, 50, 'STADIUM SIMULATOR', {
    //   fontSize: '48px',
    //   fontFamily: 'Arial',
    //   color: '#ffffff',
    // }).setOrigin(0.5, 0.5);

    // Score display at top-right
    this.scoreText = this.add.text(900, 50, 'Score: 0', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(1, 0.5);

    // Session timer display (always shown in run mode)
    this.sessionTimerText = this.add.text(512, 20, '100s', {
      fontSize: '28px',
      fontFamily: 'Arial',
      color: '#ffff00',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // Countdown display at top-left
    this.countdownText = this.add.text(100, 50, '', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    // Create wave strength meter (will be shown on wave start)
    this.createWaveStrengthMeter();

    // Initialize targeting indicator for mascot visual feedback
    // Note: Requires 'particle' texture created by MenuScene.preload()
    if (!this.textures.exists('particle')) {
      console.warn('[StadiumScene] Particle texture not found, creating fallback');
      this.createParticleTexture();
    }
    this.targetingIndicator = new TargetingIndicator(this);

    // Create GridOverlay for debug rendering (must be in same scene as camera)
    if (this.gridManager) {
      this.gridOverlay = new GridOverlay(this, this.gridManager);
      this.gridOverlay.setStadiumScene(this);
      this.gridOverlay.setAIManager(this.aiManager);
      
      // Setup keyboard toggles for grid overlay
      const keyboard = this.input.keyboard;
      if (keyboard) {
        // G key: Toggle grid visibility
        keyboard.addKey('G').on('down', () => {
          if (this.gridOverlay) {
            const newVisibility = !this.gridOverlay.visible;
            this.gridOverlay.setDebugVisible(newVisibility);
            console.log(`[StadiumScene] Grid overlay: ${newVisibility ? 'ON' : 'OFF'}`);
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
    }

    // Spawn mascots (one per section initially, inactive)
    this.sections.forEach((section, index) => {
      const mascot = new Mascot(this, section.x, section.y);
      mascot.setVisible(false); // Start hidden
      this.mascots.push(mascot);

      // Attach cannon event listeners for debugging
      mascot.on('cannonCharging', (data: any) => {
        console.log(`[Cannon] Mascot charging, targets: ${data.catchers.length}`);
      });

      mascot.on('cannonFired', (data: any) => {
        console.log(`[Cannon] Mascot fired at ${data.catchers.length} fans`);
      });

      mascot.on('cannonShot', (data: any) => {
        console.log(
          `[Cannon] Shot complete! ${data.catchers.length} catchers, ` +
          `${data.combinedEffects.size} fans affected by ripple`
        );
      });

      mascot.on('cannonMissed', (data: any) => {
        console.log(`[Cannon] Shot missed - ${data.reason}`);
      });

      console.log(`[Mascot] Created mascot ${index} for section ${section.getId()}`);
    });

    // Setup mascot keyboard controls
    this.setupMascotKeyboardControls();

    // Setup cleanup on scene shutdown
    this.events.once('shutdown', this.cleanupMascotControls, this);

    // Notify WorldScene that initialization is complete
    this.events.emit('stadiumReady', { aiManager: this.aiManager });
    console.log('[StadiumScene] Initialization complete, emitted stadiumReady event');

    // Notify WorldScene that initialization is complete
    this.events.emit('stadiumReady', { aiManager: this.aiManager });
    console.log('[StadiumScene] Initialization complete, emitted stadiumReady event');

    // Section labels are now fully handled by SectionActor; no logic here

    // Section stat overlays – positioned just below each section
    // Section stat overlays should be handled by actors or a UI overlay system, not here

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
      levelData.sections.forEach((sectionData) => {
        // set happiness to max (100) and thirst to 0
        this.gameState.updateSectionStat(sectionData.id, 'happiness', 100);
        this.gameState.updateSectionStat(sectionData.id, 'thirst', 0);
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
    this.showSessionCountdownOverlay();

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

    // Add keyboard shortcut to toggle wave debug visualization (press 'W')
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W).on('down', () => {
      if (this.waveManager && this.waveManager.getWaveSprite) {
        const waveSprite = this.waveManager.getWaveSprite();
        if (waveSprite && typeof waveSprite.toggleDebugVisible === 'function') {
          waveSprite.toggleDebugVisible();
          console.log('[DEBUG] Wave debug visualization toggled');
        }
      }
    });

    // Setup vendor button listeners
    levelData.sections.forEach((sectionData, sectionIdx) => {
      const section = sectionData.id.toLowerCase();
      document.getElementById(`v1-${section}`)?.addEventListener('click', () => {
        this.aiManager.assignVendorToSection(0, sectionIdx);
        console.log(`[UI] Assigned vendor 0 to section ${sectionData.id} (index ${sectionIdx})`);
      });
      document.getElementById(`v2-${section}`)?.addEventListener('click', () => {
        this.aiManager.assignVendorToSection(1, sectionIdx);
        console.log(`[UI] Assigned vendor 1 to section ${sectionData.id} (index ${sectionIdx})`);
      });
    });

    // Listen to VendorManager events for visual feedback
    this.aiManager.on('vendorPlaced', (data: { vendorId: number; section: string }) => {
      const sectionIndex = this.getSectionIndex(data.section);
      const section = this.sections[sectionIndex];
      if (section) {
        section.placedVendor(data.vendorId);
        // Add "VENDOR HERE" text or icon at section position
        this.add.text(section.x, section.y - 80, '🍺 VENDOR', {
          fontSize: '20px'
        }).setOrigin(0.5).setName(`vendor-${data.vendorId}-indicator`);
      }
    });

    this.aiManager.on('serviceComplete', (data: { vendorId: number; section: string }) => {
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
    this.waveManager.on('columnWaveReached', (data: { sectionId: string; gridCol: number; worldX: number; seatIds: string[]; seatCount: number; waveStrength?: number; visualState?: string }) => {
      console.log(`[StadiumScene.columnWaveReached] Section ${data.sectionId}, gridCol ${data.gridCol}, ${data.seatIds.length} seats`);
      
      const sectionIndex = this.getSectionIndex(data.sectionId);
      const section = this.sections[sectionIndex];
      if (data.seatIds.length === 0) {
        console.warn(`[StadiumScene.columnWaveReached] No seats for section ${data.sectionId} col ${data.gridCol}`);
        return;
      }
      
      const firstSeatId = data.seatIds[0];
      console.log(`[StadiumScene.columnWaveReached] First seatId: ${firstSeatId}`);
      const parts = firstSeatId.split('-');
      console.log(`[StadiumScene.columnWaveReached] SeatId parts: ${parts.join(', ')}, length: ${parts.length}`);
      
      // SeatId format is: ${sectionId}-${rowIndex}-${col}
      if (parts.length < 3) {
        console.warn(`[StadiumScene.columnWaveReached] Invalid seatId format: ${firstSeatId}`);
        return;
      }
      const columnIndex = parseInt(parts[2], 10);
      if (isNaN(columnIndex)) {
        console.warn(`[StadiumScene.columnWaveReached] Invalid columnIndex from seatId: ${firstSeatId}`);
        return;
      }

      console.log(`[StadiumScene.columnWaveReached] Parsed columnIndex: ${columnIndex}`);

      // Use waveStrength and visualState from event payload
      const waveStrength = data.waveStrength ?? this.waveManager.getCurrentWaveStrength();
      const visualState = (data.visualState as 'full' | 'sputter' | 'death' | undefined) ?? 'full';
      const participationMultiplier = 1; // TODO: Apply boosters if needed
      // Calculate participation for this specific column
      const fanStates = section.calculateColumnParticipation(columnIndex, waveStrength * participationMultiplier);
      console.log(`[StadiumScene.columnWaveReached] fanStates.length: ${fanStates.length}`);
      
      if (fanStates.length === 0) {
        console.warn(`[StadiumScene.columnWaveReached] No fanStates for section ${data.sectionId} col ${columnIndex}`);
        return;
      }
      
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
      console.log(`[StadiumScene.columnWaveReached] Calling playColumnAnimation for ${fanStates.length} fans`);
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

    // Section completion event - trigger visual effects
    this.waveManager.on('sectionComplete', (data: { sectionId: string; state: 'success' | 'sputter' | 'death'; avgParticipation: number }) => {
      const sectionIndex = this.getSectionIndex(data.sectionId);
      const section = this.sections[sectionIndex];
      
      console.log(`[StadiumScene.sectionComplete] Section ${data.sectionId} ${data.state}`);
      
      // Trigger section flash based on result
      if (data.state === 'success') {
        section.playAnimation('flash-success');
        // Trigger celebrate animation for random fans in the section
        const fans = section.getFans();
        const celebrateCount = Math.floor(fans.length * 0.3); // 30% of fans celebrate
        const celebrateFans = fans.sort(() => Math.random() - 0.5).slice(0, celebrateCount);
        celebrateFans.forEach((fan: any, idx: number) => {
          fan.playAnimation('celebrate', { delayMs: idx * 50 });
        });
      } else if (data.state === 'death') {
        section.playAnimation('flash-fail');
      }
      // No animation for sputter - it's just a weak success
    });

    this.waveManager.on('waveComplete', (data: { results: any[] }) => {
      this.gameState.incrementCompletedWaves();
      if (waveBtn) {
        waveBtn.disabled = false;
        waveBtn.textContent = 'START WAVE';
      }
      // Hide wave strength meter
      if (this.waveStrengthMeter) {
        this.waveStrengthMeter.setVisible(false);
      }
      
      // Trigger celebration or grumpy animations based on section participation
      const successfulSections = new Set(data.results.filter((r: any) => r.success).map((r: any) => r.section));
      
      this.sections.forEach((section, sectionIdx) => {
        const sectionId = this.levelData?.sections[sectionIdx]?.id || String.fromCharCode(65 + sectionIdx);
        const participated = successfulSections.has(sectionId);
        const fans = section.getFans();
        
        if (participated) {
          // Happy bounce for participating sections - randomized timing and subset
          const celebratePercentage = 0.4 + Math.random() * 0.3; // 40-70% of fans celebrate
          const celebrateCount = Math.floor(fans.length * celebratePercentage);
          const celebrateFans = fans.sort(() => Math.random() - 0.5).slice(0, celebrateCount);
          
          celebrateFans.forEach((fan: any) => {
            const randomDelay = Math.random() * 300; // Spread over 300ms
            if (typeof fan.playAnimation === 'function') {
              fan.playAnimation('celebrate', { delayMs: randomDelay });
            }
          });
        } else {
          // Grumpy jitter for non-participating sections - randomized timing and subset
          const grumpyPercentage = 0.3 + Math.random() * 0.2; // 30-50% show grumpiness
          const grumpyCount = Math.floor(fans.length * grumpyPercentage);
          const grumpyFans = fans.sort(() => Math.random() - 0.5).slice(0, grumpyCount);
          
          grumpyFans.forEach((fan: any) => {
            const randomDelay = Math.random() * 200; // Spread over 200ms
            if (typeof fan.playAnimation === 'function') {
              fan.playAnimation('grumpy', { delayMs: randomDelay });
            }
          });
        }
        
        // Reset all fans to their original positions (after animations complete)
        fans.forEach((fan: any) => {
          if (typeof fan.resetPositionAndTweens === 'function') {
            fan.resetPositionAndTweens();
          }
        });
      });
    });    // Full wave success celebration (camera shake) - scene-level effect
    this.waveManager.on('waveFullSuccess', () => {
      console.log('[StadiumScene] waveFullSuccess - triggering camera shake');
      this.cameras.main.shake(200, 0.005);
    });

    // Create debug panel
    this.createDebugPanel();
  }


  update(time: number, delta: number): void {
    // Guard: ensure managers are initialized before update logic
    if (!this.waveManager || !this.aiManager) {
      return;
    }

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
      if (this.sessionTimerText) {
        const timeRemaining = this.gameState.getSessionTimeRemaining();
        const seconds = Math.max(0, Math.ceil(timeRemaining / 1000));
        this.sessionTimerText.setText(`${seconds}s`);
      }
    }

    // Update fan stats (thirst decay, happiness, attention)
    // Only update stats when session is actually active (not during countdown)
    if (!this.demoMode && this.gameState.getSessionState() === 'active') {
      // Get section actors from registry and update their fan stats
      const sectionActors = this.actorRegistry.getByCategory('section');
      sectionActors.forEach(actor => {
        // Get environmental modifier for this section
        const sectionId = (actor as any).data?.get('sectionId') || 'A';
        const envModifier = this.gameState.getEnvironmentalModifier(sectionId);
        (actor as any).updateFanStats(delta, envModifier);
      });

      // Sync section-level stats from fan aggregates for UI display
      if (this.levelData) {
        this.levelData.sections.forEach((sectionData: any, idx: number) => {
          const sectionActor = sectionActors[idx];
          if (!sectionActor) return;
          const aggregate = (sectionActor as any).getAggregateStats();
          
          // Update GameStateManager with aggregate values for UI display
          this.gameState.updateSectionStat(sectionData.id, 'happiness', aggregate.happiness);
          this.gameState.updateSectionStat(sectionData.id, 'thirst', aggregate.thirst);
          this.gameState.updateSectionStat(sectionData.id, 'attention', aggregate.attention);
        });
      }

      // Check disinterested state for all fans (~500ms intervals)
      // This uses time-based throttling to avoid checking every frame
      this.sections.forEach(section => {
        section.getFans().forEach(fan => fan.checkDisinterestedState());
      });
    }

    // Update actor registry (for autonomous actor behaviors)
    this.actorRegistry.update(delta);

    // Update vendor manager
    this.aiManager.update(delta);

    // Update vendor visual positions
    this.updateVendorPositions();

    // Update mascot positions and states
    this.updateMascots(delta);

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
        console.log(`[Wave] Autonomous start section ${triggerSection} waveId=${wave.id}`);
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
   * Maps section ID to array index using level data
   * @param sectionId - The section identifier
   * @returns The section index
   */
  private getSectionIndex(sectionId: string): number {
    if (this.levelData) {
      return this.levelData.sections.findIndex((s: any) => s.id === sectionId);
    }
    // Fallback for legacy code
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
    this.sessionCountdownOverlay.setDepth(2000); // Render above vendors (depth 1000)
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
        console.log(`[DEBUG] Override strength=${val}`);
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
        console.log('[DEBUG] Recovery booster applied');
      }
      this.startWaveWithDisable(forceSputterBtn);
      console.log('[DEBUG] Forced sputter requested');
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
      console.log(`[DEBUG] Forced death requested (origin ${origin})`);
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
        console.log(`[DEBUG] Booster applied: ${b.key}`);
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
   * Update debug panel statistics display (displays wave stats and column grid)
   */
  private updateDebugStats(): void {
    const statsDiv = document.getElementById('debug-stats');
    if (!statsDiv) return;

    const score = this.waveManager.getScore();
    
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
      ${columnGridHtml}
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
    this.aiManager.on('vendorSpawned', (data: { vendorId: number; profile: any }) => {
      console.log(`[Vendor] Spawned vendor ${data.vendorId}`);
      const { vendorId, profile } = data;
      
      // Use vendor instance position (set from gridManager.gridToWorld)
      const instance = this.aiManager.getVendorInstance(vendorId);
      const startX = instance?.position.x ?? this.cameras.main.centerX;
      const startY = instance?.position.y ?? 550;
      const vendorSprite = new Vendor(this, startX, startY);
      vendorSprite.setDepth(1000); // Render above fans
      console.log(`[Vendor] Sprite created at (${startX}, ${startY})`);
      this.vendorSprites.set(vendorId, vendorSprite);
      console.log(`[Vendor] Total sprites: ${this.vendorSprites.size}`);
      this.add.existing(vendorSprite);
      console.log(`[Vendor] Profile type=${profile.type} quality=${profile.qualityTier}`);
      this.rebuildVendorControls();
    });

    // Listen for vendor state changes to update visuals
    this.aiManager.on('vendorReachedTarget', (data: { vendorId: number; position: any }) => {
      console.log(`[Vendor] Vendor ${data.vendorId} reached target`);
    });

    this.aiManager.on('serviceComplete', (data: { vendorId: number; fanServed?: boolean }) => {
      const sprite = this.vendorSprites.get(data.vendorId);
      if (sprite) {
        sprite.setMovementState('cooldown');
      }
      console.log(`[Vendor] Vendor ${data.vendorId} completed service`);
    });

    this.aiManager.on('vendorDistracted', (data: { vendorId: number }) => {
      const sprite = this.vendorSprites.get(data.vendorId);
      if (sprite) {
        sprite.setMovementState('distracted');
      }
      console.log(`[Vendor] Vendor ${data.vendorId} got distracted!`);
    });

    // Vendor section assignment
    this.aiManager.on('vendorSectionAssigned', (data: { vendorId: number; sectionIdx: number }) => {
      const sectionId = this.levelData?.sections[data.sectionIdx]?.id || 'Unknown';
      console.log(`[Vendor] Vendor ${data.vendorId} assigned to section ${sectionId}`);
      // Update UI highlight
      this.rebuildVendorControls();
    });
  }

  /**
   * Setup mascot keyboard controls
   */
  private setupMascotKeyboardControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    // M key: Activate first available mascot in first available section
    const mKey = keyboard.addKey('M');
    this.mascotKeys.push(mKey);
    mKey.on('down', () => {
      const availableMascot = this.mascots.find(m => m.canActivate());
      const availableSection = this.sections.find(s => !this.mascotSectionMap.has(s.getId()));

      if (availableMascot && availableSection) {
        availableMascot.activateInSection(availableSection, 'manual');
        this.mascotSectionMap.set(availableSection.getId(), availableMascot);
        console.log(`[Mascot] Activated mascot in section ${availableSection.getId()}`);
      } else {
        console.log('[Mascot] No available mascot or section');
      }
    });

    // Number keys (1-4): Assign mascot to specific section by index
    for (let i = 1; i <= 4; i++) {
      const numKey = keyboard.addKey(`${i}`);
      this.mascotKeys.push(numKey);
      numKey.on('down', () => {
        const sectionIndex = i - 1;
        if (sectionIndex >= this.sections.length) return;

        const section = this.sections[sectionIndex];
        const availableMascot = this.mascots.find(m => m.canActivate());

        // Check if section already has a mascot
        if (this.mascotSectionMap.has(section.getId())) {
          console.log(`[Mascot] Section ${section.getId()} already has a mascot`);
          return;
        }

        if (availableMascot) {
          availableMascot.activateInSection(section, 'manual');
          this.mascotSectionMap.set(section.getId(), availableMascot);
          console.log(`[Mascot] Activated mascot in section ${section.getId()} (index ${sectionIndex})`);
        } else {
          console.log('[Mascot] No available mascot (all in cooldown or active)');
        }
      });
    }

    // A key: Toggle auto-rotation mode for all mascots
    const aKey = keyboard.addKey('A');
    this.mascotKeys.push(aKey);
    aKey.on('down', () => {
      this.autoRotationMode = !this.autoRotationMode;
      this.mascots.forEach(m => {
        m.setMovementMode(this.autoRotationMode ? 'auto' : 'manual');
      });
      console.log(`[Mascot] Auto-rotation mode: ${this.autoRotationMode ? 'ON' : 'OFF'}`);
    });
  }

  /**
   * Clean up keyboard listeners on scene shutdown
   */
  private cleanupMascotControls(): void {
    // Remove all mascot keyboard listeners
    this.mascotKeys.forEach(key => key.off('down'));
    this.mascotKeys = [];
  }

  /**
   * Update vendor sprite positions to match their instance positions
   */
  private updateVendorPositions(): void {
    for (const [vendorId, sprite] of this.vendorSprites) {
      const instance = this.aiManager.getVendorInstance(vendorId);
      if (!instance) continue;

      // Update sprite position to match instance position
      sprite.setPosition(instance.position.x, instance.position.y);

      // Update sprite state to match vendor state
      sprite.setMovementState(instance.state);
    }
  }

  /**
   * Update mascot positions and handle deactivation cleanup
   */
  private updateMascots(delta: number): void {
    this.mascots.forEach(mascot => {
      mascot.update(delta);

      // Clean up section map when mascot deactivates
      if (!mascot.isPatrolling() && mascot.getAssignedSection()) {
        const sectionId = mascot.getAssignedSection()?.getId();
        if (sectionId && this.mascotSectionMap.get(sectionId) === mascot) {
          this.mascotSectionMap.delete(sectionId);
          mascot.clearSection();
        }
      }

      // Auto-rotation: automatically move mascot to next section
      if (gameBalance.mascot.autoRotationEnabled &&
          mascot.getMovementMode() === 'auto' &&
          mascot.canActivate() &&
          mascot.getAutoRotationCooldown() <= 0) {
        this.autoRotateMascot(mascot);
      }
    });
  }

  /**
   * Auto-rotate a mascot to the next available section
   */
  private autoRotateMascot(mascot: Mascot): void {
    // Find next available section (sequential rotation)
    const availableSection = this.sections.find(s => !this.mascotSectionMap.has(s.getId()));

    if (availableSection) {
      mascot.activateInSection(availableSection, 'auto');
      this.mascotSectionMap.set(availableSection.getId(), mascot);
      console.log(`[Mascot Auto-Rotation] Activated mascot in section ${availableSection.getId()}`);
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

    const vendorInstances = Array.from(this.aiManager.getVendorInstances().entries());
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
        const sectionId = this.levelData?.sections[sIdx]?.id || sIdx.toString();
        const btn = document.createElement('button');
        btn.className = 'vendor-btn';
        btn.textContent = `Section ${sectionId}`;
        btn.style.cssText = 'background:#111;border:1px solid #555;color:#eee;font-size:11px;padding:2px 6px;cursor:pointer;';
        if (instance.assignedSectionIdx === sIdx) {
          btn.style.border = '1px solid #0ff';
          btn.style.background = '#033';
        }
        btn.onclick = () => {
          this.aiManager.assignVendorToSection(vendorId, sIdx);
        };
        row.appendChild(btn);
      });

      controlsRoot.appendChild(row);
    });
  }

  /**
   * Get AIManager instance for external access (e.g., GridOverlay)
   */
  public getAIManager(): AIManager {
    return this.aiManager;
  }

  /**
   * Set background alpha (skybox and ground) for debug visualization
   */
  public setBackgroundAlpha(alpha: number): void {
    if (this.skyboxActor && this.skyboxActor.getSkybox) {
      const skybox = this.skyboxActor.getSkybox();
      if (skybox) {
        skybox.setAlpha(alpha);
      }
    }
    
    if (this.groundActor && this.groundActor.getGround) {
      const ground = this.groundActor.getGround();
      if (ground) {
        ground.setAlpha(alpha);
      }
    }
  }

  /**
   * Create particle texture (fallback if not created by MenuScene)
   * 4x4 white square for retro aesthetic
   */
  private createParticleTexture(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xFFFFFF, 1.0);
    graphics.fillRect(0, 0, 4, 4);
    graphics.generateTexture('particle', 4, 4);
    graphics.destroy();
  }
}

