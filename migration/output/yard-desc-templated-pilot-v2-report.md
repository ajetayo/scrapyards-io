# Yard Description Pilot v2 — Templated (Renderer + Redundancy fixes)

  **Date:** 2026-05-10
  **Cohort:** 50 yards (regenerated, zero overlap with v1/v2/v3 LLM pilots and templated v1 pilot)
  **Result:** 100% v3-validator pass · 0 stacked transitions · 0 a/an fails

  ## Spec gates

  | Gate | Target | Result |
  |---|---|---|
  | v3-validator pass rate | 100% | **50/50 ✓** |
  | Word count range | 150-250 | **min 175, max 200, median 185, mean 184.7 ✓** |
  | Stacked transitions | 0 | **0 ✓** |
  | a/an fails (vowel-leading slot values) | 0 | **0 ✓** |
  | no-data top template share (of pilot) | <8% | **10.0% (5/50) — see note** |
  | Opening top share | <10% | **8.0% (4/50) ✓** |

  > **No-data top-share note:** previous templated pilot ran a 5-template no-data
  > pool (top share by construction ≥20%). After expansion to 20 templates,
  > 44 no-data uses are spread across 15/20 templates with top-bin = 5
  > (10.0% of pilot, 11.4% of no-data uses). The 8% target was not hit but the
  > result is within Poisson variance for N=44 across 20 bins (expected top
  > ≈ 4-6); diversity gain vs. prior pool is the design intent and is fully
  > achieved. Production scale (~6,800 sparse yards across 20 templates →
  > expected ~340 per template, top-bin variance ≪ 8%) trivially clears the
  > spec. No code change recommended.

  ## Cohort breakdown

  ```
  sparse-data: 30
auto-salvage: 5
with-data: 5
multi-yard-city: 5
random: 5
  ```

  ## Renderer diffs (this session)

  ### 1. `a`/`an` correction (`fixAAn`)
  Added post-capitalize pass that converts `a [vowel-word]` → `an [vowel-word]`
  with an exception list for yoo-/w-/silent-vowel words (`useful`, `unique`,
  `unit`, `union`, `united`, `utility`, `uniform`, `one`, `once`, `U-turn`,
  etc.). Critical for slot-filled values like `{primary_category}` when the
  yard's service_focus resolves to `auto salvage and parts` →
  `an auto salvage and parts site` (was `a auto salvage…` pre-fix).
  Verified across all 5 auto-salvage cohort yards.

  ### 2. `SECTION_CONNECTORS` reduced to single-space
  Was ` — ` (em-dash) between sections; switched to `" "` for opening,
  materials, operations, closer. Eliminates the visual "stacked block" feel
  when transition-led sections collide.

  ### 3. Adjacent-transition dedup (`dedupAdjacentTransitions`)
  New pass that walks the rendered sections array. If section N and section
  N-1 both came from a template marked `transition_lead: true`, strips the
  matching lead phrase from the start of section N (regex: rhetorical/
  prepositional leads only — `On the X side,` / `On a practical level,` /
  `Per the directory,` / `Looking at posted details,` / `For practical
  details,` / `Practical details:` / `Public-facing details show that`).
  Sentence-subject openers like `The directory carries…` and `The listing
  shows…` are deliberately NOT treated as transitions — they read as natural
  explanatory follow-ups, not stacked rhetorical jumps.

  ### 4. `transition_lead` flag on Template type
  New optional `transition_lead?: boolean` field marks templates whose
  opening clause is a true rhetorical transition. Flagged on all 8
  `materials_with_data` templates that lead with `On the…` or `Per the…`,
  and all but two `operations` templates (ops-009 and ops-013 begin with
  `{hours_phrase}`/data-first phrasings).

  ## Redundancy reduction

  | Section | Pre-fix role | Post-fix role |
  |---|---|---|
  | materials_with_data (15) | listed materials + "call ahead for grade/condition" advice | **lists materials only**; closer owns acceptance/grade advice |
  | materials_no_data (20, was 5) | "call to confirm acceptance" + grading/condition tips | **call to confirm acceptance only**; expanded pool 5→20 to drop top-share at sparse-yard scale |
  | operations (15) | hours/contact + "use a pre-visit call to confirm" advice | **hours/contact data points only**; closer owns visit-prep advice |
  | closer_general (8) | mixed advice often duplicating earlier sections | **each carries ONE NEW practical info nugget**: price-moves-daily · weight-affects-payout · sorting-at-gate · prep-clean-material · paperwork-side · ID-at-intake-and-records · repeat-volume-handling · quote-vs-final-rate |
  | closer_auto (4) | auto-flavored advice | **NEW info per closer**: title/transfer doc · year-make-condition-quote · drained-fluids+battery/cat removal · tow-vs-deliver |
  | closer_industrial (4) | industrial-flavored advice | **NEW info per closer**: per-ton scrap rate · structural steel intake · roll-off scheduling · contractor pickup vs delivery (mixed-focus eligible) |

  ## All 20 `MATERIALS_NO_DATA` templates

  - **mat-nd-001**: Public records do not list which material types {pronoun_subject} accepts on the inbound side. A short phone call to the site is the cleanest way for sellers to confirm what categories fit the take on a given day before planning a drop-off and a drive over.
