

# Plan: Expand Profile and Settings with Working Features

## What we're adding

### Profile Screen Enhancements
1. **Editable avatar** — tap avatar to upload photo via `kartoteka-photos` storage bucket, save URL to `profiles.avatar_url`
2. **Editable skills** — add/remove skill chips with inline editing, saved to `profiles.skills`
3. **Availability saved to DB** — persist weekly availability (new `availability` column in profiles as `boolean[]`)
4. **Weekly stats from real data** — fetch `job_responses` for week/month stats instead of showing zeros

### Settings Screen — New Sections
5. **Language setting** — Russian/English toggle (localStorage-based, affects UI labels)
6. **Blocked users list** — view and unblock users from `blocked_users` table
7. **About app** — version, links to support, privacy policy placeholder
8. **Cache/data clear** — button to clear localStorage and reload
9. **Profile photo in edit section** — upload/change avatar from settings

## Technical Details

### Database Migration
- Add `availability boolean[] default '{true,true,true,true,true,true,true}'` to `profiles` table

### Files Modified
- `src/screens/ProfileScreen.tsx` — avatar display from DB, editable skills, availability persistence, real weekly stats query
- `src/screens/SettingsScreen.tsx` — new sections: blocked users, language, about, cache clear, avatar upload
- `src/hooks/useNotificationSettings.ts` — no changes needed

### Files Created
- Migration for `availability` column

### Storage
- Use existing `kartoteka-photos` bucket for avatar uploads (already public)

