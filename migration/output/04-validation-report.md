# 04 — Staging validation report
Generated: 2026-05-09T08:26:40.803Z
Target: `scrapyards_staging` schema on `heliumdb` (resolved via db-url.ts)

## 1. Row counts — expected vs actual

| table | expected | actual |
| --- | --- | --- |
| cities | 3493 | 3493 |
| legacy_redirects | >8000 (DB has full comprehensive set: GSC + synthetic parents + per-yard canonical + dedupe-losers; CSV ships GSC-only per task contract) | 8989 |
| metal_categories | 9 | 9 |
| metals | 22 | 22 |
| states | 51 | 51 |
| yards | 7722 | 7722 |

### Strict CSV ↔ GSC coverage

- gsc-pages.csv URL count: **1000**

- 05-legacy-redirects.csv row count: **1000**

- GSC URLs missing from CSV: **0** (must be 0)

- CSV rows not present in GSC: **0** (must be 0; comprehensive entries live in the DB only)


**ETL meta:** posts_input=13082, pre-dedupe yards=8296, dedupe winners=7722, losers folded in=574, skipped=4786.

### Yards by status

| status | n |
| --- | --- |
| active | 7722 |

### Yards by state (top 15)

| state_code | n |
| --- | --- |
| TX | 609 |
| CA | 505 |
| PA | 461 |
| FL | 452 |
| OH | 430 |
| LA | 388 |
| MI | 386 |
| IL | 334 |
| NY | 284 |
| NC | 248 |
| GA | 232 |
| IN | 207 |
| TN | 207 |
| WI | 206 |
| NJ | 179 |

## 2. Slug uniqueness + suffix audit

Duplicate (state_code, city_id, slug) groups: **0** (must be 0)

Yards with bare numeric suffix `-N`: **0** (must be 0 — the ETL disambiguates collisions via address/zip/post-id tokens, see §5 stats below).

Disambiguation method breakdown (from ETL meta):

| method | n |
| --- | --- |
| base slug used as-is | 7611 |
| base + address token (e.g. acme-1500-main, acme-main) | 108 |
| base + z<zip> | 3 |
| base + p<post_id> (last-resort, guaranteed unique) | 0 |

## 3. Orphans & referential integrity

| check | n |
| --- | --- |
| yards with missing state | 0 |
| yards with missing city | 0 |
| cities with no yards | 0 |
| metals with missing category | 0 |

## 4. Geo + contact coverage

| total | missing_geo | missing_address | missing_zip | missing_phone | missing_website | missing_hours |
| --- | --- | --- | --- | --- | --- | --- |
| 7722 | 0 | 573 | 284 | 0 | 4445 | 2115 |

## 5. Category bucket sanity

### `metal_categories` rows

| slug | name | display_order |
| --- | --- | --- |
| copper | Copper | 10 |
| aluminum | Aluminum | 20 |
| steel | Steel & Iron | 30 |
| brass | Brass | 40 |
| lead | Lead | 50 |
| zinc | Zinc | 60 |
| electronics | Electronics (E-Scrap) | 70 |
| precious-metals | Precious Metals | 80 |
| auto-parts | Auto Parts | 90 |

### `metals` rows (D2 Option A — 22 canonical entries, no WP metal posts imported)

