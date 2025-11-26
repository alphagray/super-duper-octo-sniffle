import type { GameStateManager } from './GameStateManager';
import type { VendorProfile, VendorState, VendorType, VendorQualityTier, VendorAbilities, GridPathCell } from '@/managers/interfaces/VendorTypes';
import type { Fan } from '@/sprites/Fan'; // Visual only; stat access removed
import type { StadiumSection } from '@/sprites/StadiumSection';
import type { GridManager } from './GridManager';
import { gameBalance } from '@/config/gameBalance';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
import type { Actor } from '@/actors/base/Actor';
import { FanActor } from '@/actors/FanActor';
import { VendorActor } from '@/actors/VendorActor';
import { PathfindingService } from '@/services/PathfindingService';
import type { ActorRegistry } from '@/actors/base/ActorRegistry';
import { DrinkVendorActor } from '@/actors/DrinkVendorActor';
import { MascotActor } from '@/actors/MascotActor';
import { DrinkVendorBehavior } from '@/actors/behaviors/DrinkVendorBehavior';
import { Vendor } from '@/sprites/Vendor';

/**
 * Represents a legacy vendor in the stadium (deprecated)
 * @deprecated Use DrinkVendorActor with DrinkVendorBehavior instead
 */
export interface LegacyVendor {
  /** Unique identifier for the vendor */
  id: number;
  /** Current section the vendor is serving (null if not serving) */
  currentSection: string | null;
  /** Whether the vendor is currently serving */
  isServing: boolean;
  /** Cooldown timer before vendor can serve again */
  cooldown: number;
  /** Service timer tracking how long the vendor has been serving */
  serviceTimer: number;
}

/**
 * AIManager: Manages all AI-driven actors in the stadium
 * Handles vendors, mascots, and future AI entities
 * Coordinates with GridManager for pathfinding and spatial queries
 */
export class AIManager {
  private vendorActors: Map<number, DrinkVendorActor> = new Map(); // Actor-based vendors
  private mascotActors: MascotActor[] = []; // Supports one or many mascots
  private legacyVendors: LegacyVendor[]; // backward compatibility
  private gameState: GameStateManager;
  private eventListeners: Map<string, Array<Function>>;
  private pathfindingService?: PathfindingService;
  private sections: StadiumSection[]; // @deprecated Use sectionActors
  private sectionActors: any[] = []; // SectionActor[] (avoiding circular import)
  private gridManager?: GridManager;
  private actorRegistry?: ActorRegistry;
  private nextVendorId: number = 0;

  /**
   * Creates a new VendorManager instance
   * @param gameState - The GameStateManager instance to use for vendor actions
   * @param vendorCount - The number of legacy vendors to create (default: 2, deprecated)
   * @param gridManager - Optional GridManager for grid-based pathfinding
   * @param actorRegistry - Optional ActorRegistry for stairs/navigation data
   */
  constructor(gameState: GameStateManager, vendorCount: number = 2, gridManager?: GridManager, actorRegistry?: ActorRegistry) {
    this.gameState = gameState;
    this.gridManager = gridManager;
    this.actorRegistry = actorRegistry;
    this.eventListeners = new Map();
    this.legacyVendors = [];
    this.sections = [];

    // Initialize legacy vendors for backward compatibility
    // Note: These are deprecated and not used by the new vendor system
    for (let i = 0; i < vendorCount; i++) {
      this.legacyVendors.push({
        id: i,
        currentSection: null,
        isServing: false,
        cooldown: 0,
        serviceTimer: 0,
      });
    }
    // New vendor system starts IDs from 0
    this.nextVendorId = 0;
  }

  /**
   * Initialize sections for vendor pathfinding
   * @param sections Array of StadiumSection objects
   * @deprecated Use setSectionActors instead
   */
  public initializeSections(sections: StadiumSection[]): void {
    this.sections = sections;
  }

  /**
   * Set SectionActor instances for actor-based access
   * @param sectionActors Array of SectionActor instances
   */
  public setSectionActors(sectionActors: any[]): void {
    this.sectionActors = sectionActors;
  }

  /**
   * Get SectionActor array (for behaviors)
   */
  public getSectionActors(): any[] {
    return this.sectionActors;
  }

  /**
   * Get all vendor actors
   * @returns Map of vendor ID to VendorActor
   */
  public getVendorActors(): Map<number, DrinkVendorActor> {
    return this.vendorActors;
  }

  /**
   * Get vendor actor by ID
   * @param id Vendor ID
   * @returns VendorActor or undefined
   */
  public getVendorActor(id: number): DrinkVendorActor | undefined {
    return this.vendorActors.get(id);
  }

  /**
   * Get all mascot actors (may be 0..N, currently typically 1)
   */
  public getMascotActors(): MascotActor[] {
    return this.mascotActors;
  }

