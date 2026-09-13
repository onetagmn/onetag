// lib/tagUtils.js — shared between server.js and the one-off scripts
// (scripts/reset-tags.js) so tag_id generation and UID normalization can
// never drift between the live app and a maintenance script.

const crypto = require('crypto');

// Random tag tokens, not sequential IDs. Sequential IDs (OT-0001, OT-0002,
// ...) let anyone enumerate the whole database by incrementing a number in
// the URL — that's the vulnerability this replaces. 10 random bytes = 80
// bits of entropy, formatted as 5 dashed groups of 4 hex chars so it's
// still readable on a printed label or read aloud over the phone, but
// nowhere near guessable or walkable.
function genTagToken() {
  const hex = crypto.randomBytes(10).toString('hex').toUpperCase();
  const groups = hex.match(/.{1,4}/g);
  return `OT-${groups.join('-')}`;
}

// Strips everything but hex digits and uppercases, so "04:A3:B2..." (how
// most NFC readers/OSes print a UID), "04a3b2..." and "04-A3-B2..." all
// normalize to the same stored/compared value.
function normalizeUid(uid) {
  return (uid || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
}

// A tag's lifecycle: provisioned with no chip written yet -> a physical
// NTAG213/215 UID has been bound to it (via /api/tag/:tagId/set-uid) ->
// a family has registered a child on it -> lost/retired for tags pulled
// out of circulation (damaged, returned, chip lost). Enforced both here
// (application-level validation) and as a DB CHECK constraint (db.js).
const TAG_STATUSES = ['unwritten', 'assigned', 'active', 'lost', 'retired'];

module.exports = { genTagToken, normalizeUid, TAG_STATUSES };
