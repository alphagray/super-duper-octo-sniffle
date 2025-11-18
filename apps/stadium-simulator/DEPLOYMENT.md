# Deployment Checklist

Complete checklist for deploying Stadium Simulator with AI-powered personalities to Vercel production.

---

## Pre-Deployment Phase

### 1. Code Quality & Testing ✓

- [x] All TypeScript errors resolved (`npm run type-check`)
- [ ] All unit tests passing (`npm test`)
- [ ] All API tests passing (`npm run test:api`)
- [ ] Integration tests complete
- [ ] No console errors in development build
- [ ] Security audit clean (`npm run audit:security`)

### 2. Environment Configuration

- [ ] Create `.env.local` with required variables:
  ```bash
  ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
  ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
  ADMIN_API_KEY=your-secure-admin-key-here
  NODE_ENV=production
  ```
- [ ] Verify API key works with test request
- [ ] Generate secure ADMIN_API_KEY (use `openssl rand -base64 32`)
- [ ] Document all environment variables

### 3. Vercel Project Setup

- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Login to Vercel: `vercel login`
- [ ] Link project: `vercel link` (or create new project)
- [ ] Verify project settings in Vercel dashboard
- [ ] Configure custom domain (if applicable)

### 4. Configuration Review

Review and update key configuration files:

#### `vercel.json`
- [x] Function timeout: 30s for generate-content
- [x] Function timeout: 10s for announcer
- [x] Memory allocation: 1024MB for generate-content
- [x] Edge caching configured correctly
- [x] Security headers added
- [ ] All settings reviewed and verified

#### `src/config/ai-config.ts`
- [ ] Production epoch duration: 24 hours
- [ ] Cost limits appropriate for production
- [ ] Cache settings optimized
- [ ] API timeout values reasonable
- [ ] Fallback content enabled

#### `package.json`
- [ ] Build script works: `npm run build`
- [ ] All dependencies up to date
- [ ] No unused dependencies
- [ ] Scripts for production ready

### 5. Content Validation

- [ ] Generate test content for epochs 1-7
- [ ] Manually review all vendor personalities
- [ ] Check mascot abilities and dialogue
- [ ] Verify announcer commentary quality
- [ ] Test all archetype combinations
- [ ] Ensure no inappropriate content
- [ ] Validate all dialogue under 20 words
- [ ] Check JSON structure compliance

---

## Deployment Phase

### 6. Initial Deployment to Preview

Deploy to preview environment for final testing:

```bash
# Deploy to preview
vercel

# Note the preview URL
# Example: https://stadium-simulator-abc123.vercel.app
```

- [ ] Preview deployment successful
- [ ] Note preview URL: _________________________
- [ ] No build errors
- [ ] No deployment warnings

### 7. Preview Environment Testing

Test all functionality in preview environment:

#### Basic Functionality
- [ ] Home page loads correctly
- [ ] Game starts without errors
- [ ] All game mechanics work
- [ ] Audio plays correctly
- [ ] UI elements render properly

#### API Endpoints
- [ ] Test `/api/generate-content`:
  ```bash
  curl -X POST https://YOUR-PREVIEW-URL/api/generate-content \
    -H "Content-Type: application/json" \
    -d '{"epoch": 1, "environment": "production"}'
  ```
  - [ ] Returns valid content
  - [ ] Response time < 30s
  - [ ] Cost estimate included
  - [ ] No validation errors

- [ ] Test `/api/announcer`:
  ```bash
  curl -X POST https://YOUR-PREVIEW-URL/api/announcer \
    -H "Content-Type: application/json" \
    -d '{"event": "waveStart", "context": {"score": 100}}'
  ```
  - [ ] Returns commentary
  - [ ] Response time < 10s
  - [ ] Appropriate to context

- [ ] Test `/api/usage` (admin dashboard):
  ```bash
  curl -H "Authorization: Bearer YOUR_ADMIN_KEY" \
    https://YOUR-PREVIEW-URL/api/usage
  ```
  - [ ] Returns metrics
  - [ ] Authentication works
  - [ ] Data format correct

