# ColorBridge Tuning Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable Chainlit-side ColorBridge demo flow: user intent -> historical batch match -> parameter adjustment advice -> optical/light-source risk summary.

**Architecture:** Keep the current `xiaolai` Python/Chainlit app. Add a small pure-Python business module with seed data and deterministic tuning rules, then call it from `app.py` before the LLM response so the agent can answer with grounded historical references. Database access remains swappable because the current PostgreSQL connection is not reachable from this workspace.

**Tech Stack:** Python 3.11, Chainlit, OpenAI-compatible streaming client, stdlib `unittest`.

## Global Constraints

- Do not create a separate project folder.
- Do not change the database schema in this pass.
- Do not add new dependencies unless a required runtime import is missing.
- AI wording must say it gives an adjustment direction based on history and rules, not an automatically correct production recipe.
- New business logic must have a small runnable test using stdlib `unittest`.

---

## File Structure

- Create: `colorbridge_data.py`
  - Holds demo `intent_request`, `historical_batch`, and `batch_match` seed data with field names aligned to the database table plan.
- Create: `colorbridge_tuning.py`
  - Pure functions for intent matching, historical match lookup, success range computation, parameter deviation, risk level, adjustment advice, and light-source preview summary.
- Create: `tests/test_colorbridge_tuning.py`
  - Tests the core behavior without Chainlit or network calls.
- Modify: `app.py`
  - Adds ColorBridge system prompt, recognizes ColorBridge-related messages, generates grounded context from `colorbridge_tuning.py`, and feeds it to the LLM.
- Create: `docs/development/colorbridge-tuning-agent-dev.md`
  - Development document describing what was implemented, how files map to the flow, and how to run tests.

## Task 1: Pure Tuning Logic

**Files:**
- Create: `tests/test_colorbridge_tuning.py`
- Create: `colorbridge_data.py`
- Create: `colorbridge_tuning.py`

**Interfaces:**
- Produces:
  - `find_intent(text: str) -> dict`
  - `matches_for_intent(intent_id: str) -> list[dict]`
  - `selected_batch_for_intent(intent_id: str) -> dict | None`
  - `build_tuning_summary(text: str) -> dict`
  - `format_tuning_summary(summary: dict) -> str`

- [ ] **Step 1: Write failing tests**

Use `unittest` to assert:

```python
def test_fog_blue_selects_success_batch(self):
    summary = build_tuning_summary("客户要高级一点的雾霾蓝，别太紫，做在棉针织上")
    self.assertEqual(summary["intent"]["id"], "intent_demo_fog_blue_cotton")
    self.assertEqual(summary["selected_batch"]["id"], "hist_cotton_fog_blue_001")
    self.assertEqual(summary["risk_level"], "低")
```

```python
def test_risky_nylon_case_reports_adjustment_direction(self):
    summary = build_tuning_summary("锦纶塔丝隆深紫色上次偏深，这次怎么调安全")
    advice = "；".join(summary["advice"])
    self.assertIn("升温", advice)
    self.assertIn("pH", advice)
    self.assertIn(summary["risk_level"], {"中", "高"})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `uv run python -m unittest tests.test_colorbridge_tuning -v`

Expected: fail because `colorbridge_tuning` does not exist.

- [ ] **Step 3: Add minimal seed data**

Add only the four demo intents and the subset of historical batches needed by the tests plus top matches. Keep field names aligned with `docs/superpowers/specs/2026-07-12-colorbridge-demo-history-seed-data.md`.

- [ ] **Step 4: Add minimal implementation**

Implement keyword-based intent selection, selected match lookup, simple risk rules based on selected batch `rft`, and advice text based on `result_note` plus process parameters.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `uv run python -m unittest tests.test_colorbridge_tuning -v`

Expected: all tests pass.

## Task 2: Chainlit Integration

**Files:**
- Modify: `app.py`

**Interfaces:**
- Consumes: `build_tuning_summary(text: str) -> dict`, `format_tuning_summary(summary: dict) -> str`
- Produces: a grounded ColorBridge context appended to LLM messages for relevant user inputs.

- [ ] **Step 1: Add import**

```python
from colorbridge_tuning import build_tuning_summary, format_tuning_summary
```

- [ ] **Step 2: Replace generic system prompt**

Use a ColorBridge-specific prompt that tells the model to use historical batches and describe advice as adjustment direction.

- [ ] **Step 3: Add a small router**

For messages containing textile/color/dyeing keywords, build a tuning summary and append it as a system message before calling the model.

- [ ] **Step 4: Show deterministic context in a Chainlit step**

Use `@cl.step(name="🔎 ColorBridge 历史匹配", type="tool")` to expose the deterministic summary.

- [ ] **Step 5: Run tests**

Run: `uv run python -m unittest tests.test_colorbridge_tuning -v`

Expected: all tests pass.

## Task 3: Development Document

**Files:**
- Create: `docs/development/colorbridge-tuning-agent-dev.md`

**Interfaces:**
- Documents: current scope, data source, flow, file responsibilities, test command, database note.

- [ ] **Step 1: Document current implementation**

Include:

- Why this is in the current Python/Chainlit branch.
- Which data is seed data and which is future database data.
- The exact demo flow.
- How to run tests.
- How to later replace seed data with PostgreSQL queries.

- [ ] **Step 2: Verify no unfinished markers**

Search the document for unfinished-marker words; expected: no matches outside this plan instruction.

## Self-Review

- Spec coverage: covers intent, history match, similar case advice, light-source risk wording, and development documentation.
- Deferred: real PostgreSQL repository, full UI cards, PDF/export, production execution tracking.
- Reason for deferral: current branch is a Chainlit shell and the configured PostgreSQL server closes the connection from this workspace.
