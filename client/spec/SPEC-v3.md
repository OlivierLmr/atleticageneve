# Atletica Geneve — Functional Specification v3

> **Purpose**: Single source of truth for the tool's data model, personas, workflows, and business rules. Database will be rebuilt from scratch for this version.
>
> **Changes from v2**: Negotiation status endpoint moved to athlete; `decidedAt` and `assignedSelector` moved to athlete; `hotelRoomId` removed from athlete (only on agreement); hotel split into hotel + hotel_room; PB/SB/ranking restored on application as working copies auto-populated from WA performance; scoring weights configurable per edition; eligibility uses SB with origin-based thresholds; counter-offer constrained to offered fields (except hotel nights); `athletePhone` re-added; `meetRecord`/`targetPerf` changed to real; `timestamp` removed from interaction; `updatedBy` added to athlete; `notificationEmail` on edition; soft-delete via `archivedAt`; auto-recompute scores on WA performance update; prize money separated from budgetRemaining in KPIs; hotel room fill rates added to dashboard.

---

## Reviewer Notes — Points requiring confirmation

The following items are design decisions made by the developer that were not explicitly specified by the client. Please confirm or adjust:

1. **Scoring default weights**: PB=25% and SB=35% follow your choice of "option b" defaults. However, the Ranking (30%), Cost (10%), and EAP bonus (+5 percentage points) values are carried forward from the original implementation. Are these defaults acceptable, or would you like different values? (Remember: these are now configurable per edition, so they can be changed at any time — this only sets the initial defaults.)

2. **Counter-offer locking for non-monetary booleans**: You confirmed that hotel nights can be requested ON (more nights than offered) and monetary fields are freely adjustable. For the remaining booleans — **dinners, stadium meals, and transport shuttles** — we applied the restrictive rule: the athlete can only keep or turn OFF what was offered, but cannot turn ON options that were OFF. Is this correct for all three, or should any of them follow the hotel nights rule (allow requesting more)?

3. **`GET /events/:id/confirmed-athletes` endpoint**: We added a public endpoint that returns the list of confirmed athletes for a given event (useful for event pages or media). This was not explicitly requested. Should it be kept, removed, or restricted to authenticated users?

4. **Archive/restore permission**: Soft-delete via `archivedAt` is implemented as requested. We restricted archive/restore to **Committee only**. Should collaborators also be able to archive athletes, or is Committee-only correct?

---

## 1. Data Model

### 1.1 Edition

One active edition at a time. All athletes, events, and applications belong to it.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | UUID | |
| name | text | yes | | e.g. "Atletica Geneve 2026" |
| year | int | yes | | |
| startDate | date | yes | | |
| endDate | date | yes | | |
| currency | text | yes | `CHF` | ISO 4217 code; used in all monetary displays |
| totalBudget | int | yes | 250,000 | In edition currency |
| stadiumMealCost | int | yes | 30 | Per athlete, flat |
| transportAirportHotelCost | int | yes | 50 | Per trip |
| transportHotelStadiumCost | int | yes | 30 | Per trip |
| notificationEmail | text | yes | | Internal notification recipient (e.g. `collaborators@atleticageneve.ch`) |
| weightPB | int | yes | 25 | Scoring weight for PB factor (0–100) |
| weightSB | int | yes | 35 | Scoring weight for SB factor (0–100) |
| weightRanking | int | yes | 30 | Scoring weight for ranking factor (0–100) |
| weightCost | int | yes | 10 | Scoring weight for cost factor (0–100) |
| bonusEap | int | yes | 5 | EAP bonus in percentage points (added to final score) |

**Validation**: `weightPB + weightSB + weightRanking + weightCost = 100`.

### 1.2 Event Catalog (reference table)

Master list of all possible athletics events. Pre-populated. Not edition-specific.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | text PK | | Slug, e.g. `100m-m` |
| name | text | yes | e.g. "100m" |
| discipline | enum | yes | `Course` or `Concours` |
| gender | enum | yes | `M` or `F` |

`perfType` is derived: `Course` → `MIN` (lower time is better), `Concours` → `MAX` (higher distance/height is better). Not stored.

### 1.3 Event (edition-specific)

