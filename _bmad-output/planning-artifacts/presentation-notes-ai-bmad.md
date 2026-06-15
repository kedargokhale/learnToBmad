# AI + BMAD Presentation Notes

Date: 2026-06-15
Audience: Mixed dev + product + QA (including senior audience)
Tone: Honest, reflective, technical-practical

## Step 1: Your Confirmed Inputs

1. Goal: Share your learning, wins, and failures.
2. Audience: Mixed developers, product, and QA.
3. Core learning: The AI-developer relationship feels like client-vendor communication, with similar communication gaps.
4. Biggest struggles:
   - Reviewing AI-generated artifacts.
   - Deviations AI takes from what you expect.
5. Tone preference: Honest, reflective, technical-practical.

## Step 2: Your Core Message Inputs

1. Biggest win:
   - Development pace definitely increases.
   - Biggest win is when manipulating test data.
2. Failure that taught most:
   - Trying to create the perfect prompt, even after deep thinking.
3. Day-to-day change:
   - Pause before hitting Enter.
   - Make prompts detailed but specific.
   - Add correct context, information, and explicit boundaries on what not to do.
   - Key insight: prompt quality changes everything.
4. What colleagues should do next:
   - Write better prompts.

## One-Page Narrative (Non-Lecture)

This was a practical experiment, not a theory exercise. I built with Copilot and BMAD to see what actually holds up under delivery pressure.

The clearest win was speed. Development pace increased, especially when working with test data. Creating, mutating, and validating test scenarios became much faster, and that shortened feedback loops.

The hard part was output drift. AI sometimes deviated from what I expected, especially when my requirement was ambiguous. Reviewing AI-generated artifacts became a core part of the work.

A key failure was trying to write a perfect prompt. Even with deep thinking, perfection is unrealistic. The practical shift was to focus on precision and constraints: clear context, expected output, and what not to do.

My day-to-day workflow changed in one important way: I pause before sending prompts. That pause improved quality and reduced rework.

My takeaway is simple: prompt quality is now an engineering skill. AI can accelerate delivery, but only when communication is clear and review is disciplined.

The one action I want colleagues to take tomorrow is straightforward: write better prompts. Not longer prompts. Better prompts.

## 90-Second Version

I ran this as a practical experiment: build a real app using Copilot plus BMAD and see what actually works under delivery pressure.

Biggest win: pace increased. The strongest gain was around test data work. Generating cases, adjusting edge cases, and validating behavior became much faster.

Biggest struggle: output drift. AI often deviated from what I expected, especially when requirements were slightly ambiguous. Reviewing AI-generated artifacts became a real part of the job.

My failed assumption was trying to write a perfect prompt. What worked instead was writing a clear prompt with boundaries: context, expected output, and explicit do-not-do instructions.

My working model now is simple: AI behaves like a vendor. If my brief is vague, I get rework. If my brief is sharp, quality goes up.

What changed day to day is one habit: pause before Enter. That improved output quality more than any tooling change.

My takeaway for the team is practical: do not just use AI. Manage AI. Write better prompts, then review output like production code.

## 5-Minute Version

I want to keep this practical. This was not a research project. It was a hands-on build using Copilot and BMAD to see what survives real execution.

The first clear outcome was speed. Development pace definitely improved. The biggest boost came from test data workflows: building data sets, mutating them, and checking outcomes quickly. That shortened feedback loops and helped me iterate faster.

But speed came with cost if I was not careful. The core issue I hit repeatedly was deviation from intent. AI output looked plausible, but it could drift from what I actually wanted. That made artifact review a central task.

I also learned something the hard way: trying to craft a perfect prompt is not the answer. Even after deep thinking, perfect prompts are unrealistic. What works is prompt structure:

- Clear context
- Specific expected output
- Constraints
- Explicit do-not-do boundaries

That changed my workflow in a concrete way. Before I hit Enter, I pause and tighten the prompt. That single habit reduced rework more than anything else.

My mental model now is this: AI is like a vendor relationship. Quality depends on requirement quality. If the brief is fuzzy, output drifts. If the brief is explicit, output improves.

