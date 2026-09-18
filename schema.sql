-- ============================================================
-- Luna Spa — Database schema for Supabase (Postgres)
-- Run this whole file once in: Supabase Dashboard → SQL Editor → New query → Run
-- Seeded with the services/offers/gallery already on the live site,
-- so switching to the database changes nothing visitors see on day one.
--
-- Already ran an earlier version of this file (without contact_messages)?
-- Don't re-run this whole file — "create policy" has no "if not exists"
-- and will error on tables that already exist. Instead run just
-- database/add_contact_messages.sql, which adds the new table safely.
-- ============================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- 1. ADMINS — who is allowed to write data / use the dashboard
-- ----------------------------------------------------------------
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ----------------------------------------------------------------
-- 2. SETTINGS — single row, business info shown across the site
-- ----------------------------------------------------------------
create table if not exists settings (
  id int primary key default 1,
  business_name text not null default 'Luna Spa',
  phone text not null default '0552333284',
  whatsapp text not null default '966552333284',
  location text not null default 'الرياض — حي إشبيليا',
  tiktok_url text not null default 'https://www.tiktok.com/@lunasalon24',
  instagram_url text default '',
  description text not null default 'في Luna Spa نهتم بتقديم تجربة متكاملة للعناية والجمال، من خلال مجموعة متنوعة من خدمات السبا والعناية بالبشرة والشعر والأظافر، في أجواء هادئة ومريحة.',
  logo_url text default '',
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- 3. SERVICES
-- ----------------------------------------------------------------
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('hair','skin','nails','spa')),
  description text default '',
  price numeric,
  price_on_request boolean not null default false,
  image_url text default '',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 4. OFFERS
-- ----------------------------------------------------------------
create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  included_services jsonb not null default '[]',  -- [{ "name": "...", "price": "96 ريال" }]
  old_price numeric,
  new_price numeric,
  new_price_on_request boolean not null default false,
  valid_text text default '',
  image_url text default '',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 5. GALLERY IMAGES
