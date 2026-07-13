// Guards write endpoints: the caller must supply the username/password of an
// account with role "admin" (matches the app's existing plaintext login model
// — there is no session/token layer yet, so every write call re-proves identity).

import { sb } from './_supabase.js';

export async function requireAdmin(req, res) {
  const { adminUsername, adminPassword } = req.body || {};
  if (!adminUsername || !adminPassword) {
    res.status(401).json({ ok: false, error: 'ต้องระบุ adminUsername และ adminPassword' });
    return null;
  }

  const rows = await sb(
    'users?select=id,name,username,role,password&username=eq.' + encodeURIComponent(adminUsername) + '&limit=1'
  );
  const user = rows && rows[0];
  if (!user || user.password !== adminPassword || user.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์ดำเนินการ (ต้องเป็นผู้ดูแลระบบ)' });
    return null;
  }
  return user;
}