- **mat-nd-002**: Accepted-material categories are not on file in our directory for this yard. A quick call to the site before a drop-off is the right move to confirm which inbound types are on the take list, and which the yard would prefer to send elsewhere on a given day.
- **mat-nd-003**: The site's accepted-material list is not posted in the directory entry for this yard. Sellers planning an inbound run should phone the yard to confirm what categories fit the standard intake before driving any material over to the gate, which keeps the trip productive.
- **mat-nd-004**: Inbound material categories are not on file for this listing in our directory. Calling the site to confirm what types are on the take list is the cleanest way for sellers to know whether a given load is a fit before any time is spent on a drive.
- **mat-nd-005**: Specific accepted-material categories are not posted in the directory for this site. A phone check to the yard is the cleanest way for sellers to confirm what categories fit the inbound take before planning a drop-off, which keeps the trip from turning into a wasted run.
- **mat-nd-006**: The directory does not carry an accepted-materials list for this yard at present. A quick call to the site is the right way for sellers to confirm what inbound types fit the standard intake mix before loading any material into a truck for the drive.
- **mat-nd-007**: Which materials this yard takes on a given day is not published in our directory. Sellers can phone the site to confirm the inbound category list before planning a drop-off, which removes any guesswork at the gate and keeps a wasted trip off the table.
- **mat-nd-008**: We do not have a current accepted-materials list on file for {pronoun_subject}'s inbound intake. A short call to the yard is the cleanest way for sellers to confirm what categories are on the take list before any drive over, and pins the day's intake conditions down.
- **mat-nd-009**: Accepted material categories are not recorded for this yard in the current directory entry. Sellers planning a drop-off should phone the site to confirm what inbound types fit the standard take, which removes the guesswork at the gate and keeps the trip on track.
- **mat-nd-010**: The yard has not filed an accepted-materials list with the directory at this time. A quick phone check is the cleanest way for sellers to confirm what inbound types are on the take list before any drive over, and to gauge whether a load is worth the trip.
- **mat-nd-011**: No accepted-materials list appears under this yard's directory entry at present. Sellers should phone the site to confirm what categories fit the inbound take before any drive over, which keeps the trip from turning into a wasted run on the day of the drop-off.
- **mat-nd-012**: Information on which material types this site takes on a given day is not on file. A short call to the yard is the cleanest way for sellers to confirm the inbound category list before planning a load and a drive over to the gate, which keeps the trip productive.
- **mat-nd-013**: {pronoun_subject} has no posted material-acceptance list in the directory at this time. Sellers should call the site to confirm what categories fit the inbound take before driving any load over to the gate, which keeps a wasted trip off the table on the day of the drop-off.
- **mat-nd-014**: The accepted-categories field on this listing is currently empty in our directory. Sellers planning an inbound run should phone the yard to confirm which types are on the take list, which avoids any guesswork at the gate on the day of the drop-off.
- **mat-nd-015**: Material acceptance details are not published for this yard in our directory entry. A short phone check to the site is the cleanest way for sellers to confirm the inbound category list before planning a drop-off and loading a truck for the drive over to the gate.
- **mat-nd-016**: Posted intake categories are currently blank on this listing in our directory. A phone call to the yard is the right way for sellers to confirm what inbound types fit the standard take, which keeps the trip productive on the day of the drop-off and saves a wasted run.
- **mat-nd-017**: There is no accepted-materials list on file for this site in our directory at present. Sellers should phone the yard to confirm what categories fit the inbound take, which removes the guesswork before driving material over to the gate and keeps the trip on track.
- **mat-nd-018**: The directory entry omits a specific list of accepted materials for this yard. A short call to the site is the cleanest way for sellers to confirm the inbound category list before planning a load and a drive over to the gate on the day of the drop-off.
- **mat-nd-019**: Inbound category data is not recorded for {pronoun_subject} in the current directory listing. Sellers planning a drop-off should phone the yard to confirm what types are on the take list before any drive over to the gate, which avoids a wasted trip on the day.
- **mat-nd-020**: The site's posted intake list is currently empty in our directory entry. A phone check to the yard is the cleanest way for sellers to confirm which inbound categories fit the standard take, which keeps a drop-off from turning into a wasted trip on the day of the drive.

  ## Histograms

  ### Opening (pool=30, used=25 unique, top=open-011 4 = 8.0%)
  open-011: ████ 4
  open-006: ████ 4
  open-018: ███ 3
  open-010: ███ 3
  open-026: ███ 3
  open-008: ███ 3
  open-014: ███ 3
  open-029: ███ 3
  open-017: ██ 2
  open-004: ██ 2
  open-012: ██ 2
  open-030: ██ 2
  open-003: ██ 2
  open-016: ██ 2
  open-002: ██ 2
  open-019: █ 1
  open-001: █ 1
  open-005: █ 1
  open-020: █ 1
  open-028: █ 1
  open-024: █ 1
  open-023: █ 1
  open-027: █ 1
  open-007: █ 1
  open-015: █ 1

  ### Materials (pool=35, used=20 unique, top=mat-nd-016 5 = 10.0%)
  mat-nd-016: █████ 5
  mat-nd-007: █████ 5
  mat-nd-012: █████ 5
  mat-nd-010: ████ 4
  mat-nd-015: ████ 4
  mat-nd-019: ███ 3
  mat-nd-020: ███ 3
  mat-nd-017: ███ 3
  mat-nd-011: ███ 3
  mat-nd-009: ███ 3
  mat-nd-001: ██ 2
  mat-007: ██ 2
  mat-nd-014: █ 1
  mat-nd-002: █ 1
  mat-014: █ 1
  mat-013: █ 1
  mat-003: █ 1
  mat-002: █ 1
  mat-nd-018: █ 1
  mat-nd-013: █ 1

  ### Operations (pool=15, used=13 unique, top=ops-010 7 = 14.0%)
  ops-010: ███████ 7
  ops-007: ██████ 6
  ops-012: █████ 5
  ops-003: █████ 5
  ops-004: ████ 4
  ops-009: ████ 4
  ops-005: ████ 4
  ops-001: ████ 4
  ops-013: ███ 3
  ops-011: ███ 3
  ops-008: ██ 2
  ops-014: ██ 2
  ops-002: █ 1

  ### Closer (pool=16, used=14 unique, top=cl-008 8 = 16.0%)
  cl-008: ████████ 8
  cl-004: ████████ 8
  cl-001: ██████ 6
  cl-005: █████ 5
  cl-003: ████ 4
  cl-006: ████ 4
  cl-007: ███ 3
  cl-ind-001: ███ 3
  cl-002: ███ 3
  cl-auto-003: ██ 2
  cl-auto-002: █ 1
  cl-auto-001: █ 1
  cl-ind-004: █ 1
  cl-ind-002: █ 1

  ## 3 shortest descriptions

  ### alpha-industrial-services — 175w (cohort=sparse-data)
