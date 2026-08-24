# System Design Write-Up

## Rate Calculation Engine

The engine (`backend/src/utils/rateEngine.js`) is a pure pipeline with no
hardcoded prices — every number it uses is read from the database at request
time, so admins can change pricing without a deploy.

**Steps for every order:**
1. **Zone detection** — the pickup/drop `Area` records (pincode + name) are
   looked up, and each carries a `zoneId` that admin assigned. This is how
   "detect pickup and drop zones" is implemented without needing live
   geocoding: admin pre-maps serviceable pincodes to zones once, and every
   order after that is a simple foreign-key lookup.
2. **Volumetric weight** = `(L × B × H) / 5000`, computed from the
   customer-entered dimensions.
3. **Chargeable weight** = `max(actualWeight, volumetricWeight)` — billing is
   always on the higher figure, per the spec.
4. **Zone relation** — `INTRA` if pickup zone == drop zone, else `INTER`.
5. **Rate card lookup** — a `RateCard` row is matched on
   `(orderType, zoneRelation)`. The schema also supports an optional
   zone-pair-specific override (`zoneFromId`/`zoneToId`) for lanes that need
   custom pricing (e.g. a premium metro-to-metro rate), which is tried first;
   the general default card is the fallback. If no card exists, the order is
   rejected with an explicit error rather than silently guessing a price.
6. **Base charge** = `rateCard.baseCharge + rateCard.perKgRate × chargeableWeight`.
7. **COD surcharge** — looked up from `CodConfig` per `orderType`, applied as
   either a flat amount or a percentage of the base charge, and is `0` for
   prepaid orders.
8. **Total** = `baseCharge + codSurcharge`.

A `/orders/quote` endpoint runs this exact pipeline without writing to the
database, so the frontend can show the customer the full breakdown *before*
they confirm. `/orders` (create) re-runs the same pipeline server-side rather
than trusting a client-supplied price, so the persisted charge can't be
tampered with in transit.

## Zone Detection Approach

Rather than integrating a paid geocoding API, zone detection is modelled as an
admin-owned lookup table: `Zone` (a named service region) has many `Area`
rows (a pincode + locality name). This mirrors how most Indian logistics
companies actually operate — zones are serviceability boundaries drawn by
ops teams, not raw lat/long polygons — and it keeps the whole flow
admin-configurable with zero hardcoding, satisfying the requirement directly.
If real geocoding were added later, only `getRateCard`'s two zone-id inputs
would need to change; the rest of the pipeline is agnostic to how a zone id
was derived.

## Auto-Assignment Logic

`backend/src/utils/assignment.js` models "nearest available agent" at zone
granularity, since there's no live GPS feed in scope. Each `AGENT` user has a
`homeZoneId` (their base service area) and an `isAvailable` flag. On order
creation (and again on reschedule), `findBestAgent` tries, in order:

1. An available agent whose home zone matches the **pickup** zone (most
   relevant — they're closest to where the parcel starts).
2. An available agent whose home zone matches the **drop** zone (covers the
   other end of the lane).
2. Any other available agent, system-wide — a fallback so orders aren't
   permanently stuck if the local zone has nobody free.

If nobody is available, the order simply stays `CREATED`/`RESCHEDULED`
unassigned, and appears in the admin's unassigned-orders view for manual
assignment. Assignment is done inside a Prisma transaction: the order is
updated to `ASSIGNED`, the agent's `isAvailable` flips to `false`, and an
immutable `OrderStatusHistory` row is appended — all three changes commit
atomically so an agent can never be double-booked by a race between two
requests.

Agents are released back into the available pool (`releaseAgent`) whenever an
order reaches a terminal state for them: `DELIVERED` or `FAILED`.

## Order Status Lifecycle & Failed Delivery Handling

Status transitions are enforced by a small state machine
(`VALID_TRANSITIONS` in `orderController.js`):
`CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED`,
with `FAILED` reachable from any active state, and `FAILED → RESCHEDULED →
ASSIGNED` closing the loop. Delivery agents can only move an order along this
graph; admins can override to any status directly (for exception handling),
and every override is tagged in the history with `actorRole: ADMIN` so it's
auditable.

Every transition — whether made by an agent, a customer reschedule, an
auto-assignment, or an admin override — inserts a new row into
`OrderStatusHistory` rather than mutating one. This table is never updated or
deleted from the application layer, giving a genuinely immutable audit trail
with a timestamp and the acting user on every entry — this is the "full
tracking timeline" customers see and what auditors would use to reconstruct
exactly what happened and who did it.

On a `FAILED` update, the agent is released and the customer receives an
email; they can then call `/orders/:id/reschedule` with a new date, which
sets status to `RESCHEDULED`, clears the previous agent, records a history
entry, and re-runs `findBestAgent` for the new attempt — reusing the exact
same assignment logic as the original order.
