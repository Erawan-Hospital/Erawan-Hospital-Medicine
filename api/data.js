// Vercel Serverless Function: GET /api/data
// Proxies the private Google Apps Script Web App (set in the SHEET_ENDPOINT env var),
// so the browser never sees the Apps Script URL and there are no CORS issues.
// The frontend (index.html) polls this every 5 minutes + on the refresh button.

export default async function handler(req, res) {
  // Same-origin in production, but allow simple GETs from anywhere just in case.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const endpoint = process.env.SHEET_ENDPOINT;
  if (!endpoint) {
    res.status(200).json({
      ok: false,
      error: 'ยังไม่ได้ตั้งค่า SHEET_ENDPOINT (Apps Script URL) ใน Vercel Environment Variables'
    });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const upstream = await fetch(endpoint, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timer);

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      res.status(200).json({
        ok: false,
        error: 'Apps Script ไม่ได้ตอบกลับเป็น JSON (ตรวจสอบการ Deploy และสิทธิ์ Anyone)',
        preview: text.slice(0, 200)
      });
      return;
    }

    if (data && data.ok === undefined) data.ok = true;

    // Cache at the edge for 60s, serve stale up to 5 min while revalidating.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(data);
  } catch (err) {
    res.status(200).json({
      ok: false,
      error: 'ดึงข้อมูลจาก Apps Script ไม่สำเร็จ: ' + (err && err.message ? err.message : String(err))
    });
  }
}
