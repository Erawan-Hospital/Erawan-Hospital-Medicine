// Guards write endpoints: the caller must supply the username/password of an
// account with role "admin" (matches the app's existing plaintext login model
// — there is no session/token layer yet, so every write call re-proves identity).

import { sb } from './_supabase.js';

async function findCaller(req, res) {
  const { adminUsername, adminPassword } = req.body || {};
  if (!adminUsername || !adminPassword) {
    res.status(401).json({ ok: false, error: 'ต้องระบุ adminUsername และ adminPassword' });
    return null;
  }
  const rows = await sb(
    'users?select=id,name,username,role,password&username=eq.' + encodeURIComponent(adminUsername) + '&limit=1'
  );
  const user = rows && rows[0];
  if (!user || user.password !== adminPassword) {
    res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์ดำเนินการ' });
    return null;
  }
  return user;
}

export async function requireAdmin(req, res) {
  const user = await findCaller(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์ดำเนินการ (ต้องเป็นผู้ดูแลระบบ)' });
    return null;
  }
  return user;
}

// Receiving/dispensing: staff can log stock movements, but only admin manages the drug catalog/users.
export async function requireStaffOrAdmin(req, res) {
  const user = await findCaller(req, res);
  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'staff') {
    res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์ดำเนินการ' });
    return null;
  }
  return user;
}
