# Sample Test Transcript — TLC Healthcare Member Experience Modernization

> **Use:** Paste the body of this transcript (everything below the divider) into the **Workshop Studio → Import from transcript → Paste text** tab once the feature ships. It's calibrated against a seeded healthcare-industry demo project (*Member Experience Modernization — TLC Healthcare*) so the Transcript Intake Agent should produce ~24-32 cards spanning all 10 categories and most personas.

> **Setting:** A 60-minute Microsoft Teams discovery workshop co-facilitated by Microsoft and Conduent for **TLC Healthcare**, a regional US health plan with ~2.4M members across commercial, Medicare Advantage, and Medicaid lines of business. The session demonstrates how a fragmented, document-driven member journey — spanning care access, claims, and service — can be re-engineered into a guided, intelligent workflow in **60 days** using AI and orchestration. Participants:
>
> - **Dr. Aisha Rahman — CIO, TLC Healthcare** (IT / Executive persona)
> - **Kwame Osei — Chief Clinical Technology Officer, TLC Healthcare** (Engineering / Clinical persona)
> - **Elena Vargas — CFO, TLC Healthcare** (Finance / Executive persona)
> - **Tom Becker — VP Operations, TLC Healthcare** (Operations persona)
> - **Maya Chen — Chief Compliance Officer, TLC Healthcare** (Compliance persona)
> - **Daniela Ruiz — Chief Customer Officer, TLC Healthcare** (Customer Experience persona)
> - **Olivia Park — Microsoft Healthcare Industry Lead** (Facilitator)
> - **Raj Mehta — Conduent Solution Architect** (Co-facilitator)

---

**[00:00] Olivia Park (Microsoft, Facilitator):** Thanks for the time today. The goal of this 60-minute session is to walk away with a shared picture of what's broken in TLC's current member experience, what good looks like in 60 days — not 18 months — and the outline of a modernization blueprint you can take to your board. Raj from Conduent will show a short reference pattern in the middle. Daniela, do you want to open with the member view?

**[00:48] Daniela Ruiz (Chief Customer Officer):** Happy to. The headline is that our member experience is fundamentally broken at the seams. A typical TLC member touches at least four disconnected channels in a single care episode — our IVR, the member portal, the mobile app, and eventually a phone call to a service rep. Nothing carries context across them. A member who started a prior authorization request in the portal on Monday has to re-explain the whole situation to an agent on Wednesday because none of that context made it into our service platform. Our member NPS is sitting at 14, which is the lowest it's been in five years, and we're losing about 8% of our commercial book at renewal — explicitly citing "hard to deal with" in exit surveys.

**[02:02] Olivia Park:** When you say "document-driven," can you make that concrete?

**[02:08] Daniela Ruiz:** Every meaningful member interaction generates or requires a document — enrollment forms, prior auth requests, claims, EOBs, appeals, ID card replacements, COB questionnaires. We process about 2.1 million member-facing documents a month across all those flows, and roughly 40% of them require some kind of human intervention before they're resolved. Members wait an average of nine days for a prior auth decision. The legal SLA in most of our states is fourteen, but our competitors are at three to five. We are not competitive on speed.

**[03:00] Tom Becker (VP Operations):** Let me pile on with the operational view. We run a 1,400-seat contact center across three sites. Average handle time is now 11 minutes 40 seconds, which is up almost two minutes year over year. The single biggest driver is that the agent is reading PDFs on one screen — plan documents, benefit summaries, prior auth criteria — while talking to the member on another. The plan documents alone are 280 pages each, and we have over 600 active plan variants across our LOBs. There's no way for a human to memorize that. So first-call resolution is at 61% and falling.

**[04:12] Tom Becker:** On the claims side, our auto-adjudication rate is 68%. The industry leaders are at 92-plus. Every percentage point we leave on the table is about $1.4 million a year in rework cost for us.

**[04:38] Elena Vargas (CFO):** Let me put a frame around the money. Our total member services and claims operations cost is running at $312 million annually. Of that, the contact center is $148 million, claims rework is roughly $74 million, and the prior auth team is another $41 million. We are growing membership at 6% a year and our ops cost is growing at 9%. That gap closes the door on profitability in our Medicare Advantage line within about 24 months if we don't intervene. The board has been clear: they will not fund another multi-year transformation. We need to see measurable improvement in 60 to 90 days or the budget moves to a different priority.