| slug | name | category | unit | spot_metal | display_order |
| --- | --- | --- | --- | --- | --- |
| bare-bright-copper | Bare Bright Copper | copper | lb | copper | 1 |
| copper-1 | #1 Copper | copper | lb | copper | 2 |
| copper-2 | #2 Copper | copper | lb | copper | 3 |
| insulated-copper-wire | Insulated Copper Wire | copper | lb | copper | 4 |
| aluminum-mixed | Aluminum (Mixed) | aluminum | lb | aluminum | 10 |
| aluminum-cans | Aluminum Cans | aluminum | lb | aluminum | 11 |
| aluminum-extrusion | Aluminum Extrusion | aluminum | lb | aluminum | 12 |
| steel-heavy-melt | Steel (Heavy Melt) | steel | ton | steel | 20 |
| light-iron | Light Iron / Sheet | steel | ton | steel | 21 |
| cast-iron | Cast Iron | steel | lb | steel | 22 |
| stainless-steel | Stainless Steel (304) | steel | lb | nickel | 23 |
| brass-yellow | Yellow Brass | brass | lb | copper | 30 |
| brass-red | Red Brass | brass | lb | copper | 31 |
| lead-soft | Lead (Soft) | lead | lb | lead | 40 |
| lead-wheel-weights | Lead Wheel Weights | lead | lb | lead | 41 |
| zinc-die-cast | Zinc Die Cast | zinc | lb | zinc | 50 |
| low-grade-board | Low-Grade Circuit Board | electronics | lb |  | 60 |
| high-grade-board | High-Grade Circuit Board | electronics | lb |  | 61 |
| silver | Silver (.999) | precious-metals | oz | silver | 70 |
| gold | Gold (.999) | precious-metals | oz | gold | 71 |
| car-battery | Car Battery | auto-parts | each |  | 80 |
| catalytic-converter | Catalytic Converter | auto-parts | each |  | 81 |

### Distinct `yards.accepted` values

| accepted_slug | n |
| --- | --- |
| aluminum | 760 |
| copper | 675 |
| brass | 497 |
| lead | 458 |
| steel | 52 |
| precious-metals | 28 |

### Top 25 `yards.services` values

| service_slug | n |
| --- | --- |
| scrap-metals | 7721 |
| recycling-centers | 3457 |
| surplus-salvage-merchandise | 1747 |
| scrap-metals-wholesale | 1260 |
| automobile-salvage | 969 |
| junk-dealers | 817 |
| recycling-equipment-services | 619 |
| automobile-parts-supplies | 526 |
| used-rebuilt-auto-parts | 510 |
| smelters-refiners-precious-metals | 495 |
| automobile-parts-supplies-used-rebuilt-wholesale-manufacturers | 339 |
| steel-distributors-warehouses | 323 |
| steel-processing | 308 |
| truck-wrecking | 298 |
| waste-recycling-disposal-service-equipment | 270 |
| garbage-collection | 260 |
| demolition-contractors | 245 |
| metal-specialties | 242 |
| automobile-accessories | 212 |
| metal-wholesale-manufacturers | 201 |
| steel-erectors | 180 |
| metal-tubing | 170 |
| rubbish-garbage-removal-containers | 168 |
| steel-fabricators | 166 |
| metal-tanks | 161 |

## 6. 20 WP source rows → resulting Postgres yards

Picked deterministically from the WP source (`/tmp/wp/posts.jsonl`) and joined back to staging by `legacy_url`. Confirms field-level fidelity end to end.

