## Admin Panel Enhancements — 6 Features

আমি এই ৬টা feature যোগ করব। কাজটা বড়, তাই database + UI দুই দিকেই changes লাগবে।

---

### 1. Draft Auto-save + Version History UI
**DB**: `prompt_versions` table আছে কিন্তু auto-snapshot হচ্ছে না।
- `admin.prompts.$id.tsx`-এ edit form-এ debounced auto-save (every 30s বা content change-এ)। `is_published=false` হলে draft হিসেবে save হবে; published হলে existing version snapshot তৈরি হবে।
- নতুন drawer/modal: **"Version History"** button — `prompt_versions` থেকে সব version timeline দেখাবে (date, change_note, content diff preview), restore button সহ।
- "Saved 2s ago" indicator form header-এ।

### 2. IP Block List Management UI
**DB**: `admin_settings.settings.blocked_ips` (jsonb array) — already exists।
- `admin.settings.tsx`-এ নতুন section: **"Blocked IPs"** — add/remove IP, optional reason note, block date।
- Comments submission server-side check যোগ (RLS policy বা trigger)।

### 3. Failed PIN Attempts Log
**DB**: নতুন table `pin_attempts` (prompt_id, ip_address, attempted_at, success boolean)।
- `pin-lock-modal.tsx` থেকে log করব every attempt।
- নতুন admin page `/admin/security` — recent failed attempts table, filter by prompt/IP, "Block this IP" quick action।

### 4. Comment Moderation Improvements
- `admin.comments.tsx`-এ checkbox column + bulk action toolbar (Approve all / Delete all / Mark spam)।
- Simple keyword-based spam filter: configurable spam keywords list `admin_settings`-এ; auto-flag matching comments।
- "Spam" tab আলাদা দেখাবে suspicious comments।

### 5. Visitor Questions Reply Interface
**DB**: `visitor_questions.answer` field exists, currently unused UI-wise।
- নতুন admin page `/admin/questions` — pending questions list, inline answer textarea, Publish button (sets `answer` + `is_published=true`)।
- Public prompt page (`p.$slug.tsx`)-এ answered Q&A render হবে।

### 6. Email Notifications (New Comment/Question)
- Lovable Cloud-এর built-in email infrastructure use করব।
- Admin email setting (`admin_settings.notification_email`)।
- New comment বা visitor_question insert হলে → server function trigger → admin-কে email পাঠাবে।
- প্রথমে email domain setup dialog লাগবে (no domain configured এখন)।

---

### Technical Plan

```text
DB Migrations:
├── pin_attempts table (+ RLS: admin read, public insert with rate-limit-friendly policy)
├── admin_settings.settings জসন-এ যোগ: notification_email, spam_keywords[], blocked_ips schema
└── trigger: notify_admin_on_comment / notify_admin_on_question (calls server route)

New files:
├── src/routes/admin.security.tsx        (PIN attempts + blocked IPs)
├── src/routes/admin.questions.tsx       (visitor Q reply)
├── src/components/version-history-drawer.tsx
├── src/lib/auto-save.ts                 (debounced draft hook)
├── src/lib/email-templates/new-comment-notification.tsx
├── src/lib/email-templates/new-question-notification.tsx
└── src/lib/email-templates/registry.ts

Edited files:
├── src/routes/admin.prompts.$id.tsx     (auto-save + version history button)
├── src/routes/admin.comments.tsx        (bulk actions + spam tab)
├── src/routes/admin.settings.tsx        (blocked IPs UI + spam keywords + admin email)
├── src/routes/admin.tsx                 (sidebar links: Security, Questions)
├── src/components/pin-lock-modal.tsx    (log attempts)
└── src/routes/p.$slug.tsx               (render answered visitor Qs)
```

---

### Email setup prerequisite

Email notifications-এর জন্য একটা verified sender domain দরকার। এটা প্রথমে set up করতে হবে — বাকি সব features সেটা ছাড়াই কাজ করবে।

---

### Order of execution (যদি plan approve হয়)

1. **DB migration** — pin_attempts table, settings schema updates
2. **Feature 1, 2, 3, 4, 5** UI build (no email dependency)
3. **Feature 6** — email domain setup → templates → triggers

---

### একটা confirmation দরকার

Email notifications setup করতে hole একটা domain delegate করতে হবে (Lovable Cloud handles করবে)। আপনি কি email feature এখনই চান, নাকি বাকি ৫টা আগে করি আর email পরে?

Plan approve করলে আমি ১ → ৫ একসাথে শুরু করব।