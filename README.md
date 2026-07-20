<div align="center">

# 🏨 Hospitality QA Greenfield Framework

**Production-grade, enterprise QA automation for the award-winning digital hospitality platform.**

[![CI Status](https://github.com/your-org/hospitality-qa-framework/actions/workflows/main-ci.yml/badge.svg)](https://github.com/your-org/hospitality-qa-framework/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.49-green.svg)](https://playwright.dev/)
[![Node](https://img.shields.io/badge/Node.js-20+-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Overview

This framework is a **greenfield, production-ready test automation solution** built with [Playwright](https://playwright.dev/) and [TypeScript](https://www.typescriptlang.org/). It covers the full quality assurance surface of the hospitality platform — from pixel-level browser interactions across five device profiles to microsecond-precision geospatial API assertions — and bridges the gap between L2 support ticket investigations and automated regression coverage through an AI-powered triage CLI.

### Key Capabilities

| Capability | Details |
|-----------|---------|
| **Cross-browser E2E** | Chromium, Firefox, WebKit, Mobile Chrome (Pixel 7), Mobile Safari (iPhone 15) |
| **API Testing** | Geofence validation with Haversine math, schema contracts, SLA timing |
| **Parallel Execution** | Fully parallel across workers and CI matrix shards |
| **Failure Artefacts** | Screenshots, video recordings, and Playwright traces on first retry |
| **Reporting** | Interactive HTML report + JUnit XML + GitHub Actions native annotations |
| **AI Triage Tool** | CLI that converts raw L2 tickets into structured LLM prompts for RCA and test generation |
| **CI/CD Integration** | GitHub Actions workflow with browser caching and quality gate |

---

## Architecture

```
hospitality-qa-greenfield-framework/
│
├── playwright.config.ts          # Central Playwright configuration (browsers, reporters, timeouts)
├── tsconfig.json                 # TypeScript compiler configuration
├── package.json                  # Dependencies and npm scripts
├── .env.example                  # Environment variable template (copy to .env)
├── .gitignore
│
├── tests/
│   ├── e2e/
│   │   └── hotel-booking.spec.ts     # End-to-end hotel booking flow (3 test cases)
│   └── api/
│       └── geofence-search.spec.ts   # Geospatial API tests (8 test cases)
│
├── support-tools/
│   ├── ai-ticket-triage.ts           # AI-powered L2 support ticket triage CLI
│   └── sample-ticket.txt             # Example P1 support ticket for demonstration
│
├── docs/
│   └── support-playbook.md           # L1/L2 support team operational playbook
│
└── .github/
    └── workflows/
        └── main-ci.yml               # GitHub Actions CI pipeline
```

### Architectural Decisions

**Why Playwright?**
Playwright is the industry-leading browser automation framework, offering native multi-browser support, built-in network interception, and first-class TypeScript integration. Its `APIRequestContext` allows the same framework to cover both E2E and API layers without context-switching between tools.

**Why TypeScript?**
Strong typing catches entire categories of test bugs at compile time (incorrect locator types, missing assertion arguments, wrong data shapes). The `strict` compiler flags in `tsconfig.json` enforce maximum safety.

**Why Page Object Helpers?**
Rather than using heavy full POM classes, the E2E tests use lightweight helper classes scoped per page. This avoids boilerplate inheritance chains while still keeping locator definitions co-located and DRY.

**Why the AI Triage Tool?**
The most expensive part of QA automation is the discovery phase — understanding what broke, why, and what the regression test should cover. By feeding structured ticket data directly into an LLM with a precisely engineered prompt, L2 engineers produce a ready-to-adapt test scaffold in minutes rather than hours.

---

## Prerequisites

| Requirement | Minimum Version |
|-------------|----------------|
| Node.js | 20.x LTS |
| npm | 10.x |
| Git | 2.x |

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-org/hospitality-qa-greenfield-framework.git
cd hospitality-qa-greenfield-framework
```

### 2. Install npm dependencies

```bash
npm ci
```

### 3. Install Playwright browsers and system dependencies

```bash
npm run install:browsers
# Equivalent to: npx playwright install --with-deps
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and populate all values. At minimum, set:
- `BASE_URL` — staging application URL
- `API_BASE_URL` — staging API base URL
- `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` — test account credentials

For the AI triage tool, also set:
- `LLM_API_KEY` — your Gemini or Claude API key
- `LLM_PROVIDER` — `gemini` (default) or `claude`

---

## Running Tests

### Run the full test suite

```bash
npm test
```

### Run only E2E tests

```bash
npm run test:e2e
```

### Run only API tests

```bash
npm run test:api
```

### Run tests against a specific browser

```bash
npm run test:chromium
npm run test:firefox
npm run test:webkit
```

### Run in headed mode (watch the browser)

```bash
npm run test:headed
```

### Open the interactive Playwright UI

The Playwright UI provides a visual test runner with a watch mode, time-travel debugging, and trace viewer:

```bash
npm run test:ui
```

### Debug a single test

```bash
npm run test:debug
```

### View the HTML test report

```bash
npm run report
```

---

## Test Structure

### End-to-End Tests (`tests/e2e/hotel-booking.spec.ts`)

The E2E suite simulates the complete guest journey using Playwright's semantic locators (`getByRole`, `getByLabel`, `getByTestId`) — **never CSS selectors or XPath** — for maximum resilience to markup changes.

| Test ID | Name | Description |
|---------|------|-------------|
| `TC-E2E-001` | Full booking flow | Search → Select Hotel → Select Room → Fill Guest + Payment → Confirmation |
| `TC-E2E-002` | Form validation | Search form rejects submission without required fields |
| `TC-E2E-003` | Date range validation | Check-out date cannot precede check-in date |

Each test uses `test.step()` to segment assertions into named phases — making failure messages pinpoint exactly which phase broke.

### API Tests (`tests/api/geofence-search.spec.ts`)

The API suite validates the `/api/v1/hotels/search` geospatial endpoint using the Haversine great-circle distance formula to mathematically verify that every returned hotel falls within the requested radius.

| Test ID | Name | Description |
|---------|------|-------------|
| `TC-API-001` | HTTP 200 + schema | Status code, Content-Type, and top-level response shape |
| `TC-API-002` | Geofence compliance | All results within radius (Haversine validation) |
| `TC-API-003` | Out-of-bounds detection | Confirms the geofence checker correctly flags violations |
| `TC-API-004` | Missing parameters | Returns 400 Bad Request |
| `TC-API-005` | Invalid latitude | Returns 422 Unprocessable Entity |
| `TC-API-006` | Zero radius | Returns 422 Unprocessable Entity |
| `TC-API-007` | Hotel schema fields | All hotels have all required fields with correct types |
| `TC-API-008` | SLA response time | Response completes within 2000 ms |

---

## AI-Powered Support Triage Tool

The `support-tools/ai-ticket-triage.ts` CLI bridges the gap between L2 support ticket investigations and QA regression test automation.

### How It Works

```
Raw L2 Support Ticket (.txt)
         │
         ▼
 ┌───────────────────┐
 │  Ticket Parser    │  Extracts: ID, Priority, Steps, Observed,
 │                   │  Expected, Environment, Context
 └───────────────────┘
         │
         ▼
 ┌───────────────────┐
 │  Prompt Builder   │  Constructs a precision-engineered system + user
 │                   │  prompt optimised for RCA and test generation
 └───────────────────┘
         │
         ▼
 ┌───────────────────┐
 │  LLM API Client   │  Calls Gemini / Claude with the prompt package
 │  (optional)       │
 └───────────────────┘
         │
         ▼
 Structured Analysis:
  • Executive Summary    (client-facing)
  • Root Cause Analysis  (ranked hypotheses)
  • Mitigation Steps     (immediate actions)
  • Escalation Checklist (L2 → L3 data requirements)
  • Playwright Test Case (ready-to-adapt scaffold)
  • Post-Incident Recs   (prevention measures)
```

### Usage

```bash
# Preview the generated prompt (dry run, no LLM call)
npm run triage

# Process a specific ticket file
npx ts-node support-tools/ai-ticket-triage.ts --ticket ./support-tools/sample-ticket.txt

# Send to the LLM and print the full analysis
npx ts-node support-tools/ai-ticket-triage.ts --send

# Send to the LLM and save the output to a markdown file
npx ts-node support-tools/ai-ticket-triage.ts --send --output ./triage-output.md

# Print help
npx ts-node support-tools/ai-ticket-triage.ts --help
```

### Sample Ticket

The repository includes a realistic P1 sample ticket (`support-tools/sample-ticket.txt`) describing a booking confirmation page failure — a redirect loop introduced by a faulty deployment. This serves as both a demonstration and a template for real ticket formatting.

---

## CI/CD Pipeline

The GitHub Actions workflow (`.github/workflows/main-ci.yml`) implements a four-job pipeline:

```
push / PR
    │
    ├─► Job 1: Lint & Type Check (fast, no browsers)
    │
    ├─► Job 2: E2E Tests (parallel matrix across 5 browser/device profiles)
    │         ├── chromium
    │         ├── firefox
    │         ├── webkit
    │         ├── mobile-chrome
    │         └── mobile-safari
    │
    ├─► Job 3: API Tests (no browser binary required)
    │
    └─► Job 4: Quality Gate (passes only if Jobs 2 + 3 both succeed)
```

### Required GitHub Secrets

Configure these in your repository's **Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `STAGING_BASE_URL` | Staging environment base URL |
| `STAGING_API_BASE_URL` | Staging API base URL |
| `TEST_USER_EMAIL` | Automation test account email |
| `TEST_USER_PASSWORD` | Automation test account password |
| `API_BEARER_TOKEN` | API authentication bearer token |

### Test Artefacts

On failure, the CI pipeline automatically uploads:
- **HTML Report** (`playwright-report/`) — Interactive report with screenshots and embedded traces.
- **Test Results** (`test-results/`) — Raw artefacts including video recordings and trace files.
- **JUnit XML** — Always uploaded (retained 30 days) for integration with test management systems.

Artefacts are named with the matrix project and run ID for disambiguation (e.g., `playwright-report-chromium-12345678`).

---

## Support Playbook

The [`docs/support-playbook.md`](docs/support-playbook.md) is the operational bible for L1 and L2 Technical Support Engineers. It covers:

- **Priority Classification** — P0 through P4 with concrete indicators
- **SLA Metrics** — Response and resolution times per priority, KPI targets
- **Escalation Workflow** — A complete flowchart from first contact to ticket closure
- **Defect Report Template** — The standard L2 engineering defect report format
- **Runbooks** — Step-by-step first-response guides for common defect patterns
- **AI Tool Guide** — How to use and interpret the triage tool output
- **Communication Templates** — Pre-written client communication for P1 incidents

---

## Contributing

1. Create a branch: `git checkout -b feature/your-feature-name`
2. Write tests for any new functionality.
3. Ensure `npm run lint` passes before pushing.
4. Open a pull request targeting `main`.
5. The CI pipeline must pass (`quality-gate` job green) before merging.

### Code Style

- All TypeScript must pass the strict compiler checks in `tsconfig.json`.
- Test names must follow the `TC-{TYPE}-{NNN}` convention (e.g., `TC-E2E-004`).
- Regression tests originating from support tickets must include the ticket ID (e.g., `[SUP-2847]`).
- No `TODO` comments. All code must be complete and functional.
- All comments and documentation must be in English.

---

## License

MIT © Hospitality Platform QA Team
