// ═══════════════════════════════════════════════════════════════
// Soligo Air AI Chat — v3
// Improvements: page-context starter, dynamic chips, rate limiting,
//               returning lead welcome, transcript in email,
//               mobile keyboard fix, typing timeout, cost opt
// ═══════════════════════════════════════════════════════════════

// ── In-memory rate limiter (per cold start, good enough for abuse prevention)
const rateLimitMap = new Map();
const RATE_LIMIT = 12;      // requests
const RATE_WINDOW = 60000;  // per 60s

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

// ── Context-aware welcome messages based on referrer page
function getContextWelcome(refPage, knownName) {
  const name = knownName ? `, **${knownName}**` : '';
  if (refPage?.includes('ac-repair-cost')) {
    return `Hey${name}! 👋 Looks like you're checking repair costs — smart move. What's the issue with your AC so I can give you a realistic range?`;
  }
  if (refPage?.includes('signs-need-new-ac')) {
    return `Hey${name}! 👋 If you're reading about replacement signs, your AC might be telling you something. How old is your unit, and what's it doing?`;
  }
  if (refPage?.includes('ac-maintenance')) {
    return `Hey${name}! 👋 Maintenance is the best way to avoid breakdowns. Want to get on our tune-up schedule, or is something already acting up?`;
  }
  if (refPage?.includes('why-ac-stops')) {
    return `Hey${name}! 👋 Troubleshooting your AC? Tell me exactly what it's doing — I'll help you figure out if it's a quick fix or needs a tech.`;
  }
  if (refPage?.includes('calculator') || refPage?.includes('funnel')) {
    return `Hey${name}! 👋 Getting a quote? Tell me what's going on with your AC and I'll make sure we get you the right service.`;
  }
  if (knownName) {
    return `Welcome back, **${knownName}**! 👋 Your info is saved — a specialist will be in touch. Is there anything else about your AC I can help with?`;
  }
  return `Hi! 👋 I'm Soligo Air's AC specialist. What's going on with your AC today?`;
}

// ── Dynamic chip suggestions based on conversation state
function getContextChips(messages, leadCaptured) {
  if (leadCaptured) return [];
  if (!messages || messages.length <= 1) return [];
  
  const lastBot = [...messages].reverse().find(m => m.role === 'assistant')?.content?.toLowerCase() || '';
  
  // Name/phone/email questions — let them type freely
  if (lastBot.includes('name') || lastBot.includes('number') || lastBot.includes('reach') || 
      lastBot.includes('phone') || lastBot.includes('email') || lastBot.includes('who am i')) {
    return [];
  }
  
  // Problem diagnosis
  if (lastBot.includes('completely out') || lastBot.includes('not cooling') || 
      lastBot.includes('what is it doing') || lastBot.includes('describe') || lastBot.includes('what\'s happening')) {
    return [
      { label: 'Completely out', q: 'It stopped working completely' },
      { label: 'Not cooling well', q: 'It runs but blows warm air' },
      { label: 'Strange noises', q: 'Making unusual grinding or rattling noises' },
      { label: 'Water leaking', q: 'Water is leaking from the unit' },
      { label: 'Cycling on/off', q: 'It keeps turning on and off repeatedly' },
      { label: 'Bad smell', q: 'There is a bad smell coming from the vents' }
    ];
  }
  
  // AC age
  if (lastBot.includes('how old') || lastBot.includes('age') || lastBot.includes('years') || lastBot.includes('when was it installed')) {
    return [
      { label: 'Under 5 years', q: 'Under 5 years old' },
      { label: '5-10 years', q: '5 to 10 years old' },
      { label: '10-15 years', q: '10 to 15 years old' },
      { label: 'Over 15 years', q: 'Over 15 years old' },
      { label: 'Not sure', q: 'I\'m not sure how old it is' }
    ];
  }
  
  // Location/area
  if (lastBot.includes('where') || lastBot.includes('area') || lastBot.includes('located') || 
      lastBot.includes('city') || lastBot.includes('zip')) {
    return [
      { label: 'Orlando', q: 'Orlando' },
      { label: 'Kissimmee', q: 'Kissimmee' },
      { label: 'Winter Park', q: 'Winter Park' },
      { label: 'Other Central FL', q: 'Other Central Florida area' }
    ];
  }
  
  // Temperature/severity
  if (lastBot.includes('temperature') || lastBot.includes('how hot') || lastBot.includes('thermostat') || lastBot.includes('inside')) {
    return [
      { label: 'Over 85°F inside', q: 'It\'s over 85 degrees inside' },
      { label: '80-85°F', q: 'Around 80 to 85 degrees' },
      { label: '75-80°F', q: 'Around 75 to 80 degrees' },
      { label: 'Not too bad yet', q: 'Not dangerously hot yet' }
    ];
  }
  
  // Repair vs replace decision
  if (lastBot.includes('repair or replace') || lastBot.includes('worth repairing') || lastBot.includes('new system')) {
    return [
      { label: 'Prefer repair', q: 'I\'d prefer to repair if possible' },
      { label: 'Open to replacement', q: 'I\'m open to replacing it' },
      { label: 'Want both options', q: 'Can you give me pricing for both options?' },
      { label: 'What do you recommend?', q: 'What would you recommend?' }
    ];
  }
  
  // Service type
  if (lastBot.includes('what service') || lastBot.includes('looking for') || lastBot.includes('how can i help') || lastBot.includes('what can i')) {
    return [
      { label: '🔧 AC Repair', q: 'I need AC repair' },
      { label: '♻️ Replacement', q: 'I need an AC replacement' },
      { label: '🔍 Tune-up', q: 'I want a tune-up' },
      { label: '🌿 Air Quality', q: 'Indoor air quality help' }
    ];
  }

  // Scheduling
  if (lastBot.includes('schedule') || lastBot.includes('when') || lastBot.includes('available') || lastBot.includes('appointment')) {
    return [
      { label: 'Today', q: 'Today if possible' },
      { label: 'Tomorrow', q: 'Tomorrow works' },
      { label: 'This week', q: 'Sometime this week' },
      { label: 'Next week', q: 'Next week is fine' }
    ];
  }
  
  // Yes/no questions
  if (lastBot.includes('?') && (lastBot.includes('do you') || lastBot.includes('is it') || 
      lastBot.includes('are you') || lastBot.includes('would you') || lastBot.includes('have you'))) {
    return [
      { label: 'Yes', q: 'Yes' },
      { label: 'No', q: 'No' },
      { label: 'Not sure', q: 'I\'m not sure' }
    ];
  }
  
  return [];
}

