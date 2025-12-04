import Phaser from 'phaser';
import { GameStateManager } from '@/managers/GameStateManager';
import { WaveManager } from '@/managers/WaveManager';
import { AIManager } from '@/managers/AIManager';
import { StadiumSection } from '@/sprites/StadiumSection';
import { Vendor } from '@/sprites/Vendor';
import { Mascot } from '@/sprites/Mascot';
import { MascotActor } from '@/actors/MascotActor';
import { VendorState } from '@/managers/interfaces';
import { AnnouncerService } from '@/managers/AnnouncerService';
import { DevPanel } from '@/ui/DevPanel';

import { gameBalance } from '@/config/gameBalance';
import { ActorRegistry } from '@/actors/base/ActorRegistry';
import { ActorFactory } from '@/actors/base/ActorFactory';
import { SectionActor } from '@/actors/SectionActor';
import { StairsActor } from '@/actors/StairsActor';
import { GroundActor } from '@/actors/GroundActor';
import { SkyboxActor } from '@/actors/SkyboxActor';
import { DropZoneActor } from '@/actors/DropZoneActor';
import { FanActor } from '@/actors/FanActor';
import { VendorActor } from '@/actors/VendorActor';
import { DrinkVendorBehavior } from '@/actors/behaviors/DrinkVendorBehavior';
import { GridManager } from '@/managers/GridManager';
import { LevelService } from '@/services/LevelService';
import { GridOverlay } from '@/scenes/GridOverlay';
import { PathfindingService } from '@/services/PathfindingService';
import { TargetingIndicator } from '@/components/TargetingIndicator';
import { TargetingReticle } from '@/ui/TargetingReticle';
import { OverlayManager } from '@/managers/OverlayManager';
import PersonalityIntegrationManager from '@/systems/PersonalityIntegrationManager';

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
  private dropZoneActors: DropZoneActor[] = []; // Track drop zone actors
  private mascotActors: MascotActor[] = []; // Track mascot actors (logic + sprite)
  private mascotSectionMap: Map<string, MascotActor> = new Map(); // Map sectionId -> mascot actor
  private autoRotationMode: boolean = false; // Auto-rotation mode for mascots
  private mascotKeys: Phaser.Input.Keyboard.Key[] = []; // Track keyboard keys for cleanup
  private demoMode: boolean = false;
  private debugMode: boolean = false;
  private successStreak: number = 0;
  private waveSerial: number = 0; // Incremented each waveStart for cooldown keys
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
  private pathfindingService?: PathfindingService;
  private targetingReticle?: TargetingReticle;
  private vendorTargetingActive: number | null = null; // Vendor ID currently being targeted
  private mascotTargetingActive: boolean = false; // Mascot targeting mode active
  private overlayManager?: OverlayManager;

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
      if (gameBalance.debug.sceneLogs) console.log('StadiumScene initialized in run mode');
      if (gameBalance.debug.sceneLogs) console.log('GridManager received:', this.gridManager ? 'YES' : 'NO');
    }
  }

  async create(): Promise<void> {
        // Show vendor penalty overlay when SectionActor applies penalties
        window.addEventListener('vendorPenaltyApplied', (e: any) => {
          const d = e.detail || {};
          const world = this.gridManager?.gridToWorld(d.vendorRow, d.vendorCol);
          const x = world?.x ?? 900;
          const y = world?.y ?? 120;
          const text = this.add.text(x, y - 20, d.message || 'Vendor In the Way! Booooo!', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ff5555',
            backgroundColor: 'rgba(0,0,0,0.4)'
          }).setOrigin(0.5, 1);
          text.setDepth(355);
            // Move slightly during solid display, then fade/move
            this.tweens.add({
              targets: text,
              y: y - 40,
              duration: 3000,
              ease: 'Sine.easeOut'
            });
            this.time.delayedCall(3000, () => {
              this.tweens.add({
                targets: text,
                y: y - 80,
                alpha: 0,
                duration: 3000,
                ease: 'Cubic.easeOut',
                onComplete: () => text.destroy()
              });
            });
        });
    // Listen for vendor collision events (emitted by FanActor)
    window.addEventListener('vendorCollision', (e: any) => {
      const d = e.detail || {};
      console.log('[StadiumScene] vendorCollision event', {
        waveSerial: this.waveSerial,
        gridRow: d.gridRow,
        gridCol: d.gridCol,
        vendorId: d.vendorId,
      });
      const sectionId = this.getSectionIdForGridCol(d.gridCol);
      if (!sectionId) {
        console.warn('[StadiumScene] No sectionId for gridCol', d.gridCol);
        return;
      }
      const waveKey = `${this.waveSerial}:${sectionId}`;
      console.log('[StadiumScene] Mapped collision', { sectionId, waveKey });
      const sectionActor = this.getSectionActorById(sectionId);
      if (sectionActor) {
        sectionActor.applyCollisionPenalties(waveKey, { row: d.gridRow, col: d.gridCol });
      } else {
        console.warn('[StadiumScene] No SectionActor found for', sectionId);
      }
    });

    // Initialize personality integration manager (loads AI content)
    if (gameBalance.debug.sceneLogs) console.log('[StadiumScene] Initializing PersonalityIntegrationManager...');
    const personalityManager = PersonalityIntegrationManager();
    await personalityManager.initialize();
    if (gameBalance.debug.sceneLogs) console.log('[StadiumScene] PersonalityIntegrationManager initialized');

    // Load level data (sections, seats, fans, vendors)
    const levelData = await LevelService.loadLevel();
    this.levelData = levelData; // Cache for later use
    if (gameBalance.debug.sceneLogs) console.log('[StadiumScene] Level data loaded:', levelData);

    // Load zone configuration into GridManager
    if (this.gridManager && levelData.gridConfig) {
      if (gameBalance.debug.sceneLogs) console.log('[StadiumScene] Loading zone config into GridManager');
      if (gameBalance.debug.sceneLogs) console.log('[StadiumScene] gridConfig structure:', {
        hasCellRanges: !!levelData.gridConfig.cellRanges,
        cellRangesCount: levelData.gridConfig.cellRanges?.length,
        hasCells: !!levelData.gridConfig.cells,
        cellsCount: levelData.gridConfig.cells?.length,
        hasGridConfig: !!levelData.gridConfig.gridConfig,
      });
      this.gridManager.loadZoneConfig(levelData.gridConfig);
      if (gameBalance.debug.sceneLogs) console.log('[StadiumScene] Zone config loaded successfully');
    } else {
      // console.warn('[StadiumScene] GridManager or gridConfig not available');
    }

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

    // Initialize shared PathfindingService once and attach it everywhere
    if (this.gridManager) {
      this.pathfindingService = new PathfindingService(this.gridManager);
      this.aiManager.attachPathfindingService(this.pathfindingService);
    } else {
      // console.warn('[StadiumScene] Cannot initialize PathfindingService without GridManager');
    }

    // Create SectionActors from level data (Actor-first, data-driven!)
    const sectionActors: SectionActor[] = [];
    levelData.sections.forEach((sectionData) => {
      const actorId = ActorFactory.generateId('section', sectionData.id);
      const sectionActor = new SectionActor(
        actorId,
        this,
        sectionData,
        this.gridManager,
        this.actorRegistry,
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
        // Use simple multiplication for width/height since we want exact cell coverage
        const cellSize = this.gridManager!.getWorldSize().cellSize;
        const topLeftCenter = this.gridManager!.gridToWorld(stairData.gridTop, stairData.gridLeft);
        const bottomRightCenter = this.gridManager!.gridToWorld(
          stairData.gridTop + stairData.height - 1,
          stairData.gridLeft + stairData.width - 1
        );
        
        const worldBounds = {
          x: (topLeftCenter.x + bottomRightCenter.x) / 2,
          y: (topLeftCenter.y + bottomRightCenter.y) / 2,
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

    // Create drop zone actors from grid configuration
    if (this.gridManager) {
      const dropZones = this.gridManager.getDropZones();
      if (gameBalance.debug.sceneLogs) console.log(`[StadiumScene] Creating ${dropZones.length} drop zone actors`);
      
      dropZones.forEach((dropZone, idx) => {
        const actorId = ActorFactory.generateId('dropzone', idx);
        const worldPos = this.gridManager!.gridToWorld(dropZone.row, dropZone.col);
        const cellSize = this.gridManager!.getWorldSize().cellSize;
        
        const dropZoneActor = new DropZoneActor({
          id: actorId,
          scene: this,
          x: worldPos.x,
          y: worldPos.y,
          cellSize,
          gridRow: dropZone.row,
          gridCol: dropZone.col
        });
        
        this.actorRegistry.register(dropZoneActor);
        this.dropZoneActors.push(dropZoneActor);
        
        if (gameBalance.debug.sceneLogs) console.log(`[StadiumScene] Created drop zone at grid (${dropZone.row},${dropZone.col})`);
      });
    }

    // Initialize AIManager with sections for pathfinding
    this.aiManager.initializeSections(this.sections);
    this.aiManager.setSectionActors(sectionActors);

    // Listen to vendor events BEFORE spawning (important!)
    this.setupVendorEventListeners();

    // Spawn vendors at positions from level data
    if (levelData.vendors && this.gridManager) {
      levelData.vendors.forEach((vendorData, idx) => {
        const worldPos = this.gridManager!.gridToWorld(vendorData.gridRow, vendorData.gridCol);
        if (gameBalance.debug.sceneLogs) console.log(`[Vendor Init] Spawning vendor at grid (${vendorData.gridRow}, ${vendorData.gridCol}) -> world (${worldPos.x}, ${worldPos.y})`);

        // Spawn vendor actor (actor creates its own sprite)
        const { actor: vendorActor, id: vendorId } = this.aiManager.spawnVendor(this, worldPos.x, worldPos.y, vendorData.type as any, 'good');

        // Store sprite for UI controls
        const vendorSprite = vendorActor.getVendor();
        this.vendorSprites.set(vendorId, vendorSprite);
        if (gameBalance.debug.sceneLogs) console.log(`[Vendor Init] Created vendor actor ${vendorId}, total sprites: ${this.vendorSprites.size}`);
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
      // Initialize OverlayManager (UI overlays between ground and scenery)
      this.overlayManager = new OverlayManager(this);
      // Hook real section world positions (use sprite positions for now)
      this.overlayManager.setSectionPositionResolver((sectionId: string) => {
        const idx = this.getSectionIndex(sectionId);
        const section = this.sections[idx];
        const cfgHeight = 200; // matches sectionConfig.height
        const x = section?.x ?? this.cameras.main.centerX;
        // Use config offset for overlay Y
        const yOffset = gameBalance.ui.waveCelebration?.yOffset ?? -32;
        const y = (section?.y ?? this.cameras.main.centerY) - cfgHeight / 2 + yOffset;
        return { x, y };
      });
    this.announcer.getCommentary(JSON.stringify({ event: 'waveStart' }))
      // .then(result => console.log('[AnnouncerService test] result:', result))
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
      // console.warn('[StadiumScene] Particle texture not found, creating fallback');
      this.createParticleTexture();
    }
    this.targetingIndicator = new TargetingIndicator(this);

    // Create GridOverlay for debug rendering (must be in same scene as camera)
    if (this.gridManager) {
      this.gridOverlay = new GridOverlay(this, this.gridManager);
      this.gridOverlay.setStadiumScene(this);
      this.gridOverlay.setAIManager(this.aiManager);
      if (this.pathfindingService) {
        this.gridOverlay.setPathfindingService(this.pathfindingService);
      }
      
      // Create targeting reticle (hidden initially)
      this.targetingReticle = new TargetingReticle(this);
      this.targetingReticle.on('cancelled', this.exitVendorTargetingMode, this);
      
      // Setup keyboard toggles for grid overlay
      const keyboard = this.input.keyboard;
      if (keyboard) {
        // G key: Toggle grid visibility
        keyboard.addKey('G').on('down', () => {
          if (this.gridOverlay) {
            const newVisibility = !this.gridOverlay.visible;
            this.gridOverlay.setDebugVisible(newVisibility);
            // console.log(`[StadiumScene] Grid overlay: ${newVisibility ? 'ON' : 'OFF'}`);
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
        // Z key: Toggle zone visualization (only if grid visible)
        keyboard.addKey('Z').on('down', () => {
          if (this.gridOverlay) {
            this.gridOverlay.toggleZones();
          }
        });

        // T key: Toggle transition markers (only if grid visible)
        keyboard.addKey('T').on('down', () => {
          if (this.gridOverlay) {
            this.gridOverlay.toggleTransitions();
          }
        });

        // E key: Toggle directional edges (only if grid visible)
        keyboard.addKey('E').on('down', () => {
          if (this.gridOverlay) {
            this.gridOverlay.toggleDirectionalEdges();
          }
        });
      }
    }

    // Spawn single mascot actor in ground area - aligned to grid
    if (this.gridManager) {
      const centerX = this.cameras.main.centerX;
      const groundY = groundLineY + 60 + (3 * 32); // 60px below ground line + 3 rows (96px)
      
      // Convert to grid coordinates and back to world to ensure alignment
      const gridPos = this.gridManager.worldToGrid(centerX, groundY);
      if (gridPos) {
        const alignedPos = this.gridManager.gridToWorld(gridPos.row, gridPos.col);
        if (alignedPos) {
          const mascotSprite = new Mascot(this, alignedPos.x, alignedPos.y);
          this.add.existing(mascotSprite); // Add sprite to scene display list
          mascotSprite.setVisible(true); // Always visible so we can see the new visuals
          mascotSprite.setDepth(500); // Above fans and vendors
          const mascotActorId = 'actor:mascot-0';
          const mascotActor = new MascotActor(mascotActorId, mascotSprite, null, this.gridManager, false);
          if (this.pathfindingService) {
            mascotActor.attachPathfindingService(this.pathfindingService);
          }
          this.actorRegistry.register(mascotActor);
          this.aiManager.registerMascot(mascotActor);
          this.mascotActors.push(mascotActor);
          // console.log(`[MascotActor] Registered mascot actor ${mascotActorId} at grid (${gridPos.row}, ${gridPos.col})`);
          
          // Listen for t-shirt cannon hits to apply stat changes
          (mascotActor as any).on?.('tShirtCannonHit', (payload: { x: number; y: number; timestamp: number }) => {
            this.handleTShirtCannonHit(payload, mascotActor);
          });
          
          // Listen for crowd goes wild event
          (mascotActor as any).on?.('crowdGoesWild', (payload: { intensity: number }) => {
            this.handleCrowdGoesWild(payload.intensity);
          });
        }
      }
    }

    // Setup mascot keyboard controls
    this.setupMascotKeyboardControls();

    // Setup cleanup on scene shutdown
    this.events.once('shutdown', this.cleanupMascotControls, this);
    
    // Setup canvas click handler for vendor targeting
    this.input.on('pointerdown', this.handleCanvasClick, this);

    // Notify WorldScene that initialization is complete
    this.events.emit('stadiumReady', { aiManager: this.aiManager });
    // console.log('[StadiumScene] Initialization complete, emitted stadiumReady event');

    // Notify WorldScene that initialization is complete
    this.events.emit('stadiumReady', { aiManager: this.aiManager });
    // console.log('[StadiumScene] Initialization complete, emitted stadiumReady event');

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
        // console.log(`[DEBUG] Force Sputter initiated - will degrade strength (origin ${origin})`);
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
          // console.log('[DEBUG] Wave debug visualization toggled');
        }
      }
    });

    // Setup vendor button listeners
    levelData.sections.forEach((sectionData, sectionIdx) => {
      const section = sectionData.id.toLowerCase();
      document.getElementById(`v1-${section}`)?.addEventListener('click', () => {
        this.aiManager.assignVendorToSection(0, sectionIdx);
        // console.log(`[UI] Assigned vendor 0 to section ${sectionData.id} (index ${sectionIdx})`);
      });
      document.getElementById(`v2-${section}`)?.addEventListener('click', () => {
        this.aiManager.assignVendorToSection(1, sectionIdx);
        // console.log(`[UI] Assigned vendor 1 to section ${sectionData.id} (index ${sectionIdx})`);
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

    // Wire wave events through AIManager (Phase 4: Wave Event Migration)
    // AIManager handles actor momentum updates, then re-emits for Scene UI
    this.waveManager.on('waveFullSuccess', () => {
      this.aiManager.handleWaveSuccess({ type: 'full' });
    });

    this.waveManager.on('sectionComplete', (data: { sectionId: string; state: 'success' | 'sputter' | 'death'; avgParticipation: number }) => {
      if (data.state === 'success') {
        this.aiManager.handleWaveSuccess({ type: 'section', ...data });
      } else {
        this.aiManager.handleWaveFail({ type: 'section', ...data });
      }
    });

    // Listen to AIManager's processed wave events for UI updates
    this.aiManager.on('waveSuccessProcessed', (data: any) => {
      if (data.type === 'full') {
        // console.log('[StadiumScene] waveFullSuccess - triggering camera shake');
        this.cameras.main.shake(200, 0.005);
      }
    });

    // Listen to WaveManager events for visual feedback
    this.waveManager.on('waveStart', () => {
      // Reset per-section collision cooldowns at the start of each wave
      const sections = this.actorRegistry.getByCategory('section') || [];
      for (const a of sections) {
        (a as any).resetCollisionCooldown?.();
      }
      this.waveSerial++;
      console.log('[StadiumScene] waveStart incremented waveSerial', this.waveSerial);
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

    // Listen to vendor collisions (Phase 3.1)
    this.waveManager.on('vendorCollision', (data: { actorId: string; sectionId: string; pointsAtRisk: number; vendorPosition: { row: number; col: number }; waveColumn: number }) => {
      // console.log(`[StadiumScene.vendorCollision] 💥 Vendor ${data.actorId} hit in section ${data.sectionId}! Points at risk: ${data.pointsAtRisk}`);
      // TODO Phase 3.2: Apply collision penalties via SectionActor
      // TODO Phase 3.3: Roll for splat and apply consequences
    });

    // Grid-column-based wave participation (triggered as wave moves through grid)
    this.waveManager.on('columnWaveReached', (data: { sectionId: string; gridCol: number; worldX: number; seatIds: string[]; seatCount: number; waveStrength?: number; visualState?: string }) => {
      // console.log(`[StadiumScene.columnWaveReached] Section ${data.sectionId}, gridCol ${data.gridCol}, ${data.seatIds.length} seats`);
      
      const sectionIndex = this.getSectionIndex(data.sectionId);
      const section = this.sections[sectionIndex];
      
      // Get SectionActor for calculating participation (not the sprite)
      const sectionActors = this.actorRegistry.getByCategory('section');
      const sectionActor = sectionActors[sectionIndex] as SectionActor;
      
      if (!sectionActor) {
        // console.warn(`[StadiumScene.columnWaveReached] No SectionActor for section ${data.sectionId} index ${sectionIndex}`);
        return;
      }
      
      if (data.seatIds.length === 0) {
        // console.warn(`[StadiumScene.columnWaveReached] No seats for section ${data.sectionId} col ${data.gridCol}`);
        return;
      }
      
      const firstSeatId = data.seatIds[0];
      // console.log(`[StadiumScene.columnWaveReached] First seatId: ${firstSeatId}`);
      const parts = firstSeatId.split('-');
      // console.log(`[StadiumScene.columnWaveReached] SeatId parts: ${parts.join(', ')}, length: ${parts.length}`);
      
      // SeatId format is: ${sectionId}-${rowIndex}-${col}
      if (parts.length < 3) {
        // console.warn(`[StadiumScene.columnWaveReached] Invalid seatId format: ${firstSeatId}`);
        return;
      }
      const columnIndex = parseInt(parts[2], 10);
      if (isNaN(columnIndex)) {
        // console.warn(`[StadiumScene.columnWaveReached] Invalid columnIndex from seatId: ${firstSeatId}`);
        return;
      }

      // console.log(`[StadiumScene.columnWaveReached] Parsed columnIndex: ${columnIndex}`);

      // Use waveStrength and visualState from event payload
      const waveStrength = data.waveStrength ?? this.waveManager.getCurrentWaveStrength();
      const visualState = (data.visualState as 'full' | 'sputter' | 'death' | undefined) ?? 'full';
      const participationMultiplier = 1; // TODO: Apply boosters if needed
      
      // Calculate participation using SectionActor (not deprecated sprite method)
      const fanStates = sectionActor.calculateColumnParticipation(columnIndex, waveStrength * participationMultiplier);
      
      if (fanStates.length === 0) {
        // This can happen if the column is outside the section's range - just skip silently
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
      
      // Trigger animation using SectionActor (not deprecated sprite method)
      sectionActor.playColumnAnimation(columnIndex, fanStates, visualState, waveStrength);
      
      // Log every few columns to reduce spam
      if (this.waveManager['currentGridColumnIndex'] % 5 === 0) {
        // console.log(`[Column Wave] Section ${data.sectionId} col ${columnIndex}: ${columnState} (${Math.round(columnRate*100)}%)`);
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
    this.waveManager.on('sectionComplete', (data: { 
      sectionId: string; 
      state: 'success' | 'sputter' | 'death'; 
      avgParticipation: number; 
      successCount: number; 
      sputterCount: number; 
      deathCount: number;
      aggregateStats: { happiness: number; thirst: number; attention: number };
    }) => {
      const sectionIndex = this.getSectionIndex(data.sectionId);
      const section = this.sections[sectionIndex];
      
      // console.log(`[StadiumScene.sectionComplete] Section ${data.sectionId} ${data.state}`);
      
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

      // Create celebration overlay above section using OverlayManager
      if (this.overlayManager) {
        // Defensive: ensure participation is a valid number
        let participation = Number(data.avgParticipation);
        if (isNaN(participation) || participation == null) participation = 0;
        participation = Math.round(participation * 100);
        
        // Generate stat-based reasons from aggregate fan stats
        const reasons: string[] = [];
        const stats = data.aggregateStats;
        
        // Success reasons (positive contributors)
        if (data.state === 'success') {
          if (stats.happiness > 70) reasons.push('+ high spirits');
          if (stats.attention > 70) reasons.push('+ focused crowd');
          if (stats.thirst < 30) reasons.push('+ well hydrated');
        }
        
        // Sputter reasons (mixed performance)
        if (data.state === 'sputter') {
          if (stats.attention < 50) reasons.push('- distracted');
          if (stats.happiness < 50) reasons.push('- lukewarm mood');
          if (stats.thirst > 60) reasons.push('- getting thirsty');
        }
        
        // Failure reasons (negative contributors)
        if (data.state === 'death') {
          if (stats.attention < 40) reasons.push('- lost interest');
          if (stats.happiness < 40) reasons.push('- unhappy fans');
          if (stats.thirst > 70) reasons.push('- very thirsty');
        }
        
        // Fallback: if no specific reasons, show column breakdown
        if (reasons.length === 0) {
          const totalColumns = data.successCount + data.sputterCount + data.deathCount;
          if (data.successCount > 0 && totalColumns > 0) {
            const successPercent = Math.round((data.successCount / totalColumns) * 100);
            reasons.push(`+ ${successPercent}% strong`);
          }
          if (data.sputterCount > 0 && totalColumns > 0) {
            const sputterPercent = Math.round((data.sputterCount / totalColumns) * 100);
            reasons.push(`- ${sputterPercent}% weak`);
          }
        }
        
        this.overlayManager.createWaveCelebration({
          sectionId: data.sectionId,
          participation,
          state: data.state === 'success' ? 'success' : data.state === 'death' ? 'fail' : 'neutral',
          reasons,
        });
      }
    });

    this.waveManager.on('waveComplete', (data: { results: any[] }) => {
      this.gameState.incrementCompletedWaves();
            // Wave points are added per-section within WaveManager; no UI-side addition here
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
      // console.log('[StadiumScene] UPDATE LOOP IS RUNNING');
      // console.log('[StadiumScene] waveAutonomous.enabled =', gameBalance.waveAutonomous.enabled);
      // console.log('[StadiumScene] Wave manager active =', this.waveManager.isActive());
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

    // Universal actor orchestration through AIManager (Phase 3 complete)
    // AIManager handles: scenery → utility → fans → vendors → mascots
    // Stat decay now happens per-fan via FanActor.update()
    // Get round time from GameStateManager for time-aware behavior
    const roundTime = this.gameState.getRoundTime();
    this.aiManager.update(delta, roundTime, this);

    // Sync section-level stats from fan aggregates for UI display
    // (Aggregates are now updated by SectionActor.update() in AIManager)
    if (this.levelData && this.gameState.getSessionState() === 'active') {
      const sectionActors = this.actorRegistry.getByCategory('section');
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

    // Update vendor visual positions
    this.updateVendorPositions();
    // Render vendor grid labels when path debug is active
    this.renderVendorGridLabels();

    // Update mascot positions and states
    this.updateMascots(delta, roundTime);

    // Tick wave sprite movement and events (sprite-driven propagation)
    this.waveManager.update(delta, roundTime);

    // Update overlay manager (clean up finished overlays)
    if (this.overlayManager) {
      this.overlayManager.update(delta);
    }

    // Check for autonomous wave triggering (only when session is active)
    if (gameBalance.waveAutonomous.enabled && 
        !this.waveManager.isActive() && 
        this.gameState.getSessionState() === 'active') {
      const triggerSection = this.waveManager.checkWaveProbability();
      if (triggerSection) {
        const wave = this.waveManager.createWave(triggerSection);
        this.showIncomingCue(triggerSection);
        // console.log(`[Wave] Autonomous start section ${triggerSection} waveId=${wave.id}`);
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

    // Update score display (use vendor score to reflect point deposits)
      if (this.scoreText) {
        const total = this.gameState.getTotalScore();
        this.scoreText.setText(`Score: ${total}`);
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

    // Update vendor button cooldowns (real-time countdown)
    this.updateVendorCooldowns();

    // Update mascot UI controls (real-time attention bar and ultimate button)
    this.updateMascotControls();

    // Update targeting reticle cursor validation (real-time)
    if ((this.vendorTargetingActive !== null || this.mascotTargetingActive) && this.targetingReticle) {
      this.updateTargetingReticle();
    }
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
    // console.log(`[Incoming Cue] Wave starting from section ${sectionId}`);
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
    // console.log(`[Particle Effect] Wave start at (${x}, ${y})`);
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

    // Helper listeners done
  }

  private getSectionIdForGridCol(gridCol: number): string | null {
    if (!this.levelData?.sections) return null;
    for (const s of this.levelData.sections) {
      if (gridCol >= s.gridLeft && gridCol <= s.gridRight) return s.id;
    }
    return null;
  }

  private getSectionActorById(sectionId: string): SectionActor | null {
    const actors = this.actorRegistry.getByCategory('section') || [];
    for (const a of actors) {
      if ((a as any).getSectionId?.() === sectionId) return a as any;
    }
    return null;
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
      // console.log('Session ended with score:', sessionScore);
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
        // console.log(`[DEBUG] Override strength=${val}`);
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
        // console.log('[DEBUG] Recovery booster applied');
      }
      this.startWaveWithDisable(forceSputterBtn);
      // console.log('[DEBUG] Forced sputter requested');
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
      // console.log(`[DEBUG] Forced death requested (origin ${origin})`);
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
        // console.log(`[DEBUG] Booster applied: ${b.key}`);
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
        // console.log('[DEBUG PANEL]', debugPanelVisible ? 'VISIBLE' : 'HIDDEN');
      });
    }

    // Add keyboard key for toggling wave sprite visibility (W key)
    const wKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    if (wKey) {
      wKey.on('down', () => {
        const newValue = !gameBalance.waveSprite.visible;
        gameBalance.waveSprite.visible = newValue;
        // console.log('[WAVE SPRITE]', newValue ? 'VISIBLE' : 'HIDDEN');
      });
    }

    // console.log('[DEBUG PANEL] Created. Press D to toggle. Press S to force sputter. Press W to toggle wave sprite.');

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
      // console.log(`[Vendor] Spawned vendor ${data.vendorId}`);
      const { vendorId, profile } = data;
      
      // Get vendor actor and its sprite
      const vendorActor = this.aiManager.getVendorActor(vendorId);
      const vendorSprite = vendorActor?.getVendor();
      if (vendorSprite) {
        this.vendorSprites.set(vendorId, vendorSprite);
        // console.log(`[Vendor] Sprite created at (${vendorSprite.x}, ${vendorSprite.y})`);
        // console.log(`[Vendor] Total sprites: ${this.vendorSprites.size}`);
      }
      // console.log(`[Vendor] Profile type=${profile.type} quality=${profile.qualityTier}`);
      this.rebuildVendorControls();
    });

    // Listen for vendor state changes to update visuals
    this.aiManager.on('vendorReachedTarget', (data: { vendorId: number; position: any }) => {
      // console.log(`[Vendor] Vendor ${data.vendorId} reached target`);
    });

    this.aiManager.on('serviceComplete', (data: { vendorId: number; fanServed?: boolean }) => {
      const sprite = this.vendorSprites.get(data.vendorId);
      if (sprite) {
        sprite.setMovementState('cooldown');
      }
      // console.log(`[Vendor] Vendor ${data.vendorId} completed service`);
    });

    this.aiManager.on('vendorDistracted', (data: { vendorId: number }) => {
      const sprite = this.vendorSprites.get(data.vendorId);
      if (sprite) {
        sprite.setMovementState('distracted');
      }
      // console.log(`[Vendor] Vendor ${data.vendorId} got distracted!`);
    });

    // Vendor section assignment
    this.aiManager.on('vendorSectionAssigned', (data: { vendorId: number; sectionIdx: number }) => {
      const sectionId = this.levelData?.sections[data.sectionIdx]?.id || 'Unknown';
      // console.log(`[Vendor] Vendor ${data.vendorId} assigned to section ${sectionId}`);
      // Update UI highlight
      this.rebuildVendorControls();
    });

    // Vendor dropoff event (scoring)
    this.aiManager.on('vendorDropoff', (data: { actorId: string; pointsEarned: number }) => {
      // console.log(`[Vendor] Vendor ${data.actorId} dropped off ${data.pointsEarned} points`);
      
      // Add score to GameStateManager
      this.gameState.addVendorScore(data.pointsEarned);
      
      // Find vendor actor via registry
      const vendorActor = this.actorRegistry.get(data.actorId) as VendorActor;
      if (vendorActor) {
        const vendorPos = vendorActor.getGridPosition();
        let nearestDropZone: DropZoneActor | null = null;
        let minDistance = Infinity;
        
        for (const dropZone of this.dropZoneActors) {
          const dropPos = dropZone.getGridPosition();
          const distance = Math.abs(vendorPos.row - dropPos.row) + Math.abs(vendorPos.col - dropPos.col);
          if (distance < minDistance) {
            minDistance = distance;
            nearestDropZone = dropZone;
          }
        }
        
        // Flash the drop zone
        if (nearestDropZone) {
          nearestDropZone.flash();
        }
        
        // Spawn floating score text at vendor position
        const worldPos = vendorActor.getPosition();
        const floatingText = this.add.text(
          worldPos.x,
          worldPos.y,
          `+${data.pointsEarned} pts`,
          {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#00ff00', // Green
            stroke: '#000000',
            strokeThickness: 3
          }
        );
        floatingText.setOrigin(0.5, 0.5);
        floatingText.setDepth(gameBalance.dropZone.floatingTextDepth);
        
        // Animate floating text (move up and fade)
        this.tweens.add({
          targets: floatingText,
          y: worldPos.y - gameBalance.dropZone.floatingTextRiseDistance,
          alpha: 0,
          duration: gameBalance.dropZone.floatingTextDuration,
          onComplete: () => {
            floatingText.destroy();
          }
        });
      }
      
      // Update score display
      if (this.scoreText) {
        const total = this.gameState.getTotalScore();
        this.scoreText.setText(`Score: ${total}`);
      }
    });

    // Vendor splat event (collision with wave)
    this.aiManager.on('vendorSplatted', (data: { vendorId: string; pointsLost: number }) => {
      console.log(`[Vendor] Vendor ${data.vendorId} splatted! Lost ${data.pointsLost} uncollected points`);
      
      // Don't subtract from total score - these points were never added yet (still pocketed)
      // Just record the event for the scoreboard/stats
      
      // Find vendor actor via registry
      const vendorActor = this.actorRegistry.get(data.vendorId) as VendorActor;
      if (vendorActor) {
        // Spawn floating text "-X pts SPILLED!" at vendor position
        const worldPos = vendorActor.getPosition();
        const floatingText = this.add.text(
          worldPos.x,
          worldPos.y,
          `-${data.pointsLost} pts SPILLED!`,
          {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ff0000', // Red
            stroke: '#000000',
            strokeThickness: 3
          }
        );
        floatingText.setOrigin(0.5, 0.5);
        floatingText.setDepth(360); // Above vendor and fans
        
        // Animate floating text (move up and fade)
        this.tweens.add({
          targets: floatingText,
          y: worldPos.y - 40,
          alpha: 0,
          duration: 1800,
          onComplete: () => {
            floatingText.destroy();
          }
        });
      }
      
      // Update score display
      if (this.scoreText) {
        const total = this.gameState.getTotalScore();
        this.scoreText.setText(`Score: ${total}`);
      }
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
      const availableMascot = this.mascotActors.find(m => m.canActivate());
      const availableSection = this.sections.find(s => !this.mascotSectionMap.has(s.getId()));
      if (availableMascot && availableSection) {
        availableMascot.activateInSection(availableSection, 'manual');
        this.mascotSectionMap.set(availableSection.getId(), availableMascot);
        // console.log(`[MascotActor] Activated mascot in section ${availableSection.getId()}`);
        availableMascot.getSprite().setVisible(true);
      } else {
        // console.log('[MascotActor] No available mascot or section');
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
        const availableMascot = this.mascotActors.find(m => m.canActivate());

        // Check if section already has a mascot
        if (this.mascotSectionMap.has(section.getId())) {
          // console.log(`[Mascot] Section ${section.getId()} already has a mascot`);
          return;
        }

        if (availableMascot) {
          availableMascot.activateInSection(section, 'manual');
          this.mascotSectionMap.set(section.getId(), availableMascot);
          availableMascot.getSprite().setVisible(true);
          // console.log(`[MascotActor] Activated mascot in section ${section.getId()} (index ${sectionIndex})`);
        } else {
          // console.log('[MascotActor] No available mascot (all in cooldown or active)');
        }
      });
    }

    // A key: Toggle auto-rotation mode for all mascots
    const aKey = keyboard.addKey('A');
    this.mascotKeys.push(aKey);
    aKey.on('down', () => {
      this.autoRotationMode = !this.autoRotationMode;
      this.mascotActors.forEach(m => m.setMovementMode(this.autoRotationMode ? 'auto' : 'manual'));
      // console.log(`[MascotActor] Auto-rotation mode: ${this.autoRotationMode ? 'ON' : 'OFF'}`);
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
   * Setup mascot UI control event listeners (called after dynamic DOM rebuild)
   */
  private setupMascotControlListeners(): void {
    const targetBtn = document.getElementById('mascot-target') as HTMLButtonElement;
    const ultimateBtn = document.getElementById('mascot-ultimate') as HTMLButtonElement;
    const attentionBarFill = document.getElementById('attention-bar-fill') as HTMLDivElement;
    const attentionBarText = document.getElementById('attention-bar-text') as HTMLDivElement;

    if (!targetBtn || !ultimateBtn || !attentionBarFill || !attentionBarText) {
      console.warn('[StadiumScene] Mascot control elements not found in DOM');
      return;
    }

    // Target button - enters mascot targeting mode
    targetBtn.addEventListener('click', () => {
      if (this.mascotTargetingActive) {
        this.exitMascotTargetingMode();
      } else {
        this.enterMascotTargetingMode();
      }
    });

    // Ultimate button - fires ultimate ability
    ultimateBtn.addEventListener('click', () => {
      if (this.mascotActors.length === 0) return;
      
      const mascot = this.mascotActors[0];
      const behavior = (mascot as any).getBehavior?.();
      
      if (behavior && behavior.isUltimateReady && behavior.isUltimateReady()) {
        console.log('[Mascot] Ultimate fired!');
        // Get section sprites from ActorRegistry
        const sectionActors = this.actorRegistry.getByCategory('section');
        const sections = sectionActors.map((actor: any) => actor.getSprite?.()).filter(Boolean);
        // Get ultimate power from attention bank
        const ultimatePower = behavior.getAttentionBank?.() || 30;
        (mascot as any).fireUltimate?.(this, sections, ultimatePower);
      }
    });

    // Update attention bar every frame in the update loop (handled separately)
    // Store references for update method
    (this as any).mascotControlElements = {
      targetBtn,
      ultimateBtn,
      attentionBarFill,
      attentionBarText
    };
  }

  /**
   * Update mascot UI controls (called every frame in update loop)
   */
  private updateMascotControls(): void {
    const elements = (this as any).mascotControlElements;
    if (!elements || this.mascotActors.length === 0) return;

    const mascot = this.mascotActors[0];
    const behavior = (mascot as any).getBehavior?.();
    
    if (!behavior) return;

    // Update attention bar
    const attentionBank = behavior.getAttentionBank?.() ?? 0;
    const isUltimateReady = behavior.isUltimateReady?.() ?? false;
    
    elements.attentionBarFill.style.width = `${attentionBank}%`;
    elements.attentionBarText.textContent = `${Math.round(attentionBank)}/100`;
    
    // Enable/disable ultimate button based on readiness
    elements.ultimateBtn.disabled = !isUltimateReady;
  }

  /**
   * Update vendor sprite positions to match their instance positions
   */
  private updateVendorPositions(): void {
    for (const [vendorId, sprite] of this.vendorSprites) {
      const vendorActor = this.aiManager.getVendorActor(vendorId);
      if (!vendorActor) continue;

      // Update sprite position to match actor position
      const position = vendorActor.getPosition();
      sprite.setPosition(position.x, position.y);

      // Update sprite state to match vendor behavior state
      const behavior = vendorActor.getBehavior();
      if (behavior && 'getState' in behavior) {
        sprite.setMovementState((behavior as any).getState());
      }
    }
  }

  /** Render grid coordinate labels below vendor sprites when vendor path debug (V) is active */
  private renderVendorGridLabels(): void {
    if (!this.gridOverlay) return;
    const active = this.gridOverlay.showVendorPaths;
    // Remove existing labels
    this.children.list.filter(c => c.name && c.name.startsWith('vendor-grid-label-')).forEach(c => c.destroy());
    if (!active) return;
    for (const [vendorId, sprite] of this.vendorSprites) {
      const actor = this.actorRegistry.get(`actor:vendor-${vendorId}`) as any;
      if (!actor || !this.gridManager) continue;
      const gp = actor.getGridPosition();
      const label = this.add.text(sprite.x, sprite.y + 18, `(${gp.col},${gp.row})`, {
        fontSize: '11px',
        fontFamily: 'Courier New',
        color: '#ffec99'
      }).setOrigin(0.5, 0);
      label.setDepth(sprite.depth + 1);
      label.name = `vendor-grid-label-${vendorId}`;
    }
  }

  /**
   * Update mascot positions and handle deactivation cleanup
   */
  private updateMascots(delta: number, roundTime: number): void {
    this.mascotActors.forEach(actor => {
      actor.update(delta, roundTime);
      // Section cleanup when actor deactivates
      if (!actor.isPatrolling() && actor.getAssignedSection()) {
        const sectionId = actor.getAssignedSection()?.getId();
        if (sectionId && this.mascotSectionMap.get(sectionId) === actor) {
          this.mascotSectionMap.delete(sectionId);
        }
      }
      // Auto-rotation
      if (gameBalance.mascot.autoRotationEnabled &&
          actor.getMovementMode() === 'auto' &&
          actor.canActivate() &&
          actor.getAutoRotationCooldown() <= 0) {
        this.autoRotateMascot(actor);
      }
    });
  }

  /**
   * Auto-rotate a mascot to the next available section
   */
  private autoRotateMascot(actor: MascotActor): void {
    const availableSection = this.sections.find(s => !this.mascotSectionMap.has(s.getId()));
    if (availableSection) {
      actor.activateInSection(availableSection, 'auto');
      this.mascotSectionMap.set(availableSection.getId(), actor);
      actor.getSprite().setVisible(true);
      // console.log(`[MascotActor Auto-Rotation] Activated mascot in section ${availableSection.getId()}`);
    }
  }

  /**
   * Dynamically rebuild vendor assignment controls (player-driven targeting)
   */
  private rebuildVendorControls(): void {
    const controlsRoot = document.getElementById('controls');
    if (!controlsRoot) return;
    
    // Clear previous controls
    controlsRoot.innerHTML = '';
    
    // Re-add wave button
    const waveBtn = document.createElement('button');
    waveBtn.id = 'wave-btn';
    waveBtn.textContent = 'START WAVE';
    waveBtn.style.display = 'none';
    controlsRoot.appendChild(waveBtn);

    // Use vendorActors map (new actor-based system)
    const vendorActors = Array.from(this.aiManager.getVendorActors().entries());
    // console.log(`[rebuildVendorControls] Building controls for ${vendorActors.length} vendors`);
    
    vendorActors.forEach(([vendorId, vendorActor], displayIndex) => {
      const row = document.createElement('div');
      row.className = 'vendor-controls';
      row.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-top:8px;';

      // Main vendor button
      const btn = document.createElement('button');
      btn.className = 'vendor-btn';
      btn.id = `vendor-btn-${vendorId}`;

      // Personality label logic using new helper
      const personalityName = vendorActor.getPersonalityName?.();
      const label = personalityName || `Vendor #${displayIndex + 1}`;
      btn.textContent = label;
      // Persist personality for dynamic state changes (targeting, exit, cooldown)
      (btn as any).dataset.personality = label;
      btn.style.cssText = 'background:#111;border:1px solid #555;color:#eee;font-size:11px;padding:4px 8px;cursor:pointer;';

      // Check cooldown status
      const onCooldown = this.aiManager.isVendorOnCooldown(vendorId);
      if (onCooldown) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      }

      btn.onclick = () => {
        const liveCooldown = this.aiManager.isVendorOnCooldown(vendorId);
        if (liveCooldown) {
          // console.log(`[VendorControls] Click ignored; vendor ${vendorId} still on cooldown`);
          return;
        }
        // console.log(`[VendorControls] Initiating targeting for vendor ${vendorId}`);
        this.enterVendorTargetingMode(vendorId);
      };
      row.appendChild(btn);

      // Status + recall container
      const statusWrap = document.createElement('div');
      statusWrap.id = `vendor-status-wrap-${vendorId}`;
      statusWrap.style.cssText = 'display:flex;align-items:center;gap:6px;justify-content:center;';

      const statusLabel = document.createElement('span');
      statusLabel.id = `vendor-status-${vendorId}`;
      statusLabel.style.cssText = 'font-size:10px;color:#999;';

      const behavior = vendorActor.getBehavior() as DrinkVendorBehavior;
      const assignedSection = behavior.getAssignedSection();
      const sectionNames = ['Section A', 'Section B', 'Section C'];

      if (onCooldown) {
        const remaining = this.aiManager.getVendorCooldownRemaining(vendorId);
        statusLabel.textContent = `Cooldown: ${Math.ceil(remaining / 1000)}s`;
      } else if (assignedSection !== null && assignedSection >= 0 && assignedSection <= 2) {
        statusLabel.textContent = sectionNames[assignedSection];
      } else {
        const state = behavior.getState();
        statusLabel.textContent = state === 'patrolling' ? 'Patrolling' : 'Available';
      }

      statusWrap.appendChild(statusLabel);

      // Recall button appears only if actively working (serving/moving) or assignedSection set
      const state = behavior.getState();
      const working = state === 'serving' || state === 'moving';
      // Show recall button only if NOT on cooldown and vendor is working or assigned
      if (!onCooldown && (working || assignedSection !== null)) {
        const recallBtn = document.createElement('button');
        recallBtn.id = `vendor-recall-${vendorId}`;
        recallBtn.title = 'Force recall to patrol';
        recallBtn.textContent = '⟳'; // refresh symbol
        recallBtn.style.cssText = 'background:#400;border:1px solid #a00;color:#faa;font-size:11px;padding:2px 6px;cursor:pointer;line-height:12px;';
        recallBtn.onclick = () => {
          this.aiManager.recallVendor(vendorId);
          // Refresh controls after recall
          setTimeout(() => this.rebuildVendorControls(), 50);
        };
        statusWrap.appendChild(recallBtn);
      }

      row.appendChild(statusWrap);
      controlsRoot.appendChild(row);
    });

    // Add mascot controls
    const mascotRow = document.createElement('div');
    mascotRow.className = 'mascot-controls';
    mascotRow.style.cssText = 'display:flex;gap:10px;align-items:center;padding:10px;background:rgba(128,0,0,0.2);border:2px solid #800000;border-radius:4px;margin-top:8px;';

    // Mascot label
    const mascotLabel = document.createElement('span');
    mascotLabel.textContent = 'Mascot:';
    mascotLabel.style.cssText = 'color:#ffaa00;font-size:14px;font-weight:bold;';
    mascotRow.appendChild(mascotLabel);

    // Target button
    const targetBtn = document.createElement('button');
    targetBtn.id = 'mascot-target';
    targetBtn.className = 'mascot-btn';
    targetBtn.textContent = 'Target: Section A';
    targetBtn.style.cssText = 'padding:8px 16px;font-size:14px;font-weight:bold;background:#800000;color:#ffaa00;border:2px solid #ffaa00;border-radius:4px;cursor:pointer;';
    mascotRow.appendChild(targetBtn);

    // Ultimate button
    const ultimateBtn = document.createElement('button');
    ultimateBtn.id = 'mascot-ultimate';
    ultimateBtn.className = 'mascot-btn';
    ultimateBtn.textContent = 'Fire Ultimate';
    ultimateBtn.disabled = true;
    ultimateBtn.style.cssText = 'padding:8px 16px;font-size:14px;font-weight:bold;background:#800000;color:#ffaa00;border:2px solid #ffaa00;border-radius:4px;cursor:pointer;';
    mascotRow.appendChild(ultimateBtn);

    // Attention bar
    const attentionBarContainer = document.createElement('div');
    attentionBarContainer.style.cssText = 'width:120px;height:20px;background:#333;border:2px solid #ffaa00;border-radius:3px;overflow:hidden;position:relative;';
    
    const attentionBarFill = document.createElement('div');
    attentionBarFill.id = 'attention-bar-fill';
    attentionBarFill.style.cssText = 'height:100%;background:linear-gradient(90deg,#800000,#ffaa00);width:0%;transition:width 0.3s ease;';
    attentionBarContainer.appendChild(attentionBarFill);
    
    const attentionBarText = document.createElement('div');
    attentionBarText.id = 'attention-bar-text';
    attentionBarText.textContent = '0/100';
    attentionBarText.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;text-shadow:1px 1px 2px black;';
    attentionBarContainer.appendChild(attentionBarText);
    
    mascotRow.appendChild(attentionBarContainer);
    controlsRoot.appendChild(mascotRow);

    // Setup mascot control event listeners
    this.setupMascotControlListeners();
  }

  /**
   * Enter vendor targeting mode
   */
  private enterVendorTargetingMode(vendorId: number): void {
    if (this.vendorTargetingActive !== null) {
      // console.warn('[StadiumScene] Already in targeting mode');
      return;
    }
    
    this.vendorTargetingActive = vendorId;
    // console.log(`[StadiumScene] Entered targeting mode for vendor ${vendorId}`);
    
    // Show reticle
    if (this.targetingReticle) {
      this.targetingReticle.show();
    }
    
    // Update button state
    const btn = document.getElementById(`vendor-btn-${vendorId}`) as HTMLElement | null;
    if (btn) {
      const personality = (btn as any).dataset?.personality || `Vendor ${vendorId}`;
      btn.style.border = '2px solid #0f0';
      btn.style.background = '#030';
      btn.textContent = `▶ ${personality} ◀`;
    }
  }

  /**
   * Exit vendor targeting mode
   */
  private exitVendorTargetingMode(): void {
    if (this.vendorTargetingActive === null) return;
    
    const vendorId = this.vendorTargetingActive;
    // console.log(`[StadiumScene] Exited targeting mode for vendor ${vendorId}`);
    
    // Hide reticle
    if (this.targetingReticle) {
      this.targetingReticle.hide();
    }
    
    // Restore button state
    const btn = document.getElementById(`vendor-btn-${vendorId}`) as HTMLElement | null;
    if (btn) {
      const personality = (btn as any).dataset?.personality || `Vendor ${vendorId}`;
      btn.style.border = '1px solid #555';
      btn.style.background = '#111';
      btn.textContent = personality;
    }
    
    this.vendorTargetingActive = null;
  }

  /**
   * Handle canvas click during vendor targeting
   */
  private handleCanvasClick(pointer: Phaser.Input.Pointer): void {
    // Handle mascot targeting first
    if (this.mascotTargetingActive && this.gridManager) {
      this.handleMascotTargetClick(pointer);
      return;
    }
    
    // Handle vendor targeting
    if (this.vendorTargetingActive === null || !this.gridManager) return;
    
    // Convert world coordinates to grid
    const gridPos = this.gridManager.worldToGrid(pointer.worldX, pointer.worldY);
    if (!gridPos) {
      // console.log('[StadiumScene] Click outside grid bounds, cancelling targeting');
      this.exitVendorTargetingMode();
      return;
    }
    
    // Validate click: allow 'seat' zone only
    const cell = this.gridManager.getCell(gridPos.row, gridPos.col);
    if (!cell || cell.zoneType !== 'seat') {
      // console.log('[StadiumScene] Click on non-seat tile, cancelling targeting');
      this.exitVendorTargetingMode();
      return;
    }
    
    // Determine which section this seat belongs to
    const sectionIdx = this.getSectionAtGridPosition(gridPos.row, gridPos.col);
    if (sectionIdx === null) {
      // console.log('[StadiumScene] Could not determine section for clicked seat');
      this.exitVendorTargetingMode();
      return;
    }
    
    // Assign vendor to section
    // console.log(`[StadiumScene] Assigning vendor ${this.vendorTargetingActive} to section ${sectionIdx} via click at grid (${gridPos.row},${gridPos.col})`);
    this.aiManager.assignVendorToSection(this.vendorTargetingActive, sectionIdx, gridPos.row, gridPos.col);
    
    // Exit targeting mode
    this.exitVendorTargetingMode();
    
    // Rebuild controls to show assignment
    this.rebuildVendorControls();
  }

  /**
   * Enter mascot targeting mode
   */
  private enterMascotTargetingMode(): void {
    if (this.mascotTargetingActive) return;
    
    this.mascotTargetingActive = true;
    console.log('[StadiumScene] Entered mascot targeting mode');
    
    // Show reticle
    if (this.targetingReticle) {
      this.targetingReticle.show();
    }
    
    // Update button state
    const btn = document.getElementById('mascot-target') as HTMLButtonElement | null;
    if (btn) {
      btn.style.border = '2px solid #ffaa00';
      btn.style.background = '#a00';
      btn.textContent = '▶ Click Target ◀';
    }
  }

  /**
   * Exit mascot targeting mode
   */
  private exitMascotTargetingMode(): void {
    if (!this.mascotTargetingActive) return;
    
    console.log('[StadiumScene] Exited mascot targeting mode');
    
    // Hide reticle
    if (this.targetingReticle) {
      this.targetingReticle.hide();
    }
    
    // Restore button state
    const btn = document.getElementById('mascot-target') as HTMLButtonElement | null;
    if (btn) {
      btn.style.border = '2px solid #ffaa00';
      btn.style.background = '#800000';
      btn.textContent = 'Target Section';
    }
    
    this.mascotTargetingActive = false;
  }

  /**
   * Handle mascot target click
   */
  private handleMascotTargetClick(pointer: Phaser.Input.Pointer): void {
    if (!this.gridManager || this.mascotActors.length === 0) return;
    
    // Convert world coordinates to grid
    const gridPos = this.gridManager.worldToGrid(pointer.worldX, pointer.worldY);
    if (!gridPos) {
      console.log('[Mascot] Click outside grid bounds, cancelling targeting');
      this.exitMascotTargetingMode();
      return;
    }
    
    // Validate click: allow 'seat' zone only
    const cell = this.gridManager.getCell(gridPos.row, gridPos.col);
    if (!cell || cell.zoneType !== 'seat') {
      console.log('[Mascot] Click on non-seat tile, cancelling targeting');
      this.exitMascotTargetingMode();
      return;
    }
    
    // Determine which section this seat belongs to
    const sectionIdx = this.getSectionAtGridPosition(gridPos.row, gridPos.col);
    if (sectionIdx === null) {
      console.log('[Mascot] Could not determine section for clicked seat');
      this.exitMascotTargetingMode();
      return;
    }
    
    // Get section ID (A, B, C)
    const sectionId = String.fromCharCode(65 + sectionIdx); // 0='A', 1='B', 2='C'
    const mascot = this.mascotActors[0];
    
    // Check if section is on cooldown
    if (mascot.isSectionOnCooldown(sectionId)) {
      const remaining = Math.ceil(mascot.getSectionCooldownRemaining(sectionId) / 1000);
      console.log(`[Mascot] Section ${sectionId} is on cooldown (${remaining}s remaining)`);
      this.exitMascotTargetingMode();
      return;
    }
    
    // Fire at clicked position
    console.log(`[Mascot] Firing at section ${sectionId} grid (${gridPos.row},${gridPos.col})`);
    mascot.fireTShirtCannonAt(pointer.worldX, pointer.worldY, sectionId, sectionIdx, this);
    
    // Exit targeting mode
    this.exitMascotTargetingMode();
  }

  /**
   * Handle t-shirt cannon hit: apply stat changes and visual reactions
   */
  private handleTShirtCannonHit(payload: { x: number; y: number; timestamp: number }, mascotActor: any): void {
    if (!this.gridManager) return;

    const { x, y } = payload;
    const hitGrid = this.gridManager.worldToGrid(x, y);
    if (!hitGrid) return;

    // Query fans within ripple radius (3 cells)
    const rippleRadius = 3;
    const fanActors = this.actorRegistry.getByCategory('fan');
    let totalAttentionDrained = 0;

    fanActors.forEach((actor: any) => {
      const fanGrid = { row: actor.gridRow, col: actor.gridCol };
      const distance = Math.abs(fanGrid.row - hitGrid.row) + Math.abs(fanGrid.col - hitGrid.col);
      
      if (distance <= rippleRadius) {
        // Apply t-shirt cannon effect via actor (triggers excited state + animation)
        const happinessBoost = 3;
        const attentionDrain = 2;
        
        // Calculate intensity falloff (1.5 at epicenter, 0.5 at max distance) - extreme for visibility
        const intensity = 1.5 - (distance / rippleRadius) * 1.0;
        
        // Slower ripple delay: 150ms per cell (3x slower than 50ms)
        // Animation duration is 300ms, so with 150ms spacing there's good overlap but visible wave
        const delay = distance * 150; // 0ms at epicenter, 450ms at distance 3
        
        console.log(`[TShirtCannon] Fan at (${fanGrid.row},${fanGrid.col}) distance=${distance} intensity=${intensity.toFixed(2)} delay=${delay.toFixed(0)}ms`);
        
        if (actor.applyTShirtCannonEffect) {
          // Apply stat changes immediately
          if (actor.modifyStats) {
            actor.modifyStats({ happiness: happinessBoost, attention: -attentionDrain });
            totalAttentionDrained += attentionDrain;
          }
          
          // Trigger visual reaction with ripple delay
          this.time.delayedCall(delay, () => {
            if (typeof (actor as any).triggerExcitedReaction === 'function') {
              (actor as any).triggerExcitedReaction(intensity);
            }
          });
        } else {
          console.warn('[TShirtCannon] applyTShirtCannonEffect not found on actor', actor);
        }
      }
    });

    // Add drained attention to mascot bank
    const behavior = mascotActor.getBehavior?.();
    if (behavior && behavior.addAttention) {
      behavior.addAttention(totalAttentionDrained);
    }

    console.log(`[Mascot] Drained ${totalAttentionDrained} attention from fans`);
  }

  /**
   * Handle crowd goes wild animation (triggered by ultimate ability)
   * @param intensity Intensity of the crowd reaction (0.0-1.0, based on ultimate power 30-100)
   */
  private handleCrowdGoesWild(intensity: number): void {
    console.log(`[CrowdGoesWild] Intensity: ${intensity.toFixed(2)}`);
    
    const fanActors = this.actorRegistry.getByCategory('fan');
    
    // Make all fans bounce with random delays for wave effect
    fanActors.forEach((actor: any) => {
      // Random delay 0-500ms for organic stadium-wide excitement
      const delay = Math.random() * 500;
      
      // Scale intensity: 0.0 (30p) = 0.5 reaction, 1.0 (100p) = 1.5 reaction
      const fanIntensity = 0.5 + intensity * 1.0;
      
      this.time.delayedCall(delay, () => {
        if (typeof (actor as any).triggerExcitedReaction === 'function') {
          (actor as any).triggerExcitedReaction(fanIntensity);
        }
      });
    });
  }

  /**
   * Get section index at grid position
   * @param row Grid row
   * @param col Grid column
   * @returns Section index (0-2) or null if not in any section
   */
  private getSectionAtGridPosition(row: number, col: number): number | null {
    // Query actual section bounds from SectionActors instead of hardcoding
    const sectionActors = this.actorRegistry.getByCategory('section');
    
    for (let i = 0; i < sectionActors.length; i++) {
      const sectionActor = sectionActors[i] as any; // Cast to access getSectionData
      const sectionData = sectionActor.getSectionData?.();
      if (!sectionData) continue;
      
      // Check if position is within section's seat bounds (4 rows)
      const rowStart = sectionData.gridTop;
      const rowEnd = sectionData.gridTop + 3; // 4 seat rows
      const colStart = sectionData.gridLeft;
      const colEnd = sectionData.gridRight;
      
      // Debug logging for row 15
      if (row === 15 && col >= colStart && col <= colEnd) {
        // console.log(`[getSectionAtGridPosition] Checking row=${row}, col=${col}`, {
        //   sectionId: sectionData.id,
        //   rowStart,
        //   rowEnd,
        //   colStart,
        //   colEnd,
        //   rowInRange: row >= rowStart && row <= rowEnd,
        //   colInRange: col >= colStart && col <= colEnd
        // });
      }
      
      if (row >= rowStart && row <= rowEnd && col >= colStart && col <= colEnd) {
        return i; // Return section index
      }
    }
    
    return null;
  }

  /**
   * Update vendor button cooldown displays (called every frame)
   * Shows real-time countdown on cooldown buttons
   */
  private updateVendorCooldowns(): void {
    // Iterate all vendor actors and update their DOM status labels
    const vendorActors = this.aiManager.getVendorActors();
    
    vendorActors.forEach((vendorActor, vendorId) => {
      const statusLabel = document.getElementById(`vendor-status-${vendorId}`);
      if (!statusLabel) return;

      // Check if vendor is on cooldown
      const btn = document.getElementById(`vendor-btn-${vendorId}`) as HTMLButtonElement | null;
      const behavior = vendorActor.getBehavior() as DrinkVendorBehavior;
      const assignedSection = behavior.getAssignedSection();
      const sectionNames = ['Section A', 'Section B', 'Section C'];
      const onCooldown = this.aiManager.isVendorOnCooldown(vendorId);
      const state = behavior.getState();

      if (onCooldown) {
        const cooldownMs = this.aiManager.getVendorCooldownRemaining(vendorId);
        const cooldownSec = Math.ceil(cooldownMs / 1000);
        statusLabel.textContent = `Cooldown: ${cooldownSec}s`;
        if (btn) {
          btn.disabled = true;
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';
        }
      } else {
        if (btn && btn.disabled) {
          // Re-enable button when cooldown expires
          btn.disabled = false;
          btn.style.opacity = '1.0';
          btn.style.cursor = 'pointer';
        }
        if (assignedSection !== null && assignedSection >= 0 && assignedSection <= 2) {
          statusLabel.textContent = sectionNames[assignedSection];
        } else if (state === 'patrolling') {
          statusLabel.textContent = 'Patrolling';
        } else if (state === 'serving') {
          statusLabel.textContent = 'Serving';
        } else if (state === 'moving') {
          statusLabel.textContent = 'En Route';
        } else {
          statusLabel.textContent = 'Available';
        }
      }

      // Reactive recall button visibility without full rebuild
      const workingNow = state === 'serving' || state === 'moving';
      const shouldShowRecall = !onCooldown && (workingNow || assignedSection !== null);
      const existingRecall = document.getElementById(`vendor-recall-${vendorId}`);
      if (shouldShowRecall && !existingRecall) {
        const wrap = document.getElementById(`vendor-status-wrap-${vendorId}`);
        if (wrap) {
          const recallBtn = document.createElement('button');
          recallBtn.id = `vendor-recall-${vendorId}`;
          recallBtn.title = 'Force recall to patrol';
          recallBtn.textContent = '⟳';
          recallBtn.style.cssText = 'background:#400;border:1px solid #a00;color:#faa;font-size:11px;padding:2px 6px;cursor:pointer;line-height:12px;';
          recallBtn.onclick = () => {
            this.aiManager.recallVendor(vendorId);
          };
          wrap.appendChild(recallBtn);
        }
      } else if (!shouldShowRecall && existingRecall) {
        existingRecall.remove();
      }
    });
  }

  /**
   * Update targeting reticle cursor validation (called every frame when targeting active)
   * Changes reticle color based on whether cursor is over valid section seat
   */
  private updateTargetingReticle(): void {
    if (!this.targetingReticle || !this.gridManager) return;

    // Get cursor world position
    const pointer = this.input.activePointer;
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;

    // Convert to grid position
    const gridPos = this.gridManager.worldToGrid(worldX, worldY);
    if (!gridPos) {
      this.targetingReticle.setTargetable(false, null);
      return;
    }

    // Check zone, allow seats and rowEntry boundary cells on seat rows
    const zone = this.gridManager.getZoneType(gridPos.row, gridPos.col);
    const sectionIdx = this.getSectionAtGridPosition(gridPos.row, gridPos.col);
    const isValidTarget = zone === 'seat' && sectionIdx !== null;

    // Handle mascot targeting (check cooldowns and show orange for cooldown)
    if (this.mascotTargetingActive && this.mascotActors.length > 0 && isValidTarget && sectionIdx !== null) {
      const mascot = this.mascotActors[0];
      const sectionId = String.fromCharCode(65 + sectionIdx); // 0='A', 1='B', 2='C'
      
      if (mascot.isSectionOnCooldown(sectionId)) {
        // Section is on cooldown - show orange reticle with cooldown text
        const remainingMs = mascot.getSectionCooldownRemaining(sectionId);
        const remainingSec = Math.ceil(remainingMs / 1000);
        this.targetingReticle.setTargetable(false, sectionIdx, 0xff8800); // Orange
        this.targetingReticle.setCooldownText(`Section Cooldown: ${remainingSec}s`);
      } else {
        // Valid target
        this.targetingReticle.setTargetable(true, sectionIdx);
        this.targetingReticle.setCooldownText('');
      }
    } else {
      // Vendor targeting or invalid
      this.targetingReticle.setTargetable(!!isValidTarget, isValidTarget ? sectionIdx : null);
      this.targetingReticle.setCooldownText('');
    }
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