**[05:48] Dr. Aisha Rahman (CIO):** And that's the constraint I have to design around. We are not ripping out our core. Our claims and care management runs on a legacy core admin platform — think QNXT-era technology — and replacing it is a five-year, nine-figure conversation that I am not having this year. Whatever we build has to integrate via the existing FHIR and HL7 interfaces and the REST gateway we stood up two years ago. We also have an Epic integration with three of our largest provider partners that cannot be disrupted.

**[06:42] Dr. Aisha Rahman:** Second constraint: we are an Azure shop, and any AI we deploy has to stay inside our Azure tenant. No member PHI leaves our boundary. We're already on Azure AI Foundry for a small clinical summarization pilot, and we want to extend that footprint rather than introduce a new vendor.

**[07:18] Maya Chen (Chief Compliance Officer):** Building on what Aisha said — from a compliance standpoint, this is healthcare, so the bar is high and non-negotiable. HIPAA, obviously. HITRUST certification we have to maintain. State insurance regulations vary across the 14 states we operate in. CMS oversight on the Medicare Advantage side, including Star Ratings, which directly affects our reimbursement. And we have a CMS audit in Q1 of next year.

**[08:10] Maya Chen:** Anything AI-driven that touches a member determination — a coverage decision, a prior auth, a claim — has to be fully auditable. Every output needs to be traceable back to the source document, the plan provision cited, the model version, the confidence level, and the human reviewer if one was in the loop. "The model said so" will not survive a CMS audit, and a denial we can't defend in an appeal will end up in front of a state insurance commissioner. We've seen that movie.

**[09:08] Maya Chen:** And we cannot have the model **make** coverage determinations autonomously. CMS guidance is explicit on that. The AI can prepare, recommend, summarize, draft — a licensed human has to make the final adverse determination. That has to be baked into the architecture, not bolted on.

**[09:55] Kwame Osei (CCTO):** From the clinical-technology side I want to add three things. One: the prior auth criteria documents we get from vendors like MCG and InterQual are themselves long PDFs that change quarterly. Today our nurses search them by hand. That is the single biggest source of variance in our prior auth decisions. Two: our member portal is built on a stack that we will be lucky to keep on life support for another two years, so a new intake experience needs to be deployable as an embeddable component, not a portal rewrite. Three: we have 240 utilization management nurses and 90 case managers whose time is being burned on document handling instead of clinical judgment. That is the real waste.

**[11:18] Olivia Park:** Raj, you want to take ten minutes and walk through what a 60-day intelligent intake pattern could look like?

**[11:25] Raj Mehta (Conduent):** Sure. The pattern we've delivered for three other regional plans this year combines three things. First, an intelligent intake layer — the member, the provider, or the broker enters through a single guided experience, and an agent powered by Foundry classifies the intent, asks the right clarifying questions, and assembles the right document set on the back end. No more wrong-form-submitted, no more incomplete packets. Second, an agent-assist layer for your contact center reps — when a member calls, the rep sees a live summary of the member's history, the relevant plan provision pulled from the 280-page document with the page citation, and a suggested next-best-action. Third, a workflow orchestration layer that ties digital self-service, intelligent intake, and human support into a single compliant flow with an audit trail. We'd ship that as a 60-day pilot scoped to one use case — typically prior auth or claims status — and prove the model end-to-end before scaling.

**[13:48] Tom Becker:** What kind of numbers have those other plans seen?

**[13:53] Raj Mehta:** On the conservative end: 35% reduction in average handle time for the targeted use case, prior auth turnaround time cut from nine days to under three, first-call resolution up 18 to 22 points, and contact-center deflection of 25 to 30% of routine status inquiries into the digital channel. Auto-adjudication has moved 9 to 12 points within six months once the intelligent intake reduces incomplete-submission rework upstream.

**[14:42] Elena Vargas:** Those numbers, if we hit even the low end, easily justify the program. What would the 60-day pilot cost us?

**[14:50] Raj Mehta:** Mid-six-figures all-in for the pilot — Conduent delivery, Foundry consumption, integration work. The bigger question is what we scope into the 60 days. I'd recommend prior auth for one specialty — let's say musculoskeletal, which is high-volume and high-pain — in one state, for one LOB.

