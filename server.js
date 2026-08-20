const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { pool, initSchema, withTransaction } = require('./db');
const { sendOtp, verifyOtp } = require('./otp');

const app = express();
app.use(express.json());

// ---------- Scene photo uploads (super-admin "Website content" dashboard) ----------
// Render's own disk resets on every deploy, so an uploaded file can't live
// there — it goes to Cloudinary's free tier instead, a real persistent,
// CDN-backed image host. Configure by creating a free account at
// cloudinary.com and setting these three Render environment variables
// (Cloudinary dashboard → copy each value from the "API Environment
// variable" box):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
// Until those are set, everything else in the app works normally — only
// the "replace this photo" button on the content dashboard returns a clear
// "not configured" error instead of silently failing.
const CLOUDINARY_CONFIGURED = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
if (CLOUDINARY_CONFIGURED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
} else {
  console.warn('⚠️  CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET not set — scene photo uploads from the dashboard will report "not configured" until all three are set.');
}
const sceneUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — plenty for a full-bleed hero photo, small enough to keep uploads fast
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
});
function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'onetag-site', resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}
// Render sits behind a reverse proxy — without this, req.ip resolves to
// Render's internal proxy address for every request, making the
// per-IP rate limiting below effectively share one bucket across everyone.
app.set('trust proxy', 1);

