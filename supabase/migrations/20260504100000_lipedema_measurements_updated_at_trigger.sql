-- Add BEFORE UPDATE trigger to bump updated_at on lipedema_measurements.
-- Keeps the column honest if any future writer forgets to set it
-- explicitly (today only the app upsert path sets it).

create or replace function update_lipedema_measurements_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_lipedema_measurements_updated_at
  on public.lipedema_measurements;

create trigger trg_lipedema_measurements_updated_at
  before update on public.lipedema_measurements
  for each row execute function update_lipedema_measurements_updated_at();
