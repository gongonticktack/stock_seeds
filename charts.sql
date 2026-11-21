-- chart_key が空だったピックへ生成したチャートキーを設定する
-- 対象: 19 件

update public.stock_picks set chart_key = '2026-11-20-5938' where id = 1 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-20-EMN' where id = 2 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-20-TAP' where id = 3 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-18-9005' where id = 4 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-18-MKC' where id = 5 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-18-GIS' where id = 6 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-17-WU' where id = 7 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-17-BHF' where id = 8 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-17-WY' where id = 9 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-13-5938' where id = 10 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-13-EMN' where id = 11 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-13-INVH' where id = 12 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-12-TAP' where id = 13 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-11-9005' where id = 14 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-11-KHC' where id = 15 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-10-GIS' where id = 16 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-10-MKC' where id = 17 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-10-HRL' where id = 18 and (chart_key is null or chart_key = '');
update public.stock_picks set chart_key = '2026-11-09-WU' where id = 19 and (chart_key is null or chart_key = '');
