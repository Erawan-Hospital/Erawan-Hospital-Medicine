// Vercel Serverless Function: /api/dispensing
// GET  -> list dispensing history
// POST -> log a new dispensing entry and subtract its qty from the matching medicine lot
//         { adminUsername, adminPassword, name, unit, qty, lot, expiry, person, place }

import { sb, supabaseConfigured } from './_supabase.js';
import { requireStaffOrAdmin } from './_auth.js';
import { adjustQty, findLot } from './_stock.js';

export default async function handler(req, res) {
  if (!supabaseConfigured()) {
    res.status(200).json({ ok: false, error: 'ยังไม่ได้ตั้งค่า Supabase ใน Vercel Environment Variables' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const rows = await sb('dispensing_logs?select=*&order=log_date.desc,id.desc');
      res.status(200).json({ ok: true, dispensing: rows });
      return;
    }

    if (req.method === 'POST') {
      if (!(await requireStaffOrAdmin(req, res))) return;
      const { name, unit, qty, lot, expiry, person, place, log_date, log_time } = req.body || {};
      const qtyNum = Number(qty);
      if (!name || !lot || !qtyNum) {
        res.status(400).json({ ok: false, error: 'ต้องระบุชื่อยา, Lot และจำนวน' });
        return;
      }

      const existing = await findLot(name, lot);
      if (!existing) {
        res.status(400).json({ ok: false, error: 'ไม่พบ Lot นี้ในคลัง — ต้องรับเข้าก่อนจึงจ่ายออกได้' });
        return;
      }
      if (Number(existing.qty || 0) < qtyNum) {
        res.status(400).json({ ok: false, error: 'จำนวนคงเหลือใน Lot นี้ไม่พอ (คงเหลือ ' + existing.qty + ')' });
        return;
      }

      const [logRow] = await sb('dispensing_logs', {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          log_date: log_date || new Date().toISOString().slice(0, 10),
          log_time: log_time || null,
          name, unit: unit || existing.unit, qty: qtyNum, lot, expiry: existing.expiry || expiry || null, person, place
        }
      });

      const medicine = await adjustQty(name, lot, -qtyNum);
      res.status(200).json({ ok: true, log: logRow, medicine });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    res.status(200).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}
