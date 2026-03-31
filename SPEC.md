# Atletica Geneve — Functional Specification

> **Purpose**: Single source of truth for the tool's data model, personas, workflows, and business rules. The client annotates this document ("section 3.2: change X to Y") and hands it back for implementation. No retro-compatibility required; the DB can be recreated from scratch.

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
| totalBudget | int | yes | 250,000 | CHF |
| dinnerCostPp | int | yes | 80 | CHF per dinner per person |
| stadiumMealCost | int | yes | 30 | CHF flat per athlete |
| transportAirportHotelCost | int | yes | 50 | CHF per trip |
| transportHotelStadiumCost | int | yes | 30 | CHF per trip |

### 1.2 Event

An athletic discipline within an edition (e.g. "100m Men").

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | slug | e.g. `100m-m` |
| editionId | FK→edition | yes | | |
| name | text | yes | | |
| discipline | text | yes | | e.g. "Sprint", "Jumps" |
| gender | enum | yes | | `M` or `F` |
| perfType | enum | yes | | `MIN` (time) or `MAX` (distance/height) |
| maxSlots | int | yes | 8 | Maximum athletes in final |
| intMinima | real | yes | | International qualification standard |
| swissMinima | real | yes | | Swiss qualification standard |
| eapMinima | real | no | | EAP qualification standard |
| meetRecord | text | no | | |
| targetPerf | text | no | | |
| swissQuota | int | yes | 1 | Reserved slots for Swiss athletes |
| eapQuota | int | yes | 1 | Reserved slots for EAP athletes |
| prize1st/2nd/3rd | int | no | 0 | CHF |

### 1.3 User

All human actors in the system. Role determines access.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | UUID | |
| role | enum | yes | | `athlete`, `manager`, `collaborator`, `committee` |
| email | text | no | | Unique (partial index); used for magic link login |
| phone | text | no | | |
| username | text | no | | Unique (partial index); used for password login |
| passwordHash | text | no | | PBKDF2-SHA256 (or bcrypt for legacy seed) |
| firstName | text | yes | | |
| lastName | text | yes | | |
| organization | text | no | | Manager agency name |
| preferredLang | enum | yes | `en` | `en` or `fr` |
| isActive | bool | yes | true | Inactive users cannot log in |

### 1.4 Athlete

A competitor. Belongs to one edition, optionally linked to a user account and/or a manager.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | UUID | |
| userId | FK→user | no | | Set when athlete self-registers |
| managerId | FK→user | no | | Set when manager registers the athlete |
| editionId | FK→edition | no | | |
| firstName | text | yes | | |
| lastName | text | yes | | |
| dateOfBirth | date | no | | |
| nationality | text(2-3) | yes | | ISO country code |
| gender | enum | yes | | `M` or `F` |
| federation | text | no | | |
| isEap | bool | yes | false | European Athletics Permit member |
| isSwiss | bool | yes | false | |
| distanceFromGva | int | no | 0 | km from Geneva |
| waProfileUrl | url | no | | World Athletics profile |
| swiLicence | text | no | | Swiss Athletics licence number |
| honours | text | no | | |
| eapCity | text | no | | |
| athleteEmail | email | no | | Direct contact email |
| athletePhone | text | no | | |
| negotiationStatus | enum | yes | `to_review` | See section 3.1 |
| iRunClean | text | yes | `unknown` | `yes`, `no`, `in_progress`, `unknown` |
| dopingFree | text | yes | `unknown` | `yes`, `no`, `unknown` |

### 1.5 Application

