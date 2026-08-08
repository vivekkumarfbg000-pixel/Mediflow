# Mediflow Production Infrastructure Secrets Checklist
# All secrets MUST be stored in Supabase Vault (Project Settings → Vault)
# NEVER commit secrets to git or .env files

## Required Vault Secrets

### Payment Gateway (Razorpay)
| Secret Name | Description | Format |
|-------------|-------------|--------|
| `RAZORPAY_KEY_ID` | Razorpay Key ID (live: `rzp_live_...`) | `rzp_live_XXXXXXXXXXXXXX` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret (NEVER in frontend) | `XXXXXXXXXXXXXXXXXXXX` |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signing secret (set in Razorpay Dashboard) | `Vitalsync_webhook_2026` |

### WhatsApp Business API (Meta)
| Secret Name | Description | Format |
|-------------|-------------|--------|
| `META_WHATSAPP_TOKEN` | Permanent access token from Meta Business Manager | `EAAXXXXXXXXXXXXX...` |
| `META_PHONE_NUMBER_ID` | WhatsApp Business Phone Number ID | `549557451578330` |
| `META_WABA_ID` | WhatsApp Business Account ID | `XXXXXXXXXXXXXXXX` |
| `META_APP_SECRET` | Meta App Secret (for signature verification) | `XXXXXXXXXXXXXXXX` |
| `META_VERIFY_TOKEN` | Webhook verify token (set in Meta Dashboard) | `mediflow_verify_2026` |

### Supabase & Database
| Secret Name | Description | Format |
|-------------|-------------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin access) | `sb_secret_XXXXXXXXXXXX...` |
| `SUPABASE_JWT_SECRET` | JWT signing secret (auto-generated) | `XXXXXXXXXXXXXXXXXXXX` |
| `DATABASE_URL` | Postgres connection string (for external tools) | `postgresql://...` |

### AI/ML Services
| Secret Name | Description | Format |
|-------------|-------------|--------|
| `GEMINI_API_KEY` | Google Gemini API key | `AIzaXXXXXXXXXXXX...` |
| `GROQ_API_KEY` | Groq API key | `gsk_XXXXXXXXXXXX...` |
| `MISTRAL_API_KEY` | Mistral API key | `XXXXXXXXXXXXXXXXXXXX` |
| `OPENAI_API_KEY` | OpenAI API key (if used) | `sk-XXXXXXXXXXXX...` |

### Monitoring & Error Tracking
| Secret Name | Description | Format |
|-------------|-------------|--------|
| `SENTRY_DSN` | Sentry DSN for error tracking | `https://XXXX@oXXXX.ingest.sentry.io/XXXX` |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (for source map upload) | `XXXXXXXXXXXXXXXXXXXX` |

### Email/SMS (if used)
| Secret Name | Description | Format |
|-------------|-------------|--------|
| `SENDGRID_API_KEY` | SendGrid API key | `SG.XXXXXXXXXXXX...` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `ACXXXXXXXXXXXX...` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `XXXXXXXXXXXXXXXXXXXX` |

### Storage & CDN
| Secret Name | Description | Format |
|-------------|-------------|--------|
| `AWS_ACCESS_KEY_ID` | AWS Access Key (for S3/CloudFront) | `AKIAXXXXXXXXXXXX` |
| `AWS_SECRET_ACCESS_KEY` | AWS Secret Key | `XXXXXXXXXXXXXXXXXXXX` |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | `XXXXXXXXXXXXXXXXXXXX` |

## Setting Secrets in Supabase Vault

```bash
# Using Supabase CLI (recommended)
supabase secrets set RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXX
supabase secrets set RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXX
supabase secrets set RAZORPAY_WEBHOOK_SECRET=Vitalsync_webhook_2026

supabase secrets set META_WHATSAPP_TOKEN=EAAXXXXXXXXXXXXX...
supabase secrets set META_PHONE_NUMBER_ID=549557451578330
supabase secrets set META_WABA_ID=XXXXXXXXXXXXXXXX
supabase secrets set META_APP_SECRET=XXXXXXXXXXXXXXXX
supabase secrets set META_VERIFY_TOKEN=mediflow_verify_2026

supabase secrets set SENTRY_DSN=https://XXXX@oXXXX.ingest.sentry.io/XXXX
supabase secrets set SENTRY_AUTH_TOKEN=XXXXXXXXXXXXXXXXXXXX

# List all secrets
supabase secrets list
```

## Verification Commands

```bash
# Test Razorpay credentials
curl -X POST https://api.razorpay.com/v1/orders \
  -u rzp_live_XXXXXXXXXXXXXX:XXXXXXXXXXXXXXXXXXXX \
  -H "Content-Type: application/json" \
  -d '{"amount": 51500, "currency": "INR"}'

# Test Meta WhatsApp token
curl -X GET "https://graph.facebook.com/v21.0/549557451578330" \
  -H "Authorization: Bearer EAAXXXXXXXXXXXXX..."

# Test Sentry DSN
curl -X POST "https://XXXX@oXXXX.ingest.sentry.io/api/XXXX/envelope/" \
  -H "Content-Type: application/x-sentry-envelope" \
  -d '{"event_id": "test"}'
```

## Production Deployment Checklist

- [ ] All vault secrets set in Supabase project
- [ ] Razorpay Dashboard: Webhook URL set to `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`
- [ ] Razorpay Dashboard: Webhook secret matches `RAZORPAY_WEBHOOK_SECRET`
- [ ] Meta Dashboard: Webhook URL set to `https://<project-ref>.supabase.co/functions/v1/meta-webhook`
- [ ] Meta Dashboard: Verify token matches `META_VERIFY_TOKEN`
- [ ] Sentry project created, DSN added to vault
- [ ] Source maps upload configured in CI/CD
- [ ] `VITE_SENTRY_DSN` in frontend `.env.production` (public DSN OK)
- [ ] All `VITE_*` vars in Vercel/Netlify dashboard
- [ ] No secrets in frontend bundle (verify with `grep -r "rzp_live_" dist/`)