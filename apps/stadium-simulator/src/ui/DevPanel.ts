/**
 * DevPanel - Developer panel for managing AI content during development
 * 
 * Features:
 * - Display epoch info and generation stats
 * - Show content metadata (costs, tokens, etc.)
 * - Force regenerate functionality
 * - Content preview with expandable sections
 * - Only loads in development mode
 * - Keyboard shortcut (Ctrl+Shift+D) to toggle
 * 
 * This module creates and manages a DOM-based overlay panel that displays
 * AI content metadata and provides developer tools for content management.
 */

import { AIContentManager } from '@/systems/AIContentManager';
import type { GameAIContent, ContentMetadata } from '@/types/personalities';
import { getCurrentEpoch } from '@/config/ai-config';

/**
 * DevPanel Manager Class
 */
export class DevPanel {
  private static instance: DevPanel | null = null;
  private panel: HTMLDivElement | null = null;
  private isVisible: boolean = false;
  private contentManager: AIContentManager;
  private currentContent: GameAIContent | null = null;

  private constructor() {
    this.contentManager = AIContentManager.getInstance('development');
    this.init();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DevPanel {
    if (!DevPanel.instance) {
      DevPanel.instance = new DevPanel();
    }
    return DevPanel.instance;
  }

  /**
   * Initialize the dev panel
   */
  private init(): void {
    // Only initialize in development mode
    if (import.meta.env.PROD) {
      return;
    }

    // Create the panel
    this.createPanel();

    // Set up keyboard shortcut (Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Load initial content
    this.refreshContent();
  }

  /**
   * Create the dev panel DOM structure
   */
  private createPanel(): void {
    this.panel = document.createElement('div');
    this.panel.id = 'dev-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 400px;
      max-height: 90vh;
      background: rgba(20, 20, 20, 0.95);
      border: 2px solid #4a90e2;
      border-radius: 4px;
      color: #f0f0f0;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      overflow-y: auto;
      z-index: 10000;
      display: none;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    `;

    // Initial content
    this.panel.innerHTML = `
      <div style="padding: 12px; border-bottom: 2px solid #4a90e2;">
        <h2 style="margin: 0 0 8px 0; font-size: 16px; color: #4a90e2;">🛠️ Dev Panel</h2>
        <div style="font-size: 10px; color: #888;">Press Ctrl+Shift+D to toggle</div>
      </div>
      <div id="dev-panel-content" style="padding: 12px;">
        <div style="text-align: center; padding: 20px; color: #888;">Loading...</div>
      </div>
    `;

    document.body.appendChild(this.panel);
  }

  /**
   * Toggle panel visibility
   */
  public toggle(): void {
    if (!this.panel) return;
    
    this.isVisible = !this.isVisible;
    this.panel.style.display = this.isVisible ? 'block' : 'none';

    if (this.isVisible) {
      this.refreshContent();
    }
  }

  /**
   * Show the panel
   */
  public show(): void {
    if (!this.panel) return;
    this.isVisible = true;
    this.panel.style.display = 'block';
    this.refreshContent();
  }

  /**
   * Hide the panel
   */
  public hide(): void {
    if (!this.panel) return;
    this.isVisible = false;
    this.panel.style.display = 'none';
  }

  /**
   * Refresh content display
   */
  private async refreshContent(): Promise<void> {
    try {
      this.currentContent = await this.contentManager.getContent();
      this.renderContent();
    } catch (error) {
      this.renderError(error);
    }
  }

  /**
   * Render the content
   */
  private renderContent(): void {
    if (!this.panel || !this.currentContent) return;

    const contentDiv = this.panel.querySelector('#dev-panel-content');
    if (!contentDiv) return;

    const epoch = getCurrentEpoch(Date.now(), 'development');
    const metadata = this.currentContent.metadata;

    contentDiv.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 8px 0; color: #4a90e2; font-size: 14px;">📊 Epoch Info</h3>
        <div style="background: rgba(74, 144, 226, 0.1); padding: 8px; border-radius: 4px;">
          <div><strong>Current Epoch:</strong> ${epoch}</div>
          <div><strong>Content Epoch:</strong> ${this.currentContent.epoch}</div>
          <div><strong>Environment:</strong> ${this.currentContent.environment}</div>
          <div><strong>Version:</strong> ${this.currentContent.version}</div>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 8px 0; color: #50c878; font-size: 14px;">💰 Generation Stats</h3>
        <div style="background: rgba(80, 200, 120, 0.1); padding: 8px; border-radius: 4px;">
          <div><strong>Status:</strong> ${metadata.status}</div>
          <div><strong>Total Items:</strong> ${metadata.totalItems}</div>
          <div><strong>Total Cost:</strong> $${(metadata.totalCost / 100).toFixed(4)}</div>
          <div><strong>Total Tokens:</strong> ${metadata.totalTokens.toLocaleString()}</div>
          <div><strong>Generation Time:</strong> ${(metadata.generationTime / 1000).toFixed(2)}s</div>
          ${metadata.averageQualityScore ? `<div><strong>Avg Quality:</strong> ${(metadata.averageQualityScore * 100).toFixed(1)}%</div>` : ''}
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 8px 0; color: #ffd700; font-size: 14px;">🎭 Content Summary</h3>
        <div style="background: rgba(255, 215, 0, 0.1); padding: 8px; border-radius: 4px;">
          <div><strong>Vendors:</strong> ${this.currentContent.vendors.length}</div>
          <div><strong>Mascots:</strong> ${this.currentContent.mascots.length}</div>
          <div><strong>Announcers:</strong> ${this.currentContent.announcers.length}</div>
          ${this.currentContent.crowdChatter ? `<div><strong>Crowd Chatter:</strong> ${this.currentContent.crowdChatter.length}</div>` : ''}
        </div>
      </div>

      ${this.renderPersonalitiesPreview()}

      <div style="margin-top: 16px;">
        <button id="dev-panel-regenerate" style="
          width: 100%;
          padding: 10px;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.2s;
        ">⚠️ Force Regenerate Content</button>
        <div style="font-size: 10px; color: #888; margin-top: 4px; text-align: center;">
          This will clear cache and trigger new generation
        </div>
      </div>

      ${metadata.errors && metadata.errors.length > 0 ? this.renderErrors(metadata.errors) : ''}
    `;

    // Attach event listeners
    const regenerateBtn = contentDiv.querySelector('#dev-panel-regenerate');
    if (regenerateBtn) {
      regenerateBtn.addEventListener('click', () => this.handleRegenerate());
    }

    // Attach toggle listeners for expandable sections
    contentDiv.querySelectorAll('.dev-panel-toggle').forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const contentId = target.dataset.target;
        if (contentId) {
          const content = contentDiv.querySelector(`#${contentId}`);
          if (content) {
            const isVisible = content.getAttribute('data-visible') === 'true';
            content.setAttribute('data-visible', (!isVisible).toString());
            (content as HTMLElement).style.display = isVisible ? 'none' : 'block';
            target.textContent = isVisible ? '▶' : '▼';
          }
        }
      });
    });
  }

  /**
   * Render personalities preview with expandable sections
   */
  private renderPersonalitiesPreview(): string {
    if (!this.currentContent) return '';

    return `
      <div style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 8px 0; color: #9b59b6; font-size: 14px;">🎪 Personalities Preview</h3>
        
        <!-- Vendors -->
        <div style="margin-bottom: 8px;">
          <div style="display: flex; align-items: center; cursor: pointer; padding: 4px; background: rgba(155, 89, 182, 0.1); border-radius: 4px;">
            <span class="dev-panel-toggle" data-target="vendors-list" style="margin-right: 8px; user-select: none;">▶</span>
            <strong>Vendors (${this.currentContent.vendors.length})</strong>
          </div>
          <div id="vendors-list" data-visible="false" style="display: none; padding-left: 16px; margin-top: 4px;">
            ${this.currentContent.vendors.map((v) => `
              <div style="margin-bottom: 8px; padding: 6px; background: rgba(0, 0, 0, 0.3); border-left: 2px solid #9b59b6; border-radius: 2px;">
                <div><strong>${v.name}</strong></div>
                <div style="font-size: 10px; color: #aaa;">${v.description}</div>
                <div style="font-size: 10px;"><strong>Product:</strong> ${v.productType}</div>
                <div style="font-size: 10px;"><strong>Dialogue Lines:</strong> ${v.dialogue.length}</div>
                <div style="font-size: 10px;"><strong>Traits:</strong> ${v.traits.map(t => t.name).join(', ')}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Mascots -->
        <div style="margin-bottom: 8px;">
          <div style="display: flex; align-items: center; cursor: pointer; padding: 4px; background: rgba(155, 89, 182, 0.1); border-radius: 4px;">
            <span class="dev-panel-toggle" data-target="mascots-list" style="margin-right: 8px; user-select: none;">▶</span>
            <strong>Mascots (${this.currentContent.mascots.length})</strong>
          </div>
          <div id="mascots-list" data-visible="false" style="display: none; padding-left: 16px; margin-top: 4px;">
            ${this.currentContent.mascots.map((m) => `
              <div style="margin-bottom: 8px; padding: 6px; background: rgba(0, 0, 0, 0.3); border-left: 2px solid #9b59b6; border-radius: 2px;">
                <div><strong>${m.name}</strong></div>
                <div style="font-size: 10px; color: #aaa;">${m.description}</div>
                <div style="font-size: 10px;"><strong>Theme:</strong> ${m.theme}</div>
                <div style="font-size: 10px;"><strong>Abilities:</strong> ${m.abilities.length}</div>
                <div style="font-size: 10px;"><strong>Dialogue Lines:</strong> ${m.dialogue.length}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Announcers -->
        <div style="margin-bottom: 8px;">
          <div style="display: flex; align-items: center; cursor: pointer; padding: 4px; background: rgba(155, 89, 182, 0.1); border-radius: 4px;">
            <span class="dev-panel-toggle" data-target="announcers-list" style="margin-right: 8px; user-select: none;">▶</span>
            <strong>Announcers (${this.currentContent.announcers.length})</strong>
          </div>
          <div id="announcers-list" data-visible="false" style="display: none; padding-left: 16px; margin-top: 4px;">
            ${this.currentContent.announcers.map((a) => `
              <div style="margin-bottom: 8px; padding: 6px; background: rgba(0, 0, 0, 0.3); border-left: 2px solid #9b59b6; border-radius: 2px;">
                <div><strong>${a.name}</strong></div>
                <div style="font-size: 10px; color: #aaa;">${a.description}</div>
                <div style="font-size: 10px;"><strong>Style:</strong> ${a.style}</div>
                <div style="font-size: 10px;"><strong>Commentary Lines:</strong> ${a.commentary.length}</div>
                <div style="font-size: 10px;"><strong>Catchphrases:</strong> ${a.catchphrases.length}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render errors
   */
  private renderErrors(errors: any[]): string {
    return `
      <div style="margin-top: 16px; padding: 8px; background: rgba(231, 76, 60, 0.2); border: 1px solid #e74c3c; border-radius: 4px;">
        <h4 style="margin: 0 0 8px 0; color: #e74c3c; font-size: 12px;">⚠️ Errors (${errors.length})</h4>
        ${errors.map((err) => `
          <div style="margin-bottom: 4px; font-size: 10px;">
            <strong>${err.type}:</strong> ${err.message}
            ${err.contentId ? `<div>Content ID: ${err.contentId}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render error state
   */
  private renderError(error: any): void {
    if (!this.panel) return;

    const contentDiv = this.panel.querySelector('#dev-panel-content');
    if (!contentDiv) return;

    contentDiv.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #e74c3c;">
        <div style="font-size: 24px; margin-bottom: 8px;">❌</div>
        <div style="font-weight: bold; margin-bottom: 8px;">Failed to load content</div>
        <div style="font-size: 10px; color: #aaa; word-break: break-word;">${error?.message || 'Unknown error'}</div>
      </div>
    `;
  }

  /**
   * Handle regenerate button click
   */
  private async handleRegenerate(): Promise<void> {
    const confirmed = confirm(
      '⚠️ Are you sure you want to force regenerate content?\n\n' +
      'This will:\n' +
      '- Clear all cached content\n' +
      '- Trigger new API calls (costs money)\n' +
      '- May take some time to complete\n\n' +
      'Proceed?'
    );

    if (!confirmed) return;

    try {
      await this.contentManager.clearCache();
      await this.refreshContent();
      alert('✅ Cache cleared! New content will be generated on next request.');
    } catch (error) {
      alert(`❌ Failed to clear cache: ${error}`);
    }
  }
}

/**
 * Initialize dev panel in development mode
 */
export function initDevPanel(): void {
  if (import.meta.env.PROD) {
    return;
  }

  DevPanel.getInstance();
  console.log('[DevPanel] Initialized. Press Ctrl+Shift+D to toggle.');
}
