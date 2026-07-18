# ระบบแจ้งเตือนยาใกล้หมดอายุและคลังยา — โรงพยาบาลเอราวัณ จังหวัดเลย

เว็บนี้อ่าน/เขียนข้อมูลจริงผ่าน **Supabase** (ฐานข้อมูล Postgres) และรันบน **Vercel**
หน้าจอจะอัปเดตให้เองแบบเรียลไทม์ทันทีที่มีการรับเข้า/จ่ายออก/แก้ไขยา — ไม่ต้องกดรีเฟรช

```
Supabase (Postgres + Realtime)  ◄──►  Vercel /api/*  ◄──►  เว็บ (index.html)
   medicines / receiving_logs /        service-role key,        Realtime subscription (public
   dispensing_logs / users             ตรวจสิทธิ์ admin/staff      anon key) + poll สำรองทุก 60 วิ
                                        ทุกคำสั่งเขียน              + ปุ่ม “รีเฟรชข้อมูล”
```

- **อ่านข้อมูล** (`/api/data`): ไม่ต้องมีสิทธิ์
- **เขียนข้อมูล** (`/api/medicines`, `/api/receiving`, `/api/dispensing`, `/api/users`, `/api/login`): ต้องส่ง username/password ของบัญชีที่มีสิทธิ์เหมาะสมมาด้วยทุกครั้ง (ไม่มี session token ฝั่ง server — ตรวจสิทธิ์ใหม่ทุกคำขอ)
  - รับเข้า/จ่ายออก: **admin หรือ staff**
  - จัดการรายการยา/ผู้ใช้งาน: **admin เท่านั้น**

---

## ขั้นตอนที่ 1 — ตั้งค่า Supabase

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com)
2. เปิด **SQL Editor → New query** แล้วรันไฟล์ตามลำดับนี้ (ทุกไฟล์ปลอดภัยที่จะรันซ้ำได้):
   1. [`supabase/schema.sql`](supabase/schema.sql) — สร้างตาราง `medicines`, `receiving_logs`, `dispensing_logs`, `users` พร้อมเปิด Row Level Security และสร้างบัญชีเริ่มต้น `admin` / `admin1234` และ `staff` / `staff1234`
   2. [`supabase/enable_realtime.sql`](supabase/enable_realtime.sql) — **จำเป็น** สำหรับฟีเจอร์อัปเดตเรียลไทม์: เปิดสิทธิ์อ่านสาธารณะเฉพาะ 3 ตาราง (ไม่รวม `users` — รหัสผ่านเข้าถึงไม่ได้จากฝั่ง browser) และเพิ่มตารางเข้า realtime publication
   3. [`supabase/add_company_column.sql`](supabase/add_company_column.sql) — เผื่อกรณีฐานข้อมูลเก่าที่สร้างก่อนมีคอลัมน์บริษัทยา (schema.sql ปัจจุบันมีคอลัมน์นี้อยู่แล้ว รันซ้ำได้ไม่มีผลเสีย)
   4. [`supabase/fix_duplicate_codes.sql`](supabase/fix_duplicate_codes.sql) — ใช้เฉพาะตอน migrate ข้อมูลเก่าที่ยังไม่มีกติกา "1 ชื่อยา = 1 รหัส" ไม่จำเป็นสำหรับฐานข้อมูลใหม่
3. ไปที่ **Project Settings → API** แล้วคัดลอก 2 ค่า:
   - **Project URL** (เช่น `https://xxxx.supabase.co`)
   - **service_role key** (secret — ใช้ฝั่ง Vercel เท่านั้น ห้ามใส่ในโค้ดฝั่งเว็บ)

> **รหัสผ่านผู้ใช้งาน** เก็บเป็นข้อความธรรมดาในตาราง `users` (ยังไม่ได้ hash) — เป็นข้อจำกัดที่ทราบอยู่แล้วของระบบ ควรจำกัดผู้เข้าถึง Supabase dashboard เฉพาะผู้ดูแล

---

## ขั้นตอนที่ 2 — ตั้งค่า Vercel Environment Variables

ในโปรเจกต์ Vercel → **Settings → Environment Variables** เพิ่ม:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | Project URL จากขั้นตอนที่ 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key จากขั้นตอนที่ 1 |

ตั้งค่าที่ Environment **Production** (และ Preview ถ้าต้องการ) แล้วไปที่แท็บ **Deployments → … → Redeploy** เพื่อให้มีผล

**ถ้าใช้ Supabase โปรเจกต์อื่นนอกเหนือจากที่ตั้งค่าไว้แล้ว** ต้องแก้ค่าคงที่ 2 ตัวนี้ในไฟล์ `index.html` ด้วย (ค้นหา `SUPABASE_URL` ใกล้ต้นของ `<script data-dc-script>`) — ค่านี้คือ **anon/publishable key** ที่ตั้งใจให้เห็นได้จากฝั่งเว็บ (ปลอดภัยเพราะพึ่ง Row Level Security ไม่ใช่ secret) ใช้สำหรับ subscribe ฟังก์ชันเรียลไทม์เท่านั้น

---

## ขั้นตอนที่ 3 — Deploy ขึ้น Vercel

โฟลเดอร์นี้เป็น Git repo พร้อม deploy (ปัจจุบันเชื่อมกับ GitHub repo `Erawan-Hospital/Erawan-Hospital-Medicine` และ Vercel แล้ว — push ขึ้น `main` จะ deploy อัตโนมัติ)