**[15:32] Daniela Ruiz:** I'd push for that to be Medicare Advantage MSK in Florida. It's our highest-volume prior auth queue, the member demographic is the most vocal in CAHPS surveys, and Florida is a Star Ratings sensitive market for us.

**[16:08] Dr. Aisha Rahman:** That's a defensible pilot scope. Contained, high signal, and it touches all three layers Raj described.

**[16:30] Olivia Park:** Let's capture the must-haves and the risks. What are the dealbreakers?

**[16:38] Maya Chen:** Three. The audit trail I already mentioned. Human-in-the-loop on every adverse determination, with the model's recommendation visible to the reviewer but not auto-applied. And a model-bias monitoring story — we need to be able to show, by line of business and by protected class, that the model isn't producing disparate impact. CMS and state regulators are both leaning hard on that.

**[17:42] Kwame Osei:** Clinical safety. If the agent surfaces the wrong plan provision to a nurse and she relies on it, that is a patient-safety event in our world. We need confidence thresholds, source attribution on every claim the model makes, and a clinician override path. And a closed loop — when a nurse corrects the model, that correction has to feed back into improving it.

**[18:32] Tom Becker:** Operationally, we cannot cut anything over during open enrollment, which runs October 15 through December 7 for Medicare. So the pilot has to be live, evaluated, and either scaled or shelved by the end of September.

**[19:10] Elena Vargas:** I want a real-time executive view from day one. Not a monthly PDF. I want to see prior auth turnaround time, auto-adjudication rate, average handle time, first-call resolution, and member NPS — refreshed at least daily, drillable to the case level for ops, aggregated for the board. If we can't measure it in real time, I can't defend the spend.

**[20:18] Daniela Ruiz:** And on the member side — every digital interaction needs a graceful handoff to a human. If the intelligent intake can't resolve a case in two turns, the member gets routed to an agent who already has the full context. No "please re-verify your member ID" after a 12-minute chat. That single fix would move our NPS more than anything else.

**[21:25] Dr. Aisha Rahman:** And from the architecture side — I want this designed so the model layer is replaceable. If a better Foundry model ships next year, or we want to swap in a domain-specific clinical model, we should be able to do that without rewriting the orchestration. Treat the model as a pluggable component.

**[22:18] Maya Chen:** One more risk that often gets missed — provider abrasion. If our intelligent intake makes life harder for the provider offices submitting prior auths, they will route around us and we'll see complaints to state regulators within weeks. Provider experience has to be a first-class success metric, not an afterthought.

**[23:08] Tom Becker:** Agreed. And on change management — we tried a chatbot pilot two years ago that the contact center reps essentially boycotted because it surfaced wrong answers and made them look bad in front of members. If the agent-assist suggestions aren't visibly trustworthy from day one, the reps will turn it off and we will have wasted the program.

**[24:12] Elena Vargas:** Cost of doing nothing — let me put a number on it. At our current trajectory, the gap between our ops cost growth and our membership growth burns roughly $18 million in margin per year, compounding. Two years of inaction is a $54 million hole. And that doesn't count Star Ratings exposure on the MA side, which could be another $40-60 million in shared savings revenue if we slip a half-star.

**[25:18] Olivia Park:** Closing the loop — one sentence each, what does success look like at the end of the 60 days?

**[25:26] Daniela Ruiz:** A Florida MSK Medicare Advantage member gets a prior auth decision in under three days, through a single guided experience, and tells us in CAHPS that it was easy.

**[25:42] Tom Becker:** My MSK prior auth queue is half its current size, my nurses are doing clinical work instead of document hunting, and the contact center reps are asking for the agent-assist to be expanded to other queues.

**[26:00] Elena Vargas:** A board-ready dashboard showing five KPIs moving in the right direction, with a defensible projected ROI on scaling the pattern across the rest of prior auth and into claims.

**[26:18] Dr. Aisha Rahman:** An Azure-native, Foundry-based reference architecture I can hand to my other product teams and say "build the next ten use cases on this."

**[26:35] Maya Chen:** Documentation and audit artifacts that I can hand to the CMS auditor in Q1 without flinching, and a bias-monitoring report I can put on the compliance committee agenda.

