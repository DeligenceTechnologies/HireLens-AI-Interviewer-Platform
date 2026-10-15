-- Company branding shown to candidates on apply and interview pages.
alter table organizations
  add column logo_path text,
  add column logo_updated_at timestamptz,
  add column brand_color text check (brand_color ~ '^#[0-9a-f]{6}$');
