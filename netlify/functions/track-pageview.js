const crypto = require('crypto');

async function hashSHA256(value) {
  if (!value) return '';
  return crypto.createHash('sha256').update(value).digest('hex');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: '{}' };

  try {
    const data = JSON.parse(event.body);
    const PIXEL_ID = '1231230569192614';
    const CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';
    
    if (!CAPI_TOKEN) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, capi: false }) };
    }

    const eventId = data.eventId || ('pv_srv_' + Date.now().toString(36));
    
    const payload = {
      data: [{
        event_name: 'PageView',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: data.url || 'https://soligoair.shop',
        action_source: 'website',
        user_data: {
          client_user_agent: data.user_agent || '',
          client_ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'] || '',
          fbc: data.fbc || undefined,
          fbp: data.fbp || undefined,
        }
      }]
    };

    await fetch(`https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, capi: true }) };
  } catch (err) {
    console.error('Track PageView error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, capi: false }) };
  }
};
