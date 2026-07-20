#!/usr/bin/env ts-node
/**
 * ai-ticket-triage.ts
 *
 * CLI support tool that reads a raw L2 support ticket from a text file,
 * parses it into a structured data model, builds an optimised prompt for an
 * LLM (Claude or Gemini), and outputs the prompt to stdout or calls the LLM
 * API directly if an API key is configured.
 *
 * Usage:
 *   npx ts-node support-tools/ai-ticket-triage.ts [--ticket <path>] [--send]
 *
 * Flags:
 *   --ticket <path>  Path to the raw ticket text file.
 *                    Default: support-tools/sample-ticket.txt
 *   --send           If provided, calls the configured LLM API and prints the
 *                    response. Requires LLM_API_KEY and LLM_PROVIDER in .env.
 *   --output <path>  Write the LLM response to this file instead of stdout.
 *   --help           Print this usage information.
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as http from 'https';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ─── Types ────────────────────────────────────────────────────────────────────

interface StructuredTicket {
  ticketId:          string;
  createdAt:         string;
  priority:          string;
  environment:       string;
  platform:          string;
  reportedBy:        string;
  subject:           string;
  description:       string;
  stepsToReproduce:  string[];
  observedBehavior:  string;
  expectedBehavior:  string;
  additionalContext: string;
  rawText:           string;
}

interface LlmPromptPackage {
  systemPrompt:  string;
  userPrompt:    string;
  ticket:        StructuredTicket;
  modelSuggested: string;
}

interface CliOptions {
  ticketPath:  string;
  sendToLlm:   boolean;
  outputPath:  string | null;
  printHelp:   boolean;
}

// ─── CLI Argument Parser ──────────────────────────────────────────────────────

function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    ticketPath:  path.resolve(__dirname, 'sample-ticket.txt'),
    sendToLlm:   false,
    outputPath:  null,
    printHelp:   false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
      case '-h':
        options.printHelp = true;
        break;
      case '--ticket':
      case '-t':
        options.ticketPath = path.resolve(args[++i] ?? '');
        break;
      case '--send':
      case '-s':
        options.sendToLlm = true;
        break;
      case '--output':
      case '-o':
        options.outputPath = path.resolve(args[++i] ?? '');
        break;
      default:
        break;
    }
  }

  return options;
}

// ─── Ticket Parser ────────────────────────────────────────────────────────────

/**
 * Extracts the content of a named section from the raw ticket text.
 * Sections are delimited by lines matching `--- SECTION NAME ---`.
 */
function extractSection(rawText: string, sectionName: string): string {
  const pattern = new RegExp(
    `---\\s*${sectionName}\\s*---\\s*([\\s\\S]*?)(?=---[A-Z\\s]+----|$)`,
    'i',
  );
  const match = rawText.match(pattern);
  return match ? match[1].trim() : '';
}

/**
 * Extracts a metadata field from the header block of the ticket.
 * Format expected: `FIELD NAME: value`
 */
function extractHeaderField(rawText: string, fieldName: string): string {
  const pattern = new RegExp(`^${fieldName}:\\s*(.+)$`, 'im');
  const match   = rawText.match(pattern);
  return match ? match[1].trim() : 'Unknown';
}

/**
 * Parses numbered steps from a steps section, stripping leading numbering.
 */
function parseSteps(stepsText: string): string[] {
  return stepsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^\d+\.\s/.test(line))
    .map(line => line.replace(/^\d+\.\s*/, ''));
}

/**
 * Parses the raw ticket text file into a strongly-typed StructuredTicket.
 */