So this is not AI replacing engineering. This is communication quality and review discipline becoming part of engineering.

If I leave one action for tomorrow, it is this: write better prompts before asking AI to generate code. Not longer prompts. Better prompts. Then review output with the same rigor as any critical pull request.

## Delivery Style Notes (For Senior Audience)

- Keep sentences short.
- Use specific examples.
- Admit misses early.
- Avoid framework preaching.
- End with one practical ask.

## Suggested Closing Line

AI helped me move faster, but only when my inputs were precise and my review was disciplined. The biggest improvement did not come from a new tool. It came from writing better prompts and treating output as engineering work, not final truth.

## Q&A Prep (Senior-Friendly)

### One-Line Answers

Q: Did AI improve productivity in measurable terms?
A: Yes, especially in test-data-heavy workflows where iteration speed increased significantly.

Q: Where did AI create the most risk?
A: In requirement drift: outputs that look correct but deviate from expected intent.

Q: What was your biggest mistake?
A: Chasing a perfect prompt instead of writing clear, bounded prompts and iterating.

Q: What changed your outcomes the most?
A: Pausing before Enter to add context, constraints, and explicit do-not-do instructions.

Q: Why use BMAD with Copilot?
A: BMAD gave structure and checkpoints; Copilot gave execution speed inside those boundaries.

Q: Is this production-ready as a team practice?
A: Yes, if paired with review discipline, acceptance criteria, and regression testing.

Q: What should the team do tomorrow morning?
A: Standardize prompt quality for code tasks and review AI output like any critical pull request.

### If They Ask for Proof

Q: How do you know prompt quality was the main lever?
A: Better prompt specificity consistently reduced rework and alignment corrections.

Q: How did you control hallucinated or off-target output?
A: By tightening task boundaries, stating exclusions, and validating against expected behavior.

Q: What should not be delegated fully to AI?
A: Final decisions on architecture tradeoffs, edge-case risk, and production acceptance.

### If They Challenge the Vendor Analogy

Q: Why compare AI to a vendor?
A: Because output quality tracks briefing quality, and unclear requirements create costly rework in both cases.

Q: Is AI then just another outsourcing layer?
A: No, it is closer and faster than outsourcing, but it still demands explicit communication and governance.

## Interactive Discussion Framework: BMAD Commands and Prompt Drift

Purpose: review what you ran, what worked, where drift happened, and why course correction was necessary, without turning this into a long lecture.

### Evidence Scope (What we can prove now)

- Implementation artifacts explicitly record workflow activation for `bmad-create-story` and `bmad-dev-story`.
- Sprint records show two approved course corrections (`cc-2026-05-19`, `cc-2026-05-25`) and their triggers.
- Change proposals document why `correct-course`-style intervention was needed.
- Raw chat prompt log is not recoverable from current `main.jsonl` (it contains only session start in this environment), so prompt examples below are reconstructed from artifacts and your recollection.

### Phase 1 (5 mins): Command-by-Command Review

Use this in discussion. Keep each answer to 1-2 lines.

| Command / Workflow | Why you used it | What worked | What did not | Drift signal |
| --- | --- | --- | --- | --- |
| `bmad-create-story` | Turn planning artifacts into implementation-ready story context. | Strong context loading from PRD/architecture/UX; clear acceptance criteria and guardrails. | Can still encode wrong assumptions if upstream requirement wording is ambiguous. | Story intent differs from real user behavior later discovered. |
| `bmad-dev-story` | Implement stories with tests and artifact updates. | Fast implementation and validation loops (`pnpm test`, `pnpm build`) with traceability. | Verbose or repetitive UX copy occasionally slipped in. | UI labels/copy drift from intended minimal action language. |
| `bmad-correct-course` (process) | Realign when delivered behavior mismatched intent. | Captured trigger, impact, and concrete artifact changes with approval trail. | Adds overhead mid-sprint if done late. | Repeated confusion in onboarding/account scope behavior. |
| Review workflows (`bmad-review-*`) | Gap sweep and edge-case triage before further epics. | Good at finding hidden risks when explicitly requested. | If delayed, debt accumulates in deferred-work list. | Known unresolved parser/account-scope edge issues. |

