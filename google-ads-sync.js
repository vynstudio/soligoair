const fs = require('fs');
const path = require('path');
const SECRET = 'soligo-gads-2026';

const DATA_FILE = '/tmp/gads-data.json';

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  if (event.httpMethod === 'GET') {
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return { statusCode: 200, headers, body: data };
    } catch(e) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'No data yet. Run the Google Ads Script first.' }) };
    }
  }

  if (event.httpMethod === 'POST') {
    const auth = (event.headers['x-secret'] || event.headers['X-Secret'] || '').trim();
    if (auth !== SECRET) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized — wrong secret' }) };
    }
    try {
      const data = JSON.parse(event.body);
      data.lastSync = new Date().toISOString();
      fs.writeFileSync(DATA_FILE, JSON.stringify(data));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, campaigns: data.campaigns.length, keywords: data.keywords.length }) };
    } catch(e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: '' };
};
