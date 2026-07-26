// scripts/restore.js — restores a backup produced by backup.js.
// Safe to run against a database that already has some data: every row is
// an upsert (INSERT ... ON CONFLICT DO UPDATE) keyed by that table's real
// primary key, so restoring twice, or restoring on top of a partially
// recovered database, won't duplicate or corrupt anything.
//
// Usage:
//   DATABASE_URL=... node scripts/restore.js path/to/onetag-backup-2026-07-25.json.gz
//
// This does NOT delete rows that exist in the live database but aren't in
// the backup (e.g. anything created after the backup was taken) — it only
// adds/overwrites. That's deliberate: restoring should never silently
// destroy newer data you didn't mean to lose.

const fs = require('fs');
const zlib = require('zlib');
const { pool } = require('../db');

const PRIMARY_KEY = {
  schools: 'school_id', tags: 'tag_id', profiles: 'tag_id', admins: 'admin_id',
  staff: 'staff_id', settings: 'key', gate_logs: 'id', scan_logs: 'id'
};

async function restoreTable(table, rows) {
  if (!rows.length) return;
  const pk = PRIMARY_KEY[table];
  const columns = Object.keys(rows[0]);
  const updateSet = columns.filter(c => c !== pk).map(c => `${c} = EXCLUDED.${c}`).join(', ');

  for (const row of rows) {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const values = columns.map(c => row[c]);
    await pool.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
       ON CONFLICT (${pk}) DO UPDATE SET ${updateSet}`,
      values
    );
  }
  console.log(`  ${table}: restored ${rows.length} rows`);
}

(async () => {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/restore.js path/to/backup.json.gz');
    process.exit(1);
  }
  try {
    const raw = zlib.gunzipSync(fs.readFileSync(filePath));
    const dump = JSON.parse(raw);
    console.log(`Restoring backup from ${dump.exportedAt}...`);

    // Same order as backup.js: parents before children (profiles reference
    // schools and tags via foreign keys).
    for (const table of ['schools', 'tags', 'profiles', 'admins', 'staff', 'settings', 'gate_logs', 'scan_logs']) {
      await restoreTable(table, dump.tables[table] || []);
    }

    console.log('✔ Restore complete.');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Restore failed:', err.message);
    process.exit(1);
  }
})();
