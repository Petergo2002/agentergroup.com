/* eslint-disable */
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
for (const line of envLines) {
  if (line && !line.startsWith('#')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0]] = parts.slice(1).join('=');
    }
  }
}

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['SUPABASE_SERVICE_ROLE_KEY'];

async function check() {
  const res = await fetch(`${url}/rest/v1/widget_preview_drafts?select=payload,revision&order=created_at.desc&limit=1`, {
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`
    }
  });
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

check().catch(console.error);