An event selected from the catalog for a given edition. Created by Committee when setting up the edition.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | | e.g. `100m-m-2026` |
| editionId | FK→edition | yes | | |
| catalogId | FK→event_catalog | yes | | Links to master event definition |
| maxSlots | int | yes | 8 | Maximum starters |
| intMinima | real | yes | | International qualification standard |
| swissMinima | real | yes | | Swiss qualification standard |
| eapMinima | real | no | | EAP qualification standard; defaults to `intMinima` when absent |
| meetRecord | real | no | | Meeting record (same unit as minima) |
| targetPerf | real | no | | Target performance for this edition |
| swissQuota | int | yes | 1 | Reserved slots for Swiss athletes |
| eapQuota | int | yes | 1 | Reserved slots for EAP athletes |
| prizeMoney1st | int | no | 0 | |
| prizeMoney2nd | int | no | 0 | |
| prizeMoney3rd | int | no | 0 | |
| prizeMoney4th | int | no | 0 | |
| prizeMoney5th | int | no | 0 | |
| prizeMoney6th | int | no | 0 | |
| prizeMoney7th | int | no | 0 | |
| prizeMoney8th | int | no | 0 | |

Derived fields (from catalog): `name`, `discipline`, `gender`, `perfType`.

### 1.4 Country (reference table)

ISO 3166-1 alpha-3 country codes. Used as autocomplete for nationality fields.

| Field | Type | Required |
|-------|------|----------|
| code | text PK | yes — ISO alpha-3 (e.g. `SUI`, `USA`) |
| name | text | yes |

### 1.5 EAP City (reference table)

Valid cities for EAP athletes. Required when `isEap = true`.

| Field | Type | Required |
|-------|------|----------|
| id | text PK | yes |
| name | text | yes |
| country | FK→country | yes |

### 1.6 User

All human actors in the system. Role determines access.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | UUID | |
| role | enum | yes | | `athlete`, `manager`, `collaborator`, `committee` |
| email | text | no | | Unique; used for magic link login |
| phone | text | no | | |
| username | text | no | | Unique; used for password login |
| passwordHash | text | no | | PBKDF2-SHA256 |
| firstName | text | yes | | |
| lastName | text | yes | | |
| organization | text | no | | Manager agency name |
| preferredLang | enum | yes | `en` | `en` or `fr` |
| isActive | bool | yes | true | Inactive users cannot log in |

### 1.7 Athlete

A competitor. Belongs to one edition, optionally linked to a user account and/or a manager.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | UUID | |
| userId | FK→user | no | | Set when athlete self-registers |
| managerId | FK→user | no | | Set when manager registers the athlete |
| editionId | FK→edition | no | | |
| assignedSelector | FK→user | no | | Collaborator responsible for this athlete |
| firstName | text | yes | | |
| lastName | text | yes | | |
| dateOfBirth | date | no | | |
| nationality | FK→country | yes | | ISO country code, autocomplete from Country table |
| gender | enum | yes | | `M` or `F` |
| federation | text | no | | |
| isEap | bool | yes | false | European Athletics Permit member |
| isSwiss | bool | yes | false | |
| distanceFromGva | int | no | 0 | km from Geneva |
| waProfileUrl | url | no | | World Athletics profile |
| swiLicence | text | no | | Swiss Athletics licence number |
| honours | text | no | | |
| eapCity | FK→eap_city | cond. | | **Required when `isEap = true`**; chosen from reference table |
| athleteEmail | email | no | | Direct contact email (especially when managed by a manager) |
| athletePhone | text | no | | Direct phone (especially when managed by a manager) |
| negotiationStatus | enum | yes | `to_review` | See section 3.1 |
| decidedAt | datetime | no | | Set when negotiation reaches confirmed/rejected/withdrawn |
| iRunClean | text | yes | `unknown` | `yes`, `no`, `in_progress`, `unknown` |
| dopingFree | text | yes | `unknown` | `yes`, `no`, `unknown` |
| accommodationReqs | text | no | | Special requests |
| arrivalDate | date | no | | |
| arrivalFlight | text | no | | |
| arrivalFrom | text | no | | |
| arrivalTime | text | no | | |
| departureDate | date | no | | |
| departureFlight | text | no | | |
| departureTo | text | no | | |
| departureTime | text | no | | |
| estTravel | int | no | 0 | Internal cost estimate |
| estAccommodation | int | no | 0 | |
| estAppearance | int | no | 0 | |
| estTotal | int | no | 0 | Computed: travel + accommodation + appearance |
| bankIban | text | no | | Payment |
| paymentStatus | enum | no | `pending` | `pending` or `done` |
| paymentAmount | int | no | | |
| paymentDate | date | no | | |
| paymentMethod | enum | no | | `cash`, `bank`, `western_union`, `paypal`, `other` |
| participantNotes | text | no | | From athlete |
| additionalNotes | text | no | | From athlete |
| internalNotes | text | no | | Staff-only |
| archivedAt | datetime | no | | Soft-delete; archived athletes excluded from all queries |
| updatedBy | FK→user | no | | Last user who edited this record |
| updatedAt | datetime | yes | now | |
| createdAt | datetime | yes | now | |

**Cross-field validation**: if `isEap = true`, then `eapCity` must be non-null. If `eapCity` is being cleared, `isEap` must be `false`.

