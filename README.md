# Last-Mile Delivery Tracker

A delivery management platform where customers/admins create orders with
auto-calculated charges, agents are auto-assigned, and customers get
notified at every step.

Stack: **Node.js + Express + Prisma + PostgreSQL** (backend), **React + Vite**
(frontend), **JWT** role-based auth (customer / delivery agent / admin),
**Nodemailer** for email notifications.

See [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) for the rate engine, zone
detection, auto-assignment, and failed-delivery design write-up.

---

## 1. Setup Guide

### Prerequisites
- Node.js 18+
- A PostgreSQL database (local, Docker, or a free-tier host like Neon/Supabase/Railway)
- (Optional) an SMTP account for real emails — without one, emails are logged to the console instead of failing

### Backend

```bash
cd backend
cp .env.example .env      # then edit DATABASE_URL, JWT_SECRET, SMTP_* as needed
npm install
npm run prisma:migrate    # creates tables from prisma/schema.prisma
npm run seed              # creates sample admin/agents/customer/zones/rate cards
npm run dev                # http://localhost:5000
```

Seeded logins (all share password `password123`):
| Role | Email |
|---|---|
| Admin | admin@lastmile.test |
| Agent (North zone) | agent.north@lastmile.test |
| Agent (South zone) | agent.south@lastmile.test |
| Customer | customer@lastmile.test |

### Frontend

```bash
cd frontend
cp .env.example .env      # VITE_API_BASE_URL, defaults to http://localhost:5000/api
npm install
npm run dev                # http://localhost:5173
```

### Deploying
- **Backend**: Render / Railway (Node service) + a managed Postgres add-on. Set the same env vars as `.env.example`. Run `npm run prisma:migrate` (or `prisma migrate deploy`) once against the production DB, then `npm run seed` if you want sample data.
- **Frontend**: Vercel/Netlify (static Vite build). Set `VITE_API_BASE_URL` to your deployed backend's `/api` URL, and set the backend's `CLIENT_ORIGIN` to the deployed frontend URL for CORS.

---

## 2. Database Schema

| Model | Purpose |
|---|---|
| `User` | Customers, agents, admins. Agents carry `isAvailable` + `homeZoneId` for assignment. |
| `Zone` | A named service region (e.g. "North Zone"). |
| `Area` | A pincode/locality mapped to exactly one `Zone` — this mapping is how the system "detects" a zone from an address. |
| `RateCard` | Admin-configurable price per `(orderType, zoneRelation)`, optionally overridden per exact zone pair. Holds `baseCharge` + `perKgRate`. |
| `CodConfig` | Admin-configurable COD surcharge per `orderType`, as `FLAT` ₹ or `PERCENT`. |
| `Order` | The order itself: addresses, dimensions/weights, computed charges, current `status`, `agentId`. |
| `OrderStatusHistory` | **Append-only** log of every status change with timestamp + actor — the immutable tracking timeline. |
| `Notification` | Record of every email sent (or attempted), for audit purposes. |

Full field-level detail is in [`backend/prisma/schema.prisma`](./backend/prisma/schema.prisma).

## 3. Rate Calculation Logic (summary)

```
volumetricWeight = (L × B × H) / 5000
chargeableWeight = max(actualWeight, volumetricWeight)
zoneRelation     = pickupZone == dropZone ? INTRA : INTER
rateCard         = lookup(orderType, zoneRelation)        # admin-configured, no hardcoding
baseCharge       = rateCard.baseCharge + rateCard.perKgRate × chargeableWeight
codSurcharge     = paymentType == COD ? lookup(CodConfig, orderType) applied to baseCharge : 0
total            = baseCharge + codSurcharge
```
See `backend/src/utils/rateEngine.js` for the implementation and
`SYSTEM_DESIGN.md` for the full rationale.

## 4. API Reference

All endpoints are prefixed `/api`. Authenticated routes require
`Authorization: Bearer <token>`.

### Auth
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Register as a customer |
| POST | `/auth/login` | public | Log in, returns JWT |
| GET | `/auth/me` | any | Current user profile |

### Zones & Areas
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/zones` | any | List zones (+ their areas) |
| POST | `/zones` | admin | Create a zone |
| PATCH/DELETE | `/zones/:id` | admin | Update/delete a zone |
| GET | `/areas` | any | List areas (+ zone) |
| POST | `/areas` | admin | Map a pincode/area to a zone |
| PATCH/DELETE | `/areas/:id` | admin | Update/delete an area mapping |

### Rate Cards & COD Config
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/rate-cards` | admin | List rate cards |
| POST | `/rate-cards` | admin | Create/update a rate card (upsert on orderType+zoneRelation+zone pair) |
| DELETE | `/rate-cards/:id` | admin | Delete a rate card |
| GET | `/cod-config` | admin | List COD surcharge configs |
| POST | `/cod-config` | admin | Create/update COD surcharge for an order type |

### Orders
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/orders/quote` | customer/admin | Price preview — no DB write |
| POST | `/orders` | customer/admin | Create order (admin may pass `customerId` to create on behalf of a customer) |
| GET | `/orders` | any | List orders, scoped to own orders for customer/agent; admin can filter by `?status=&zoneId=&agentId=` |
| GET | `/orders/:id` | owner/admin | Full order + immutable status timeline |
| PATCH | `/orders/:id/status` | agent/admin | Advance status (agent constrained to valid transitions; admin can override to any status) |
| POST | `/orders/:id/reschedule` | customer/admin | Reschedule a `FAILED` order; re-triggers auto-assignment |
| PATCH | `/orders/:id/assign` | admin | Manually assign/reassign an agent |

### Agents
| Method | Path | Role | Description |
|---|---|---|---|
| PATCH | `/agents/me/availability` | agent | Toggle own availability |
| GET | `/agents` | admin | List all agents + availability/zone |

### Admin
| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/admin/users` | admin | Create an AGENT or ADMIN account |
| GET | `/admin/users` | admin | List users, optional `?role=` filter |

## 5. Notes on Design Choices
- **No hardcoded prices**: every rate figure comes from `RateCard`/`CodConfig`; an order without a configured card is rejected rather than silently priced.
- **Quote before confirm**: `/orders/quote` runs the identical pricing pipeline as order creation but never persists, so the UI can show the exact charge before the customer commits.
- **Immutable history**: `OrderStatusHistory` rows are only ever inserted, never updated/deleted, giving a true audit trail.
- **Auto-assignment fallback chain**: pickup-zone agent → drop-zone agent → any available agent → left unassigned for admin — so orders are never silently dropped.
