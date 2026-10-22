-- Public inquiries: the home page now has "Request access" and "Contact us".
-- Both land in access_requests, told apart by topic. Existing rows are access requests.
alter table access_requests
  add column topic text not null default 'access',
  add column topic_other text,
  alter column company drop not null,
  add constraint access_requests_topic_check check (topic in ('access', 'demo', 'pricing', 'partnership', 'other'));
alter table access_requests drop constraint access_requests_status_check;
alter table access_requests add constraint access_requests_status_check check (status in ('new', 'contacted', 'approved', 'rejected', 'closed'));

-- Help and support: signed-in customers write to the platform team.
create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  category text not null check (category in ('problem', 'question', 'feature', 'billing')),
  subject text not null,
  page_url text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  last_message_at timestamptz not null default now(),
  last_message_from_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_org_idx on support_tickets(organization_id, last_message_at desc);
create index support_tickets_status_idx on support_tickets(status, last_message_at desc);
create trigger support_tickets_updated before update on support_tickets for each row execute function set_updated_at();

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  from_admin boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on support_messages(ticket_id, created_at);

do $$
declare t text;
begin
  foreach t in array array['support_tickets', 'support_messages'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy tenant_isolation on %I using (app_is_system() or organization_id = app_current_org()) with check (app_is_system() or organization_id = app_current_org())', t);
  end loop;
end $$;
