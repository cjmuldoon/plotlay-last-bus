# Each mesh block's last bus (py/hours.mjs) summed up by suburb: ABS Suburbs and Localities 2021 (SAL), each mesh block
# placed in the suburb its middle falls in. For each suburb of each city: residents (Census 2021), the share with a stop
# within 400 m, the shares with a bus still to come after 7, 9 and 11 pm on the weekday and on Sunday, and the time by
# which half the residents' last bus has gone ("goes quiet at": the residents' median last bus, a resident with no stop
# within 400 m counted as having none). Suburbs with fewer than 100 residents are left off the maps.
#   python -I py/suburbs.py <build dir> <SAL flatgeobuf>
# Writes tables/suburbs.csv (all cities), tables/suburbs.geojson (outlines simplified to about 30 m), numbers.json.
import sys, json
from pathlib import Path
import numpy as np, pandas as pd, geopandas as gpd
B = Path(sys.argv[1]); SAL = sys.argv[2]
CITY = {'adelaide': 'Adelaide', 'melbourne': 'Melbourne', 'sydney': 'Sydney', 'brisbane': 'Brisbane'}
STE = {'adelaide': '4', 'melbourne': '2', 'sydney': '1', 'brisbane': '3'}
SFX = {'1': ' (NSW)', '2': ' (Vic.)', '3': ' (Qld)', '4': ' (SA)'}
def wmedian(v, w):
    o = np.argsort(v); v, w = v[o], w[o]; c = np.cumsum(w)
    return float(v[np.searchsorted(c, c[-1] / 2)]) if len(v) and c[-1] > 0 else np.nan
rows, shapes = [], []
for city, label in CITY.items():
    mb = pd.read_csv(B / f'tables/mb_{city}.csv', dtype={'mb_code': str})
    pts = gpd.GeoDataFrame(mb, geometry=gpd.points_from_xy(mb.lng, mb.lat), crs=4326)
    x0, y0, x1, y1 = pts.total_bounds
    sal = gpd.read_file(SAL, bbox=(x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05))
    sal = sal[sal.ste_code == STE[city]]
    j = gpd.sjoin(pts, sal[['code', 'name', 'area_km2', 'geometry']], predicate='within', how='left')
    j = j[~j.index.duplicated()]
    print(city, 'mesh blocks', len(mb), 'not in a suburb', int(j.code.isna().sum()), 'residents', int(mb.people.sum()))
    for (code, name, km2), g in j.dropna(subset=['code']).groupby(['code', 'name', 'area_km2']):
        p = g.people.to_numpy(float); tot = p.sum()
        if tot <= 0: continue
        r = {'city': label, 'sal_code': code, 'suburb': name.replace(SFX[STE[city]], ''), 'residents': int(round(tot)), 'per_km2': round(tot / km2, 1) if km2 else None, 'sparse': 'Fewer than 200 residents a km²' if km2 and tot / km2 < 200 else '',
             'stop_400m_pct': round(100 * p[g.stops_400m.to_numpy() > 0].sum() / tot, 1)}
        for d in ('wd', 'su'):
            last = g[f'{d}_last_bus_h'].fillna(0).to_numpy(float)
            for h in (19, 20, 21, 22, 23, 24): r[f'{d}_bus_after_{h}_pct'] = round(100 * p[last >= h].sum() / tot, 1)
            r[f'{d}_quiet_h'] = round(wmedian(last, p), 2)
        rows.append(r)
    keep = {r['sal_code'] for r in rows if r['city'] == label and r['residents'] >= 100}
    s = sal[sal.code.isin(keep)].copy(); s['geometry'] = s.to_crs(3577).simplify(30).to_crs(4326); s['city'] = label
    shapes.append(s[['code', 'city', 'geometry']])
df = pd.DataFrame(rows).sort_values(['city', 'suburb'])
def clock(h):
    if not h or np.isnan(h) or h <= 0: return 'No bus'
    m = int(round(h * 60)); return f'{(m // 60) % 24:02d}:{m % 60:02d}'
df['wd_quiet'] = df.wd_quiet_h.map(clock); df['su_quiet'] = df.su_quiet_h.map(clock)
df.to_csv(B / 'tables/suburbs.csv', index=False)
g = pd.concat(shapes); g = g.merge(df[['sal_code', 'suburb', 'residents', 'stop_400m_pct', 'wd_bus_after_21_pct', 'wd_bus_after_22_pct', 'su_bus_after_21_pct', 'wd_quiet_h', 'su_quiet_h', 'wd_quiet', 'su_quiet']], left_on='code', right_on='sal_code').drop(columns='code')
gpd.GeoDataFrame(g, geometry='geometry', crs=4326).to_file(B / 'tables/suburbs.geojson', driver='GeoJSON', COORDINATE_PRECISION=5)
print(df.groupby('city').size().to_dict(), 'suburbs on the maps', len(g))