> `hotelRoomId` removed from athlete — room assignment lives only on the agreement (see 1.9).

### 1.8 Application

One row per athlete per event per edition. Links an athlete to a specific event.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | UUID | |
| athleteId | FK→athlete | yes | | |
| eventId | FK→event | yes | | |
| editionId | FK→edition | yes | | Denormalized; must match `event.editionId` |
| participationStatus | enum | yes | `pending` | See section 3.2 |
| personalBest | real | no | | Working copy, auto-populated from `wa_performance` |
| seasonBest | real | no | | Working copy, auto-populated from `wa_performance` |
| worldRanking | int | no | | Working copy, auto-populated from `wa_performance` |
| score | real | no | | Computed by scoring engine |
| recommendation | text | no | | `Highly Recommended`, `Recommended`, `Under Review`, `Not Recommended` |
| appliedAt | datetime | yes | now | |

> PB/SB/ranking are present as **working copies**. The source of truth is `wa_performance`. When WA performance is updated, these fields are automatically copied and the score is recomputed.
>
> `assignedSelector`, `decidedAt`, logistics, hotel, payment, and notes have been moved to `athlete`.

**Unique constraint**: `(athleteId, eventId, editionId)`

### 1.9 Agreement

One agreement per athlete (not per event). Versioned: each revision increments `version`.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | UUID | |
| athleteId | FK→athlete | yes | | |
| version | int | yes | 1 | Incremented on each new offer |
| direction | enum | yes | | `to_athlete` (organizer sends) or `to_organizer` (counter-offer) |
| appearanceFee | int | yes | 0 | Appearance fee |
| otherCompensation | int | no | 0 | |
| otherCompensationDesc | text | no | | Freetext description |
| transport | int | yes | 0 | International travel reimbursement |
| transportAirportHotel | bool | yes | false | Local shuttle provided? |
| transportHotelStadium | bool | yes | false | Local shuttle provided? |
| hotelRoomId | FK→hotel_room | no | | Room type offered/requested |
| hotelNightTue..Sun | bool | yes | false | 6 columns, one per night |
| dinnerTue..Sun | bool | yes | false | 6 columns, one per night |
| stadiumMeals | bool | yes | false | |
| notes | text | no | | Freetext |
| totalCost | int | yes | 0 | Computed server-side |
| sentBy | FK→user | no | | Who created this version |
| sentAt | datetime | yes | now | |

The `hotelRoomId` on the agreement is the **sole record of room assignment**. The latest agreement version for a confirmed athlete determines their actual room. To change the room, a new agreement version must be issued.

**Total cost formula**:
```
totalCost = appearanceFee + otherCompensation + transport
          + (hotel nights count) × hotelRoom.costPerNight
          + (dinner count)       × hotelRoom.dinnerCost
          + (stadiumMeals ? edition.stadiumMealCost : 0)
          + (transportAirportHotel ? edition.transportAirportHotelCost : 0)
          + (transportHotelStadium ? edition.transportHotelStadiumCost : 0)
```

### 1.10 Hotel

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | text PK | yes | |
| editionId | FK→edition | yes | |
| name | text | yes | e.g. "Hilton Geneva" |

### 1.11 Hotel Room

One row per room type per hotel. Each has its own nightly rate and dinner cost.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | |
| hotelId | FK→hotel | yes | | |
| roomType | text | yes | | e.g. "Single", "Double", "Suite" |
| costPerNight | int | yes | 0 | |
| dinnerCost | int | yes | 0 | Per person per dinner at this hotel |
| reservedRooms | int | yes | 0 | Number of pre-reserved rooms of this type |

### 1.12 WA Performance

Per athlete per event. Source of truth for PB/SB/ranking. When updated, auto-propagates to matching applications and triggers score recomputation.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | UUID | |
| athleteId | FK→athlete | yes | | |
| eventId | FK→event | yes | | |
| personalBest | real | no | | Time in seconds (Course) or distance in meters (Concours) |
| seasonBest | real | no | | Same format as personalBest |
| worldRanking | int | no | | |

**Unique constraint**: `(athleteId, eventId)`

**On upsert**: system automatically copies PB/SB/ranking to matching `application` rows and recomputes scores.

### 1.13 Interaction

Audit log. Primarily at the athlete level, with optional link to a specific application.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | text PK | yes | |
| athleteId | FK→athlete | yes | Primary link |
| applicationId | FK→application | no | Optional — when interaction is event-specific |
| type | enum | yes | `email`, `call`, `note`, `status_change`, `agreement`, `counter_offer` |
| content | text | yes | |
| authorId | FK→user | no | |
| authorName | text | yes | |
| createdAt | datetime | yes | |

### 1.14 Email Log

