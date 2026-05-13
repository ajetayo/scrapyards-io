# Yard Descriptions — Pilot v2 Report

**Date:** 2026-05-09  
**Model:** claude-sonnet-4-6, max_tokens=700  
**Pilot size:** 50 yards (zero overlap with v1's 100)

## Final outcome

- **Successful:** 49 / 50 (98%)
- **Dropped after 3 validation attempts:** 1
  - yard 7052 (best-american, cohort `flagged-similar`): comparative:most,best

## Attempts distribution (successful yards only)

| Attempts | Yards |
|---|---|
| 1 | 15 |
| 2 | 23 |
| 3 | 11 |

## Cohort distribution (successful)

| Cohort | Yards |
|---|---|
| sparse-data | 15 |
| flagged-similar | 14 |
| specialized-name | 10 |
| top-state-TX | 2 |
| top-state-FL | 2 |
| top-state-PA | 2 |
| top-state-OH | 2 |
| top-state-CA | 2 |

## Word count

min=182 · avg=205 · max=226 (target 150–250, all 49/49 in range)

## Token usage

- **Total input tokens:** 100,135
- **Total output tokens:** 25,089
- **Avg per successful yard:** 2,043 in / 512 out

## Bulk cost projection

At Sonnet pricing ($3/M input, $15/M output) for ~7573 remaining yards:
- Input: ~$46.41
- Output: ~$58.16
- **Total: ~$104.58**

## 10 random samples (seed=42)

### Caracciolo Charles Steel & Metal YD — Altoona, PA  (yard 6214, cohort `top-state-PA`)

**Slug:** `caracciolo-charles-steel-metal-yd` · **Words:** 211 · **Attempts:** 2

**Input facts:**

- city_size: `unknown`
- county: `Blair` (known: True)
- service_focus: `general-scrap`
- accepted_on_file: `False` ([])
- service_keywords: ['scrap-metals']
- hours_structured: `True` (raw: `Mon - Fri: 8:00 am - 4:30 pm Sat: 8:00 am - 11:30 am Sun Closed`)
- contact: phone=True, website=False, email=False

**Generated description:**

> Caracciolo Charles Steel & Metal YD operates as a scrap metals yard serving Altoona, PA and the Blair County area. The yard's focus falls squarely on scrap metals, though the full list of accepted materials is not currently on file for this directory — prospective visitors should call ahead before making a trip to confirm what the yard will take at the time of their visit.
> 
> In terms of access, the yard operates across multiple days, including weekdays, and phone contact is available for those wanting to reach staff directly. No website or email channel is listed at this time, so phone remains the primary means of reaching the operation before visiting. Hours are on file with this directory, making it worth a quick check or call to confirm current scheduling before arrival.
> 
> As a general-scrap operation, this yard is suited to individuals or businesses looking to drop off scrap metal rather than seek out specialty processing services. Because accepted materials are not documented here, confirming specifics by phone is a practical step that can save an unnecessary trip. Visitors to the Altoona area looking for a local drop-off point for scrap metals should treat a quick phone inquiry as the first order of business before loading materials and heading over.

### Grant Iron & Motors — Saint Louis, MO  (yard 2021, cohort `sparse-data`)

**Slug:** `grant-iron-motors` · **Words:** 212 · **Attempts:** 1

**Input facts:**

- city_size: `unknown`
- county: `St. Louis (city)` (known: True)
- service_focus: `auto-salvage`
- accepted_on_file: `False` ([])
- service_keywords: ['automobile-parts-supplies-used-rebuilt-wholesale-manufacturers', 'scrap-metals', 'scrap-metals-wholesale', 'surplus-salvage-merchandise', 'used-rebuilt-auto-parts']
- hours_structured: `False`
- contact: phone=True, website=False, email=True

**Generated description:**

> Grant Iron & Motors operates as an auto-salvage yard in Saint Louis, MO, handling a service mix that spans used and rebuilt auto parts, scrap metals, wholesale scrap, and surplus salvage merchandise. The operation sits within St. Louis (city) and appears oriented toward both retail and wholesale customers, given the presence of wholesale-focused service categories alongside standard used-parts supply.
> 
> The specific list of accepted materials is not on file for this yard, so buyers and sellers should confirm what the yard currently takes before making a trip. This is particularly worth noting for scrap-metal loads or surplus merchandise, where acceptance policies can shift depending on current demand and inventory conditions.
> 
> Operating hours are also not on file, which makes direct contact an important first step. Grant Iron & Motors can be reached by phone or email, and using either channel ahead of a visit allows callers to verify hours, check parts availability, or ask about scrap acceptance at that time.
> 
> For anyone sourcing used or rebuilt auto components in the Saint Louis area, or looking to move scrap metal and salvage goods through wholesale channels, this yard offers a practical point of contact. Confirming material compatibility and current availability before arrival will help avoid wasted trips and ensure the visit is productive.

### R & D Salvage LLC — Olivet, MI  (yard 180, cohort `specialized-name`)

**Slug:** `r-d-salvage-llc` · **Words:** 194 · **Attempts:** 3

**Input facts:**

- city_size: `unknown`
- county: `Eaton` (known: True)
- service_focus: `demolition`
- accepted_on_file: `False` ([])
- service_keywords: ['garbage-collection', 'junk-dealers', 'rubbish-removal', 'scrap-metals', 'surplus-salvage-merchandise']
- hours_structured: `True` (raw: `Mon - Fri: 7:30 am - 4:00 pm`)
- contact: phone=True, website=True, email=True

**Generated description:**

> R & D Salvage LLC operates out of Olivet, MI, in Eaton County, with a service focus centered on demolition work alongside related activities such as rubbish removal, junk dealing, garbage collection, scrap metals handling, and surplus salvage merchandise. The operation brings together several practical functions under one roof, making it a useful reference point for property owners, contractors, or businesses dealing with unwanted materials, structural debris, or castoff goods.
> 
> The specific materials accepted by R & D Salvage LLC are not on file for this directory listing, so callers and visitors are strongly encouraged to confirm what the yard takes before making a trip. Hours are on file and the yard does operate on a defined weekly schedule, though prospective visitors should verify current days and times directly with the business before arriving.
> 
> Contact options include phone, a website, and email, giving customers a choice of how to reach out with questions about accepted loads, scheduling, or service availability. Whether the inquiry involves a demolition cleanup, a load of scrap metal, or surplus salvage goods, reaching out in advance is the practical first step for anyone considering a visit to this Olivet-area operation.

### Auto Salvage Technologies — Herkimer, NY  (yard 2569, cohort `specialized-name`)

**Slug:** `auto-salvage-technologies` · **Words:** 204 · **Attempts:** 3

**Input facts:**

- city_size: `unknown`
- county: `Herkimer` (known: True)
- service_focus: `auto-salvage`
- accepted_on_file: `False` ([])
- service_keywords: ['automobile-parts-supplies-used-rebuilt-wholesale-manufacturers', 'automobile-salvage', 'recycling-centers', 'scrap-metals', 'truck-wrecking']
- hours_structured: `True` (raw: `Mon - Fri: 8:00 am - 4:30 pm Sat: 8:00 am - 12:00 pm Sun Closed`)
- contact: phone=True, website=False, email=True

**Generated description:**

> Auto Salvage Technologies operates as an auto-salvage and recycling yard in Herkimer, NY, serving customers with a service mix that spans used and rebuilt automobile parts, automobile salvage, scrap metals, and truck wrecking. The combination of these service categories suggests a general-purpose salvage operation suited to both individual vehicle owners and trade buyers seeking recycled or reclaimed components.
> 
> The specific materials and vehicle types accepted by this yard are not on file, so contacting them directly before making a trip is strongly advisable. Buyers looking for particular parts or sellers hoping to drop off specific scrap should confirm eligibility in advance to avoid a wasted journey.
> 
> Operational hours are on file, and the yard does open across multiple days of the week, though exact times should be verified through direct contact. Auto Salvage Technologies can be reached by phone or email, which provides two practical options for getting questions answered before arriving. The yard's position in Herkimer County gives it straightforward access for residents throughout that part of upstate New York.
> 
> For anyone navigating the salvage or parts-sourcing process in the Herkimer area, this yard represents a documented local option worth a call or email to clarify current inventory and accepted materials before visiting.

### Karchmer A And Son Inc — Memphis, TN  (yard 2389, cohort `sparse-data`)

**Slug:** `karchmer-a-and-son-inc` · **Words:** 223 · **Attempts:** 1

**Input facts:**

- city_size: `unknown`
- county: `Shelby` (known: True)
- service_focus: `general-scrap`
- accepted_on_file: `False` ([])
- service_keywords: ['scrap-metals', 'scrap-metals-wholesale', 'surplus-salvage-merchandise']
- hours_structured: `False`
- contact: phone=True, website=False, email=False

**Generated description:**

> Karchmer A And Son Inc operates as a general scrap business in Memphis, TN, serving Shelby County with a focus on scrap metals, wholesale scrap metals, and surplus salvage merchandise. The operation sits within the scrap-metals trade, meaning customers can reasonably expect to bring ferrous and non-ferrous metal materials, though the full list of accepted materials is not on file for this directory — calling ahead before making a trip is a practical step.
> 
> Because accepted categories are not confirmed here, anyone looking to drop off a specific material should verify eligibility by phone, which is the contact channel on file for this yard. No website or email contact is listed at this time, so the phone remains the direct path to getting current information on pricing, drop-off procedures, and what the yard is accepting.
> 
> Hours for Karchmer A And Son Inc are also not on file with this directory, making a quick phone call doubly worthwhile before visiting. The yard's involvement in surplus and salvage merchandise alongside its scrap-metals focus suggests it handles a broader range of reclaimed goods than a strictly metals-only operation might, though the specifics of that range should be confirmed directly. Buyers and sellers working in the Memphis scrap trade who deal in wholesale volumes may find the wholesale metals designation relevant when planning a visit or inquiry.

### Repurpose solutions — Goodlettsville, TN  (yard 2311, cohort `sparse-data`)

**Slug:** `repurpose-solutions` · **Words:** 201 · **Attempts:** 2

**Input facts:**

- city_size: `unknown`
- county: `Davidson` (known: True)
- service_focus: `general-scrap`
- accepted_on_file: `False` ([])
- service_keywords: ['computer-electronics-recycling', 'recycling-equipment-services', 'scrap-metals', 'scrap-metals-wholesale']
- hours_structured: `False`
- contact: phone=True, website=False, email=False

**Generated description:**

> Repurpose Solutions operates as a general scrap and recycling business in Goodlettsville, Tennessee, serving Davidson County with a service mix that spans computer and electronics recycling, scrap metals handling, and wholesale scrap metals transactions. The combination of electronics recycling and metals services puts this yard in a practical position for both residential drop-offs and commercial accounts looking to move bulk material.
> 
> Because the accepted materials list is not on file for this directory, prospective visitors should contact the yard directly before making the trip. What applies at one scrap operation does not always carry over to another, and confirming accepted categories in advance prevents wasted travel time. Phone is the contact channel available for reaching Repurpose Solutions, so a quick call beforehand is the straightforward way to verify what the yard is currently taking.
> 
> Operating hours are not on file here, which is another reason that calling ahead is practical rather than optional. Scrap yards frequently adjust schedules, and arriving without confirming hours risks a closed gate. For anyone in the Goodlettsville area dealing with end-of-life electronics or metal material that needs proper recycling or resale, this yard's service focus covers both categories and warrants a direct inquiry to determine fit.

### Mullins Salvage — Taylorville, IL  (yard 2121, cohort `specialized-name`)

**Slug:** `mullins-salvage` · **Words:** 195 · **Attempts:** 1

**Input facts:**

- city_size: `unknown`
- county: `Christian` (known: True)
- service_focus: `auto-salvage`
- accepted_on_file: `False` ([])
- service_keywords: ['automobile-parts-supplies', 'recycling-centers', 'scrap-metals', 'surplus-salvage-merchandise']
- hours_structured: `True` (raw: `Mon - Fri: 9:00 am - 4:00 pm Sat: 8:00 am - 1:00 pm Sun Closed`)
- contact: phone=True, website=True, email=False

**Generated description:**

> Mullins Salvage operates as an auto-salvage yard in Taylorville, IL, serving Christian County with a service mix that spans automobile parts and supplies, scrap metals, recycling, and surplus salvage merchandise. The operation's keyword profile suggests a practical, multi-stream yard rather than a narrowly specialized one, making it worth a call before assuming what's available on any given visit.
> 
> The specific materials accepted are not on file for this listing, so prospective visitors should reach out directly to confirm what the yard is currently taking or selling. Contact options include phone and a website, both of which can help buyers and sellers verify inventory or drop-off eligibility ahead of time.
> 
> Hours are on file and indicate the yard operates on a regular weekly schedule, though exact opening and closing times are not published here. Checking current hours through the phone line or website before heading over is advisable, particularly around holidays or during weather-sensitive periods common to central Illinois.
> 
> For anyone sourcing used auto parts, offloading scrap metal, or looking to move surplus salvage goods in the Taylorville area, Mullins Salvage represents a locally accessible option worth contacting directly to understand current stock and intake policies.

### All Around Dads Handyman Service — Mooresville, IN  (yard 1707, cohort `flagged-similar`)

**Slug:** `all-around-dads-handyman-service` · **Words:** 203 · **Attempts:** 3

**Input facts:**

- city_size: `unknown`
- county: `Morgan` (known: True)
- service_focus: `demolition`
- accepted_on_file: `False` ([])
- service_keywords: ['scrap-metals', 'trash-hauling']
- hours_structured: `True` (raw: `Mon - Sun: Open 24 Hours`)
- contact: phone=True, website=False, email=True

**Generated description:**

> Demolition and scrap-metal work form the core of what All Around Dads Handyman Service offers in Mooresville, Indiana. The operation sits within Morgan County and handles service categories that span scrap metals and trash hauling alongside its demolition focus — a practical combination for property owners clearing structures or managing debris removal.
> 
> Specific accepted materials are not on file for this business, so prospective customers should contact the operation directly before hauling anything over. That step is worth taking regardless, as demolition-oriented yards can have variable intake policies depending on job type and current workload.
> 
> Reaching the business is possible through phone or email, both of which are listed channels. Operating hours are on file and cover multiple days, giving customers reasonable flexibility when scheduling pickups or drop-offs. Verifying current hours before a visit remains advisable, particularly for jobs requiring coordination around a demolition timeline.
> 
> For residents and contractors in the Mooresville area handling teardown projects, site cleanup, or accumulated scrap, this operation represents a locally positioned option worth inquiring about. Because the accepted materials list is not publicly confirmed here, a quick call or email exchange will clarify whether a given load or project falls within what the business currently takes on.

### Sunland Scrap Service — Norwood, GA  (yard 5668, cohort `sparse-data`)

**Slug:** `sunland-scrap-service` · **Words:** 208 · **Attempts:** 1

**Input facts:**

- city_size: `unknown`
- county: `Warren` (known: True)
- service_focus: `general-scrap`
- accepted_on_file: `False` ([])
- service_keywords: ['recycling-centers', 'scrap-metals']
- hours_structured: `False`
- contact: phone=True, website=False, email=False

**Generated description:**

> Sunland Scrap Service operates as a scrap metal recycling facility in Norwood, Georgia, serving Warren County. The yard's focus falls within general scrap and scrap metal recycling, making it a practical stop for individuals and businesses looking to move ferrous or non-ferrous materials through proper recycling channels.
> 
> One important caveat for anyone planning a visit: the specific list of accepted materials is not on file for this location. Before loading up a truck or trailer, calling ahead is strongly recommended to confirm which categories of scrap the yard currently accepts. Showing up without checking first risks a wasted trip if the yard's intake policies don't match what you're bringing in.
> 
> Operating hours are also not on file, so the same logic applies — a quick phone call can clarify when the facility is open and whether any drop-off restrictions are in place on a given day. Phone is the confirmed contact channel available for reaching the yard directly.
> 
> For anyone in the Norwood area dealing with scrap metal disposal or looking to recycle salvageable materials, Sunland Scrap Service represents a local option worth a call to assess fit. Verifying accepted materials, current hours, and any load requirements before arrival will make the process considerably smoother for both parties.

### R&R AUTO EXPRESS, LLC — Orlando, FL  (yard 1338, cohort `top-state-FL`)

**Slug:** `rr-auto-express-llc` · **Words:** 216 · **Attempts:** 2

**Input facts:**

- city_size: `unknown`
- county: `Orange` (known: True)
- service_focus: `auto-salvage`
- accepted_on_file: `False` ([])
- service_keywords: ['automobile-salvage', 'junk-dealers', 'recycling-centers', 'scrap-metals']
- hours_structured: `True` (raw: `Wed - Sun: Open 24 Hours`)
- contact: phone=True, website=True, email=False

**Generated description:**

> Auto salvage and scrap metal recycling are the core business of R&R AUTO EXPRESS, LLC, an Orlando, Florida operation serving customers who need to move junk vehicles or recover value from end-of-life automobiles. The yard's service profile spans automobile salvage, junk dealing, recycling, and scrap metals — a combination that positions it as a practical stop for vehicle owners, dismantlers, and metal recyclers alike.
> 
> Because the specific list of accepted materials is not on file for this yard, callers and visitors are strongly encouraged to confirm what the yard will take before making the trip. Phone and website contact channels are available for exactly this kind of inquiry, making it straightforward to get answers without driving over unnecessarily.
> 
> Hours are on file and the yard operates on a regular weekly schedule, though prospective visitors should verify current operating days directly, as schedules can change. Situated in Orange County within the Orlando area, the facility draws from a broad base of residents and businesses looking to dispose of unwanted vehicles or scrap.
> 
> Whether the purpose is dropping off a non-running car, sourcing salvage parts, or offloading collected scrap metal, R&R AUTO EXPRESS, LLC represents one option worth checking in the Orlando area — provided materials and availability are confirmed in advance through the yard's listed contact channels.

