# Ambient Skill Companion Design

Date: 2026-06-29
Status: approved for planning

## Goal

Shift Vibe Coding Companion from a Dashboard-first prompt coach into a low-friction ambient companion for Codex and Claude Code. The companion should mostly respond through character motion while the user works, and only show a short skill recommendation when the signal is high confidence and low interruption.

This design includes the previously aligned requirements:

- The companion is not an extra prompt-writing step.
- Typing activity should primarily trigger animation, not text advice.
- Proactive text advice is limited to skill recommendations.
- Installed skills are scanned broadly, but proactive bubbles show only one high-confidence recommendation.
- Work events take priority over prompt drafts.
- Codex / Claude Code focus changes can trigger lightweight handoff memory.
- Feedback and metrics stay local and avoid storing prompt content.

## Target User

The first target user is a new or early-stage vibe coder who is using Codex or Claude Code and likes a companion-style interface, but does not want another workflow step. They need help recognizing which agent workflow or skill fits the current situation, especially when they are debugging, improving UI, planning a product idea, or unsure how to continue.

Advanced users are supported indirectly through installed-skill matching and lower interruption, but they are not the primary optimization target for this version.

## Product Behavior

The core experience happens beside Codex or Claude Code, not inside the Dashboard.

While the user is typing, the companion enters a typing motion state. It may look at the prompt area, hold a note, bounce gently with typing rhythm, or pause into an observing pose. It does not show text just because the user is typing.

When the user stops typing and the draft is long enough to classify, the system may evaluate the draft for skill recommendation. It still stays quiet unless the recommendation is high confidence and not suppressed by cooldown or feedback.

When work events arrive, they override prompt-draft recommendations. For example, failed tests should favor a debugging recommendation even if the current prompt is vague.

When the user switches between Codex and Claude Code, the system records lightweight handoff state. If the new tool has no immediate context and the previous tool had a clear recent activity, the companion may show one handoff recommendation.

The proactive bubble format is fixed:

```text
先做一個具體動作。可用 skill-name。
```

Examples:

```text
先縮小錯誤範圍。可用 diagnose。
先檢查畫面狀態。可用 frontend-design。
先切一個小測試。可用 tdd。
```

The companion never rewrites the full prompt in a proactive overlay bubble. Longer explanations belong in the Dashboard or an expanded detail view.

## Event Model

### `prompt:typing`

Sent when the prompt watcher detects typing activity in Codex or Claude Code.

Purpose:

- Drive the typing animation.
- Show that the companion is following the user's activity.

Constraints:

- Must not include raw prompt text.
- Must not be persisted with content.
- Should include only non-content metadata such as source app, provider, and timestamp.

### `prompt:draft`

Sent only after typing settles long enough and the draft is long enough to classify.

Purpose:

- Rank installed skills for the current draft.
- Produce a skill-only recommendation when confidence is high.

Constraints:

- The raw prompt may be used in memory for classification.
- The event stream must not store the raw prompt.
- Low-confidence or fallback recommendations should return no proactive bubble.

### `agent:focus`

Sent when the foreground agent changes between Codex and Claude Code.

Purpose:

- Maintain lightweight cross-tool handoff memory.
- Detect transitions such as Claude Code to Codex or Codex to Claude Code.

Payload should include:

- `provider`: `codex` or `claude-code`
- `appName`
- `windowTitle` if already available from the existing probe

Constraints:

- Must not read or store conversation text.
- Must not capture screenshots.

### `ai:decision`

Existing decision events remain, but proactive speech should be generated from skill recommendation presentation, not prompt-rewrite advice.

Rules:

- High-confidence skill recommendation may be speakable.
- Low-confidence, fallback, waiting, or repeated recommendations should be quiet.
- Character presentation can change wording and gesture, but must not change the selected skill.

### Companion Feedback Events

These events are local-only metrics:

- `companion:hint_shown`
- `companion:hint_helpful`
- `companion:hint_snoozed`
- `companion:hint_dismissed`

They may store:

- skill name
- source: `work-event`, `prompt-draft`, or `handoff`
- confidence
- scenario category
- timestamp

They must not store:

- raw prompt
- conversation content
- screenshots
- source file contents

## Skill Recommendation

Installed skills are the candidate source. The system should scan all installed skills rather than a fixed whitelist.

Proactive overlay bubbles show only:

- the top-ranked skill
- high confidence or a clearly dominant score
- non-fallback recommendations
- non-repeated recommendations
- recommendations allowed by cooldown and user feedback

The Dashboard may show up to three candidates for debugging or education, but the overlay only proactively presents one.

Common skills can use fixed action copy:

| Skill | Bubble |
| --- | --- |
| `diagnose` | `先縮小錯誤範圍。可用 diagnose。` |
| `frontend-design` | `先檢查畫面狀態。可用 frontend-design。` |
| `tdd` | `先切一個小測試。可用 tdd。` |
| `prototype` | `先做可玩原型。可用 prototype。` |
| `write-a-prd` | `先整理需求範圍。可用 write-a-prd。` |
| `openai-docs` | `先查官方文件。可用 openai-docs。` |

Custom skills use a safe generic format:

```text
先切到合適流程。可用 custom-skill。
```

If a skill name is too long, the overlay should truncate it to keep the bubble compact. The full name can remain visible in the Dashboard detail view.

## Handoff Memory

Handoff memory is lightweight and local.

It should remember:

- last active provider: Codex or Claude Code
- recent work category: UI, bug, test, implementation, planning, or unknown
- recent high-confidence skill
- recent state: typing, testing, error, waiting, or unknown
- timestamp of the last meaningful signal

It should not remember:

- full prompt text
- conversation content
- screenshots
- file contents