One row per athlete per event per edition. Links an athlete to a specific event.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | UUID | |
| athleteId | FK→athlete | yes | | |
| eventId | FK→event | yes | | |
| editionId | FK→edition | yes | | |
| assignedSelector | FK→user | no | | Collaborator responsible |
| status | enum | yes | `to_review` | Legacy mirror of `athlete.negotiationStatus` |
| participationStatus | enum | yes | `pending` | See section 3.2 |
| personalBest | text | no | | Legacy; now in `wa_performance` |
| personalBestVal | real | no | | Legacy; now in `wa_performance` |
| seasonBest | text | no | | Legacy; now in `wa_performance` |
| seasonBestVal | real | no | | Legacy; now in `wa_performance` |
| worldRanking | int | no | | Legacy; now in `wa_performance` |
| estTravel | int | no | 0 | Internal cost estimate (CHF) |
| estAccommodation | int | no | 0 | |
| estAppearance | int | no | 0 | |
| estTotal | int | no | 0 | Computed: travel + accommodation + appearance |
| score | real | no | | Computed by scoring engine |
| recommendation | text | no | | `Highly Recommended`, `Recommended`, `Under Review`, `Not Recommended` |
| hotelId | FK→hotel | no | | Logistics |
| roomNumber | text | no | | |
| accommodationReqs | text | no | | |
| arrival/departure fields | text | no | | date, flight, from/to, time |
| iRunClean | text | no | `unknown` | Legacy; now on athlete |
| dopingFree | text | no | `unknown` | Legacy; now on athlete |
| participantNotes | text | no | | From athlete |
| additionalNotes | text | no | | From athlete |
| internalNotes | text | no | | Staff-only |
| bankIban | text | no | | Payment |
| paymentStatus | enum | no | `pending` | `pending` or `done` |
| paymentAmount | int | no | | |
| paymentDate | date | no | | |
| paymentMethod | enum | no | | `cash`, `bank`, `western_union`, `paypal`, `other` |
| appliedAt | datetime | yes | now | |
| decidedAt | datetime | no | | Set on accept/reject/withdraw |

**Unique constraint**: `(athleteId, eventId, editionId)`

### 1.6 Contract Offer

One contract per athlete (not per event). Versioned: each revision increments `version`.

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | text PK | yes | UUID | |
| athleteId | FK→athlete | no | | Athlete-level contract |
| applicationId | FK→application | yes | | Legacy back-reference |
| version | int | yes | 1 | Incremented on each new offer |
| direction | enum | yes | | `to_athlete` (organizer sends) or `to_organizer` (counter-offer) |
| bonus | int | yes | 0 | CHF appearance fee |
| otherCompensation | int | no | 0 | CHF |
| otherCompensationDesc | text | no | | Freetext description |
| transport | int | yes | 0 | CHF international travel reimbursement |
| transportAirportHotel | bool | yes | false | Local shuttle provided? |
| transportHotelStadium | bool | yes | false | Local shuttle provided? |
| hotelId | FK→hotel | no | | Which hotel |
| hotelNightTue..Sun | bool | yes | false | 6 columns, one per night |
| dinnerTue..Sun | bool | yes | false | 6 columns, one per night |
| stadiumMeals | bool | yes | false | |
| notes | text | no | | Freetext |
| totalCost | int | yes | 0 | Computed server-side |
| sentBy | FK→user | no | | Who created this version |
| sentAt | datetime | yes | now | |

**Total cost formula**:
```
totalCost = bonus + otherCompensation + transport
          + (hotel nights count) × hotel.costPerNight
          + (dinner count)       × edition.dinnerCostPp
          + (stadiumMeals ? edition.stadiumMealCost : 0)
          + (transportAirportHotel ? edition.transportAirportHotelCost : 0)
          + (transportHotelStadium ? edition.transportHotelStadiumCost : 0)
```

### 1.7 Hotel

| Field | Type | Required | Default |
|-------|------|----------|---------|
| id | text PK | yes | |
| editionId | FK→edition | yes | |
| name | text | yes | |
| roomTypes | text (JSON) | no | |
| costPerNight | int | yes | 0 |
| totalRooms | int | yes | 0 |

### 1.8 WA Performance

Per athlete per event. Source of truth for PB/SB/ranking (replaces legacy fields on application).

| Field | Type | Required | Default |
|-------|------|----------|---------|
| id | text PK | yes | UUID |
| athleteId | FK→athlete | yes | |
| eventId | FK→event | yes | |
| personalBest | text | no | Display string (e.g. "9.80") |
| personalBestVal | real | no | Numeric for comparison |
| seasonBest | text | no | |
| seasonBestVal | real | no | |
| worldRanking | int | no | |

**Unique constraint**: `(athleteId, eventId)`

### 1.9 Interaction

Audit log attached to an application.

| Field | Type | Required |
|-------|------|----------|
| id | text PK | yes |
| applicationId | FK→application | yes |
| type | enum | yes — `email`, `call`, `note`, `status_change`, `contract`, `counter_offer` |
| content | text | yes |
| authorId | FK→user | no |
| authorName | text | yes |

### 1.10 Session

| Field | Type | Notes |
|-------|------|-------|
| id | text PK | |
| userId | FK→user | |
| token | text UNIQUE | 32 random bytes, base64url |
| expiresAt | datetime | 7 days from creation |

