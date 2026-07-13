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
    const [row] = await sb('medicines', {
      method: 'POST',
      prefer: 'return=representation',
      body: { name, lot, qty: delta, ...extra }
    });
    return row;
  }
  return null;
}
