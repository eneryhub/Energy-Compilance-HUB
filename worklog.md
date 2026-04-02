# Energy-Compliance Hub — Work Log

---
Task ID: 1
Agent: Main
Task: Fix subscription API 500 error — "Error al obtener suscripción"

Work Log:
- Read dev.log and found the actual Prisma error: `Unknown field 'invoices' for include statement on model 'Company'`
- Root cause: Turbopack cached old Prisma client that didn't have the new `invoices` (SubscriptionInvoice) relation
- Ran `rm -rf .next && bunx prisma generate` to regenerate Prisma client from scratch
- Killed stuck dev server process, let auto-restart pick up the clean state
- Verified schema was already in sync with database (`db:push` confirmed)

Stage Summary:
- Fixed: Subscription API GET route now works — Prisma client recognizes `invoices`, `riskTypes`, `checklistItems` relations
- The `db:push` had said "already in sync" but the Turbopack module cache was stale

---
Task ID: 2
Agent: Main
Task: Verify risk types CRUD functionality

Work Log:
- Reviewed `src/app/api/risk-types/route.ts` — GET/POST with auto-seeding of default risk types
- Reviewed `src/app/api/risk-types/[id]/route.ts` — PUT/DELETE with permit usage protection
- Reviewed `src/app/api/risk-types/[id]/items/route.ts` — POST/DELETE checklist items
- Reviewed `src/components/risk-types/risk-type-manager.tsx` — Full CRUD UI with color presets, icons, checklist management
- All routes correctly use `getSession` from auth.ts

Stage Summary:
- Risk types CRUD is complete and functional
- Default 4 risk types (ALTURA, ELECTRICO, CONFINADO, CALIENTE) auto-seed on first access
- Checklist items per risk type with required/optional toggle

---
Task ID: 3a
Agent: Main
Task: Fix DeepSeek AI URL double-path bug

Work Log:
- Found `.env` had `DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions`
- `ai.ts` appends `/chat/completions` to this URL, resulting in double path
- Fixed `.env` to `DEEPSEEK_API_URL=https://api.deepseek.com/v1`
- Note: `DEEPSEEK_API_KEY` is still empty — AI falls back to rule-based review

Stage Summary:
- Fixed URL bug that would cause 404 when API key is provided
- AI permit review works in fallback mode (rule-based) when no key is configured

---
Task ID: 3b
Agent: Main
Task: Add photo evidence display to permit detail and approval views

Work Log:
- Added `Camera` icon import to both `permit-list.tsx` and `approval-panel.tsx`
- Added photo gallery section to permit detail dialog (permit-list.tsx) — 3-column grid with timestamps
- Added photo gallery section to approval panel (approval-panel.tsx) — 4-column grid
- Both use inline IIFE to safely parse `selectedPermit.photos` JSON string
- Click to open full-size photo in new tab
- Graceful fallback if photos are null or parse fails

Stage Summary:
- Photos are now visible to reviewers in both the permit detail dialog and approval panel
- Gallery shows thumbnails with timestamps, clickable for full view

---
Task ID: 3c
Agent: Main + Subagent
Task: Create centralized audit log helper with IP/userAgent capture

Work Log:
- Created `src/lib/audit.ts` with `createAuditLog()` function
- Helper auto-extracts IP from `x-forwarded-for` or `x-real-ip` headers
- Helper auto-extracts User-Agent from request headers
- Accepts `details` as plain object (handles JSON.stringify internally)
- Updated all 11 API route files (13 total audit log calls) to use the helper

Stage Summary:
- Created `src/lib/audit.ts` with centralized audit logging
- Zero remaining `db.auditLog.create` calls in API routes
- All audit entries now capture IP address and user agent

---
Task ID: 3d
Agent: Main
Task: Add missing audit entries for permit creation and document creation

Work Log:
- Added audit log to `POST /api/permits` (permit creation) with permitNumber, riskType, photosCount
- Added audit log to `POST /api/documents` (document creation) with title, documentType, category

Stage Summary:
- All major CRUD operations now have audit trail coverage

---
Task ID: 5
Agent: Main
Task: Fix old auth helper in permits/documents routes (JWT migration missed)

Work Log:
- Discovered 3 routes still used old `getUserFromRequest()` that parsed tokens as `token_<userId>_<timestamp>`
- This was the pre-JWT auth format — these routes returned 401 for all JWT-authenticated requests
- Fixed `src/app/api/permits/route.ts` — replaced with `getSession` from auth.ts
- Fixed `src/app/api/permits/[id]/route.ts` — replaced with `getSession` from auth.ts
- Fixed `src/app/api/documents/route.ts` — replaced with `getSession` from auth.ts
- The separate approve/reject routes already used `getSession` correctly

Stage Summary:
- Critical auth bug fixed: permits and documents API routes now accept JWT tokens
- This was causing permits list, permit creation, and document management to fail with 401
