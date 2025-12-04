import Phaser from 'phaser';
import { gameBalance } from '@/config/gameBalance';

interface SessionScore {
  grade: string;
  completedWaves: number;
  maxPossibleWaves: number;
  netHappiness: number;
  netAttention: number;
  netThirst: number;
  finalScore: number;
  maxPossibleScore: number;
  scorePercentage: number;
}

/**
 * ScoreReportScene displays the final score and grade for a completed session
 * Shows grade, statistics, and options to return to menu or play again
 */
export class ScoreReportScene extends Phaser.Scene {
  private sessionScore?: SessionScore;

  constructor() {
    super({ key: 'ScoreReportScene' });
  }

  init(data: any): void {
    this.sessionScore = data?.sessionScore;
  }

  create(): void {
    if (!this.sessionScore) {
      // Fallback if no score data
      this.scene.start('MenuScene');
      return;
    }

    const { width, height } = this.cameras.main;
    const centerX = width / 2;

    // Semi-transparent overlay
    this.add.rectangle(0, 0, width, height, 0x000000, 0.3).setOrigin(0, 0);

    // Title
    const titleText = this.add.text(centerX, 80, 'SESSION COMPLETE', {
      fontSize: '48px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Grade display (large, centered, color-coded)
    const gradeColor = this.getGradeColor(this.sessionScore.grade);
    const isModified = this.sessionScore.grade.includes('+') || this.sessionScore.grade.includes('-');
    const gradeFontSize = isModified ? '140px' : '160px';

    const gradeText = this.add.text(centerX, 250, this.sessionScore.grade, {
      fontSize: gradeFontSize,
      fontFamily: 'Arial',
      color: `#${gradeColor.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Add glow effect to grade
    this.tweens.add({
      targets: gradeText,
      scale: 1.05,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Statistics grid below grade
    const statsStartY = 420;
    const statsX = centerX - 150;
    const lineHeight = 45;

    const stats = [
      { label: 'Waves Completed:', value: `${this.sessionScore.completedWaves} / ${this.sessionScore.maxPossibleWaves}` },
      { label: 'Participation Rate:', value: Math.round(this.sessionScore.scorePercentage * 100) + '%' },
      { label: 'Net Happiness:', value: this.formatStat(this.sessionScore.netHappiness) },
      { label: 'Net Attention:', value: this.formatStat(this.sessionScore.netAttention) },
      { label: 'Net Thirst Reduction:', value: this.formatStat(this.sessionScore.netThirst) },
      { label: 'Final Score:', value: `${this.sessionScore.finalScore} / ${this.sessionScore.maxPossibleScore}` },
    ];

    for (let i = 0; i < stats.length; i++) {
      const stat = stats[i];
      const y = statsStartY + i * lineHeight;

      // Label
      this.add.text(statsX, y, stat.label, {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#cccccc',
      }).setOrigin(0, 0.5);

      // Value
      this.add.text(statsX + 320, y, stat.value, {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
    }

    // Buttons at bottom
    const buttonY = height - 80;
    const buttonWidth = 180;
    const buttonHeight = 50;
    const buttonSpacing = 40;

    // Return to Menu button
    const menuBtnX = centerX - (buttonWidth + buttonSpacing / 2);
    const menuBtnBg = this.add.rectangle(menuBtnX, buttonY, buttonWidth, buttonHeight, 0x0066cc);
    menuBtnBg.setInteractive();
    menuBtnBg.on('pointerover', () => menuBtnBg.setFillStyle(0x0088ff));
    menuBtnBg.on('pointerout', () => menuBtnBg.setFillStyle(0x0066cc));
    menuBtnBg.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });

    this.add.text(menuBtnX, buttonY, 'Menu', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    // Play Again button
    const playBtnX = centerX + (buttonWidth + buttonSpacing / 2);
    const playBtnBg = this.add.rectangle(playBtnX, buttonY, buttonWidth, buttonHeight, 0xcc6600);
    playBtnBg.setInteractive();
    playBtnBg.on('pointerover', () => playBtnBg.setFillStyle(0xff8800));
    playBtnBg.on('pointerout', () => playBtnBg.setFillStyle(0xcc6600));
    playBtnBg.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });

    this.add.text(playBtnX, buttonY, 'Play Again', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
  }

  /**
   * Get the color for a grade
   */
  private getGradeColor(grade: string): number {
    const colors = gameBalance.scoring.gradeColors as { [key: string]: number };
    // Handle base grades (S, A, B, etc.) without modifiers
    const baseGrade = grade.replace(/[+\-]/g, '').toUpperCase();
    return colors[grade] || colors[baseGrade] || 0xcccccc;
  }

  /**
   * Format stat display with +/- prefix
   */
  private formatStat(value: number): string {
    const rounded = Math.round(value);
    if (rounded > 0) {
      return `+${rounded}`;
    } else if (rounded < 0) {
      return `${rounded}`;
    } else {
      return '0';
    }
  }
}
