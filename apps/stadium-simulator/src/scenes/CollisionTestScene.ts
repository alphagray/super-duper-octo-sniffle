import Phaser from 'phaser';
import { GridManager } from '@/managers/GridManager';
import { SectionActor } from '@/actors/SectionActor';
import { ActorRegistry } from '@/actors/base/ActorRegistry';
import { GameStateManager } from '@/managers/GameStateManager';
import { LevelService } from '@/services/LevelService';
import { gameBalance } from '@/config/gameBalance';

/**
 * CollisionTestScene: Manual collision testing playground
 * - Single section (Section B) with fans
 * - Simple vendor sprites placed in each row
 * - SPACEBAR: Trigger left-to-right wave
 * - LEFT/RIGHT: Reposition vendors randomly within rows
 * - On-screen collision reports
 */
export class CollisionTestScene extends Phaser.Scene {
  private gridManager!: GridManager;
  private actorRegistry!: ActorRegistry;
  private gameStateManager!: GameStateManager;
  private sectionActor!: SectionActor;
  private vendorSprites: Phaser.GameObjects.Rectangle[] = [];
  private vendorPositions: Array<{ row: number; col: number }> = [];
  private fanSprites: Phaser.GameObjects.Graphics[] = [];
  private waveSerial = 0;
  private collisionLog: Phaser.GameObjects.Text[] = [];
  private instructionsText!: Phaser.GameObjects.Text;
  private waveGraphics?: Phaser.GameObjects.Graphics;
  private waveX = 0;
  private waveActive = false;
  private sectionBData: any;
  private debugText!: Phaser.GameObjects.Text;
  private levelData: any;
  
  // Collision tracking
  private expectedCollisions = 0;
  private actualCollisions = 0;
  private collisionsByWave: Map<number, { expected: number; actual: number }> = new Map();
  private fansCollidedThisWave: Set<string> = new Set(); // Track which fans have collided to prevent double-counting

  constructor() {
    super({ key: 'CollisionTestScene' });
  }

  async create() {
    console.log('[CollisionTestScene] Starting collision test playground');

    // Initialize core systems
    this.actorRegistry = new ActorRegistry();
    
    // Create GridManager with canvas dimensions
    const { width, height } = this.cameras.main;
    this.gridManager = new GridManager({ width, height });
    
    this.gameStateManager = new GameStateManager();

    // Pan camera to center of grid
    this.cameras.main.centerOn(width / 2, height / 2);

    // Load real level data from file
    this.levelData = await LevelService.loadLevel();
    if (!this.levelData) {
      console.error('[CollisionTestScene] Failed to load level data');
      return;
    }

    // Load zone configuration into GridManager
    this.gridManager.loadZoneConfig(this.levelData.gridConfig);

    // Find Section B from real level data
    this.sectionBData = this.levelData.sections.find((s: any) => s.id === 'B');
    if (!this.sectionBData) {
      console.error('[CollisionTestScene] Section B not found in level data');
      return;
    }

    // Get fans for Section B from real level data (included in section data)
    const sectionBFans = this.sectionBData.fans || [];
    console.log(`[CollisionTestScene] Section B has ${sectionBFans.length} fans from level data`);
    
    // Create Section B actor using REAL level data (this creates real FanActors + sprites)
    this.sectionActor = new SectionActor(
      'test-section-B',
      this,
      this.sectionBData,
      this.gridManager,
      this.actorRegistry,
      'section',
      false // enableLogging
    );
    this.actorRegistry.register(this.sectionActor);

    console.log(`[CollisionTestScene] Section B created with real FanActors`);

    // Populate Section B with real fans from level data
    if (sectionBFans && sectionBFans.length > 0) {
      console.log(`[CollisionTestScene] Populating Section B with ${sectionBFans.length} fans`);
      this.sectionActor.populateFromData(sectionBFans);
    } else {
      console.warn('[CollisionTestScene] No fans found in level data for Section B; using empty section');
    }

    // Create real vendors (pull from level data if available)
    const sectionBVendors = this.levelData.vendors?.filter((v: any) => v.sectionId === 'B') || [];
    console.log(`[CollisionTestScene] Section B has ${sectionBVendors.length} vendors in level data`);

    // For now, manually place simple vendor rectangles for testing
    this.createTestVendors();

    // Setup keyboard controls
    this.setupKeyboardControls();

    // Setup collision event listener
    this.setupCollisionListener();

    // Draw UI
    this.createUI();

    // Draw section bounds for reference
    this.drawSectionBounds();

    // Draw grid overlay
    this.drawGridOverlay();

    // Setup mouse tracking
    this.setupMouseTracking();
  }

