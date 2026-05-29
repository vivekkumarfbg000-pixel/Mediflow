#!/usr/bin/env pwsh
# =============================================================================
# Mediflow Supabase Deployment Script
# Run this script ONCE after getting your Supabase Access Token.
#
# HOW TO GET YOUR ACCESS TOKEN:
#   1. Go to: https://supabase.com/dashboard/account/tokens
#   2. Click "Generate New Token"
#   3. Copy the token
#   4. Paste it below where it says YOUR_ACCESS_TOKEN_HERE
# =============================================================================

# ─── CONFIGURE THESE VALUES ──────────────────────────────────────────────────
$SUPABASE_ACCESS_TOKEN = "YOUR_ACCESS_TOKEN_HERE"   # From dashboard/account/tokens
$PROJECT_REF           = "kguupaybvbngyzyofjun"

# Supabase Vault Secrets — fill these in from your provider dashboards:
$CASHFREE_APP_ID       = "YOUR_CASHFREE_APP_ID"
$CASHFREE_SECRET_KEY   = "YOUR_CASHFREE_SECRET_KEY"
$CASHFREE_ENV          = "sandbox"                   # Change to "production" when ready

$META_ACCESS_TOKEN     = "YOUR_META_PLATFORM_SYSTEM_USER_TOKEN"
$META_PHONE_NUMBER_ID  = "YOUR_META_PHONE_NUMBER_ID"
$META_WABA_ID          = "YOUR_META_WABA_ID"
$META_VERIFY_TOKEN     = "mediflow_webhook_verify_token"   # Can be any secret string
$META_APP_SECRET       = "YOUR_META_APP_SECRET"

$GROQ_API_KEY          = "YOUR_GROQ_API_KEY"
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "🔗 Linking to Supabase project $PROJECT_REF..." -ForegroundColor Cyan
$env:SUPABASE_ACCESS_TOKEN = $SUPABASE_ACCESS_TOKEN
npx supabase link --project-ref $PROJECT_REF

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Link failed. Check your access token and project ref." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Project linked!" -ForegroundColor Green

Write-Host ""
Write-Host "🔐 Setting Vault Secrets..." -ForegroundColor Cyan

npx supabase secrets set `
    CASHFREE_APP_ID=$CASHFREE_APP_ID `
    CASHFREE_SECRET_KEY=$CASHFREE_SECRET_KEY `
    CASHFREE_ENV=$CASHFREE_ENV `
    META_ACCESS_TOKEN=$META_ACCESS_TOKEN `
    META_PHONE_NUMBER_ID=$META_PHONE_NUMBER_ID `
    META_WABA_ID=$META_WABA_ID `
    META_VERIFY_TOKEN=$META_VERIFY_TOKEN `
    META_APP_SECRET=$META_APP_SECRET `
    GROQ_API_KEY=$GROQ_API_KEY

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Secrets set failed." -ForegroundColor Red
    exit 1
}
Write-Host "✅ All secrets set!" -ForegroundColor Green

Write-Host ""
Write-Host "🚀 Deploying Edge Functions..." -ForegroundColor Cyan

$functions = @(
    "cashfree-order",
    "cashfree-webhook",
    "cashfree-vendor-sync",
    "meta-webhook",
    "whatsapp-dispatch",
    "notify-developer-webhook"
)

foreach ($fn in $functions) {
    Write-Host "   Deploying $fn..." -ForegroundColor Yellow
    npx supabase functions deploy $fn
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ❌ Failed to deploy $fn" -ForegroundColor Red
    } else {
        Write-Host "   ✅ $fn deployed!" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Your Edge Function URLs:" -ForegroundColor Cyan
foreach ($fn in $functions) {
    Write-Host "   https://$PROJECT_REF.supabase.co/functions/v1/$fn" -ForegroundColor White
}
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Run SQL migrations in Supabase Dashboard → SQL Editor" -ForegroundColor White
Write-Host "   2. Set secrets in Hugging Face Spaces (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGINS)" -ForegroundColor White
Write-Host "   3. Set env vars on Vercel (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_AI_BACKEND_URL, VITE_USE_MOCK=false)" -ForegroundColor White
Write-Host "   4. Register webhooks in Meta + Cashfree portals" -ForegroundColor White
