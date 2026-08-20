// db.js — PostgreSQL version for real deployment.
// Render's filesystem resets on every restart/redeploy, so SQLite (a local
// file) would lose all data. Postgres is a real managed database that
// persists independently of the web service.

const { Pool } = require('pg');
const { TEXT_SEED, STORY_SCENE_SEED, BLOCK_SEED } = require('./site-content-seed');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is not set. Cannot connect to the database.');
  console.error('   Locally: postgres://postgres:yourpassword@localhost:5432/onetag_test');
  console.error('   On Render: copy the "Internal Database URL" from your Postgres instance.');
  process.exit(1);
}

// Render's managed Postgres requires SSL but uses a certificate chain that
// Node doesn't automatically trust — rejectUnauthorized:false is the
// standard, documented way to connect to it. Not needed for local testing.
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tags (
      tag_id TEXT PRIMARY KEY,
      uid TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'unclaimed',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS schools (
      school_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS profiles (
      tag_id TEXT PRIMARY KEY REFERENCES tags(tag_id),
      child_name TEXT,
      photo_url TEXT,
      school_id TEXT REFERENCES schools(school_id),
      school_name_other TEXT,
      class_name TEXT,
      emergency_contacts TEXT,
      health_info TEXT,
      parent_phone TEXT,
      parent_email TEXT,
      locked INTEGER NOT NULL DEFAULT 0,
      edit_token TEXT,
      edit_token_expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS edit_token TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS edit_token_expires_at TIMESTAMP;

    CREATE TABLE IF NOT EXISTS admins (
      admin_id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      password_hash TEXT,
      password_salt TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      role TEXT NOT NULL DEFAULT 'school_admin',
      school_id TEXT REFERENCES schools(school_id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL REFERENCES admins(admin_id),
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS parent_sessions (
      token TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS staff (
      staff_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'teacher',
      school_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS staff_sessions (
      token TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL REFERENCES staff(staff_id),
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT INTO settings (key, value) VALUES ('site_language', 'mn') ON CONFLICT (key) DO NOTHING;

    CREATE TABLE IF NOT EXISTS otp_codes (
      id SERIAL PRIMARY KEY,
      target TEXT NOT NULL,
      target_type TEXT NOT NULL,
      purpose TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gate_logs (
      id SERIAL PRIMARY KEY,
      tag_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      location_lat DOUBLE PRECISION,
      location_lng DOUBLE PRECISION
    );

    CREATE TABLE IF NOT EXISTS scan_logs (
      id SERIAL PRIMARY KEY,
      tag_id TEXT NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      location_lat DOUBLE PRECISION,
      location_lng DOUBLE PRECISION,
      scanner_role TEXT DEFAULT 'public'
    );

    -- Offline support: a gate tap or a public "found this child" scan can
    -- happen while the device has no connectivity, then get queued and
    -- submitted later once it reconnects. Without this column the row's
    -- "timestamp" above would record when the server RECEIVED it (e.g. when
    -- wifi came back) rather than when it actually happened. The dedup /
    -- in-out logic in server.js intentionally keeps using "timestamp", not
    -- this column, so behavior for already-online devices is unchanged.
    ALTER TABLE gate_logs ADD COLUMN IF NOT EXISTS client_timestamp TIMESTAMP;
    ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS client_timestamp TIMESTAMP;

    -- Editable homepage content (super-admin "Website content" dashboard).
    -- One row per data-i18n text key, per scroll-story photo, or per
    -- hideable section/card. "kind" says which of the three this row is;
    -- only the columns relevant to that kind are ever used for it (a
    -- 'text' row ignores image_url/visible, an 'image' row ignores
    -- mn/en/jp/visible, a 'block' row ignores mn/en/jp/image_url). Kept as
    -- one table rather than three so the admin page can fetch everything
    -- in a single query.
    CREATE TABLE IF NOT EXISTS site_content (
      key TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('text', 'image', 'block')),
      label TEXT,
      mn TEXT,
      en TEXT,
      jp TEXT,
      image_url TEXT,
      visible BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- The scroll-story photos, now fully manageable (add, delete, reorder,
    -- edit caption) from the super-admin dashboard instead of a fixed set
    -- of 9. "position" controls both display order and which scene is
    -- treated as the opening one (position 0) or closing one (highest
    -- position) for the zoom animation — those are applied positionally in
    -- home.html's JS, not stored per-row, so they automatically move to
    -- whichever scene ends up first/last after a delete or reorder.
    -- scene_type 'registration_hud' additionally overlays the small
    -- Name/Allergies/Blood Type/... HUD labels on top of the photo; that
    -- content lives in site_content (label_name etc.), not here, so it's
    -- shared if more than one such scene ever exists. Deleting the one
    -- registration_hud scene just removes it — nothing else inherits it.
    CREATE TABLE IF NOT EXISTS story_scenes (
      id SERIAL PRIMARY KEY,
      position INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      caption_mn TEXT,
      caption_en TEXT,
      caption_jp TEXT,
      scene_type TEXT NOT NULL DEFAULT 'photo' CHECK (scene_type IN ('photo', 'registration_hud')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Seed default values once. ON CONFLICT DO NOTHING means this only ever
  // fills in rows that don't exist yet — it can never overwrite a real
  // edit made later from the dashboard, so it's safe to run on every boot.
  for (const [key, langs] of Object.entries(TEXT_SEED)) {
    await pool.query(
      `INSERT INTO site_content (key, kind, mn, en, jp) VALUES ($1, 'text', $2, $3, $4) ON CONFLICT (key) DO NOTHING`,
      [key, langs.mn, langs.en, langs.jp]
    );
  }
  for (const block of BLOCK_SEED) {
    await pool.query(
      `INSERT INTO site_content (key, kind, label, visible) VALUES ($1, 'block', $2, true) ON CONFLICT (key) DO NOTHING`,
      [block.key, block.label]
    );
  }

  // story_scenes has no natural key to ON CONFLICT against (rows can be
  // freely added/deleted), so instead: only seed it the very first time,
  // when the table is completely empty. If an earlier version of this
  // dashboard already had per-stage photo overrides saved under
  // site_content (kind='image', key='story_stage_N'), those replace the
  // hardcoded defaults here — an admin who already swapped a photo before
  // this update shipped doesn't lose that change. Those old rows are then
  // removed since story_scenes is now the only place scroll-story photos
  // live.
  const sceneCountRes = await pool.query(`SELECT COUNT(*)::int AS c FROM story_scenes`);
  if (sceneCountRes.rows[0].c === 0) {
    const oldImageRes = await pool.query(`SELECT key, image_url FROM site_content WHERE kind = 'image'`);
    const oldImageByKey = {};
    for (const row of oldImageRes.rows) oldImageByKey[row.key] = row.image_url;

    for (const scene of STORY_SCENE_SEED) {
      const legacyKey = `story_stage_${scene.position}`;
      const imageUrl = oldImageByKey[legacyKey] || scene.image_url;
      await pool.query(
        `INSERT INTO story_scenes (position, image_url, caption_mn, caption_en, caption_jp, scene_type) VALUES ($1, $2, $3, $4, $5, $6)`,
        [scene.position, imageUrl, scene.caption.mn, scene.caption.en, scene.caption.jp, scene.scene_type]
      );
    }
    await pool.query(`DELETE FROM site_content WHERE kind = 'image'`);
  }
}

// Runs a set of queries inside a transaction using a single client —
// needed for multi-step operations (like the bulk tag provisioning loop
// or the UID-reassignment swap) that must all succeed or all fail together.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initSchema, withTransaction };
