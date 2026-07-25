# Mediflow — Local Secret & Key Leak Scanner
# Run this script before committing to ensure no private keys or tokens leak into Git.

Write-Host "🛡️ Running Mediflow Zero-Trust Secret Leak Scan..." -ForegroundColor Cyan

$leakPatterns = @(
  'sb_secret_[a-zA-Z0-9_-]+',
  'sb_publishable_[a-zA-Z0-9_-]+',
  'vca_[a-zA-Z0-9_-]+',
  'sk_live_[a-zA-Z0-9_-]+',
  'ghp_[a-zA-Z0-9_-]+',
  'AIzaSy[a-zA-Z0-9_-]{33}',
  'AKIA[0-9A-Z]{16}'
)

$foundLeaks = $false

foreach ($pattern in $leakPatterns) {
  $matches = git grep -E $pattern -- ':!node_modules' ':!package-lock.json' ':!*.md' ':!supabase/functions/_shared/cors.ts' 2>$null
  if ($matches) {
    Write-Host "🚨 SECRET LEAK DETECTED: Pattern '$pattern'" -ForegroundColor Red
    Write-Host $matches -ForegroundColor Yellow
    $foundLeaks = $true
  }
}

# Verify private .env files are not tracked (allow .env.example templates)
$envFiles = git ls-files | Select-String -Pattern '^\.env|\/\.env' | Where-Object { $_ -notmatch '\.example$' }
if ($envFiles) {
  Write-Host "🚨 CRITICAL: Real .env secret file is tracked by git!" -ForegroundColor Red
  Write-Host $envFiles -ForegroundColor Yellow
  $foundLeaks = $true
}

if ($foundLeaks) {
  Write-Host "❌ SCAN FAILED: Remove all hardcoded secret keys before pushing to GitHub." -ForegroundColor Red
  exit 1
} else {
  Write-Host "✅ SCAN PASSED: Zero hardcoded secrets or API key leaks detected." -ForegroundColor Green
  exit 0
}
