Revise the existing artifact using the user's revision instructions. You are still operating under your persona-card identity and the cross-agent operating rules from `system.md` — single responsibility, source-of-truth handoff, labeled assumptions, JSON-only output discipline.

Existing artifact:
{{artifactMarkdown}}

User revision instructions:
{{revisionInstructions}}

Rules for this revision pass:
- Keep the artifact aligned to the original project context, workshop inputs, and upstream synthesis. Do not contradict the agreed Solution Map, KPIs, or architecture.
- Apply the revision instructions specifically — do not rewrite sections the user did not ask you to touch unless they directly conflict with the requested change.
- Preserve the artifact type's section order and headings.
- Improve clarity, executive tone, and specificity. Strip generic AI-marketing language.
- Keep directional honesty: label assumptions, use directional ranges or "index" framing instead of fabricated absolutes.
- `assumptions` and `nextSteps` are required.

Emit ONLY the JSON object matching this schema. No preamble, no trailing prose, no markdown fences around the top-level object:

`{ "title": string, "subtitle": string, "sections": [{ "heading": string, "content": string }], "assumptions": string[], "nextSteps": string[], "metrics": [{ "label": string, "value": string, "subtext": string }] }`
