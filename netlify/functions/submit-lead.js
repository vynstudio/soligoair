// Netlify serverless function — handles all lead form submissions
// 1. Creates contact in GHL via Contacts API
// 2. Sends to GHL Webhook as backup
// 3. Sends email notification via Resend
// NOTE: All secrets must be set as Netlify environment variables.
// Required vars: GHL_API_KEY, GHL_LOCATION_ID, RESEND_API_KEY
// Optional vars: NOTIFY_EMAIL, FROM_EMAIL, META_CAPI_TOKEN

async function hashSHA256(value) {
  if (!value) return '';
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(value).digest('hex');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { firstName, lastName, phone, email, service, zip_code, message, source, issue, sqft, estimate_range, source_page } = data;
    const fullName = ((firstName || '') + ' ' + (lastName || '')).trim() || 'Unknown';
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    // ── 1. Send to GHL Contacts API ──
    const GHL_KEY = process.env.GHL_API_KEY;
    const GHL_LOCATION = process.env.GHL_LOCATION_ID;

    if (!GHL_KEY || !GHL_LOCATION) {
      console.error('Missing GHL_API_KEY or GHL_LOCATION_ID env vars');
    }

    let ghlSuccess = false;
    if (GHL_KEY && GHL_LOCATION) {
      try {
        const ghlRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + GHL_KEY,
            'Version': '2021-07-28'
          },
          body: JSON.stringify({
            firstName: firstName || '',
            lastName: lastName || '',
            phone: phone || '',
            email: email || undefined,
            locationId: GHL_LOCATION,
            tags: ['vyn', 'new', 'soligo-web'],
            customFields: [
              { key: 'service_needed', field_value: service || '' },
              { key: 'zip_code', field_value: zip_code || '' },
              { key: 'issue', field_value: issue || '' },
              { key: 'sqft', field_value: sqft ? String(sqft) : '' },
              { key: 'estimate_range', field_value: estimate_range || '' },
              { key: 'source_page', field_value: source_page || '' }
            ],
            source: source || 'website'
          })
        });
        ghlSuccess = ghlRes.ok;
        if (!ghlRes.ok) {
          const errText = await ghlRes.text();
          console.error('GHL API error:', ghlRes.status, errText);
        }
      } catch (ghlErr) {
        console.error('GHL fetch error:', ghlErr);
      }
    }

    // ── 2. Send to GHL Webhook ──
    const webhookUrl = process.env.GHL_WEBHOOK_URL || 'https://services.leadconnectorhq.com/hooks/CZn3wFkj4za8dc1Gsb6U/webhook-trigger/ec732351-7639-4111-aae8-5d712e6fba49';
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName || '',
          lastName: lastName || '',
          name: fullName,
          phone: phone || '',
          email: email || '',
          service: service || '',
          service_needed: service || '',
          issue: issue || '',
          sqft: sqft || '',
          estimate_range: estimate_range || '',
          zip_code: zip_code || '',
          message: message || '',
          source: source || 'website',
          source_page: source_page || '',
          timestamp: new Date().toISOString()
        })
      });
    } catch (whErr) {
      console.error('Webhook fallback error:', whErr);
    }

    // ── 3. Send email notification via Resend ──
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'info@soligoair.shop';
    const FROM_EMAIL = process.env.FROM_EMAIL || 'leads@soligoair.shop';

    if (RESEND_KEY) {
      try {
        const htmlBody = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#002C6D;padding:20px 24px;text-align:center">
    <h1 style="color:white;margin:0;font-size:20px">New Lead — Soligo Air</h1>
  </div>
  <div style="padding:24px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;width:120px">Name</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b">${fullName}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Phone</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-weight:600;color:#1e293b"><a href="tel:${phone || ''}" style="color:#0095D9;text-decoration:none">${phone || 'N/A'}</a></td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Email</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b">${email ? '<a href="mailto:' + email + '" style="color:#0095D9;text-decoration:none">' + email + '</a>' : 'N/A'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Service</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-weight:600;color:#F75600">${service || 'N/A'}</td></tr>
      ${issue ? '<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Issue</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b">' + issue + '</td></tr>' : ''}
      ${sqft ? '<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Home Size</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b">' + sqft + ' sq ft</td></tr>' : ''}
      ${estimate_range ? '<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Estimate</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-weight:700;color:#002C6D;font-size:16px">' + estimate_range + '</td></tr>' : ''}
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Zip Code</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b">${zip_code || 'N/A'}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Source Page</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b;font-weight:600">${source_page || source || 'website'}</td></tr>
      ${message ? '<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b">Message</td><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#1e293b">' + message + '</td></tr>' : ''}
      <tr><td style="padding:10px 0;color:#64748b">Time</td><td style="padding:10px 0;color:#1e293b">${timestamp} ET</td></tr>
      ${message ? '<tr><td colspan="2" style="padding:14px 0 4px;border-top:2px solid #e2e8f0;color:#64748b;font-weight:600;font-size:13px;letter-spacing:.5px">CHAT TRANSCRIPT</td></tr><tr><td colspan="2" style="padding:8px 12px;background:#f1f5f9;border-radius:6px;font-family:monospace;font-size:12px;color:#334155;white-space:pre-wrap;line-height:1.6">' + message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</td></tr>' : ''}
    </table>
    <div style="margin-top:20px;text-align:center">
      <a href="tel:${phone || ''}" style="display:inline-block;background:#F75600;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Call ${firstName || 'Lead'} Now</a>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">GHL sync: ${ghlSuccess ? 'Success ✓' : 'Check GHL'} | Source: ${source_page || source || 'website'}</p>
  </div>
</div>`.trim();

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + RESEND_KEY
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: NOTIFY_EMAIL,
            subject: `New Lead: ${fullName} — ${service || 'AC Service'} (${source_page || source || 'website'})`,
            html: htmlBody
          })
        });
        if (!resendRes.ok) {
          console.error('Resend error:', resendRes.status, await resendRes.text());
        }
      } catch (emailErr) {
        console.error('Resend email error:', emailErr);
      }
    }

    // ── 4. META CONVERSIONS API (Server-side Lead event) ──
    try {
      const PIXEL_ID = '1231230569192614';
      const CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';
      if (CAPI_TOKEN) {
        const eventId = data.eventId || ('lead_srv_' + Date.now().toString(36) + Math.random().toString(36).substr(2,9));
        const hashedPhone = phone ? await hashSHA256(phone.replace(/\D/g, '')) : '';
        const hashedName = firstName ? await hashSHA256(firstName.toLowerCase().trim()) : '';

        const capiPayload = {
          data: [{
            event_name: 'Lead',
            event_time: Math.floor(Date.now() / 1000),
            event_id: eventId,
            event_source_url: data.source_url || 'https://soligoair.shop',
            action_source: 'website',
            user_data: {
              ph: hashedPhone ? [hashedPhone] : undefined,
              fn: hashedName ? [hashedName] : undefined,
              ct: [await hashSHA256('orlando')],
              st: [await hashSHA256('fl')],
              country: [await hashSHA256('us')],
              client_user_agent: data.user_agent || '',
              fbc: data.fbc || undefined,
              fbp: data.fbp || undefined,
            },
            custom_data: {
              service: service || '',
              source: source_page || source || '',
              zip: zip_code || '',
            }
          }]
        };

        await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(capiPayload)
        });
        console.log('Meta CAPI Lead event sent, eventId:', eventId);
      }
    } catch (capiErr) {
      console.error('Meta CAPI error:', capiErr);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, ghl: ghlSuccess })
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error', detail: err.message })
    };
  }
};
