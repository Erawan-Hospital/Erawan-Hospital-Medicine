// Vercel Serverless Function: /api/medicines
// GET    -> list all medicine lots
// POST   -> create a new lot                { adminUsername, adminPassword, code, name, unit, warehouse, lot, expiry, qty }
// PUT    -> update a lot by id               { adminUsername, adminPassword, id, code, ...fields }
//           an admin-supplied `code` cascades to every lot sharing that drug's
//           (pre-edit) name, keeping "one code per drug name" intact
// DELETE -> remove a lot                     ?id=123  (adminUsername/adminPassword in body)

import { sb, supabaseConfigured } from './_supabase.js';
import { requireAdmin } from './_auth.js';
import { getOrCreateCode } from './_stock.js';

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
      const { name, unit, warehouse, lot, expiry, qty, company } = req.body || {};
      if (!name) { res.status(400).json({ ok: false, error: 'ต้องระบุชื่อยา' }); return; }
      // รหัสยา is fixed per drug name — never taken from client input, always
      // reused from an existing lot of the same name or freshly minted.
      const code = await getOrCreateCode(name);
      const [row] = await sb('medicines', {
        method: 'POST',
        prefer: 'return=representation',
        body: { code, name, unit, warehouse, lot, expiry: expiry || null, qty: qty || 0, company }
      });
      res.status(200).json({ ok: true, medicine: row });
      return;
    }

    if (req.method === 'PUT') {
      if (!(await requireAdmin(req, res))) return;
      const { id, code, name, unit, warehouse, lot, expiry, qty, company } = req.body || {};
      if (!id) { res.status(400).json({ ok: false, error: 'ต้องระบุ id' }); return; }

      // รหัสยา is shared by every lot of the same drug name. An admin editing
      // it here must cascade the new code to every lot currently under that
      // name (matched before this edit, in case the name is changing too) so
      // codes never drift apart for the same drug.
      if (code && code.trim()) {
        const [existing] = await sb('medicines?id=eq.' + encodeURIComponent(id) + '&select=name,code');
        if (existing && code.trim() !== existing.code) {
          await sb('medicines?name=eq.' + encodeURIComponent(existing.name), {
            method: 'PATCH',
            body: { code: code.trim() }
          });
        }
      }

      const [row] = await sb('medicines?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { name, unit, warehouse, lot, expiry: expiry || null, qty, company, updated_at: new Date().toISOString() }
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
