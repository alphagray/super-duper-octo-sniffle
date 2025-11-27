/**
 * Personality Integration Manager
 * 
 * Coordinates loading and integrating AI-generated personalities into game entities.
 * Manages the lifecycle of personalities from AIContentManager to Vendor, Mascot, and Announcer systems.
 * 
 * Features:
 * - Loads personalities from AIContentManager
 * - Creates Vendor sprites with personalities
 * - Creates Mascot sprites with personalities
 * - Initializes AnnouncerSystem with commentary
 * - Provides DialogueManager instance for cooldown tracking
 */

import type Phaser from 'phaser';
import { AIContentManager } from './AIContentManager';
import { DialogueManager } from './DialogueManager';
import { AnnouncerSystem } from './AnnouncerSystem';
import { Vendor } from '@/sprites/Vendor';
import { Mascot } from '@/sprites/Mascot';
import type { GameAIContent, VendorPersonality, MascotPersonality, AnnouncerContent } from '@/types/personalities';

/**
 * Personality Integration Manager
 * 
 * Singleton manager that coordinates AI personality integration across the game.
 */
export class PersonalityIntegrationManager {
  private static instance: PersonalityIntegrationManager | null = null;
  
  private aiContentManager: AIContentManager;
  private dialogueManager: DialogueManager;
  private content: GameAIContent | null = null;
  private announcerSystem: AnnouncerSystem | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.aiContentManager = AIContentManager.getInstance();
    this.dialogueManager = new DialogueManager();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PersonalityIntegrationManager {
    if (!PersonalityIntegrationManager.instance) {
      PersonalityIntegrationManager.instance = new PersonalityIntegrationManager();
    }
    return PersonalityIntegrationManager.instance;
  }

  /**
   * Initialize the manager by loading AI content
   * 
   * @returns Promise that resolves when content is loaded
   */
  public async initialize(): Promise<void> {
    this.content = await this.aiContentManager.getContent();
    
    // Initialize announcer system with first announcer
    if (this.content.announcers.length > 0) {
      this.announcerSystem = new AnnouncerSystem(
        this.content.announcers[0],
        this.dialogueManager
      );
    }
  }

  /**
   * Get a vendor personality by index (or random if not specified)
   */
  public getVendorPersonalityByIndex(index?: number): VendorPersonality | undefined {
    if (!this.content || this.content.vendors.length === 0) return undefined;
    if (index === undefined) {
      return this.content.vendors[Math.floor(Math.random() * this.content.vendors.length)];
    }
    return this.content.vendors[index % this.content.vendors.length];
  }

  /**
   * Get a mascot personality by index (or random if not specified)
   */
  public getMascotPersonalityByIndex(index?: number): MascotPersonality | undefined {
    if (!this.content || this.content.mascots.length === 0) return undefined;
    if (index === undefined) {
      return this.content.mascots[Math.floor(Math.random() * this.content.mascots.length)];
    }
    return this.content.mascots[index % this.content.mascots.length];
  }

  /**
   * Get the announcer system
   * 
   * @returns AnnouncerSystem instance or null if not initialized
   */
  public getAnnouncerSystem(): AnnouncerSystem | null {
    return this.announcerSystem;
  }

  /**
   * Get the dialogue manager
   * 
   * @returns DialogueManager instance
   */
  public getDialogueManager(): DialogueManager {
    return this.dialogueManager;
  }

  /**
   * Get loaded content
   * 
   * @returns GameAIContent or null if not loaded
   */
  public getContent(): GameAIContent | null {
    return this.content;
  }

  /**
   * Get specific vendor personality by ID
   * 
   * @param vendorId - Vendor personality ID
   * @returns VendorPersonality or undefined
   */
  public getVendorPersonality(vendorId: string): VendorPersonality | undefined {
    return this.content?.vendors.find(v => v.id === vendorId);
  }

  /**
   * Get specific mascot personality by ID
   * 
   * @param mascotId - Mascot personality ID
   * @returns MascotPersonality or undefined
   */
  public getMascotPersonality(mascotId: string): MascotPersonality | undefined {
    return this.content?.mascots.find(m => m.id === mascotId);
  }

  /**
   * Get specific announcer content by ID
   * 
   * @param announcerId - Announcer content ID
   * @returns AnnouncerContent or undefined
   */
  public getAnnouncerContent(announcerId: string): AnnouncerContent | undefined {
    return this.content?.announcers.find(a => a.id === announcerId);
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    PersonalityIntegrationManager.instance = null;
  }
}

export default PersonalityIntegrationManager.getInstance;
