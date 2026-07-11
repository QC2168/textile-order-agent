# ColorBridge MVP Design

Date: 2026-07-11

## Goal

Build the smallest demo that makes ColorBridge understandable and reliable in a pitch:

Customer fuzzy color language becomes a confirmed, traceable color sampling task.

The main entry is a Next.js product workspace. Chainlit remains available for AI prompt tuning and backup demonstration, but it is not the primary demo surface.

## Demo Scope

The MVP is a single 6-step workflow:

1. Load customer chat
2. Run AI analysis
3. Confirm missing fields
4. Retrieve similar historical cases
5. Compare sampling Lab and Delta E results
6. Generate customer confirmation and traceability view

The demo must work without login, external devices, ERP, MES, or real file upload. It should be able to run from seeded demo data if the model or network is unavailable.

## Product Surface

The first screen is the actual workspace, not a marketing landing page.

Layout:

- Header: ColorBridge name, one-sentence product positioning, current demo status
- Left rail: six workflow steps with progress states
- Main panel: active step content and primary action
- Right panel: order summary, Lab color chips, risk notes, and version trace
- Demo controls: load demo case and reset demo

The UI should feel like a lightweight factory sampling tool: compact, scannable, and operational. It should avoid oversized landing sections and unnecessary explanatory copy.

## Data Model

Use SQLite with Prisma for the smallest useful persistence layer.

Required persisted data:

- Demo order
- Customer input text
- Structured AI analysis JSON
- Confirmed requirement fields
- Historical case matches
- Sampling attempts
- Trace events

Suggested Prisma models:

- `ColorOrder`: one demo order with raw customer text, status, and confirmed fields
- `AnalysisResult`: structured extraction JSON, missing fields, confidence, source
- `HistoricalCase`: seeded reference cases for similarity display
- `SampleAttempt`: Lab values, Delta E, pass/fail state, deviation note
- `TraceEvent`: timeline entries for confirmation and version history

No user, organization, permission, billing, or audit user model is needed for MVP.

## AI Behavior

AI output should be constrained to structured JSON:

- Color intent
- Target color name
- Avoided hue or risk
- Fabric
- Base cloth
- Light source
- Target Lab
- Delta E threshold
- Missing fields
- Confidence
- Follow-up questions

Implementation priority:

1. Use a deterministic cached JSON result for the main demo path.
2. Optionally call the existing Chainlit/LLM flow or a small service function for live analysis.
3. If live analysis fails or times out, show the cached result and continue the workflow.

The product should never claim automatic production formula generation. Historical cases are candidate references for a colorist to review.

## Workflow Details

### 1. Load Customer Chat

One button loads the main demo sentence:

"高级一点的雾霾蓝，别太紫，像上次那块，做在棉针织上。"

The page shows the raw input and creates or resets the demo order.

### 2. AI Analysis

The page shows extracted fields, missing items, confidence, and follow-up questions.

Minimum visible fields:

- Color intent: advanced muted blue
- Risk: avoid purple cast
- Fabric: cotton knit
- Missing fields: light source, base cloth, target Lab, Delta E threshold
- Confidence: displayed as a percentage or label

### 3. Confirm Fields

The operator confirms:

- Light source: D65
- Base cloth: warm white
- Target Lab: demo values
- Delta E threshold: 1.0 or 1.5

The form must be editable, but defaults should be prefilled for fast presentation.

### 4. Historical Cases

Show top 3 seeded historical cases with:

- Case name
- Fabric/base cloth
- Lab values
- Similarity reason
- Risk note

The search can be deterministic for MVP. Similarity does not need a real embedding model.

### 5. Sampling Comparison

Show two built-in sample attempts:

- Attempt 1: fails Delta E threshold and explains bias direction
- Attempt 2: passes Delta E threshold

Delta E calculation can be implemented locally from Lab values or stored in seed data. The screen should make pass/fail obvious.

### 6. Confirmation And Traceability

Show a customer confirmation card and a version timeline:

- Confirmed color requirement
- Light source and threshold
- Selected reference case
- Winning sample attempt
- Trace events from input to confirmation

Export can be a report preview in MVP. Real PDF export is optional and out of scope unless time remains.

## Error Handling

The demo should keep moving even when AI fails:

- If analysis fails, display cached demo analysis.
- If database is empty, seed demo data.
- If Prisma access fails during development, show a clear error state instead of a blank page.

## Testing

Minimum verification:

- Next.js build or lint passes
- Prisma schema validates
- Seeded demo data can be loaded
- Six-step workflow can be completed twice after reset
- AI fallback path can complete the workflow without network

## Out Of Scope

- Login and user management
- Real multi-tenant data model
- Real file upload
- Real color scanner integration
- Automatic dye formula generation
- ERP/MES integration
- Production deployment
- Full PDF generation

## Implementation Notes

Keep dependencies minimal:

- Add Prisma and Prisma Client only if not present
- Use local SQLite at `prisma/dev.db`
- Use simple seed data committed as code or JSON
- Prefer server actions or route handlers only where they reduce complexity
- Keep the UI in a small number of files until real duplication appears

## Approval

Approved direction from the user:

- Next.js is the main demo entry
- SQLite with Prisma is acceptable
- Keep the MVP as simple as possible