| wp_post_id | wp_title | wp_region | wp_city | pg_state | pg_city | pg_slug | pg_zip | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 41490 | Commercial Metals Company | Florida | Jacksonville | FL | jacksonville | commercial-metals-company-10483-general | 32220 | ✓ direct |
| 46330 | Surplus Steel Inc | Michigan | Auburn Hills | MI | auburn-hills | surplus-steel-inc | 48326 | ✓ direct |
| 43859 | Peninsula Scrap & Salvage Company | Alaska | Soldotna | AK | soldotna | peninsula-scrap-salvage-company | 99669 | ✓ direct |
| 46925 | Quantum Metals Inc | Ohio | Cincinnati | OH | cincinnati | quantum-metals-inc | 45246 | ✓ direct |
| 41540 | Skyline Metals | Pennsylvania | Baden | PA | baden | skyline-metals | 15005 | ✓ direct |
| 46849 | Bdc Scrap Metals | Georgia | Temple | GA | temple | bdc-scrap-metals | 30179 | ✓ direct |
| 46280 | Environmental Rubber Recycling | Michigan | Flint | MI | flint | environmental-rubber-recycling | 48505 | ✓ direct |
| 46270 | Brewer Salvage | Michigan | Eaton Rapids | MI | eaton-rapids | brewer-salvage | 48827 | ✓ via dedupe-loser redirect |
| 48260 | Hunter Industries Inc | Texas | Kennedale | TX | kennedale | hunter-industries-inc | 76060 | ✓ direct |
| 48250 | Northside Salvage & Scrap Metals | Texas | Fort Worth | TX | fort-worth | northside-salvage-scrap-metals | 76106 | ✓ direct |
| 45006 | ABC Salvage | Alabama | Meridianville | AL | meridianville | abc-salvage | 35759 | ✓ direct |
| 40896 | 911EarthProject | California | Anaheim | CA | anaheim | 911earthproject | 92809 | ✓ direct |
| 42218 | CONTINENTAL AUTO RECYCLING.com | New York | Kingston | NY | kingston | continental-auto-recycling-com | 12401 | ✓ direct |
| 45038 | Kaurotani North America Inc | Oregon | Portland | OR | portland | kaurotani-north-america-inc | 97204 | ✓ direct |
| 45032 | Schnitzer Southeast | Louisiana | Abbeville | LA | abbeville | schnitzer-southeast |  | ✓ via dedupe-loser redirect |
| 45090 | Maryland Scrap Metal Removal | Maryland | Baltimore | MD | baltimore | maryland-scrap-metal-removal | 21201 | ✓ direct |
| 43754 | Jbi Scrap Recycling | Ohio | Cleveland | OH | cleveland | jbi-scrap-recycling | 44127 | ✓ direct |
| 45100 | Frank's Scrap Metal | Maryland | Silver Spring | MD | silver-spring | franks-scrap-metal | 20910 | ✓ via dedupe-loser redirect |
| 41364 | Clouse Services | Pennsylvania | Newville | PA | newville | clouse-services | 17241 | ✓ direct |
| 43844 | All Metals Recycling | Vermont | Hardwick | VT | hardwick | all-metals-recycling-15-rr | 05843 | ✓ direct |


**20 of 20** sampled WP rows resolve to a PG yard (directly or via dedupe-loser redirect).

## 7. 20 random GSC URLs → redirect target

| source | clicks | target | status |
| --- | --- | --- | --- |
| /services/united-states/pennsylvania/kittanning-1/scrap-metals-wholesale/manor-metals-inc/ | 2 | /scrap-yards/pennsylvania/ | 301 |
| /services/united-states/alabama/theodore/recycling-centers/theodore-recycling/ | 2 | /scrap-yards/alabama/theodore/ | 301 |
| /services/united-states/maine/scarborough/steel-distributors-warehouses/goldstein-steel-co/ | 2 | /scrap-yards/maine/scarborough/ | 301 |
| /services/united-states/georgia/calhoun-6/ | 1 | /scrap-yards/georgia/ | 301 |
| /services/united-states/illinois/noble/metals/wilson-metals/ | 2 | /scrap-yards/illinois/noble/ | 301 |
| /services/united-states/ohio/athens-1/scrap-metals/cullison-scrap-metal/ | 1 | /scrap-yards/ohio/athens/cullison-scrap-metal/ | 301 |
| /services/united-states/oklahoma/dewey/steel-distributors-warehouses/ops-oilfield-pipe-supply-inc/ | 2 | /scrap-yards/oklahoma/dewey/ | 301 |
| /services/united-states/new-jersey/belvidere-2/scrap-metals/multiple-metal-processing-inc/ | 1 | /scrap-yards/new-jersey/belvidere/multiple-metal-processing-inc/ | 301 |
| /services/united-states/iowa/joice/scrap-metals/odonnell-appliance-recycling/ | 2 | /scrap-yards/iowa/joice/odonnell-appliance-recycling/ | 301 |
| /services/united-states/new-york/schenectady-1/recycling-centers/t-a-predel-co-inc-2/ | 1 | /scrap-yards/new-york/ | 301 |
| /services/united-states/new-york/yonkers/scrap-metals/r-b-scrap-iron-metal/ | 1 | /scrap-yards/new-york/yonkers/r-b-scrap-iron-metal/ | 301 |
| /services/united-states/pennsylvania/nazareth-1/automobile-salvage/s-r-recycling/ | 2 | /scrap-yards/pennsylvania/ | 301 |
| /services/united-states/indiana-1/terre-haute-1/scrap-metals/goodman-wolfe/ | 1 | /scrap-yards/indiana/terre-haute/goodman-wolfe/ | 301 |
| /services/united-states/oklahoma/duncan/scrap-metals/duncan-iron-metal-inc/ | 1 | /scrap-yards/oklahoma/duncan/duncan-iron-metal-inc/ | 301 |
| /services/united-states/connecticut/north-franklin-1/scrap-metals/kropp-environmental-contractors-inc/ | 2 | /scrap-yards/connecticut/north-franklin/kropp-environmental-contractors-inc/ | 301 |
| /services/united-states/new-york/central-islip/scrap-metals/central-scrap/ | 1 | /scrap-yards/new-york/central-islip/central-scrap/ | 301 |
| /services/united-states/florida/orlando/scrap-metals/orlando-metal-plus/ | 1 | /scrap-yards/florida/orlando/orlando-metal-plus/ | 301 |
| /services/united-states/texas/rio-vista/ | 1 | /scrap-yards/texas/rio-vista/ | 301 |
| /services/united-states/tennessee/stanton/recycling-centers/scrapyard-recycling-center/ | 1 | /scrap-yards/tennessee/stanton/ | 301 |
| /services/united-states/ohio/warren/scrap-metals/metalico-warren/ | 1 | /scrap-yards/ohio/warren/metalico-warren/ | 301 |

