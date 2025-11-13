import Phaser from 'phaser';
import { SectionRow } from './SectionRow';
import { SectionConfig } from '../types/GameTypes';

/**
 * StadiumSection is a container sprite that manages:
 * - Rendering graduated stripe backgrounds with gradient dividers
 * - Population and management of 32 fan sprites (4 rows × 8 columns)
 * - Visual effects (wave animations, flash effects, particle bursts)
 * - Vendor placement indicators
 */
export class StadiumSection extends Phaser.GameObjects.Container {
  private sectionId: string;
  private sectionWidth: number;
  private sectionHeight: number;
  private config: SectionConfig;
  private rows: SectionRow[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: SectionConfig,
    sectionId: string
  ) {
    super(scene, x, y);
    this.sectionId = sectionId;
    this.sectionWidth = config.width;
    this.sectionHeight = config.height;
    this.config = {
      rowCount: config.rowCount ?? 4,
      seatsPerRow: config.seatsPerRow ?? 8,
      width: config.width,
      height: config.height,
      rowBaseHeightPercent: config.rowBaseHeightPercent ?? 0.15,
      startLightness: Math.max(30, Math.min(90, config.startLightness ?? 62)),
      autoPopulate: config.autoPopulate ?? true,
    };

    this.initializeRows(scene);
    scene.add.existing(this);
  }

  /**
   * Initializes SectionRow objects and adds them to the container
   */
  private initializeRows(scene: Phaser.Scene): void {
    const rowCount = this.config.rowCount ?? 4;
    const seatsPerRow = this.config.seatsPerRow ?? 8;
    const width = this.config.width;
    const height = this.config.height;
    const rowBaseHeightPercent = this.config.rowBaseHeightPercent ?? 0.15;
    const startLightness = this.config.startLightness ?? 62;
    // Calculate row heights
    const baseRowHeight = Math.floor(height / rowCount);
    const remainder = height - baseRowHeight * rowCount;
    // Calculate lightness values
    const maxLightness = 90;
    const minLightness = 30;
    const interval = (maxLightness - startLightness) / Math.max(1, rowCount - 1);
    let currentY = -height / 2;
    for (let i = 0; i < rowCount; i++) {
      const rowHeight = baseRowHeight + (i === 0 ? remainder : 0);
      const targetLightness = Math.max(minLightness, Math.min(maxLightness, startLightness + interval * i));
      const nextRowLightness = Math.max(minLightness, Math.min(maxLightness, startLightness + interval * (i + 1)));
      const row = new SectionRow(
        scene,
        this,
        i,
        currentY,
        width,
        rowHeight,
        targetLightness,
        nextRowLightness,
        seatsPerRow
      );
      this.rows.push(row);
      currentY += rowHeight;
    }
  }

  /**
   * Get all SectionRow objects
   */
  public getRows(): SectionRow[] {
    return this.rows;
  }

  /**
   * Gets all fans in this section
   */
  public getFans(): any[] {
    return this.rows.flatMap(row => row.getFans());
  }

  /**
   * Gets fans in a specific row
   */
  public getFanRow(rowIndex: number): any[] {
    if (this.rows[rowIndex]) {
      return this.rows[rowIndex].getFans();
    }
    return [];
  }

  /**
   * Updates intensity for all fans in this section
   */
  public updateFanIntensity(intensity: number): void {
    this.rows.forEach(row => row.updateFanIntensity(intensity));
  }

  /**
   * Plays wave animation for all fans with column-based stagger
   */
  public playWave(): Promise<void> {
    const columnDelay = 45;
    const rowDelay = 10;
    const promises: Promise<void>[] = [];
    this.rows.forEach(row => {
      promises.push(row.playWave(columnDelay, rowDelay));
    });
    return Promise.all(promises).then(() => undefined);
  }

  /**
   * Flash the border of the section green after all fans have played their animation
   */
  public async flashSuccess(): Promise<void> {
    return new Promise(resolve => {
      // Create particle burst at section center
      this.createParticleBurst(0x00ff00);

      // Delay flash until all fans have played their animation
      // (Assume playWave is called before this and awaited)
      const border = this.scene.add.rectangle(this.x, this.y, this.sectionWidth + 8, this.sectionHeight + 8);
      border.setStrokeStyle(6, 0x00ff00, 0.95);
      border.setDepth(9999);
      this.scene.tweens.add({
        targets: border,
        alpha: { from: 0.95, to: 0 },
        duration: 350,
        onComplete: () => {
          border.destroy();
          resolve();
        }
      });
    });
  }

  /**
   * Flash the border of the section red after all fans have played their animation
   */
  public async flashFail(): Promise<void> {
    return new Promise(resolve => {
      // Create particle burst at section center
      this.createParticleBurst(0xff0000);

      // Delay flash until all fans have played their animation
      // (Assume playWave is called before this and awaited)
      const border = this.scene.add.rectangle(this.x, this.y, this.sectionWidth + 8, this.sectionHeight + 8);
      border.setStrokeStyle(6, 0xff0000, 0.95);
      border.setDepth(9999);
      this.scene.tweens.add({
        targets: border,
        alpha: { from: 0.95, to: 0 },
        duration: 350,
        onComplete: () => {
          border.destroy();
          resolve();
        }
      });
    });
  }

  /**
   * Show vendor placed indicator (if needed)
   */
  public placedVendor(vendorId: number): void {
    // Placeholder for vendor indicator
    // Could add a text or icon to show vendor is here
  }

  /**
   * Creates a particle burst effect at the section center
   */
  private createParticleBurst(color: number): void {
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 100 + Math.random() * 50;

      const particle = this.scene.add.circle(this.x, this.y, 4, color);

      this.scene.tweens.add({
        targets: particle,
        x: this.x + Math.cos(angle) * speed,
        y: this.y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 600,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }
}