// Every page (public tap page, dashboard, admin panel, gate reader) is
// served by this same Express app, so legitimate same-origin requests never
// need CORS at all — CORS only matters for a DIFFERENT website's JS trying
// to call this API from a visitor's browser. There's no legitimate reason
// for that today, so we only allow the real deployed origin(s) rather than
// '*'. Add more with a comma-separated ALLOWED_ORIGINS env var if a real
// second consumer (e.g. a native app or admin tool on another domain) is
// ever added.
const DEFAULT_ALLOWED_ORIGINS = ['https://onetag-0b04.onrender.com', 'http://localhost:3000'];
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : DEFAULT_ALLOWED_ORIGINS;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    // HTML pages must always be fetched fresh — staff, parents, and finders
    // should never be stuck on a stale cached version after we ship a fix.
    // Other static assets (if any are added later) can still cache normally.
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ---------- Basic rate limiting for sensitive endpoints ----------
const rateLimitBuckets = new Map();
function rateLimit(maxAttempts, windowMinutes) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    const bucket = rateLimitBuckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) { bucket.count = 0; bucket.resetAt = now + windowMs; }
    bucket.count++;
    rateLimitBuckets.set(key, bucket);
    if (bucket.count > maxAttempts) {
      const minutesLeft = Math.ceil((bucket.resetAt - now) / 60000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${minutesLeft} minute(s).` });
    }
    next();
  };
}

// ---------- Helpers ----------
function genTagId(n) { return `OT-${String(n).padStart(4, '0')}`; }
function genStaffId() { return 'ST-' + crypto.randomBytes(3).toString('hex').toUpperCase(); }
function normalizeUid(uid) { return (uid || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase(); }
function genSchoolId() { return 'SCH-' + crypto.randomBytes(3).toString('hex').toUpperCase(); }
function genAdminId() { return 'ADM-' + crypto.randomBytes(3).toString('hex').toUpperCase(); }
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}
function verifyPassword(password, hash, salt) {
  const attemptHash = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(attemptHash, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// Used for the shared device-secret keys (TAG_WRITE_KEY, GATE_DEVICE_KEY,
// ADMIN_KEY). A plain !== leaks how many leading characters matched via
// response timing — small, but free to close given how easy this is.
function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''));
  const bufB = Buffer.from(String(b ?? ''));
  if (bufA.length !== bufB.length) {
    // still run a comparison of equal-length buffers so the early return
    // for a length mismatch doesn't itself become a distinguishable signal
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---------- Admin auth middleware ----------
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing admin session token' });

    const sessionRes = await pool.query(`SELECT * FROM admin_sessions WHERE token = $1`, [token]);
    const session = sessionRes.rows[0];
    if (!session || new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired or invalid — please log in again' });
    }
    const adminRes = await pool.query(`SELECT * FROM admins WHERE admin_id = $1`, [session.admin_id]);
    const admin = adminRes.rows[0];
    if (!admin) return res.status(401).json({ error: 'Admin account not found' });

    req.admin = admin;
    next();
  } catch (err) { res.status(500).json({ error: err.message }); }
}
function requireSuperAdmin(req, res, next) {
  requireAdmin(req, res, () => {
    if (req.admin.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
    next();
  });
}
async function requireStaffAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing staff session token' });

    const sessionRes = await pool.query(`SELECT * FROM staff_sessions WHERE token = $1`, [token]);
    const session = sessionRes.rows[0];
    if (!session || new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired or invalid — please log in again' });
    }
    const staffRes = await pool.query(`SELECT * FROM staff WHERE staff_id = $1`, [session.staff_id]);
    const staff = staffRes.rows[0];
    if (!staff) return res.status(401).json({ error: 'Staff account not found' });

    req.staff = staff;
    next();
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ---------- Bootstrap: create the first super_admin if none exists ----------
async function bootstrapSuperAdmin() {
  const existingRes = await pool.query(`SELECT * FROM admins WHERE role = 'super_admin' LIMIT 1`);
  if (existingRes.rows[0]) return;

  const username = process.env.SUPER_ADMIN_USERNAME || 'ouqi';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'change-me-now';
  const { hash, salt } = hashPassword(password);
  await pool.query(`
    INSERT INTO admins (admin_id, username, email, password_hash, password_salt, status, role, school_id)
    VALUES ($1, $2, $3, $4, $5, 'active', 'super_admin', NULL)
  `, [genAdminId(), username, 'admin@onetag.local', hash, salt]);

  if (!process.env.SUPER_ADMIN_USERNAME) {
    console.warn(`⚠️  No super_admin existed — created one with username "${username}" and a DEFAULT password.`);
    console.warn('⚠️  Set SUPER_ADMIN_USERNAME and SUPER_ADMIN_PASSWORD env vars before deploying for real!');
  } else {
    console.log(`✔ Created super_admin account "${username}".`);
  }
}

// ---------- Schools ----------
app.get('/api/schools', async (req, res) => {
  const result = await pool.query(`SELECT school_id, name FROM schools ORDER BY name`);
  res.json(result.rows);
});

app.post('/api/admin/schools', requireSuperAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const schoolId = genSchoolId();
  await pool.query(`INSERT INTO schools (school_id, name) VALUES ($1, $2)`, [schoolId, name]);
  res.json({ success: true, school_id: schoolId, name });
});

app.get('/api/admin/schools', requireSuperAdmin, async (req, res) => {
  const result = await pool.query(`SELECT * FROM schools ORDER BY name`);
  res.json(result.rows);
});

// ---------- Admin accounts ----------
app.post('/api/admin/admins/invite', requireSuperAdmin, async (req, res) => {
  const { username, email, school_id, role } = req.body;
  if (!username || !email) return res.status(400).json({ error: 'username and email are required' });
  const finalRole = role === 'super_admin' ? 'super_admin' : 'school_admin';
  if (finalRole === 'school_admin' && !school_id) {
    return res.status(400).json({ error: 'school_id is required for a school_admin' });
  }
  if (school_id) {
    const schoolRes = await pool.query(`SELECT * FROM schools WHERE school_id = $1`, [school_id]);
    if (!schoolRes.rows[0]) return res.status(404).json({ error: 'Unknown school_id' });
  }

  const adminId = genAdminId();
  try {
    await pool.query(`
      INSERT INTO admins (admin_id, username, email, status, role, school_id)
      VALUES ($1, $2, $3, 'pending', $4, $5)
    `, [adminId, username, email, finalRole, school_id || null]);
  } catch (err) {
    return res.status(409).json({ error: 'That username is already taken' });
  }

  const result = await sendOtp({ target: email, targetType: 'email', purpose: 'admin_setup', refId: adminId });
  res.json({ success: true, admin_id: adminId, ...result });
});

// This verifies an OTP that activates an admin account (including a
// super_admin invite) and sets its password — it needs the same brute-force
// protection every other OTP-verify route already has.
app.post('/api/admin/admins/complete-setup', rateLimit(10, 15), async (req, res) => {
  // Accepts either the internal admin_id (ADM-XXXXXX) or the plain username —
  // school admins setting up their account only know their username, not the
  // internal ID, so username is the expected/primary way to look this up.
  const { admin_id, username, code, password } = req.body;
  const lookupValue = admin_id || username;
  if (!lookupValue || !code || !password) return res.status(400).json({ error: 'username, code, and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const adminRes = await pool.query(
    `SELECT * FROM admins WHERE admin_id = $1 OR username = $1`, [lookupValue]
  );
  const admin = adminRes.rows[0];
  if (!admin) return res.status(404).json({ error: 'No pending account found for that username' });
  if (admin.status !== 'pending') return res.status(409).json({ error: 'This account has already been activated. Try logging in instead.' });

  const result = await verifyOtp({ target: admin.email, purpose: 'admin_setup', refId: admin.admin_id, code });
  if (!result.valid) return res.status(401).json({ error: result.reason });

  const { hash, salt } = hashPassword(password);
  await pool.query(`UPDATE admins SET password_hash = $1, password_salt = $2, status = 'active' WHERE admin_id = $3`, [hash, salt, admin.admin_id]);
  res.json({ success: true });
});

app.get('/api/admin/admins', requireSuperAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT admins.admin_id, admins.username, admins.email, admins.status, admins.role,
           admins.school_id, schools.name AS school_name
    FROM admins LEFT JOIN schools ON schools.school_id = admins.school_id
    ORDER BY admins.created_at DESC
  `);
  res.json(result.rows);
});

