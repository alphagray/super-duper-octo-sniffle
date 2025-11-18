# UI Components - Usage Guide

This document provides usage examples and documentation for the UI components implemented in this PR.

## SpeechBubble Component

### Overview

The `SpeechBubble` component is a Phaser GameObject that displays retro-style speech bubbles for character dialogue. It features:

- Pixel-art border with customizable tail position
- Monospace font (Courier New)
- Auto-sizing based on text content
- Smooth fade in/out animations
- Auto-destroy after display duration
- Easy positioning relative to game objects

### Basic Usage

```typescript
import { SpeechBubble } from '@/ui/SpeechBubble';

// In a Phaser scene
const bubble = new SpeechBubble(this, 100, 100, {
  text: "Let's get this wave started!",
  duration: 3000, // Display for 3 seconds
});

this.add.existing(bubble);
```

### Positioning Above a Character

```typescript
// Position bubble above a vendor sprite
const vendor = new Vendor(this, 200, 400);
const bubble = new SpeechBubble(this, 0, 0, {
  text: "Hot dogs! Get your hot dogs here!",
});

bubble.positionAboveTarget(vendor, 20); // 20px above the vendor
this.add.existing(bubble);
```

### Configuration Options

```typescript
interface SpeechBubbleConfig {
  text: string;              // Required - Text to display
  duration?: number;         // Default: 3000ms - How long to show the bubble
  fadeInDuration?: number;   // Default: 200ms - Fade in animation time
  fadeOutDuration?: number;  // Default: 200ms - Fade out animation time
  maxWidth?: number;         // Default: 200px - Maximum bubble width
  tailPosition?: 'bottom-left' | 'bottom-center' | 'bottom-right'; // Default: 'bottom-center'
  fontSize?: number;         // Default: 12px - Font size
  padding?: number;          // Default: 8px - Internal padding
}
```

### Advanced Examples

**Long Multi-line Text:**
```typescript
const bubble = new SpeechBubble(this, 300, 200, {
  text: "This is a longer message that will automatically wrap to multiple lines!",
  duration: 5000,
  maxWidth: 250,
});
```

**Custom Styling:**
```typescript
const bubble = new SpeechBubble(this, 400, 300, {
  text: "SPECTACULAR!",
  duration: 4000,
  fadeInDuration: 500,
  fadeOutDuration: 500,
  fontSize: 16,
  padding: 12,
  tailPosition: 'bottom-right',
});
```

**Dynamic Text Updates:**
```typescript
const bubble = new SpeechBubble(this, 100, 100, {
  text: "Initial message",
  duration: 10000, // Long duration for demo
});

// Update text later
setTimeout(() => {
  bubble.setText("Updated message!");
}, 3000);
```

### Integration with Game Characters

The speech bubble is designed to work with any game object. Here's an example with the Vendor sprite:

```typescript
// In your game scene
class GameScene extends Phaser.Scene {
  private vendor: Vendor;

  create() {
    this.vendor = new Vendor(this, 200, 400, vendorPersonality);
    
    // Show speech bubble when vendor serves
    this.vendorManager.on('vendorServe', (vendor) => {
      const dialogue = vendor.triggerDialogue('vendorServe', {
        score: this.score,
        waveState: 'active',
      });

      if (dialogue) {
        const bubble = new SpeechBubble(this, 0, 0, {
          text: dialogue,
          duration: 3000,
        });
        bubble.positionAboveTarget(vendor, 20);
        this.add.existing(bubble);
      }
    });
  }
}
```

### Demo Scene

To see the speech bubbles in action, visit the demo scene:

```
http://localhost:3000/stadium-simulator/?demo=speech
```

Press keys 1-6 to trigger different speech bubble demonstrations:
- **1**: Vendor greeting
- **2**: Mascot catchphrase  
- **3**: Long multi-line text
- **4**: Short exclamation
- **5**: Different tail positions
- **6**: Custom styling

---

## DevPanel Component

### Overview

