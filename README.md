# Our Little Memories

A private photo gallery for a monthsary: taped polaroids in an ube-and-cream coverflow carousel with a month timeline, behind a login screen (a sealed envelope) over a drifting wall of our photos and a love note. Photos are managed from an admin page and stored in Supabase. The site is plain HTML/CSS/JS with no build step, deployed to GitHub Pages.

## Files

| Path | What it is |
| --- | --- |
| `site/index.html`, `site/gallery.js` | The gallery: login screen and envelope opening, coverflow carousel (auto-plays every 5 s, pauses on hover), month timeline, photo viewer |
| `site/admin.html`, `site/admin.js` | Admin page: log in, add / edit / delete photos (images are resized to 1600px JPEG before upload) |
| `site/story.js`, `site/story.css` | The story half of the page: envelope opening, "together for" counter, scroll-drawn timeline, reasons cards, the typed letter |
| `site/letters.js` | "Letters to each other": a private mailbox; both of you log in once, only you two can read or write |
| `site/album.js` | "All photos" view: every photo grouped by month, with heart-select to save several at once |
| `site/download.js` | Saving photos: phones get the share sheet (straight into Photos), computers get a download or one `.zip` |
| `site/backdrop.js` | The drifting photo wall and floating hearts behind the login screen and the admin login |
| `site/shared.js` | Helpers both pages use: Supabase client, photo query, date labels |
| `site/config.js` | Supabase URL and anon key, start date, page text, reasons, letter |
| `site/style.css` | All styles for both pages |
| `supabase-setup.sql` | Creates the `photos` table, the `photos` bucket and their access rules |
| `.github/workflows/deploy.yml` | Publishes `site/` to GitHub Pages on every push to `main` |

## Setup

1. Create a Supabase project. In **SQL Editor**, run `supabase-setup.sql`.
2. In **Authentication > Sign In / Providers**, turn off new sign-ups. In **Authentication > Users**, add a user for each of you (email and password, tick **Auto Confirm User**). These are the logins for the gallery's first screen and the admin page.
3. In **Project Settings > API**, copy the project URL and the `anon` public key into `site/config.js`. Never put the `service_role` key there.
4. Edit the page text, reasons and letter in `site/config.js`. Both of you log in on the first screen with the accounts from step 2.
5. In the GitHub repo, set **Settings > Pages > Source** to **GitHub Actions**, then push to `main`.

The gallery lives at `https://<user>.github.io/<repo>/` and the admin page at `.../admin.html`.

## Letters to each other

1. In **SQL Editor**, run the "Letters to each other" part at the end of `supabase-setup.sql` (or the whole file again; it's safe to re-run).
2. In **Authentication > Users**, add an account for each of you. The first time each of you sends a letter, the page asks what name to sign with and remembers it.
3. Log in from the "Letters to each other" section at the bottom of the gallery. Both of you can read every letter; each of you can delete only your own.

## Words on the page

The counter start date, the "reasons I love you" cards and the letter live in `site/config.js` (`START_DATE`, `REASONS`, `LETTER`). `{months}` in any of that text becomes the number of months you've been together.

## Adding photos

Open `admin.html`, log in, and drop a photo on the picker. Photos with the same **Month label** (for example "Month 3", or just "3") become one stop on the gallery's month timeline, in date order. The month field suggests labels you've already used, so groups stay consistent.

iPhone HEIC photos can't be read by most browsers. Convert them to JPG first (or set the camera to "Most Compatible").

## Run locally

Any static server works:

```sh
cd site
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Notes

- The first screen is a real login (Supabase accounts). Only accounts listed in `public.members` (see `supabase-setup.sql`) can see or change photos, photo files and letters; everyone else gets nothing, even with the anon key. Photos load through signed links that expire after 12 hours (reloading the page makes new ones).
- After creating a new account, add it to `public.members` by running the "ADD THE TWO OF YOU" line in `supabase-setup.sql` with your real emails (don't save real emails in the file).
- The anon key in `config.js` is meant to be public.