### 1.11 Magic Link

| Field | Type | Notes |
|-------|------|-------|
| id | text PK | |
| userId | FK→user | |
| token | text UNIQUE | 32 random bytes, base64url |
| expiresAt | datetime | 30 minutes from creation |
| used | bool | Single-use; true after verification |
| redirectUrl | text | Post-login redirect target |

### 1.12 Other tables (unused in primary workflows)

- **meal_option**: per-edition meal config (day, type, venue, cost, capacity)
- **meal_booking**: links application to meal_option (unique per pair)

---

## 2. Personas

### 2.1 Athlete

An individual competitor. Registers publicly, receives contract offers, responds.

**Access**: `role = 'athlete'`
**Login**: magic link sent to `athleteEmail` (no password)
**Scope**: can only see/act on their own athlete record(s)

### 2.2 Manager

An athlete agent or agency representative. Registers athletes in bulk, acts on their behalf.

**Access**: `role = 'manager'`
**Login**: magic link sent to `user.email` (no password)
**Scope**: can see/act on all athletes where `athlete.managerId = user.id`

### 2.3 Collaborator (Selector)

Internal staff responsible for athlete selection and contract negotiation.

**Access**: `role = 'collaborator'`
**Login**: username + password
**Scope**: can view all applications, manage negotiation/contracts, update logistics

### 2.4 Committee

Administrative oversight. Full read/write access plus dashboard and event management.

**Access**: `role = 'committee'`
**Login**: username + password
**Scope**: everything collaborator can do, plus dashboard KPIs, event CRUD, and event-level quotas

---

## 3. State Machines

### 3.1 Negotiation Status (athlete-level)

Governs the contract negotiation between the organization and an athlete. Shared across all of the athlete's events.

```
                         ┌──────────────────────────────────────┐
                         │                                      ▼
to_review ──→ contract_sent ──→ counter_offer ──→ contract_sent (loop)
    │              │                  │
    │              ├──→ accepted ──→ withdrawn
    │              ├──→ rejected
    │              └──→ withdrawn
    │
    └──→ rejected
```

| From | To | Triggered by |
|------|----|-------------|
| to_review | contract_sent | Collaborator sends contract offer |
| to_review | rejected | Collaborator rejects athlete |
| contract_sent | accepted | Athlete/manager accepts |
| contract_sent | rejected | Athlete/manager or collaborator rejects |
| contract_sent | counter_offer | Athlete/manager submits counter-offer |
| contract_sent | withdrawn | Athlete/manager withdraws |
| counter_offer | contract_sent | Collaborator sends revised offer |
| counter_offer | rejected | Collaborator or athlete/manager rejects |
| counter_offer | withdrawn | Athlete/manager withdraws |
| accepted | withdrawn | Athlete/manager withdraws |
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

---

## 4. Workflows by Persona

### 4.1 Athlete Workflows

#### 4.1.1 Self-Registration

**Action**: Submit registration form (public, no login)
**Input**: firstName, lastName, nationality, gender, athleteEmail (required), eventIds[] (1+), optional: dateOfBirth, federation, isEap, isSwiss, waProfileUrl, swiLicence, iRunClean, dopingFree, participantNotes, additionalNotes
**Effects**:
- Creates `athlete` (negotiationStatus = `to_review`, editionId = current)
- Creates one `application` per eventId (participationStatus = `pending`)
- Creates one `interaction` per application ("Application submitted")
- Creates `user` (role = `athlete`) + sends magic link email to athleteEmail
**Response**: athleteId, applicationIds[], magicLinkSent flag

#### 4.1.2 View Portal

**Action**: `GET /portal/athlete`
**Shows**: all athlete records where `userId = currentUser` or `managerId = currentUser`; for each: applications with event details, contract history (with `totalCost` hidden)

#### 4.1.3 Accept Offer

**Action**: `POST /portal/athlete/:athleteId/respond` with `{ action: 'accept' }`
**Precondition**: `negotiationStatus = contract_sent`
**Effects**:
- `athlete.negotiationStatus` → `accepted`
- All `application.status` → `accepted`, `decidedAt` set
- `interaction` logged per application
- Email sent to `collaborators@atleticageneve.ch`

#### 4.1.4 Reject Offer

**Action**: `POST /portal/athlete/:athleteId/respond` with `{ action: 'reject' }`
**Precondition**: `negotiationStatus = contract_sent`
**Effects**: same as accept but status → `rejected`

#### 4.1.5 Withdraw

