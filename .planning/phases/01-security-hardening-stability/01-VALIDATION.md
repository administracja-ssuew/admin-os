---
phase: 1
slug: security-hardening-stability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — all verification is manual curl + browser |
| **Config file** | none |
| **Quick run command** | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/notifications` |
| **Full suite command** | Manual smoke test checklist (see Manual-Only Verifications) |
| **Estimated runtime** | ~5 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Manual curl check against affected endpoint
- **After every plan wave:** Full smoke test checklist
- **Before `/gsd:verify-work`:** All manual verification items must pass
- **Max feedback latency:** 5 minutes (manual)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | SEC-06 | manual | `grep -n "SUPABASE_SERVICE_ROLE_KEY" app/api/notifications/route.ts` | ✅ | ⬜ pending |
| 01-01-02 | 01 | 1 | SEC-05 | manual | `grep -n "CRON_SECRET" app/api/notifications/deadline-check/route.ts` | ✅ | ⬜ pending |
| 01-02-01 | 02 | 1 | SEC-03 | manual | `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/notifications/external` | ✅ | ⬜ pending |
| 01-03-01 | 03 | 1 | SEC-02 | manual | `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/notifications` | ✅ | ⬜ pending |
| 01-04-01 | 04 | 2 | SEC-04 | manual | Supabase dashboard RLS policy inspection | ❌ manual | ⬜ pending |
| 01-05-01 | 05 | 2 | SEC-01 | manual | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/scores` (expect 302) | ✅ | ⬜ pending |
| 01-06-01 | 06 | 2 | STAB-01 | manual | `grep -rn "case_number" app/wniosek/page.tsx` | ✅ | ⬜ pending |
| 01-06-02 | 06 | 2 | STAB-02 | manual | Supabase dashboard constraint inspection | ❌ manual | ⬜ pending |
| 01-06-03 | 06 | 2 | STAB-03 | manual | `grep -n "removeChannel" components/NotificationBell.tsx` | ✅ | ⬜ pending |
| 01-06-04 | 06 | 2 | STAB-04 | manual | Code review of mutation handlers | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no test framework needed for this phase. All verification is via curl, grep, and browser smoke tests.

*Existing infrastructure (curl, grep) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RLS policy blocks anon INSERT on notifications | SEC-04 | Supabase RLS not inspectable via grep | Check Supabase dashboard → Table Editor → notifications → RLS policies |
| UNIQUE(department_id) constraint on department_notes | STAB-02 | DB constraint not in source code | Check Supabase dashboard → Table Editor → department_notes → constraints |
| /wniosek form still submits successfully after endpoint split | SEC-03 | Requires full browser flow | Submit the public /wniosek form; confirm notification appears in Supabase |
| /scores redirects unauthenticated users | SEC-01 | Requires cookie-based session | Open http://localhost:3000/scores in incognito; confirm redirect |
| /executive redirects unauthenticated users | SEC-01 | Requires cookie-based session | Open http://localhost:3000/executive in incognito; confirm redirect |
| Silent mutation errors now show toast | STAB-04 | UI behavior | Trigger a failed CRUD in my-department; confirm toast appears |

---

## Validation Sign-Off

- [ ] All tasks have grep or curl verify or marked manual
- [ ] Sampling continuity: every plan has at least one verification step
- [ ] No watch-mode flags
- [ ] `nyquist_compliant: true` set in frontmatter when all verifications pass

**Approval:** pending
