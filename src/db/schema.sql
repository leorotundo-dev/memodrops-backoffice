-- Requires: CREATE EXTENSION IF NOT EXISTS pgcrypto;
create table if not exists harvest_items(
  id uuid primary key default gen_random_uuid(),
  source text not null,                   -- e.g., 'fgv', 'ceb', 'planalto', 'dou'
  url text not null,
  fetched_at timestamptz,
  processed_at timestamptz,
  status text not null default 'queued',  -- queued|fetched|deduped|stored|skipped|error
  http_status int,
  title text,
  content_text text,
  hash text,
  license text,                           -- inferred license (e.g., 'public_domain', 'unknown')
  pii_flags jsonb default '[]'::jsonb,
  meta jsonb default '{}'::jsonb,
  unique (source, url)
);

create index if not exists harvest_items_hash_idx on harvest_items(hash);
create index if not exists harvest_items_source_status_idx on harvest_items(source, status);
