# Deployment Guide

## itch.io Deployment

### Automated (GitHub Actions)

Deployments to itch.io are automated via GitHub Actions:

- **Trigger**: Push to `main` branch (changes in `apps/stadium-simulator/`)
- **Manual**: Use "Run workflow" button in Actions tab
- **Workflow**: `.github/workflows/deploy-itch.yml`

### Manual Deployment

1. **Install Butler** (one-time):
   ```bash
   # Windows (via itch app): Already installed at %APPDATA%\itch\broth\butler\
   # Or download from: https://itchio.itch.io/butler
   ```

2. **Authenticate** (one-time):
   ```bash
   butler login
   ```

3. **Build and Push**:
   ```bash
   cd apps/stadium-simulator
   pnpm run deploy:itch
   ```
   
   Or manually:
   ```bash
   pnpm run build
   butler push dist $ITCH_ACCOUNT/$ITCH_PROJECT:html5 --userversion $(git rev-parse --short HEAD)
   ```

### Environment Variables

For local deployment, set these environment variables:

```bash
export ITCH_ACCOUNT=your-itch-username
export ITCH_PROJECT=super-duper-octo-sniffle
```

### itch.io Configuration

After first push, configure on itch.io Edit Game page:

1. Set "Kind of project" to **HTML**
2. Find the `html5` channel in Uploads section
3. Check "This file will be played in the browser"
4. Set viewport dimensions (recommended: 1280x720)
5. Enable "Mobile friendly" if applicable
6. Save changes

### Channels

| Channel | Platform | Description |
|---------|----------|-------------|
| `html5` | Web | Browser-playable HTML5 build |

### Versioning

- Automated deploys use git SHA as version
- Manual deploys can specify version: `--userversion 1.0.0`
- View version history on itch.io dashboard