### Phase 2 (7 mins): Prompt Pattern Triage

Discuss prompts as patterns, not exact text.

Patterns that worked best:
- Context + objective + constraints + explicit do-not-do boundaries.
- Behavior-preserving prompts ("change copy only, preserve save gates/state machine").
- Test-first or red-green prompts tied to acceptance criteria.

Patterns that drifted:
- Broad prompts with outcome but no boundaries.
- Prompting for UI simplification without stating non-negotiable safety semantics.
- Assuming model inferred account scope intent without explicit all-accounts wording.

Correction moves that reduced drift:
- Pause-before-Enter prompt review.
- Add deterministic acceptance checks before implementation.
- Require explicit artifact + test updates in same task.

### Phase 3 (5 mins): Why Correct-Course Was Needed (Your Story)

Use these two concrete incidents:

1. `cc-2026-05-19` onboarding flow
- Problem: app prompted account setup too early (clean-start friction).
- Expected: empty dashboard first; prompt account confirmation only on qualifying Save.
- Why correction: implementation and intended journey diverged.

2. `cc-2026-05-25` multi-account + capture clarity
- Problem: ledger/history felt single-account and ambiguous; capture UI felt cluttered.
- Expected: all-accounts default with explicit filter/scope labeling; concise `Save` action.
- Why correction: trust and clarity risk in core read/save flows.

### Phase 4 (3 mins): Keep-It-Short Conclusions

Use this summary format live:
- What BMAD command gave highest leverage?
- Which prompt style created most drift?
- What correction policy should be standard for team use?

Suggested answer skeleton:
- Highest leverage: story creation plus dev execution with explicit acceptance tests.
- Most drift: ambiguous prompts lacking boundaries on behavior preservation.
- Standard policy: trigger `correct-course` whenever observed behavior contradicts intended workflow, and update PRD/Epics/UX plus sprint-status in one loop.

### Presenter Cue Card (30 seconds)

"The biggest lesson was not just which BMAD command to run. It was when to intervene. `create-story` and `dev-story` gave speed, but `correct-course` protected intent when behavior drifted. Prompt quality determined whether AI accelerated delivery or accelerated rework."

## Your Discussion Answers (Confirmed)

### 1. Highest-Leverage Command

`bmad-create-story`

Why:
- Story detailing was the most important step.
- Review at this step was critical.
- If the story detail or its review missed something important, development drifted.
- Good implementation depended heavily on how precise the story context was.

### 2. Verified `correct-course` History

From project artifacts, there were two approved correction points:

1. `2026-05-19` - `cc-2026-05-19-onboarding-flow`
- Reason: the app forced account creation on clean start.
- Expected behavior: dashboard-first opening, with account confirmation only triggered on Save when a new parsed account is detected.
- Why it mattered: first-run friction was breaking the intended low-effort flow.

2. `2026-05-25` - `cc-2026-05-25-multi-account-ledger-and-capture-clarity`
- Reason: ledger/history looked account-ambiguous after multi-account saves, and the capture UI felt cluttered.
- Expected behavior: all-accounts by default, explicit account scope/filtering, and concise primary action label `Save`.
- Why it mattered: this created trust and clarity issues in core read/write flows.

Short interpretation:
- `correct-course` was used when delivered behavior was not wrong technically, but wrong against intended workflow or clarity.
- It acted as a formal reset point between "implemented" and "actually aligned."

### 3. How `correct-course` Felt

It felt like a safety net.

Meaning:
- It prevented drift from becoming permanent.
- It gave a structured way to realign artifacts and implementation without rewriting everything informally.

### 4. Prompt Habit / Supporting Command

Assumption: you meant `bmad-help`.

Why it mattered to you:
- It helped in detailing the prompt.
- It was useful when you needed help framing what to ask next, not just what to build next.