**[26:52] Kwame Osei:** My UM nurses say the tool actually helps them, the closed-loop feedback is producing measurable model improvement week over week, and we have a path to extend it into utilization management beyond MSK.

**[27:15] Olivia Park:** Perfect. Raj and I will have a draft 60-day pilot plan, a solution architecture, a KPI framework, and a compliance and bias-monitoring outline back to you by end of next week. Thanks everyone.

**[27:32] — End of session —**

---

## Expected extraction (approximate)

Running this transcript through the Transcript Intake Agent should yield something close to this distribution. **This is a quality benchmark, not a strict requirement.**

| Category | Expected count | Likely persona(s) |
|---|---|---|
| Pain Point | 4-6 | Operations, Customer Experience, Clinical |
| Process Bottleneck | 2-3 | Operations, Clinical |
| Technical Constraint | 3-5 | IT, Clinical, Compliance |
| Business Outcome | 3-4 | Executive, Finance, Customer Experience |
| Customer Impact | 2-3 | Customer Experience |
| Operational Impact | 1-2 | Operations |
| Solution Idea | 3-4 | Operations, Customer Experience, Clinical |
| KPI / Metric | 2-3 | Finance, Executive, Operations |
| Risk / Dependency | 4-6 | Compliance, Clinical, Operations |
| Cost of Inaction | 1-2 | Finance |
| **Total** | **~25-38** | (well under the 50 hard cap) |

Concrete cards we'd expect to see emerge, with the originating quote:

- **Pain Point / Customer Experience / Critical** — "Member context is lost across IVR, portal, mobile, and phone channels — members re-explain their case at every touchpoint." (quote: *"a member who started a prior authorization request in the portal on Monday has to re-explain the whole situation to an agent on Wednesday"*)
- **Pain Point / Customer Experience / High** — "Member NPS at 14 (5-year low); commercial renewal loss at 8% citing 'hard to deal with.'" (quote: *"our member NPS is sitting at 14 … losing about 8% of our commercial book at renewal"*)
- **Process Bottleneck / Operations / Critical** — "Prior auth turnaround averages 9 days vs. competitor 3-5 days; 14-day legal SLA." (quote: *"members wait an average of nine days for a prior auth decision … our competitors are at three to five"*)
- **Pain Point / Operations / High** — "Average handle time at 11:40, up ~2 min YoY; agents read 280-page plan PDFs while on call across 600+ plan variants." (quote: *"the agent is reading PDFs on one screen … the plan documents alone are 280 pages each, and we have over 600 active plan variants"*)
- **KPI / Metric / Operations / High** — "First-call resolution at 61% and falling; auto-adjudication at 68% vs. industry-leader 92%+." (quote: *"first-call resolution is at 61% and falling … our auto-adjudication rate is 68%. The industry leaders are at 92-plus"*)
- **Cost of Inaction / Finance / Critical** — "$312M annual ops cost growing 9% vs. 6% membership growth; ~$18M margin burn/year compounding; potential $40-60M MA Star Ratings exposure." (quote: *"the gap between our ops cost growth and our membership growth burns roughly $18 million in margin per year"*)
- **Business Outcome / Executive / Critical** — "Measurable improvement in 60-90 days, not a multi-year transformation — board mandate." (quote: *"the board has been clear: they will not fund another multi-year transformation"*)
- **Technical Constraint / IT / Critical** — "No core replacement — solution must integrate with legacy core admin via existing FHIR/HL7 and REST gateway; Epic integration with top providers must not be disrupted." (quote: *"replacing it is a five-year, nine-figure conversation that I am not having this year"*)
- **Technical Constraint / IT / Critical** — "All AI must stay within TLC's Azure tenant; Foundry-based; no PHI leaves the boundary." (quote: *"any AI we deploy has to stay inside our Azure tenant. No member PHI leaves our boundary"*)
- **Risk / Dependency / Compliance / Critical** — "Full audit trail required on every AI output (source doc, plan provision, model version, confidence, reviewer) for Q1 CMS audit, HITRUST, and state regulators." (quote: *"'the model said so' will not survive a CMS audit"*)
- **Risk / Dependency / Compliance / Critical** — "AI may not autonomously make adverse coverage determinations — licensed human must own the decision (CMS guidance)." (quote: *"a licensed human has to make the final adverse determination"*)
- **Risk / Dependency / Compliance / High** — "Model-bias monitoring required by LOB and protected class to satisfy CMS and state regulators on disparate impact." (quote: *"the model isn't producing disparate impact"*)
- **Technical Constraint / Clinical / High** — "MCG/InterQual prior auth criteria PDFs change quarterly and are searched manually today — single biggest driver of decision variance." (quote: *"the single biggest source of variance in our prior auth decisions"*)
- **Technical Constraint / Clinical / Medium** — "New intake must deploy as an embeddable component, not a member-portal rewrite (portal stack on life support)." (quote: *"a new intake experience needs to be deployable as an embeddable component, not a portal rewrite"*)
- **Operational Impact / Clinical / High** — "240 UM nurses and 90 case managers spend significant time on document handling instead of clinical judgment." (quote: *"240 utilization management nurses and 90 case managers whose time is being burned on document handling instead of clinical judgment"*)
- **Solution Idea / Operations / High** — "Intelligent intake layer that classifies intent and assembles the right document packet up-front to eliminate wrong-form/incomplete rework." (quote: *"no more wrong-form-submitted, no more incomplete packets"*)
- **Solution Idea / Operations / High** — "Agent-assist layer surfacing member history, cited plan provisions, and next-best-action to contact-center reps in real time." (quote: *"a live summary of the member's history, the relevant plan provision pulled from the 280-page document with the page citation"*)
- **Solution Idea / Customer Experience / High** — "Workflow orchestration unifying digital self-service, intelligent intake, and human support into one compliant flow with audit trail." (quote: *"ties digital self-service, intelligent intake, and human support into a single compliant flow with an audit trail"*)
- **Solution Idea / Customer Experience / Medium** — "Graceful digital-to-human handoff: if intake can't resolve in two turns, route to agent with full context preserved." (quote: *"the member gets routed to an agent who already has the full context"*)
- **Business Outcome / Operations / High** — "60-day pilot scope: Medicare Advantage musculoskeletal prior auth in Florida (highest-volume queue, Star-sensitive market)." (quote: *"Medicare Advantage MSK in Florida"*)
- **Business Outcome / Customer Experience / High** — "Target: prior auth decision in under 3 days via a single guided experience, with member-reported 'ease' in CAHPS." (quote: *"a prior auth decision in under three days, through a single guided experience, and tells us in CAHPS that it was easy"*)
- **KPI / Metric / Finance / High** — "Real-time executive dashboard: prior auth TAT, auto-adjudication rate, AHT, FCR, member NPS — refreshed daily, drillable to case." (quote: *"refreshed at least daily, drillable to the case level for ops"*)
- **Risk / Dependency / IT / Medium** — "Architecture must treat the foundation model as a pluggable, replaceable component to avoid lock-in." (quote: *"treat the model as a pluggable component"*)
- **Risk / Dependency / Compliance / High** — "Provider abrasion risk: harder prior auth submission for provider offices will trigger complaints to state regulators." (quote: *"they will route around us and we'll see complaints to state regulators within weeks"*)
- **Risk / Dependency / Operations / High** — "Change management: prior chatbot pilot was boycotted by reps after surfacing wrong answers — agent-assist must be visibly trustworthy from day one." (quote: *"if the agent-assist suggestions aren't visibly trustworthy from day one, the reps will turn it off"*)
- **Risk / Dependency / Operations / High** — "Cutover blackout: pilot must be live, evaluated, and decided by end of September (no go-live during Medicare open enrollment Oct 15–Dec 7)." (quote: *"the pilot has to be live, evaluated, and either scaled or shelved by the end of September"*)
- **Risk / Dependency / Clinical / High** — "Clinical-safety guardrails: confidence thresholds, source attribution, clinician override, and closed-loop learning from nurse corrections." (quote: *"if the agent surfaces the wrong plan provision to a nurse and she relies on it, that is a patient-safety event"*)
- **Business Outcome / IT / High** — "Azure-native, Foundry-based reference architecture reusable across the next 10 use cases." (quote: *"an Azure-native, Foundry-based reference architecture I can hand to my other product teams"*)

If the agent produces something materially different from this — wildly more, wildly fewer, missing whole categories, or fabricating personas not present in the conversation — that's a signal to tune the system prompt.
