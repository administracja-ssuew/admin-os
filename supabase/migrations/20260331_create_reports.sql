-- Tabela raportów podkomisji
-- Uruchom w Supabase Dashboard → SQL Editor

create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  content          text,
  submitted_by     uuid references public.users(id) on delete set null,
  submitted_at     timestamptz not null default now(),
  status           text not null default 'new'
                     check (status in ('new', 'read', 'requires_action', 'archived')),
  subcommittee_type text not null default 'logistics'
);

-- Indeks dla filtrowania po typie podkomisji
create index if not exists reports_subcommittee_type_idx
  on public.reports (subcommittee_type);

-- RLS: każdy zalogowany może czytać i tworzyć raporty
alter table public.reports enable row level security;

create policy "Authenticated users can read reports"
  on public.reports for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert reports"
  on public.reports for insert
  with check (auth.role() = 'authenticated');

-- Tylko admin lub autor może zmieniać status
create policy "Author or admin can update report status"
  on public.reports for update
  using (
    auth.uid() = submitted_by
    or exists (
      select 1 from public.users
      where id = auth.uid()
        and system_role in ('admin', 'superadmin')
    )
  );