  private setupMouseTracking() {
    this.input.on('pointermove', (pointer: any) => {
      const gridPos = this.gridManager.worldToGrid(pointer.x, pointer.y);
      this.debugText.setText(
        `COLLISION TEST PLAYGROUND\n` +
        `SPACEBAR: Trigger wave (left→right)\n` +
        `LEFT/RIGHT: Reposition vendors\n` +
        `R: Reset vendor positions\n` +
        `─────────────────────────\n` +
        `MOUSE: World (${Math.round(pointer.x)}, ${Math.round(pointer.y)}) | Grid (${gridPos?.row || '?'}, ${gridPos?.col || '?'})\n` +
        `WAVE SERIAL: ${this.waveSerial}\n` +
        `SECTION B BOUNDS: rows ${this.sectionBData.gridTop}-${this.sectionBData.gridBottom}, cols ${this.sectionBData.gridLeft}-${this.sectionBData.gridRight}\n` +
        `─────────────────────────\n` +
        `COLLISION LOG:`
      );
    });
  }

  private drawGridOverlay() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x00ff00, 0.15);

    const cellSize = this.gridManager.getWorldSize().cellSize;
    const { width, height } = this.cameras.main;

    // Draw vertical grid lines
    for (let col = 0; col * cellSize <= width; col++) {
      const x = col * cellSize;
      graphics.lineBetween(x, 0, x, height);
    }

    // Draw horizontal grid lines
    for (let row = 0; row * cellSize <= height; row++) {
      const y = row * cellSize;
      graphics.lineBetween(0, y, width, y);
    }

    graphics.setDepth(2);
    graphics.setScrollFactor(0);
  }

  private createMockFans() {
    // Create a grid of fans across Section B for testing (simple circles, no actors)
    console.log('[CollisionTestScene] Creating mock fans');
    
    for (let row = this.sectionBData.gridTop; row <= this.sectionBData.gridBottom; row++) {
      for (let col = this.sectionBData.gridLeft; col <= this.sectionBData.gridRight; col += 3) {
        // Draw fan as small circle (red)
        const world = this.gridManager.gridToWorld(row, col);
        if (world) {
          const graphics = this.add.graphics();
          graphics.fillStyle(0xff6666, 1);
          graphics.fillCircle(world.x, world.y, 4);
          graphics.setDepth(this.gridManager.getDepthForPosition(row, col));
          this.fanSprites.push(graphics);
        }
      }
    }
    
    console.log(`[CollisionTestScene] Created ${this.fanSprites.length} mock fan sprites`);
  }

  private createTestVendors() {
    const rowCount = this.sectionBData.gridBottom - this.sectionBData.gridTop + 1;
    console.log(`[CollisionTestScene] Creating ${rowCount} test vendors`);

    for (let i = 0; i < rowCount; i++) {
      const gridRow = this.sectionBData.gridTop + i;
      const gridCol = this.sectionBData.gridLeft + Math.floor((this.sectionBData.gridRight - this.sectionBData.gridLeft) / 2);
      
      const world = this.gridManager.gridToWorld(gridRow, gridCol);
      if (!world) continue;

      // Create simple rectangular vendor sprite (green)
      const sprite = this.add.rectangle(world.x, world.y, 12, 16, 0x00ff00);
      sprite.setDepth(this.gridManager.getDepthForPosition(gridRow, gridCol));

      const vendorPos = { row: gridRow, col: gridCol };
      this.vendorSprites.push(sprite);
      this.vendorPositions.push(vendorPos);

      // Create mock vendor actor for ActorRegistry (so collision detection can find it)
      const vendorId = `test-vendor-${i}`;
      const mockVendor = {
        id: vendorId,
        category: 'vendor',
        type: 'drink',
        // getPosition must return CURRENT world position (updated when vendor moves)
        getPosition: () => this.gridManager.gridToWorld(vendorPos.row, vendorPos.col),
        getBehavior: () => ({
          getPointsEarned: () => 10
        })
      };
      
      // Register with ActorRegistry so FanActor.checkVendorCollision() can find it
      this.actorRegistry.register(mockVendor as any);

      console.log(`[CollisionTestScene] Vendor ${i} (${vendorId}) placed at (${gridRow}, ${gridCol}) with world pos (${world.x}, ${world.y})`);
    }
  }

  private setupKeyboardControls() {
    const keys = this.input.keyboard;
    if (!keys) return;

    // SPACEBAR: Trigger wave
    keys.on('keydown-SPACE', () => {
      if (!this.waveActive) {
        this.triggerTestWave();
      }
    });

    // LEFT: Randomize vendor positions (move left bias)
    keys.on('keydown-LEFT', () => {
      this.repositionVendors('left');
    });

    // RIGHT: Randomize vendor positions (move right bias)
    keys.on('keydown-RIGHT', () => {
      this.repositionVendors('right');
    });

    // R: Reset vendor positions to center
    keys.on('keydown-R', () => {
      this.resetVendorPositions();
    });
  }

  private setupCollisionListener() {
    window.addEventListener('vendorCollision', (e: any) => {
      const d = e.detail || {};
      const fanId = d.fanId;
      
      // Only count each fan once per wave (prevent double-counting)
      if (this.fansCollidedThisWave.has(fanId)) {
        console.log(`[CollisionTestScene] DUPLICATE: Fan ${fanId} already collided this wave, skipping`);
        return;
      }
      
      this.fansCollidedThisWave.add(fanId);
      const message = `Wave ${this.waveSerial} collision: Vendor at (${d.gridRow},${d.gridCol}) near Fan ${d.fanId} at (${d.gridRow},${d.gridCol})`;
      console.log('[CollisionTestScene] ACTUAL:', message);
      this.actualCollisions++;
    });
  }

  private createUI() {
    // Instructions + debug info
    this.debugText = this.add.text(10, 10, 
      'COLLISION TEST PLAYGROUND\n' +
      'SPACEBAR: Trigger wave (left→right)\n' +
      'LEFT/RIGHT: Reposition vendors\n' +
      'R: Reset vendor positions\n' +
      '─────────────────────────\n' +
      'MOUSE: World (?, ?) | Grid (?, ?)\n' +
      `WAVE SERIAL: ${this.waveSerial}\n` +
      `SECTION B BOUNDS: rows ${this.sectionBData.gridTop}-${this.sectionBData.gridBottom}, cols ${this.sectionBData.gridLeft}-${this.sectionBData.gridRight}\n` +
      '─────────────────────────\n' +
      'COLLISION LOG:', {
      fontFamily: 'Courier New',
      fontSize: '11px',
      color: '#00ff00',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: { x: 8, y: 8 }
    });
    this.debugText.setDepth(1000);
    this.debugText.setScrollFactor(0);
  }

  private drawSectionBounds() {
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xffff00, 0.5);

    const topLeft = this.gridManager.gridToWorld(this.sectionBData.gridTop, this.sectionBData.gridLeft);
    const bottomRight = this.gridManager.gridToWorld(this.sectionBData.gridBottom, this.sectionBData.gridRight);

    if (topLeft && bottomRight) {
      const cellSize = this.gridManager.getWorldSize().cellSize;
      graphics.strokeRect(
        topLeft.x - cellSize / 2,
        topLeft.y - cellSize / 2,
        (bottomRight.x - topLeft.x) + cellSize,
        (bottomRight.y - topLeft.y) + cellSize
      );
    }
    graphics.setDepth(5);
  }

  private triggerTestWave() {
    this.waveSerial++;
    this.waveActive = true;
    console.log(`[CollisionTestScene] Triggering test wave ${this.waveSerial}`);
    this.addCollisionLog(`═══ WAVE ${this.waveSerial} STARTED ═══`);

    // Reset collision tracking for this wave
    this.fansCollidedThisWave.clear();

    // Calculate expected collisions based on current vendor-fan proximity
    this.expectedCollisions = this.calculateExpectedCollisions();
    this.actualCollisions = 0;
    console.log(`[CollisionTestScene] EXPECTED COLLISIONS: ${this.expectedCollisions}`);
    this.addCollisionLog(`Expected collisions: ${this.expectedCollisions}`);

    // Reset section collision cooldown
    this.sectionActor.resetCollisionCooldown();

    // Create visual wave (simple rectangle sweeping left to right)
    const topLeft = this.gridManager.gridToWorld(this.sectionBData.gridTop, this.sectionBData.gridLeft);
    const bottomRight = this.gridManager.gridToWorld(this.sectionBData.gridBottom, this.sectionBData.gridRight);

    if (!topLeft || !bottomRight) return;

    const cellSize = this.gridManager.getWorldSize().cellSize;
    this.waveX = topLeft.x - cellSize / 2;
    const waveWidth = 20;

    this.waveGraphics = this.add.graphics();
    this.waveGraphics.setDepth(350);

    // Animate wave across section
    const endX = bottomRight.x + cellSize / 2;
    const duration = 2000; // 2 seconds to cross

    this.tweens.add({
      targets: this,
      waveX: endX,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        if (!this.waveGraphics) return;
        this.waveGraphics.clear();
        this.waveGraphics.fillStyle(0x00aaff, 0.6);
        this.waveGraphics.fillRect(
          this.waveX,
          topLeft.y - cellSize / 2,
          waveWidth,
          bottomRight.y - topLeft.y + cellSize
        );

        // Check collisions as wave passes
        this.checkWaveCollisions();
      },
      onComplete: () => {
        this.waveGraphics?.destroy();
        this.waveGraphics = undefined;
        this.waveActive = false;
        
        // Report collision results
        const resultMsg = `WAVE ${this.waveSerial}: EXPECTED ${this.expectedCollisions}, GOT ${this.actualCollisions}`;
        console.log(`[CollisionTestScene] ${resultMsg}`);
        this.collisionsByWave.set(this.waveSerial, { expected: this.expectedCollisions, actual: this.actualCollisions });
        this.addCollisionLog(resultMsg);
        this.addCollisionLog(`═══ WAVE ${this.waveSerial} COMPLETE ═══\n`);
      }
    });
  }

  private checkWaveCollisions() {
    const waveKey = `${this.waveSerial}:B`;
    const cellSize = this.gridManager.getWorldSize().cellSize;

    // Get all real FanActors from Section B
    const fanActors = this.sectionActor.getFanActors() || [];
    console.log(`[CollisionTestScene] Wave check: ${fanActors.length} real fan actors, ${this.vendorPositions.length} vendors`);

    // Check each vendor if wave front is near them
    this.vendorPositions.forEach((pos, idx) => {
      const world = this.gridManager.gridToWorld(pos.row, pos.col);
      if (!world) return;

      const vendorX = world.x;
      const tolerance = cellSize * 0.7;

      // If wave is passing vendor's column
      if (Math.abs(this.waveX - vendorX) < tolerance) {
        // Check if this vendor has already been processed this wave
        const vendorKey = `${waveKey}:vendor${idx}`;
        if (!(this as any)[vendorKey]) {
          (this as any)[vendorKey] = true;
          
          console.log(`[CollisionTestScene] Wave passing vendor ${idx} at (${pos.row},${pos.col})`);
          
          let collisionsThisVendor = 0;
          const localRadius = gameBalance.waveCollision.localRadius;
          
          // Check each real FanActor for proximity to this vendor
          fanActors.forEach(fanActor => {
            const fanGridPos = (fanActor as any).getGridPosition?.();
            if (!fanGridPos) return;

            const dr = Math.abs(fanGridPos.row - pos.row);
            const dc = Math.abs(fanGridPos.col - pos.col);
            
            if (dr + dc <= localRadius) {
              // This fan is near the vendor - call rollForWaveParticipation
              // which will handle collision detection and emit vendorCollision event if a collision occurs
              const sectionBonus = 0; // No section bonus for test
              const participated = fanActor.rollForWaveParticipation(sectionBonus);
              collisionsThisVendor++;
              console.log(`[CollisionTestScene] Vendor ${idx}: Fan at (${fanGridPos.row},${fanGridPos.col}) participated=${participated}`);
            }
          });
          
          if (collisionsThisVendor > 0) {
            console.log(`[CollisionTestScene] Vendor ${idx}: detected ${collisionsThisVendor} fan(s) in range`);
            // Apply penalties via SectionActor (if collisions occurred, vendors would have emitted events)
            // The actual collision penalties are handled via the vendorCollision event listener
            this.sectionActor.applyCollisionPenalties(waveKey, pos);
          }
        }
      }
    });
  }

  /**
   * Calculate expected collisions by replicating actual collision detection logic
   * Must match FanActor.checkVendorCollision() exactly
   */
  private calculateExpectedCollisions(): number {
    const fanActors = this.sectionActor.getFanActors() || [];
    let expectedCount = 0;
    const detailedLog: string[] = [];
    const VENDOR_WIDTH = 32; // From FanActor.checkVendorCollision()
    const cellSize = this.gridManager.getWorldSize().cellSize;

    // The real collision detection in FanActor checks:
    // 1. Fan and vendor are in same row
    // 2. Vendor horizontally overlaps fan

    // Check each fan
    fanActors.forEach(fanActor => {
      const fanGridPos = (fanActor as any).getGridPosition?.();
      if (!fanGridPos) return;

      const fanWorldPos = this.gridManager.gridToWorld(fanGridPos.row, fanGridPos.col);
      if (!fanWorldPos) return;

      // Fan cell horizontal bounds (centered)
      const fanLeft = fanWorldPos.x - cellSize / 2;
      const fanRight = fanWorldPos.x + cellSize / 2;

      // Check each vendor
      let fanCollides = false;
      this.vendorPositions.forEach((vendorGridPos, vendorIdx) => {
        const vendorWorldPos = this.gridManager.gridToWorld(vendorGridPos.row, vendorGridPos.col);
        if (!vendorWorldPos) return;

        // Check if vendor is in same row
        if (vendorGridPos.row !== fanGridPos.row) return;

        // Vendor horizontal bounding box
        const vendorLeft = vendorWorldPos.x - VENDOR_WIDTH / 2;
        const vendorRight = vendorWorldPos.x + VENDOR_WIDTH / 2;

        // Check for horizontal overlap
        const overlapsHorizontally = vendorLeft < fanRight && vendorRight > fanLeft;

        if (overlapsHorizontally) {
          detailedLog.push(`  ✓ Fan at (${fanGridPos.row},${fanGridPos.col}) OVERLAPS Vendor${vendorIdx} at (${vendorGridPos.row},${vendorGridPos.col})`);
          fanCollides = true;
        }
      });

      if (fanCollides) {
        expectedCount++;
      }
    });

    console.log(`[CollisionTestScene] Expected collision analysis:`);
    detailedLog.forEach(line => console.log(line));
    console.log(`[CollisionTestScene] Total expected: ${expectedCount}`);

    return expectedCount;
  }

  private repositionVendors(direction: 'left' | 'right') {
    const leftBound = this.sectionBData.gridLeft;
    const rightBound = this.sectionBData.gridRight;
    const range = rightBound - leftBound;

    this.vendorPositions.forEach((pos, idx) => {
      // Random position with bias
      let newCol: number;
      if (direction === 'left') {
        newCol = leftBound + Math.floor(Math.random() * (range / 2));
      } else {
        newCol = leftBound + Math.floor(range / 2) + Math.floor(Math.random() * (range / 2));
      }

      const newWorld = this.gridManager.gridToWorld(pos.row, newCol);
      if (!newWorld) return;

      // Update vendor position
      pos.col = newCol;
      this.vendorSprites[idx].setPosition(newWorld.x, newWorld.y);
      this.vendorSprites[idx].setDepth(this.gridManager.getDepthForPosition(pos.row, newCol));

      console.log(`[CollisionTestScene] Vendor ${idx} moved to (${pos.row}, ${newCol})`);
    });

    // Recalculate and report expected collisions
    const newExpected = this.calculateExpectedCollisions();
    const msg = `Vendors repositioned (${direction}) - Expected collisions: ${newExpected}`;
    console.log(`[CollisionTestScene] ${msg}`);
    this.addCollisionLog(msg);
  }

  private resetVendorPositions() {
    const centerCol = this.sectionBData.gridLeft + Math.floor((this.sectionBData.gridRight - this.sectionBData.gridLeft) / 2);

    this.vendorPositions.forEach((pos, idx) => {
      const newWorld = this.gridManager.gridToWorld(pos.row, centerCol);
      if (!newWorld) return;

      pos.col = centerCol;
      this.vendorSprites[idx].setPosition(newWorld.x, newWorld.y);
      this.vendorSprites[idx].setDepth(this.gridManager.getDepthForPosition(pos.row, centerCol));
    });

    // Recalculate and report expected collisions
    const newExpected = this.calculateExpectedCollisions();
    const msg = `Vendors reset to center - Expected collisions: ${newExpected}`;
    console.log(`[CollisionTestScene] ${msg}`);
    this.addCollisionLog(msg);    this.addCollisionLog('Vendors reset to center');
  }

  private addCollisionLog(message: string) {
    const y = 200 + this.collisionLog.length * 14;
    const logText = this.add.text(10, y, message, {
      fontFamily: 'Courier New',
      fontSize: '10px',
      color: '#ffff00',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 4, y: 1 }
    });
    logText.setDepth(1000);
    logText.setScrollFactor(0);

    this.collisionLog.push(logText);

    // Keep only last 15 messages
    if (this.collisionLog.length > 15) {
      const removed = this.collisionLog.shift();
      removed?.destroy();
      // Reposition remaining
      this.collisionLog.forEach((text, idx) => {
        text.setY(200 + idx * 14);
      });
    }
  }

  update(_time: number, _delta: number) {
    // Minimal update loop
  }
}