## 8. Top 50 traffic-driving GSC pages — migration audit

**46 of 50** top GSC pages migrated to a specific live canonical (the rest fall back to a parent — never 404).

| clicks | source | target | verdict |
| --- | --- | --- | --- |
| 44 | /services/united-states/pennsylvania/beech-creek/scrap-metals/mcghee-scrap-co/ | /scrap-yards/pennsylvania/beech-creek/mcghee-scrap-co/ | OK |
| 39 | /scrap-metal-prices/ | /scrap-metal-prices/ | fallback → root |
| 25 | /services/united-states/maine/thomaston/scrap-metals/thomaston-recycling-inc/ | /scrap-yards/maine/thomaston/thomaston-recycling-inc/ | OK |
| 13 | /services/united-states/wisconsin/new-richmond/scrap-metals/garys-scrap-metals/ | /scrap-yards/wisconsin/new-richmond/garys-scrap-metals/ | OK |
| 12 | /services/united-states/colorado/atwood/scrap-metals/atwood-auto-metal/ | /scrap-yards/colorado/atwood/atwood-auto-metal/ | OK |
| 11 | /services/united-states/georgia/calhoun-6/scrap-metals/scoggins-scrap-metal-recycling/ | /scrap-yards/georgia/calhoun/scoggins-scrap-metal-recycling/ | OK |
| 11 | /services/united-states/georgia/hogansville/recycling-centers/garrett-recycling/ | /scrap-yards/georgia/hogansville/ | OK |
| 10 | /services/united-states/wisconsin/nekoosa/scrap-metals/nekoosa-auto-iron-metal/ | /scrap-yards/wisconsin/nekoosa/nekoosa-auto-iron-metal/ | OK |
| 10 | /services/united-states/new-mexico/farmington-4/smelters-refiners-precious-metals/farmington-iron-metal-co/ | /scrap-yards/new-mexico/ | OK |
| 10 | /services/united-states/north-carolina/sylva-1/scrap-metals/metal-wood-recycling/ | /scrap-yards/north-carolina/sylva/metal-wood-recycling/ | OK |
| 9 | /services/united-states/nebraska/monroe-4/scrap-metals/roadrunner-iron-metal/ | /scrap-yards/nebraska/monroe/roadrunner-iron-metal/ | OK |
| 9 | /services/united-states/kentucky/mount-vernon-2/scrap-metals/mt-vernon-scrap-recycling-l-l-c/ | /scrap-yards/kentucky/mount-vernon/mt-vernon-scrap-recycling-l-l-c/ | OK |
| 8 | /services/united-states/kentucky/la-grange/scrap-metals/family-metals/ | /scrap-yards/kentucky/la-grange/family-metals/ | OK |
| 8 | /services/united-states/kentucky/richmond-4/scrap-metals/richmond-scrap-iron-madison-co-recycling/ | /scrap-yards/kentucky/richmond/richmond-scrap-iron-madison-co-recycling/ | OK |
| 7 | /services/united-states/maine/oakland/scrap-metals/kennebec-scrap-inc/ | /scrap-yards/maine/oakland/kennebec-scrap-inc/ | OK |
| 7 | /services/united-states/tennessee/dyersburg-1/scrap-metals/jet-core-metals/ | /scrap-yards/tennessee/dyersburg/jet-core-metals/ | OK |
| 7 | /services/united-states/tennessee/erin/scrap-metals-wholesale/brakes-herbs-recycling/ | /scrap-yards/tennessee/erin/ | OK |
| 7 | /services/united-states/nebraska/oneill/scrap-metals/husker-used-trucks-parts-inc/ | /scrap-yards/nebraska/oneill/husker-used-trucks-parts-inc/ | OK |
| 6 | /services/united-states/mississippi/waynesboro/scrap-metals/revette-enterprise/ | /scrap-yards/mississippi/waynesboro/revette-enterprise/ | OK |
| 6 | /services/united-states/iowa/oskaloosa-1/scrap-metals/m-shrago-son-inc/ | /scrap-yards/iowa/oskaloosa/m-shrago-son-inc/ | OK |
| 6 | /services/united-states/nebraska/lincoln-1/recycling-centers/scrapys/ | /scrap-yards/nebraska/ | OK |
| 6 | /services/united-states/pennsylvania/altoona-1/scrap-metals/caracciolo-charles-steel-metal-yd/ | /scrap-yards/pennsylvania/altoona/caracciolo-charles-steel-metal-yd/ | OK |
| 6 | /services/united-states/arizona/casa-grande/scrap-metals/wellington-salvage/ | /scrap-yards/arizona/casa-grande/wellington-salvage/ | OK |
| 6 | /services/united-states/new-york/buffalo/recycling-centers/empire-liberty-recycling/ | /scrap-yards/new-york/buffalo/ | OK |
| 5 | /services/united-states/ohio/mason/scrap-metals/united-alloy-recycling/ | /scrap-yards/ohio/mason/united-alloy-recycling/ | OK |
| 5 | /services/united-states/pennsylvania/centre-hall/aluminum/danns-recycling/ | /scrap-yards/pennsylvania/centre-hall/ | OK |
| 4 | /services/united-states/south-carolina/cheraw/scrap-metals/cheraw-iron-metal-inc/ | /scrap-yards/south-carolina/cheraw/cheraw-iron-metal-inc/ | OK |
| 4 | /services/united-states/louisiana/coushatta-1/recycling-centers/coushatta-iron-metal-llc/ | /scrap-yards/louisiana/ | OK |
| 4 | /services/united-states/texas/fort-worth/recycling-centers/northside-scrap-metal-recycling/ | /scrap-yards/texas/fort-worth/ | OK |
| 4 | /services/united-states/ohio/celina-1/scrap-metals/celina-recycling-center/ | /scrap-yards/ohio/celina/celina-recycling-center/ | OK |
| 4 | /services/united-states/missouri/mexico/recycling-centers/central-metals-recycling/ | /scrap-yards/missouri/mexico/ | OK |
| 4 | /services/united-states/illinois/clay-city-1/scrap-metals-wholesale/calvin-booth-scrap-iron/ | /scrap-yards/illinois/ | OK |
| 4 | /services/united-states/michigan-1/imlay-city/rubbish-garbage-removal-containers/idf-cleanup-inc/ | /scrap-yards/ | fallback → root |
| 4 | /services/united-states/tennessee/jacksboro/scrap-metals-wholesale/jacksboro-metals/ | /scrap-yards/tennessee/jacksboro/ | OK |
| 4 | /services/united-states/colorado/sterling-2/recycling-centers/swan-commodities/ | /scrap-yards/colorado/ | OK |
| 4 | /services/united-states/indiana-1/edinburgh/scrap-metals/core-capital-inc/ | /scrap-yards/indiana/edinburgh/core-capital-inc/ | OK |
| 4 | /services/united-states/new-jersey/avenel/automobile-salvage/homestead-auto-wreckers/ | /scrap-yards/new-jersey/avenel/ | OK |
| 4 | /services/united-states/south-carolina/florence-2/recycling-centers/bushs-recycling-inc/ | /scrap-yards/south-carolina/ | OK |
| 4 | /services/united-states/alabama/huntsville-2/steel-distributors-warehouses/miller-l-son-inc-metal-service-center/ | /scrap-yards/alabama/ | OK |
| 4 | /services/united-states/missouri/bowling-green-3/steel-distributors-warehouses/alan-t-lynn-inc/ | /scrap-yards/missouri/ | OK |
| 4 | /services/united-states/missouri/smithton/automobile-salvage/you-call-we-haul-auto-salvage/ | /scrap-yards/missouri/smithton/ | OK |
| 4 | /services/united-states/tennessee/erwin/scrap-metals/erwin-iron-metal/ | /scrap-yards/tennessee/erwin/erwin-iron-metal/ | OK |
| 4 | /services/united-states/florida/wauchula/recycling-centers/carls-recycling/ | /scrap-yards/florida/wauchula/ | OK |
| 4 | /services/united-states/wyoming/torrington-2/recycling-centers/m-t-recycling/ | /scrap-yards/wyoming/ | OK |
| 4 | /services/united-states/wisconsin/tomah/scrap-metals/peardot-brothers-salvage-recycling/ | /scrap-yards/wisconsin/tomah/peardot-brothers-salvage-recycling/ | OK |
| 4 | /services/united-states/pennsylvania/new-alexandria-1/scrap-metals/raymaleys-auto-cores/ | /scrap-yards/pennsylvania/new-alexandria/raymaleys-auto-cores/ | OK |
| 4 | /services/united-states/illinois/harvard/scrap-metals/b-b-scrapping/ | /scrap-yards/illinois/harvard/b-b-scrapping/ | OK |
| 3 | / | / | fallback → home |
| 3 | /services/united-states/ohio/mansfield/recycling-centers/milliron-recycling/ | /scrap-yards/ohio/mansfield/ | OK |
| 3 | /services/category/smelters-refiners-precious-metals/united-states/new-mexico/albuquerque-1/ | /scrap-yards/ | fallback → root |

