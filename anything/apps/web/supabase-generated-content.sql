create table if not exists public.generated_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null default 'post',
  platform text default 'general',
  generated_text jsonb not null,
  status text not null default 'draft',
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generated_content enable row level security;

create policy "Users can read their generated content"
  on public.generated_content
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their generated content"
  on public.generated_content
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their generated content"
  on public.generated_content
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their generated content"
  on public.generated_content
  for delete
  to authenticated
  using (auth.uid() = user_id);
alter table public.generated_content
  add column if not exists media jsonb,
  add column if not exists published_at timestamptz,
  add column if not exists publish_error text;