สำหรับตั้งค่าใหม่ตั้งแต่ต้น:
1. Push โฟลเดอร์นี้ขึ้น GitHub repository (private แนะนำ)
2. ที่ [vercel.com](https://vercel.com) → **Add New… → Project** → เลือก repo → Framework Preset: **Other** → **Deploy**
3. ตั้งค่า Environment Variables ตามขั้นตอนที่ 2 แล้ว Redeploy

---

## การเข้าสู่ระบบ

ใช้บัญชีจากตาราง `users` ใน Supabase — ค่าเริ่มต้นจาก `schema.sql`:

| Username | Password | สิทธิ์ |
|----------|----------|--------|
| `admin` | `admin1234` | admin — จัดการรายการยา/ผู้ใช้งาน/ตั้งค่า ได้ครบ |
| `staff` | `staff1234` | staff — บันทึกรับเข้า/จ่ายออกได้ ดูรายงานได้ ไม่เห็นเมนูผู้ดูแล |

แนะนำให้ผู้ดูแลเปลี่ยนรหัสผ่านเริ่มต้น และเพิ่มบัญชีจริงผ่านหน้า **ผู้ดูแลระบบ** ในเว็บ (เฉพาะ admin)

Session เก็บใน localStorage ของเบราว์เซอร์ และหมดอายุอัตโนมัติหลังไม่ได้ใช้งาน **4 ชั่วโมง**

---

## รหัสยา (drug code)

รหัสยาออกโดยกระทรวงสาธารณสุข **ไม่ใช่เลขที่ระบบสุ่มให้** ดังนั้น:
- **Admin เท่านั้น** ที่กรอก/แก้ไขรหัสยาได้ (ในหน้า "รายการยา")
- เพิ่มล็อตของยาที่มีชื่อซ้ำกับที่มีอยู่แล้ว → ระบบดึงรหัสเดิมมาให้อัตโนมัติ (ยังแก้ไขได้)
- เพิ่มยาชื่อใหม่ที่ไม่เคยมีในระบบ → ต้องกรอกรหัสเอง จะบันทึกไม่ได้ถ้าเว้นว่าง
- แก้ไขรหัสของล็อตใดล็อตหนึ่ง → ระบบจะปรับรหัสให้ตรงกัน **ทุกล็อต** ของยาชื่อนั้นโดยอัตโนมัติ (กติกา "1 ชื่อยา = 1 รหัส")

## การอัปเดตข้อมูลแบบเรียลไทม์

- เว็บ subscribe Supabase Realtime บนตาราง `medicines`, `receiving_logs`, `dispensing_logs` — มีการเปลี่ยนแปลงจากที่ไหนก็ตาม (ผ่านเว็บนี้ หรือแก้ตรงในฐานข้อมูล) จะอัปเดตหน้าจอเกือบจะทันที
- มี poll สำรองทุก 60 วินาที เผื่อ WebSocket หลุด และปุ่ม **🔄 รีเฟรชข้อมูล** ให้กดเองได้เสมอ
- แถบสถานะบน Dashboard: 🟢 เขียว = เชื่อมต่อสำเร็จ, 🔴 แดง = เชื่อมต่อไม่ได้ (ตรวจสอบ Environment Variables ใน Vercel)

## ฟีเจอร์อื่นๆ

- **PDF/พิมพ์รายงาน**: ทุกหน้าตารางมีปุ่ม 🖨️ PDF พิมพ์ได้ทันที (มี header ซ้ำทุกหน้าเวลาพิมพ์)
- **แจ้งเตือนยาใกล้หมดอายุ**: กำหนดเกณฑ์วันได้ในหน้าตั้งค่า (admin) พร้อมปุ่มจำลองการส่ง LINE
- **Audit log**: บันทึกการกระทำสำคัญ (เพิ่ม/แก้/ลบยา, รับเข้า/จ่ายออก, เข้า-ออกระบบ) ดูได้ในหน้าผู้ดูแลระบบ

---

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|------|---------|
| `index.html` | ตัวเว็บทั้งหมด (UI + logic + Realtime client) |
| `support.js` | รันไทม์ของหน้าเว็บ (dc-runtime — โหลด React/Babel จาก CDN แล้ว render `index.html`) |
| `assets/` | โลโก้และเสียงแจ้งเตือน |
| `api/data.js` | อ่านข้อมูลทั้งหมดจาก Supabase (ไม่ต้องมีสิทธิ์) |
| `api/medicines.js` | CRUD รายการยา (admin เท่านั้น) — รวมกติการหัสยา |
| `api/receiving.js`, `api/dispensing.js` | บันทึกรับเข้า/จ่ายออก (admin หรือ staff) |
| `api/users.js` | จัดการบัญชีผู้ใช้งาน (admin เท่านั้น) |
| `api/login.js` | ตรวจสอบชื่อผู้ใช้/รหัสผ่าน |
| `api/_supabase.js`, `api/_auth.js`, `api/_stock.js` | helper ภายใน (เรียก Supabase, ตรวจสิทธิ์, ปรับยอดคงคลัง) |
| `supabase/*.sql` | สคริปต์ตั้งค่า/migrate ฐานข้อมูล (รันใน Supabase SQL Editor) |
| `vercel.json`, `package.json` | ตั้งค่า Vercel |
| `คลังยา Dashboard.dc.html` | ไฟล์ต้นฉบับจาก Claude Design — **ไม่ได้ sync ตามล่าสุดแล้ว** (โปรเจกต์ย้ายมาใช้ `index.html` เป็นหลักตั้งแต่ย้ายไป Supabase) เก็บไว้เพื่ออ้างอิงเท่านั้น
