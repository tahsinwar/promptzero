# cPanel Static Deploy Guide

এই project টা TanStack Start (SSR) এ বানানো, কিন্তু cPanel এ **শুধু static frontend** হিসেবে deploy করা যায়। Supabase/Database সরাসরি browser থেকে call হবে (RLS দিয়ে protected), তাই কোনো backend server লাগবে না।

## ১. Environment variable setup (local machine এ)

Project root এ একটা `.env` ফাইল বানান:

```bash
cp .env.production.example .env
```

`.env` এ এই ৩টা value আছে কিনা confirm করুন:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://nveqnzglpbnqjsmislvi.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | (long JWT — `.env.production.example` এ আছে) |
| `VITE_SUPABASE_PROJECT_ID` | `nveqnzglpbnqjsmislvi` |

> **মনে রাখবেন:** `VITE_*` variable গুলো **build time এ JS bundle এ baked** হয়ে যায়। তাই cPanel এ আলাদা করে env set করার দরকার নেই — `npm run build` যে machine এ চালাবেন সেখানে `.env` থাকলেই হবে।

## ২. Build করুন

```bash
npm install        # প্রথমবার
npm run build
```

Build সফল হলে `dist/` (বা `.output/public/`) folder এ static file তৈরি হবে।

## ৩. cPanel এ upload

1. Build output folder এর **সব file** (hidden `.htaccess` সহ) zip করুন:
   ```bash
   cd dist && zip -r ../site.zip . && cd ..
   ```
2. cPanel **File Manager** → `public_html/` এ যান
3. **Settings** → ✅ **Show Hidden Files (dotfiles)** চালু করুন
4. `site.zip` upload করে **Extract** করুন
5. Confirm করুন `public_html/` এ আছে:
   - `index.html`
   - `.htaccess` (SPA routing এর জন্য — already configured)
   - `assets/` folder

## ৪. Verify

- `https://yourdomain.com` খুললে home page লোড হবে
- `/browse`, `/p/some-slug` refresh করলেও 404 আসবে না (`.htaccess` SPA fallback handle করে)
- Browser DevTools → Network এ দেখবেন Supabase API call সরাসরি `nveqnzglpbnqjsmislvi.supabase.co` এ যাচ্ছে

## ⚠️ যা কাজ করবে না cPanel এ

| Feature | কারণ |
|---|---|
| Server functions (`createServerFn`) | Node.js runtime নেই |
| SSR / SEO meta tags dynamic | শুধু static HTML |
| API routes (`src/routes/api/*`) | server lagবে |
| Webhook endpoints | server লাগবে |

এগুলো লাগলে **Lovable Publish** (free, top-right button) বা Vercel/Netlify/Cloudflare Pages ব্যবহার করুন।

## 🔒 Security note

`VITE_SUPABASE_PUBLISHABLE_KEY` (anon key) browser এ expose হওয়া **safe** — এটা publishable। আসল security আসে Supabase **Row Level Security (RLS) policy** থেকে, যা already configured আছে। `SUPABASE_SERVICE_ROLE_KEY` কখনোই frontend এ ব্যবহার করবেন না।