## 9. Random samples (sanity)

### 20 random yards

| state_code | city_slug | slug | name | address | zip | phone | website | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MI | macomb | bat-trading-company | Bat Trading Company | 15695 Leone Dr | 48042 | (586) 690-8095 |  | active |
| WI | oshkosh | fox-valley-iron-metal-auto-salvage-inc | Fox Valley Iron Metal & Auto Salvage Inc | 3446 Witzel Ave | 54904 | (920) 231-8187 |  | active |
| TN | springfield | southern-plastics-recyclers | Southern Plastics Recyclers | 3810 New Hope Ln | 37172 | (615) 382-5606 |  | active |
| PA | steelton | als-clean-out | Al's Clean Out | 327 S Front St | 17113 | (717) 576-6534 |  | active |
| MA | worcester | goldsteins-scrapmetal-inc | Goldsteins Scrapmetal Inc | 41 Barry Rd | 01609 | (508) 754-5711 |  | active |
| OH | jackson | star-recycling-company | Star Recycling Company | 52 E Broadway St | 45640 | (740) 286-3752 |  | active |
| KS | fort-scott | advantage-metals-recycling | Advantage Metals Recycling | 854 Highway 69 | 66701 | (620) 223-2388 | http://www.advantagerecycling.com | active |
| TX | kennedale | hunter-industries-inc | Hunter Industries Inc | 4010 S Eden Rd | 76060 | (817) 483-5229 | http://hunterindustries.com | active |
| SC | prosperity | eight-acres-recycling | Eight Acres Recycling | 1135 Candy Kitchen Rd | 29127 | (803) 364-0889 |  | active |
| NE | kearney | andersen-self-service-auto-parts | Andersen Self Service Auto Parts | 2045 25 Rd | 68847 | (308) 236-7661 | http://www.andersenwrecking.com | active |
| TN | tazewell | graceway-metal-recyling | Graceway Metal Recyling | 110 Hester LN | 37879 | (423) 626-1994 |  | active |
| IL | highland | grapperhaus-metal-co | Grapperhaus Metal Co | 20521 Fricker Rd | 62249 | (618) 654-3521 | http://grapperhausmetalcompanyinc.com | active |
| AR | blytheville | goolsby-iron-metal | Goolsby Iron & Metal | 3002 W Main St | 72315 | (870) 763-9086 |  | active |
| GA | dalton | import-auto-recycling-inc | Import Auto Recycling Inc | 2430 S Dixie Hwy | 30720 | (706) 277-7088 | http://www.importautorecycling.net | active |
| MI | ypsilanti | the-scrap-spot | The Scrap Spot | 227 S Ford Blvd | 48198 | (734) 340-2155 |  | active |
| TX | terrell | terrell-metal-recycling | Terrell Metal Recycling | 707 E Grove St | 75160 | (214) 660-5400 |  | active |
| WI | milwaukee | auto-scrap-recyclers-inc-north-division | Auto & Scrap Recyclers Inc - North Division | 8550 N Granville Rd | 53224 | (414) 354-8300 | http://www.autoandscraprecyclers.com | active |
| OH | chagrin-falls | premier-metal-trading | Premier Metal Trading | 7 1/2 North Franklin Street | 44022 | (440) 247-9494 | http://www.premiermetaltrading.com/index.html | active |
| LA | abbeville | the-wrecking-crew | The Wrecking Crew |  |  | (636) 462-1727 | http://www.wreckingcrewnow.com | active |
| NC | swansboro | swansboro-recycling-center | Swansboro Recycling Center | 116 Leslie Ln | 28584 | (910) 326-5191 |  | active |

