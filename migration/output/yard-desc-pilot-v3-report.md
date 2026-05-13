# Yard Descriptions — Pilot v3 Report

**Date:** 2026-05-09  
**Model:** claude-sonnet-4-6, max_tokens=700  
**Pilot size:** 50 yards (zero overlap with v1 or v2)  
**Validator:** `scripts/src/yard-desc-validator.ts` (v3 — narrowed since/established/many/most/few + name-token allowlist + county normalization)

## Final outcome

- **Successful:** 49 / 50 (98%)
- **First-try pass:** 34 / 50 (68%) — *target ≥80%*
- **Dropped (3 attempts exhausted):** 1 / 50 (2%) — *target ≤2%*
  - yard 7064 (name-stopword): comparative:best

## Decision criteria status

| Criterion | Target | Actual | Met |
|---|---|---|---|
| v3 first-try pass rate | ≥80% | 68% | NO |
| v3 drop rate | ≤2% | 2% | YES |
| v1 retro reject rate | ≤30% | 69% | NO |

→ **STOP**: v1 retro reject rate ≥50% indicates v1 generator was producing too much hallucinated language. Either regenerate v1 under v3 rules or switch to slot-filling template architecture.

## V1 retro under v3 rules

**Passed:** 30 (30.6%)    
**Rejected:** 68 (69.4%)    
Improvement: from 84% rejection (v2 rules) → **69%** (v3 rules) — drop of 15 percentage points.

See `v1-retro-validation.md` for full category and term breakdown.

## Attempts distribution (successful yards)

| Attempts | Yards |
|---|---|
| 1 | 34 |
| 2 | 12 |
| 3 | 3 |

## Cohort distribution (successful)

| Cohort | Yards |
|---|---|
| sparse-data | 15 |
| name-stopword | 14 |
| saint-county | 10 |
| random | 10 |

**Drops by cohort:** name-stopword=1

## Word count

min=197 · avg=212 · max=227 (49/49 in target 150–250)

## Token usage

- Total: 83,223 input / 18,048 output
- Avg per successful yard: 1,698 in / 368 out

## Bulk cost projection

At Sonnet pricing ($3/M in, $15/M out) for ~7573 remaining yards:
- Input: ~$38.58
- Output: ~$41.80
- **Total: ~$80.38**

If v1 (100 yards) is regenerated as well: add ~$1.06 for a total of **~$81.44**.

## 8 random samples (seed=123)

### Best American Iron & Metals — Houston, TX  (yard 1983, cohort `name-stopword`)

**Slug:** `best-american-iron-metals` · **Words:** 223 · **Attempts:** 1

**Input facts:**

- city_size: `unknown`
- county: `Harris` (known: True)
- service_focus: `auto-salvage`
- accepted_on_file: `False` ([])
- service_keywords: ['automobile-parts-supplies', 'metal-specialties', 'recycling-centers', 'scrap-metals', 'surplus-salvage-merchandise']
- hours_structured: `True`
- contact: phone=True, website=False, email=True

**Generated description:**

> Best American Iron & Metals operates as an auto-salvage and scrap-metal yard in Houston, TX, drawing on a service mix that spans automobile parts and supplies, metal specialties, recycling, and surplus salvage merchandise. The yard sits within Harris County and handles the kind of overlap between automotive dismantling and general scrap recovery that makes it useful to a range of customers — from those sourcing used vehicle components to those moving raw ferrous and non-ferrous material.
> 
> The specific list of accepted materials is not currently on file for this directory, so prospective visitors should contact the yard directly before making a trip to confirm whether their particular scrap type or parts request is accommodated. That step saves time on both sides of the transaction.
> 
> Hours are on file and the yard operates across multiple days of the week; the exact schedule can be confirmed through either of the two contact channels available — phone and email. Neither channel's details appear in this listing, so readers should locate current contact information through the yard's own published sources.
> 
> For anyone sourcing salvage auto parts or moving scrap metal in Houston, the operational profile here covers enough ground to be worth a call ahead. Verifying accepted materials and current hours before visiting remains the practical first move for any new customer approaching this type of yard.

### B and H Hauling & Junk Removal/Moving — Fullerton, CA  (yard 119, cohort `sparse-data`)

**Slug:** `b-and-h-hauling-junk-removal-moving` · **Words:** 216 · **Attempts:** 1

**Input facts:**

- city_size: `unknown`
- county: `Orange` (known: True)
- service_focus: `demolition`
- accepted_on_file: `False` ([])
- service_keywords: ['rubbish-garbage-removal-containers', 'rubbish-removal', 'scrap-metals', 'trash-hauling']
- hours_structured: `False`
- contact: phone=True, website=False, email=False

**Generated description:**

