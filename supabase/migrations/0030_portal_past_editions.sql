-- ============================================================
-- 0030 — sponsors can read the editions of their own agreements
-- ============================================================
-- Portal sessions could only read active editions (0003), so once an edition
-- was deactivated the sponsor's agreement for it lost its edition: the portal
-- showed "?" where the edition's name belonged, and could not tell a past
-- agreement from a current one. A sponsor may now also read every edition it
-- has an agreement for. Formulas stay limited to active editions: an agreement
-- keeps its own formula name and terms.
-- ============================================================

create policy editions_select_own_deals_portal on editions for select
  using (exists (select 1 from deals d where d.edition_id = editions.id and d.sponsor_id = my_sponsor_id()));
