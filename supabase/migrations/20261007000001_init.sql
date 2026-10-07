create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('signup_bonus', 'generation', 'refund')),
  generation_id uuid,
  created_at timestamptz not null default now()
);

create type public.generation_status as enum ('processing', 'succeeded', 'failed');

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.generation_status not null default 'processing',
  prompt text not null,
  options jsonb not null,
  subject text not null default '',
  notes text not null default '',
  size text not null,
  quality text not null,
  storage_path text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generations_user_created_idx
  on public.generations (user_id, created_at desc);

create index generations_stuck_idx
  on public.generations (status, created_at);