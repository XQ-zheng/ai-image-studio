alter table public.profiles enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.generations enable row level security;

create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "read own ledger" on public.credit_ledger
  for select using (auth.uid() = user_id);

create policy "read own generations" on public.generations
  for select using (auth.uid() = user_id);