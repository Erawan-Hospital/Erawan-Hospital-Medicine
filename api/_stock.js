// Shared helper: receiving/dispensing entries also adjust the matching
// medicines lot's qty (matched by name + lot). Receiving creates the lot if
// it doesn't exist yet; dispensing only adjusts an existing lot.

import { sb } from './_supabase.js';

export async function findLot(name, lot) {
  const rows = await sb(
    'medicines?select=*&name=eq.' + encodeURIComponent(name) + '&lot=eq.' + encodeURIComponent(lot) + '&limit=1'
  );
  return rows && rows[0] ? rows[0] : null;
}

// รหัสยา (drug code) is fixed per drug NAME, never per lot. Returns the
// existing code for this name if the catalog already has one, else null.
export async function findCodeByName(name) {
  const existing = await sb(
    'medicines?select=code&name=eq.' + encodeURIComponent(name) + '&code=not.is.null&order=id.asc&limit=1'
  );
  return existing && existing[0] && existing[0].code ? existing[0].code : null;
}

// Used only by the receiving/dispensing "log a movement for an unfamiliar
// lot" path, where there's no admin UI to type a code. Reuses the name's
// existing code if there is one; otherwise mints a sequential YA-##### code
// as a placeholder until an admin corrects it via รายการยา (codes there are
// always admin-entered — see api/medicines.js — since real values come from
// the Ministry and can't be auto-numbered).
export async function getOrCreateCode(name) {
  const found = await findCodeByName(name);
  if (found) return found;

  const rows = await sb('medicines?select=code&code=not.is.null');
  let maxNum = 1000;
  (rows || []).forEach(r => {
    const m = /(\d+)/.exec(r.code || '');
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  return 'YA-' + String(maxNum + 1).padStart(5, '0');
}

export async function adjustQty(name, lot, delta, extra) {
  const existing = await findLot(name, lot);
  if (existing) {
    const [row] = await sb('medicines?id=eq.' + existing.id, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: { qty: Math.max(0, Number(existing.qty || 0) + delta), updated_at: new Date().toISOString() }
    });
    return row;
  }
  if (delta > 0) {
    const code = await getOrCreateCode(name);
    const { code: _ignored, ...rest } = extra || {};
    const [row] = await sb('medicines', {
      method: 'POST',
      prefer: 'return=representation',
      body: { name, lot, qty: delta, code, ...rest }
    });
    return row;
  }
  return null;
}
