# Sample Test Transcript — OCR to GenAI Document Intelligence Modernization

> **Use:** Paste the body of this transcript (everything below the divider) into the **Workshop Studio → Import from transcript → Paste text** tab once the feature ships. It's calibrated against the seeded demo project (*OCR to GenAI Document Intelligence Modernization*, Demo Global Logistics Client) so the Transcript Intake Agent should produce ~20-30 cards spanning all 10 categories and most personas.

> **Setting:** A 45-minute Microsoft Teams discovery workshop. Participants:
>
> - **Priya N. — VP Operations** (Operations persona)
> - **Marcus T. — CIO** (IT / Executive persona)
> - **Jenna R. — CFO** (Finance / Executive persona)
> - **Sam O. — Head of Engineering** (Engineering persona)
> - **Linda H. — Director of Customer Experience** (Customer Experience persona)
> - **Diego V. — Chief Compliance Officer** (Compliance persona)
> - **Aiden W. — Microsoft Facilitator**

---

**[00:00] Aiden W. (Facilitator):** Thanks everyone for making time. The goal today is to walk away with a shared picture of what's broken in your current document intelligence stack, what good looks like in 90 days, and a couple of executive-ready artifacts you can take to the steering committee on Friday. Priya, want to kick us off with the operational view?

**[00:42] Priya N. (VP Operations):** Sure. The headline is that our document intake operation has become unsustainable. We process about 18,000 freight documents a day — bills of lading, commercial invoices, customs declarations, proof of delivery — and roughly 28% of them kick out as exceptions that a human has to touch. We have a team of forty-two people whose entire job is to look at a scanned PDF on one monitor and retype fields into our TMS on the other. It is soul-destroying work and we lose people every quarter.

**[01:38] Aiden W.:** When you say "exceptions" — what's the typical reason?

**[01:43] Priya N.:** Mostly that the OCR template doesn't match. A vendor changes their invoice layout — moves the PO number from the top-right to the bottom-left — and suddenly our extraction confidence drops below the threshold and the document falls into the exception queue. Onboarding a new vendor document takes us six to eight weeks of template engineering. Six to eight weeks, every time, for what is fundamentally a layout change.

**[02:21] Marcus T. (CIO):** And that's the thing that frustrates me most. The system extracts characters but it doesn't *understand* anything. If I ask it "is this a hazmat shipment?" it has no idea — even though the word "hazardous" appears three times on the document. There's no semantic layer.

**[02:48] Sam O. (Head of Engineering):** From an engineering standpoint, the OCR vendor we use is a black box. We can't fine-tune it, we can't see why a particular field came back at 62% confidence, and the SDK is .NET-only which doesn't fit our newer Python-on-AKS estate. We've been trying to integrate it with our data lake for three years and we're still doing nightly CSV exports.

**[03:30] Jenna N. (CFO):** Let me put numbers on what Priya described. Our document operations cost is currently running at about $14.2 million annually, fully loaded. Of that, conservatively, $9.8 million is the human exception handlers. The OCR licenses themselves are another $1.6 million. And we're seeing the cost-per-document drift up about 6% year over year because the templates rot faster than we can fix them. If we do nothing, by 2028 this is a $19 million line item.

**[04:18] Aiden W.:** That's helpful. What's the target?

**[04:22] Jenna N.:** I'd like to be very direct: I want straight-through processing above 90% on our top five document types within twelve months. If we hit that, my models say we recoup the modernization investment inside the first year. Anything less and the board won't fund this.

**[05:01] Linda H. (CX Director):** Can I add the customer side? Right now our largest enterprise customers — global retailers, you'd recognize the names — they file roughly 1,400 customer-impacting exceptions a month because we're slow. Their SLA is "answer my shipment status query in under four hours." We currently average eleven hours because the data sitting in those scanned documents isn't queryable. Our NPS dropped seven points last year and the head of one of our top-three accounts has put us on probation.

