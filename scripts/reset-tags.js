// scripts/reset-tags.js — wipes all tags + profiles and re-provisions
// fresh random-token tags. Run this ONCE, manually, when moving the test
// deployment off the old sequential OT-0001/OT-0002/... IDs.
//
// Deliberately NOT run automatically on server boot (unlike db.js's
// schema migration) — it deletes data, and that must always be a
// conscious, explicit action you take, never a side effect of a deploy.
//
// Usage:
//   node scripts/reset-tags.js --count=1800 --yes
//   node scripts/reset-tags.js --count=50 --school=SCH-ABC123 --batch=pilot-2026-09 --yes
//
// What it does, in order:
//   1. Deletes scan_logs, gate_logs, profiles, then tags (in that order,
//      so nothing is left pointing at a tag_id that no longer exists).
//      schools/admins/staff/settings/site_content/story_scenes are left
//      alone. otp_codes is left alone too (short-lived, already excluded
//      from backups for the same reason).
//   2. Re-provisions --count fresh tags with the new random-token format
//      (OT-XXXX-XXXX-XXXX-XXXX-XXXX), all starting in status 'unwritten'.
//   3. Writes the full list of new tag_ids to a timestamped CSV in this
//      scripts/ folder, so you have something to feed into the ACR1552U
//      tag-writer tool (prepare-tag.js) and something to check off against
//      as you physically rewrite each test wristband.
//
// After this runs, every existing test tag's old URL (?tag=OT-0001, etc.)
// stops working immediately — that's the point. Physically rewrite each
// NTAG213/215 with the new URL (?tag=<new token>, with the chip's own UID
// mirrored in as &uid=...) before handing it back out for testing.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { pool, withTransaction } = require('../db');
const { genTagToken } = require('../lib/tagUtils');

function parseArgs(argv) {
  const args = { yes: false };
  for (const raw of argv.slice(2)) {
    if (raw === '--yes') { args.yes = true; continue; }
    const m = raw.match(/^--([a-z]+)=(.*)$/i);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim().toLowerCase()); });
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const count = parseInt(args.count, 10);
  if (!count || count <= 0 || count > 5000) {
    console.error('Usage: node scripts/reset-tags.js --count=<1-5000> [--school=SCH-XXXX] [--batch=name] --yes');
    process.exit(1);
  }

  if (args.school) {
    const schoolRes = await pool.query(`SELECT * FROM schools WHERE school_id = $1`, [args.school]);
    if (!schoolRes.rows[0]) {
      console.error(`❌ Unknown --school=${args.school} — check the school_id in your schools table.`);
      process.exit(1);
    }
  }

  const existingRes = await pool.query(`SELECT COUNT(*)::int AS tags, (SELECT COUNT(*)::int FROM profiles) AS profiles FROM tags`);
  const { tags: existingTags, profiles: existingProfiles } = existingRes.rows[0];

  console.log('⚠️  This will PERMANENTLY DELETE all rows in scan_logs, gate_logs, profiles, and tags.');
  console.log(`   Currently in the database: ${existingTags} tag(s), ${existingProfiles} profile(s).`);
  console.log(`   It will then create ${count} new tag(s) with fresh random tokens, status 'unwritten'.`);
  console.log('   schools, admins, staff, and site content are NOT touched.\n');

  if (!args.yes) {
    const answer = await confirm('Type "yes" to continue: ');
    if (answer !== 'yes') { console.log('Aborted — nothing was changed.'); process.exit(0); }
  }

  const created = [];
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM scan_logs`);
    await client.query(`DELETE FROM gate_logs`);
    await client.query(`DELETE FROM profiles`);
    await client.query(`DELETE FROM tags`);

    for (let i = 0; i < count; i++) {
      let inserted = false;
      for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
        const tagId = genTagToken();
        try {
          await client.query(
            `INSERT INTO tags (tag_id, status, school_id, batch) VALUES ($1, 'unwritten', $2, $3)`,
            [tagId, args.school || null, args.batch || null]
          );
          created.push(tagId);
          inserted = true;
        } catch (err) {
          if (err.code !== '23505') throw err;
        }
      }
      if (!inserted) throw new Error('Could not generate a unique tag token after 5 attempts');
    }
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(__dirname, `reset-tags-${stamp}.csv`);
  fs.writeFileSync(outPath, 'tag_id\n' + created.join('\n') + '\n');

  console.log(`\n✅ Deleted old scan_logs/gate_logs/profiles/tags. Created ${created.length} new tag(s).`);
  console.log(`   List written to: ${outPath}`);
  console.log('   Next: write each new tag_id (and its NTAG213/215 UID mirror) to a physical');
  console.log('   test wristband with the ACR1552U + tag-writer tool, which calls');
  console.log('   POST /api/tag/:tagId/set-uid to bind the chip.');

  await pool.end();
}

main().catch(err => {
  console.error('❌', err);
  process.exit(1);
});