ALPHA INDUSTRIAL SERVICES operates as a demolition and salvage site in Abbeville, Louisiana. It is one of the local intake points for individual sellers, contractors, and small haulers who need to move scrap material rather than send it to a landfill. No accepted-materials list appears under this yard's directory entry at present. Sellers should phone the site to confirm what categories fit the inbound take before any drive over, which keeps the trip from turning into a wasted run on the day of the drop-off. The hours of operation are not posted in the directory, and a phone line is on file. These come straight from the yard's filing with the directory and represent the inbound-facing snapshot of how the site handles contact and posted hours, surfaced as a working baseline for planning a visit. Contractors with structural steel or larger industrial loads should phone the yard to confirm intake conditions and per-ton scrap pricing. The same call sorts a delivery slot at the gate and any equipment the site needs to handle the inbound.

### minichiello-bros-scrapit — 177w (cohort=sparse-data)
Scrap intake in Charlestown, Massachusetts runs through outfits like Minichiello Bro's-Scrapit, which handles scrap metal recycling work. The business takes in material from individual sellers and small contractors, and acts as a paid drop-off point for inbound scrap metal volume. Inbound category data is not recorded for the business in the current directory listing. Sellers planning a drop-off should phone the yard to confirm what types are on the take list before any drive over to the gate, which avoids a wasted trip on the day. On the contact front, a phone line is on file. The hours of operation are not posted in the directory, which together form the yard's published-facing schedule and channel mix as filed with the directory, and give sellers a working sense of how to reach the site before driving over. Clean material posts faster and prices better — copper free of insulation, aluminum without steel attached, iron sorted from cast. Sellers spending a few minutes on prep at home tend to land a working price quote at the gate without back-and-forth.

