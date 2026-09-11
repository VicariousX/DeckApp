# Supabase setup (DeckApp)

**Project:** DeckApp (`azwbntxmgriswgucqwji`)  
**Region:** us-west-2  

## Status (applied via Composio)

| Object | Status |
|--------|--------|
| `public.user_card_art` | Applied + RLS + grants |
| Storage bucket `card-art` | Public read, 5 MB, png/jpeg/webp/gif |
| Storage RLS | Write only under `{auth.uid()}/...` |

## App env

Frontend `.env.local`:

```
VITE_SUPABASE_URL=https://azwbntxmgriswgucqwji.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key from dashboard>
```

Never put the service role key in the frontend.

## Data model

- **Scryfall** = rules text, names, default art
- **`oracle_id`** (uuid) groups printings of the same card
- **`user_card_art`** per user + oracle:
  - `preferred_scryfall_id` — pin a printing's art
  - `custom_front_path` / `custom_back_path` — objects in `card-art`
- Frontend maps Scryfall → **`DeckAppCard`**, then applies preferences so UI/export use `faces[].image_url`

## Verify

```sql
select * from public.user_card_art limit 5;
select id, public, file_size_limit, allowed_mime_types
  from storage.buckets where id = 'card-art';
```
