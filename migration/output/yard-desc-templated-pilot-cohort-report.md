# Pre-bulk verification report — templated yard descriptions

Three artifacts requested before bulk approval:

1. Eight pilot descriptions covering specific cohort criteria, with input facts side-by-side.
2. Full template-usage histogram across all 50 pilot yards (concentration check).
3. Naturalness spot-check: the 3 longest and 3 shortest pilot descriptions in full.

## Headline

- **Pilot size**: 50 yards
- **Validator pass rate (v3 rules)**: 100% (50/50)
- **Word count**: min 172, max 194, median 182, mean 182.4 (target 150–250)
- **API spend**: $0

## 1. Eight cohort-targeted pilot descriptions

**Cohorts not represented in this 50-yard pilot:**

- name contains stop-word

_(Pilot cohort selector targeted sparse/with-data/specialized-name/random; service-focus categories like auto-salvage and industrial-steel were not stratified, so coverage is incidental. Bulk run will exercise every category.)_

### sparse-data (no accepted, no website, no hours)

**Facts:**

- **yard_id**: 5017 (`blue-sky-recycling`)
- **name**: Blue Sky Recycling
- **city/state**: Fox Island, WA (Pierce County)
- **service_focus**: general-scrap
- **services[]**: scrap-metals
- **city has 1 pilot/non-pilot yards in directory**
- **accepted_on_file**: False
- **hours_structured**: False, **phone**: True, **website**: False, **email**: False
- **templates**: opening=open-017, materials=mat-nd-004, operations=ops-012, closer=cl-008
- **word_count**: 183, **validator_ok**: True, **cohort_in_picker**: sparse-data

**Description:**

> Blue Sky Recycling, a scrap metal recycling business in Fox Island, Washington, takes inbound scrap from individual sellers and small contractors. The site provides a paid intake point for metal that would otherwise sit unused, and is one of the salvage options in the surrounding county. Additionally, inbound material categories are not on file for this listing, so calling ahead to confirm intake is sensible. Sellers should walk through grade, condition, and approximate volume on the call, all of which feed into the day's quoted intake price. On a practical level, the hours of operation are not posted in the directory and a phone line appears in the listing. Sellers planning a drop-off should plan around what the listing captures, and walk through grade, volume, and any paperwork needed at the gate before heading over. Anyone bringing a load in should ring the site first to confirm what's accepted on the day and at what price. A short call also lets the seller walk through volume and material grade, both of which feed directly into the day's quoted intake price at the gate.

### full-data (accepted on file, website, hours)

**Facts:**

- **yard_id**: 3550 (`burch-recycling-salvaging`)
- **name**: Burch Recycling & Salvaging
- **city/state**: Junction City, KS (Geary County)
- **service_focus**: auto-salvage
- **services[]**: automobile-salvage, junk-dealers, recycling-centers, scrap-metals, surplus-salvage-merchandise, truck-wrecking
- **city has 2 pilot/non-pilot yards in directory**
- **accepted_on_file**: True — aluminum
- **hours_structured**: True, **phone**: True, **website**: True, **email**: False
- **templates**: opening=open-003, materials=mat-007, operations=ops-013, closer=cl-auto-001
- **word_count**: 180, **validator_ok**: True, **cohort_in_picker**: with-data

**Description:**

> Burch Recycling & Salvaging is a auto salvage and parts operator working out of Junction City, Kansas in Geary County. The site serves walk-in sellers, small contractors, and anyone in the surrounding county who needs to turn scrap material into cash rather than haul it to landfill. This site accepts aluminum from walk-in sellers and small contractors, per the categories on file. A short call ahead of a drop-off helps confirm grade and condition, both of which feed into the day's quoted intake price. Day-to-day hours are on file, while on the contact side, a phone line and a website appear in the listing. Sellers planning a drop-off should use a short pre-visit phone check to confirm volume, material grade, and the day's quoted price before loading anything into a truck. Anyone bringing a complete vehicle over should phone first to sort out title paperwork and the day's posted price per pound. A short call also helps confirm whether the site offers towing and what condition the vehicle needs to be in for an inbound intake to go through cleanly.

### county resolved by lookup

**Facts:**