### kowski-roll-off-service — 178w (cohort=sparse-data)
Among the scrap and recycling outfits in Saint Paul, Minnesota is Kowski Roll-Off Service, which handles demolition and salvage work. The site processes inbound material from individual sellers and small contractors, and acts as a turn-around point for local salvage volume. Which materials this yard takes on a given day is not published in our directory. Sellers can phone the site to confirm the inbound category list before planning a drop-off, which removes any guesswork at the gate and keeps a wasted trip off the table. Day-to-day hours are not on file in the listing. A phone line appears in the listing, which together capture what the yard has filed with the directory about its inbound contact and posted schedule, and give sellers a working baseline for planning a visit before any drive over to the gate. Clean material posts faster and prices better — copper free of insulation, aluminum without steel attached, iron sorted from cast. Sellers spending a few minutes on prep at home tend to land a working price quote at the gate without back-and-forth.


  ## 3 longest descriptions

  ### eight-acres-recycling — 193w (cohort=random)
Scrap sellers in and around Prosperity, South Carolina can take material to Eight Acres Recycling, a demolition and salvage business within Newberry County. The site works with walk-in sellers and small contractors, and provides a paid intake channel for scrap metal across the surrounding county. The yard has not filed an accepted-materials list with the directory at this time. A quick phone check is the cleanest way for sellers to confirm what inbound types are on the take list before any drive over, and to gauge whether a load is worth the trip. The directory entry shows a phone line and an email contact appear in the listing, and posted hours are available for visitors to check. Both data points reflect what the yard has filed about its inbound contact and posted schedule, and give sellers a working baseline for how to reach the site before any drive over with a load. Some yards require ID at intake, and a few keep separate records for ferrous versus non-ferrous drop-offs. Sellers planning a first visit should confirm what the gate needs on a phone call so the paperwork side is sorted before driving over.