Note:
- I did not find a direct artifact trace of `bmad-help` usage in the current repo outputs, so this point should be presented as your lived workflow insight rather than artifact-proven history.

## 2-Minute Discussion Script

If I look back at what gave me the most leverage, it was `bmad-create-story`. That step mattered more than I first thought. But the bigger lesson was that review was critical at every stage, from planning to implementation. When the story was detailed and reviewed well, development moved cleanly. When something important was missed during review, the drift showed up later and became more costly to fix.

The clearest examples are the two `correct-course` moments I had to use. The first was on 2026-05-19, when onboarding behavior drifted. The app was forcing account creation too early, but the intended behavior was to start from the dashboard and only ask for account confirmation on Save when needed. The second was on 2026-05-25, when multi-account behavior and capture clarity drifted. The ledger view became ambiguous, and the capture UI became heavier than intended.

So for me, `correct-course` was not overhead. It was a safety net. It gave me a structured way to stop, acknowledge that implementation had drifted from intent, and realign the PRD, epics, UX, and implementation direction together.

The other practical thing I would call out is `bmad-help`. It helped me detail prompts better. And that became a major lesson for me overall: the quality of the prompt and the quality of the story definition directly shaped whether AI accelerated delivery or accelerated rework.

One more important learning was testing. AI helped create functional tests and integration tests, and that was useful. But manual testing was what actually exposed the important gaps. That was where the workflow mismatches and clarity issues became obvious.

## One-Page Command Analysis

| Command / Workflow | Why I used it | What worked well | Where drift happened | My correction / lesson |
| --- | --- | --- | --- | --- |
| `bmad-create-story` | To convert broad requirements into an implementation-ready story. | Highest leverage. When story detail was strong, implementation moved fast and stayed aligned. | If the story or its review missed an important behavioral detail, drift showed up later. | Story detailing and story review are the control points for downstream quality. |
| `bmad-dev-story` | To execute a story with implementation, tests, and artifact updates. | Fast delivery loop. Good for turning a prepared story into code plus validation. | It inherited any ambiguity already present in the story or prompt. | Dev speed is only as reliable as story precision and implementation review. |
| `bmad-correct-course` | To formally realign work when output matched code expectations but missed intended behavior. | Strong safety net. It gave a structured way to stop drift and update artifacts plus implementation direction together. | It was needed after important intent gaps were discovered late. | Use it early when behavior contradicts workflow intent, not only when code is broken. |
| `bmad-help` | To frame or sharpen what to ask next. | Useful for detailing prompts and reducing vague asks. | Not artifact-traceable here, so this is based on lived usage rather than repo evidence. | Better prompt framing improved output before implementation started. |
| Review workflows (`bmad-review-*`) | To inspect gaps, edge cases, and quality risks. | This is the most critical control step across planning and implementation. | If review misses something, the drift is almost guaranteed and becomes more expensive later. | Reviews must be deliberate at every stage, not treated as a last-minute check. |
| Manual testing | To validate the real workflow beyond written tests. | Exposed the gaps that automated functional and integration tests did not surface clearly. | Workflow and clarity gaps still slipped past AI-generated tests. | Automated tests are useful, but manual testing is what revealed the actual misalignment. |

### Short Readout Version

- The highest-value command for me was `bmad-create-story` because story quality drove implementation quality.
- The fastest command was `bmad-dev-story`, but it also amplified any ambiguity that already existed.
- The most important safety mechanism was `bmad-correct-course` because it prevented drift from becoming the accepted product behavior.
- The most useful prompt-support habit was using `bmad-help`-style thinking to sharpen the ask before execution.
- The most critical discipline across all stages was review, because once review misses a detail, drift becomes costly later.
- Automated tests helped, but manual testing was what exposed the real workflow gaps.

### What This Means in Practice

- If story definition is weak, AI moves fast in the wrong direction.
- If prompts are vague, review effort goes up.
- If review misses key details early, drift becomes expensive later in the course of development.
- AI can generate useful functional and integration tests, but manual testing is still what reveals workflow gaps.
- If drift is found, `correct-course` should be treated as a control mechanism, not as failure.
