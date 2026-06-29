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
`VITE_SUPABASE_ANON_KEY` / `VITE_VAPID_PUBLIC_KEY` env vars in your hosting
provider.

## 7. Push notifications

Workers get a phone notification when the safety officer posts an update, or
when a form is assigned to them specifically.

1. Generate VAPID keys once: `npx web-push generate-vapid-keys`.
2. Set `VITE_VAPID_PUBLIC_KEY` (the public key) in `.env` and in your hosting
   provider's env vars.
3. Run `supabase/migrations/002_push_notifications.sql` in the SQL editor.
   Edit the two `alter database ... set app.settings...` lines first:
   - `app.settings.edge_function_url` → `https://<your-project-ref>.supabase.co/functions/v1/send-push`
   - `app.settings.edge_function_secret` → any random string you make up
4. Deploy the edge function: `supabase functions deploy send-push` (requires
   the Supabase CLI: `npm i -g supabase`, then `supabase link`).
5. Set the function's secrets so it can sign and send the push messages:
   ```
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
     VAPID_SUBJECT=mailto:you@example.com WEBHOOK_SECRET=<same random string as step 3>
   ```
6. In the app, a "Get notified" banner appears once a worker is signed in;
   tapping Enable subscribes their device. They can be re-prompted any time
   by clearing site permissions and reloading.

## Roles

- **worker**: view documents, fill/sign assigned forms, read news
- **safety_officer** / **admin**: everything above, plus approve new
  accounts, upload documents, build and send forms, post news updates
