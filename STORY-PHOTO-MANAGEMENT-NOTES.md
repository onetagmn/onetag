# Full story-photo management

What this adds, on top of the previous "Website content" dashboard update
(text editing, Japanese, hide/show sections, and single-photo replacement):

The 9 photos in the homepage's scrolling story are no longer a fixed set.
From the dashboard's **Story photos** tab you can now:

- **Delete** any scene (photo + its caption together) — the story can end
  up shorter than 9.
- **Add** a new scene (photo + captions in all three languages) — the
  story can end up longer than 9.
- **Reorder** scenes with up/down arrows.
- **Edit** a scene's caption in Mongolian, English, and Japanese.
- **Replace** just a scene's photo without touching its caption.

There's always at least 1 photo — the last one can't be deleted (only
replaced), so the story can never end up with zero scenes.

## Files changed

- `db.js` — new `story_scenes` table (id, position, image_url, three
  caption columns, scene_type). Replaces the old approach of storing story
  photos as rows in `site_content`.
- `site-content-seed.js` — the original 9 photos/captions moved into a new
  `STORY_SCENE_SEED` array (only used the very first time `story_scenes`
  is empty).
- `server.js` — the old single `POST .../image/:key` route is replaced by
  five new routes: list, add (with photo), edit caption, replace photo,
  delete, and reorder — all super-admin only.
- `public/home.html` — the scrolling story is now built by JavaScript from
  whatever scenes exist, instead of 9 fixed HTML blocks.
- `public/admin-content.html` — the Story photos tab is rewritten for the
  new add/edit/replace/delete/reorder controls.

## Migrating from the previous version

If you already replaced one of the 9 photos using the older "Story
photos" tab, that replacement is preserved automatically the first time
this update runs — nothing is lost. After that first run, all story
photos live only in the new `story_scenes` table.

## Two behaviors worth knowing about

**The opening zoom-in and closing zoom-out effects move with position,
not with a specific photo.** Whichever scene ends up first always gets
the opening effect; whichever ends up last always gets the closing
effect. So if you delete the very first photo, the new first photo
automatically gets that effect — you don't need to do anything extra.

**The small "Name / Allergies / Blood Type / Emergency contact" info
overlay is tied to one specific scene, not to a position.** It's marked
in the dashboard with an "Has registration info overlay" tag. If you
delete that particular scene, the overlay is simply gone — it does not
move to another photo. If you'd like it on a different scene, let me
know and I can help move it (this isn't currently exposed as a
dashboard toggle).

## One small trade-off made along the way

The earlier version of the scrolling story subtly shifted the color tone
from morning to dusk as you scrolled through the fixed 9-photo sequence.
That effect was tied to specific fixed positions in a 9-photo story, which
doesn't make sense once the story can be any length or order — so it's
been removed. Everything else about the visual treatment (the zoom
effects, the overlay, captions, photo sizing) is unchanged.

## Deploy

Same as before: copy `server.js`, `db.js`, `site-content-seed.js`, and the
files under `public/` into your repo (preserving root vs. `public/`),
commit, push. No new npm dependencies this time — `multer` and
`cloudinary` were already added in the previous update. Render will run
`npm install` and restart automatically.

The first time this deploys, `story_scenes` is created and seeded
automatically — no manual database step needed.

## Using it

Super-admin → Website content → **Story photos** tab. Each scene shows:
its photo, its position, an "Add/replace photo" control, caption boxes
for all three languages with a Save button, a Delete button, and up/down
arrows to reorder. An "Add a new scene" section at the bottom lets you
add a photo (required) with optional captions — it's added at the end,
then you can move it with the arrows.

Same photo size guidance as before: minimum 1600×900px, landscape, JPG,
under ~500KB.
