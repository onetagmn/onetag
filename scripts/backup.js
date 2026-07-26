// scripts/backup.js — exports every table that matters for disaster
// recovery to a single gzipped JSON file, then (optionally) emails it to
// you via the same Gmail credentials the app already uses for OTP emails.
//
// Deliberately NOT included in the backup: admin_sessions, staff_sessions,
// parent_sessions, otp_codes. These are short-lived/ephemeral — losing
// them just means everyone logs in again, which is fine, and skipping
// them means an intercepted backup can't be replayed as a valid session.
//
// Run manually:
//   DATABASE_URL=... node scripts/backup.js
// Run on a schedule (recommended — see README "Backups" section):
//   set this up as a Render Cron Job service, running `npm run backup`
//   on whatever schedule you like (daily is reasonable for a school-scale
//   deployment), pointed at the same DATABASE_URL as the main app.
//
// Env vars:
//   DATABASE_URL         required — same one the main app uses
//   EMAIL_USER            optional — if set (along with EMAIL_APP_PASSWORD),
//   EMAIL_APP_PASSWORD     the backup is emailed as an attachment
//   BACKUP_EMAIL_TO       optional — where to send it (defaults to EMAIL_USER)
//   BACKUP_DIR             optional — local folder to also save a copy in
//                          (defaults to ./backups, always written)

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pool } = require('../db');

// Tables worth restoring after data loss. Order matters for restore.js —
// parents (schools/tags) before children (profiles reference both).
const TABLES = ['schools', 'tags', 'profiles', 'admins', 'staff', 'settings', 'gate_logs', 'scan_logs'];

async function exportAll() {
  const dump = { exportedAt: new Date().toISOString(), tables: {} };
  for (const table of TABLES) {
    const result = await pool.query(`SELECT * FROM ${table}`);
    dump.tables[table] = result.rows;
    console.log(`  ${table}: ${result.rows.length} rows`);
  }
  return dump;
}

async function sendByEmail(filePath, filename) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.log('EMAIL_USER/EMAIL_APP_PASSWORD not set — skipping email, backup saved locally only.');
    return;
  }
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
  });
  const to = process.env.BACKUP_EMAIL_TO || process.env.EMAIL_USER;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `OneTag backup — ${new Date().toISOString().slice(0, 10)}`,
    text: 'Automated OneTag database backup attached. Keep this somewhere safe — it contains children\'s data.',
    attachments: [{ filename, path: filePath }]
  });
  console.log(`Backup emailed to ${to}`);
}

(async () => {
  try {
    console.log('Exporting tables...');
    const dump = await exportAll();

    const dir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `onetag-backup-${new Date().toISOString().slice(0, 10)}.json.gz`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, zlib.gzipSync(JSON.stringify(dump)));
    console.log(`Saved: ${filePath}`);

    await sendByEmail(filePath, filename);

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
  }
})();
