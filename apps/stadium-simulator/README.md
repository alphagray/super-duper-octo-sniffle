# Stadium Simulator 🏟️

An 8-bit retro stadium wave game powered by AI announcer commentary using Claude API.

## 🎮 Tech Stack

- **Phaser 3.80.1** - Game engine with TypeScript support
- **TypeScript** - Strict type checking and modern JavaScript features
- **Vite** - Fast bundler and dev server
- **Howler.js** - 8-bit audio management
- **Axios 1.12.0** - HTTP client for Claude API calls
- **Claude API** - AI-powered stadium announcer commentary

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ 
- pnpm (or npm/yarn)

### Installation

```bash
cd apps/stadium-simulator
pnpm install
```

### Environment Setup

The app uses serverless functions to securely proxy Claude API calls. API keys are stored server-side only.

**For Local Development:**

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

2. Add your Anthropic API key to `.env.local`:
```
ANTHROPIC_API_KEY=your_actual_api_key_here
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
```

**For Production (Vercel):**

Set environment variables in the Vercel dashboard:
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `ANTHROPIC_API_URL` - (Optional) Defaults to `https://api.anthropic.com/v1/messages`

### Development

```bash
pnpm run dev
```

Open [http://localhost:3000/stadium-simulator/](http://localhost:3000/stadium-simulator/)

### Build

```bash
pnpm run build
```

### Type Checking

```bash
pnpm run type-check
```

## 📁 Project Structure

```
apps/stadium-simulator/
├── src/
│   ├── scenes/              # Phaser scenes
│   │   ├── MenuScene.ts     # Title screen
│   │   ├── StadiumScene.ts  # Main game scene
│   │   └── GameOverScene.ts # Results screen
│   ├── managers/            # Game logic managers
│   │   ├── GameStateManager.ts  # Central game state
│   │   ├── WaveManager.ts       # Wave propagation logic
│   │   └── AnnouncerService.ts  # Claude API integration
│   ├── sprites/             # Game entities
│   │   ├── Fan.ts          # Fan sprite with wave mechanics
│   │   ├── Vendor.ts       # Vendor sprite
│   │   └── Mascot.ts       # Mascot sprite
│   ├── types/              # TypeScript definitions
│   │   └── GameTypes.ts    # Game state interfaces
│   ├── config.ts           # Phaser configuration
│   └── main.ts             # Entry point
├── public/
│   └── assets/
│       ├── sprites/        # Sprite sheets (placeholder)
│       └── sounds/         # 8-bit audio files (placeholder)
├── .github/workflows/
│   └── deploy.yml          # Auto-deploy to GitHub Pages
└── index.html              # HTML entry point
```

## 🎯 Features

- **Wave Mechanics**: Start and propagate the wave through stadium sections
- **Section Management**: Track happiness, thirst, and attention levels
- **Vendor System**: Serve fans to maintain happiness
- **Mascot Abilities**: Special power-ups to boost crowd engagement
- **AI Commentary**: Real-time announcer commentary powered by Claude API
- **Score System**: Points and multipliers for successful waves

## 🤖 AI Integration

The `AnnouncerService` class integrates with Claude API via a secure serverless function to generate dynamic, context-aware stadium announcer commentary:

```typescript
const announcer = new AnnouncerService();
const commentary = await announcer.getCommentary('Wave starting in section 3!');
// Returns: "Ladies and gentlemen, here it comes! Section 3 is ready to GO!"
```

### Serverless API

The `/api/announcer` endpoint provides secure proxy access to Claude API with:
- **Rate Limiting**: 10 requests per minute per IP address
- **Secure Keys**: API keys stored server-side only (never exposed to client)
- **Input Validation**: Validates and sanitizes all requests
- **CORS Support**: Configured for cross-origin requests
- **Error Handling**: Graceful fallbacks for API failures

## 🎨 Game Configuration

- **Canvas Size**: 1024x768 pixels
- **Rendering Mode**: Pixel art (crisp edges, no anti-aliasing)
- **Physics**: Arcade physics for sprite movement
- **Background**: Dark gray (#2d2d2d)

## 🎮 Controls

*(To be implemented)*

- Arrow keys / WASD - Control game elements
- Spacebar - Start wave
- Click - Interact with vendors/mascot

## 📸 Screenshots

*(To be added after gameplay implementation)*

## 🚢 Deployment

### Vercel (Recommended)

The project is configured for Vercel deployment with serverless functions:

```bash
npm run vercel:deploy
```

Or link and deploy automatically:
1. Install Vercel CLI: `npm install -g vercel`
2. Run `vercel` in the project directory
3. Set environment variables in Vercel dashboard:
   - `ANTHROPIC_API_KEY`
   - `ANTHROPIC_API_URL` (optional)

### GitHub Pages

The project can also deploy to GitHub Pages (static assets only, no serverless functions):

- **Live URL**: `https://<username>.github.io/stadium-simulator/`
- **Workflow**: `.github/workflows/deploy.yml`
- **Branch**: `gh-pages` (auto-created)

## 🔒 Security

- **Serverless API Proxy**: Claude API keys never exposed to client-side code
- **Rate Limiting**: Built-in protection against API abuse (10 req/min per IP)
- **Input Validation**: All requests validated and sanitized
- **Environment Variables**: API keys stored securely server-side
- **CORS Protection**: Configured for secure cross-origin requests

## 📝 Development Status

All core classes and scenes are created as empty templates with TODO comments. Ready for game mechanics implementation:

- [ ] Implement wave propagation physics
- [ ] Add sprite animations
- [ ] Integrate 8-bit audio with Howler.js
- [ ] Implement vendor and mascot behaviors
- [ ] Add collision detection
- [ ] Create UI overlays (score, timer)
- [ ] Implement menu and game over screens
- [ ] Add AI commentary triggers
- [ ] Create pixel art assets

## 📄 License

MIT