**[05:48] Linda H.:** And the mobile capture problem is real too. About 30% of our proof-of-delivery documents come in as photos taken on a driver's phone — bad lighting, finger over the corner, rotated 90 degrees. The OCR completely falls over and a human ends up keying the whole thing.

**[06:22] Diego V. (CCO):** From a compliance standpoint, I want to flag that whatever we build has to produce an audit trail. Every extracted field needs to be traceable back to the source document, the model version, the confidence score, and the human reviewer if one touched it. We have a customs audit coming up in November and "the AI decided" is not a defensible answer to a regulator. GDPR, customs, sanctions screening — all of it has to hold up.

**[07:10] Diego V.:** Also — and this is a hard constraint — none of the document content can leave our Azure tenant boundary. We are not sending shipping manifests to a US-hosted OpenAI endpoint. It needs to be Azure AI Foundry or equivalent, in our chosen geography, with private endpoints.

**[07:48] Aiden W.:** Marcus, on the technical side, what are the architectural constraints we need to design around?

**[07:53] Marcus T.:** Three things. One: the TMS is an on-prem Oracle stack and replacing it is not on the table for at least three years, so whatever we build has to integrate via the existing REST adapter. Two: we have a Snowflake instance for analytics that nobody on the document team uses today because the OCR output never lands there cleanly — we'd love to fix that. Three: anything we build needs to scale to 25,000 documents per day by end of next year because we're acquiring a regional carrier in Q3.

**[08:42] Sam O.:** And we need a feedback loop. If a human corrects an extracted field, that correction has to go back into improving the model — otherwise we're building static OCR with a fancier name on it.

**[09:15] Priya N.:** What I would love — and tell me if this is unrealistic — is for the exception queue to surface a *recommended* answer alongside each document, so the operator clicks "accept" instead of typing everything from scratch. Even if we only auto-fill 70% of the field correctly, that's a 70% reduction in keystrokes per exception.

**[09:48] Aiden W.:** That's a very implementable idea. Let's hold it.

**[09:55] Jenna N.:** I also want a real-time KPI dashboard. Today I get a monthly PDF report from the document ops team. By the time I see it, I can't act on it. I want straight-through-processing rate, cost-per-document, exception backlog, and SLA breach count — all visible to me, refreshed at least hourly.

**[10:32] Linda H.:** And from the customer side — every shipment query that comes in should be answerable by an agent that has read the documents itself. So when a customer asks "where is order 88421," we don't need a human to dig through PDFs. The system retrieves the document, extracts the relevant status, and answers in plain English with the source attached.

**[11:14] Sam O.:** That's a RAG pattern. Doable. The question is whether we build that on Foundry agents or roll our own orchestration. I'd argue for Foundry because the security story is already done.

**[11:42] Marcus T.:** Agreed. And I want to call out — we tried this two years ago with a "AI startup of the week" vendor and it failed. The failure was not the technology, it was the change management. The operators didn't trust the AI suggestions because there was no explanation. If we don't solve the explainability piece, we will fail again.

**[12:28] Diego V.:** That ties back to my audit trail point. Explainability for the user is the same problem as audit trail for the regulator. Build it once.

**[13:00] Aiden W.:** What about timeline expectations?

**[13:05] Jenna N.:** I do not want another twelve-to-eighteen-month strategy slide deck. I want something measurable in ninety days — even if it's just one document type, one vendor, one geography. Show me real numbers from a real pilot. That's what unlocks the bigger budget.

**[13:38] Priya N.:** I would happily volunteer the European bill-of-lading flow as the pilot. It's about 2,200 documents a day, the exception rate is one of the worst at 34%, and the operations manager there is willing to be a guinea pig.

**[14:12] Marcus T.:** That's a good pilot scope. High enough volume to be meaningful, contained enough to ship in a quarter.

**[14:30] Aiden W.:** Risks we should write down?