Persisted email records. Consultable in the admin UI until a real email provider is integrated.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | text PK | yes | UUID |
| to | text | yes | Recipient address |
| subject | text | yes | |
| body | text | yes | |
| lang | enum | yes | `en` or `fr` |
| sentAt | datetime | yes | |
| relatedAthleteId | FK→athlete | no | For traceability |

### 1.15 Session

| Field | Type | Notes |
|-------|------|-------|
| id | text PK | |
| userId | FK→user | |
| token | text UNIQUE | 32 random bytes, base64url |
| expiresAt | datetime | 7 days from creation |

### 1.16 Magic Link

| Field | Type | Notes |
|-------|------|-------|
| id | text PK | |
| userId | FK→user | |
| token | text UNIQUE | 32 random bytes, base64url |
| expiresAt | datetime | 30 minutes from creation |
| used | bool | Single-use; true after verification |
| redirectUrl | text | Post-login redirect target |

---

## 2. Personas

### 2.1 Athlete

An individual competitor. Registers publicly, receives agreement offers, responds, maintains their own record.

**Access**: `role = 'athlete'`
**Login**: magic link sent to `athleteEmail` (no password)
**Scope**: can only see/act on their own athlete record

### 2.2 Manager

An athlete agent or agency representative. Registers athletes in bulk, acts on their behalf.

**Access**: `role = 'manager'`
**Login**: magic link sent to `user.email` (no password)
**Scope**: can see/act on all athletes where `athlete.managerId = user.id`

### 2.3 Collaborator (Selector)

Internal staff responsible for athlete selection and agreement negotiation.

**Access**: `role = 'collaborator'`
**Login**: username + password
**Scope**: can view all applications, manage negotiation/agreements, update athlete data

### 2.4 Committee (Administrator)

Administrative oversight. Full read/write access plus dashboard, event management, and reference table maintenance.

**Access**: `role = 'committee'`
**Login**: username + password
**Scope**: everything collaborator can do, plus: dashboard KPIs, event CRUD, edition configuration (including scoring weights), hotel/room management, reference table maintenance (event catalog, countries, EAP cities)

---

## 3. State Machines

### 3.1 Negotiation Status (athlete-level)

Governs the agreement negotiation between the organization and an athlete. Shared across all of the athlete's events.

```
                              ┌──────────────────────────────────────────────┐
                              │                                              ▼
to_review ──→ agreement_sent ──→ counter_offer_sent ──→ agreement_sent (loop)
    │              │                    │
    │              ├──→ confirmed ──→ withdrawn
    │              ├──→ rejected
    │              └──→ withdrawn
    │
    └──→ rejected
```

| From | To | Triggered by |
|------|----|-------------|
| to_review | agreement_sent | Collaborator sends agreement (**Rule**: all participations must be non-`pending` first — see 3.3) |
| to_review | rejected | Collaborator rejects athlete |
| agreement_sent | confirmed | Athlete/manager accepts |
| agreement_sent | rejected | Athlete/manager or collaborator rejects |
| agreement_sent | counter_offer_sent | Athlete/manager submits counter-offer |
| agreement_sent | withdrawn | Athlete/manager withdraws |
| counter_offer_sent | agreement_sent | Collaborator sends revised offer |
| counter_offer_sent | rejected | Collaborator or athlete/manager rejects |
| counter_offer_sent | withdrawn | Athlete/manager withdraws |
| confirmed | withdrawn | Athlete/manager withdraws |
| rejected | _(terminal)_ | — |
| withdrawn | _(terminal)_ | — |

### 3.2 Participation Status (application-level)

Governs whether an athlete is selected for a specific event. Independent of negotiation.

| From | To | Triggered by |
|------|----|-------------|
| pending | selected | Collaborator/committee selects |
| pending | not_selected | Collaborator/committee deselects |
| selected | not_selected | Collaborator/committee deselects |
| not_selected | selected | Collaborator/committee re-selects |

Reversible — not terminal.

### 3.3 Business Rules

**Agreement precondition**: An agreement cannot be sent to an athlete while any of their applications has `participationStatus = pending`. All events must be decided (selected or not_selected) before the agreement is sent. This check is enforced at send time only — new applications added after the agreement is sent do not retroactively invalidate an existing agreement.

**Counter-offer constraints**: When an athlete submits a counter-offer, the form is pre-filled from the last `to_athlete` agreement. The following rules apply:
- **Dinners, stadium meals, transport booleans**: can only be kept or turned OFF. Cannot turn ON options that were OFF in the organizer's offer.
- **Hotel nights**: can be kept, turned OFF, **or turned ON** (athlete may request additional nights).
- **Monetary fields** (appearanceFee, otherCompensation, transport): can be adjusted to any amount (up or down).
- **Notes**: freetext — the athlete can request anything here (e.g. additional services). The collaborator may include those requests in a subsequent structured agreement, or not.
- The API validates these constraints. Locked fields are visually disabled in the UI.

