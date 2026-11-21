// The last bus of the evening in four cities, from each operator's published GTFS feed, with Plotlay's own engine
// (src/core/gtfs.js readGtfs, src/core/servicehours.js serviceHours, mergeHours, nearest).
// For each city and day (Wednesday 25 November 2026, an ordinary school-term weekday; Sunday 29 November 2026): every
// bus departure of the day read in three windows (03:00 to 11:00, 11:00 to 19:00, 19:00 to 27:00, so past midnight
// counts), school and demand responsive services left out, the stops kept that lie within 1 km of a mesh block with
// residents in the Greater Capital City (so regional routes in a state-wide feed fall away). Then each mesh block with
// residents (ABS Census 2021 counts) gets the latest last bus and the earliest first bus of the stops within 400 m of
// its middle, in a straight line. The same again for every mode (bus, train, tram, light rail, ferry) for comparison.
//   node py/hours.mjs <plotlay repo> <build dir>
// Writes tables/stops_<city>.csv, tables/mb_<city>.csv, tables/curve.csv, tables/cities.json.
import fs from 'node:fs';
const [PL, B] = process.argv.slice(2);
const G = await import(PL + '/src/core/gtfs.js'), H = await import(PL + '/src/core/servicehours.js');
const CITIES = ['adelaide', 'melbourne', 'sydney', 'brisbane'];
const DAYS = { weekday: '2026-11-25', sunday: '2026-11-29' };
const WINDOWS = [['03:00', '11:00'], ['11:00', '19:00'], ['19:00', '27:00']];
const src = (city) => { const fd = fs.openSync(`${B}/raw/gtfs/${city}.zip`, 'r'), size = fs.fstatSync(fd).size; return { size, read: async (o, n) => { const b = Buffer.alloc(n); fs.readSync(fd, b, 0, n, o); return new Uint8Array(b.buffer, b.byteOffset, n); } }; };
const MX = (lat) => 111320 * Math.cos(lat * Math.PI / 180), MY = 111132;
const out = {}, curve = [['city', 'day', 'modes', 'time', 'hours', 'residents_with_service_to_come', 'share']];
for (const city of CITIES) {
    const ppl = JSON.parse(fs.readFileSync(`${B}/../transit-45-minutes-build/out/people-${city}.json`));
    const mbs = ppl.blocks.map((b) => { const r = b.rings[0]; let la = 0, ln = 0; for (const q of r) { la += q[0]; ln += q[1]; } return { code: b.code, people: b.people, lat: la / r.length, lng: ln / r.length }; });
    const total = mbs.reduce((t, m) => t + m.people, 0);
    let box = [90, 180, -90, -180]; for (const m of mbs) box = [Math.min(box[0], m.lat), Math.min(box[1], m.lng), Math.max(box[2], m.lat), Math.max(box[3], m.lng)];
    box = [box[0] - 0.02, box[1] - 0.02, box[2] + 0.02, box[3] + 0.02];
    // a 1 km grid of the resident mesh blocks, to keep the city's stops
    const mx = MX(mbs[0].lat), cells = new Set(mbs.map((m) => `${Math.floor(m.lng * mx / 1000)},${Math.floor(m.lat * MY / 1000)}`));
    const inCity = (la, ln) => { const cx = Math.floor(ln * mx / 1000), cy = Math.floor(la * MY / 1000); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (cells.has(`${cx + dx},${cy + dy}`)) return true; return false; };
    const S = src(city); out[city] = { residents: Math.round(total), mesh_blocks: mbs.length, days: {} };
    const res = {};
    for (const [day, date] of Object.entries(DAYS)) {
        for (const modes of [['bus'], null]) {
            const tag = modes ? 'bus' : 'all';
            const parts = [];
            const t0 = Date.now();
            for (const [a, b] of WINDOWS) parts.push(H.serviceHours(await G.readGtfs(S, { date, from: a, to: b, box, routeTypes: modes }), { modes }));
            const sh = H.filterHours(H.mergeHours(parts), inCity);
            const near = H.nearest(sh, mbs.map((m) => [m.lat, m.lng]), { radius: 400 });
            res[`${day}_${tag}`] = near;
            const share = (f) => Math.round((10000 * mbs.reduce((t, m, i) => t + (f(near[i]) ? m.people : 0), 0)) / total) / 10000;
            const rec = { date, secs: (Date.now() - t0) / 1000, stops: sh.stops.n, routes: sh.routes.length, left_out: sh.left_out, feeds: (sh.feeds || []).map((f) => [f.name, f.version]),
                stops_none_after: Object.fromEntries(H.quietShares(sh, [19, 20, 21, 22, 23, 24].map((h) => h * 3600)).map((r) => [r.clock, r.share])),
                residents_no_stop: share((n) => !n.stops),
                residents_none_after: Object.fromEntries([19, 20, 21, 22, 23, 24].map((h) => [`${h}:00`, share((n) => !n.stops || n.last < h * 3600)])),
                residents_stop_but_none_after: Object.fromEntries([19, 21, 23].map((h) => [`${h}:00`, share((n) => n.stops && n.last < h * 3600)])),
                residents_none_before: Object.fromEntries([5, 6, 7].map((h) => [`${h}:00`, share((n) => !n.stops || n.first > h * 3600)])) };
            out[city].days[`${day}_${tag}`] = rec;
            for (let m = 17 * 60; m <= 26 * 60; m += 10) { const t = m * 60, n = mbs.reduce((tt, q, i) => tt + (near[i].stops && near[i].last >= t ? q.people : 0), 0); curve.push([city, day, tag, G.hhmm(t), (m / 60).toFixed(3), Math.round(n), (n / total).toFixed(4)]); }
            if (modes) {
                const rows = [['stop_id', 'name', 'lat', 'lng', 'first', 'last', 'first_h', 'last_h', 'departures']];
                for (let i = 0; i < sh.stops.n; i++) rows.push([sh.stops.id[i].replace(/^.*?:/, ''), JSON.stringify(sh.stops.name[i]), sh.stops.lat[i].toFixed(6), sh.stops.lng[i].toFixed(6), H.clock(sh.stops.first[i]), H.clock(sh.stops.last[i]), H.hoursOf(sh.stops.first[i]), H.hoursOf(sh.stops.last[i]), sh.stops.deps[i]]);
                fs.writeFileSync(`${B}/tables/stops_${city}_${day}.csv`, rows.map((r) => r.join(',')).join('\n') + '\n');
                // the routes ending first and last (checks)
                out[city].days[`${day}_${tag}`].routes_ending = [...sh.routes].sort((x, y) => x.last - y.last).map((r) => [r.short || r.long, H.clock(r.last), r.trips]);
            }
            console.log(city, day, tag, rec.secs, 'stops', rec.stops, 'res none after 21', rec.residents_none_after['21:00']);
        }
    }
    const rows = [['mb_code', 'people', 'lat', 'lng', 'stops_400m', 'wd_last_bus', 'wd_last_bus_h', 'wd_first_bus_h', 'wd_departures', 'su_last_bus', 'su_last_bus_h', 'su_departures', 'wd_last_any_h', 'su_last_any_h']];
    mbs.forEach((m, i) => { const w = res.weekday_bus[i], s = res.sunday_bus[i], wa = res.weekday_all[i], sa = res.sunday_all[i];
        rows.push([m.code, m.people, m.lat.toFixed(6), m.lng.toFixed(6), w.stops, H.clock(w.last) ?? '', H.hoursOf(w.last) ?? '', H.hoursOf(w.first) ?? '', w.deps, H.clock(s.last) ?? '', H.hoursOf(s.last) ?? '', s.deps, H.hoursOf(wa.last) ?? '', H.hoursOf(sa.last) ?? '']); });
    fs.writeFileSync(`${B}/tables/mb_${city}.csv`, rows.map((r) => r.join(',')).join('\n') + '\n');
}
fs.writeFileSync(`${B}/tables/curve.csv`, curve.map((r) => r.join(',')).join('\n') + '\n');
fs.writeFileSync(`${B}/tables/cities.json`, JSON.stringify(out, null, 1));