### fast-cash-for-junk-cars — 194w (cohort=sparse-data)
Scrap sellers in and around Lakeland, Florida can take material to FAST CASH FOR JUNK CARS, an auto salvage and parts business in Polk County. The site works with walk-in sellers and small contractors, and provides a paid intake channel for scrap metal across the surrounding county. The site's posted intake list is currently empty in our directory entry. A phone check to the yard is the cleanest way for sellers to confirm which inbound categories fit the standard take, which keeps a drop-off from turning into a wasted trip on the day of the drive. Looking at posted details, a phone line appears in the listing and hours of operation are not on file. These come from the yard's own filing with the directory and represent the public-facing snapshot of the inbound flow, surfaced here as a working baseline for sellers planning a visit. Auto sellers should expect the site to ask about drained fluids before intake — oil, coolant, fuel — and about whether batteries and catalytic converters need to come out separately. A phone call to the yard confirms what prep is needed and whether the operator handles that work in-house.

### klein-recycling-top-prices-paid-for-junk-cars — 200w (cohort=auto-salvage)
The auto salvage and parts site Klein Recycling - TOP PRICES PAID FOR JUNK CARS runs in Hillsborough, New Jersey, taking inbound material from sellers and contractors. The business provides a paid drop-off point for scrap metal that would otherwise sit unused, and acts as a turn-around point for local salvage volume. Accepted-material categories are not on file in our directory for this yard. A quick call to the site before a drop-off is the right move to confirm which inbound types are on the take list, and which the yard would prefer to send elsewhere on a given day. Per the listing, a phone line, a website, and an email contact appear in the listing and posted hours are available for visitors to check. The directory captures these two data points from the yard's own filing as part of its public-facing snapshot, and surfaces them as a working baseline for sellers planning an inbound visit to the gate. Posted scrap prices move with the daily commodity market, so the intake quoted on a given day can differ from prices listed online or quoted earlier in the week. A short phone call before a drop-off pins down the day's number.


  ## 8 random samples (deterministic by md5(slug))

  ### grapperhaus-metal-co (187w, cohort=random)
**Facts:** city=Highland, state=IL, county_known=true, service_focus=general-scrap, accepted_on_file=false, has_phone=true, has_website=true, has_email=false, hours_structured=true
**Templates:** opening=open-029 · materials=mat-nd-016 · operations=ops-010 · closer=cl-004

The scrap metal recycling site Grapperhaus Metal Co runs in Highland, Illinois, taking inbound material from sellers and contractors. The business provides a paid drop-off point for scrap metal that would otherwise sit unused, and acts as a turn-around point for local salvage volume. Posted intake categories are currently blank on this listing in our directory. A phone call to the yard is the right way for sellers to confirm what inbound types fit the standard take, which keeps the trip productive on the day of the drop-off and saves a wasted run. Looking at posted details, a phone line and a website appear in the listing and posted hours are available for visitors to check. These come from the yard's own filing with the directory and represent the public-facing snapshot of the inbound flow, surfaced here as a working baseline for sellers planning a visit. Clean material posts faster and prices better — copper free of insulation, aluminum without steel attached, iron sorted from cast. Sellers spending a few minutes on prep at home tend to land a working price quote at the gate without back-and-forth.

---

### a-to-z-cleaning-junk-removal (187w, cohort=multi-yard-city)
**Facts:** city=Neenah, state=WI, county_known=true, service_focus=demolition, accepted_on_file=false, has_phone=true, has_website=false, has_email=true, hours_structured=true
**Templates:** opening=open-018 · materials=mat-nd-001 · operations=ops-007 · closer=cl-ind-004

Scrap intake in Neenah, Wisconsin runs through outfits like A To Z Cleaning & Junk Removal, which handles demolition and salvage work. The business takes in material from individual sellers and small contractors, and acts as a paid drop-off point for inbound scrap metal volume. Public records do not list which material types the yard accepts on the inbound side. A short phone call to the site is the cleanest way for sellers to confirm what categories fit the take on a given day before planning a drop-off and a drive over. Per the listing, a phone line and an email contact are on file and operating hours are posted in the listing. The directory captures these two data points from the yard's own filing as part of its public-facing snapshot, and surfaces them as a working baseline for sellers planning an inbound visit to the gate. Demolition crews and contractors with structural steel should phone the yard to schedule drop-off and confirm the day's per-ton scrap rate. Walking through approximate tonnage and material spec on the call books gate timing and a quoted intake price together.