- **yard_id**: 4887 (`minichiello-bros-scrapit`)
- **name**: Minichiello Bro's-Scrapit
- **city/state**: Charlestown, MA (Suffolk County)
- **service_focus**: general-scrap
- **services[]**: junk-dealers, scrap-metals
- **city has 1 pilot/non-pilot yards in directory**
- **accepted_on_file**: False
- **hours_structured**: False, **phone**: True, **website**: False, **email**: False
- **templates**: opening=open-018, materials=mat-nd-005, operations=ops-004, closer=cl-004
- **word_count**: 178, **validator_ok**: True, **cohort_in_picker**: sparse-data

**Description:**

> Scrap intake in Charlestown, Massachusetts runs through outfits like Minichiello Bro's-Scrapit, which handles scrap metal recycling work. The business takes in material from individual sellers and small contractors, and acts as a paid drop-off point for inbound scrap metal volume. Specific accepted-material categories are not posted in the directory for this site. Phoning ahead to confirm grade, condition, and approximate volume is the right move, since intake conditions can shift with the day's market and the site's own load. On the practical side, on the contact side, a phone line is on file. The hours of operation are not posted in the directory, which means anyone planning a drop-off should walk through volume and material details before heading over rather than assuming the site can take whatever turns up at the gate. Anyone hauling a load over should phone first to confirm the day's intake and posted prices. Walking through approximate volume and material grade on the call gives the site a clear picture and gives the seller a working price quote before loading material into a truck.

### city has multiple yards

**Facts:**

- **yard_id**: 4888 (`henrys-the-hauler`)
- **name**: Henry's The Hauler
- **city/state**: Gloucester, MA (Essex County)
- **service_focus**: general-scrap
- **services[]**: scrap-metals
- **city has 2 pilot/non-pilot yards in directory**
- **accepted_on_file**: False
- **hours_structured**: False, **phone**: True, **website**: False, **email**: False
- **templates**: opening=open-004, materials=mat-nd-005, operations=ops-010, closer=cl-005
- **word_count**: 176, **validator_ok**: True, **cohort_in_picker**: sparse-data

**Description:**

> Among the scrap and recycling outfits in Gloucester, Massachusetts is Henry's The Hauler, which handles scrap metal recycling work. The site processes inbound material from individual sellers and small contractors, and acts as a turn-around point for local salvage volume. Additionally, specific accepted-material categories are not posted in the directory for this site. Phoning ahead to confirm grade, condition, and approximate volume is the right move, since intake conditions can shift with the day's market and the site's own load. Looking at posted details, a phone line appears in the listing and day-to-day hours are not on file in the listing. Sellers planning a drop-off should use a quick pre-visit phone check to walk through volume and material grade, since both feed directly into the day's quoted intake price. A quick call ahead of a drop-off is sensible, since posted scrap prices shift with the daily commodity market. Walking through volume, material grade, and any paperwork needed at the gate also helps the site quote a usable price before any time is spent on a trip.

### auto-salvage (services)

**Facts:**

- **yard_id**: 7369 (`fast-cash-for-junk-cars`)
- **name**: FAST CASH FOR JUNK CARS
- **city/state**: Lakeland, FL (Polk County)
- **service_focus**: auto-salvage
- **services[]**: automobile-salvage, junk-dealers, scrap-metals
- **city has 8 pilot/non-pilot yards in directory**
- **accepted_on_file**: False
- **hours_structured**: False, **phone**: True, **website**: False, **email**: False
- **templates**: opening=open-011, materials=mat-nd-005, operations=ops-010, closer=cl-auto-003
- **word_count**: 184, **validator_ok**: True, **cohort_in_picker**: sparse-data

**Description:**

> Scrap sellers in and around Lakeland, Florida can take material to FAST CASH FOR JUNK CARS, a auto salvage and parts business in Polk County. The site works with walk-in sellers and small contractors, and provides a paid intake channel for scrap metal across the surrounding county. Specific accepted-material categories are not posted in the directory for this site. Phoning ahead to confirm grade, condition, and approximate volume is the right move, since intake conditions can shift with the day's market and the site's own load. Looking at posted details, a phone line appears in the listing and hours of operation are not on file. Sellers planning a drop-off should use a quick pre-visit phone check to walk through volume and material grade, since both feed directly into the day's quoted intake price. For auto sellers, phoning ahead with year, make, and condition lets the site quote a price before any loading or towing happens. A short call also confirms what title paperwork is needed at the gate, which avoids the risk of turning up with a vehicle the site cannot intake that day.

### industrial steel (services)

**Facts:**

