-- Flex account type: a small upfront fee at checkout, the remaining balance after passing.
-- Run once in the Supabase SQL editor. Safe to re-run.
alter table public.pricing_plans add column if not exists "upfrontPrice" numeric;
alter table public.orders add column if not exists "activationFee" numeric;
alter table public.orders add column if not exists "parentOrderId" text;
