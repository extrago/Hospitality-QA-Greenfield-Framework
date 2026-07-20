# L1 / L2 Technical Support Playbook
## Digital Hospitality Platform — QA & Support Alignment Guide

**Version**: 2.0.0 | **Maintained by**: QA Automation & L2 Support Engineering
**Last Reviewed**: July 2026 | **Classification**: Internal Use Only

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Support Tier Definitions](#2-support-tier-definitions)
3. [SLA Metrics & Response Commitments](#3-sla-metrics--response-commitments)
4. [Incident Priority Classification](#4-incident-priority-classification)
5. [Ticket Escalation Workflow](#5-ticket-escalation-workflow)
6. [Writing Reproducible Steps for Engineering](#6-writing-reproducible-steps-for-engineering)
7. [Common Defect Patterns & First-Response Runbooks](#7-common-defect-patterns--first-response-runbooks)
8. [AI-Assisted Triage Tool — Usage Guide](#8-ai-assisted-triage-tool--usage-guide)
9. [QA Regression Handoff Protocol](#9-qa-regression-handoff-protocol)
10. [Communication Templates](#10-communication-templates)
11. [Escalation Contacts & On-Call Roster](#11-escalation-contacts--on-call-roster)

---

## 1. Purpose & Scope

This playbook defines the operating procedures for L1 and L2 Technical Support Engineers responsible for the digital hospitality platform. It governs:

- How incoming tickets are triaged, prioritised, and escalated.
- SLA commitments and breach-prevention protocols.
- Standards for writing engineering-grade reproducible defect reports.
- How the AI-powered triage tooling bridges support observations and QA regression automation.

**Out of scope**: Infrastructure on-call procedures (see the SRE Runbook), billing disputes (see Finance SOP-117), and content moderation (see Trust & Safety Policy).

---

## 2. Support Tier Definitions

| Tier | Team | Responsibilities |
|------|------|-----------------|
| **L1** | Customer-facing support agents | First contact, account queries, guided troubleshooting, password resets, booking modifications within agent authority, FAQ resolution. |
| **L2** | Technical Support Engineers | Deep dive into platform bugs, data investigations, log analysis, escalation to Engineering with a fully documented defect report. Operate the AI Triage Tool. |
| **L3** | Engineering (Backend / Frontend / Infra) | Code-level fixes, database corrections, hotfixes, post-incident RCA sign-off. |
| **L4** | Principal Engineers / CTO | Architecture decisions resulting from systemic incidents (P0 only). |

---

## 3. SLA Metrics & Response Commitments

### 3.1 Response SLAs

| Priority | First Response (L1) | L2 Escalation | Engineering Acknowledgement | Resolution Target |
|----------|--------------------|--------------|-----------------------------|-------------------|
| **P0 — Critical (Production Down)** | 5 minutes | 15 minutes | 30 minutes | 4 hours |
| **P1 — Critical (Revenue Impact)** | 15 minutes | 30 minutes | 1 hour | 8 hours |
| **P2 — High (Core Feature Degraded)** | 1 hour | 4 hours | 8 hours | 24 hours |
| **P3 — Medium (Non-Critical Defect)** | 4 hours | 1 business day | 2 business days | 5 business days |
| **P4 — Low (Enhancement / Cosmetic)** | 1 business day | — | 1 week | Next planned sprint |

### 3.2 SLA Breach Escalation Protocol

When an SLA is at risk of breach, the following automated and manual escalations must occur:

1. **T-minus 20% of SLA window**: Assignee is notified via PagerDuty alert.
2. **T-minus 10% of SLA window**: Team Lead is notified. Ticket is tagged `sla-at-risk`.
3. **SLA breach**: Engineering Manager and affected client Account Manager are notified. An incident review is scheduled within 48 hours.

> **Never manually suppress an SLA breach notification.** All breaches are reviewed in the weekly incident retrospective.

### 3.3 Key Performance Indicators (KPIs)

| KPI | Target | Measurement Period |
|-----|--------|--------------------|
| First Response Compliance | ≥ 98% | Monthly |
| Resolution Within SLA | ≥ 95% | Monthly |
| Escalation Accuracy (L2→L3 that result in confirmed bugs) | ≥ 80% | Quarterly |
| Mean Time to Resolution (MTTR) — P1 | < 6 hours | Monthly |
| Customer Satisfaction (CSAT) — Post-Resolution | ≥ 4.5 / 5 | Monthly |
| Defect Recurrence Rate (same root cause, 90-day window) | < 5% | Quarterly |

---

## 4. Incident Priority Classification

Use the following criteria to assign priority at first contact. **When in doubt, escalate the priority** — it is always safer to downgrade than to underestimate impact.

### P0 — Critical: System Outage

**Criteria**: The platform is completely inaccessible for all users in a region or globally. Core infrastructure is down.

**Indicators**:
- Status page automated monitors triggered.
- Multiple unrelated clients reporting the same issue simultaneously.
- Payment processing endpoint returning 5xx for all requests.

**Immediate Action**: Trigger the Major Incident process. Notify the on-call SRE immediately. Do not wait for ticket confirmation.

---

### P1 — Critical: Revenue or Data Integrity Impact

**Criteria**: A core revenue-generating feature is broken or user data may be corrupted. The issue is reproducible and widespread.

**Indicators**:
- Booking confirmation failures affecting multiple users.
- Payment charges succeeding but bookings not being created.
- Guest personal data visible to wrong user sessions.
- Search returning zero results for all queries after a deployment.

**Immediate Action**: Escalate to L2 within 15 minutes. L2 must begin investigation immediately and produce an initial impact assessment within 30 minutes.

---

### P2 — High: Core Feature Degraded

**Criteria**: A key feature is not working correctly for a subset of users, but the platform remains functional and workarounds exist.

**Indicators**:
- Search results showing for some destinations but not others.
- Email confirmations delayed but eventually delivered.
- A specific payment method type failing while others succeed.

---

### P3 — Medium: Non-Critical Defect

**Criteria**: A defect that impacts user experience but does not block a core workflow.

**Indicators**:
- UI layout issues on specific devices.
- Incorrect currency symbol displayed (while the amount is correct).
- A filter option not persisting on page refresh.

---

### P4 — Low: Cosmetic / Enhancement

**Criteria**: Visual defects, typos, minor UX friction, or feature requests.

---

## 5. Ticket Escalation Workflow

```
┌───────────────────────────────────────────────────────────────────┐
│                      Ticket Lifecycle                             │
│                                                                   │
│  Customer Report                                                  │
│       │                                                           │
│       ▼                                                           │
│  ┌─────────┐  Resolved?  ─── YES ──►  Close Ticket               │
│  │   L1    │                           Send CSAT Survey           │
│  │ Triage  │                                                      │
│  └─────────┘                                                      │
│       │ NO — Needs Technical Investigation                        │
│       ▼                                                           │
│  ┌─────────────────────────────────────────────┐                  │
│  │   L2 Technical Triage                        │                  │
│  │                                              │                  │
│  │  1. Reproduce the issue                     │                  │
│  │  2. Check logs / monitoring dashboards      │                  │
│  │  3. Run AI Triage Tool (ai-ticket-triage.ts)│                  │
│  │  4. Determine: Known issue or new defect?   │                  │
│  └─────────────────────────────────────────────┘                  │
│       │                    │                                       │
│  KNOWN ISSUE           NEW DEFECT                                  │
│       │                    │                                       │
│       ▼                    ▼                                       │
│  Apply Known Fix     Create Defect Report                          │
│  or Workaround       (see Section 6)                               │
│       │                    │                                       │
│       ▼                    ▼                                       │
│  Resolved?         Escalate to L3/Engineering                      │
│    YES ─► Close    with FULL artifact package                      │
│    NO  ─► L3                                                       │
│                           │                                        │
│                           ▼                                        │
│               L3 Engineers investigate,                            │
│               create fix, deploy hotfix                            │
│                           │                                        │
│                           ▼                                        │
│               QA validates fix in staging                          │
│               Regression test added to suite                       │
│                           │                                        │
│                           ▼                                        │
│               Ticket resolved. PIR (Post Incident                  │
│               Review) scheduled for P0/P1                          │
└───────────────────────────────────────────────────────────────────┘
```

### 5.1 Required Artefacts Before L2 → L3 Escalation

**Do not escalate to L3/Engineering without the following items attached to the ticket.** Incomplete escalations will be returned to L2.

- [ ] **Environment details**: Browser, OS, device, app version, deployment tag if known.
- [ ] **Numbered, verbatim reproducible steps** (see Section 6).
- [ ] **Observed vs expected behaviour** (clearly separated).
- [ ] **Impact scope**: Number of affected users, client names, revenue estimate.
- [ ] **Time of onset**: Exact UTC timestamp when the issue began, correlated with any deployments.
- [ ] **Log excerpts**: Relevant error lines from browser console, API gateway logs, or backend logs. Include timestamps.
- [ ] **Network trace**: HAR file or screenshot of network tab showing failing requests with status codes and response bodies.
- [ ] **Screenshots or screen recording**: Annotated to highlight the problem area.
- [ ] **AI Triage Tool output**: The prompt and response from `ai-ticket-triage.ts` (see Section 8).
- [ ] **Attempted workarounds**: List everything that was tried and whether it helped.

---

## 6. Writing Reproducible Steps for Engineering

This is the most critical skill for an L2 engineer. Vague reports waste engineering time. Follow the standard below rigorously.

### 6.1 The Golden Rules

1. **Write steps a robot could follow.** Every step must be an unambiguous action on a specific UI element or API endpoint.
2. **One action per step.** Do not combine multiple actions into one step.
3. **Include data inputs.** If you type something, include the exact text you typed. If you use a test card number, include the full number.
4. **State the starting condition.** The first step must define the exact initial state (e.g., "Logged in as qa.automation@hospitality-platform.com on Chrome 126, incognito mode").
5. **Separate observed from expected.** Never mix these together.
6. **Include negative confirmation.** State what you verified does NOT happen as well as what does.

### 6.2 Step Quality Checklist

Before submitting a defect report, verify each step passes this checklist:

| # | Criterion | Example of Bad Practice | Example of Good Practice |
|---|-----------|------------------------|--------------------------|
| 1 | Is the step atomic? | "Fill in guest details and pay" | Step 4: In the "First Name" field, type: `Alexandra`. Step 5: In the "Last Name" field, type: `Harrison`. |
| 2 | Is the element identified? | "Click the button" | "Click the **Confirm Booking** button (below the order summary panel)" |
| 3 | Is data specified exactly? | "Enter a Visa card" | "In the Card Number field, enter: `4111 1111 1111 1111`" |
| 4 | Is the URL included? | "Go to the search page" | "Navigate to `https://app.hospitality-platform.com/search`" |
| 5 | Is the starting state defined? | "Log in and search" | "Step 1: Navigate to `https://app.hospitality-platform.com` (not logged in, incognito mode, Chrome 126 on Windows 11)" |

### 6.3 Defect Report Template

```markdown
**DEFECT SUMMARY**
[One sentence: What is broken, where, and what impact does it have?]

**ENVIRONMENT**
- Browser: [Chrome 126 / Firefox 128 / Safari 17.4 / Edge 125]
- OS: [Windows 11 / macOS 14.5 / iOS 17 / Android 14]
- App Version / Deploy Tag: [v2.14.3 / commit: a3f8bc2]
- Environment: [Production / Staging / UAT]
- Account / User: [qa.automation@hospitality-platform.com / Enterprise: Atoll Resorts Group]

**PRECONDITIONS**
[State that must exist before Step 1. E.g., "User is NOT logged in." or "Hotel HTL-001 has at least 1 available room."]

**STEPS TO REPRODUCE**
1. Navigate to `[exact URL]`.
2. [Exact action on exact element].
3. [Enter exact value into exact field].
...

**OBSERVED RESULT**
[Precise description of what happened, including exact error messages, URLs, and status codes.]

**EXPECTED RESULT**
[Precise description of what should have happened according to the product specification or intuition.]

**FREQUENCY**
[Always / Intermittent (X of Y attempts) / Once]

**IMPACT**
- Affected users: [number or "all users in condition X"]
- Revenue impact: [USD amount if known]
- Severity: [Blocker / Major / Minor / Cosmetic]

**EVIDENCE**
- [ ] Screenshot attached: `[filename.png]`
- [ ] Screen recording attached: `[filename.mp4]`
- [ ] HAR file attached: `[filename.har]`
- [ ] Browser console log attached: `[filename.txt]`
- [ ] AI Triage output attached: `[triage-output.md]`

**WORKAROUND**
[Description of any workaround found, or "None identified."]
```

---

## 7. Common Defect Patterns & First-Response Runbooks

### 7.1 Booking Confirmation Page Fails to Load

**Symptoms**: Blank white page on `/confirmation`, empty `?ref=` parameter, redirect loop.

**First-Response Checklist**:
1. Check the deployment log for releases within the last 2 hours.
2. Inspect browser console for JavaScript errors, particularly `Cannot read properties of undefined`.
3. Retrieve the Network HAR: look for the POST to `/api/v1/bookings` — check the response body for `bookingReference`.
4. Attempt to reproduce in Firefox (separate rendering engine isolates frontend vs backend root cause).
5. Check the API gateway metrics dashboard for 5xx error rate spike on the bookings endpoint.
6. If the API is returning 200 but with a malformed body (missing `bookingReference`), the issue is backend. Escalate to L3-Backend.
7. If the API returns a correct body but the page still fails, the issue is frontend. Escalate to L3-Frontend.

---

### 7.2 Search Returns Zero Results (Post-Deployment)

**Symptoms**: Search form submits successfully, but the results page shows 0 hotels.

**First-Response Checklist**:
1. Confirm the issue affects all destinations or specific ones only.
2. Call `GET /api/v1/hotels/search?lat=4.1755&lng=73.5093&radius=50` directly via curl or the triage tool.
3. Check if the Elasticsearch / search index service is healthy on the monitoring dashboard.
4. Check for any recently merged changes to search parameter validation (the API may now be rejecting previously valid requests silently with 200 and an empty array).
5. Verify with a known good staging dataset.

---

### 7.3 Payment Successful but Booking Not Created

**Symptoms**: Customer's card is charged, but no booking reference is generated and no confirmation email is received.

**Severity**: This is always a **P1** regardless of the number of users affected.

**First-Response Checklist**:
1. Immediately alert the Finance team to hold any refund processing pending investigation.
2. Retrieve the payment gateway transaction ID from the customer.
3. Cross-reference the transaction ID in the payment provider dashboard (Stripe / Adyen).
4. Search the bookings service log for the corresponding order ID.
5. If the booking record was partially created, note the booking ID and state for L3.
6. Do NOT manually modify database records. Request L3 database team intervention.

---

### 7.4 Session Expiry During Checkout

**Symptoms**: User is redirected to the login page mid-checkout, losing form data.

**First-Response Checklist**:
1. Check the session token TTL configuration in the authentication service.
2. Verify whether the checkout page extends the session on user activity (heartbeat requests).
3. Confirm if the issue occurs for all users or only those who opened the browser before a configuration change.
4. As a workaround: advise the user to ensure they are on a stable network and to complete checkout within 10 minutes.

---

## 8. AI-Assisted Triage Tool — Usage Guide

The AI Triage Tool (`support-tools/ai-ticket-triage.ts`) accelerates L2 investigation by:

1. **Parsing** the raw ticket text into a structured data model.
2. **Building** an optimised, context-rich prompt for a Large Language Model.
3. **Optionally calling** the Gemini or Claude API to generate an RCA and automated test case scaffold.

### 8.1 Prerequisites

```bash
# Ensure Node.js 20+ and npm 10+ are installed
node --version
npm --version

# Install framework dependencies
npm install

# Copy .env.example to .env and fill in your LLM_API_KEY
cp .env.example .env
```

### 8.2 Running the Tool

```bash
# Dry run — prints the optimised prompt without calling the LLM
npm run triage

# Process a specific ticket file
npx ts-node support-tools/ai-ticket-triage.ts --ticket ./my-ticket.txt

# Send to the LLM API (requires LLM_API_KEY in .env)
npx ts-node support-tools/ai-ticket-triage.ts --send

# Send to LLM and save the output to a file
npx ts-node support-tools/ai-ticket-triage.ts --send --output ./triage-output.md
```

### 8.3 Interpreting the Output

The LLM response will contain six sections:
1. **Executive Summary** — Share this with clients and Product Managers.
2. **Root Cause Analysis** — Use these hypotheses to guide your investigation.
3. **Immediate Mitigation Steps** — Actions to reduce customer impact right now.
4. **Escalation Checklist** — Data to collect before escalating to L3.
5. **Automated Regression Test Case** — Hand this to the QA team for immediate suite addition.
6. **Post-Incident Recommendations** — Include these in the Post-Incident Review document.

### 8.4 Prompt Quality Tips

- The more complete the ticket, the better the LLM analysis. Ensure all sections of the defect template (Section 6.3) are filled in before running the triage tool.
- Include exact error messages, URLs, and status codes in the ticket text — the LLM uses this verbatim data to generate accurate test cases.
- Review the generated test case before committing it. The LLM output is a scaffold; a QA engineer must validate and adapt it to the actual application locators.

---

## 9. QA Regression Handoff Protocol

When a defect is confirmed and fixed by Engineering, the following steps ensure it is permanently covered by automated regression.

### 9.1 QA Handoff Checklist

- [ ] The defect ticket contains numbered reproducible steps (Section 6 standard).
- [ ] The AI Triage Tool was run and the generated test case scaffold is attached to the ticket.
- [ ] A QA engineer has reviewed the AI-generated test case against actual application locators.
- [ ] The test case has been implemented in the appropriate spec file (`tests/e2e/` or `tests/api/`).
- [ ] The test fails on the unfixed codebase and passes on the fix branch (proving it catches the regression).
- [ ] The test has been merged to `main` and is running in CI.
- [ ] The ticket is updated with a link to the merged pull request.
- [ ] The fix has been verified in the staging environment by the L2 engineer who reported it.

### 9.2 Naming Convention for Regression Tests

All regression tests that originate from a support ticket must include the ticket ID in their test name:

```typescript
test('TC-REG-SUP2847 — Booking confirmation renders correctly after payment [SUP-2847]', async ({ page }) => {
  // ...
});
```

This allows the CI failure report to be traced directly back to the original ticket.

---

## 10. Communication Templates

### 10.1 Initial P1 Client Communication (Send within 15 minutes)

```
Subject: [INVESTIGATING] Issue with [Feature Name] — [Client Name]

Dear [Client Name],

We are aware of and actively investigating an issue affecting [brief description of 
the problem]. Our technical team has been engaged and is working to identify the 
root cause.

Current Status: Investigating
Affected Functionality: [Booking Confirmation / Search / Payment]
Impact: [Number of users affected]
Next Update: Within [30] minutes

We sincerely apologise for the disruption. We will provide updates every [30] 
minutes until resolution.

[Support Engineer Name]
Technical Support — Hospitality Platform
```

### 10.2 Resolution Communication

```
Subject: [RESOLVED] Issue with [Feature Name] — [Client Name]

Dear [Client Name],

We are pleased to confirm that the issue affecting [feature] has been resolved as 
of [HH:MM UTC].

Root Cause: [One-sentence non-technical summary]
Resolution: [Brief description of the fix applied]
Duration: [From HH:MM UTC to HH:MM UTC — X hours Y minutes]

To prevent this from occurring again, our engineering team has [brief description 
of preventive measure, e.g., "added automated monitoring" or "deployed an 
additional validation check"].

If you experience any further issues, please do not hesitate to contact us.

[Support Engineer Name]
Technical Support — Hospitality Platform
```

---

## 11. Escalation Contacts & On-Call Roster

| Role | Escalation Method | Availability |
|------|------------------|--------------|
| L2 Support Lead | Slack: `#l2-support` / PagerDuty: L2-On-Call | 24/7 |
| L3 Backend Engineering | PagerDuty: Backend-On-Call | 24/7 (P0/P1 only) |
| L3 Frontend Engineering | Slack: `#engineering-frontend` / PagerDuty: Frontend-On-Call | Business hours + P0/P1 24/7 |
| L3 Infrastructure / SRE | PagerDuty: SRE-On-Call | 24/7 |
| Payment Systems Lead | Direct: payments-lead@hospitality-platform.com | Business hours + P1 on-call |
| Security Response | security@hospitality-platform.com / PagerDuty: Security-On-Call | 24/7 (Data breach only) |
| Engineering Manager | Slack direct message | Business hours + P0 24/7 |

> **For P0 incidents**: Call the on-call mobile number listed in PagerDuty. Do not rely solely on Slack.

---

*This document is reviewed quarterly by the QA Automation Team and L2 Support Lead. Suggested improvements should be raised as a pull request to this repository.*