---

## 4. Workflows by Persona

### 4.1 Athlete Workflows

#### 4.1.1 Self-Registration

**Action**: Submit registration form (public, no login)
**Input**: firstName, lastName, nationality (autocomplete from Country table), gender, athleteEmail (required), eventIds[] (1+), optional: dateOfBirth, federation, isEap, isSwiss, waProfileUrl, swiLicence, iRunClean, dopingFree, eapCity (required if isEap), athletePhone, participantNotes, additionalNotes
**Effects**:
- Creates `athlete` (negotiationStatus = `to_review`, editionId = current)
- Creates one `application` per eventId (participationStatus = `pending`)
- Creates one `interaction` per application ("Application submitted")
- Creates `user` (role = `athlete`) + sends magic link email to athleteEmail (and to manager if exists)
**Response**: athleteId, applicationIds[], magicLinkSent flag

#### 4.1.2 View Athlete Record

**Action**: `GET /portal/athlete`
**Shows**: athlete's personal data, applications with event details (including PB/SB/ranking), agreement history (with `totalCost` hidden), interaction history

#### 4.1.3 Update Athlete Record

**Action**: `PATCH /athletes/:id` (scoped to own record)
**Writable fields**: personal data (name, DOB, nationality, contact info, compliance, notes)
**Effects**: athlete fields updated; `updatedBy` set to current user

#### 4.1.4 Accept Offer

**Action**: `POST /portal/athlete/:athleteId/respond` with `{ action: 'accept' }`
**Precondition**: `negotiationStatus = agreement_sent`
**Effects**:
- `athlete.negotiationStatus` → `confirmed`
- `athlete.decidedAt` set
- `interaction` logged
- Email sent to `edition.notificationEmail`

#### 4.1.5 Reject Offer

**Action**: `POST /portal/athlete/:athleteId/respond` with `{ action: 'reject' }`
**Precondition**: `negotiationStatus = agreement_sent`
**Effects**: same as accept but status → `rejected`

#### 4.1.6 Withdraw

**Action**: `POST /portal/athlete/:athleteId/respond` with `{ action: 'withdraw' }`
**Precondition**: `negotiationStatus` in `agreement_sent`, `counter_offer_sent`, or `confirmed`
**Effects**: same as accept but status → `withdrawn`

#### 4.1.7 Submit Counter-Offer

**Action**: `POST /portal/athlete/:athleteId/respond` with `{ action: 'counter_offer', offer: {...} }`
**Precondition**: `negotiationStatus = agreement_sent`
**Constraints**: see section 3.3 (counter-offer constraints)
**Effects**:
- `athlete.negotiationStatus` → `counter_offer_sent`
- New `agreement` created (direction: `to_organizer`, version incremented, pre-filled from last `to_athlete` agreement)
- `interaction` logged (type: `counter_offer`)
- Email sent to `edition.notificationEmail`

### 4.2 Manager Workflows

#### 4.2.1 Self-Registration

**Action**: `POST /managers/register`
**Input**: firstName, lastName, email, phone, optional organization
**Effects**:
- If email already exists: sends magic link to existing account, returns early
- Otherwise: creates `user` (role = `manager`) + `session`
**Response**: userId, token

#### 4.2.2 Batch Register Athletes

**Action**: `POST /athletes/batch` (requires manager login)
**Input**: `{ athletes: [{ firstName, lastName, dateOfBirth, nationality, gender, isEap?, waProfileUrl?, eventIds[] }] }`
**Effects**: for each athlete entry:
- Creates `athlete` (managerId = current user, editionId = current)
- Creates one `application` per eventId
- Creates one `interaction` per application
- Sends summary email to manager

#### 4.2.3 View Manager Portal

**Action**: `GET /portal/manager`
**Shows**: all athletes where `managerId = currentUser`, with applications, events, agreements, and KPI summary (total, toReview, inNegotiation, confirmed, rejected)

#### 4.2.4 Act on Behalf of Athlete

Manager can perform all athlete actions (4.1.2–4.1.7) for any athlete where `managerId = currentUser`, including viewing and updating athlete records. Same endpoints, same effects.

### 4.3 Collaborator Workflows

#### 4.3.1 View Candidates

**Action**: `GET /applications` with optional filters: `eventId`, `negotiationStatus`, `managerId`, `search`
**Shows**: all applications with athlete details, event details, PB/SB/ranking (from application working copy), score, ordered by score descending

#### 4.3.2 View Application Detail

**Action**: `GET /applications/:id`
**Shows**: full application + athlete + event + all agreements (athlete-level) + interactions + WA performance