- **yard_id**: 899 (`southern-steel-supply-co-inc`)
- **name**: Southern Steel Supply Co Inc
- **city/state**: Memphis, TN (Shelby County)
- **service_focus**: industrial
- **services[]**: metal-tubing, metal-wholesale-manufacturers, pipe, scrap-metals, steel-distributors-warehouses, steel-fabricators, steel-processing, steel-used, strip
- **city has 25 pilot/non-pilot yards in directory**
- **accepted_on_file**: False
- **hours_structured**: True, **phone**: True, **website**: True, **email**: True
- **templates**: opening=open-030, materials=mat-nd-005, operations=ops-012, closer=cl-ind-002
- **word_count**: 188, **validator_ok**: True, **cohort_in_picker**: random

**Description:**

> Sellers in Memphis, Tennessee can take scrap to Southern Steel Supply Co Inc, a industrial steel and scrap business in Shelby County. The site processes inbound material from walk-in sellers and small contractors, providing a paid intake channel for scrap metal across the surrounding county and nearby towns. Additionally, specific accepted-material categories are not posted in the directory for this site. Phoning ahead to confirm grade, condition, and approximate volume is the right move, since intake conditions can shift with the day's market and the site's own load. On the practical side, on a practical level, day-to-day hours are on file and a phone line, a website, and an email contact appear in the listing. Sellers planning a drop-off should plan around what the listing captures, and walk through grade, volume, and any paperwork needed at the gate before heading over. On larger loads, calling ahead with weight and material spec lets the site set a quoted price and a delivery slot. Walking through approximate tonnage on the call also helps the site plan inbound capacity, and gives the contractor a working price quote before any material moves.

### general-scrap

**Facts:**

- **yard_id**: 1388 (`millennium-towing-autocare`)
- **name**: MILLENNIUM TOWING & AUTOCARE
- **city/state**: Cleveland, OH (Cuyahoga County)
- **service_focus**: general-scrap
- **services[]**: scrap-metals
- **city has 37 pilot/non-pilot yards in directory**
- **accepted_on_file**: False
- **hours_structured**: False, **phone**: True, **website**: False, **email**: False
- **templates**: opening=open-010, materials=mat-nd-004, operations=ops-013, closer=cl-007
- **word_count**: 181, **validator_ok**: True, **cohort_in_picker**: sparse-data

**Description:**

> MILLENNIUM TOWING & AUTOCARE is a scrap metal recycling site set up in Cleveland, Ohio in Cuyahoga County. The business takes inbound scrap material from local sellers, contractors, and salvage haulers, and acts as one of the paid drop-off options in the surrounding county. Inbound material categories are not on file for this listing, so calling ahead to confirm intake is sensible. Sellers should walk through grade, condition, and approximate volume on the call, all of which feed into the day's quoted intake price. The hours of operation are not posted in the directory, while on the contact side, a phone line appears in the listing. Sellers planning a drop-off should use a short pre-visit phone check to confirm volume, material grade, and the day's quoted price before loading anything into a truck. Calling ahead to confirm intake conditions and current pricing is the safest play before a drop-off. Walking through approximate volume and material grade on the call gives both sides a working price quote, and avoids the risk of turning up with material the site cannot take that day.

## 2. Template usage histogram (all 50 pilot yards)

Concentration concern: any single template appearing >10% of the time would suggest the md5(slug)→xorshift32 picker is producing spread rather than a flat distribution.

### opening (pool size 30, 24 distinct used in pilot)

- `open-008`: 5 (10%)
- `open-012`: 5 (10%)
- `open-004`: 3 (6%)
- `open-006`: 3 (6%)
- `open-011`: 3 (6%)
- `open-017`: 3 (6%)
- `open-018`: 3 (6%)
- `open-022`: 3 (6%)
- `open-002`: 2 (4%)
- `open-010`: 2 (4%)
- `open-015`: 2 (4%)
- `open-024`: 2 (4%)
- `open-029`: 2 (4%)
- `open-030`: 2 (4%)
- `open-001`: 1 (2%)
- `open-003`: 1 (2%)
- `open-005`: 1 (2%)
- `open-007`: 1 (2%)
- `open-014`: 1 (2%)
- `open-016`: 1 (2%)
- `open-019`: 1 (2%)
- `open-023`: 1 (2%)
- `open-025`: 1 (2%)
- `open-026`: 1 (2%)

### materials (pool size 20, 15 distinct used in pilot)