> B and H Hauling & Junk Removal/Moving operates out of Fullerton, CA, handling rubbish removal, trash hauling, and scrap metals alongside a demolition-focused service mix. The combination of junk removal, moving assistance, and scrap handling makes this a practical stop for residential and commercial customers clearing out properties or managing debris after a demolition project.
> 
> The specific list of accepted materials is not on file, so callers should confirm what the yard takes before loading up a vehicle or scheduling a pickup. Since scrap metals are listed among the service keywords, customers dealing with ferrous or non-ferrous scrap may find this worth a call — but verifying material eligibility directly is the safest approach.
> 
> Hours are not on file for this Orange County operation, which is another reason to reach out before making a trip. Phone is the contact channel available for this yard, making a quick call the most direct way to get current scheduling information, confirm service availability, and ask about any restrictions on materials or load sizes.
> 
> For anyone in Fullerton facing a cleanup, a haul-away job, or post-demolition debris removal, B and H Hauling & Junk Removal/Moving covers enough ground across rubbish, scrap, and general trash hauling to be worth checking against your specific needs. Confirm the details by phone before arriving.

### Best Metal Recyclers — Pineville, LA  (yard 3909, cohort `name-stopword`)

**Slug:** `best-metal-recyclers` · **Words:** 222 · **Attempts:** 1

**Input facts:**

- city_size: `unknown`
- county: `Rapides` (known: True)
- service_focus: `general-scrap`
- accepted_on_file: `False` ([])
- service_keywords: ['recycling-centers', 'scrap-metals', 'surplus-salvage-merchandise']
- hours_structured: `True`
- contact: phone=True, website=False, email=False

**Generated description:**

> Best Metal Recyclers operates as a general scrap and recycling facility in Pineville, Louisiana, serving the Rapides Parish area with a focus on scrap metals and surplus salvage merchandise.
> 
> The specific materials this yard accepts are not currently on file for this directory listing, so anyone planning a trip should call ahead to confirm whether their particular metals or salvage items qualify. That phone call is the primary contact channel available, and taking a few minutes to verify accepted materials before loading a vehicle can save a wasted drive.
> 
> Operating hours are on file and the yard does run on a set weekly schedule, though exact opening and closing times are best confirmed directly by phone. Knowing what days the facility is open before heading over is a practical first step, especially for those hauling heavier loads or working around other commitments.
> 
> As a general-scrap operation, Best Metal Recyclers handles the kind of material mix — scrap metals and salvage goods — that overlaps with both residential cleanouts and commercial surplus disposal. The yard does not appear to maintain a website or email contact channel based on current directory data, making a phone inquiry the most direct path to getting questions answered about pricing, drop-off procedures, and acceptable loads. Verifying details directly with the facility is always advisable before making the trip.

### Connecticut Metal Industries — Abbeville, LA  (yard 3813, cohort `sparse-data`)

**Slug:** `connecticut-metal-industries` · **Words:** 214 · **Attempts:** 1

**Input facts:**

- city_size: `unknown`
- county: `NOT ON FILE` (known: False)
- service_focus: `general-scrap`
- accepted_on_file: `False` ([])
- service_keywords: ['scrap-metals']
- hours_structured: `False`
- contact: phone=True, website=False, email=False

**Generated description:**

> Connecticut Metal Industries operates as a scrap metals yard in Abbeville, Louisiana, handling the buying and processing of metal materials as its core activity. The specific list of accepted metals and materials is not currently on file for this directory, so visitors should call ahead before making the trip to confirm what the yard accepts and whether their particular scrap qualifies.
> 
> Hours of operation are not on file either, which makes a phone call even more practical before heading over. Contacting the yard by phone is the confirmed channel available to reach staff directly — no website or email contact has been recorded in this listing.
> 
> For anyone in Abbeville or elsewhere in Louisiana moving scrap metal and looking for a drop-off point, the straightforward step is to get on the phone with Connecticut Metal Industries first. Confirming accepted materials, current hours, and any requirements around how metal should be prepared or sorted will save time on both ends. Scrap yards operating in this category can have specific rules about mixed loads, ferrous versus non-ferrous materials, or minimum quantities, none of which are documented here. A direct conversation with the yard will answer those questions more accurately than any directory entry can. Keep the phone number handy and verify the details before loading up.

### All American Metals — Bradenton, FL  (yard 7285, cohort `random`)

**Slug:** `all-american-metals` · **Words:** 202 · **Attempts:** 2

**Input facts:**

- city_size: `unknown`
- county: `Manatee` (known: True)
- service_focus: `general-scrap`
- accepted_on_file: `False` ([])
- service_keywords: ['scrap-metals']
- hours_structured: `True`
- contact: phone=True, website=True, email=True

**Generated description:**

> All American Metals is a scrap metal yard serving Bradenton, FL, operating under a general-scrap focus for customers looking to move metal materials. Because the accepted materials list is not on file, visitors should confirm what the yard currently takes before making the trip — phone, email, and website contact channels are all available for that purpose.
> 
> Hours are on file for the yard, and it operates across multiple days of the week, though prospective visitors should verify the current schedule directly rather than assuming availability on any given day. Reaching out through the website or email can be practical for non-urgent inquiries, while a phone call is the faster route when timing matters.
> 
> Situated in Manatee County, the yard draws customers from Bradenton and surrounding parts of Florida who need an outlet for scrap metals. The general-scrap designation means the operation covers a broad functional category rather than a narrow specialty, but without a confirmed accepted-materials list on file, it would be premature to assume which specific metals or items qualify. Anyone planning to bring materials should get confirmation first — a quick call or email to All American Metals before arriving is the practical approach to avoid an unnecessary trip.