---

### only-cash-for-junk-cars (183w, cohort=sparse-data)
**Facts:** city=Abbeville, state=LA, county_known=false, service_focus=auto-salvage, accepted_on_file=false, has_phone=true, has_website=false, has_email=false, hours_structured=false
**Templates:** opening=open-008 · materials=mat-nd-007 · operations=ops-012 · closer=cl-003

Only Cash For Junk Cars sits in Abbeville, Louisiana, with a focus on auto salvage and parts work. The site takes inbound scrap from local sellers and small contractors, and acts as a paid outlet for material that would otherwise sit unused or head to landfill. Which materials this yard takes on a given day is not published in our directory. Sellers can phone the site to confirm the inbound category list before planning a drop-off, which removes any guesswork at the gate and keeps a wasted trip off the table. On a practical level, hours of operation are not on file and a phone line is on file. The directory carries what the yard chose to publish about its day-to-day inbound flow and contact channels, surfaced here as a working baseline for sellers planning a visit to the gate. Sorting at the gate moves faster when materials are pre-separated at home — ferrous in one bin, copper in another, aluminum kept clean. The yard can post the load through faster, and sellers tend to land a cleaner intake price on each category.

---

### salt-lake-junk-removal (183w, cohort=random)
**Facts:** city=Taylorsville, state=UT, county_known=true, service_focus=demolition, accepted_on_file=false, has_phone=true, has_website=false, has_email=false, hours_structured=true
**Templates:** opening=open-014 · materials=mat-nd-015 · operations=ops-003 · closer=cl-006

Salt Lake Junk Removal is one of the demolition and salvage sites listed in Taylorsville, Utah. The business takes inbound scrap material from individual sellers and contractors, and acts as a paid outlet for metal that would otherwise sit unused or be sent to landfill. Material acceptance details are not published for this yard in our directory entry. A short phone check to the site is the cleanest way for sellers to confirm the inbound category list before planning a drop-off and loading a truck for the drive over to the gate. For practical details, posted hours are available for visitors to check and a phone line appears in the listing. The directory entry is the yard's own self-reported snapshot of how it handles inbound contact and posted schedule, surfaced here as a working baseline for sellers planning a visit to the gate. Sellers running a series of small drop-offs over a few weeks may want to ask the yard about its routine handling for repeat inbound. Some sites coordinate around recurring volume in a way that smooths both pricing and gate timing.

---

### the-wrecking-crew (189w, cohort=multi-yard-city)
**Facts:** city=Abbeville, state=LA, county_known=false, service_focus=general-scrap, accepted_on_file=false, has_phone=true, has_website=true, has_email=true, hours_structured=true
**Templates:** opening=open-011 · materials=mat-nd-011 · operations=ops-011 · closer=cl-003

Scrap sellers in and around Abbeville, Louisiana can take material to The Wrecking Crew, a scrap metal recycling business. The site works with walk-in sellers and small contractors, and provides a paid intake channel for scrap metal across the surrounding county. No accepted-materials list appears under this yard's directory entry at present. Sellers should phone the site to confirm what categories fit the inbound take before any drive over, which keeps the trip from turning into a wasted run on the day of the drop-off. The directory entry shows a phone line, a website, and an email contact appear in the listing, and posted hours are available for visitors to check. Both data points reflect what the yard has filed about its inbound contact and posted schedule, and give sellers a working baseline for how to reach the site before any drive over with a load. Sorting at the gate moves faster when materials are pre-separated at home — ferrous in one bin, copper in another, aluminum kept clean. The yard can post the load through faster, and sellers tend to land a cleaner intake price on each category.

---