#### 4.3.3 Change Negotiation Status

**Action**: `PATCH /athletes/:id/negotiation-status` with `{ status }`
**Precondition**: transition must be valid per section 3.1
**Effects**:
- `athlete.negotiationStatus` updated
- `athlete.decidedAt` set if terminal/confirming
- `interaction` logged
- Email to athlete + manager (if exists)

#### 4.3.4 Send Agreement

**Action**: `POST /athletes/:athleteId/agreements`
**Precondition**: `athlete.negotiationStatus` in `to_review` or `counter_offer_sent`. **All** of the athlete's applications must have `participationStatus ≠ pending`.
**Input**: appearanceFee, otherCompensation, otherCompensationDesc, transport, transportAirportHotel, transportHotelStadium, hotelRoomId, 6× hotelNight bools, 6× dinner bools, stadiumMeals, notes
**Effects**:
- `agreement` created (direction: `to_athlete`, version auto-incremented, totalCost computed)
- `athlete.negotiationStatus` → `agreement_sent`
- `interaction` logged
- Email to athlete (+ manager if exists) with offer summary

#### 4.3.5 Change Participation Status

**Action**: `PATCH /applications/:id/participation-status` with `{ participationStatus }`
**Precondition**: transition must be valid per section 3.2
**Effects**:
- `application.participationStatus` updated
- `interaction` logged

#### 4.3.6 Update Athlete Data

**Action**: `PATCH /athletes/:id`
**Writable fields**: personal data, logistics (arrival/departure, accommodation), cost estimates (estTravel, estAccommodation, estAppearance), internal notes, assigned selector, payment info
**Effects**: fields updated; `estTotal` auto-recomputed if cost estimates change; `updatedBy` set to current user

#### 4.3.7 Add Interaction

**Action**: `POST /athletes/:athleteId/interactions` with `{ type, content, applicationId? }`
**Types**: `email`, `call`, `note`
**Effects**: `interaction` row created at athlete level (optionally linked to application)

#### 4.3.8 Upsert WA Performance

**Action**: `POST /wa-performance` with `{ athleteId, eventId, personalBest?, seasonBest?, worldRanking? }`
**Effects**:
- Creates or updates `wa_performance` row for athlete+event pair
- Auto-copies PB/SB/ranking to matching `application` row
- Auto-recomputes score for that application

#### 4.3.9 Archive Athlete

**Action**: `DELETE /athletes/:id` (soft-delete)
**Effects**: sets `athlete.archivedAt`; athlete and all related data excluded from queries
**Restore**: `POST /athletes/:id/restore` — clears `archivedAt`

### 4.4 Committee Workflows

Committee has all collaborator capabilities (4.3.1–4.3.9), plus:

#### 4.4.1 View Dashboard

**Action**: `GET /dashboard`
**Shows**:
- **Edition info**: name, year, dates, total budget, currency
- **KPIs** (athlete-level, deduplicated):
  - totalAthletes, totalApplications
  - confirmed, inNegotiation (agreement_sent + counter_offer_sent), toReview, rejected, withdrawn
  - budgetCommitted (sum of latest agreement totalCost for confirmed athletes)
  - budgetInNegotiation (same for agreement_sent/counter_offer_sent athletes)
  - budgetRemaining (totalBudget − budgetCommitted)
  - totalPrizeMoney (sum of prizeMoney1st..8th across all edition events — shown separately for planning)
- **Event fill rates** (per event):
  - confirmedFillRate = confirmed selected athletes / maxSlots
  - negotiationFillRate = (confirmed + in-negotiation) selected / maxSlots
  - swissSelected vs swissQuota, eapSelected vs eapQuota
- **Hotel room occupancy** (per hotel room type):
  - confirmedOccupancy = rooms assigned to confirmed athletes / reservedRooms
  - negotiationOccupancy = rooms in agreements for confirmed + in-negotiation athletes / reservedRooms
- **Selector workload** (per collaborator):
  - total assigned athletes, by negotiation status

#### 4.4.2 Create Event

**Action**: `POST /events`
**Input**: catalogId (from Event Catalog), maxSlots, intMinima, swissMinima, eapMinima, meetRecord, targetPerf, quotas, prize money (1st–8th)
**Effects**: `event` row created linked to catalog entry

#### 4.4.3 Update Event

**Action**: `PATCH /events/:id`
**Input**: any subset of event fields (not catalog-level fields)
**Effects**: `event` row updated

#### 4.4.4 Manage Edition Configuration