The `DevPanel` is a developer-only panel that displays AI content metadata and provides tools for managing content during development. It features:

- Epoch info and generation statistics
- Content metadata (costs, tokens, models)
- Expandable personality previews
- Force regenerate functionality with confirmation
- Only loads in development mode (excluded from production builds)
- Keyboard shortcut toggle (Ctrl+Shift+D)

### Automatic Initialization

The DevPanel is automatically initialized in development mode when the game starts:

```typescript
// In main.ts
import { initDevPanel } from './ui/DevPanel';

// Automatically initializes only in development
initDevPanel();
```

### Usage

**Toggle Panel:**
- Press `Ctrl+Shift+D` to show/hide the panel

**View Content:**
- Epoch information
- Generation statistics (cost, tokens, time)
- Content summary (vendors, mascots, announcers)
- Expandable personality details

**Force Regenerate:**
- Click "Force Regenerate Content" button
- Confirm the action
- Cache will be cleared and new content will be generated on next request

### Panel Sections

**Epoch Info:**
- Current epoch number
- Content epoch (may differ if using cached content)
- Environment (development/production)
- Content version

**Generation Stats:**
- Status (cached, generating, complete, error)
- Total items generated
- Total cost (in dollars)
- Total tokens used
- Generation time
- Average quality score

**Content Summary:**
- Count of vendors, mascots, announcers
- Crowd chatter count (if available)

**Personalities Preview:**
- Expandable sections for each personality type
- Click to expand and view:
  - Name and description
  - Product type / theme / style
  - Dialogue line counts
  - Traits and abilities

**Error Display:**
- Shows any errors encountered during generation
- Error type and message
- Content ID (if applicable)
- Recovery status

### Development Only

The DevPanel uses conditional compilation to ensure it's excluded from production builds:

```typescript
// DevPanel.ts
if (import.meta.env.PROD) {
  return; // Don't initialize in production
}
```

This ensures:
- Zero overhead in production builds
- No sensitive development data exposed
- Clean user experience in production

### Integration with AIContentManager

The DevPanel automatically connects to the AIContentManager singleton and displays real-time content metadata:

```typescript
// DevPanel connects to AIContentManager
const contentManager = AIContentManager.getInstance('development');
const content = await contentManager.getContent();

// Displays all metadata from the content
```

### Styling

The DevPanel uses inline CSS with a retro aesthetic matching the game:
- Dark background with transparency
- Monospace font (Courier New)
- Retro color palette (blues, greens, golds)
- Pixel-perfect borders
- Smooth hover effects

### API Reference

```typescript
class DevPanel {
  // Get singleton instance
  static getInstance(): DevPanel;

  // Show the panel
  show(): void;

  // Hide the panel
  hide(): void;

  // Toggle panel visibility
  toggle(): void;
}

// Initialize dev panel (call once at startup)
function initDevPanel(): void;
```

---

## Testing

Both components include tests:

**SpeechBubble Tests:**
```bash
npm test -- src/__tests__/ui/SpeechBubble.test.ts
```

**All Tests:**
```bash
npm test
```

---

## Screenshots

### Speech Bubble Demo Scene
*To see speech bubbles in action, run the game with `?demo=speech` URL parameter and press keys 1-6.*

Features demonstrated:
- Various text lengths and configurations
- Different tail positions
- Custom fade animations
- Positioning relative to characters

### Dev Panel
*To see the dev panel, run the game in development mode and press Ctrl+Shift+D.*

Features shown:
- Epoch information
- Generation statistics
- Content metadata
- Expandable personality sections
- Force regenerate button

---

## Future Enhancements

### SpeechBubble
- [ ] Support for character portraits/icons
- [ ] Speech bubble color themes per character type
- [ ] Sound effect integration
- [ ] Animation styles (bounce, shake, etc.)

### DevPanel
- [ ] Real-time content generation progress
- [ ] Content comparison between epochs
- [ ] Export content to JSON
- [ ] Content validation and quality metrics
- [ ] Budget tracking and alerts