**Action**: `POST /portal/athlete/:athleteId/respond` with `{ action: 'withdraw' }`
**Precondition**: `negotiationStatus` in `contract_sent`, `counter_offer`, or `accepted`
**Effects**: same as accept but status → `withdrawn`

#### 4.1.6 Submit Counter-Offer

**Action**: `POST /portal/athlete/:athleteId/respond` with `{ action: 'counter_offer', offer: {...} }`
**Precondition**: `negotiationStatus = contract_sent`
**Effects**:
- `athlete.negotiationStatus` → `counter_offer`
- New `contract_offer` created (direction: `to_organizer`, version incremented)
- `interaction` logged per application (type: `counter_offer`)
- Email sent to `collaborators@atleticageneve.ch`

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
**Shows**: all athletes where `managerId = currentUser`, with applications, events, contracts, and KPI summary (total, toReview, inNegotiation, confirmed, rejected)

#### 4.2.4 Act on Behalf of Athlete

Manager can perform all athlete actions (4.1.3–4.1.6) for any athlete where `managerId = currentUser`. Same endpoint, same effects.

### 4.3 Collaborator Workflows

#### 4.3.1 View Candidates

**Action**: `GET /applications` with optional filters: `eventId`, `status`, `managerId`, `search`
**Shows**: all applications with athlete details, event details, WA performance data, ordered by score descending

#### 4.3.2 View Application Detail

**Action**: `GET /applications/:id`
**Shows**: full application + athlete + event + all contracts (athlete-level) + interactions + WA performance

#### 4.3.3 Change Negotiation Status

**Action**: `PATCH /applications/:id/status` with `{ status }`
**Precondition**: transition must be valid per section 3.1
**Effects**:
- `athlete.negotiationStatus` updated
- `application.status` updated (legacy mirror)
- `application.decidedAt` set if terminal/accepting
- `interaction` logged
- Email to athlete + manager (if exists)

#### 4.3.4 Send Contract Offer

**Action**: `POST /athletes/:athleteId/contracts`
**Precondition**: `athlete.negotiationStatus` in `to_review` or `counter_offer`
**Input**: bonus, otherCompensation, otherCompensationDesc, transport, transportAirportHotel, transportHotelStadium, hotelId, 6× hotelNight bools, 6× dinner bools, stadiumMeals, notes
**Effects**:
- `contract_offer` created (direction: `to_athlete`, version auto-incremented, totalCost computed)
- `athlete.negotiationStatus` → `contract_sent`
- `interaction` logged
- Email to athlete with offer summary

#### 4.3.5 Change Participation Status

**Action**: `PATCH /applications/:id/participation-status` with `{ participationStatus }`
**Precondition**: transition must be valid per section 3.2
**Effects**:
- `application.participationStatus` updated
- `interaction` logged

#### 4.3.6 Update Application Fields

**Action**: `PATCH /applications/:id`
**Writable fields**: internalNotes, assignedSelector, hotelId, roomNumber, accommodationReqs, arrival/departure logistics, estTravel, estAccommodation, estAppearance
**Effects**: fields updated; `estTotal` auto-recomputed if cost estimates change

#### 4.3.7 Add Interaction

**Action**: `POST /applications/:id/interactions` with `{ type, content }`
**Types**: `email`, `call`, `note`
**Effects**: `interaction` row created

#### 4.3.8 Re-Compute Score

**Action**: `POST /applications/:id/score`
**Effects**: reads WA performance for athlete+event; if data exists, runs scoring engine (see section 5); updates `application.score` and `application.recommendation`

#### 4.3.9 Upsert WA Performance

**Action**: `POST /wa-performance` with `{ athleteId, eventId, personalBest?, personalBestVal?, seasonBest?, seasonBestVal?, worldRanking? }`
**Effects**: creates or updates `wa_performance` row for athlete+event pair

#### 4.3.10 View WA Performance

**Action**: `GET /wa-performance?athleteId=X`
**Shows**: all performance records for athlete, with event details

#### 4.3.11 Update Athlete Data

**Action**: `PATCH /athletes/:id`
**Writable fields**: all personal data (name, DOB, nationality, gender, federation, flags, contact, compliance)
**Access**: collaborator, committee, athlete owner, or manager

### 4.4 Committee Workflows

Committee has all collaborator capabilities (4.3.1–4.3.11), plus:

#### 4.4.1 View Dashboard