**Action**: admin UI for edition settings
**Writable fields**: name, year, dates, currency, totalBudget, stadiumMealCost, transportAirportHotelCost, transportHotelStadiumCost, notificationEmail, scoring weights (weightPB, weightSB, weightRanking, weightCost, bonusEap)
**Validation**: weightPB + weightSB + weightRanking + weightCost = 100
**Effects**: `edition` row updated

#### 4.4.5 Manage Hotels / Room Types

**Action**: CRUD on `hotel` and `hotel_room`
**Hotel fields**: name
**Room fields**: hotelId, roomType, costPerNight, dinnerCost, reservedRooms
**Effects**: hotel/hotel_room rows created/updated/deleted

#### 4.4.6 Maintain Reference Tables

**Action**: CRUD on `event_catalog`, `country`, `eap_city`
**Effects**: reference data updated; used in autocomplete and validation throughout the system

#### 4.4.7 View Email Log

**Action**: `GET /emails`
**Shows**: all sent emails with recipient, subject, timestamp, linked athlete

---

## 5. Scoring Engine

Computes a 0–1 score for an application based on WA performance data. Scoring parameters (minima) come from the event configuration. Scoring weights are configurable per edition.

**Input**: eventId (to look up minima/discipline from event+catalog), personalBest, seasonBest, worldRanking, estimatedCostTotal, isEap, isSwiss + edition scoring weights

### 5.1 Performance format

All performance values are numeric `real`:
- **Course** (time events): seconds (e.g. 9.80 for 100m, 206.73 for 1500m = 3:26.73)
- **Concours** (field events): meters (e.g. 2.39 for high jump)

### 5.2 Eligibility

Eligibility is based on **season best (SB)** and depends on the athlete's origin:

```
if athlete.isEap AND event.eapMinima is defined:
    threshold = event.eapMinima
elif athlete.isSwiss:
    threshold = event.swissMinima
else:
    threshold = event.intMinima

eligible = Course: SB ≤ threshold
         | Concours: SB ≥ threshold
```

If ineligible → score = 0, recommendation = "Not Recommended"

### 5.3 Factor computation

Weights are read from the edition configuration. Default values shown.

| Factor | Default weight | Formula |
|--------|---------------|---------|
| f1 (PB) | 25% | Course: `min(1, max(0, 2 − PB/intMinima))`; Concours: `min(1, max(0, 2×(PB/intMinima) − 1))` |
| f2 (SB) | 35% | Same formula as f1, applied to season best |
| f3 (Ranking) | 30% | `max(0, 1 − (ranking − 1) / 50)` — rank 1 = 1.0, rank 51+ = 0.0 |
| f4 (Cost) | 10% | `min(1, max(0, 2 − cost/10000))` — ≤10k = 1.0, ≥20k = 0.0 |
| EAP bonus | +5pp | Added to final score if athlete is EAP member |

The cost factor (f4) uses the athlete-level `estTotal`. This is intentional: the cost reflects athlete-level logistics, not event-specific costs, because the athlete travels once regardless of how many events they compete in.

### 5.4 Final score

```
w1 = edition.weightPB / 100
w2 = edition.weightSB / 100
w3 = edition.weightRanking / 100
w4 = edition.weightCost / 100
eapBonus = edition.bonusEap / 100

weightedSum = f1×w1 + f2×w2 + f3×w3 + f4×w4
finalScore = clamp(0, 1, weightedSum + (isEap ? eapBonus : 0))
```

### 5.5 Recommendation thresholds

| Score range | Recommendation |
|------------|----------------|
| ≥ 0.75 | Highly Recommended |
| ≥ 0.55 | Recommended |
| ≥ 0.35 | Under Review |
| < 0.35 | Not Recommended |

---

## 6. Access Control Matrix

