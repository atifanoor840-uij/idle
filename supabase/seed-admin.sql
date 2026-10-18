-- Create (or promote) the Verdant Funded CRM admin.
-- 1. Replace the two placeholders below with YOUR email and a strong password.
-- 2. Run in Supabase → SQL Editor AFTER schema.sql.
-- Safe to re-run: if the email already exists it is promoted to an active admin
-- and its password is reset to the one below.

create extension if not exists pgcrypto;

insert into public.users (id, name, email, phone, country, "passwordHash", role, status, "emailVerified")
values (
  'u-admin-' || substr(gen_random_uuid()::text, 1, 8),
  'Admin',
  lower('ADMIN_EMAIL_HERE'),
  '', '',
  encode(digest('ADMIN_PASSWORD_HERE', 'sha256'), 'hex'),
  'admin', 'active', true
)
on conflict (email) do update
  set role = 'admin',
      status = 'active',
      "emailVerified" = true,
      "passwordHash" = excluded."passwordHash";

-- Optional: the copied database still has an admin from the previous firm.
-- To remove its admin access, uncomment and set its email:
-- update public.users set role = 'trader', status = 'suspended' where email = lower('OLD_ADMIN_EMAIL');
