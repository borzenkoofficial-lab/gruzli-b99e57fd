

# Plan: Fake Activity System (Subscribers + Bot Jobs)

## Overview
Two features to create an impression of high platform activity, both controlled from admin panel.

## 1. Channel — 15K Subscribers Display
- Add subscriber count display in `ChannelScreen.tsx` header/bio area: **"15 247 подписчиков"**
- Store the fake count in a new `app_settings` table (key-value), so admin can adjust it
- Show it below the channel name next to post count

## 2. Bot Jobs System
Create a system that auto-generates fake job postings that always show as "closed" to workers.

### Database Changes (1 migration)
- New `app_settings` table: `id (text PK)`, `value (jsonb)`, `updated_at`
  - Row `fake_subscribers` → `{ "count": 15247 }`
  - Row `bot_jobs_enabled` → `{ "enabled": false }`
- Add `is_bot` column (`boolean default false`) to `jobs` table — marks fake jobs

### How Bot Jobs Work
- Admin panel toggle enables/disables bot job generation
- A new component `AdminSettingsTab` in admin panel with:
  - Toggle for bot jobs on/off (writes to `app_settings`)
  - Input to set fake subscriber count
- In `FeedScreen`, bot jobs (`is_bot = true`) always show status "Место занято" — workers see them but can't respond
- Bot jobs are created via a dedicated edge function `generate-bot-jobs` that creates realistic-looking jobs with random names, addresses, rates
- Scheduled via pg_cron every 15-30 minutes (only when enabled)

### Admin Panel Changes
- Add 4th tab "Настройки" to `AdminPage.tsx` with:
  - **Bot Jobs**: on/off toggle + "Generate now" button
  - **Fake Subscribers**: number input
- New component `AdminSettingsTab.tsx`

### Feed Changes (`FeedScreen.tsx`)
- For jobs where `is_bot === true`: show a "Место занято" badge, disable respond button, show "Не успели — место уже занято"

### Files to Create
- `src/components/admin/AdminSettingsTab.tsx`
- `supabase/functions/generate-bot-jobs/index.ts`
- Migration for `app_settings` table + `jobs.is_bot` column

### Files to Modify
- `src/pages/AdminPage.tsx` — add Settings tab
- `src/screens/ChannelScreen.tsx` — show subscriber count from `app_settings`
- `src/screens/FeedScreen.tsx` — handle `is_bot` jobs as closed

### Technical Details
- RLS on `app_settings`: admin can read/write, authenticated can read
- Edge function uses service role to insert bot jobs
- Bot job dispatcher_id set to a system UUID (admin's ID or a dedicated bot account)
- Fake names pool: 20+ Russian names for dispatchers
- Fake addresses pool: 20+ Moscow addresses
- Rates: random 250-600₽/hr

