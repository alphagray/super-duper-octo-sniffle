import type { GameStateManager } from './GameStateManager';
import type { VendorProfile, VendorState, VendorType, VendorQualityTier, VendorAbilities, PathSegment } from '@/types/GameTypes';
import type { Fan } from '@/sprites/Fan';
import type { StadiumSection } from '@/sprites/StadiumSection';
import type { GridManager } from './GridManager';
import { gameBalance } from '@/config/gameBalance';
import { HybridPathResolver } from './HybridPathResolver';

/**
 * Represents a legacy vendor in the stadium (deprecated)
 * @deprecated Use VendorProfile and VendorInstance instead
 */
export interface Vendor {
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
 */
export interface VendorInstance {
  profile: VendorProfile;
  state: VendorState;
  position: { x: number; y: number };
  currentPath?: PathSegment[];
  currentSegmentIndex: number;
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
 * Manages vendors in the stadium including placement, service timing, pathfinding, and targeting
 * Supports profile-based vendor system with quality tiers and multiple vendor types
 */
export class VendorManager {
  private vendors: Map<number, VendorInstance>;
  private legacyVendors: Vendor[]; // backward compatibility
  private gameState: GameStateManager;
  private eventListeners: Map<string, Array<Function>>;
  private pathResolver?: HybridPathResolver;
  private sections: StadiumSection[];
  private gridManager?: GridManager;
  private nextVendorId: number = 0;

