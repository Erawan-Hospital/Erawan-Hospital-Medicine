// Vercel Serverless Function: /api/receiving
// GET  -> list receiving history
// POST -> log a new receiving entry and add its qty to the matching medicine lot
//         { adminUsername, adminPassword, name, unit, warehouse, qty, lot, expiry, person, place, code }

import { sb, supabaseConfigured } from './_supabase.js';
import { requireAdmin } from './_auth.js';
import { adjustQty } from './_stock.js';

export default async function handler(req, res) {
  if (!supabaseConfigured()) {
    res.status(200).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Supabase ใน Vercel Environment Variables' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const rows = await sb('receiving_logs?select=*&order=log_date.desc,id.desc');
      res.status(200).json({ ok: true, receiving: rows });
      return;
    }

    if (req.method === 'POST') {
      if (!(await requireAdmin(req, res))) return;
      const { name, unit, warehouse, qty, lot, expiry, person, place, code, log_date, log_time } = req.body || {};
      const qtyNum = Number(qty);
      if (!name || !lot || !qtyNum) {
        res.status(400).json({ ok: false, error: 'ต้องระบุชื่อยา, Lot และจำนวน' });
        return;
      }

      const [logRow] = await sb('receiving_logs', {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          log_date: log_date || new Date().toISOString().slice(0, 10),
          log_time: log_time || null,
          name, unit, qty: qtyNum, lot, expiry: expiry || null, person, place
        }
      });

      const medicine = await adjustQty(name, lot, qtyNum, { code, unit, warehouse, expiry: expiry || null });
      res.status(200).json({ ok: true, log: logRow, medicine });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    res.status(200).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}