-- ----------------------------------------------------------------
create table if not exists gallery_images (
  id uuid primary key default gen_random_uuid(),
  title text default '',
  category text not null check (category in ('hair','skin','nails','spa')),
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 6. BOOKINGS
-- ----------------------------------------------------------------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  service text not null,
  booking_date date not null,
  booking_time time not null,
  notes text default '',
  status text not null default 'new' check (status in ('new','confirmed','completed','cancelled')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 7. CONTACT MESSAGES (from the "تواصل معنا" page)
-- ----------------------------------------------------------------
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text default '',
  message text not null,
  status text not null default 'new' check (status in ('new','read')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Visitors: read active services/offers, all gallery images/settings,
-- and can insert a booking. Admins: full read/write on everything.
-- ----------------------------------------------------------------
alter table settings        enable row level security;
alter table services        enable row level security;
alter table offers          enable row level security;
alter table gallery_images  enable row level security;
alter table bookings        enable row level security;
alter table admins          enable row level security;

create policy "settings_public_read" on settings for select using (true);
create policy "settings_admin_write" on settings for all using (is_admin()) with check (is_admin());

create policy "services_public_read" on services for select using (active = true or is_admin());
create policy "services_admin_insert" on services for insert with check (is_admin());
create policy "services_admin_update" on services for update using (is_admin()) with check (is_admin());
create policy "services_admin_delete" on services for delete using (is_admin());

create policy "offers_public_read" on offers for select using (active = true or is_admin());
create policy "offers_admin_insert" on offers for insert with check (is_admin());
create policy "offers_admin_update" on offers for update using (is_admin()) with check (is_admin());
create policy "offers_admin_delete" on offers for delete using (is_admin());

create policy "gallery_public_read" on gallery_images for select using (true);
create policy "gallery_admin_insert" on gallery_images for insert with check (is_admin());
create policy "gallery_admin_update" on gallery_images for update using (is_admin()) with check (is_admin());
create policy "gallery_admin_delete" on gallery_images for delete using (is_admin());

create policy "bookings_public_insert" on bookings for insert with check (true);
create policy "bookings_admin_select" on bookings for select using (is_admin());
create policy "bookings_admin_update" on bookings for update using (is_admin()) with check (is_admin());
create policy "bookings_admin_delete" on bookings for delete using (is_admin());

alter table contact_messages enable row level security;
create policy "messages_public_insert" on contact_messages for insert with check (true);
create policy "messages_admin_select" on contact_messages for select using (is_admin());
create policy "messages_admin_update" on contact_messages for update using (is_admin()) with check (is_admin());
create policy "messages_admin_delete" on contact_messages for delete using (is_admin());

create policy "admins_admin_select" on admins for select using (is_admin());

-- ----------------------------------------------------------------
-- SEED DATA — exactly what is already on the live Luna Spa site,
-- so nothing changes for visitors when you switch it to the database.
-- Freely edit or delete from the admin dashboard afterward.
-- ----------------------------------------------------------------
insert into services (name, category, description, price, price_on_request, image_url, sort_order) values
('حمام مغربي', 'spa', 'تقشير وتنظيف عميق للجسم بطريقة الحمام المغربي التقليدية لبشرة ناعمة ومنتعشة', null, true, 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?q=80&w=600&auto=format&fit=crop', 1),
('حمام سوداني', 'spa', 'دلكة سودانية أصيلة تمنح بشرتك نضارة ورائحة مميزة تدوم طويلاً', null, true, 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=600&auto=format&fit=crop', 2),
('ديتوكس كلاسيك', 'spa', 'جلسة استرخاء متكاملة تخلّص الجسم من السموم وتمنحك شعوراً بالانتعاش', null, true, 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=600&auto=format&fit=crop', 3),
('تنظيف بشرة', 'skin', 'جلسة تنظيف بشرة اسبيشل احترافية لإزالة الشوائب وترطيب البشرة', 96, false, 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c1?q=80&w=600&auto=format&fit=crop', 4),
('تركيب أظافر مع لون', 'nails', 'تركيب أظافر احترافي مع اختيار اللون المناسب لإطلالة أنيقة', 96, false, 'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=600&auto=format&fit=crop', 5),
('تركيب أظافر مع لون جل', 'nails', 'تركيب أظافر بلون جل يدوم لفترة أطول مع لمعان مميز', 96, false, 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?q=80&w=600&auto=format&fit=crop', 6),
('جلسة ترطيب للشعر', 'hair', 'علاج ترطيب عميق يعيد الحيوية واللمعان للشعر التالف والجاف', 96, false, 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=600&auto=format&fit=crop', 7),
('قص + استشوار استريت', 'hair', 'قصة شعر عصرية مع تصفيف استشوار استريت لإطلالة ناعمة', 96, false, 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?q=80&w=600&auto=format&fit=crop', 8),
('صبغة جذور', 'hair', 'تغطية احترافية لجذور الشعر بلون متجانس مع باقي الشعر', 96, false, 'https://images.unsplash.com/photo-1595959183082-7b570b7e08e2?q=80&w=600&auto=format&fit=crop', 9)
on conflict do nothing;

insert into offers (title, description, included_services, old_price, new_price, new_price_on_request, valid_text, sort_order) values
('باقة العناية الكاملة', 'مجموعة من أفضل خدمات الشعر والأظافر والبشرة بسعر خاص',
 '[{"name":"تركيب أظافر مع لون","price":"96 ريال"},{"name":"تنظيف بشرة اسبيشل","price":"96 ريال"},{"name":"جلسة ترطيب للشعر","price":"96 ريال"},{"name":"قص + استشوار استريت","price":"96 ريال"},{"name":"صبغة جذور","price":"96 ريال"}]',
 null, 170, false, 'العرض ساري لفترة محدودة — تواصلي معنا لتأكيد التفاصيل والتوفر', 1),
('ديتوكس كلاسيك + حمام مغربي', 'جلسة استرخاء متكاملة تجمع بين الديتوكس والحمام المغربي الكلاسيكي',
 '[{"name":"ديتوكس كلاسيك","price":"السعر عند الحجز"},{"name":"حمام مغربي كلاسيك","price":"السعر عند الحجز"}]',
 null, null, true, 'احجزي مسبقاً لضمان توفر الموعد المناسب لك', 2),
('قصة + استشوار + صبغة جذور', 'إطلالة شعر متكاملة من القص وحتى التصفيف وتغطية الجذور',
 '[{"name":"قص الشعر","price":"96 ريال"},{"name":"استشوار استريت","price":"96 ريال"},{"name":"صبغة جذور","price":"96 ريال"}]',
 null, 170, false, 'العرض قابل للتغيير — يُرجى التأكيد عبر واتساب قبل الحجز', 3)
on conflict do nothing;

insert into gallery_images (title, category, image_url, sort_order) values
('جلسة حمام مغربي', 'spa', 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?q=80&w=700&auto=format&fit=crop', 1),
('جلسة ترطيب شعر', 'hair', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=700&auto=format&fit=crop', 2),
('تركيب أظافر', 'nails', 'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=700&auto=format&fit=crop', 3),
('جلسة تنظيف بشرة', 'skin', 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c1?q=80&w=700&auto=format&fit=crop', 4),
('تصفيف شعر استشوار', 'hair', 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?q=80&w=700&auto=format&fit=crop', 5),
('جلسة ديتوكس', 'spa', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=700&auto=format&fit=crop', 6),
('أظافر لون جل', 'nails', 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?q=80&w=700&auto=format&fit=crop', 7),
('عناية بالبشرة', 'skin', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?q=80&w=700&auto=format&fit=crop', 8),
('صبغة جذور', 'hair', 'https://images.unsplash.com/photo-1595959183082-7b570b7e08e2?q=80&w=700&auto=format&fit=crop', 9),
('حمام سوداني', 'spa', 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=700&auto=format&fit=crop', 10),
('مانيكير', 'nails', 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?q=80&w=700&auto=format&fit=crop', 11),
('جلسة استرخاء', 'skin', 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?q=80&w=700&auto=format&fit=crop', 12)
on conflict do nothing;

-- ----------------------------------------------------------------
-- STORAGE — public bucket for images uploaded from the dashboard
-- ----------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('luna-spa', 'luna-spa', true)
on conflict (id) do nothing;

create policy "luna_spa_public_read" on storage.objects for select using (bucket_id = 'luna-spa');
create policy "luna_spa_admin_insert" on storage.objects for insert with check (bucket_id = 'luna-spa' and is_admin());
create policy "luna_spa_admin_update" on storage.objects for update using (bucket_id = 'luna-spa' and is_admin());
create policy "luna_spa_admin_delete" on storage.objects for delete using (bucket_id = 'luna-spa' and is_admin());
