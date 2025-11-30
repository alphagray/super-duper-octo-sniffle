import type Phaser from 'phaser';
import { BaseOverlay, BaseOverlayOptions } from '@/ui/overlays/BaseOverlay';
import { gameBalance } from '@/config/gameBalance';

export type CelebrationVisualState = 'success' | 'fail' | 'neutral';

export interface WaveCelebrationOptions extends BaseOverlayOptions {
  participation: number; // 0-100
  state: CelebrationVisualState;
  reasons?: string[];
}

export class WaveCelebrationOverlay extends BaseOverlay {
  protected participation: number;
  protected visualState: CelebrationVisualState;
  protected reasons: string[];

  constructor(scene: Phaser.Scene, x: number, y: number, options: WaveCelebrationOptions) {
    const defaults: BaseOverlayOptions = {
      depth: gameBalance.ui.depths.uiOverlayDefault,
      durationMs: 3000,
    };
    
    super(scene, x, y, { ...defaults, ...options });
    
    // Now safe to set properties after super()
    this.participation = Math.max(0, Math.min(100, options.participation ?? 0));
    this.visualState = options.state;
    this.reasons = options.reasons ?? [];
    
    // Build overlay with initialized properties
    this.build();
  }

  protected build(): void {
    const color = this.getStrokeColor(this.visualState);
    const mainText = this.scene.add.text(0, 0, `${Math.round(this.participation)}%!`, {
      fontSize: '32px',
      color: '#ffffff',
      stroke: color,
      strokeThickness: 4,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000000',
        blur: 0,
        fill: true,
      } as any,
    });
    mainText.setOrigin(0.5, 1);

    const reasonsText = this.formatReasons(this.reasons);
    const subline = this.scene.add.text(0, 10, reasonsText, {
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    subline.setOrigin(0.5, 0.25);

    this.container.add([mainText, subline]);
  }

  private getStrokeColor(state: CelebrationVisualState): string {
    switch (state) {
      case 'success':
        return '#1db954';
      case 'fail':
        return '#d32f2f';
      default:
        return '#fbc02d';
    }
  }

  private formatReasons(reasons: string[]): string {
    if (!reasons || reasons.length === 0) return '';
    const trimmed = reasons.map(r => r.trim()).filter(Boolean);
    const joined = trimmed.slice(0, 2).join('\n');
    return joined;
  }
}
