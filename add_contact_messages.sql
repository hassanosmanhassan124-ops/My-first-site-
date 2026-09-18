-- ============================================================
-- Luna Spa — add-on migration: contact messages
-- Run this ONLY if you already ran database/schema.sql before
-- (i.e. your database already has services/offers/bookings working).
-- If this is your first time setting up the database, ignore this
-- file — schema.sql already includes everything below.
-- ============================================================

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text default '',
  message text not null,
  status text not null default 'new' check (status in ('new','read')),
  created_at timestamptz not null default now()
);

alter table contact_messages enable row level security;

create policy "messages_public_insert" on contact_messages for insert with check (true);
create policy "messages_admin_select" on contact_messages for select using (is_admin());
create policy "messages_admin_update" on contact_messages for update using (is_admin()) with check (is_admin());
create policy "messages_admin_delete" on contact_messages for delete using (is_admin());
