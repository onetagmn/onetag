// otp.js — PostgreSQL + real email sending version
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('./db');

const OTP_TTL_MINUTES = 10;

function generateCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// Real email sending via Gmail SMTP, using an "App Password" (not your
// normal Gmail password — generate one at myaccount.google.com/apppasswords
// with 2-Step Verification turned on first).
// Falls back to just logging to the console if EMAIL_USER/EMAIL_APP_PASSWORD
// aren't set — this is what happens automatically during local testing.
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
  });
}

async function sendEmail(to, subject, text) {
  if (!transporter) {
    console.log(`\n[MOCK EMAIL — no EMAIL_USER/EMAIL_APP_PASSWORD set] To: ${to} | ${text}\n`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text });
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err.message);
    // Don't throw — a failed email shouldn't crash the request; the OTP
    // is still stored, so a resend attempt or console check can recover.
  }
}

async function sendOtp({ target, targetType, purpose, refId }) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await pool.query(`
    INSERT INTO otp_codes (target, target_type, purpose, ref_id, code, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [target, targetType, purpose, refId, code, expiresAt]);

  if (targetType === 'email') {
    await sendEmail(
      target,
      'Your OneTag verification code',
      `Your OneTag code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.`
    );
  } else {
    // SMS not implemented (project decided email-only) — log for visibility.
    console.log(`\n[MOCK SMS] To: ${target} | OTP: ${code} (expires in ${OTP_TTL_MINUTES} min)\n`);
  }

  return { sent: true, expiresInMinutes: OTP_TTL_MINUTES };
}

async function verifyOtp({ target, purpose, refId, code }) {
  const result = await pool.query(`
    SELECT * FROM otp_codes
    WHERE target = $1 AND purpose = $2 AND ref_id = $3 AND code = $4 AND used = 0
    ORDER BY id DESC LIMIT 1
  `, [target, purpose, refId, code]);
  const row = result.rows[0];

  if (!row) return { valid: false, reason: 'Invalid code' };
  if (new Date(row.expires_at) < new Date()) return { valid: false, reason: 'Code expired' };

  await pool.query(`UPDATE otp_codes SET used = 1 WHERE id = $1`, [row.id]);
  return { valid: true };
}

module.exports = { sendOtp, verifyOtp };
