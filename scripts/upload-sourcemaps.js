#!/usr/bin/env node
/**
 * Sentry Source Map Upload Script
 * Run after `npm run build` in CI/CD pipeline
 * 
 * Usage:
 *   SENTRY_AUTH_TOKEN=xxx node scripts/upload-sourcemaps.js
 * 
 * Requires:
 * - SENTRY_AUTH_TOKEN in environment
 * - SENTRY_ORG, SENTRY_PROJECT in environment or .sentryclirc
 * - Built frontend in dist/
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SENTRY_ORG = process.env.SENTRY_ORG || 'mediflow';
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || 'mediflow-frontend';
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const DIST_DIR = path.resolve(process.cwd(), 'frontend', 'dist');
const RELEASE = process.env.SENTRY_RELEASE || `mediflow@${require('../frontend/package.json').version}`;

if (!SENTRY_AUTH_TOKEN) {
  console.error('❌ SENTRY_AUTH_TOKEN not set in environment');
  process.exit(1);
}

if (!fs.existsSync(DIST_DIR)) {
  console.error(`❌ Dist directory not found: ${DIST_DIR}`);
  console.error('   Run `npm run build` first');
  process.exit(1);
}

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Sentry Source Map Upload                                    ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log(`║  Release: ${RELEASE.padEnd(46)}║`);
console.log(`║  Org: ${SENTRY_ORG.padEnd(47)}║`);
console.log(`║  Project: ${SENTRY_PROJECT.padEnd(43)}║`);
console.log(`║  Dist Dir: ${DIST_DIR.padEnd(40)}║`);
console.log('╚══════════════════════════════════════════════════════════════╝\n');

function run(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', ...opts });
    return true;
  } catch (e) {
    console.error(`❌ Command failed: ${cmd}`);
    return false;
  }
}

async function main() {
  // 1. Create release in Sentry
  console.log('\n📦 Creating Sentry release...');
  if (!run(`npx sentry-cli releases new ${RELEASE} --org ${SENTRY_ORG} --project ${SENTRY_PROJECT}`)) {
    process.exit(1);
  }

  // 2. Upload source maps
  console.log('\n📤 Uploading source maps...');
  const sourcemapFiles = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.js.map'));
  
  if (sourcemapFiles.length === 0) {
    console.warn('⚠️  No source maps found in dist/');
    console.warn('   Ensure "sourcemap: true" in vite.config.ts');
  } else {
    console.log(`Found ${sourcemapFiles.length} source map files`);
    
    // Upload each source map
    for (const file of sourcemapFiles) {
      const filePath = path.join(DIST_DIR, file);
      const urlPrefix = `~/assets/${file.replace('.map', '')}`;
      
      if (!run(`npx sentry-cli releases files ${RELEASE} upload-sourcemaps "${filePath}" --url-prefix "${urlPrefix}" --org ${SENTRY_ORG} --project ${SENTRY_PROJECT}`)) {
        console.error(`❌ Failed to upload ${file}`);
        process.exit(1);
      }
    }
  }

  // 3. Associate commits (if in git repo)
  console.log('\n🔗 Associating commits...');
  try {
    run(`npx sentry-cli releases set-commits ${RELEASE} --auto --org ${SENTRY_ORG} --project ${SENTRY_PROJECT}`);
  } catch (e) {
    console.warn('⚠️  Could not associate commits (not a git repo or no commits)');
  }

  // 4. Finalize release
  console.log('\n✅ Finalizing release...');
  if (!run(`npx sentry-cli releases finalize ${RELEASE} --org ${SENTRY_ORG} --project ${SENTRY_PROJECT}`)) {
    process.exit(1);
  }

  // 5. Deploy notification (optional)
  if (process.env.SENTRY_DEPLOY_ENV) {
    console.log(`\n🚀 Recording deploy to ${process.env.SENTRY_DEPLOY_ENV}...`);
    run(`npx sentry-cli releases deploys ${RELEASE} new --env ${process.env.SENTRY_DEPLOY_ENV} --org ${SENTRY_ORG} --project ${SENTRY_PROJECT}`);
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Source maps uploaded successfully!                       ║');
  console.log(`║  Release: ${RELEASE.padEnd(46)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
}

main().catch(e => {
  console.error('❌ Upload failed:', e);
  process.exit(1);
});