**[14:34] Diego V.:** Vendor lock-in to a single model provider. If we go all-in on one Foundry model and they deprecate it, we need to be portable. The architecture should treat the model as a replaceable component.

**[15:00] Sam O.:** Model hallucination on financial fields. If the extractor invents an invoice amount we'll have very unhappy customers and very unhappy auditors. Confidence thresholds and human-in-the-loop on monetary fields are non-negotiable.

**[15:32] Linda H.:** Operator resistance, like Marcus said. We need a proper change program — training, super-users, and a way for operators to flag bad suggestions back to the model team.

**[16:08] Priya N.:** And from my side: peak season. We can't cut over the production system in November or December. Pilot needs to be live and stable by September.

**[16:38] Jenna N.:** One more — and this is the cost of inaction — every quarter we delay this, we are leaving roughly $2.4 million on the table in avoidable exception handling cost. The board is starting to ask why we haven't moved.

**[17:15] Aiden W.:** Last question — what does success look like, in one sentence, from each of you?

**[17:22] Priya N.:** Forty-two people doing more interesting work, and our exception rate down to single digits.

**[17:30] Jenna N.:** Cost-per-document cut by 60% and a board-ready ROI story I can defend.

**[17:38] Marcus T.:** A modern, Azure-native document intelligence platform we can extend to the next ten use cases — not a one-off.

**[17:48] Sam O.:** An architecture where the data scientists, not the OCR vendor, own the accuracy roadmap.

**[17:58] Linda H.:** Customers getting answers in minutes instead of hours, with the source document one click away.

**[18:08] Diego V.:** A system the auditors approve on the first pass.

**[18:15] Aiden W.:** Perfect. I'll have a draft impact statement, a solution map, a 90-day pilot plan, and a KPI framework in front of you by end of day. Thanks everyone.

**[18:30] — End of session —**

---

## Expected extraction (approximate)

Running this transcript through the Transcript Intake Agent should yield something close to this distribution. **This is a quality benchmark, not a strict requirement.**

| Category | Expected count | Likely persona(s) |
|---|---|---|
| Pain Point | 4-6 | Operations, IT, Customer Experience |
| Process Bottleneck | 2-3 | Operations |
| Technical Constraint | 3-5 | IT, Engineering, Compliance |
| Business Outcome | 3-4 | Executive, Finance |
| Customer Impact | 2-3 | Customer Experience |
| Operational Impact | 1-2 | Operations |
| Solution Idea | 3-4 | Operations, Engineering |
| KPI / Metric | 2-3 | Finance, Executive |
| Risk / Dependency | 3-4 | Compliance, Engineering |
| Cost of Inaction | 1-2 | Finance |
| **Total** | **~24-36** | (well under the 50 hard cap) |

Concrete cards we'd expect to see emerge, with the originating quote:

- **Pain Point / Operations / High** — "28% of 18,000 daily freight documents become exceptions requiring manual rekey by a 42-person team." (quote: *"roughly 28% of them kick out as exceptions … we have a team of forty-two people"*)
- **Process Bottleneck / Operations / High** — "Onboarding a new vendor document layout takes 6-8 weeks of template engineering." (quote: *"six to eight weeks, every time, for what is fundamentally a layout change"*)
- **Technical Constraint / IT / High** — "Current OCR extracts characters but lacks any semantic understanding of the document." (quote: *"the system extracts characters but it doesn't understand anything"*)
- **Technical Constraint / Engineering / Medium** — "OCR SDK is .NET-only and incompatible with the Python/AKS data estate." (quote: *"the SDK is .NET-only which doesn't fit our newer Python-on-AKS estate"*)
- **Cost of Inaction / Finance / Critical** — "Annual document operations cost is $14.2M today, projected $19M by 2028 if unaddressed." (quote: *"by 2028 this is a $19 million line item"*)
- **Business Outcome / Executive / Critical** — "Achieve >90% straight-through processing on top-five document types within 12 months." (quote: *"straight-through processing above 90% on our top five document types within twelve months"*)
- **Customer Impact / Customer Experience / High** — "Average shipment-status query response time is 11 hours against a 4-hour SLA; NPS down 7 points." (quote: *"we currently average eleven hours … our NPS dropped seven points last year"*)
- **Customer Impact / Customer Experience / Medium** — "30% of proof-of-delivery documents arrive as low-quality mobile photos that defeat OCR." (quote: *"about 30% of our proof-of-delivery documents come in as photos taken on a driver's phone"*)
- **Risk / Dependency / Compliance / Critical** — "Every extracted field must have full audit trail (source doc, model version, confidence, human reviewer) for the November customs audit." (quote: *"'the AI decided' is not a defensible answer to a regulator"*)
- **Risk / Dependency / Compliance / Critical** — "Document content cannot leave the Azure tenant; Azure AI Foundry with private endpoints only." (quote: *"None of the document content can leave our Azure tenant boundary"*)
- **Technical Constraint / IT / High** — "Solution must integrate with on-prem Oracle TMS via existing REST adapter (no TMS replacement for 3+ years)." (quote: *"the TMS is an on-prem Oracle stack and replacing it is not on the table for at least three years"*)
- **Business Outcome / IT / High** — "Architecture must scale to 25,000 documents/day by end of next year to absorb Q3 carrier acquisition." (quote: *"we're acquiring a regional carrier in Q3"*)
- **Solution Idea / Operations / High** — "Exception queue should surface AI-recommended field values so operators click 'accept' instead of retyping." (quote: *"surface a recommended answer alongside each document, so the operator clicks accept"*)
- **Solution Idea / Engineering / High** — "Human corrections must feed back into model improvement (closed-loop learning)." (quote: *"if a human corrects an extracted field, that correction has to go back into improving the model"*)
- **KPI / Metric / Finance / High** — "Real-time KPI dashboard: STP rate, cost-per-document, exception backlog, SLA breach count — refresh hourly." (quote: *"refreshed at least hourly"*)
- **Solution Idea / Customer Experience / High** — "Customer-facing agent that answers shipment queries by reading source documents directly (RAG over document corpus)." (quote: *"the system retrieves the document, extracts the relevant status, and answers in plain English"*)
- **Risk / Dependency / Engineering / High** — "Treat the foundation model as replaceable to avoid single-vendor lock-in." (quote: *"if we go all-in on one Foundry model and they deprecate it, we need to be portable"*)
- **Risk / Dependency / Compliance / Critical** — "Hard human-in-the-loop on monetary fields to prevent hallucinated invoice amounts." (quote: *"confidence thresholds and human-in-the-loop on monetary fields are non-negotiable"*)
- **Operational Impact / Operations / Medium** — "Cutover blackout window: pilot must be live and stable by September (no go-live in Nov/Dec peak)." (quote: *"pilot needs to be live and stable by September"*)
- **Business Outcome / Executive / Critical** — "Deliver a measurable 90-day pilot (one document type, one vendor, one geography) — not a multi-year strategy deck." (quote: *"I do not want another twelve-to-eighteen-month strategy slide deck"*)
- **Solution Idea / Operations / Medium** — "Pilot scope: European bill-of-lading flow (~2,200 docs/day, 34% exception rate)." (quote: *"I would happily volunteer the European bill-of-lading flow as the pilot"*)
- **Risk / Dependency / Operations / High** — "Operator trust and explainability: prior 2-year-old AI pilot failed on change management, not technology." (quote: *"the operators didn't trust the AI suggestions because there was no explanation"*)
- **Cost of Inaction / Finance / High** — "Each quarter of delay leaves ~$2.4M of avoidable exception-handling cost on the table." (quote: *"every quarter we delay this, we are leaving roughly $2.4 million on the table"*)

If the agent produces something materially different from this — wildly more, wildly fewer, missing whole categories, or fabricating personas not present in the conversation — that's a signal to tune the system prompt.
