// Vercel Serverless Function: GET /api/data
// Reads the current snapshot from Supabase (medicines, receiving/dispensing
// logs, users) and returns it in the same JSON shape the frontend has always
// consumed. The frontend polls this every 5 minutes + on the refresh button.

import { sb, supabaseConfigured } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (!supabaseConfigured()) {
    res.status(200).json({
      ok: false,
      error: 'ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ใน Vercel Environment Variables'
    });
    return;
  }

  try {
    const [medicines, receiving, dispensing, users] = await Promise.all([
      sb('medicines?select=id,code,name,unit,warehouse,lot,expiry,qty&order=name.asc'),
      sb('receiving_logs?select=log_date,log_time,name,unit,qty,lot,expiry,person,place&order=log_date.desc'),
      sb('dispensing_logs?select=log_date,log_time,name,unit,qty,lot,expiry,person,place&order=log_date.desc'),
      sb('users?select=name,username,password,role&order=id.asc')
    ]);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json({
      ok: true,
      syncedAt: new Date().toISOString(),
      medicines,
      receiving: receiving.map(mapLog),
      dispensing: dispensing.map(mapLog),
      users
    });
  } catch (err) {
    res.status(200).json({
      ok: false,
      error: 'ดึงข้อมูลจาก Supabase ไม่สำเร็จ: ' + (err && err.message ? err.message : String(err))
    });
  }
}

function mapLog(r) {
  return {
    date: r.log_date,
    time: r.log_time || '',
    name: r.name,
    unit: r.unit,
    qty: r.qty,
    lot: r.lot,
    expiry: r.expiry,
    person: r.person,
    place: r.place
  };
}
