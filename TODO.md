# Documentos Feature - Implementation TODO

## Supabase SQL (run manually in dashboard)

```sql
create table documents (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  file_url text,
  sender_id uuid references profiles(id),
  recipient_id uuid references profiles(id) not null,
  status text default 'pending' check (status in ('pending','completed','signed')),
  created_at timestamp default now(),
  updated_at timestamp default now()
);
```

## Steps

- [x] Create TODO.md
- [x] 1. Add MOCK_DOCUMENTS to `src/data/mockData.js`
- [x] 2. Extend DataProvider in `src/context/index.jsx` with documents fetching, realtime, helpers
- [x] 3. Add "Mis Documentos" section to `src/pages/ProfilePage.jsx` + styles
- [x] 4. Add "Documentos" tab to `src/pages/AdminPage.jsx` + styles
- [x] 5. Add document notifications to `src/components/Layout.jsx`
- [x] 6. Verify build passes ✅
