// Vercel Serverless Function: /api/users
// GET    -> list users (used only by the admin user-management page)
// POST   -> create a user     { adminUsername, adminPassword, name, username, password, role }
// PUT    -> update a user     { adminUsername, adminPassword, targetUsername, name, username, password, role }
// DELETE -> remove a user     ?username=xyz  (adminUsername/adminPassword in body)

import { sb, supabaseConfigured } from './_supabase.js';
import { requireAdmin } from './_auth.js';

export default async function handler(req, res) {
  if (!supabaseConfigured()) {
    res.status(200).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Supabase ใน Vercel Environment Variables' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const rows = await sb('users?select=name,username,role&order=id.asc');
      res.status(200).json({ ok: true, users: rows });
      return;
    }

    if (req.method === 'POST') {
      if (!(await requireAdmin(req, res))) return;
      const { name, username, password, role } = req.body || {};
      if (!name || !username || !password) {
        res.status(400).json({ ok: false, error: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
        return;
      }
      const dup = await sb('users?select=id&username=eq.' + encodeURIComponent(username) + '&limit=1');
      if (dup && dup.length) {
        res.status(400).json({ ok: false, error: 'ชื่อผู้ใช้งานนี้มีอยู่แล้ว' });
        return;
      }
      const [row] = await sb('users', {
        method: 'POST',
        prefer: 'return=representation',
        body: { name, username, password, role: role === 'admin' ? 'admin' : 'staff' }
      });
      res.status(200).json({ ok: true, user: { name: row.name, username: row.username, role: row.role } });
      return;
    }

    if (req.method === 'PUT') {
      if (!(await requireAdmin(req, res))) return;
      const { targetUsername, name, username, password, role } = req.body || {};
      if (!targetUsername || !name || !username) {
        res.status(400).json({ ok: false, error: 'ข้อมูลไม่ครบถ้วน' });
        return;
      }
      if (username !== targetUsername) {
        const dup = await sb('users?select=id&username=eq.' + encodeURIComponent(username) + '&limit=1');
        if (dup && dup.length) {
          res.status(400).json({ ok: false, error: 'ชื่อผู้ใช้งานนี้มีอยู่แล้ว' });
          return;
        }
      }
      const body = { name, username, role: role === 'admin' ? 'admin' : 'staff' };
      if (password) body.password = password;
      const [row] = await sb('users?username=eq.' + encodeURIComponent(targetUsername), {
        method: 'PATCH',
        prefer: 'return=representation',
        body
      });
      res.status(200).json({ ok: true, user: { name: row.name, username: row.username, role: row.role } });
      return;
    }

    if (req.method === 'DELETE') {
      if (!(await requireAdmin(req, res))) return;
      const username = req.query.username;
      if (!username) { res.status(400).json({ ok: false, error: 'ต้องระบุ username' }); return; }
      await sb('users?username=eq.' + encodeURIComponent(username), { method: 'DELETE' });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    res.status(200).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}