### Reliable Auto Enterprises — Pottstown, PA  (yard 1551, cohort `name-stopword`)

**Slug:** `reliable-auto-enterprises` · **Words:** 210 · **Attempts:** 1

**Input facts:**

- city_size: `unknown`
- county: `Montgomery` (known: True)
- service_focus: `mixed`
- accepted_on_file: `True` (['aluminum', 'brass', 'copper', 'lead'])
- service_keywords: ['automobile-salvage', 'junk-dealers', 'scrap-metals', 'smelters-refiners-precious-metals', 'surplus-salvage-merchandise']
- hours_structured: `True`
- contact: phone=True, website=False, email=True

**Generated description:**

> Reliable Auto Enterprises operates in Pottstown, PA as a mixed salvage and scrap operation covering several distinct service areas — automobile salvage, general junk dealing, scrap metals processing, precious metals smelting and refining, and surplus salvage merchandise.
> 
> On the materials side, the yard accepts aluminum, brass, copper, and lead. Visitors bringing other metals or materials should confirm acceptance before making the trip, since the accepted list on file is specific and may not cover every category.
> 
> Montgomery County residents and anyone traveling into Pottstown will find that the yard maintains posted hours across multiple days, though callers should verify the current schedule directly, as day-to-day availability can vary. Contact options include both phone and email, giving customers a choice of how to reach out before visiting.
> 
> The combination of automobile salvage with precious metals smelting and refining makes this a somewhat broader operation than a straightforward scrap yard, and the surplus salvage merchandise category suggests the business handles commercial and industrial material streams alongside consumer drop-offs. Anyone with nonferrous metals — particularly copper, brass, or aluminum — will find those materials fall within the yard's stated acceptance list. For anything outside that list, a quick call or email ahead of arrival is the practical move to avoid a wasted trip.

### The Best Recyclers — Abbeville, LA  (yard 5679, cohort `name-stopword`)

**Slug:** `the-best-recyclers` · **Words:** 222 · **Attempts:** 1

**Input facts:**

- city_size: `unknown`
- county: `NOT ON FILE` (known: False)
- service_focus: `demolition`
- accepted_on_file: `False` ([])
- service_keywords: ['computer-electronics-recycling', 'demolition-contractors', 'recycling-centers', 'recycling-equipment-services', 'scrap-metals']
- hours_structured: `True`
- contact: phone=True, website=False, email=True

**Generated description:**

> The Best Recyclers operates out of Abbeville, Louisiana, with a service mix that spans demolition contracting, scrap metals, recycling centers, recycling equipment services, and computer and electronics recycling. That combination of demolition and material recovery work sets the operational scope clearly: this is not a single-commodity drop-off point but a yard engaged across several stages of the material lifecycle.
> 
> Specific accepted materials are not on file for this listing, so anyone planning a visit should contact the yard directly before loading up a vehicle. The yard does maintain posted hours and operates on a regular weekly schedule, though prospective visitors should confirm current days and times when they reach out. Phone and email are both available as contact channels, giving customers a couple of options for getting questions answered in advance.
> 
> For those bringing electronics or computer equipment, it is worth noting that acceptance policies for those categories can vary and are not detailed in the current listing. The same applies to scrap metal grades or demolition debris specifications. A quick call or email before arrival is the practical step — it avoids a wasted trip and helps both parties prepare. The Best Recyclers serves Abbeville and the surrounding parts of Louisiana, making it a point of contact for residents and contractors alike who are working through material disposal or demolition-adjacent needs.

### Natemetals Inc — Glenview, IL  (yard 6415, cohort `sparse-data`)

**Slug:** `natemetals-inc` · **Words:** 210 · **Attempts:** 2

**Input facts:**

- city_size: `unknown`
- county: `Cook` (known: True)
- service_focus: `general-scrap`
- accepted_on_file: `False` ([])
- service_keywords: ['scrap-metals']
- hours_structured: `False`
- contact: phone=True, website=False, email=False

**Generated description:**

> Natemetals Inc operates as a scrap metals yard in Glenview, Illinois, serving Cook County. The yard falls under a general scrap focus, meaning its work centers on metal materials — though the specific list of accepted metals and materials is not currently on file for this directory.
> 
> Visitors planning a trip should call ahead before loading up a vehicle. Confirming what the yard accepts at that moment is a practical step, since scrap operations can shift what they take in based on current conditions. Phone is the contact channel available for reaching the yard directly.
> 
> Hours are not on file here, which makes that initial phone call doubly useful — both to verify accepted materials and to confirm when the yard is open on a given day. Showing up without checking could mean a wasted trip, particularly for anyone hauling bulk material.
> 
> For Illinois residents in and around Glenview, this Cook County yard represents a local option worth a direct inquiry. The yard's general-scrap orientation suggests it handles a range of metal types, but nothing specific can be confirmed through this listing alone. Reaching out to Natemetals Inc by phone before visiting remains the clearest path to getting accurate, current information on what they buy and when they do business.

