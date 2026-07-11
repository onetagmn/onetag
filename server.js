const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { pool, initSchema, withTransaction } = require('./db');
const { sendOtp, verifyOtp } = require('./otp');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

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

app.post('/api/admin/admins/complete-setup', async (req, res) => {
  const { admin_id, code, password } = req.body;
  if (!admin_id || !code || !password) return res.status(400).json({ error: 'admin_id, code, and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const adminRes = await pool.query(`SELECT * FROM admins WHERE admin_id = $1`, [admin_id]);
  const admin = adminRes.rows[0];
  if (!admin) return res.status(404).json({ error: 'Unknown admin_id' });

  const result = await verifyOtp({ target: admin.email, purpose: 'admin_setup', refId: admin_id, code });
  if (!result.valid) return res.status(401).json({ error: result.reason });

  const { hash, salt } = hashPassword(password);
  await pool.query(`UPDATE admins SET password_hash = $1, password_salt = $2, status = 'active' WHERE admin_id = $3`, [hash, salt, admin_id]);
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
app.post('/api/admin/provision', async (req, res) => {
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

// ---------- UID registration ----------
app.post('/api/tag/:tagId/set-uid', async (req, res) => {
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
app.post('/api/profile/:tagId/register', async (req, res) => {
  const { tagId } = req.params;
  const tagRes = await pool.query(`SELECT * FROM tags WHERE tag_id = $1`, [tagId]);
  if (!tagRes.rows[0]) return res.status(404).json({ error: 'Unknown tag' });

  const existingRes = await pool.query(`SELECT * FROM profiles WHERE tag_id = $1`, [tagId]);
  const existing = existingRes.rows[0];
  if (existing && existing.locked) {
    return res.status(409).json({ error: 'Profile already registered. Use edit + OTP to update.' });
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
        emergency_contacts=$6, health_info=$7, parent_phone=$8, parent_email=$9, locked=1, updated_at=$10
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

  const editToken = crypto.randomBytes(24).toString('hex');
  await pool.query(`UPDATE profiles SET locked = 0 WHERE tag_id = $1`, [tagId]);
  res.json({ success: true, editToken, note: 'Profile unlocked for editing. Re-locks on next save.' });
});

app.get('/api/profile/:tagId', async (req, res) => {
  const profileRes = await pool.query(`SELECT * FROM profiles WHERE tag_id = $1`, [req.params.tagId]);
  const profile = profileRes.rows[0];
  if (!profile) return res.status(404).json({ error: 'Not found' });

  const full = req.query.full === '1';
  const contacts = JSON.parse(profile.emergency_contacts || '[]');
  const health = JSON.parse(profile.health_info || '{}');

  if (full) return res.json({ ...profile, emergency_contacts: contacts, health_info: health });

  res.json({
    tag_id: profile.tag_id, child_name: profile.child_name, photo_url: profile.photo_url, class_name: profile.class_name,
    health_summary: { allergies: health.allergies || null, conditions: health.conditions || null, blood_type: health.blood_type || null },
    contact_available: contacts.length > 0
  });
});

app.post('/api/scan/:tagId', async (req, res) => {
  const { tagId } = req.params;
  const { lat, lng, role } = req.body;
  await pool.query(`INSERT INTO scan_logs (tag_id, location_lat, location_lng, scanner_role) VALUES ($1, $2, $3, $4)`,
    [tagId, lat ?? null, lng ?? null, role || 'public']);
  res.json({ success: true });
});

// ---------- Gate logs ----------
const MIN_MINUTES_BETWEEN_IN_AND_OUT = 30;

app.post('/api/gate/:tagId', async (req, res) => {
  const { tagId } = req.params;
  const { lat, lng } = req.body;

  const todaysRes = await pool.query(`
    SELECT * FROM gate_logs WHERE tag_id = $1 AND timestamp::date = CURRENT_DATE ORDER BY timestamp ASC
  `, [tagId]);
  const todaysLogs = todaysRes.rows;

  if (todaysLogs.length === 0) {
    await pool.query(`INSERT INTO gate_logs (tag_id, direction, location_lat, location_lng) VALUES ($1, 'in', $2, $3)`, [tagId, lat ?? null, lng ?? null]);
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

  await pool.query(`INSERT INTO gate_logs (tag_id, direction, location_lat, location_lng) VALUES ($1, 'out', $2, $3)`, [tagId, lat ?? null, lng ?? null]);
  res.json({ success: true, ignored: false, direction: 'out' });
});

app.get('/api/gate/:tagId/history', async (req, res) => {
  const result = await pool.query(`SELECT * FROM gate_logs WHERE tag_id = $1 ORDER BY timestamp DESC LIMIT 50`, [req.params.tagId]);
  res.json(result.rows);
});

app.get('/api/scan/:tagId/history', async (req, res) => {
  const result = await pool.query(`SELECT * FROM scan_logs WHERE tag_id = $1 ORDER BY timestamp DESC LIMIT 50`, [req.params.tagId]);
  res.json(result.rows);
});

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
      MAX(CASE WHEN direction = 'in' THEN timestamp END) AS in_time,
      MAX(CASE WHEN direction = 'in' THEN location_lat END) AS in_lat,
      MAX(CASE WHEN direction = 'in' THEN location_lng END) AS in_lng,
      MAX(CASE WHEN direction = 'out' THEN timestamp END) AS out_time,
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
app.post('/api/staff/register', async (req, res) => {
  const { name, phone, email, role, school_id } = req.body;
  if (!name || (!phone && !email)) return res.status(400).json({ error: 'name and phone or email required' });
  const staffId = genStaffId();
  await pool.query(`INSERT INTO staff (staff_id, name, phone, email, role, school_id) VALUES ($1, $2, $3, $4, $5, $6)`,
    [staffId, name, phone || null, email || null, role || 'teacher', school_id || null]);
  res.json({ staff_id: staffId });
});

app.post('/api/staff/request-otp', async (req, res) => {
  const { staff_id, channel } = req.body;
  const staffRes = await pool.query(`SELECT * FROM staff WHERE staff_id = $1`, [staff_id]);
  const staff = staffRes.rows[0];
  if (!staff) return res.status(404).json({ error: 'Unknown staff id' });
  const target = channel === 'email' ? staff.email : staff.phone;
  if (!target) return res.status(400).json({ error: `No ${channel} on file` });
  const result = await sendOtp({ target, targetType: channel, purpose: 'staff_login', refId: staff_id });
  res.json(result);
});

app.post('/api/staff/verify-otp', async (req, res) => {
  const { staff_id, target, code } = req.body;
  const result = await verifyOtp({ target, purpose: 'staff_login', refId: staff_id, code });
  if (!result.valid) return res.status(401).json({ error: result.reason });
  const sessionToken = crypto.randomBytes(24).toString('hex');
  res.json({ success: true, sessionToken });
});

app.get('/api/staff/:staffId/roster', async (req, res) => {
  const result = await pool.query(`SELECT tag_id, child_name, class_name FROM profiles ORDER BY class_name, child_name`);
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
  if (adminKey !== ADMIN_KEY) return res.status(401).json({ error: 'Invalid admin key' });
  if (!['en', 'mn', 'zh'].includes(language)) return res.status(400).json({ error: 'Unsupported language' });
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
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
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
