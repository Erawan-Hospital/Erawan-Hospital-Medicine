// Thin wrapper around the Supabase PostgREST API using the service role key.
// The key never reaches the browser: it only exists as a Vercel env var and
// is used inside these serverless functions.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

// path examples: "medicines?select=*&order=name.asc", "medicines?id=eq.5"
export async function sb(path, { method = 'GET', body, prefer } = {}) {
  if (!supabaseConfigured()) {
    throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ใน Vercel Environment Variables');
  }
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json'
  };
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const msg = (data && data.message) ? data.message : (typeof data === 'string' ? data : 'Supabase request failed');
    throw new Error(msg);
  }
  return data;
}
