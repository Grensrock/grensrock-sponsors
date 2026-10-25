-- ============================================================
-- 0025 — a formula has a colour
-- ============================================================
-- Each formula of an edition gets a colour, picked in the formula form. The
-- team app shows it wherever the formula appears: the buttons in the
-- agreement form, the overview, the editions table; the portal uses it on
-- the formula cards a sponsor chooses from.
--
-- Stored as lowercase #rrggbb. '' means no colour chosen yet; the app then
-- draws the formula in a neutral grey.
--
-- Agreements keep only the formula's name (they snapshot its benefits, not
-- its presentation), so the colour is looked up live and needs no copy on
-- deals.
-- ============================================================

alter table formulas add column color text not null default ''
  constraint formulas_color_hex check (color = '' or color ~ '^#[0-9a-f]{6}$');

-- Formulas named after a colour start out in that colour, so an edition whose
-- formulas are called ROOD / GEEL / GROEN (or gold / silver / bronze) reads
-- right from the first load. Anything else stays '' until someone picks one.
-- The hex values are the swatches the formula form offers (lib/color.ts).
update formulas set color = case lower(trim(name))
    when 'rood'   then '#b3362b' when 'rouge'  then '#b3362b' when 'red'    then '#b3362b'
    when 'geel'   then '#c9c463' when 'jaune'  then '#c9c463' when 'yellow' then '#c9c463'
    when 'groen'  then '#4fa05f' when 'vert'   then '#4fa05f' when 'green'  then '#4fa05f'
    when 'blauw'  then '#4a90c4' when 'bleu'   then '#4a90c4' when 'blue'   then '#4a90c4'
    when 'oranje' then '#de8140' when 'orange' then '#de8140'
    when 'roze'   then '#c9518d' when 'rose'   then '#c9518d' when 'pink'   then '#c9518d'
    when 'zwart'  then '#1c1a1c' when 'noir'   then '#1c1a1c' when 'black'  then '#1c1a1c'
    when 'goud'   then '#c9a227' when 'or'     then '#c9a227' when 'gold'   then '#c9a227'
    when 'zilver' then '#9ea3a8' when 'argent' then '#9ea3a8' when 'silver' then '#9ea3a8'
    when 'brons'  then '#a9713b' when 'bronze' then '#a9713b'
    else ''
  end
where color = '';