  /**
   * Get pathfinding service for external access (e.g., GridOverlay debug visualization)
   */
  public getPathfindingService(): PathfindingService | undefined {
    return this.pathfindingService;
  }

  /**
   * Attach an externally managed PathfindingService instance.
   */
  public attachPathfindingService(service: PathfindingService): void {
    this.pathfindingService = service;
    console.log('[AIManager] PathfindingService attached');
  }

  /**
   * Register a mascot actor with the AIManager.
   * Event-lite: no emitted event, just stored for update integration.
   */
  public registerMascot(actor: MascotActor): void {
    this.mascotActors.push(actor);
  }

  /**
   * Create a new vendor with specified profile
   * @param type Vendor type ('drink' or 'rangedAoE')
   * @param quality Quality tier
   * @param customAbilities Optional custom ability overrides
   * @returns Vendor profile
   */
  public createVendor(
    type: VendorType = 'drink',
    quality: VendorQualityTier = 'good',
    customAbilities?: Partial<VendorAbilities>
  ): VendorProfile {
    const id = this.nextVendorId++;
    
    // Default abilities based on vendor type
    const defaultAbilities: VendorAbilities = type === 'drink' 
      ? {
          ignoreRowPenalty: false,
          ignoreGrumpPenalty: false,
          canEnterRows: true,
          rangedOnly: false,
        }
      : {
          ignoreRowPenalty: true, // ranged vendors don't enter rows
          ignoreGrumpPenalty: true,
          canEnterRows: false,
          rangedOnly: true,
        };

    const abilities = { ...defaultAbilities, ...customAbilities };

    const profile: VendorProfile = {
      id,
      type,
      qualityTier: quality,
      abilities,
      aoeRadius: type === 'rangedAoE' ? gameBalance.vendorTypes.rangedAoE.baseRadius : undefined,
    };

    return profile;
  }

