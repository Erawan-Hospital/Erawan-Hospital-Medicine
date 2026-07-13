// Vercel Serverless Function: /api/medicines
// GET    -> list all medicine lots
// POST   -> create a new lot                { adminUsername, adminPassword, code, name, unit, warehouse, lot, expiry, qty }
// PUT    -> update a lot by id               { adminUsername, adminPassword, id, ...fields }
// DELETE -> remove a lot                     ?id=123  (adminUsername/adminPassword in body)

import { sb, supabaseConfigured } from './_supabase.js';
import { requireAdmin } from './_auth.js';

export default async function handler(req, res) {
  if (!supabaseConfigured()) {
    res.status(200).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Supabase ใน Vercel Environment Variables' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const rows = await sb('medicines?select=*&order=name.asc');
      res.status(200).json({ ok: true, medicines: rows });
      return;
    }

    if (req.method === 'POST') {
      if (!(await requireAdmin(req, res))) return;
      const { code, name, unit, warehouse, lot, expiry, qty } = req.body || {};
      if (!name) { res.status(400).json({ ok: false, error: 'ต้องระบุชื่อยา' }); return; }
      const [row] = await sb('medicines', {
        method: 'POST',
        prefer: 'return=representation',
        body: { code, name, unit, warehouse, lot, expiry: expiry || null, qty: qty || 0 }
      });
      res.status(200).json({ ok: true, medicine: row });
      return;
    }

    if (req.method === 'PUT') {
      if (!(await requireAdmin(req, res))) return;
      const { id, code, name, unit, warehouse, lot, expiry, qty } = req.body || {};
      if (!id) { res.status(400).json({ ok: false, error: 'ต้องระบุ id' }); return; }
      const [row] = await sb('medicines?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { code, name, unit, warehouse, lot, expiry: expiry || null, qty, updated_at: new Date().toISOString() }
      });
      res.status(200).json({ ok: true, medicine: row });
      return;
    }

    if (req.method === 'DELETE') {
      if (!(await requireAdmin(req, res))) return;
      const id = req.query.id;
      if (!id) { res.status(400).json({ ok: false, error: 'ต้องระบุ id' }); return; }
      await sb('medicines?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    res.status(200).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}