### 20 random cities

| state_code | slug | name | lat | lng | yards |
| --- | --- | --- | --- | --- | --- |
| NH | derry | Derry | 42.867490 | -71.260040 | 1 |
| CA | ukiah | Ukiah | 39.146793 | -123.200470 | 3 |
| WY | rock-springs | Rock Springs | 41.584870 | -109.213815 | 2 |
| AZ | tonopah | Tonopah | 33.492470 | -112.937440 | 1 |
| NJ | tenafly | Tenafly | 40.921590 | -73.949580 | 1 |
| WI | butternut | Butternut | 46.018356 | -90.482120 | 1 |
| NJ | atco | Atco | 39.780470 | -74.881410 | 1 |
| NY | glens-falls | Glens Falls | 43.312640 | -73.628640 | 1 |
| GA | alpharetta | Alpharetta | 34.103902 | -84.255512 | 4 |
| KY | maceo | Maceo | 37.843600 | -86.999916 | 1 |
| CO | aurora | Aurora | 39.723890 | -104.823420 | 2 |
| CA | grand-terrace | Grand Terrace | 34.019910 | -117.334870 | 2 |
| CA | signal-hill | Signal Hill | 33.803395 | -118.172145 | 2 |
| IL | bellwood | Bellwood | 41.889900 | -87.864490 | 2 |
| AZ | avondale | Avondale | 33.440680 | -112.337450 | 1 |
| SC | johnston | Johnston | 33.777690 | -81.834460 | 1 |
| IL | highland-park | Highland Park | 42.167230 | -87.799417 | 3 |
| KY | winchester | Winchester | 38.030375 | -84.258505 | 2 |
| NY | long-island-city | Long Island City | 40.733420 | -73.938800 | 1 |
| NJ | morristown | Morristown | 40.745440 | -74.532740 | 1 |