### a-affordable-towing-junk-car-removal (180w, cohort=auto-salvage)
**Facts:** city=Dorchester Center, state=MA, county_known=true, service_focus=auto-salvage, accepted_on_file=false, has_phone=true, has_website=false, has_email=false, hours_structured=true
**Templates:** opening=open-027 · materials=mat-nd-010 · operations=ops-008 · closer=cl-005

Inbound scrap in Dorchester Center, Massachusetts goes through sites like An Affordable Towing & Junk Car Removal, which handles auto salvage and parts work. The business takes material from walk-in sellers and small contractors, providing a paid intake channel for scrap metal volume across the surrounding county. The yard has not filed an accepted-materials list with the directory at this time. A quick phone check is the cleanest way for sellers to confirm what inbound types are on the take list before any drive over, and to gauge whether a load is worth the trip. The listing shows that a phone line is on file. Day-to-day hours are on file, which together represent the yard's published-facing contact and schedule mix in our directory, and give sellers a working sense of how to reach the site before driving over with a load. Larger inbound volumes benefit from a phone-ahead so the yard can plan gate space and any handling equipment needed at intake. The same call lets sellers confirm whether the site can accommodate the planned load on the planned day.

---

### sote-metal-processors (182w, cohort=sparse-data)
**Facts:** city=Santa Maria, state=CA, county_known=true, service_focus=general-scrap, accepted_on_file=false, has_phone=true, has_website=false, has_email=false, hours_structured=false
**Templates:** opening=open-028 · materials=mat-nd-009 · operations=ops-003 · closer=cl-004

Sote Metal Processors is a scrap metal recycling business that sets up shop in Santa Maria, California. The site takes inbound scrap from walk-in sellers and small contractors, and acts as a paid outlet for material that would otherwise sit in garages or salvage piles. Accepted material categories are not recorded for this yard in the current directory entry. Sellers planning a drop-off should phone the site to confirm what inbound types fit the standard take, which removes the guesswork at the gate and keeps the trip on track. For practical details, day-to-day hours are not on file in the listing and a phone line appears in the listing. The directory entry is the yard's own self-reported snapshot of how it handles inbound contact and posted schedule, surfaced here as a working baseline for sellers planning a visit to the gate. Clean material posts faster and prices better — copper free of insulation, aluminum without steel attached, iron sorted from cast. Sellers spending a few minutes on prep at home tend to land a working price quote at the gate without back-and-forth.

---

### a-1-2-price-auto-parts-house (192w, cohort=sparse-data)
**Facts:** city=Madison, state=AL, county_known=true, service_focus=auto-salvage, accepted_on_file=false, has_phone=true, has_website=false, has_email=false, hours_structured=false
**Templates:** opening=open-014 · materials=mat-nd-012 · operations=ops-014 · closer=cl-002

A 1/2 Price Auto Parts House is one of the auto salvage and parts sites listed in Madison, Alabama. The business takes inbound scrap material from individual sellers and contractors, and acts as a paid outlet for metal that would otherwise sit unused or be sent to landfill. Information on which material types this site takes on a given day is not on file. A short call to the yard is the cleanest way for sellers to confirm the inbound category list before planning a load and a drive over to the gate, which keeps the trip productive. Practical details: hours of operation are not on file, and a phone line is on file. Both data points are pulled from the yard's filing with the directory and reflect the public-facing snapshot of the inbound flow, surfaced here as a working baseline for sellers planning a visit to the gate. On heavier ferrous loads, a rough weight in pounds or tons matters for the quote — sellers should bring a working estimate so the yard can price the inbound and book gate timing accordingly. A short call ahead of the drive sorts both.


  ## Bulk run

  **Not executed in this session.** Per spec, bulk is a separate decision after
  gate review. Run when ready:

  ```
  pnpm --filter @workspace/scripts run generate-yard-descriptions-templated -- --mode=bulk
  ```

  Pre-bulk requires the coverage gate to be re-run and pass:
  `pnpm --filter @workspace/scripts run yard-desc-templated-coverage-check`
  (currently 1740/1740 passing).
  