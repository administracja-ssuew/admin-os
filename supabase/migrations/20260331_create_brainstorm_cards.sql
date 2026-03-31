-- Tabela karteczek burzy mózgów
-- Uruchom w Supabase Dashboard → SQL Editor

create table if not exists public.brainstorm_cards (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  color       text not null default 'yellow'
                check (color in ('yellow', 'sky', 'green', 'pink', 'purple', 'orange')),
  author_id   uuid not null references public.users(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists brainstorm_cards_author_idx
  on public.brainstorm_cards (author_id);

create index if not exists brainstorm_cards_assigned_idx
  on public.brainstorm_cards (assigned_to);

-- RLS: tylko admini i superadmini mają dostęp
alter table public.brainstorm_cards enable row level security;

create policy "Admins can read brainstorm cards"
  on public.brainstorm_cards for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
        and system_role in ('admin', 'superadmin')
    )
  );

create policy "Admins can insert brainstorm cards"
  on public.brainstorm_cards for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid()
        and system_role in ('admin', 'superadmin')
    )
  );

create policy "Author or admin can delete brainstorm cards"
  on public.brainstorm_cards for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.users
      where id = auth.uid()
        and system_role in ('admin', 'superadmin')
    )
  );
