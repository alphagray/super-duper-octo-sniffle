import type { GameStateManager } from './GameStateManager';

/**
 * Represents a vendor in the stadium
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
 * Manages vendors in the stadium including placement, service timing, and cooldowns
 */
export class VendorManager {
  private vendors: Vendor[];
  private gameState: GameStateManager;
  private eventListeners: Map<string, Array<Function>>;

  /**
   * Creates a new VendorManager instance
   * @param gameState - The GameStateManager instance to use for vendor actions
   * @param vendorCount - The number of vendors to create (default: 2)
   */
  constructor(gameState: GameStateManager, vendorCount: number = 2) {
    this.gameState = gameState;
    this.eventListeners = new Map();
    this.vendors = [];

    // Initialize vendors
    for (let i = 0; i < vendorCount; i++) {
      this.vendors.push({
        id: i,
        currentSection: null,
        isServing: false,
        cooldown: 0,
        serviceTimer: 0,
      });
    }
  }

  /**
   * Returns all vendors
   * @returns Array of all vendors
   */
  public getVendors(): Vendor[] {
    return this.vendors;
  }

  /**
   * Returns a specific vendor by id
   * @param id - The vendor identifier
   * @returns The vendor object
   * @throws Error if vendor not found
   */
  public getVendor(id: number): Vendor {
    const vendor = this.vendors.find((v) => v.id === id);
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
   * Handles service completion and cooldown management
   * @param deltaTime - Time elapsed in milliseconds
   */
  public update(deltaTime: number): void {
    for (const vendor of this.vendors) {
      // Handle serving vendors
      if (vendor.isServing) {
        vendor.serviceTimer -= deltaTime;

        // Check if service is complete
        if (vendor.serviceTimer <= 0) {
          // Call gameState.vendorServe with the section
          this.gameState.vendorServe(vendor.currentSection!);

          // Store section before clearing
          const completedSection = vendor.currentSection;

          // Complete service
          vendor.isServing = false;
          vendor.currentSection = null;

          // Emit serviceComplete event
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
   */
  public isVendorInSection(sectionId: string): boolean {
    return this.vendors.some(
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
