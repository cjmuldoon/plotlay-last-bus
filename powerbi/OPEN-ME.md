# Opening the Power BI report

`LastBus.pbip` is a Power BI Project: the report (`LastBus.Report`, PBIR format) and the semantic model (`LastBus.SemanticModel`, TMDL) saved as text, so the repo can show every change. Power BI Desktop opens it like a `.pbix`.

## What you need

- Power BI Desktop for Windows, a recent version (2026). If Desktop is older than about mid 2025, turn on **File, Options and settings, Options, Preview features, Power BI Project (.pbip) save option** and **Store reports using enhanced metadata format (PBIR)**, then restart Desktop.
- The repo folder on the Windows machine.

## Open it

1. In Windows, open File Explorer and go to the repo's `powerbi` folder.
2. Double-click `LastBus.pbip`, or in Desktop: **File, Open report, Browse reports**, file type *Power BI project files (\*.pbip)*.
3. The visuals are empty the first time. Select **Refresh** on the Home ribbon.
   - By default the data is read from the repo's public copy on GitHub (`DataFolder` is `https://raw.githubusercontent.com/cjmuldoon/plotlay-last-bus/main/data/powerbi/`). If Desktop asks how to connect, choose **Anonymous** and **Connect**.
   - To read the files on disk instead: **Home, Transform data, Edit parameters**, set `DataFolder` to the full path of the repo's `data\powerbi` folder **ending with a backslash**, then **OK** and **Apply changes**.
   - If Desktop warns about privacy levels, choose **Ignore privacy levels** for this file (all sources are public open data) or set them to Public.
4. Check the numbers (below).

If the report was updated while open, close Power BI and reopen the .pbip rather than using Apply external changes.

## Check the numbers after Refresh

After **Refresh**:

| Where | Should read |
|---|---|
| Four cities, card: Melburnians whose last bus leaves 9 to 10 pm | 1,233,765 |
| Four cities, cards: Melbourne after 9 pm, after 10 pm | 73.0, 47.9 |
| Four cities, card: Sydney after 11 pm | 61.7 |
| Four cities, bars, first and last | Sydney 80.7, Brisbane 43.1 |
| Four cities, the curve | four lines from 17:00 to 02:00, in clock order (00:00 after 23:50) |
| The suburbs, table, first row | Melbourne, Point Cook, 66,709, 73.4, 60.4 |

## The model

- `Suburbs` (`data/powerbi/suburbs.csv`): one row per ABS suburb and locality with 100 or more residents, with the share of residents with a bus still to come within 400 m after each hour from 7 pm to midnight, weekday and Sunday. Related to `Cities` by `city`.
- `Curve` (`data/powerbi/curve.csv`): every 10 minutes from 5 pm to 2 am per city, day and modes (`bus`, or `all` for every mode). `time_of_evening` sorts by `minutes_after_5pm`, so the clock runs on past midnight. The curve page shows buses only.
- `Cities` (`data/powerbi/cities.csv`): one row per city with its headline figures.

## The maps

- **Shape Map**, one per city. Each custom map is saved inside the report: the city's suburbs from `data/powerbi/suburbs.topojson`, keyed by `sal_code` (the TopoJSON's `key`). Suburbs with fewer than 200 residents a km² are blank, so they show grey, as on the showcase page.
- If a map shows the United States, or to load the file again: select the map, **Format visual**, **Visual**, **Map settings**, **Map type: Custom map**, **Add map type**, and choose `..\data\powerbi\suburbs.topojson` (all four cities; zoom to the one you want). If the Shape Map is not in the Visualizations pane, turn it on in **File, Options and settings, Options, Preview features, Shape map visual** and restart Desktop.
- If a Shape Map comes up empty after opening, drag the fields back: Location `Suburbs[sal_code]`, Color saturation `[After 9 pm]`.

## What the numbers are

Worked out from each operator's published timetable: the buses as scheduled, not as they ran. A stop counts when it is within 400 m of a mesh block's middle in a straight line. Residents are from the 2021 Census. See the README.