  /**
   * Creates a new VendorManager instance
   * @param gameState - The GameStateManager instance to use for vendor actions
   * @param vendorCount - The number of legacy vendors to create (default: 2, deprecated)
   * @param gridManager - Optional GridManager for grid-based pathfinding
   */
  constructor(gameState: GameStateManager, vendorCount: number = 2, gridManager?: GridManager) {
    this.gameState = gameState;
    this.gridManager = gridManager;
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
   */
  public initializeSections(sections: StadiumSection[]): void {
    this.sections = sections;
    this.pathResolver = new HybridPathResolver(sections, this.gridManager);
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
        currentSegmentIndex: 0,
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
    if (!instance) return;
    instance.assignedSectionIdx = sectionIdx;
    instance.targetFan = undefined;
    instance.targetPosition = undefined;
    instance.state = 'idle'; // ensure target selection occurs
    instance.scanTimer = 0; // force immediate scan
    this.emit('vendorSectionAssigned', { vendorId, sectionIdx });
  }

  /**
   * Select next drink target for a vendor
   * Scans all sections for thirsty fans above decay threshold
   * @param vendorId Vendor ID
   * @returns Target fan or null if none found
   */
  public selectNextDrinkTarget(vendorId: number): { fan: Fan; sectionIdx: number; rowIdx: number; colIdx: number } | null {
    const instance = this.vendors.get(vendorId);
    if (!instance || !this.pathResolver) return null;

    const thirstThreshold = gameBalance.waveAutonomous.thirstHappinessDecayThreshold;
    const candidates: Array<{ fan: Fan; sectionIdx: number; rowIdx: number; colIdx: number; x: number; y: number }> = [];

    // Scan sections; if vendor has assignment restrict to that section
    for (let sIdx = 0; sIdx < this.sections.length; sIdx++) {
      if (instance.assignedSectionIdx !== undefined && instance.assignedSectionIdx !== sIdx) {
        continue;
      }
      const section = this.sections[sIdx];
      const rows = section.getRows();
      
      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const seats = row.getSeats();
        
        for (let cIdx = 0; cIdx < seats.length; cIdx++) {
          const seat = seats[cIdx];
          if (!seat.isEmpty()) {
            const fan = seat.getFan();
            if (fan && fan.getThirst() > thirstThreshold) {
              const pos = seat.getPosition();
              candidates.push({
                fan,
                sectionIdx: sIdx,
                rowIdx: rIdx,
                colIdx: cIdx,
                x: pos.x + section.x,
                y: pos.y + section.y,
              });
            }
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Score candidates using path resolver
    const scores = this.pathResolver.scoreTargets(
      instance.profile,
      instance.position.x,
      instance.position.y,
      candidates
    );

    if (scores.length === 0) return null;

    // Return highest-scoring target
    const best = scores[0];
    return {
      fan: best.fan,
      sectionIdx: best.sectionIdx,
      rowIdx: best.rowIdx,
      colIdx: best.colIdx,
    };
  }

  /**
   * Advance vendor movement along current path
   * @param vendorId Vendor ID
   * @param deltaTime Time elapsed in milliseconds
   */
  public advanceMovement(vendorId: number, deltaTime: number): void {
    const instance = this.vendors.get(vendorId);
    if (!instance || instance.state !== 'movingSegment' || !instance.currentPath) return;

    const currentSegment = instance.currentPath[instance.currentSegmentIndex];
    if (!currentSegment) return;

    // Calculate movement speed based on segment type and vendor quality
    const speedModifiers = {
      corridor: gameBalance.vendorMovement.baseSpeedCorridor,
      stair: gameBalance.vendorMovement.baseSpeedStair,
      rowEntry: gameBalance.vendorMovement.baseSpeedRow,
      seat: gameBalance.vendorMovement.baseSpeedRow,
    };

    const baseSpeed = speedModifiers[currentSegment.nodeType];
    const qualityConfig = gameBalance.vendorQuality[instance.profile.qualityTier];
    const effectiveSpeed = baseSpeed * qualityConfig.efficiencyModifier;

    // Simple linear interpolation toward target (pixels per second)
    const deltaSeconds = deltaTime / 1000;
    const moveDistance = effectiveSpeed * deltaSeconds;

    const dx = currentSegment.x - instance.position.x;
    const dy = currentSegment.y - instance.position.y;
    const distanceToTarget = Math.sqrt(dx * dx + dy * dy);

    if (distanceToTarget <= moveDistance) {
      // Reached segment target
      instance.position.x = currentSegment.x;
      instance.position.y = currentSegment.y;
      instance.currentSegmentIndex++;

      // Check if path complete
      if (instance.currentSegmentIndex >= instance.currentPath.length) {
        // Reached final destination
        instance.state = 'serving';
        instance.stateTimer = gameBalance.vendorTypes.drink.serviceTime;
        this.emit('vendorReachedTarget', { vendorId, position: instance.position });
      }
    } else {
      // Move toward segment target
      const moveRatio = moveDistance / distanceToTarget;
      instance.position.x += dx * moveRatio;
      instance.position.y += dy * moveRatio;
    }
  }

  /**
   * Serve a fan with drink
   * @param vendorId Vendor ID
   * @param fan Fan to serve
   */
  public serveFan(vendorId: number, fan: Fan): void {
    const instance = this.vendors.get(vendorId);
    if (!instance) return;

    // Call fan's drinkServed method
    fan.drinkServed();

    // Transition to cooldown
    instance.state = 'cooldown';
    instance.stateTimer = gameBalance.vendorTypes.drink.serviceTime; // reuse as cooldown
    instance.lastServiceTime = Date.now();
    instance.targetFan = undefined;
    instance.currentPath = undefined;
    instance.currentSegmentIndex = 0;

    // Emit service complete event
    this.emit('serviceComplete', { vendorId, fanServed: true });
  }

  /**
   * Returns all legacy vendors
   * @returns Array of all vendors
   * @deprecated Use getVendorInstances instead
   */
  public getVendors(): Vendor[] {
    return this.legacyVendors;
  }

  /**
   * Returns a specific legacy vendor by id
   * @param id - The vendor identifier
   * @returns The vendor object
   * @throws Error if vendor not found
   * @deprecated Use getVendorInstance instead
   */
  public getVendor(id: number): Vendor {
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
   * Updates all vendors based on time elapsed
   * Handles state machine transitions, movement, serving, and cooldowns
   * @param deltaTime - Time elapsed in milliseconds
   */
  public update(deltaTime: number): void {
    // Update new profile-based vendors
    for (const [vendorId, instance] of this.vendors) {
      // Update state timers
      if (instance.stateTimer > 0) {
        instance.stateTimer -= deltaTime;
      }

      instance.distractionCheckTimer -= deltaTime;

      // State machine
      switch (instance.state) {
        case 'idle':
          // Attempt scan when timer elapses
          instance.scanTimer -= deltaTime;
          if (instance.scanTimer <= 0) {
            this.emit('vendorScanAttempt', { vendorId, assignedSectionIdx: instance.assignedSectionIdx });
            if (instance.profile.type === 'drink') {
              const target = this.selectNextDrinkTarget(vendorId);
              if (target) {
                instance.targetFan = target.fan;
                instance.targetPosition = {
                  sectionIdx: target.sectionIdx,
                  rowIdx: target.rowIdx,
                  colIdx: target.colIdx,
                };
                this.emit('vendorTargetSelected', { vendorId, sectionIdx: target.sectionIdx, rowIdx: target.rowIdx, colIdx: target.colIdx });
                instance.state = 'planning';
              } else {
                this.emit('vendorNoTarget', { vendorId, assignedSectionIdx: instance.assignedSectionIdx });
                // schedule next scan
                instance.scanTimer = 1000; // 1s until next attempt
              }
            }
          }
          break;

        case 'planning':
          // Plan path to target (stub for now)
          instance.state = 'movingSegment';
          // TODO: Use pathResolver to generate currentPath
          break;

        case 'movingSegment':
          this.advanceMovement(vendorId, deltaTime);
          break;

        case 'serving':
          if (instance.stateTimer <= 0 && instance.targetFan) {
            this.serveFan(vendorId, instance.targetFan);
          }
          break;

        case 'cooldown':
          if (instance.stateTimer <= 0) {
            instance.state = 'idle';
          }
          break;

        case 'distracted':
          if (instance.stateTimer <= 0) {
            instance.state = 'idle';
          }
          break;

        case 'rangedCharging':
          // TODO: Implement ranged vendor charging
          break;
      }

      // Check for distraction (quality-based)
      // TODO: Re-enable once pathfinding is implemented
      /*
      if (instance.distractionCheckTimer <= 0) {
        instance.distractionCheckTimer = gameBalance.vendorQuality.distractionCheckInterval;
        const qualityConfig = gameBalance.vendorQuality[instance.profile.qualityTier];
        
        if (Math.random() < qualityConfig.distractionChance) {
          instance.state = 'distracted';
          instance.stateTimer = gameBalance.vendorQuality.distractionDuration;
          this.emit('vendorDistracted', { vendorId });
        }
      }
      */
    }

    // Update legacy vendors for backward compatibility
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

  /**
   * Checks if any vendor is currently serving in the specified section
   * @param sectionId - The section identifier (A, B, or C)
   * @returns true if any vendor is serving in that section, false otherwise
   * @deprecated Legacy method for backward compatibility
   */
  public isVendorInSection(sectionId: string): boolean {
    return this.legacyVendors.some(
      (vendor) => vendor.isServing && vendor.currentSection === sectionId
    );
  }

  /**
   * Registers an event listener
   * @param event - The event name
   * @param callback - The callback function to invoke
   */
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
