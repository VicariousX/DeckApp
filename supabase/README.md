# Supabase setup (DeckApp)

## 1. Run the migration

In the [Supabase SQL Editor](https://supabase.com/dashboard) for your project, paste and run:

`migrations/20260910_user_card_art.sql`

This creates:

| Object | Purpose |
|--------|---------|
| `public.user_card_art` | Per-user preferred printing + custom image paths, keyed by `oracle_id` |
| RLS policies | Users can only read/write their own rows |
| Storage bucket `card-art` | Public-read custom card images (5 MB, png/jpeg/webp/gif) |
| Storage RLS | Write only under `{auth.uid()}/...` |

## 2. Verify

```sql
select * from public.user_card_art limit 1;
select * from storage.buckets where id = 'card-art';
```

## 3. App env

Frontend `.env.local` (already used for auth):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Data model (short)

- **Scryfall** remains the source of rules text, names, and default art.
- **`oracle_id`** groups all printings of the same card.
- **`user_card_art`** stores, per user + oracle:
  - `preferred_scryfall_id` — optional pin to a specific printing’s art
  - `custom_front_path` / `custom_back_path` — uploads in `card-art`
- The frontend maps Scryfall → **`DeckAppCard`**, then applies preferences so UI/export always use the resolved `faces[].image_url`.
