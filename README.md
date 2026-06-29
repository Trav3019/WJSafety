# WJ Safety

A mobile-first, installable (offline-capable) safety app for the farm: safety
data sheets, regulations, equipment inventory, incident report forms, field
books, and the emergency response plan — plus sign-in/registration, a
safety-update news feed, and forms that admins can send out for digital
signature.

## Stack

- React + TypeScript + Vite, Tailwind for styling
- Supabase: Postgres database, auth, and file storage
- PWA (vite-plugin-pwa) for install-to-homescreen and offline caching
- Dexie (IndexedDB) to cache downloaded documents for offline viewing

## 1. Set up Supabase

1. Create a project at supabase.com.
2. Open the SQL editor and run `supabase/schema.sql` from this repo. It creates:
   - `profiles` (role + approval status, auto-created on signup, defaults to pending)
   - `categories` (pre-seeded with Acts and Regulations, Emergency Response Plan,
     Equipment Inventory, Incident Report Forms, SDS, Field Books)
   - `documents`, `form_templates`, `form_assignments`, `form_submissions`, `news_posts`
   - a private `documents` storage bucket
   - row-level security so only approved users can read data, and only
     admins/safety officers can write it
3. In Project Settings > API, copy the Project URL and anon public key.

## 2. Configure the app

```
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## 3. Create the first admin

Register a normal account in the app, then in the Supabase table editor open
`profiles`, find that row, and set `role` to `admin` and `status` to
`approved`. From then on that admin can approve everyone else from the
Admin > Manage Users screen.

## 4. Import your existing Google Drive documents

See `scripts/import-documents.mjs` for a one-time bulk-import script: export
your Drive folders locally, then run the script with your Supabase service
role key to push every file into the right category. After that, day-to-day
uploads happen from Admin > Upload Documents in the app itself.

## 5. Offline use

Workers can tap "Save offline" on any document to cache it on their device
(stored in IndexedDB), so SDS sheets and other documents stay available
without signal. The app itself is installable (Add to Home Screen) and the
shell/UI works offline once visited; data actions (sign in, submit forms,
load new content) still need a connection.

## 6. Deploying

`npm run build` produces a static `dist/` folder — host it on Netlify,
Vercel, Cloudflare Pages, or similar. Set the same `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` env vars in your hosting provider.

## Roles

- **worker**: view documents, fill/sign assigned forms, read news
- **safety_officer** / **admin**: everything above, plus approve new
  accounts, upload documents, build and send forms, post news updates