  /**
   * Spawn a vendor actor with behavior
   * @param scene The Phaser scene to create the vendor sprite in
   * @param x X position for the vendor
   * @param y Y position for the vendor
   * @param type Vendor type ('drink' or 'rangedAoE')
   * @param quality Quality tier
   * @returns Object containing the vendor actor and profile ID
   */
  public spawnVendor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    type: VendorType = 'drink',
    quality: VendorQualityTier = 'good'
  ): { actor: DrinkVendorActor; id: number } {
    const profile = this.createVendor(type, quality);
    const actorId = `actor:vendor-${profile.id}`;
    
    // Create behavior with dependencies
    const behavior = new DrinkVendorBehavior(
      null as any, // Will set vendor actor reference after creation
      this,
      this.gridManager!,
      this.actorRegistry!,
      this.pathfindingService
    );
    
    // Create vendor actor (now creates its own sprite)
    const vendorActor = new DrinkVendorActor(
      actorId,
      scene,
      x,
      y,
      behavior,
      'vendor',
      false, // Disable logging for now
      this.gridManager
    );
    
    // Set circular reference in behavior
    (behavior as any).vendorActor = vendorActor;
    
    // Register actor
    this.actorRegistry?.register(vendorActor);
    this.vendorActors.set(profile.id, vendorActor);
    
    console.log(`[AIManager] Spawned vendor ${profile.id} as actor ${actorId}`);
    
    return { actor: vendorActor, id: profile.id };
  }

  /**
   * Spawn initial vendors for a session
   * @param count Number of vendors to spawn
   * @param type Vendor type (default: from sessionDefaults)
   * @param quality Quality tier (default: from sessionDefaults)
   */
  public spawnInitialVendors(
    count?: number,
    type?: VendorType,
    quality?: VendorQualityTier
  ): void {
    const vendorCount = count ?? gameBalance.sessionDefaults.initialVendorCount;
    const vendorType = type ?? gameBalance.sessionDefaults.initialVendorType;
    const vendorQuality = quality ?? gameBalance.sessionDefaults.initialVendorQuality;

    // Note: Logging controlled by scene's logVendorEvents flag via events
    // Vendor profiles created, actors instantiated when sprites spawned via spawnVendor()

    for (let i = 0; i < vendorCount; i++) {
      const profile = this.createVendor(vendorType, vendorQuality);
      // Emit vendor spawned event for scene to create sprite + actor
      this.emit('vendorSpawned', { vendorId: profile.id, profile });
    }
  }

  /**
   * Assign vendor to a specific section (player-driven)
   * Delegates to vendor behavior for autonomous execution
   * @param vendorId Vendor ID
   * @param sectionIdx Section index (0-based)
   * @param seatRow Optional target seat row (for initial pathfinding)
   * @param seatCol Optional target seat col (for initial pathfinding)
   */
  public assignVendorToSection(vendorId: number, sectionIdx: number, seatRow?: number, seatCol?: number): void {
    // Check if vendor actor exists in new system
    const vendorActor = this.vendorActors.get(vendorId);
    if (!vendorActor) {
      console.warn(`[AIManager] Cannot assign unknown vendor ${vendorId}`);
      return;
    }
    
    if (sectionIdx < 0 || sectionIdx >= this.sectionActors.length) {
      console.warn(`[AIManager] Invalid section index ${sectionIdx}`);
      return;
    }
    
    // Delegate to behavior
    const behavior = vendorActor.getBehavior() as DrinkVendorBehavior;
    if (!behavior || !('assignToSection' in behavior)) {
      console.warn(`[AIManager] Vendor ${vendorId} behavior missing assignToSection method`);
      return;
    }
    
    // Delegate assignment to behavior (handles state transition, cooldown, pathfinding)
    behavior.assignToSection(sectionIdx);
    
    console.log(`[AIManager] Vendor ${vendorId} assigned to section ${sectionIdx}`);
    this.emit('vendorAssigned', { vendorId, sectionIdx });
  }
  
  /**
   * Check if vendor is on cooldown (cannot be reassigned)
   * @param vendorId Vendor ID
   * @returns true if on cooldown
   */
  public isVendorOnCooldown(vendorId: number): boolean {
    const vendorActor = this.vendorActors.get(vendorId);
    if (!vendorActor) return false;
    
    const behavior = vendorActor.getBehavior() as DrinkVendorBehavior;
    if (!behavior || !('getCooldownTimer' in behavior)) return false;
    
    return behavior.getCooldownTimer() > 0;
  }
  
  /**
   * Get remaining cooldown time for vendor
   * @param vendorId Vendor ID
   * @returns Remaining cooldown in milliseconds
   */
  public getVendorCooldownRemaining(vendorId: number): number {
    const vendorActor = this.vendorActors.get(vendorId);
    if (!vendorActor) return 0;
    
    const behavior = vendorActor.getBehavior() as DrinkVendorBehavior;
    if (!behavior || !('getCooldownTimer' in behavior)) return 0;
    
    return Math.max(0, behavior.getCooldownTimer());
  }



  /**
   * Advance vendor movement along current path
   * @deprecated Movement is now handled by VendorActor.updateMovement()
   * @param vendorId Vendor ID
   * @param deltaTime Time elapsed in milliseconds
   */
  public advanceMovement(vendorId: number, deltaTime: number): void {
    // Movement is now handled by VendorActor instances
    // This stub remains for backward compatibility
  }

  /**
   * Serve a fan with drink
   * @deprecated Service is now handled directly by DrinkVendorBehavior
   * @param vendorId Vendor ID
   * @param fan Fan to serve (deprecated, use targetPosition instead)
   */
  public serveFan(vendorId: number, fan: Fan): void {
    // Service is now handled directly by behaviors
    // This stub remains for backward compatibility
    console.log(`[AIManager] serveFan called (deprecated) - service handled by behavior`);
  }

  /**
   * Returns all legacy vendors
   * @returns Array of all vendors
   * @deprecated Use getVendorActors instead
   */
  public getVendors(): LegacyVendor[] {
    return this.legacyVendors;
  }

  /**
   * Returns a specific legacy vendor by id
   * @param id - The vendor identifier
   * @returns The vendor object
   * @throws Error if vendor not found
   * @deprecated Use getVendorActor instead
   */
  public getVendor(id: number): LegacyVendor {
    const vendor = this.legacyVendors.find((v) => v.id === id);
    if (!vendor) {
      throw new Error(`Vendor ${id} not found`);
    }
    return vendor;
  }

  /**
   * Places a vendor in a specific section to begin serving
   * @param vendorId - The vendor identifier
   * @param sectionId - The section identifier (A, B, or C)
   * @returns true if vendor was placed successfully, false if on cooldown
   */
  public placeVendor(vendorId: number, sectionId: string): boolean {
    const vendor = this.getVendor(vendorId);

    // Check if vendor is on cooldown or already serving
    if (vendor.cooldown > 0 || vendor.isServing) {
      return false;
    }

    // Place vendor in section
    vendor.currentSection = sectionId;
    vendor.isServing = true;
    vendor.serviceTimer = 2000; // 2 seconds

    // Emit vendorPlaced event
    this.emit('vendorPlaced', { vendorId, section: sectionId });

    return true;
  }

  /**
   * Universal actor update orchestrator (category-ordered).
   * Scenery → Utility → Fans → Vendors → Mascots, then orchestration.
   */
  /**
   * Universal actor update orchestrator
   * Handles category-ordered updates: scenery → utility → fans → vendors → mascots
   * Then performs cross-actor orchestration logic
   * @param deltaTime - Time elapsed in milliseconds
   * @param scene - Phaser scene (passed to actors for time.now access)
   */
  public update(deltaTime: number, scene?: Phaser.Scene): void {
    // 1. Scenery (SectionActor updates all fans + aggregates)
    this.updateSceneryActors(deltaTime, scene);

    // 2. Utility actors (e.g., zones, waypoints)
    this.updateUtilityActors(deltaTime);

    // 3. Fans (no direct updates - handled by sections in step 1)
    // Skip updateFanActors since sections handle them

    // 4. Vendors (behavior tick + movement handled by VendorActor)
    this.updateVendorActors(deltaTime);

    // 5. Mascots (behavior tick)
    this.updateMascotActors(deltaTime);

    // 6. Orchestration logic across actors
    this.handleVendorCollisions();
    this.balanceVendorDistribution();
    this.checkMascotVendorInterference();

    // Backward compatibility: update legacy vendors if any remain
    for (const vendor of this.legacyVendors) {
      if (vendor.isServing) {
        vendor.serviceTimer -= deltaTime;
        if (vendor.serviceTimer <= 0) {
          this.gameState.vendorServe(vendor.currentSection!);
          const completedSection = vendor.currentSection;
          vendor.isServing = false;
          vendor.currentSection = null;
          this.emit('serviceComplete', { vendorId: vendor.id, section: completedSection });
        }
      }
    }
  }

  /** Update scenery actors (sections drive fan updates/aggregates) */
  private updateSceneryActors(deltaTime: number, scene?: Phaser.Scene): void {
    if (!this.actorRegistry) return;
    const sections = this.actorRegistry.getByCategory('section' as ActorCategory);
    for (const actor of sections) {
      // Get environmental modifier for this section
      const sectionId = (actor as any).data?.get('sectionId') || 'A';
      const envModifier = this.gameState.getEnvironmentalModifier(sectionId);
      (actor as any).update(deltaTime, scene, envModifier);
    }
  }

  /** Update utility actors */
  private updateUtilityActors(deltaTime: number): void {
    if (!this.actorRegistry) return;
    const utilities = this.actorRegistry.getByCategory('utility' as ActorCategory);
    for (const actor of utilities) {
      actor.update(deltaTime);
    }
  }

  /** Update fan actors (skip - handled by sections) */
  private updateFanActors(deltaTime: number): void {
    // Fans are updated by their parent SectionActors
    // This method kept for future direct fan updates if needed
  }

  /** Update vendor actors */
  private updateVendorActors(deltaTime: number): void {
    if (!this.actorRegistry) return;
    const vendors = this.actorRegistry.getByCategory('vendor' as ActorCategory) as VendorActor[];
    for (const vendor of vendors) {
      vendor.update(deltaTime);
    }
  }

  /** Update mascot actors */
  private updateMascotActors(deltaTime: number): void {
    // Use registered mascotActors list directly (avoids unsafe casts)
    for (const mascot of this.mascotActors) {
      mascot.update(deltaTime);
      mascot.draw();
    }
  }

  /** Cross-actor: simple collision avoidance between vendors (stub) */
  private handleVendorCollisions(): void {
    // TODO: Implement proximity checks and path re-routing
  }

  /** Cross-actor: balance vendor distribution across sections (stub) */
  private balanceVendorDistribution(): void {
    // TODO: Implement section counts and reassign if imbalanced
  }

  /** Cross-actor: mascot interference with nearby vendors (stub) */
  private checkMascotVendorInterference(): void {
    // TODO: Implement distraction effects based on proximity
  }

  /** Handle wave success (migrate from Scene) */
  public handleWaveSuccess(data: any): void {
    // Update momentum for vendor/mascot behaviors
    for (const [, vendorActor] of this.vendorActors) {
      const behavior = (vendorActor as any).getBehavior?.();
      behavior?.onWaveSuccess?.();
    }
    for (const mascot of this.mascotActors) {
      (mascot as any).getBehavior?.().onWaveSuccess?.();
    }
    this.emit('waveSuccessProcessed', data);
  }

  /** Handle wave failure (migrate from Scene) */
  public handleWaveFail(data: any): void {
    for (const [, vendorActor] of this.vendorActors) {
      const behavior = (vendorActor as any).getBehavior?.();
      behavior?.onWaveFailure?.();
    }
    for (const mascot of this.mascotActors) {
      (mascot as any).getBehavior?.().onWaveFailure?.();
    }
    this.emit('waveFailProcessed', data);
  }

  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Emits an event to all registered listeners
   * @param event - The event name
   * @param data - The event data to pass to listeners
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }
}
