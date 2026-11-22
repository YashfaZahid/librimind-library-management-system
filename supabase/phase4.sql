-- Phase 4. Run this once in the Supabase SQL editor.
-- It adds the title fields a digital file needs. The buckets and policies already exist.

alter table public.digital_assets
  add column if not exists title text not null default '';

alter table public.digital_assets
  add column if not exists authors text[] not null default '{}';

alter table public.digital_assets
  add column if not exists description text not null default '';
