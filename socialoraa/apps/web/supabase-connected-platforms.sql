create table if not exists public.connected_platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  provider text not null,
  account_label text not null,
  external_account_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text,
  account_metadata jsonb,
  status text not null default 'verified',
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, external_account_id)
);

alter table public.connected_platforms
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists scopes text,
  add column if not exists account_metadata jsonb;

alter table public.connected_platforms enable row level security;

create policy "Users can read their connected platforms"
  on public.connected_platforms
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their connected platforms"
  on public.connected_platforms
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their connected platforms"
  on public.connected_platforms
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their connected platforms"
  on public.connected_platforms
  for delete
  to authenticated
  using (auth.uid() = user_id);