**Action**: `GET /dashboard`
**Shows**:
- **Edition info**: name, year, dates, total budget
- **KPIs** (athlete-level, deduplicated):
  - totalAthletes, totalApplications
  - confirmed (accepted), inNegotiation (contract_sent + counter_offer), toReview, rejected, withdrawn
  - budgetCommitted (sum of latest contract totalCost for accepted athletes)
  - budgetInNegotiation (same for contract_sent/counter_offer athletes)
  - budgetRemaining (totalBudget − budgetCommitted)
- **Event fill rates** (per event):
  - selected, pending, notSelected counts
  - fillRate = selected / maxSlots
  - swissSelected vs swissQuota, eapSelected vs eapQuota
- **Selector workload** (per collaborator):
  - total assigned athletes, by negotiation status

#### 4.4.2 Create Event

**Action**: `POST /events`
**Input**: eventConfigSchema (name, discipline, gender, perfType, maxSlots, minima, quotas, prizes)
**Effects**: `event` row created

#### 4.4.3 Update Event

**Action**: `PATCH /events/:id`
**Input**: any subset of eventConfigSchema fields
**Effects**: `event` row updated

---

## 5. Scoring Engine

Computes a 0–1 score for an application based on WA performance data.

**Input**: eventId, personalBest, seasonBest, swissMinima, worldRanking, estimatedCostTotal, isEap

### 5.1 Performance parsing

`"3:26.73"` → 206.73 (minutes×60 + seconds)
`"9.80"` → 9.80
`"2.39m"` → 2.39

### 5.2 Eligibility

PB must meet Swiss minima:
- MIN events (time): PB ≤ swissMinima
- MAX events (distance/height): PB ≥ swissMinima

If ineligible → score = 0, recommendation = "Not Recommended"

### 5.3 Factor computation

| Factor | Weight | Formula |
|--------|--------|---------|
| f1 (PB) | 0.35 | MIN: `min(1, max(0, 2 − PB/intMinima))`; MAX: `min(1, max(0, 2×(PB/intMinima) − 1))` |
| f2 (SB) | 0.25 | Same formula as f1, applied to season best |
| f3 (Ranking) | 0.30 | `max(0, 1 − (ranking − 1) / 50)` — rank 1 = 1.0, rank 51+ = 0.0 |
| f5 (Cost) | 0.10 | `min(1, max(0, 2 − cost/10000))` — ≤CHF 10k = 1.0, ≥CHF 20k = 0.0 |
| q (EAP) | +0.05 | Bonus if athlete is EAP member |

### 5.4 Final score

```
weightedSum = f1×0.35 + f2×0.25 + f3×0.30 + f5×0.10
finalScore = clamp(0, 1, weightedSum + q)
```

### 5.5 Recommendation thresholds

| Score range | Recommendation |
|------------|----------------|
| ≥ 0.75 | Highly Recommended |
| ≥ 0.55 | Recommended |
| ≥ 0.35 | Under Review |
| < 0.35 | Not Recommended |

### 5.6 Limitation

The scoring engine only works for events whose ID is in a hardcoded `EVENT_META` map (7 events). Events created via the API but not in this map receive `eligible: false, finalScore: 0`.

---

## 6. Access Control Matrix

