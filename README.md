# Lead Management CRM — React + Supabase

## Setup (pehli baar)

1. Terminal me project folder kholo:
   ```
   cd lead-crm
   npm install
   ```

2. `.env.example` file ko copy karke `.env` banao:
   ```
   cp .env.example .env
   ```
   (Windows PowerShell me: `copy .env.example .env`)

3. `.env` file kholo aur apne Supabase project ke credentials daalo:
   - Supabase Dashboard → Project Settings → API
   - `Project URL` → `VITE_SUPABASE_URL` me paste karo
   - `anon public` key → `VITE_SUPABASE_ANON_KEY` me paste karo

4. Dev server start karo:
   ```
   npm run dev
   ```
   Browser me `http://localhost:5173` kholo.

5. Login page pe wahi email/password daalo jo humne Supabase → Authentication → Users me banaya tha (jiska role `admin` kiya tha).

## Ab tak kya bana hai
- Animated, responsive Login page (password show/hide eye icon ke sath)
- Supabase Auth se real login
- Login ke baad role (`profiles` table se) fetch hota hai aur Dashboard pe dikhta hai
- Dashboard abhi ek placeholder hai — ye confirm karta hai ki login + role-based access kaam kar raha hai. Agle steps me hum isme Leads list, Follow-up calendar, Bulk Upload, etc. actual features add karenge.

## Folder structure
```
src/
  supabaseClient.js   -> Supabase connection
  AuthContext.jsx      -> login state + role fetch, poore app me available
  App.jsx               -> routing (login / dashboard)
  pages/
    Login.jsx / .css
    Dashboard.jsx / .css
```
