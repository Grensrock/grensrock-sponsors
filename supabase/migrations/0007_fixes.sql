-- Grensrock Sponsors — Stage 2 fixes found during app-code review
-- Run after 0006_storage.sql.
--
-- Fix 1: the original app's deleteDeal preserves *issued* (created/sent)
-- vouchers as "cancelled" when a deal is deleted — only pending ones are
-- hard-deleted. `vouchers.deal_id ... on delete cascade` (from 0001_schema.sql)
-- would instead destroy every voucher row unconditionally, losing that
-- history. Vouchers can't stay `not null` on deal_id if they're meant to
-- outlive their deal, so this makes the column nullable and switches the FK
-- to `on delete set null` — the app-side deleteDeal() now cancels/detaches
-- issued vouchers and deletes pending ones *before* deleting the deal, then
-- the FK just clears the now-dangling reference on the ones left behind.
alter table vouchers alter column deal_id drop not null;
alter table vouchers drop constraint vouchers_deal_id_fkey;
alter table vouchers add constraint vouchers_deal_id_fkey
  foreign key (deal_id) references deals(id) on delete set null;

-- Fix 2: the sponsor portal's ContactForm has a working "remove contact"
-- button (SponsorPortal.tsx's removeContact) with no extra guard (no
-- "can't delete yourself" / "can't delete the last contact" check in the
-- original — matching that exactly). There was no RPC for it, so portal
-- contact deletion silently failed.
create or replace function delete_sponsor_contact(p_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sid uuid := my_sponsor_id();
begin
  if sid is null then
    raise exception 'Not logged in as a sponsor contact.';
  end if;
  delete from contacts where id = p_contact_id and sponsor_id = sid;
end;
$$;

revoke execute on function delete_sponsor_contact(uuid) from public;
grant execute on function delete_sponsor_contact(uuid) to authenticated;
