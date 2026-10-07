-- Discarded opportunities leave the kanban board but stay in the table view.
alter table public.opportunities drop constraint if exists opportunities_status_check;
alter table public.opportunities
  add constraint opportunities_status_check
  check (status in ('new','researched','drafted','sent','discarded'));
