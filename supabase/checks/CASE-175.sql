-- CASE-175: an address is looked up once per ~55 m cell and saved, then reused for every location in that cell.
-- Read-only. Each saved place and how many stored locations fall in its cell.
select p.cell, left(p.label, 42) as saved_address, p.provider,
       to_char(p.fetched_at at time zone 'Asia/Manila', 'MM-DD HH24:MI') as looked_up,
       (select count(*) from location_logs l where location_cell(l.latitude, l.longitude) = p.cell) as locations_using_it
from location_places p
order by locations_using_it desc limit 8;
