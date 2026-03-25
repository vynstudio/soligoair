# Soligo Air — Environment Variables Setup

## Required Netlify Environment Variables

Go to Netlify Dashboard → Site Settings → Environment Variables and add:

| Variable | Description | Example |
|---|---|---|
| `GHL_API_KEY` | GoHighLevel API key | `pit-xxxxx...` |
| `GHL_LOCATION_ID` | GHL Location ID | `CZn3wFkj4za8dc1Gsb6U` |
| `RESEND_API_KEY` | Resend email API key | `re_xxxxx...` |
| `META_CAPI_TOKEN` | Meta Conversions API token | `EAA...` |

## Optional Variables

| Variable | Default | Description |
|---|---|---|
| `NOTIFY_EMAIL` | `info@soligoair.shop` | Where to send lead notifications |
| `FROM_EMAIL` | `leads@soligoair.shop` | From address for lead emails |
| `GHL_WEBHOOK_URL` | (hardcoded fallback) | GHL webhook URL if changed |

## After adding variables
Trigger a new deploy from the Netlify dashboard for changes to take effect.
