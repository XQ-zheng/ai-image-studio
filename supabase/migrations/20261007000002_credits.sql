create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, credits) values (new.id, 5);
  insert into public.credit_ledger (user_id, delta, reason)
    values (new.id, 5, 'signup_bonus');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.start_generation(
  p_user_id uuid,
  p_prompt text,
  p_options jsonb,
  p_subject text,
  p_notes text,
  p_size text,
  p_quality text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
  new_id uuid := gen_random_uuid();
begin
  update public.profiles
     set credits = credits - 1
   where id = p_user_id
     and credits >= 1;

  get diagnostics affected = row_count;
  if affected = 0 then
    return null;
  end if;

  insert into public.generations
    (id, user_id, status, prompt, options, subject, notes, size, quality)
  values
    (new_id, p_user_id, 'processing', p_prompt, p_options, p_subject, p_notes, p_size, p_quality);

  insert into public.credit_ledger (user_id, delta, reason, generation_id)
    values (p_user_id, -1, 'generation', new_id);

  return new_id;
end;
$$;

create or replace function public.refund_credit(p_generation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select g.user_id into owner_id
    from public.generations g
   where g.id = p_generation_id
     and g.status = 'processing'
   for update;

  if owner_id is null then
    return false;
  end if;

  update public.profiles set credits = credits + 1 where id = owner_id;

  insert into public.credit_ledger (user_id, delta, reason, generation_id)
    values (owner_id, 1, 'refund', p_generation_id);

  update public.generations
     set status = 'failed',
         error = coalesce(error, 'refunded'),
         updated_at = now()
   where id = p_generation_id;

  return true;
end;
$$;