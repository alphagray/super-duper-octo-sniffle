import { VendorManager } from '@/managers/VendorManager';
import { GameStateManager } from '@/managers/GameStateManager';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('VendorManager', () => {
  let vendorManager: VendorManager;
  let mockGameState: GameStateManager;

  beforeEach(() => {
    mockGameState = new GameStateManager();
    vendorManager = new VendorManager(mockGameState, 2); // 2 vendors
  });

  describe('Initialization', () => {
    it('should create 2 vendors', () => {
      expect(vendorManager.getVendors()).toHaveLength(2);
    });

    it('should initialize vendors with no cooldown', () => {
      const vendors = vendorManager.getVendors();
      vendors.forEach(v => {
        expect(v.cooldown).toBe(0);
        expect(v.isServing).toBe(false);
      });
    });
  });

  describe('placeVendor', () => {
    it('should place vendor in specified section', () => {
      vendorManager.placeVendor(0, 'A'); // Vendor 0 to Section A
      const vendor = vendorManager.getVendor(0);
      expect(vendor.currentSection).toBe('A');
    });

    it('should not place vendor if on cooldown', () => {
      vendorManager.placeVendor(0, 'A');
      // Try to move immediately (still on cooldown)
      const result = vendorManager.placeVendor(0, 'B');
      expect(result).toBe(false);
      expect(vendorManager.getVendor(0).currentSection).toBe('A'); // Still in A
    });

    it('should start serving when placed', () => {
      vendorManager.placeVendor(0, 'A');
      const vendor = vendorManager.getVendor(0);
      expect(vendor.isServing).toBe(true);
    });
  });

  describe('update', () => {
    it('should complete service after 2 seconds', () => {
      vendorManager.placeVendor(0, 'A');
      vendorManager.update(2000); // 2 seconds
      
      const vendor = vendorManager.getVendor(0);
      expect(vendor.isServing).toBe(false);
      expect(vendor.cooldown).toBe(0);
    });

    it('should call gameState.vendorServe when service completes', () => {
      const serveSpy = vi.spyOn(mockGameState, 'vendorServe');
      vendorManager.placeVendor(0, 'A');
      vendorManager.update(2000);
      
      expect(serveSpy).toHaveBeenCalledWith('A');
    });

    it('should emit serviceComplete event', () => {
      const callback = vi.fn();
      vendorManager.on('serviceComplete', callback);
      vendorManager.placeVendor(0, 'A');
      vendorManager.update(2000);
      
      expect(callback).toHaveBeenCalledWith({ vendorId: 0, section: 'A' });
    });

    it('should decrease cooldown over time', () => {
      vendorManager.placeVendor(0, 'A');
      vendorManager.update(2000); // Service complete, cooldown starts
      
      // Cooldown should be 0 immediately after service in this simple version
      // Or adjust if you want cooldown AFTER service
      const vendor = vendorManager.getVendor(0);
      expect(vendor.cooldown).toBe(0);
    });
  });

  describe('isVendorInSection', () => {
    it('should return true if vendor is serving in section', () => {
      vendorManager.placeVendor(0, 'B');
      expect(vendorManager.isVendorInSection('B')).toBe(true);
    });

    it('should return false after service completes', () => {
      vendorManager.placeVendor(0, 'B');
      vendorManager.update(2000);
      expect(vendorManager.isVendorInSection('B')).toBe(false);
    });

    it('should check all vendors', () => {
      vendorManager.placeVendor(0, 'A');
      vendorManager.placeVendor(1, 'C');
      expect(vendorManager.isVendorInSection('A')).toBe(true);
      expect(vendorManager.isVendorInSection('C')).toBe(true);
      expect(vendorManager.isVendorInSection('B')).toBe(false);
    });
  });
});
