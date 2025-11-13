import Phaser from 'phaser';

/**
 * TestSectionScene - Debug scene to visualize section rendering in isolation
 * Accessed via ?demo=section URL parameter
 * Shows a single section with bright green background for debug purposes
 */
export class TestSectionScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TestSectionScene' });
  }

  create(): void {
    // Bright green background for debug visibility
    this.cameras.main.setBackgroundColor(0x00ff00);

    // Center the section in the middle of the screen
    const centerX = this.cameras.main.centerX;
    const centerY = this.cameras.main.centerY;
    
    // Title text
    this.add.text(centerX, 50, 'TEST SECTION RENDER', {
      fontSize: '32px',
      fontFamily: 'Arial',
      color: '#000000',
    }).setOrigin(0.5, 0.5);

    // Render a test section
    this.createSectionWithStripes(centerX, centerY, 250, 200);

    // Instructions
    this.add.text(centerX, 700, 'Press ESC to go back', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#000000',
    }).setOrigin(0.5, 0.5);

    // Handle ESC key to return to menu
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start('MenuScene');
    });
  }

  /**
   * Converts HSL color values to Phaser hex format
   */
  private hslToHex(h: number, s: number, l: number): number {
    h = h / 360;
    s = s / 100;
    l = l / 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return parseInt('0x' + toHex(r) + toHex(g) + toHex(b), 16);
  }

  /**
   * Creates a section with graduated gray stripes for depth effect
   * 4 solid light fan rows, each separated by gradient dividers
   * Plus a bottom divider at the base
   * Dividers gradient from 5% darker than row below to 5% darker than row above (or edge for bottom)
   */
  private createSectionWithStripes(x: number, y: number, width: number, height: number): void {
    // Base HSL lightness values for each fan row (top to bottom)
    // Row 0 (top/darkest at 62%) -> Row 3 (bottom/brightest at 82%)
    // Gradient: 20% total reduction from bottom to top, evenly distributed (~6.67% per step)
    const rowLightnesses = [62, 68.67, 75.33, 82];
    const baseDarkL = 66;
    const darkeningPerRow = 21;
    
    // 4 solid rows + 4 dividers (including bottom divider)
    // Total: 4*R + 4*D = height, D = R/4 => 5R = height => R = height / 5
    const rowHeight = height / 5;
    const dividerHeight = rowHeight / 4;

    // Start Y at top of section
    let currentY = y - height / 2;

    // Render 4 solid rows with gradient dividers between them and bottom divider
    for (let rowIdx = 0; rowIdx < 4; rowIdx++) {
      // Render solid row with single color
      const rowLightness = rowLightnesses[rowIdx];
      const rowColor = this.hslToHex(0, 0, rowLightness);
      
      const rowY = currentY + rowHeight / 2;
      this.add.rectangle(x, rowY, width, rowHeight, rowColor);
      currentY += rowHeight;

      // Render gradient divider after each row
      const rowBelowLightness = rowLightnesses[rowIdx];
      const rowAboveLightness = rowIdx < 3 ? rowLightnesses[rowIdx + 1] : rowLightnesses[rowIdx]; // bottom divider ends at same as row below
      
      // Gradient starts 5% darker than row below, ends 5% darker than row above
      const dividerTopLightness = Math.max(0, rowBelowLightness - 5);
      const dividerBottomLightness = Math.max(0, rowAboveLightness - 5);

      // Divide divider into sub-rows for gradient effect
      const divSubRowCount = 4;
      const divSubRowHeight = dividerHeight / divSubRowCount;

      for (let divSubIdx = 0; divSubIdx < divSubRowCount; divSubIdx++) {
        // Interpolate between top (darker) and bottom (lighter) of divider
        const t = divSubIdx / (divSubRowCount - 1); // 0 to 1 from top to bottom
        const divLightness = dividerTopLightness + (dividerBottomLightness - dividerTopLightness) * t;
        const divColor = this.hslToHex(0, 0, divLightness);
        
        const divSubRowY = currentY + divSubRowHeight / 2;
        this.add.rectangle(x, divSubRowY, width, divSubRowHeight, divColor);
        
        currentY += divSubRowHeight;
      }
    }

    // Draw a border around the section for clarity
    const border = this.add.rectangle(x, y, width, height);
    border.setStrokeStyle(2, 0x000000);
    border.setFillStyle(0x000000, 0);
  }
}