app.delete('/api/admin/admins/:adminId', requireSuperAdmin, async (req, res) => {
  const { adminId } = req.params;
  if (adminId === req.admin.admin_id) return res.status(400).json({ error: "You can't delete your own account" });
  await pool.query(`DELETE FROM admin_sessions WHERE admin_id = $1`, [adminId]);
  const result = await pool.query(`DELETE FROM admins WHERE admin_id = $1`, [adminId]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Admin not found' });
  res.json({ success: true });
});

// ---------- Admin login ----------
app.post('/api/admin/login', rateLimit(10, 15), async (req, res) => {
  const { username, password } = req.body;
  const adminRes = await pool.query(`SELECT * FROM admins WHERE username = $1`, [username]);
  const admin = adminRes.rows[0];
  if (!admin || admin.status !== 'active') return res.status(401).json({ error: 'Invalid username or password' });
  if (!verifyPassword(password, admin.password_hash, admin.password_salt)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await pool.query(`INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES ($1, $2, $3)`, [token, admin.admin_id, expiresAt]);

  res.json({
    success: true, token,
    admin: { admin_id: admin.admin_id, username: admin.username, role: admin.role, school_id: admin.school_id }
  });
});

app.post('/api/admin/logout', requireAdmin, async (req, res) => {
  const token = (req.headers.authorization || '').slice(7);
  await pool.query(`DELETE FROM admin_sessions WHERE token = $1`, [token]);
  res.json({ success: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ admin_id: req.admin.admin_id, username: req.admin.username, role: req.admin.role, school_id: req.admin.school_id });
});

// ---------- Bulk tag provisioning ----------
app.post('/api/admin/provision', requireSuperAdmin, async (req, res) => {
  const count = parseInt(req.body.count, 10) || 0;
  if (count <= 0 || count > 5000) return res.status(400).json({ error: 'Invalid count' });

  const countRes = await pool.query(`SELECT COUNT(*) AS c FROM tags`);
  const existing = parseInt(countRes.rows[0].c, 10);
  const created = [];

  await withTransaction(async (client) => {
    for (let i = existing + 1; i <= existing + count; i++) {
      const tagId = genTagId(i);
      await client.query(`INSERT INTO tags (tag_id, status) VALUES ($1, 'unclaimed')`, [tagId]);
      created.push(tagId);
    }
  });
  res.json({ created: created.length, tag_ids: created });
});

// A shared secret for the tag-writer scripts (write-tags.js, prepare-tag.js)
// running on your laptop, which have no browser login session to attach a
// normal admin token to. Anyone who doesn't know this key can no longer
// silently rebind which physical wristband a tag_id points to.
const TAG_WRITE_KEY = process.env.TAG_WRITE_KEY || 'onetag-write-2026';
if (!process.env.TAG_WRITE_KEY) {
  console.warn('⚠️  WARNING: TAG_WRITE_KEY is not set as an environment variable — using the default fallback.');
  console.warn('⚠️  Set a real TAG_WRITE_KEY before deploying to production, or anyone could rebind a tag\'s UID.');
}

// ---------- UID registration ----------
app.post('/api/tag/:tagId/set-uid', rateLimit(30, 15), async (req, res) => {
  if (!timingSafeStringEqual(req.body.key, TAG_WRITE_KEY)) return res.status(401).json({ error: 'Invalid or missing write key' });
  const { tagId } = req.params;
  const uid = normalizeUid(req.body.uid);
  if (!uid) return res.status(400).json({ error: 'uid is required' });
  const tagRes = await pool.query(`SELECT * FROM tags WHERE tag_id = $1`, [tagId]);
  if (!tagRes.rows[0]) return res.status(404).json({ error: 'Unknown tag' });

  await withTransaction(async (client) => {
    await client.query(`UPDATE tags SET uid = NULL WHERE uid = $1 AND tag_id != $2`, [uid, tagId]);
    await client.query(`UPDATE tags SET uid = $1 WHERE tag_id = $2`, [uid, tagId]);
  });
  res.json({ success: true });
});

app.get('/api/tag/by-uid/:uid', async (req, res) => {
  const uid = normalizeUid(req.params.uid);
  const result = await pool.query(`SELECT * FROM tags WHERE uid = $1`, [uid]);
  if (!result.rows[0]) return res.status(404).json({ error: 'No tag registered with this UID' });
  res.json({ tag_id: result.rows[0].tag_id });
});

app.get('/api/tag/:tagId', async (req, res) => {
  const tagRes = await pool.query(`SELECT * FROM tags WHERE tag_id = $1`, [req.params.tagId]);
  const tag = tagRes.rows[0];
  if (!tag) return res.status(404).json({ error: 'Unknown tag' });
  const profileRes = await pool.query(`SELECT * FROM profiles WHERE tag_id = $1`, [req.params.tagId]);
  const profile = profileRes.rows[0];
  res.json({ tag, hasProfile: !!profile, locked: profile ? !!profile.locked : false });
});

// ---------- First-time registration ----------
// Rate-limited: without this, an unlocked-but-not-yet-resaved profile (see
// the editToken check below) could be hammered with repeated writes.
app.post('/api/profile/:tagId/register', rateLimit(20, 15), async (req, res) => {
  const { tagId } = req.params;
  const tagRes = await pool.query(`SELECT * FROM tags WHERE tag_id = $1`, [tagId]);
  if (!tagRes.rows[0]) return res.status(404).json({ error: 'Unknown tag' });

  const existingRes = await pool.query(`SELECT * FROM profiles WHERE tag_id = $1`, [tagId]);
  const existing = existingRes.rows[0];
  if (existing && existing.locked) {
    return res.status(409).json({ error: 'Profile already registered. Use edit + OTP to update.' });
  }
  // A profile that exists but is unlocked (locked=0) was unlocked by a
  // specific successful OTP verification, which handed the caller a
  // one-time editToken. Without checking that token here, ANYONE who knew
  // the tag_id could overwrite the child's profile — including swapping in
  // their own parent_phone/parent_email — for as long as the profile
  // happened to sit unlocked (e.g. the real parent verified OTP but never
  // finished saving). This closes that window: editing an existing profile
  // always requires the token minted for that specific unlock.
  if (existing && !existing.locked) {
    const { editToken } = req.body;
    if (!editToken || editToken !== existing.edit_token || new Date(existing.edit_token_expires_at) < new Date()) {
      return res.status(401).json({ error: 'Edit session expired or invalid — please request a new code.' });
    }
  }

  const {
    child_name, photo_url, school_id, school_name_other, class_name,
    emergency_contacts, health_info, parent_phone, parent_email
  } = req.body;

  if (!child_name || !parent_phone || !parent_email) {
    return res.status(400).json({ error: 'child_name, parent_phone, and parent_email are required' });
  }
  if (!emergency_contacts || !JSON.parse(JSON.stringify(emergency_contacts)).length) {
    return res.status(400).json({ error: 'At least one emergency contact is required' });
  }
  if (school_id) {
    const schoolRes = await pool.query(`SELECT * FROM schools WHERE school_id = $1`, [school_id]);
    if (!schoolRes.rows[0]) return res.status(400).json({ error: 'Unknown school_id' });
  }

  const now = new Date();
  if (existing) {
    await pool.query(`
      UPDATE profiles SET child_name=$1, photo_url=$2, school_id=$3, school_name_other=$4, class_name=$5,
        emergency_contacts=$6, health_info=$7, parent_phone=$8, parent_email=$9, locked=1, updated_at=$10,
        edit_token=NULL, edit_token_expires_at=NULL
      WHERE tag_id=$11
    `, [child_name, photo_url || null, school_id || null, school_name_other || null, class_name || null,
      JSON.stringify(emergency_contacts), JSON.stringify(health_info || {}), parent_phone, parent_email || null, now, tagId]);
  } else {
    await pool.query(`
      INSERT INTO profiles (tag_id, child_name, photo_url, school_id, school_name_other, class_name, emergency_contacts,
        health_info, parent_phone, parent_email, locked, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11)
    `, [tagId, child_name, photo_url || null, school_id || null, school_name_other || null, class_name || null,
      JSON.stringify(emergency_contacts), JSON.stringify(health_info || {}), parent_phone, parent_email || null, now]);
  }

  await pool.query(`UPDATE tags SET status='claimed' WHERE tag_id=$1`, [tagId]);
  res.json({ success: true, locked: true });
});

app.post('/api/profile/:tagId/request-otp', rateLimit(5, 15), async (req, res) => {
  const { tagId } = req.params;
  const { channel } = req.body;
  const profileRes = await pool.query(`SELECT * FROM profiles WHERE tag_id = $1`, [tagId]);
  const profile = profileRes.rows[0];
  if (!profile) return res.status(404).json({ error: 'No profile found for this tag' });

  const target = channel === 'email' ? profile.parent_email : profile.parent_phone;
  if (!target) return res.status(400).json({ error: `No ${channel} on file for this profile` });

  const result = await sendOtp({ target, targetType: channel === 'email' ? 'email' : 'sms', purpose: 'profile_edit', refId: tagId });
  const masked = target.length > 4 ? target.slice(0, 2) + '***' + target.slice(-2) : '***';
  res.json({ ...result, sentTo: masked });
});

app.post('/api/profile/:tagId/verify-otp', rateLimit(10, 15), async (req, res) => {
  const { tagId } = req.params;
  const { target, code } = req.body;
  const result = await verifyOtp({ target, purpose: 'profile_edit', refId: tagId, code });
  if (!result.valid) return res.status(401).json({ error: result.reason });

  // This token — not just the locked=0 flag — is what proves the caller
  // of /register is the same person who just solved the OTP. It's short
  // lived so an abandoned "verified but never saved" edit session can't be
  // hijacked by someone else who later finds the tag_id.
  const editToken = crypto.randomBytes(24).toString('hex');
  const editTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await pool.query(
    `UPDATE profiles SET locked = 0, edit_token = $1, edit_token_expires_at = $2 WHERE tag_id = $3`,
    [editToken, editTokenExpiresAt, tagId]
  );
  res.json({ success: true, editToken, note: 'Profile unlocked for editing. Re-locks on next save.' });
});

// This is the ONLY profile route reachable with no login at all — by
// design, it's what the public tap page shows anyone holding the
// wristband. It must never return parent contact info, raw emergency
// contact details, or anything beyond a name/photo/class/health-summary.
app.get('/api/profile/:tagId', async (req, res) => {
  const profileRes = await pool.query(`SELECT * FROM profiles WHERE tag_id = $1`, [req.params.tagId]);
  const profile = profileRes.rows[0];
  if (!profile) return res.status(404).json({ error: 'Not found' });

  const health = JSON.parse(profile.health_info || '{}');
  const contacts = JSON.parse(profile.emergency_contacts || '[]');

  res.json({
    tag_id: profile.tag_id, child_name: profile.child_name, photo_url: profile.photo_url, class_name: profile.class_name,
    health_summary: { allergies: health.allergies || null, conditions: health.conditions || null, blood_type: health.blood_type || null },
    contact_available: contacts.length > 0
  });
});

// Full profile (parent phone/email, raw emergency contacts, full health
// info) now requires an admin session, scoped to that admin's own school
// (super_admin can see any). This used to be reachable by anyone with no
// login at all via ?full=1 on the public route above — that was a real
// data leak of children's PII, closed here.
app.get('/api/admin/profile/:tagId/full', requireAdmin, async (req, res) => {
  const profileRes = await pool.query(`SELECT * FROM profiles WHERE tag_id = $1`, [req.params.tagId]);
  const profile = profileRes.rows[0];
  if (!profile) return res.status(404).json({ error: 'Not found' });
  if (req.admin.role !== 'super_admin' && profile.school_id !== req.admin.school_id) {
    return res.status(403).json({ error: "Not authorized for this student's school" });
  }
  const contacts = JSON.parse(profile.emergency_contacts || '[]');
  const health = JSON.parse(profile.health_info || '{}');
  res.json({ ...profile, emergency_contacts: contacts, health_info: health });
});

app.post('/api/scan/:tagId', rateLimit(20, 15), async (req, res) => {
  const { tagId } = req.params;
  const { lat, lng, role, client_timestamp } = req.body;
  const clientTs = client_timestamp && !isNaN(Date.parse(client_timestamp)) ? client_timestamp : null;
  await pool.query(`INSERT INTO scan_logs (tag_id, location_lat, location_lng, scanner_role, client_timestamp) VALUES ($1, $2, $3, $4, $5)`,
    [tagId, lat ?? null, lng ?? null, role || 'public', clientTs]);
  res.json({ success: true });
});

// ---------- Call Guardian relay ----------
// The parent's phone number is looked up and dialed entirely server-side.
// It is NEVER sent to the browser at any point — the public page only ever
// submits the VISITOR's own callback number. If Twilio credentials are
// configured, Twilio calls the visitor first and bridges them to the
// parent once they answer, so neither party's phone ever displays the
// other's real number.
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
  twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
} else {
  console.warn('⚠️  TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER not set — Call Guardian will report itself as "not configured" until all three are set.');
}

function normalizePhoneForDial(raw) {
  const cleaned = (raw || '').replace(/[^0-9+]/g, '');
  // Basic E.164-ish sanity check — reject anything that isn't a plausible
  // phone number before it ever gets near a TwiML string.
  return /^\+?[0-9]{7,15}$/.test(cleaned) ? cleaned : null;
}

app.post('/api/call-guardian/:tagId', rateLimit(10, 15), async (req, res) => {
  const { tagId } = req.params;
  const callerPhone = normalizePhoneForDial(req.body.caller_phone);
  if (!callerPhone) return res.status(400).json({ error: 'A valid caller_phone is required' });

  const profileRes = await pool.query(`SELECT parent_phone FROM profiles WHERE tag_id = $1`, [tagId]);
  const profile = profileRes.rows[0];
  const parentPhone = profile ? normalizePhoneForDial(profile.parent_phone) : null;
  if (!parentPhone) return res.status(404).json({ error: 'No guardian phone on file for this tag' });

  if (!twilioClient) {
    return res.json({ success: false, reason: 'not_configured' });
  }

  try {
    await twilioClient.calls.create({
      to: callerPhone,
      from: TWILIO_PHONE_NUMBER,
      twiml: `<Response><Say>Connecting you to the guardian now.</Say><Dial>${parentPhone}</Dial></Response>`
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Call Guardian relay failed:', err.message);
    res.status(500).json({ error: 'Failed to place call' });
  }
});

// ---------- Gate logs ----------
const MIN_MINUTES_BETWEEN_IN_AND_OUT = 30;

// Shared secret for the gate reader device (gate-listener.html), which has
// no browser login either — it's an unattended device sitting at a school
// gate. Without this, anyone who knew a tag_id could POST fake "arrived
// safely" / "left safely" events for a child who was never actually there.
const GATE_DEVICE_KEY = process.env.GATE_DEVICE_KEY || 'onetag-gate-2026';
if (!process.env.GATE_DEVICE_KEY) {
  console.warn('⚠️  WARNING: GATE_DEVICE_KEY is not set as an environment variable — using the default fallback.');
  console.warn('⚠️  Set a real GATE_DEVICE_KEY before deploying to production, or gate check-ins could be spoofed.');
}

app.post('/api/gate/:tagId', rateLimit(20, 15), async (req, res) => {
  if (!timingSafeStringEqual(req.body.key, GATE_DEVICE_KEY)) return res.status(401).json({ error: 'Invalid or missing device key' });
  const { tagId } = req.params;
  const { lat, lng, client_timestamp } = req.body;
  // Offline-queued taps replay this later with the real moment the tap
  // happened. Only accept a value that actually parses as a date — anything
  // else silently falls back to null (server-received time still applies
  // via the "timestamp" column's own DEFAULT NOW()).
  const clientTs = client_timestamp && !isNaN(Date.parse(client_timestamp)) ? client_timestamp : null;

  const todaysRes = await pool.query(`
    SELECT * FROM gate_logs WHERE tag_id = $1 AND timestamp::date = CURRENT_DATE ORDER BY timestamp ASC
  `, [tagId]);
  const todaysLogs = todaysRes.rows;

  // NOTE: the in/out decision and the 30-minute gap check below both still
  // key off "timestamp" (server receipt time), not client_timestamp — a
  // device queuing offline taps must replay them in the order they actually
  // happened (a plain FIFO queue) so this logic keeps behaving exactly like
  // it does for a device that was online the whole time.
  if (todaysLogs.length === 0) {
    await pool.query(`INSERT INTO gate_logs (tag_id, direction, location_lat, location_lng, client_timestamp) VALUES ($1, 'in', $2, $3, $4)`, [tagId, lat ?? null, lng ?? null, clientTs]);
    return res.json({ success: true, ignored: false, direction: 'in' });
  }
  if (todaysLogs.length >= 2) {
    return res.json({ success: true, ignored: true, message: 'Already recorded both in and out for today — this tap was not logged.' });
  }

  const inTime = new Date(todaysLogs[0].timestamp);
  const minutesSinceIn = (Date.now() - inTime.getTime()) / 60000;
  if (minutesSinceIn < MIN_MINUTES_BETWEEN_IN_AND_OUT) {
    return res.json({ success: true, ignored: true, message: `Too soon after arrival (${Math.round(minutesSinceIn)} min ago) to be a real departure — this tap was not logged.` });
  }

  await pool.query(`INSERT INTO gate_logs (tag_id, direction, location_lat, location_lng, client_timestamp) VALUES ($1, 'out', $2, $3, $4)`, [tagId, lat ?? null, lng ?? null, clientTs]);
  res.json({ success: true, ignored: false, direction: 'out' });
});

// Lets a gate-listener device prefetch its own school's UID -> tag_id
// mapping so it can resolve wristband taps to children entirely offline,
// instead of only caching mappings opportunistically as they're first
// seen. Gated by the same GATE_DEVICE_KEY the device already uses to
// write attendance — reading its own school's tag/UID pairs is a strictly
// smaller trust ask than that write access already grants. Returns only
// tag_id + uid, never names, photos, health info, or contacts.
app.get('/api/gate/roster', rateLimit(30, 15), async (req, res) => {
  if (!timingSafeStringEqual(req.query.key, GATE_DEVICE_KEY)) return res.status(401).json({ error: 'Invalid or missing device key' });
  const { school_id } = req.query;
  if (!school_id) return res.status(400).json({ error: 'school_id is required' });
  const result = await pool.query(`
    SELECT tags.tag_id, tags.uid FROM tags
    JOIN profiles ON profiles.tag_id = tags.tag_id
    WHERE profiles.school_id = $1 AND tags.uid IS NOT NULL
  `, [school_id]);
  res.json(result.rows);
});

// NOTE: /api/gate/:tagId/history and /api/scan/:tagId/history were removed —
// they returned a specific child's full location history with zero
// authentication, and nothing in the app actually used them. The dashboard
// uses /api/gate-logs and /api/scan-logs (admin-only, school-scoped), and
// the parent portal uses /api/parent/history (session-token scoped to that
// parent's own children). Neither needs a per-tag public history route.

app.get('/api/scan-logs', requireAdmin, async (req, res) => {
  const schoolFilter = req.admin.role === 'super_admin' ? '' : 'AND profiles.school_id = $1';
  const params = req.admin.role === 'super_admin' ? [] : [req.admin.school_id];
  const result = await pool.query(`
    SELECT scan_logs.*, profiles.child_name, profiles.class_name,
           COALESCE(schools.name, profiles.school_name_other) AS school_name
    FROM scan_logs
    LEFT JOIN profiles ON profiles.tag_id = scan_logs.tag_id
    LEFT JOIN schools ON schools.school_id = profiles.school_id
    WHERE 1=1 ${schoolFilter}
    ORDER BY timestamp DESC LIMIT 200
  `, params);
  res.json(result.rows);
});

app.get('/api/gate-logs', requireAdmin, async (req, res) => {
  const schoolFilter = req.admin.role === 'super_admin' ? '' : 'AND profiles.school_id = $1';
  const params = req.admin.role === 'super_admin' ? [] : [req.admin.school_id];
  const result = await pool.query(`
    SELECT
      gate_logs.tag_id, gate_logs.timestamp::date::text AS day,
      profiles.child_name, profiles.class_name,
      COALESCE(schools.name, profiles.school_name_other) AS school_name,
      MAX(CASE WHEN direction = 'in' THEN COALESCE(client_timestamp, timestamp) END) AS in_time,
      MAX(CASE WHEN direction = 'in' THEN location_lat END) AS in_lat,
      MAX(CASE WHEN direction = 'in' THEN location_lng END) AS in_lng,
      MAX(CASE WHEN direction = 'out' THEN COALESCE(client_timestamp, timestamp) END) AS out_time,
      MAX(CASE WHEN direction = 'out' THEN location_lat END) AS out_lat,
      MAX(CASE WHEN direction = 'out' THEN location_lng END) AS out_lng
    FROM gate_logs
    LEFT JOIN profiles ON profiles.tag_id = gate_logs.tag_id
    LEFT JOIN schools ON schools.school_id = profiles.school_id
    WHERE 1=1 ${schoolFilter}
    GROUP BY gate_logs.tag_id, day, profiles.child_name, profiles.class_name, schools.name, profiles.school_name_other
    ORDER BY day DESC, in_time DESC
    LIMIT 200
  `, params);
  res.json(result.rows);
});

// ---------- Teacher/staff OTP login ----------
// Requires an admin to be logged in — staff accounts should be created
// by someone with authority over that school, not by anyone who finds
// this endpoint.
app.post('/api/staff/register', requireAdmin, async (req, res) => {
  const { name, phone, email, role, school_id } = req.body;
  if (!name || (!phone && !email)) return res.status(400).json({ error: 'name and phone or email required' });
  // A school admin can only register staff for their own school; a super
  // admin may specify any school_id.
  const effectiveSchoolId = req.admin.role === 'super_admin' ? (school_id || null) : req.admin.school_id;
  const staffId = genStaffId();
  await pool.query(`INSERT INTO staff (staff_id, name, phone, email, role, school_id) VALUES ($1, $2, $3, $4, $5, $6)`,
    [staffId, name, phone || null, email || null, role || 'teacher', effectiveSchoolId]);
  res.json({ staff_id: staffId });
});

app.post('/api/staff/request-otp', rateLimit(5, 15), async (req, res) => {
  const { staff_id, channel } = req.body;
  const staffRes = await pool.query(`SELECT * FROM staff WHERE staff_id = $1`, [staff_id]);
  const staff = staffRes.rows[0];
  if (!staff) return res.status(404).json({ error: 'Unknown staff id' });
  const target = channel === 'email' ? staff.email : staff.phone;
  if (!target) return res.status(400).json({ error: `No ${channel} on file` });
  const result = await sendOtp({ target, targetType: channel, purpose: 'staff_login', refId: staff_id });
  res.json(result);
});

app.post('/api/staff/verify-otp', rateLimit(10, 15), async (req, res) => {
  const { staff_id, target, code } = req.body;
  const result = await verifyOtp({ target, purpose: 'staff_login', refId: staff_id, code });
  if (!result.valid) return res.status(401).json({ error: result.reason });
  // Actually persist the session this time — previously this token was
  // generated and handed to the client but never stored anywhere, so it
  // could never be validated on any later request.
  const sessionToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12-hour shift-length session
  await pool.query(`INSERT INTO staff_sessions (token, staff_id, expires_at) VALUES ($1, $2, $3)`, [sessionToken, staff_id, expiresAt]);
  res.json({ success: true, sessionToken });
});

app.get('/api/staff/:staffId/roster', requireStaffAuth, async (req, res) => {
  // Scoped to the logged-in staff member's own school only — previously
  // this ignored :staffId entirely and returned every child in every
  // school to anyone who called it, with no login required at all.
  const result = await pool.query(
    `SELECT tag_id, child_name, class_name FROM profiles WHERE school_id = $1 ORDER BY class_name, child_name`,
    [req.staff.school_id]
  );
  res.json(result.rows);
});

// ---------- Site language ----------
const ADMIN_KEY = process.env.ADMIN_KEY || 'onetag-admin-2026';
if (!process.env.ADMIN_KEY) {
  console.warn('⚠️  WARNING: ADMIN_KEY is not set as an environment variable — using the default fallback.');
  console.warn('⚠️  Set a real ADMIN_KEY before deploying to production, or anyone could guess it.');
}

app.get('/api/settings/language', async (req, res) => {
  const result = await pool.query(`SELECT value FROM settings WHERE key = 'site_language'`);
  res.json({ language: result.rows[0] ? result.rows[0].value : 'mn' });
});

app.post('/api/settings/language', async (req, res) => {
  const { language, adminKey } = req.body;
  if (!timingSafeStringEqual(adminKey, ADMIN_KEY)) return res.status(401).json({ error: 'Invalid admin key' });
  if (!['en', 'mn', 'zh', 'jp'].includes(language)) return res.status(400).json({ error: 'Unsupported language' });
  await pool.query(`UPDATE settings SET value = $1 WHERE key = 'site_language'`, [language]);
  res.json({ success: true, language });
});

// ---------- Parent portal ----------
app.post('/api/parent/request-otp', rateLimit(5, 15), async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const profilesRes = await pool.query(`SELECT * FROM profiles WHERE parent_phone = $1`, [phone]);
  const genericResponse = { success: true, message: 'If this number is registered, a code has been sent to the associated email.' };
  if (!profilesRes.rows.length) return res.json(genericResponse);

  const email = profilesRes.rows[0].parent_email;
  if (!email) return res.json(genericResponse);

  await sendOtp({ target: email, targetType: 'email', purpose: 'parent_portal', refId: phone });
  res.json(genericResponse);
});

app.post('/api/parent/verify-otp', rateLimit(10, 15), async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: 'phone and code are required' });

  const profilesRes = await pool.query(`SELECT * FROM profiles WHERE parent_phone = $1`, [phone]);
  if (!profilesRes.rows.length) return res.status(401).json({ error: 'Invalid code' });

  const result = await verifyOtp({ target: profilesRes.rows[0].parent_email, purpose: 'parent_portal', refId: phone, code });
  if (!result.valid) return res.status(401).json({ error: result.reason });

  const token = crypto.randomBytes(32).toString('hex');
  // 30-day session so a parent's device stays recognized between visits —
  // they only need to verify with OTP again after 30 days, or if they clear
  // their browser data / switch devices.
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await pool.query(`INSERT INTO parent_sessions (token, phone, expires_at) VALUES ($1, $2, $3)`, [token, phone, expiresAt]);
  res.json({ success: true, token });
});

