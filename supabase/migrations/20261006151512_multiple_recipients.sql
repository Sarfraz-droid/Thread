-- Keep existing single-recipient drafts intact; additional recipients start empty.
alter table public.drafts
  add column cc_emails text[] not null default '{}',
  add column bcc_emails text[] not null default '{}',
  add constraint drafts_cc_emails_limit check (cardinality(cc_emails) <= 50),
  add constraint drafts_bcc_emails_limit check (cardinality(bcc_emails) <= 50);