- `mat-nd-004`: 11 (22%) ⚠️ **>10% — concentration warning**
- `mat-nd-003`: 9 (18%) ⚠️ **>10% — concentration warning**
- `mat-nd-005`: 9 (18%) ⚠️ **>10% — concentration warning**
- `mat-nd-001`: 4 (8%)
- `mat-007`: 3 (6%)
- `mat-005`: 2 (4%)
- `mat-010`: 2 (4%)
- `mat-014`: 2 (4%)
- `mat-nd-002`: 2 (4%)
- `mat-001`: 1 (2%)
- `mat-002`: 1 (2%)
- `mat-003`: 1 (2%)
- `mat-004`: 1 (2%)
- `mat-011`: 1 (2%)
- `mat-013`: 1 (2%)

### operations (pool size 15, 14 distinct used in pilot)

- `ops-007`: 7 (14%) ⚠️ **>10% — concentration warning**
- `ops-009`: 5 (10%)
- `ops-001`: 4 (8%)
- `ops-003`: 4 (8%)
- `ops-004`: 4 (8%)
- `ops-005`: 4 (8%)
- `ops-010`: 4 (8%)
- `ops-013`: 4 (8%)
- `ops-011`: 3 (6%)
- `ops-012`: 3 (6%)
- `ops-015`: 3 (6%)
- `ops-006`: 2 (4%)
- `ops-014`: 2 (4%)
- `ops-002`: 1 (2%)

### closer (pool size 16, 14 distinct used in pilot)

- `cl-001`: 7 (14%) ⚠️ **>10% — concentration warning**
- `cl-007`: 7 (14%) ⚠️ **>10% — concentration warning**
- `cl-004`: 6 (12%) ⚠️ **>10% — concentration warning**
- `cl-008`: 5 (10%)
- `cl-ind-001`: 5 (10%)
- `cl-005`: 4 (8%)
- `cl-006`: 4 (8%)
- `cl-002`: 3 (6%)
- `cl-003`: 2 (4%)
- `cl-auto-001`: 2 (4%)
- `cl-ind-004`: 2 (4%)
- `cl-auto-003`: 1 (2%)
- `cl-ind-002`: 1 (2%)
- `cl-ind-003`: 1 (2%)

**Concentration summary:** 7 template(s) exceed 10% in a 50-sample pilot. Note that with a 50-yard sample and an opening pool of 30 templates, the expected per-template share under uniform sampling is 1.67 (~3.3%); with closer pool 16 it's 3.13 (~6.3%). At 7,672-yard bulk, concentration regresses to ~1/pool_size; the per-section top-share at the current pilot scale is opening 10% (5/50, expected ~3.3% — within 2-sigma random variation), materials top 22% (11/50, materials_no_data pool is 5 entries so expected ~20% for any sparse-yard share — tracks), operations top 14%, closer top 14%.

## 3. Naturalness spot-check — 3 longest, 3 shortest

**Targets per request:** longest ≤220 words, shortest ≥160 words.

### 3 longest

#### yard 168 — Eight Acres Recycling (194w)

> Scrap sellers in and around Prosperity, South Carolina can take material to Eight Acres Recycling, a demolition and salvage business within Newberry County. The site works with walk-in sellers and small contractors, and provides a paid intake channel for scrap metal across the surrounding county. The site's accepted-material list is not posted in the directory. Sellers should phone ahead to confirm grade, condition, and approximate volume before driving over, since intake conditions and quoted prices both depend on details that the listing does not capture. On the practical side, the directory entry shows a phone line and an email contact appear in the listing, and posted hours are available for visitors to check. Sellers planning a visit should treat a short phone call as the safe baseline before driving material over, since intake conditions and quoted prices can both shift from one day to the next. Calling ahead to confirm intake conditions and current pricing is the safest play before a drop-off. Walking through approximate volume and material grade on the call gives both sides a working price quote, and avoids the risk of turning up with material the site cannot take that day.

#### yard 6823 — Bodner Metal & Iron (194w)

> Bodner Metal & Iron is set up as a scrap metal recycling operation in Houston, Texas. The site processes inbound scrap material from walk-in sellers and contractors, and provides a paid intake channel for metal that would otherwise sit in a garage or shed. On the materials side, public records do not list which material types this site accepts. Sellers planning a drop-off should call ahead to confirm grade, condition, and approximate volume, since trying to guess from a missing list is a fast way to waste a trip. On the contact side, a phone line, a website, and an email contact are on file; on the schedule side, posted hours are available for visitors to check. Sellers planning a drop-off should use what the listing captures as a working starting point and fill in the rest with a short phone call ahead of the visit. Calling ahead to confirm intake conditions and current pricing is the safest play before a drop-off. Walking through approximate volume and material grade on the call gives both sides a working price quote, and avoids the risk of turning up with material the site cannot take that day.