A handoff bubble can appear only when:

- the provider changed between Codex and Claude Code
- the previous provider had a meaningful signal in the last 10 minutes
- the new provider has no meaningful event within a short grace period
- the previous context has a high-confidence skill or clear category
- a similar handoff bubble has not appeared recently

Example:

```text
剛才在 Claude 做 UI。先檢查畫面狀態。可用 frontend-design。
```

Handoff reminders appear once per transition window. They should not repeat on quick app switching.

## Overlay Interaction

The overlay is quiet by default.

New or clarified gestures:

- `typing`: active input, no bubble
- `stuck`: typing paused, not enough confidence for a recommendation
- `point`: high-confidence skill bubble
- existing `testing`, `error`, `success`, `waiting`, and `idle` states remain

Proactive bubbles are suppressed when:

- the user is still typing
- the draft is too short
- confidence is low
- the result is fallback only
- the same skill and scenario were recently shown
- the user snoozed that skill or scenario
- the bubble would appear during idle or waiting without high-confidence work context
- the bubble would repeat a recent handoff reminder

The first version supports three feedback actions:

- `有幫助`: record a helpful metric
- `少提醒`: snooze the same skill or scenario
- `知道了`: close this bubble without changing future recommendations

No first-version interaction should automatically insert text into Codex or Claude Code. The companion does not control the agent input box.

## Dashboard Changes

The Dashboard becomes a control, teaching, and diagnostic surface for the ambient companion.

The first screen should communicate:

```text
小精靈會在你使用 Codex / Claude Code 時低調陪伴，只有在高信心時提醒可用的 Skill。
```

Primary sections:

- Companion Stage: current character, current motion state, latest skill hint.
- Live Status: detected provider, typing state, recent focus source.
- Try Skill Hint: a secondary testing area that simulates `prompt:draft` and shows skill recommendations only.
- Feedback Metrics: local counts for hints shown, helpful, snoozed, dismissed.
- Characters: three built-in characters. Character affects presentation only, not selected skill.
- Advanced Diagnostics: hooks, AI key, placement, event stream, and runtime checks. Default collapsed.

The Dashboard should no longer lead with a large "今天想做什麼？" prompt-writing textarea. It should not produce a polished prompt as the main output. If any prompt testing remains, it is explicitly a skill-hint simulator.

## Privacy And Data Boundaries

The design intentionally separates typing presence from prompt analysis.

Typing presence:

- no raw prompt
- no storage of content
- animation only

Draft analysis:

- raw prompt can be used transiently for ranking
- raw prompt is not written to event history
- emitted result contains only skill recommendation metadata

Metrics:

- local-only
- no content
- no screenshots
- no source files

## Success Metrics

MVP success is measured by low interruption, useful recommendations, and felt companionship.

Target metrics:

- In a 30-minute session, proactive bubbles appear no more than five times.
- At least 30% of shown skill hints receive `有幫助`. Automatic workflow-following detection is out of scope for this version.
- At least 70% of users do not snooze or disable hints during their first session.
- Users can understand the companion's current state through motion even when no bubble is shown.

Local metrics for the first version:

- hints shown
- helpful clicks
- snooze clicks
- dismisses
- provider focus changes
- typing events without prompt content

## Testing Requirements

Unit and integration coverage should include:

- `prompt:typing` emits without prompt content.
- `prompt:draft` uses draft content transiently but stores only skill recommendation output.
- Installed skills are ranked broadly.
- Proactive bubbles require high confidence and no fallback-only result.
- Repeated skill and scenario reminders respect cooldown.
- `少提醒` increases suppression for the matching skill or scenario.
- `有幫助` and `知道了` update local metrics correctly.
- `agent:focus` updates handoff memory.
- Handoff bubble appears once only when cross-tool context is meaningful.
- Work events outrank prompt draft recommendations.
- Character presentation does not change the selected skill.
- Dashboard no longer treats polished prompt generation as the primary flow.
- Overlay canvas remains nonblank across desktop and compact viewports.
- Dashboard layout has no major overlap on desktop and mobile widths.

E2E coverage should include:

- Typing simulation triggers motion but no bubble.
- Settled high-confidence prompt draft shows a skill-only bubble.
- Low-confidence draft stays quiet.
- Failed test event recommends a debugging skill before prompt-draft advice.
- Codex to Claude Code or Claude Code to Codex focus switch can produce one handoff hint.
- Feedback buttons update visible metrics.

## Out Of Scope

This version does not include:

- automatic prompt rewriting in proactive bubbles
- one-click insertion into Codex or Claude Code
- full conversation handoff between agents
- cloud sync
- account system
- paid skill marketplace
- screenshot-based continuous monitoring
- storing raw prompt or code content

## Implementation Notes

Expected areas of change:

- `src/prompt-draft-watcher.js`: separate typing activity from settled draft emission and add focus events.
- `src/local-event-server.js`: handle `prompt:typing`, `agent:focus`, and companion feedback events.
- `src/skill-recommender.js`: expose richer ranking metadata or top candidates while preserving installed-skill support.
- `src/prompt-advisor.js` and `src/next-step-advice.js`: shift proactive advice to skill-only presentation.
- `src/companion-brain.js`: enforce speakable thresholds, cooldowns, feedback suppression, and skill bubble copy.
- `src/work-context.js`: track handoff and work-event priority.
- `src/animation-model.js` and overlay rendering: add typing and stuck gestures.
- `src/setup-key.js` and `src/setup-key.css`: reposition Dashboard around ambient companion status, skill hint testing, and local metrics.

Implementation should follow the existing test-driven style in the repository: one vertical behavior slice at a time, with browser verification for overlay and Dashboard changes.
