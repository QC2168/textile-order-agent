# Step 3 Spectral Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Step 3 confirmation UI with the approved multi-light-source confirmation workflow and synchronize the right-side summary panel with the live draft.

**Architecture:** Keep the existing single-page workbench and `confirmedFields` JSON persistence. Extend the existing confirmation draft helpers with lighting, image prompt hints, and reference fallback metadata, then render the richer Step 3 UI from those draft values.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Tailwind CSS, existing shadcn-style UI components.

## Global Constraints

- Do not add new dependencies.
- Do not change Prisma schema.
- Do not claim the preview is real spectral measurement.
- Confirmation parameter fields must use light backgrounds with readable dark text.
- Image prompt hints must be compact and placed under the live preview.
- Existing demo data must keep loading when new confirmation fields are absent.

---

### Task 1: Extend Confirmation Types And Defaults

**Files:**
- Modify: `web/app/colorbridge/types.ts`
- Modify: `web/app/colorbridge/confirmation.ts`
- Test: `web/app/colorbridge/confirmation.test.ts`

**Interfaces:**
- Consumes: `ConfirmedRequirement`, `StructuredAnalysis`, `LabValue`
- Produces:
  - `LightingCondition`
  - `ImagePromptHints`
  - `ReferenceSource`
  - extended `ConfirmationDraft`
  - `DEFAULT_LIGHTING`
  - `DEFAULT_IMAGE_PROMPT_HINTS`

- [ ] **Step 1: Write failing tests**

Add tests that assert `buildConfirmationDraft` fills new defaults, preserves new confirmed fields, and `confirmationDraftToRequirement` emits the extended JSON.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- confirmation.test.ts`

Expected: FAIL because the new fields are not defined.

- [ ] **Step 3: Implement minimal type and helper changes**

Extend `ConfirmedRequirement` and `ConfirmationDraft` with review light source, lighting condition, tolerance mode, note, image prompt hints, and reference source.

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test -- confirmation.test.ts`

Expected: PASS.

### Task 2: Add Lightweight Preview Color Helpers

**Files:**
- Modify: `web/app/colorbridge/color-utils.ts`
- Test: `web/app/colorbridge/color-utils.test.ts`

**Interfaces:**
- Consumes: `LabValue`
- Produces:
  - `previewLabForIlluminant(lab: LabValue, illuminant: string): LabValue`
  - `lightingRiskLabel(illuminant: string, reviewIlluminant: string): string`

- [ ] **Step 1: Write failing tests**

Add tests that verify D65 returns the original Lab, A light warms the preview, and TL84 review light creates a non-empty risk label.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- color-utils.test.ts`

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement minimal helper functions**

Use small deterministic Lab offsets for preview only.

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test -- color-utils.test.ts`

Expected: PASS.

### Task 3: Replace Step 3 UI

**Files:**
- Modify: `web/app/page.tsx`

**Interfaces:**
- Consumes:
  - extended `ConfirmationDraft`
  - `draftTargetLabToValue`
  - `previewLabForIlluminant`
  - `lightingRiskLabel`
- Produces:
  - Step 3 visual cards for AI extracted parameters, live confirmed parameters, and historical/fallback reference
  - live preview section with compact image hints
  - clear white confirmation parameter display

- [ ] **Step 1: Update imports and derived state**

Import the new helpers and derive AI Lab, draft Lab, reference Lab, live preview colors, and right-panel summary values.

- [ ] **Step 2: Replace Step 3 markup**

Replace the current two-column form with the approved layout.

- [ ] **Step 3: Preserve existing confirmation action**

Keep `confirmRequirementAction` using `confirmationDraftToRequirement(form)`.

### Task 4: Synchronize Right-Side Panel

**Files:**
- Modify: `web/app/page.tsx`

**Interfaces:**
- Consumes: same derived draft state as Step 3
- Produces: right-side target Lab block and current decision panel reflecting live draft, light source, reference source, and confirmation note.

- [ ] **Step 1: Replace target Lab summary**

Show live draft Lab when editing, confirmed Lab after save, and AI fallback when neither exists.

- [ ] **Step 2: Expand current decision summary**

Show AI target, fabric, main light source, review light source, base cloth, tolerance, reference source, selected case, selected sample, and AI source.

### Task 5: Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run focused tests**

Run: `pnpm test -- confirmation.test.ts color-utils.test.ts`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: PASS or only pre-existing warnings unrelated to this change.

- [ ] **Step 3: Run build if lint passes**

Run: `pnpm build`

Expected: PASS.