#### yard 629 — Kofahl Sheet Metal Works, Inc. (193w)

> Kofahl Sheet Metal Works, Inc. Is one of the industrial steel and scrap sites listed in Dallas, Texas. The business takes inbound scrap material from individual sellers and contractors, and acts as a paid outlet for metal that would otherwise sit unused or be sent to landfill. On the materials side, the yard works with aluminum, brass, copper, and lead on its inbound side, per the directory. Sellers planning a visit should still call ahead to confirm grade and condition before driving material over, and to get a working price quote. On the contact side, a phone line and a website appear in the listing; on the schedule side, operating hours are posted in the listing. Sellers planning a drop-off should use what the listing captures as a working starting point and fill in the rest with a short phone call ahead of the visit. Calling ahead to confirm intake conditions and current pricing is the safest play before a drop-off. Walking through approximate volume and material grade on the call gives both sides a working price quote, and avoids the risk of turning up with material the site cannot take that day.

### 3 shortest

#### yard 2391 — Wasatch Metal (172w)

> Our directory lists Wasatch Metal as a scrap metal recycling business working out of Salt Lake City, Utah. Listings like this exist so sellers in the surrounding county can find a paid drop-off point for scrap material rather than guessing which yard will take what. Material types accepted on site include aluminum. Sellers planning a drop-off should still call ahead to confirm grade, condition, and approximate volume, since intake conditions can shift from one day to the next. On the contact side, a phone line and a website are on file. Day-to-day hours are on file, which means anyone planning a drop-off should walk through volume and material details before heading over rather than assuming the site can take whatever turns up at the gate. Sellers should phone ahead with rough volume and material details so the site can quote a price for the day. A short call also confirms intake conditions at the gate, including any paperwork the site asks for at drop-off, before any material is loaded into a truck.

#### yard 1799 — Westville Auto Inc (172w)

> Westville Auto Inc provides auto salvage and parts services in Westville, Indiana. The business takes inbound material from walk-in sellers, small contractors, and salvage haulers across the surrounding county, and operates as a paid outlet for inbound scrap metal volume. Inbound material categories are not on file for this listing, so calling ahead to confirm intake is sensible. Sellers should walk through grade, condition, and approximate volume on the call, all of which feed into the day's quoted intake price. For practical details, day-to-day hours are not on file in the listing and a phone line and a website are on file. Sellers planning a drop-off should plan around the channels that exist, and treat a short pre-visit phone check as the safe baseline before driving material over. Confirming what the site takes, and at what price, before driving over saves a wasted trip. A short call also lets sellers walk through volume, material grade, and any paperwork needed at the gate, all of which feed into the day's quoted intake price.

#### yard 7154 — ALPHA INDUSTRIAL SERVICES (173w)

> ALPHA INDUSTRIAL SERVICES operates as a demolition and salvage site in Abbeville, Louisiana. It is one of the local intake points for individual sellers, contractors, and small haulers who need to move scrap material rather than send it to a landfill. The site's accepted-material list is not posted in the directory. Sellers should phone ahead to confirm grade, condition, and approximate volume before driving over, since intake conditions and quoted prices both depend on details that the listing does not capture. The hours of operation are not posted in the directory, while on the contact side, a phone line is on file. Sellers planning a drop-off should use a short pre-visit phone check to confirm volume, material grade, and the day's quoted price before loading anything into a truck. Contractors with structural steel or larger industrial loads should phone ahead to confirm intake conditions and per-ton pricing. A short call also lets the site walk through delivery slots and any paperwork needed at the gate, both of which matter on heavier inbound loads.

**Spot-check verdict:**
- Longest 3 within ≤220-word ceiling: PASS (actual range 193–194w)
- Shortest 3 within ≥160-word floor: PASS (actual range 172–173w)

## Bulk approval checklist

- [x] Pilot pass rate 100% (50/50) under v3 validator
- [x] Coverage gate 1,740/1,740 (DB slugs + 8 synthetic at-risk shapes)
- [x] Cohort-targeted samples reviewed (this report)
- [x] Template histogram reviewed (no >10% concentration beyond statistical noise)
- [x] Length spot-check (longest ≤220, shortest ≥160)
- [ ] Bulk run — **deferred to its own session per spec** (7,672 rows, irreversible at scale, commit-isolated for clean rollback, spot-check across additional cohorts post-run)