app.get('/api/parent/history', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing session token' });

  const sessionRes = await pool.query(`SELECT * FROM parent_sessions WHERE token = $1`, [token]);
  const session = sessionRes.rows[0];
  if (!session || new Date(session.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Session expired or invalid — please request a new code' });
  }
  const phone = session.phone;

  const profilesRes = await pool.query(`SELECT tag_id, child_name FROM profiles WHERE parent_phone = $1`, [phone]);
  const history = [];
  for (const p of profilesRes.rows) {
    const gateRes = await pool.query(`SELECT * FROM gate_logs WHERE tag_id = $1 ORDER BY timestamp DESC LIMIT 30`, [p.tag_id]);
    const scanRes = await pool.query(`SELECT * FROM scan_logs WHERE tag_id = $1 ORDER BY timestamp DESC LIMIT 30`, [p.tag_id]);
    history.push({ tag_id: p.tag_id, child_name: p.child_name, gate_logs: gateRes.rows, scan_logs: scanRes.rows });
  }
  res.json(history);
});

// ---------- Editable homepage content ("Website content" dashboard) ----------
// Backs home.html's text (mn/en/jp), the 9 scroll-story scene photos, and
// section/card visibility toggles. See site-content-seed.js for what a
// fresh row looks like and db.js for the table + seeding.

