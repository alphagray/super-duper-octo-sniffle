import type { GameStateManager } from './GameStateManager';
import type { VendorProfile, VendorState, VendorType, VendorQualityTier, VendorAbilities, GridPathCell } from '@/managers/interfaces/VendorTypes';
import type { Fan } from '@/sprites/Fan'; // Visual only; stat access removed
import type { StadiumSection } from '@/sprites/StadiumSection';
import type { GridManager } from './GridManager';
import { gameBalance } from '@/config/gameBalance';
import { PathfindingService } from '@/services/PathfindingService';
import type { ActorRegistry } from '@/actors/base/ActorRegistry';
import { DrinkVendorActor } from '@/actors/DrinkVendorActor';
import { DrinkVendorBehavior } from '@/actors/behaviors/DrinkVendorBehavior';
import { Vendor } from '@/sprites/Vendor';

/**
 * Represents a legacy vendor in the stadium (deprecated)
 * @deprecated Use VendorProfile and VendorInstance instead
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
 * Runtime vendor instance with profile and state
 * @deprecated Use DrinkVendorActor with DrinkVendorBehavior instead
 */
export interface VendorInstance {
  profile: VendorProfile;
  state: VendorState;
  position: { x: number; y: number };
  // Note: currentPath is now stored on VendorActor itself, not here
  targetFan?: Fan;
  targetPosition?: { sectionIdx: number; rowIdx: number; colIdx: number };
  assignedSectionIdx?: number; // Restrict targeting to a specific section when set
  scanTimer: number; // ms until next scan attempt
  stateTimer: number; // generic timer for state-specific durations
  distractionCheckTimer: number;
  attentionAuraActive: boolean;
  lastServiceTime: number;
}

/**
 * AIManager: Manages all AI-driven actors in the stadium
 * Handles vendors, mascots, and future AI entities
 * Coordinates with GridManager for pathfinding and spatial queries
 */
export class AIManager {
  private vendors: Map<number, VendorInstance>; // @deprecated Legacy instances
  private vendorActors: Map<number, DrinkVendorActor> = new Map(); // New actor-based vendors
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
    this.vendors = new Map();
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
   */
  public getVendorActors(): Map<number, DrinkVendorActor> {
    return this.vendorActors;
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
   * @param vendorSprite The Phaser vendor sprite to wrap
   * @param type Vendor type ('drink' or 'rangedAoE')
   * @param quality Quality tier
   * @returns Object containing the vendor actor and profile ID
   */
  public spawnVendor(
    vendorSprite: Vendor,
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
    
    // Create vendor actor
    const vendorActor = new DrinkVendorActor(
      actorId,
      vendorSprite,
      behavior,
      'vendor',
      false // Disable logging for now
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

    for (let i = 0; i < vendorCount; i++) {
      const profile = this.createVendor(vendorType, vendorQuality);
      
      // Create vendor instance
      const instance: VendorInstance = {
        profile,
        state: 'idle',
        position: { x: 0, y: 0 }, // will be set when placed
        scanTimer: 0,
        stateTimer: 0,
        distractionCheckTimer: 0,
        attentionAuraActive: false,
        lastServiceTime: 0,
      };

      this.vendors.set(profile.id, instance);
      
      // Emit vendor spawned event
      this.emit('vendorSpawned', { vendorId: profile.id, profile });
    }
  }

  /**
   * Get all vendor instances
   * @returns Map of vendor instances by ID
   */
  public getVendorInstances(): Map<number, VendorInstance> {
    return this.vendors;
  }

  /**
   * Get specific vendor instance
   * @param id Vendor ID
   * @returns Vendor instance or undefined
   */
  public getVendorInstance(id: number): VendorInstance | undefined {
    return this.vendors.get(id);
  }

  /**
   * Assign vendor to a specific section (index in sections array)
   * Clears current target and forces reselection next update
   */
  public assignVendorToSection(vendorId: number, sectionIdx: number): void {
    const instance = this.vendors.get(vendorId);
    if (!instance) {
      console.warn(`[AIManager] Cannot assign unknown vendor ${vendorId}`);
      return;
    }
    
    if (sectionIdx < 0 || sectionIdx >= this.sections.length) {
      console.warn(`[AIManager] Invalid section index ${sectionIdx}`);
      return;
    }
    
    instance.assignedSectionIdx = sectionIdx;
    instance.targetFan = undefined;
    instance.targetPosition = undefined;
    // TODO: Path management now handled by VendorActor, not VendorInstance
    instance.state = 'idle'; // ensure target selection occurs
    instance.scanTimer = 0; // force immediate scan
    console.log(`[AIManager] Vendor ${vendorId} assigned to section ${sectionIdx}`);
    this.emit('vendorSectionAssigned', { vendorId, sectionIdx });
  }

  /**
   * Select next drink target for a vendor
   * @deprecated Use DrinkVendorBehavior.selectTarget() directly
   * @param vendorId Vendor ID
   * @returns Target fan or null if none found
   */
  public selectNextDrinkTarget(vendorId: number): { fan: Fan; sectionIdx: number; rowIdx: number; colIdx: number } | null {
    // Delegate to wrapper which uses behavior system
    return this.selectNextDrinkTargetWrapper(vendorId);
  }

  /**
   * Select next drink target for a vendor (wrapper)
   * @deprecated Use DrinkVendorBehavior.selectTarget() directly
   * @param vendorId Vendor ID
   * @returns Target fan or null if none found
   */
  public selectNextDrinkTargetWrapper(vendorId: number): { fan: Fan; sectionIdx: number; rowIdx: number; colIdx: number } | null {
    const instance = this.vendors.get(vendorId);
    if (!instance) return null;

    // Get vendor actor and delegate to behavior if available
    const vendorActor = this.actorRegistry?.get(`actor:vendor-${vendorId}`) as any; // VendorActor
    if (vendorActor && vendorActor.getBehavior && vendorActor.getBehavior()) {
      const behavior = vendorActor.getBehavior();
      if ('selectTarget' in behavior) {
        const target = behavior.selectTarget();
        if (target) {
          return {
            fan: target.fan,
            sectionIdx: target.sectionIdx,
            rowIdx: target.rowIdx,
            colIdx: target.colIdx
          };
        }
      }
    }

    return null;
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
   * Update method (deprecated - actors update themselves via ActorRegistry)
   * @deprecated Vendors now update autonomously via DrinkVendorActor.update()
   * @param deltaTime Time elapsed in milliseconds
   */
  public update(deltaTime: number): void {
    // Note: New vendor actors update themselves via ActorRegistry.update()
    // No manager orchestration needed - actors are fully autonomous
    
    // Update legacy vendors for backward compatibility only
    for (const vendor of this.legacyVendors) {
      if (vendor.isServing) {
        vendor.serviceTimer -= deltaTime;

        if (vendor.serviceTimer <= 0) {
          this.gameState.vendorServe(vendor.currentSection!);
          const completedSection = vendor.currentSection;
          vendor.isServing = false;
          vendor.currentSection = null;
          this.emit('serviceComplete', {
            vendorId: vendor.id,
            section: completedSection,
          });
        }
      }
    }
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
