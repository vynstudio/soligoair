const https = require('https');

const TOKEN = 'EAA7rtlAOrhMBQ3zdXZBG8BNan7sp7GOc5aH3FClGAoE1vEhZB7zc6yxbd8GYcDUFg5ipOoTPlBVmTtVJCpEqDgZAny9NUgYpiQACspS2oBUrpQYZBIMq1lVXPIECLEPyHMu8S58xLcTbAMHs765GX5hZCf2ZCbh0du4td67b9aT9uzBK50pMLvinmjkdhdd5ytcQbu2WjI7VPwGkydCaqsZCGhOJgZAeg2SiKZCKWN4OMNSc4MVUyXPoLoqnSJrRMRkZBogUsUnjylikc78b4qfL6Jckns';
const ACCT = 'act_824057136964373';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

function httpsGet(path) {
  return new Promise((resolve, reject) => {
    const sep = path.includes('?') ? '&' : '?';
    const fullPath = '/v19.0' + path + sep + 'access_token=' + TOKEN;
    const options = { hostname: 'graph.facebook.com', path: fullPath, method: 'GET' };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(path, params) {
  return new Promise((resolve, reject) => {
    params.access_token = TOKEN;
    const body = Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
    const options = {
      hostname: 'graph.facebook.com',
      path: '/v19.0' + path,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    const { action, params = {} } = JSON.parse(event.body || '{}');
    let data;

    switch (action) {
      case 'get_campaigns':
        data = await httpsGet('/' + ACCT + '/campaigns?fields=id,name,status,objective,daily_budget,start_time&limit=50');
        break;
      case 'get_insights':
        data = await httpsGet('/' + ACCT + '/insights?fields=campaign_name,campaign_id,spend,cpc,cpm,clicks,impressions,cost_per_result&date_preset=' + (params.date_preset || 'last_30d') + '&level=campaign');
        break;
      case 'get_adsets':
        data = await httpsGet('/' + params.campaign_id + '/adsets?fields=id,name,status,daily_budget,optimization_goal');
        break;
      case 'create_campaign':
        data = await httpsPost('/' + ACCT + '/campaigns', {
          name: params.name,
          objective: params.objective || 'OUTCOME_LEADS',
          status: params.status || 'PAUSED',
          special_ad_categories: '[]',
          daily_budget: String(params.daily_budget || '3000')
        });
        break;
      case 'pause_campaign':
        data = await httpsPost('/' + params.campaign_id, { status: 'PAUSED' });
        break;
      case 'resume_campaign':
        data = await httpsPost('/' + params.campaign_id, { status: 'ACTIVE' });
        break;
      case 'set_budget':
        data = await httpsPost('/' + params.campaign_id, { daily_budget: String(Math.round(params.amount * 100)) });
        break;
      case 'ping':
        data = await httpsGet('/me?fields=name,id');
        break;
      default:
        return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Unknown action: ' + action }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify(data) };

  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
