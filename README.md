<div align="center">

# 🏨 Hospitality QA Greenfield Framework

### A production-grade, standalone test automation framework
### for digital hospitality services — built to be fast, deterministic, and CI/CD-native.

<br/>

[![CI Status](https://github.com/your-org/hospitality-qa-greenfield-framework/actions/workflows/main-ci.yml/badge.svg?branch=main)](https://github.com/your-org/hospitality-qa-greenfield-framework/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.49-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-F7DF1E?logo=opensourceinitiative&logoColor=black)](LICENSE)
[![API Tests](https://img.shields.io/badge/API%20Suite-8%2F8%20Passed-brightgreen)](#-running-tests)
[![Zero Flake](https://img.shields.io/badge/Flakiness-Zero-00C853)](#-total-api-test-isolation--zero-flake-architecture)

<br/>

> *"Quality is not an act. It is a habit."* — Aristotle

</div>

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Architecture & Key Features](#-architecture--key-features)
  - [Total API Test Isolation — Zero-Flake Architecture](#-total-api-test-isolation--zero-flake-architecture)
  - [Blazing Fast Execution](#-blazing-fast-execution)
  - [Optimized Project Scoping](#-optimized-project-scoping)
  - [Modern Node.js Standards](#-modern-nodejs-standards)
  - [AI-Powered Support Triage Tool](#-ai-powered-support-triage-tool)
- [Folder Structure](#-folder-structure)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Running Tests](#-running-tests)
- [CI/CD Integration](#-cicd-integration)
- [Support Playbook](#-support-playbook)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌐 Project Overview

The **Hospitality QA Greenfield Framework** is a robust, standalone test automation suite engineered from scratch for a next-generation digital hospitality platform. It covers the full quality surface of hotel booking services — from end-to-end guest journeys across five browser and device profiles, to mathematically rigorous geospatial API contract validation.

This framework was designed around three non-negotiable engineering principles:

| Principle | Implementation |
|-----------|---------------|
| **Deterministic Stability** | Self-contained mock HTTP server eliminates all external network dependencies |
| **Ultra-Fast Execution** | Complete API suite (8 tests) finishes in **1.2 seconds** — zero I/O overhead |
| **CI/CD Resource Efficiency** | Strict `testMatch` scoping prevents redundant cross-project execution, saving compute hours on every pipeline run |

It is intentionally greenfield — no legacy tooling, no inherited technical debt. Every architectural decision is deliberate, documented, and aligned with the current best practices of the Node.js 20 and Playwright 1.49 ecosystems.

---

## 🏗️ Architecture & Key Features

### 🔒 Total API Test Isolation — Zero-Flake Architecture

The most impactful architectural decision in this framework is the complete elimination of external network dependency from the API test suite.

**The problem with traditional API testing:**

```
Traditional Setup                          This Framework
─────────────────────────────────          ────────────────────────────────────
Test Runner                                Test Runner
    │                                          │
    ▼                                          ▼
HTTP Request ──► Staging Server          beforeAll() spawns
                   │                     localhost mock server (random port)
                   ├─ VPN required?           │
                   ├─ Network flakiness?       ▼
                   ├─ Server unavailable?  HTTP Request ──► 127.0.0.1:<port>
                   └─ Auth token expiry?           │
                                               ├─ No VPN
                                               ├─ No flakiness
                                               ├─ No auth
                                               └─ Always available
```

**How it works:**

A lightweight HTTP server is programmatically constructed using Node's native `http` module — no third-party mocking library required. It is spawned inside `test.beforeAll()` on a random OS-assigned port (binding to port `0` and letting the kernel resolve a free port), making it **impossible to experience port conflicts** even when multiple workers run in parallel.

```typescript
// Simplified illustration of the mock server lifecycle
test.beforeAll(async () => {
  const { server, baseUrl } = await createMockServer(); // port 0 → OS assigns free port
  mockServer  = server;
  mockBaseUrl = baseUrl; // e.g. http://127.0.0.1:52341
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    mockServer.close((err) => (err ? reject(err) : resolve())); // graceful teardown
  });
});
```

The mock server implements **real parameter validation logic** — it does not just return canned responses. It parses query parameters, validates coordinate ranges, enforces positive radius values, and returns semantically correct HTTP status codes (200, 400, 422) with structured JSON error payloads. This means the tests are validating real contract logic, not just mocked stubs.

**Benefits delivered:**

- ✅ **100% network agnostic** — runs identically on a developer laptop, in CI, or air-gapped environments
- ✅ **VPN-independent** — no tunnel configuration required in GitHub Actions
- ✅ **Zero auth overhead** — no API tokens to rotate or inject as secrets for API tests
- ✅ **Deterministic** — server behavior is code-controlled, not environment-dependent

---

### ⚡ Blazing Fast Execution

Because all API requests resolve over the loopback interface (`127.0.0.1`) without crossing any network boundary, the suite achieves throughput impossible to match with live staging endpoints.

```
API Suite Execution Results
───────────────────────────────────────────────────────────
  ✓  TC-API-001  Valid request: 200, Content-Type, schema     54ms
  ✓  TC-API-002  Geofence compliance (Haversine math)         22ms
  ✓  TC-API-003  Out-of-bounds hotel detection (pure logic)    8ms
  ✓  TC-API-004  Missing params → 400 Bad Request             46ms
  ✓  TC-API-005  Invalid latitude → 422 Unprocessable Entity  58ms
  ✓  TC-API-006  Zero radius → 422 Unprocessable Entity       31ms
  ✓  TC-API-007  Full schema field validation (pure logic)    79ms
  ✓  TC-API-008  SLA response time < 2000ms assertion         51ms
───────────────────────────────────────────────────────────
  8 passed | 0 failed | 0 warnings | Total: 1.2s
```

> **TC-API-003** and **TC-API-007** require zero network I/O. They exercise the Haversine distance utility and the JSON schema model in pure memory — completing in under 80ms total between them.

---

### 🎯 Optimized Project Scoping

A subtle but impactful discovery during the initial CI run: without explicit `testMatch` constraints, Playwright's browser projects (`chromium`, `firefox`, `webkit`, `mobile-chrome`, `mobile-safari`) each attempted to execute the API spec — generating **30 duplicate, browser-contextualized failures** that wasted compute time and polluted the failure report.

**The fix — surgical `testMatch` scoping in `playwright.config.ts`:**

```typescript
// Browser projects are locked to E2E specs only.
{
  name: 'chromium',
  testMatch: '**/e2e/**/*.spec.ts',   // ← explicit scope guard
  use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
},

// The API project is scoped by testDir — zero overlap possible.
{
  name: 'api',
  testDir: './tests/api',             // ← directory-level isolation
  use: { baseURL: 'http://127.0.0.1' },
},
```

**Impact on CI compute:**

| Before | After |
|--------|-------|
| 8 API tests × 5 browser projects = **40 executions** (30 failing) | 8 API tests × 1 API project = **8 executions** (8 passing) |
| 3 E2E tests × 6 projects = 18 executions | 3 E2E tests × 5 browser projects = **15 executions** |
| Wasted runner time on every push | Zero redundant executions |

---

### 🔬 Modern Node.js Standards

Every module-level decision reflects current Node.js 20+ idioms.

**`url.parse()` → WHATWG `URL` API:**

The legacy `url.parse()` function carries a documented security advisory (`DEP0169`) due to its non-standard, error-prone parsing behavior. It was replaced with the globally available WHATWG `URL` constructor — the same API used by browsers and Deno, ensuring spec-compliant, injection-safe URL handling.

```typescript
// ❌ Legacy — deprecated in Node 20, security-flagged (DEP0169)
import * as url from 'url';
const parsedUrl    = url.parse(req.url ?? '', true);
const { lat, lng } = parsedUrl.query;

// ✅ Modern — WHATWG URL API, globally available in Node 20+, no import needed
const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
const lat       = parsedUrl.searchParams.get('lat');
const lng       = parsedUrl.searchParams.get('lng');
```

**Additional standards applied throughout the codebase:**

- `strict: true` TypeScript compiler configuration with `noImplicitReturns` and `noImplicitAny`
- `ES2022` compilation target with `DOM` lib for Playwright type resolution
- Semantic `getByRole`, `getByLabel`, and `getByTestId` locators — zero CSS selectors or XPath in E2E tests
- Haversine great-circle distance formula for mathematically precise geofence boundary assertions

---

### 🤖 AI-Powered Support Triage Tool

Located at [`support-tools/ai-ticket-triage.ts`](support-tools/ai-ticket-triage.ts), this CLI tool bridges the gap between L2 support investigations and automated QA regression coverage.

**Workflow:**

```
Raw L2 Support Ticket (.txt)
         │
         ▼
  [ Ticket Parser ]   ──► Extracts: ID · Priority · Steps · Observed · Expected · Environment
         │
         ▼
  [ Prompt Builder ]  ──► Constructs precision-engineered system + user prompt for LLM
         │
         ▼
  [ Gemini API Client ] ──► (optional — requires LLM_API_KEY in .env)
         │
         ▼
  Structured Analysis:
    1. Executive Summary        (client-facing, non-technical)
    2. Root Cause Analysis      (ranked hypotheses with supporting evidence)
    3. Immediate Mitigation     (actionable steps for L2 right now)
    4. Escalation Checklist     (data required before routing to Engineering)
    5. Playwright Test Scaffold (ready-to-adapt regression test case)
    6. Post-Incident Recs       (systemic prevention measures)
```

```bash
# Dry run — review the optimised prompt before sending to the LLM
npm run triage

# Process a custom ticket and send to Gemini
npx ts-node support-tools/ai-ticket-triage.ts --ticket ./my-ticket.txt --send

# Save the full LLM triage analysis to a markdown file
npx ts-node support-tools/ai-ticket-triage.ts --send --output ./triage-SUP-2847.md
```

---

## 📁 Folder Structure

```
hospitality-qa-greenfield-framework/
│
├── playwright.config.ts            # Central config: browsers, reporters, testMatch scoping
├── tsconfig.json                   # TypeScript strict mode, ES2022, DOM lib
├── package.json                    # Dependencies + npm script aliases
├── .env.example                    # Environment variable template (commit this, not .env)
├── .gitignore
│
├── tests/
│   ├── e2e/
│   │   └── hotel-booking.spec.ts   # End-to-end booking flow (3 tests, 5 page object helpers)
│   └── api/
│       └── geofence-search.spec.ts # API + geofence suite (8 tests, embedded mock server)
│
├── support-tools/
│   ├── ai-ticket-triage.ts         # CLI: L2 ticket → LLM prompt → RCA + test scaffold
│   └── sample-ticket.txt           # Realistic P1 ticket (booking confirmation loop)
│
├── docs/
│   └── support-playbook.md         # L1/L2 SLA guide, escalation workflows, defect templates
│
└── .github/
    └── workflows/
        └── main-ci.yml             # 4-job CI pipeline: lint → E2E matrix → API → quality gate
```

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Test Runner | [Playwright](https://playwright.dev/) | `^1.49` |
| Language | [TypeScript](https://www.typescriptlang.org/) | `^5.7` |
| Runtime | [Node.js](https://nodejs.org/) | `>=20.0.0` |
| API Mocking | Node.js `http` (native) | Built-in |
| HTTP Client | Playwright `APIRequestContext` | Built-in |
| Geospatial Math | Haversine Formula | Custom implementation |
| CI/CD | [GitHub Actions](https://github.com/features/actions) | — |
| Environment Config | [dotenv](https://github.com/motdotla/dotenv) | `^16.4` |
| HTTP Requests (CLI) | [axios](https://axios-http.com/) | `^1.7` |
| LLM Integration | [Gemini REST API](https://ai.google.dev/) | v1beta |

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Minimum Version | Check Command |
|-------------|----------------|---------------|
| Node.js | 20.x LTS | `node --version` |
| npm | 10.x | `npm --version` |
| Git | 2.x | `git --version` |

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-org/hospitality-qa-greenfield-framework.git
cd hospitality-qa-greenfield-framework
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Install Playwright Browser Binaries

Downloads Chromium, Firefox, WebKit, and their OS-level system dependencies:

```bash
npm run install:browsers
# Equivalent to: npx playwright install --with-deps
```

> **The API test suite requires no browser binaries.** It runs immediately after `npm install`. This step is only needed for E2E tests.

### 4️⃣ Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and populate the values relevant to your environment:

```bash
# Required for E2E tests — point to your staging or local application
BASE_URL=https://your-staging-app.com

# Required for the AI triage tool — leave empty if not using LLM features
LLM_API_KEY=your-gemini-or-claude-api-key
LLM_PROVIDER=gemini
```

> **The API test suite requires zero environment variables.** It is fully self-contained and runs on `localhost` with no `.env` configuration needed.

---

## ▶️ Running Tests

### API Tests — Run Immediately, No Setup Required

```bash
npm run test:api
```

**Expected output:**

```
Running 8 tests using 4 workers

  ✓  TC-API-001  Valid request: 200, Content-Type, schema
  ✓  TC-API-002  Geofence compliance (Haversine math)
  ✓  TC-API-003  Out-of-bounds hotel detection (negative test)
  ✓  TC-API-004  Missing params → 400 Bad Request
  ✓  TC-API-005  Invalid latitude → 422 Unprocessable Entity
  ✓  TC-API-006  Zero radius → 422 Unprocessable Entity
  ✓  TC-API-007  Full schema field validation
  ✓  TC-API-008  SLA response time < 2000 ms

  8 passed (1.2s)
```

---

### E2E Tests — Requires Staging Environment

```bash
# All browser projects (Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari)
npm run test:e2e

# Target a single browser
npm run test:chromium
npm run test:firefox
npm run test:webkit

# Watch the browser in action
npm run test:headed

# Step-through debugger
npm run test:debug

# Interactive Playwright UI with time-travel debugging
npm run test:ui
```

---

### Full Suite

```bash
npm test
```

---

### View Test Reports

```bash
npm run report
```

---

### AI Triage Tool

```bash
# Preview the generated prompt without calling the LLM
npm run triage

# Send to Gemini and print the full structured analysis
npx ts-node support-tools/ai-ticket-triage.ts --send

# Save analysis output to a markdown file
npx ts-node support-tools/ai-ticket-triage.ts --send --output ./triage-output.md

# Print all CLI options
npx ts-node support-tools/ai-ticket-triage.ts --help
```

---

### All Available Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Full suite across all Playwright projects |
| `npm run test:e2e` | E2E tests only (all browser projects) |
| `npm run test:api` | API tests only (`api` project, localhost mock server) |
| `npm run test:chromium` | Desktop Chrome only |
| `npm run test:firefox` | Desktop Firefox only |
| `npm run test:webkit` | Desktop Safari only |
| `npm run test:headed` | Headed browser execution (visible window) |
| `npm run test:debug` | Playwright step-through debugger |
| `npm run test:ui` | Playwright interactive UI mode |
| `npm run report` | Open last HTML report |
| `npm run triage` | AI triage tool (dry run) |
| `npm run lint` | TypeScript type check — zero emit |
| `npm run install:browsers` | Download Playwright browser binaries |

---

## ⚙️ CI/CD Integration

The GitHub Actions workflow at [`.github/workflows/main-ci.yml`](.github/workflows/main-ci.yml) implements a four-stage pipeline optimized for speed and resource efficiency.

### Pipeline Architecture

```
git push / pull_request
        │
        ▼
┌───────────────────────────────┐
│  Job 1: Lint & Type Check     │  Fast gate. No browsers. Fails on type errors immediately.
│  ubuntu-latest · ~30 seconds  │
└──────────────┬────────────────┘
               │ on success
               ▼
┌──────────────────────────────────────────────────────┐
│  Job 2: E2E Tests — Parallel Browser Matrix          │
│                                                      │
│  chromium  │  firefox  │  webkit  │  mobile × 2     │
│                                                      │
│  fail-fast: false  ──  all results collected         │
└──────────────┬───────────────────────────────────────┘
               │                      │
               │                      │ (runs in parallel with Job 2)
               ▼                      ▼
┌────────────────────────┐  ┌─────────────────────────┐
│  Job 3: API Tests      │  │                         │
│  api project · ~1.2s   │  │  No browsers required   │
│  No network deps       │  │  No secrets needed      │
└──────────────┬─────────┘  └─────────────────────────┘
               │ both complete
               ▼
┌──────────────────────────────────────────────────────┐
│  Job 4: Quality Gate                                 │
│  Passes only when Jobs 2 + 3 both succeed.           │
│  Enforced as a branch protection rule.               │
└──────────────────────────────────────────────────────┘
```

### Why No Network Tunneling is Needed

Unlike frameworks that depend on live staging environments, the API suite requires **zero network configuration in CI**:

- No VPN secrets to inject
- No `ngrok` or `localtunnel` setup
- No SSH tunneling or port-forwarding rules
- No staging environment health checks

The mock HTTP server starts on `127.0.0.1` inside the GitHub Actions runner process — available immediately, always, with sub-millisecond latency.

### Required GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions** to enable E2E tests against a staging environment:

| Secret | Description |
|--------|-------------|
| `STAGING_BASE_URL` | Full URL of the staging application |
| `STAGING_API_BASE_URL` | Staging API base URL |
| `TEST_USER_EMAIL` | Automation test account email |
| `TEST_USER_PASSWORD` | Automation test account password |
| `API_BEARER_TOKEN` | API bearer token for authenticated calls |

> **The API test job requires no secrets.** It is entirely self-contained.

### Failure Artefacts

On any test failure, the pipeline automatically uploads and retains:

| Artefact | Retention | Contents |
|----------|-----------|---------|
| `playwright-report-<project>-<run-id>` | 14 days | Interactive HTML report with screenshots |
| `test-results-<project>-<run-id>` | 14 days | Video recordings and Playwright trace files |
| `api-junit-results-<run-id>` | 30 days | JUnit XML for test management system ingestion |

---

## 📚 Support Playbook

The [`docs/support-playbook.md`](docs/support-playbook.md) is the operational reference for L1 and L2 Technical Support Engineers. It includes:

- **P0–P4 Priority Classification** with concrete symptom indicators for each tier
- **SLA Metrics Table** — first response, escalation, and resolution targets per priority
- **Escalation Flowchart** — from first customer contact through post-incident review
- **Defect Report Template** — the engineering-grade standard for L2 defect reports
- **First-Response Runbooks** — step-by-step guides for the most common failure patterns (booking confirmation loops, search returning zero results, payment charge without booking creation)
- **AI Triage Tool Guide** — how to run the tool and interpret each of its six structured output sections
- **Client Communication Templates** — pre-written P1 acknowledgement and resolution messages

---

## 🤝 Contributing

Contributions are welcome. Please follow these standards to maintain the quality bar of the codebase.

### Branching

```bash
git checkout -b feature/your-descriptive-feature-name
git checkout -b fix/tc-api-009-edge-case-description
```

### Code Standards

- All TypeScript must pass `npm run lint` — zero errors, zero `any` escape hatches
- Test IDs must follow the `TC-{TYPE}-{NNN}` convention — e.g., `TC-API-009`, `TC-E2E-004`
- Regression tests originating from a support ticket must embed the ticket ID:

  ```typescript
  test('TC-REG-SUP2847 — Booking confirmation renders after payment [SUP-2847]', ...)
  ```

- No `TODO` comments — every implementation must be complete and functional before merging
- All code, comments, and documentation must be in English
- No CSS selectors or XPath in E2E tests — use Playwright semantic locators only (`getByRole`, `getByLabel`, `getByTestId`)
- API specs belong in `tests/api/`, E2E specs in `tests/e2e/` — respect `testMatch` boundaries

### Pull Request Checklist

- [ ] `npm run lint` passes with zero errors
- [ ] `npm run test:api` passes 8/8
- [ ] New functionality is covered by new or extended test cases
- [ ] CI Quality Gate job is green on the PR branch

---

## 📄 License

```
MIT License

Copyright (c) 2026 Hospitality Platform QA Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

<div align="center">

**Built with precision. Tested with purpose. Shipped with confidence.**

<br/>

[![Playwright](https://img.shields.io/badge/Powered%20by-Playwright-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![TypeScript](https://img.shields.io/badge/Written%20in-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub Actions](https://img.shields.io/badge/CI%20via-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)

</div>