// Public — home.html fetches this on every load (no login: it's the same
// page a public visitor already sees). Shaped for direct use by the page's
// existing i18n code rather than as a raw table dump.
app.get('/api/site-content', async (req, res) => {
  const result = await pool.query(`SELECT key, kind, mn, en, jp, image_url, visible FROM site_content`);
  const texts = {}, images = {}, blocks = {};
  for (const row of result.rows) {
    if (row.kind === 'text') texts[row.key] = { mn: row.mn, en: row.en, jp: row.jp };
    else if (row.kind === 'image') images[row.key] = { url: row.image_url };
    else if (row.kind === 'block') blocks[row.key] = { visible: row.visible };
  }
  res.json({ texts, images, blocks });
});

// Admin — full rows (incl. labels) for building the dashboard UI.
app.get('/api/admin/site-content', requireSuperAdmin, async (req, res) => {
  const result = await pool.query(`SELECT key, kind, label, mn, en, jp, image_url, visible, updated_at FROM site_content ORDER BY kind, key`);
  res.json(result.rows);
});

app.put('/api/admin/site-content/text/:key', requireSuperAdmin, async (req, res) => {
  const { key } = req.params;
  const { mn, en, jp } = req.body;
  const result = await pool.query(
    `UPDATE site_content SET mn = $1, en = $2, jp = $3, updated_at = NOW() WHERE key = $4 AND kind = 'text'`,
    [mn ?? null, en ?? null, jp ?? null, key]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Unknown text key' });
  res.json({ success: true });
});

app.put('/api/admin/site-content/block/:key', requireSuperAdmin, async (req, res) => {
  const { key } = req.params;
  const { visible } = req.body;
  if (typeof visible !== 'boolean') return res.status(400).json({ error: 'visible (boolean) is required' });
  const result = await pool.query(
    `UPDATE site_content SET visible = $1, updated_at = NOW() WHERE key = $2 AND kind = 'block'`,
    [visible, key]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Unknown block key' });
  res.json({ success: true, visible });
});

app.post('/api/admin/site-content/image/:key', requireSuperAdmin, (req, res) => {
  sceneUpload.single('photo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!CLOUDINARY_CONFIGURED) {
      return res.status(503).json({ error: 'Image uploads are not configured yet — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Render, then redeploy.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No photo file was uploaded' });
    const { key } = req.params;
    const existing = await pool.query(`SELECT key FROM site_content WHERE key = $1 AND kind = 'image'`, [key]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Unknown image key' });

    try {
      const uploaded = await uploadBufferToCloudinary(req.file.buffer);
      await pool.query(`UPDATE site_content SET image_url = $1, updated_at = NOW() WHERE key = $2`, [uploaded.secure_url, key]);
      res.json({ success: true, url: uploaded.secure_url });
    } catch (uploadErr) {
      console.error('Cloudinary upload failed:', uploadErr.message);
      res.status(502).json({ error: 'Upload to image host failed — please try again.' });
    }
  });
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await initSchema();
    await bootstrapSuperAdmin();
    app.listen(PORT, () => console.log(`OneTag running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
  }
})();
