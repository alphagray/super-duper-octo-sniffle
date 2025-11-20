import { AnimatedActor } from '@/actors/base/Actor';
import { Vendor } from '@/sprites/Vendor';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';

/**
 * VendorActor: Adapter wrapping Vendor sprite as an AnimatedActor.
 * Delegates movement and service logic to existing Vendor.
 */
export class VendorActor extends AnimatedActor {
  private vendor: Vendor;

  constructor(id: string, vendor: Vendor, category: ActorCategory = 'vendor', enableLogging = false) {
    // Vendor sprite has x/y, but we're not using grid positioning for vendors currently
    super(id, 'vendor', category, 0, 0, enableLogging);
    this.vendor = vendor;
    this.logger.debug('VendorActor created, wrapping Vendor sprite');
  }

  /**
   * Update vendor position from sprite.
   * Actual vendor logic is handled by AIManager.
   */
  public update(delta: number): void {
    // No need to sync x/y - Vendor sprite handles its own position
  }

  /**
   * Refresh vendor visual (handled by VendorManager events).
   */
  public draw(): void {
    // Vendor animation already driven by state changes
  }

  /**
   * Get wrapped Vendor sprite.
   */
  public getVendor(): Vendor {
    return this.vendor;
  }

  /**
   * Get vendor state for registry snapshot.
   */
  public getState() {
    return {
      position: { x: this.vendor.x, y: this.vendor.y }
    };
  }
}
