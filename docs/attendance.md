# Attendance (MVP)

Geofenced clock-in/out, manager reporting lines, weekly schedules, and a month calendar.

## Concepts

- **Sites** — named locations with lat/lng + radius (meters) and an IANA timezone. Clock punches must be inside the radius (Haversine on the server).
- **Reporting line** — `Membership.managerId` points at another membership in the same tenant. Managers approve their direct reports; owners/admins (with `attendance.approve` + `members.update`) can approve anyone.
- **Schedules** — per-member weekday templates (`startMinutes` / `endMinutes`). Used to compute late and early-leave minutes on punch.
- **Records** — `OPEN` while clocked in, `PENDING` after clock-out, then `APPROVED` / `REJECTED`.

## Permissions

| Key | Who (defaults) |
|-----|----------------|
| `attendance.read` | member, manager, admin, owner |
| `attendance.clock` | member, manager, admin, owner |
| `attendance.sites.manage` | admin, owner |
| `attendance.schedules.manage` | manager, admin, owner |
| `attendance.approve` | manager, admin, owner |
| `attendance.team.read` | manager, admin, owner |

After deploying new permissions, run `yarn db:seed` (or call `syncSystemRolePermissions`) so existing system roles receive the new keys.

## Demo (Acme)

After `yarn db:seed`:

- Sites: **Acme HQ** (Monas, Jakarta ≈ `-6.175392, 106.827153`, 200m) and **Acme Remote Hub**.
- Maya Manager is Mike Member’s manager; Mike has Mon–Fri 09:00–18:00 at HQ and a seeded **PENDING** record for Maya to approve.

Clock-in locally with GPS spoofing or a device near those coordinates.

## Non-goals (MVP)

Biometrics, offline sync, payroll export, multi-level approvals, auto clock-out jobs, native mobile apps.