| Endpoint | Athlete | Manager | Collaborator | Committee | Public |
|----------|---------|---------|--------------|-----------|--------|
| POST /athletes (register) | | | | | **W** |
| POST /athletes/batch | | **W** | | | |
| GET /athletes/:id | | | **R** | **R** | |
| PATCH /athletes/:id | **own** | **own athletes** | **W** | **W** | |
| PATCH /athletes/:id/negotiation-status | | | **W** | **W** | |
| DELETE /athletes/:id (archive) | | | | **W** | |
| POST /athletes/:id/restore | | | | **W** | |
| GET /applications | | | **R** | **R** | |
| GET /applications/:id | | | **R** | **R** | |
| PATCH /applications/:id/participation-status | | | **W** | **W** | |
| POST /athletes/:id/interactions | | | **W** | **W** | |
| POST /athletes/:id/agreements | | | **W** | **W** | |
| GET /athletes/:id/agreements | | | **R** | **R** | |
| GET /portal/athlete | **R own** | **R own athletes** | | | |
| POST /portal/athlete/:id/respond | **W own** | **W own athletes** | | | |
| GET /portal/manager | | **R** | | | |
| GET /dashboard | | | | **R** | |
| GET /events | | | | | **R** |
| POST /events | | | | **W** | |
| PATCH /events/:id | | | | **W** | |
| GET /events/:id/confirmed-athletes | | | | | **R** |
| GET /hotels | | | | | **R** |
| CRUD /hotels | | | | **W** | |
| CRUD /hotel-rooms | | | | **W** | |
| POST /wa-performance | | | **W** | **W** | |
| CRUD /event-catalog | | | | **W** | |
| CRUD /countries | | | | **W** | |
| CRUD /eap-cities | | | | **W** | |
| GET /emails | | | | **R** | |
| CRUD /editions | | | | **W** | |
| POST /managers/register | | | | | **W** |
| POST /auth/* | | | | | **W** |
| GET /auth/me | **R** | **R** | **R** | **R** | |

**Legend**: R = read, W = write, "own" = scoped to own records only, blank = forbidden (403)

---

## 7. Email Triggers

Emails are stored in the `email_log` table (see 1.14) and consultable via admin UI. Content is bilingual (en/fr based on recipient's `preferredLang`).

| Trigger | Recipient | Subject | Content |
|---------|-----------|---------|---------|
| Athlete self-registers | athlete + manager (if exists) | "Your login link" | Magic link URL |
| Manager registers (existing email) | manager (user.email) | "Your login link" | Magic link URL |
| Collaborator changes negotiation status | athlete + manager (if exists) | "Application update — {name}" | New status label + portal link |
| Collaborator sends agreement | athlete + manager (if exists) | "Agreement offer — {name}" | Appearance fee, transport, total, portal link |
| Athlete/manager responds | edition.notificationEmail | "Application update — {name}" | Athlete name + action + new status |
| Manager batch registration | manager (user.email) | "Batch registration complete" | List of athletes + event IDs |

---

## 8. Computed Fields & KPIs

### 8.1 Athlete

| Field | Computation |
|-------|------------|
| estTotal | estTravel + estAccommodation + estAppearance |

### 8.2 Application

| Field | Computation |
|-------|------------|
| personalBest | Copied from `wa_performance` on WA upsert |
| seasonBest | Copied from `wa_performance` on WA upsert |
| worldRanking | Copied from `wa_performance` on WA upsert |
| score | Scoring engine (section 5), auto-recomputed on WA upsert |
| recommendation | Scoring engine thresholds (section 5.5) |

### 8.3 Agreement

| Field | Computation |
|-------|------------|
| totalCost | Formula in section 1.9 |
| version | max(existing versions for athlete) + 1 |

### 8.4 Dashboard KPIs

| KPI | Computation |
|-----|------------|
| totalAthletes | count of non-archived athletes in current edition |
| confirmed | athletes with negotiationStatus = `confirmed` |
| inNegotiation | athletes with negotiationStatus in `agreement_sent`, `counter_offer_sent` |
| toReview | athletes with negotiationStatus = `to_review` |
| budgetCommitted | sum of latest agreement totalCost for confirmed athletes |
| budgetInNegotiation | sum of latest agreement totalCost for in-negotiation athletes |
| budgetRemaining | edition.totalBudget − budgetCommitted |
| totalPrizeMoney | sum of prizeMoney1st..8th across all edition events (separate planning KPI) |
| confirmedFillRate (per event) | confirmed selected / maxSlots |
| negotiationFillRate (per event) | (confirmed + in-negotiation) selected / maxSlots |
| confirmedOccupancy (per room type) | rooms assigned to confirmed / reservedRooms |
| negotiationOccupancy (per room type) | rooms for confirmed + in-negotiation / reservedRooms |

---

## 9. Authentication

| Method | For roles | Flow |
|--------|-----------|------|
| Username + password | collaborator, committee | POST /auth/login |
| Magic link (email) | athlete, manager | POST /auth/identify → email sent → click link → POST /auth/verify-magic-link |

- Sessions expire after 7 days
- Magic links expire after 30 minutes, single-use
- Password hashing: PBKDF2-SHA256, 100k iterations

---

## 10. Internationalization

**Languages**: English (en), French (fr)
**Storage**: `user.preferredLang` + `localStorage('lang')`
**Scope**: all UI labels, status names, form fields, email content
**Currency**: displayed dynamically from `edition.currency`

---

## 11. Known Limitations

1. **WA Performance is manual** — PB/SB/ranking must be entered by collaborators. No automated import from World Athletics yet.
2. **Single edition** — the system always uses `LIMIT 1` on the edition table. Multi-edition support is not implemented.
3. **No file uploads** — no passport photos, signed agreements, or PDF exports.
4. **Agreement totalCost is visible to collaborators/committee but hidden from athletes/managers** in the portal.
