// Vercel Serverless Function: POST /api/login
// Checks username/password against Supabase server-side and returns the
// user WITHOUT the password field — the browser never needs to see anyone's
// password except the one the person typed into the login form themselves.

import { sb, supabaseConfigured } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  if (!supabaseConfigured()) {
    res.status(200).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Supabase ใน Vercel Environment Variables' });
    return;
  }

  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ ok: false, error: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' });
      return;
    }

    const rows = await sb('users?select=name,username,password,role&username=eq.' + encodeURIComponent(username) + '&limit=1');
    const user = rows && rows[0];
    if (!user || user.password !== password) {
      res.status(200).json({ ok: false, error: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    res.status(200).json({ ok: true, user: { name: user.name, username: user.username, role: user.role, password } });
  } catch (err) {
    res.status(200).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}