| Endpoint | Athlete | Manager | Collaborator | Committee | Public |
|----------|---------|---------|--------------|-----------|--------|
| POST /athletes (register) | | | | | **W** |
| POST /athletes/batch | | **W** | | | |
| GET /athletes/:id | | | | | **R** |
| PATCH /athletes/:id | **own** | **own athletes** | **W** | **W** | |
| GET /applications | | | **R** | **R** | |
| GET /applications/:id | | | **R** | **R** | |
| PATCH /applications/:id | | | **W** | **W** | |
| PATCH /applications/:id/status | | | **W** | **W** | |
| PATCH /applications/:id/participation-status | | | **W** | **W** | |
| POST /applications/:id/score | | | **W** | **W** | |
| POST /applications/:id/interactions | | | **W** | **W** | |
| POST /athletes/:athleteId/contracts | | | **W** | **W** | |
| GET /athletes/:athleteId/contracts | | | **R** | **R** | |
| GET /portal/athlete | **R own** | **R own athletes** | | | |
| POST /portal/athlete/:id/respond | **W own** | **W own athletes** | | | |
| GET /portal/manager | | **R** | | | |
| GET /dashboard | | | | **R** | |
| GET /events | | | | | **R** |
| GET /events/:id | | | | | **R** |
| GET /events/:id/confirmed-athletes | | | | | **R** |
| POST /events | | | | **W** | |
| PATCH /events/:id | | | | **W** | |
| GET /hotels | | | | | **R** |
| GET /wa-performance | | | **R** | **R** | |
| POST /wa-performance | | | **W** | **W** | |
| POST /managers/register | | | | | **W** |
| POST /auth/* | | | | | **W** |
| GET /auth/me | **R** | **R** | **R** | **R** | |
| GET /dashboard | | | | **R** | |
| GET /editions/current | | | | | **R** |

**Legend**: R = read, W = write, "own" = scoped to own records only, blank = forbidden (403)

---

## 7. Email Triggers

All emails are currently logged in-memory (stub). Content is bilingual (en/fr based on recipient's `preferredLang`).

| Trigger | Recipient | Subject | Content |
|---------|-----------|---------|---------|
| Athlete self-registers | athlete (athleteEmail) | "Your login link" | Magic link URL |
| Manager registers (existing email) | manager (user.email) | "Your login link" | Magic link URL |
| Collaborator changes negotiation status | athlete (athleteEmail) | "Application update — {name}" | New status label + portal link |
| Collaborator changes negotiation status | manager (user.email) | "Application update — {name}" | Same as above |
| Collaborator sends contract offer | athlete (athleteEmail) | "Contract offer — {name}" | Bonus, transport, total, portal link |
| Athlete/manager responds (accept/reject/withdraw/counter) | collaborators@atleticageneve.ch | "Application update — {name}" | Athlete name + action + new status |
| Manager batch registration | manager (user.email) | "Batch registration complete" | List of athletes + event IDs |

---

## 8. Computed Fields & KPIs

### 8.1 Application

| Field | Computation |
|-------|------------|
| estTotal | estTravel + estAccommodation + estAppearance |
| score | Scoring engine (section 5) |
| recommendation | Scoring engine thresholds (section 5.5) |

### 8.2 Contract Offer

| Field | Computation |
|-------|------------|
| totalCost | Formula in section 1.6 |
| version | max(existing versions for athlete) + 1 |

### 8.3 Dashboard KPIs

| KPI | Computation |
|-----|------------|
| totalAthletes | count of athletes in current edition |
| confirmed | athletes with negotiationStatus = `accepted` |
| inNegotiation | athletes with negotiationStatus in `contract_sent`, `counter_offer` |
| toReview | athletes with negotiationStatus = `to_review` |
| budgetCommitted | sum of latest contract totalCost for accepted athletes |
| budgetInNegotiation | sum of latest contract totalCost for in-negotiation athletes |
| budgetRemaining | edition.totalBudget − budgetCommitted |
| fillRate (per event) | selected applications / event.maxSlots |

---

## 9. Authentication

| Method | For roles | Flow |
|--------|-----------|------|
| Username + password | collaborator, committee | POST /auth/login or /auth/login-with-password |
| Magic link (email) | athlete, manager | POST /auth/identify → email sent → click link → POST /auth/verify-magic-link |

- Sessions expire after 7 days
- Magic links expire after 30 minutes, single-use
- Password hashing: PBKDF2-SHA256, 100k iterations

---

## 10. Internationalization

**Languages**: English (en), French (fr)
**Storage**: `user.preferredLang` + `localStorage('lang')`
**Scope**: all UI labels, status names, form fields, email content

---

## 11. Known Limitations & Open Questions

1. **Scoring only works for 7 hardcoded events** — events created via the API don't have scoring metadata. Should the scoring parameters come from the event config instead?
2. **WA Performance is manual** — PB/SB/ranking must be entered by collaborators. No automated import from World Athletics.
3. **Legacy fields remain in DB** — SQLite cannot DROP COLUMN. Fields like `application.status`, `application.iRunClean`, `contract_offer.catering`, `contract_offer.localTransport` are unused but still present.
4. **Single edition** — the system always uses `LIMIT 1` on the edition table. Multi-edition support is not implemented.
5. **Email is a stub** — all emails are logged in-memory, not actually sent. Needs a real email provider integration.
6. **No file uploads** — no passport photos, signed contracts, or PDF exports.
7. **meal_option / meal_booking tables exist** but are not used in any workflow.
8. **No admin UI for edition costs or hotels** — these are only configurable via seed data or direct DB access.
9. **Contract totalCost is visible to collaborators/committee but hidden from athletes/managers** in the portal API.