#### AI System
- [ ] Content generation works in-game
- [ ] Epoch rotation functions correctly
- [ ] Rate limiting enforces 1 per epoch
- [ ] Cache prevents duplicate calls
- [ ] Fallback content loads on API failure
- [ ] DevPanel shows correct status (Ctrl+Shift+D)

#### Performance
- [ ] Initial load time < 3s
- [ ] Game runs at 60fps
- [ ] No memory leaks over 10 min session
- [ ] API calls complete within timeout
- [ ] IndexedDB caching works

#### Admin Dashboard
- [ ] Access admin dashboard: `https://YOUR-PREVIEW-URL/admin.html`
- [ ] Dashboard loads without errors
- [ ] Authentication works with ADMIN_API_KEY
- [ ] Metrics display correctly
- [ ] Auto-refresh works (30s interval)
- [ ] Cost calculations accurate

### 8. Environment Variables Setup

Add all required environment variables in Vercel dashboard:

1. Go to: Project Settings → Environment Variables
2. Add the following:

- [ ] `ANTHROPIC_API_KEY` (Production)
  - Value: `sk-ant-api03-xxxxx`
  - Environment: Production
  
- [ ] `ANTHROPIC_API_URL` (Optional, Production)
  - Value: `https://api.anthropic.com/v1/messages`
  - Environment: Production
  
- [ ] `ADMIN_API_KEY` (Production)
  - Value: (secure random key)
  - Environment: Production
  
- [ ] `NODE_ENV` (Production)
  - Value: `production`
  - Environment: Production

- [ ] All variables saved and confirmed

### 9. Production Deployment

Deploy to production:

```bash
# Deploy to production
vercel --prod

# Note the production URL
# Example: https://stadium-simulator.vercel.app
```

- [ ] Production deployment successful
- [ ] Production URL: _________________________
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] DNS propagated

### 10. Production Smoke Tests

Immediately after production deployment, run smoke tests:

#### Critical Path Tests
- [ ] Home page loads (https://YOUR-DOMAIN/)
- [ ] Game starts successfully
- [ ] Content generation works for current epoch
- [ ] Announcer commentary triggers correctly
- [ ] No console errors in browser
- [ ] No 500 errors in Vercel logs

#### API Health Checks
```bash
# Generate content for current epoch
curl -X POST https://YOUR-DOMAIN/api/generate-content \
  -H "Content-Type: application/json" \
  -d '{"epoch": 1, "environment": "production"}'

# Test announcer
curl -X POST https://YOUR-DOMAIN/api/announcer \
  -H "Content-Type: application/json" \
  -d '{"event": "waveStart"}'

# Check usage metrics
curl -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  https://YOUR-DOMAIN/api/usage
```

- [ ] All endpoints respond successfully
- [ ] Response times within limits
- [ ] No unexpected errors

### 11. Monitoring Setup

Configure monitoring and alerting:

#### Vercel Dashboard
- [ ] Enable Analytics
- [ ] Configure Insights
- [ ] Set up error tracking
- [ ] Enable Speed Insights

#### Cost Monitoring
- [ ] Set up cost alert thresholds
- [ ] Configure daily usage reports
- [ ] Document cost projections
- [ ] Bookmark admin dashboard

#### External Monitoring (Optional)
- [ ] Set up UptimeRobot or similar
- [ ] Configure Sentry for error tracking
- [ ] Add performance monitoring
- [ ] Set up log aggregation

---

## Post-Deployment Phase

### 12. Initial Monitoring (First 24 Hours)

Monitor closely for the first day:

#### Hour 1
- [ ] Check Vercel function logs for errors
- [ ] Verify API calls succeeding
- [ ] Monitor response times
- [ ] Check cost accumulation

#### Hour 6
- [ ] Review usage metrics in admin dashboard
- [ ] Verify cache hit rate > 90%
- [ ] Check for rate limit violations
- [ ] Review any error logs

#### Hour 24
- [ ] Generate usage report
- [ ] Calculate actual cost per user
- [ ] Review performance metrics
- [ ] Check for any issues

### 13. User Acceptance Testing

Have real users test the production site:

- [ ] 5+ users complete full gameplay session
- [ ] Collect feedback on AI content quality
- [ ] Monitor for any reported bugs
- [ ] Verify mobile experience
- [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge)

### 14. Performance Optimization

Based on real usage data:

- [ ] Review Vercel Analytics
- [ ] Identify performance bottlenecks
- [ ] Optimize slow API calls
- [ ] Adjust cache settings if needed
- [ ] Tune rate limits based on usage

### 15. Documentation

Finalize all documentation:

- [ ] Update README.md with production URL
- [ ] Document deployment process
- [ ] Create runbook for common issues
- [ ] Document rollback procedure
- [ ] Update API documentation
- [ ] Add production architecture diagram

---

## Rollback Procedure

If critical issues arise:

### Immediate Rollback
```bash
# 1. List recent deployments
vercel ls

# 2. Identify last stable deployment
# Copy the deployment URL

# 3. Rollback to stable deployment
vercel rollback <deployment-url>

# 4. Verify rollback successful
curl https://YOUR-DOMAIN/
```

### Rollback Checklist
- [ ] Identify issue severity (critical/major/minor)
- [ ] Determine last known good deployment
- [ ] Execute rollback command
- [ ] Verify production is stable
- [ ] Notify team of rollback
- [ ] Document issue in post-mortem
- [ ] Create fix in development
- [ ] Re-test before redeployment

---

## Ongoing Maintenance

### Daily Tasks
- [ ] Check admin dashboard for anomalies
- [ ] Review error logs
- [ ] Monitor cost trends
- [ ] Verify API health

### Weekly Tasks
- [ ] Generate weekly usage report
- [ ] Review content quality
- [ ] Check for security updates
- [ ] Update dependencies if needed
- [ ] Review user feedback

### Monthly Tasks
- [ ] Comprehensive performance audit
- [ ] Cost analysis and projections
- [ ] Security audit
- [ ] Update documentation
- [ ] Review and update rate limits
- [ ] Archive old logs

---

## Emergency Contacts

Document key contacts for production issues:

- **API Provider (Anthropic):** https://support.anthropic.com
- **Hosting (Vercel):** https://vercel.com/support
- **Team Lead:** ________________________
- **DevOps Contact:** ________________________
- **On-Call Engineer:** ________________________

---

## Verification Sign-Off

Final sign-off before considering deployment complete:

- [ ] All smoke tests passing
- [ ] No critical errors in logs
- [ ] Cost tracking working
- [ ] Monitoring configured
- [ ] Documentation complete
- [ ] Team notified of deployment
- [ ] Rollback procedure tested

**Deployed By:** ________________________  
**Date:** ________________________  
**Time:** ________________________  
**Production URL:** ________________________  
**Deployment ID:** ________________________  

---

## Appendix: Useful Commands

### Vercel CLI Commands
```bash
# View logs
vercel logs <deployment-url>

# List all deployments
vercel ls

# Remove old deployment
vercel rm <deployment-url>

# View environment variables
vercel env ls

# Add environment variable
vercel env add <NAME>

# Pull environment variables locally
vercel env pull
```

### Testing Commands
```bash
# Build for production
npm run build

# Type check
npm run type-check

# Run all tests
npm test

# Run API tests
npm run test:api

# Security audit
npm audit

# Preview production build locally
npm run preview
```

### Monitoring Commands
```bash
# Check API health
curl https://YOUR-DOMAIN/api/generate-content

# Get usage metrics
curl -H "Authorization: Bearer KEY" \
  https://YOUR-DOMAIN/api/usage

# Load test (requires ab tool)
ab -n 100 -c 10 https://YOUR-DOMAIN/

# Check SSL certificate
openssl s_client -connect YOUR-DOMAIN:443
```

---

**Last Updated:** 2025-11-18  
**Version:** 1.0.0  
**Maintained By:** DevOps Team