const SYSTEM_PROMPT = `You are Soligo Air's chat assistant. Be DIRECT — max 20 words per response.

FLOW (capture one at a time):
1. Acknowledge issue in one sentence → ask: "What's your name?"
2. After name → "Thanks [name]! What's your phone number?"
3. After phone → "And your zip code?"
4. After zip → output LEAD_READY JSON + confirmation

CRITICAL: Ask ONE thing per message. Never combine questions.

LEAD FORMAT:
{"LEAD_READY":true,"firstName":"...","lastName":"...","phone":"...","email":"","zip_code":"...","service":"...","issue":"...","urgency":"hot|warm|cold"}

URGENCY: hot = AC out/emergency. warm = needs service. cold = researching.

AFTER LEAD:
HOT: "✅ [name], tech calling [phone] right away! Call **(321) 384-7868**. Code **SOLIGO25** = **$25 off**!"
WARM/COLD: "✅ [name], we'll call [phone] shortly! Code **SOLIGO25** = **$25 off**!"

RULES:
- 20 words max per reply
- ONE question per message, never two
- Never ask for email
- Extract service/issue from initial context
- HVAC topics only`;

async function submitLead(lead, host, transcript) {
  const [fName, ...lParts] = (lead.firstName || '').trim().split(' ');
  const firstName = fName || '';
  const lastName = lead.lastName || lParts.join(' ') || '';
  try {
    const res = await fetch(`https://${host}/.netlify/functions/submit-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        phone: lead.phone || '',
        email: lead.email || '',
        zip_code: lead.zip_code || '',
        service: lead.service || '',
        issue: lead.issue || '',
        source: `ai-chat-${lead.urgency || 'warm'}`,
        message: transcript || ''  // last 5 messages as plain text
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildTranscript(messages) {
  const last = messages.slice(-12);
  const convo = last.map(m => `${m.role === 'user' ? '👤 Visitor' : '🤖 AI'}: ${m.content}`).join('\n');
  return 'SOURCE: AI Chat Bot\n\n--- CONVERSATION ---\n' + convo + '\n--- END ---\nSubmitted: ' + new Date().toLocaleString('en-US', {timeZone: 'America/New_York'}) + ' ET';
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200 });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  // ── Rate limiting (improvement #3)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-nf-client-connection-ip')
    || 'unknown';

  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({
      reply: 'Too many messages. Call us directly: **(321) 384 7868**'
    }), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  let messages, partialLead, refPage, leadCaptured;
  try {
    const body = await req.json();
    messages = body.messages;
    partialLead = body.partialLead || {};
    refPage = body.refPage || '';        // page visitor came from
    leadCaptured = body.leadCaptured || false;
    if (!Array.isArray(messages) || !messages.length) throw new Error('No messages');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  // ── Welcome message for first message (improvement #1)
  if (messages.length === 1 && messages[0].role === 'user' && messages[0].content === '__WELCOME__') {
    const welcome = getContextWelcome(refPage, partialLead?.firstName || '');
    const chips = getContextChips([], leadCaptured);
    return new Response(JSON.stringify({ reply: welcome, chips }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  const apiKey = (typeof Netlify !== 'undefined' && Netlify.env.get('ANTHROPIC_API_KEY'))
    || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({
      reply: 'Our chat is temporarily unavailable. Call **(321) 384 7868**.'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  let aiReply;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,  // tighter = cheaper, still plenty
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
    const data = await res.json();
    aiReply = data?.content?.[0]?.text
      || 'Call **(321) 384 7868** or [get a free quote](https://soligoair.shop/#quote).';
  } catch {
    return new Response(JSON.stringify({
      reply: 'Call **(321) 384 7868** or [get a free quote](https://soligoair.shop/#quote).'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // ── Dynamic chips based on conversation state (improvement #2)
  const chips = getContextChips(messages, leadCaptured);

  // ── Check for LEAD_READY signal
  // Strip code fences
  let cleanReply = aiReply.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // Try to find and parse JSON - multiple patterns
  let lead = null;
  try {
    // Pattern 1: find JSON object with LEAD_READY
    const jsonMatch = cleanReply.match(/\{[\s\S]*?"LEAD_READY"\s*:\s*true[\s\S]*?\}/);
    if (jsonMatch) {
      // Clean up the JSON string - remove newlines inside, fix formatting
      const jsonStr = jsonMatch[0].replace(/\n\s*/g, ' ').replace(/,\s*\}/g, '}');
      lead = JSON.parse(jsonStr);
    }
  } catch(e) {
    // Pattern 2: try extracting fields manually
    try {
      const fn = cleanReply.match(/"firstName"\s*:\s*"([^"]*)"/)?.[1] || '';
      const ln = cleanReply.match(/"lastName"\s*:\s*"([^"]*)"/)?.[1] || '';
      const ph = cleanReply.match(/"phone"\s*:\s*"([^"]*)"/)?.[1] || '';
      const zp = cleanReply.match(/"zip_code"\s*:\s*"([^"]*)"/)?.[1] || '';
      const sv = cleanReply.match(/"service"\s*:\s*"([^"]*)"/)?.[1] || '';
      const is = cleanReply.match(/"issue"\s*:\s*"([^"]*)"/)?.[1] || '';
      const ur = cleanReply.match(/"urgency"\s*:\s*"([^"]*)"/)?.[1] || 'warm';
      if (fn && ph) {
        lead = { LEAD_READY: true, firstName: fn, lastName: ln, phone: ph, email: '', zip_code: zp, service: sv, issue: is, urgency: ur };
      }
    } catch {}
  }
  
  if (lead && lead.LEAD_READY) {
    const host = req.headers.get('host') || 'soligoair.shop';
    const transcript = buildTranscript(messages);
    const submitted = await submitLead(lead, host, transcript);
    const firstName = lead.firstName?.split(' ')[0] || 'there';
    const urgency = lead.urgency || 'warm';

    const confirmMsg = urgency === 'hot'
      ? `✅ ${firstName}, tech calling ${lead.phone} right away! Call **(321) 384-7868**. Code **SOLIGO25** = **$25 off**!`
      : `✅ ${firstName}, we'll call ${lead.phone} shortly! Code **SOLIGO25** = **$25 off**!`;

    return new Response(JSON.stringify({
      reply: confirmMsg,
      chips: [],
      leadCaptured: true,
      submitted,
      urgency,
      lead: { firstName: lead.firstName, lastName: lead.lastName, phone: lead.phone, email: lead.email, zip_code: lead.zip_code, service: lead.service }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // ALWAYS strip any JSON from the reply before showing to user
  const safeReply = cleanReply
    .replace(/\{[\s\S]*?"LEAD_READY"[\s\S]*?\}/g, '')
    .replace(/\{[\s\S]*?"firstName"[\s\S]*?\}/g, '')
    .replace(/"LEAD_READY"[\s\S]*?\}/g, '')
    .trim() || 'How can I help with your AC?';

  return new Response(JSON.stringify({ reply: safeReply, chips }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/api/chat' };