function parseTicket(rawText: string): StructuredTicket {
  return {
    ticketId:          extractHeaderField(rawText, 'TICKET ID'),
    createdAt:         extractHeaderField(rawText, 'CREATED AT'),
    priority:          extractHeaderField(rawText, 'PRIORITY'),
    environment:       extractHeaderField(rawText, 'ENVIRONMENT'),
    platform:          extractHeaderField(rawText, 'PLATFORM'),
    reportedBy:        extractHeaderField(rawText, 'REPORTED BY'),
    subject:           extractSection(rawText, 'SUBJECT'),
    description:       extractSection(rawText, 'DESCRIPTION'),
    stepsToReproduce:  parseSteps(extractSection(rawText, 'STEPS TO REPRODUCE')),
    observedBehavior:  extractSection(rawText, 'OBSERVED BEHAVIOR'),
    expectedBehavior:  extractSection(rawText, 'EXPECTED BEHAVIOR'),
    additionalContext: extractSection(rawText, 'ADDITIONAL CONTEXT'),
    rawText,
  };
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

/**
 * Builds a production-quality LLM prompt package from a structured ticket.
 * The system prompt sets the persona and constraints.
 * The user prompt contains the structured ticket data and instructs the model
 * to produce RCA analysis and automated test case scaffolding.
 */
function buildLlmPromptPackage(ticket: StructuredTicket): LlmPromptPackage {
  const systemPrompt = `You are an expert Senior QA Automation Architect and Site Reliability Engineer embedded within a digital hospitality platform team.

Your responsibilities:
1. Perform systematic Root Cause Analysis (RCA) of production support tickets using structured reasoning.
2. Identify the minimal, reproducible regression test scenario that would have caught this defect before deployment.
3. Generate a concrete, fully-implemented Playwright + TypeScript test case scaffold that can be immediately added to the QA regression suite.
4. Provide actionable investigation steps for the L2 Support Engineer to gather additional diagnostic evidence.

Constraints:
- Be precise and technical. Avoid vague suggestions.
- All test code must be production-grade TypeScript using @playwright/test.
- Your RCA must propose at least two plausible root causes, ranked by likelihood.
- Your test case must cover both the failing scenario AND a data boundary (empty ref parameter).
- Keep your response structured using the exact headings specified in the user prompt.`;

  const stepsFormatted = ticket.stepsToReproduce
    .map((step, i) => `  ${i + 1}. ${step}`)
    .join('\n');

  const userPrompt = `## Support Ticket for Analysis

**Ticket ID**: ${ticket.ticketId}
**Priority**: ${ticket.priority}
**Environment**: ${ticket.environment}
**Platform**: ${ticket.platform}
**Reported At**: ${ticket.createdAt}
**Reported By**: ${ticket.reportedBy}

### Subject
${ticket.subject}

### Description
${ticket.description}

### Steps to Reproduce
${stepsFormatted}

### Observed Behavior
${ticket.observedBehavior}

### Expected Behavior
${ticket.expectedBehavior}

### Additional Context
${ticket.additionalContext}

---

## Required Output Format

Please respond using EXACTLY the following structure:

### 1. Executive Summary
A two to three sentence non-technical summary suitable for a Product Manager or client-facing communication.

### 2. Root Cause Analysis
List at least two plausible root causes, each with:
- **Likelihood**: High / Medium / Low
- **Hypothesis**: Technical explanation
- **Evidence**: Which clues from the ticket support this hypothesis
- **How to Confirm**: Specific diagnostic step to prove or disprove

### 3. Immediate Mitigation Steps
Ordered list of steps the L2 Support team can take RIGHT NOW to reduce customer impact (e.g., rollback, feature flag, workaround).

### 4. Escalation Checklist
A checklist of data the L2 engineer must collect and attach before escalating to L3/Engineering:
- [ ] Item

### 5. Automated Regression Test Case
A fully implemented Playwright TypeScript test file (not a skeleton — write the complete test) that:
a) Reproduces the reported failure condition.
b) Asserts the empty booking reference scenario (\`/confirmation?ref=\`).
c) Asserts the redirect loop condition.
d) Asserts the success path to confirm the fix is working.

Format: \`\`\`typescript\n<code>\n\`\`\`

### 6. Post-Incident Recommendations
Three to five concrete recommendations to prevent this class of defect in future deployments.`;

  return {
    systemPrompt,
    userPrompt,
    ticket,
    modelSuggested: 'gemini-1.5-pro',
  };
}

// ─── LLM API Client ───────────────────────────────────────────────────────────

/**
 * Makes an HTTPS POST request to the Gemini generateContent REST API.
 * Returns the generated text content from the first candidate.
 */
async function callGeminiApi(promptPackage: LlmPromptPackage, apiKey: string): Promise<string> {
  const model   = 'gemini-1.5-pro-latest';
  const payload = JSON.stringify({
    system_instruction: {
      parts: [{ text: promptPackage.systemPrompt }],
    },
    contents: [
      {
        role:  'user',
        parts: [{ text: promptPackage.userPrompt }],
      },
    ],
    generationConfig: {
      temperature:     0.3,
      maxOutputTokens: 8192,
      topP:            0.9,
    },
  });

  return new Promise<string>((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: 'generativelanguage.googleapis.com',
      path:     `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            error?: { message: string };
          };

          if (parsed.error) {
            reject(new Error(`Gemini API error: ${parsed.error.message}`));
            return;
          }

          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            reject(new Error('Gemini API returned an empty response.'));
            return;
          }

          resolve(text);
        } catch (parseError) {
          reject(new Error(`Failed to parse Gemini API response: ${String(parseError)}`));
        }
      });
    });

    req.on('error', (error: Error) => reject(new Error(`HTTPS request failed: ${error.message}`)));
    req.write(payload);
    req.end();
  });
}

// ─── Output Utilities ─────────────────────────────────────────────────────────

function printBanner(): void {
  const banner = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║           Hospitality Platform — AI-Powered L2 Ticket Triage Tool            ║
║                       Powered by Gemini / Claude LLM                          ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`;
  process.stdout.write(banner + '\n');
}

function printHelp(): void {
  const help = `
Usage: npx ts-node support-tools/ai-ticket-triage.ts [options]

Options:
  --ticket <path>    Path to the raw support ticket text file.
                     Default: support-tools/sample-ticket.txt
  --send             Send the prompt to the configured LLM API and print the response.
                     Requires LLM_API_KEY and LLM_PROVIDER set in .env.
  --output <path>    Write the LLM response to this file path instead of stdout.
  --help, -h         Print this help message.

Environment Variables (in .env):
  LLM_API_KEY        API key for the LLM provider (Gemini or Claude).
  LLM_PROVIDER       LLM provider: "gemini" (default) or "claude".

Examples:
  # Print the optimised prompt without calling the LLM:
  npx ts-node support-tools/ai-ticket-triage.ts

  # Process a custom ticket and send to Gemini:
  npx ts-node support-tools/ai-ticket-triage.ts --ticket ./my-ticket.txt --send

  # Save the LLM response to a file:
  npx ts-node support-tools/ai-ticket-triage.ts --send --output ./triage-output.md
`;
  process.stdout.write(help + '\n');
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  printBanner();

  const args    = process.argv.slice(2);
  const options = parseCliArgs(args);

  if (options.printHelp) {
    printHelp();
    process.exit(0);
  }

  // ── 1. Read the ticket file ──────────────────────────────────────────────
  if (!fs.existsSync(options.ticketPath)) {
    process.stderr.write(`[ERROR] Ticket file not found: ${options.ticketPath}\n`);
    process.stderr.write(`        Run with --help for usage information.\n`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(options.ticketPath, 'utf-8');
  process.stdout.write(`[INFO] Ticket file loaded: ${options.ticketPath}\n`);

  // ── 2. Parse into structured model ──────────────────────────────────────
  const ticket = parseTicket(rawText);
  process.stdout.write(`[INFO] Ticket parsed successfully:\n`);
  process.stdout.write(`         ID:       ${ticket.ticketId}\n`);
  process.stdout.write(`         Priority: ${ticket.priority}\n`);
  process.stdout.write(`         Subject:  ${ticket.subject.substring(0, 80)}...\n`);
  process.stdout.write(`         Steps:    ${ticket.stepsToReproduce.length} reproducible steps found\n\n`);

  // ── 3. Build LLM prompt ──────────────────────────────────────────────────
  const promptPackage = buildLlmPromptPackage(ticket);
  process.stdout.write(`[INFO] LLM prompt package built. Model suggested: ${promptPackage.modelSuggested}\n\n`);

  if (!options.sendToLlm) {
    // Dry-run mode: print the full prompt to stdout so engineers can review
    // or paste it into their LLM interface of choice.
    process.stdout.write('─'.repeat(80) + '\n');
    process.stdout.write('SYSTEM PROMPT:\n');
    process.stdout.write('─'.repeat(80) + '\n');
    process.stdout.write(promptPackage.systemPrompt + '\n\n');
    process.stdout.write('─'.repeat(80) + '\n');
    process.stdout.write('USER PROMPT:\n');
    process.stdout.write('─'.repeat(80) + '\n');
    process.stdout.write(promptPackage.userPrompt + '\n\n');
    process.stdout.write('[INFO] To send this prompt to the LLM, run with the --send flag.\n');
    return;
  }

  // ── 4. Call the LLM API ──────────────────────────────────────────────────
  const apiKey   = process.env.LLM_API_KEY;
  const provider = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();

  if (!apiKey) {
    process.stderr.write('[ERROR] LLM_API_KEY is not set in your .env file.\n');
    process.stderr.write('        Copy .env.example to .env and add your key.\n');
    process.exit(1);
  }

  process.stdout.write(`[INFO] Sending prompt to ${provider} API...\n`);
  const startMs = Date.now();

  let llmResponse: string;

  if (provider === 'gemini') {
    llmResponse = await callGeminiApi(promptPackage, apiKey);
  } else {
    // Claude and other providers can be added by extending this switch.
    process.stderr.write(`[ERROR] LLM provider "${provider}" is not yet implemented.\n`);
    process.stderr.write('        Supported providers: gemini\n');
    process.exit(1);
  }

  const elapsedMs = Date.now() - startMs;
  process.stdout.write(`[INFO] LLM response received in ${elapsedMs} ms.\n\n`);

  // ── 5. Output the result ─────────────────────────────────────────────────
  if (options.outputPath) {
    fs.writeFileSync(options.outputPath, llmResponse, 'utf-8');
    process.stdout.write(`[INFO] LLM response written to: ${options.outputPath}\n`);
  } else {
    process.stdout.write('─'.repeat(80) + '\n');
    process.stdout.write('LLM TRIAGE ANALYSIS:\n');
    process.stdout.write('─'.repeat(80) + '\n');
    process.stdout.write(llmResponse + '\n');
  }
}

// Execute and handle top-level errors with a clean exit code.
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[FATAL] ${message}\n`);
  process.exit(1);
});
