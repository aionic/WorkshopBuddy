# Sample Test Transcript — TLC Healthcare Member Experience AI Orchestration Modernization

> **Use:** Paste the body of this transcript (everything below the divider) into the **Workshop Studio → Import from transcript → Paste text** tab once the feature ships. It is calibrated as a healthcare-focused discovery workshop so the Transcript Intake Agent should produce ~25-35 cards spanning the major categories: pain points, process bottlenecks, technical constraints, business outcomes, customer/member impact, operational impact, solution ideas, KPIs/metrics, risks/dependencies, and cost of inaction.
>
> **Scenario:** TLC Healthcare is a fictitious regional healthcare payer/provider organization working with Microsoft and Conduent to modernize a fragmented, document-driven member journey across care access, prior authorization, claims, appeals, and service operations. The workshop explores how digital self-service, intelligent intake, AI-assisted orchestration, and human support can be connected into a single compliant experience in a 60-day modernization sprint without replacing core systems.

> **Setting:** A 60-minute Microsoft Teams discovery workshop. Participants:
>
> - **Marisa Chen — CIO, TLC Healthcare** (IT / Executive persona)
> - **Dr. Arun Patel — CCTO, TLC Healthcare** (Clinical Technology / Executive persona)
> - **Elena Brooks — CFO, TLC Healthcare** (Finance / Executive persona)
> - **Nate Williams — SVP Member Operations, TLC Healthcare** (Operations persona)
> - **Grace Kim — Chief Compliance Officer, TLC Healthcare** (Compliance persona)
> - **Tasha Rivera — Chief Customer Officer, TLC Healthcare** (Customer Experience persona)
> - **Megan Lewis — Microsoft Facilitator** (Facilitator / Solution Strategy)
> - **Daniel Ortiz — Conduent Healthcare Solutions Lead** (Business Solution Partner / Healthcare Operations)

---

**[00:00] Megan Lewis (Microsoft Facilitator):** Thanks everyone for joining. Our goal today is to pressure-test a practical 60-day modernization blueprint for TLC Healthcare. We are not here to design a multi-year core replacement program. We are here to identify where the member journey is breaking, where AI and orchestration can simplify the work, and what measurable outcomes we can show in two months. Marisa, can you frame the current state from the IT and executive view?

**[00:46] Marisa Chen (CIO):** Sure. TLC Healthcare has invested heavily in portals, call center tools, claims platforms, and clinical systems, but the member journey still feels stitched together by PDFs, faxes, scanned forms, spreadsheets, and manual handoffs. Our core claims platform is stable, but it is not modern. We are not replacing it in the next three years. So the question is: how do we improve the experience around it without destabilizing the systems that pay claims and support care delivery?

**[01:36] Nate Williams (SVP Member Operations):** From operations, the biggest issue is that every member request creates a trail of disconnected work. A member asks about a prior authorization, uploads a document, calls two days later, then a provider faxes something that ends up in a different queue. We have people reconciling the same case across the portal, CRM, document management, claims, and care management. The member thinks it is one request. Internally, it becomes six different tasks.

**[02:24] Daniel Ortiz (Conduent Healthcare Solutions Lead):** That is exactly the pattern we see across healthcare clients. The opportunity is not just to digitize a form. The opportunity is to turn a fragmented journey into a guided workflow: intelligent intake, document understanding, eligibility and benefit checks, rules-based routing, AI-assisted summarization, and then a human support path when the case needs judgment or compassion.

**[03:05] Tasha Rivera (Chief Customer Officer):** The member experience is painful right now. Our contact center receives about 72,000 member calls a month, and roughly 38% are status inquiries: "Did you receive my document?", "Why was this claim denied?", "Is my prior authorization approved?", "What do I do next?" Many of those calls happen because the member cannot see the state of the workflow. They are not calling because they love the phone channel. They are calling because the digital experience is unclear.

**[03:58] Elena Brooks (CFO):** And the cost shows it. We spend about $18.7 million annually on member service operations tied to claims, authorizations, appeals, and document intake. Call deflection has been promised for years, but we have not delivered it because the portal does not actually resolve the problem. It just lets members upload information into another queue.

**[04:40] Grace Kim (Chief Compliance Officer):** I want to add the compliance lens early. Any modernization has to work within HIPAA, CMS requirements, state Medicaid rules, consent management, and our internal retention policy. If AI is summarizing a denial reason or recommending next steps, we need traceability back to the source document, the benefit rule, the claim record, and the human reviewer when one is involved. We cannot have a black box generating member-facing guidance.

**[05:32] Dr. Arun Patel (CCTO):** Clinically, the biggest pain point is care access. Prior authorization delays are not just administrative issues. When a member is waiting for imaging, a specialty referral, home health, or durable medical equipment, every day matters. We have cases where the clinical criteria are already in the documents, but the information is scattered across referral notes, lab results, scanned PDFs, and provider attachments. The system cannot connect those dots.

**[06:20] Megan Lewis:** Nate, can you quantify the intake problem?

**[06:26] Nate Williams:** We receive around 41,000 documents a week across fax, portal upload, mailroom scanning, provider attachments, and email-based escalations. About 27% of those documents are routed incorrectly on first touch. Roughly 19% are missing required information, but we often discover that three or four days later after a human reviews the file. That delay drives repeat calls, rework, and member frustration.

**[07:17] Daniel Ortiz:** A 60-day sprint can focus on a narrow but meaningful journey. For example: start with prior authorization status and claims denial clarification for Medicare Advantage members. We can create a guided digital intake experience, use AI to classify and summarize inbound documents, orchestrate work across the CRM and claims platform, and give agents a recommended next-best action with citations to the source records.

**[08:05] Marisa Chen:** That sounds promising, but the architecture has to respect our constraints. Our claims platform is an older on-prem system with a limited API layer. We have Salesforce Health Cloud for member service, Azure is our strategic cloud, and our data estate is split between SQL Server, Azure Data Lake, and Snowflake. Anything we build has to integrate with what exists. I cannot approve a solution that requires a rip-and-replace.

**[08:56] Elena Brooks:** Also, this cannot become another innovation pilot that never makes it to operations. I need a 60-day plan with measurable ROI. If we can reduce avoidable calls by even 15% in the pilot population, the business case becomes real. If we just build a cool AI demo, it will not get funded past the first checkpoint.

**[09:42] Tasha Rivera:** For the member, success is simple: "Tell me where my request stands, what is missing, what happens next, and who can help me." Right now, members get generic portal messages like "pending review." That is not an experience. That is a dead end.

**[10:18] Grace Kim:** And member-facing language must be controlled. If a claim is denied, the explanation has to align with approved plan language, regulatory notices, and appeal rights. AI can help draft or summarize, but there must be guardrails. We need content safety, policy validation, and approval workflows for anything that goes to the member.

**[11:02] Dr. Arun Patel:** I agree. The clinical risk is that AI oversimplifies a medical necessity issue. A member may hear "denied" and assume care is unavailable, when the real next step is to submit a missing clinical note or use a different site of care. The workflow should distinguish between administrative incompleteness and true clinical denial.

**[11:48] Megan Lewis:** Daniel, can you describe what Conduent would demonstrate in the session?

**[11:54] Daniel Ortiz:** The demo would show a member starting in digital self-service, asking about a delayed prior authorization. The system identifies the member, retrieves the relevant case, checks document completeness, uses AI to summarize the provider submission, detects that a clinical note is missing, and generates a clear next-step message. If the member escalates to a human, the contact center agent sees the same timeline, the AI summary, source citations, and a recommended action. No one rekeys the story.

**[12:58] Nate Williams:** That would be a major operational improvement. Today our agents spend the first three to five minutes of a call figuring out what happened before they can help. If the agent desktop opened with a case summary, missing item list, and suggested action, average handle time would drop immediately.

**[13:40] Tasha Rivera:** It would also reduce member repeat contacts. Our data shows that 31% of members who call about a claim or authorization call again within seven days. They are not satisfied by the first interaction. They want closure.

**[14:18] Elena Brooks:** Repeat contacts are expensive. Every avoidable call costs us roughly $7.80 in direct service cost, not counting downstream rework. We estimate the current repeat-contact burden is about $3.2 million annually across claims and authorization journeys.

**[14:58] Marisa Chen:** I also want a clean integration pattern. Microsoft Azure AI Foundry for agents and model orchestration makes sense if it can run in our tenant, with private networking, managed identity, and logging into our existing observability stack. We need APIs through Azure API Management, not direct point-to-point integrations from a prototype into claims.

**[15:48] Megan Lewis:** That is aligned with how we would design it. Foundry can support the AI orchestration layer, Azure AI Document Intelligence can classify and extract document content, Azure AI Search can support retrieval over approved knowledge and case documents, and API Management can mediate calls into existing systems.

**[16:26] Grace Kim:** I am comfortable exploring that as long as protected health information stays within our approved boundary. We need role-based access, encryption, audit logs, retention controls, and a clear model evaluation process. I also need to know how we prevent the model from exposing one member's information in another member's session.

**[17:18] Daniel Ortiz:** Conduent's operating model would add the workflow and human support layer. AI does the first pass: classify, summarize, recommend, and route. Human agents remain accountable for decisions that require judgment, regulatory sensitivity, or empathy. We can design exception handling so the system gets smarter from human corrections without letting the model make final determinations in sensitive cases.

**[18:08] Dr. Arun Patel:** That human-in-the-loop principle is essential for clinical workflows. For prior authorization, AI can assemble the evidence packet and flag likely missing elements, but it should not independently approve or deny care. Clinical reviewers need the final say.

**[18:48] Nate Williams:** For the 60-day scope, I would recommend prior authorization status for imaging and durable medical equipment. Those categories have high call volume, lots of document back-and-forth, and clear next steps when information is missing. They are operationally painful but contained.

**[19:36] Tasha Rivera:** I would add claims denial clarification for Medicare Advantage members. It is one of the most emotionally charged journeys. Members do not understand the EOB, denial codes, or appeal options. If we can explain that clearly and safely, it improves trust.

**[20:18] Elena Brooks:** I like both, but we need to pick a pilot that can produce numbers fast. What metrics can we commit to in 60 days?

**[20:34] Daniel Ortiz:** For a controlled pilot population, I would suggest: reduce repeat contacts by 20%, reduce average handle time by 18%, improve first-contact resolution by 15%, classify inbound documents with 85% accuracy, and reduce incorrectly routed work items by 30%. Those are realistic pilot targets if the scope is narrow.

**[21:24] Marisa Chen:** I would add technical metrics: latency under five seconds for agent assist summary retrieval, 99.5% availability for the orchestration layer during business hours, and full audit logging for every AI-generated summary and recommendation.

**[22:02] Grace Kim:** Add compliance quality metrics: zero unauthorized PHI exposure, 100% traceability for member-facing AI-assisted messages, and documented human approval for any denial or appeal-related communication.

**[22:42] Megan Lewis:** Good. Let's talk about risks.

**[22:46] Grace Kim:** The first risk is regulatory interpretation. If AI generates language that sounds like a coverage determination, we could create compliance exposure. The system must distinguish between educational guidance, case status, missing information, and official determinations.

**[23:28] Dr. Arun Patel:** The second risk is clinical nuance. Missing documentation is not the same as lack of medical necessity. We need prompts, workflows, and reviewer controls that preserve that distinction.

**[24:02] Marisa Chen:** The third risk is integration fragility. If the claims API is slow or incomplete, the AI layer could present stale status. We need a source-of-truth strategy and clear fallback behavior when a system is unavailable.

**[24:42] Nate Williams:** Operations risk is agent adoption. If the summary is not accurate, agents will ignore it. We need super-users in the pilot, daily feedback loops, and a way for agents to flag a bad recommendation with one click.

**[25:24] Tasha Rivera:** Member trust is another risk. If the digital experience says "we are working on it" with more polished language but no actual resolution, members will see it as another chatbot. It has to complete work, not just answer questions.

**[26:08] Elena Brooks:** Financial risk is scope creep. Everyone wants their journey included, but the value comes from moving one or two high-volume workflows fast. I want the first 60 days tightly scoped, with a decision gate before expansion.

**[26:54] Megan Lewis:** Let's define the 60-day blueprint at a high level. Day 1 through 10: journey mapping, data access, compliance guardrails, and integration inventory. Day 11 through 30: build intelligent intake, document classification, retrieval, and agent assist. Day 31 through 45: pilot workflow orchestration, human review queues, and member messaging. Day 46 through 60: controlled pilot, measurement, tuning, and executive readout.

**[27:48] Daniel Ortiz:** Conduent can lead the workflow design, operating model, agent desktop experience, and call center readiness. Microsoft can lead the Azure AI architecture, security pattern, integration design, and measurement framework. TLC provides system owners, compliance reviewers, pilot agents, and representative case data.

**[28:36] Marisa Chen:** We can make that work if we avoid a six-month data governance debate. For the pilot, we can use a controlled dataset, approved documents, and API access to case status. Expansion can address the broader enterprise data model.

**[29:18] Grace Kim:** I can support that if compliance is embedded from day one. I want a pre-approved response library, prompt testing, audit sampling, and a sign-off process before any member-facing message is enabled.

**[29:58] Dr. Arun Patel:** Clinical reviewers also need to be embedded. They can validate whether the AI is correctly identifying missing clinical evidence versus medical necessity concerns. That is not something a general-purpose model should infer on its own.

**[30:42] Nate Williams:** For operations, we need training and workflow clarity. Agents should know when to trust the AI summary, when to escalate, and how to correct it. If the system learns from corrections, agents will feel like they are improving the process rather than fighting another tool.

**[31:28] Tasha Rivera:** I also want the member experience tested with real member language. Healthcare language is confusing. "Authorization pending due to incomplete documentation" may be accurate, but members need to know exactly what is missing, who must provide it, and what they can do today.

**[32:16] Elena Brooks:** What is the cost of doing nothing? I want that stated clearly for the executive committee.

**[32:24] Nate Williams:** Operationally, our call volume and document backlog will continue to grow. We are already using overtime during peak periods. If Medicare Advantage membership grows as forecasted, we will need to hire 35 to 50 additional service and back-office staff next year just to maintain today's service levels.

**[33:14] Elena Brooks:** Financially, doing nothing means another $4 million to $5.5 million in avoidable labor, repeat contacts, and rework over the next 18 months. It also means we will keep underperforming on service metrics that affect retention and potentially quality ratings.

**[34:02] Tasha Rivera:** From the member perspective, doing nothing means members keep feeling like they are managing TLC's internal process for us. That is exactly the opposite of what our brand promises.

**[34:38] Grace Kim:** From compliance, doing nothing also carries risk. Manual processes produce inconsistent explanations, incomplete documentation trails, and uneven appeal guidance. A controlled AI-assisted workflow could actually reduce compliance risk if designed correctly.

**[35:24] Megan Lewis:** Let's go around the room. What does success look like after 60 days?

**[35:32] Marisa Chen:** A secure Azure-based orchestration pattern that integrates with our existing systems and can scale beyond the pilot without becoming technical debt.

**[35:46] Dr. Arun Patel:** A workflow that improves care access by identifying missing clinical information earlier and supporting reviewers without automating clinical judgment.

**[36:02] Elena Brooks:** A measurable business case: fewer avoidable calls, lower handle time, reduced rework, and a clear path to savings within the fiscal year.

**[36:18] Nate Williams:** Agents starting the interaction with context instead of hunting through five systems.

**[36:30] Grace Kim:** Auditability. Every AI-assisted recommendation traceable to approved sources, member records, policy rules, and human decisions.

**[36:46] Tasha Rivera:** Members getting clear, personalized, compliant answers about what is happening and what they need to do next.

**[37:02] Daniel Ortiz:** A repeatable model TLC can apply to claims, appeals, authorizations, enrollment, and care management without reinventing the operating model each time.

**[37:20] Megan Lewis:** Excellent. We'll turn this into a workshop readout with the 60-day sprint plan, target metrics, architecture sketch, risk controls, and a decision gate for broader rollout. Thanks everyone.

**[37:40] — End of session —**

---

## Expected extraction (approximate)

Running this transcript through the Transcript Intake Agent should yield something close to this distribution. **This is a quality benchmark, not a strict requirement.**

| Category | Expected count | Likely persona(s) |
|---|---:|---|
| Pain Point | 5-7 | Operations, Customer Experience, Clinical Technology, IT |
| Process Bottleneck | 3-5 | Operations, Customer Experience |
| Technical Constraint | 4-6 | IT, Compliance, Clinical Technology |
| Business Outcome | 4-6 | Executive, Finance, Customer Experience |
| Customer / Member Impact | 3-5 | Customer Experience, Clinical Technology |
| Operational Impact | 2-4 | Operations |
| Solution Idea | 5-7 | Business Solution Partner, IT, Operations, Customer Experience |
| KPI / Metric | 4-6 | Finance, IT, Compliance, Operations |
| Risk / Dependency | 5-7 | Compliance, Clinical Technology, IT, Operations |
| Cost of Inaction | 2-3 | Finance, Operations, Compliance |
| **Total** | **~37-56** | (agent should prioritize and deduplicate to remain under any hard cap) |

Concrete cards we'd expect to see emerge, with the originating quote:

- **Pain Point / Operations / High** — "Member requests fragment into multiple disconnected tasks across portal, CRM, document management, claims, and care management." (quote: *"The member thinks it is one request. Internally, it becomes six different tasks."*)
- **Customer / Member Impact / High** — "38% of 72,000 monthly member calls are status inquiries caused by unclear workflow visibility." (quote: *"roughly 38% are status inquiries"*)
- **Cost of Inaction / Finance / High** — "TLC spends $18.7M annually on service operations tied to claims, authorizations, appeals, and document intake." (quote: *"We spend about $18.7 million annually"*)
- **Risk / Dependency / Compliance / Critical** — "AI-assisted member guidance requires traceability to source documents, benefit rules, claim records, and human reviewers." (quote: *"We cannot have a black box generating member-facing guidance."*)
- **Pain Point / Clinical Technology / High** — "Prior authorization delays affect care access because relevant clinical criteria are scattered across notes, labs, scanned PDFs, and attachments." (quote: *"every day matters"*)
- **Process Bottleneck / Operations / High** — "TLC receives 41,000 documents weekly and 27% are routed incorrectly on first touch." (quote: *"About 27% of those documents are routed incorrectly on first touch."*)
- **Process Bottleneck / Operations / Medium** — "19% of documents are missing required information, but the gap is often found three or four days later." (quote: *"we often discover that three or four days later"*)
- **Solution Idea / Business Solution Partner / High** — "Start with prior authorization status and claims denial clarification for Medicare Advantage members." (quote: *"start with prior authorization status and claims denial clarification"*)
- **Technical Constraint / IT / High** — "Solution must integrate with an older on-prem claims platform, Salesforce Health Cloud, Azure, SQL Server, Azure Data Lake, and Snowflake." (quote: *"Anything we build has to integrate with what exists."*)
- **Business Outcome / Finance / Critical** — "Pilot must produce measurable ROI in 60 days, not just an AI demo." (quote: *"If we just build a cool AI demo, it will not get funded past the first checkpoint."*)
- **Customer / Member Impact / High** — "Members need clear status, missing-item guidance, next steps, and human help when needed." (quote: *"Tell me where my request stands, what is missing, what happens next, and who can help me."*)
- **Risk / Dependency / Compliance / Critical** — "Member-facing language must align with approved plan language, regulatory notices, and appeal rights." (quote: *"there must be guardrails"*)
- **Risk / Dependency / Clinical Technology / Critical** — "AI must distinguish administrative incompleteness from true clinical denial." (quote: *"administrative incompleteness and true clinical denial"*)
- **Solution Idea / Customer Experience / High** — "If escalated to a human, the agent should see the same timeline, AI summary, source citations, and recommended action." (quote: *"No one rekeys the story."*)
- **Operational Impact / Operations / High** — "Agent assist could reduce average handle time by eliminating the first three to five minutes of case reconstruction." (quote: *"agents spend the first three to five minutes of a call figuring out what happened"*)
- **Customer / Member Impact / Medium** — "31% of members who call about a claim or authorization call again within seven days." (quote: *"They want closure."*)
- **Cost of Inaction / Finance / High** — "Repeat-contact burden is estimated at $3.2M annually across claims and authorization journeys." (quote: *"about $3.2 million annually"*)
- **Technical Constraint / IT / High** — "Architecture should use Azure AI Foundry in TLC's tenant with private networking, managed identity, API Management, and observability logging." (quote: *"not direct point-to-point integrations from a prototype into claims"*)
- **Technical Constraint / Compliance / Critical** — "PHI must remain within the approved boundary with role-based access, encryption, audit logs, retention controls, and model evaluation." (quote: *"protected health information stays within our approved boundary"*)
- **Solution Idea / Operations / High** — "AI should classify, summarize, recommend, route, and learn from human corrections while humans remain accountable for sensitive decisions." (quote: *"Human agents remain accountable"*)
- **Risk / Dependency / Clinical Technology / Critical** — "AI can assemble evidence and flag missing elements, but should not independently approve or deny care." (quote: *"Clinical reviewers need the final say."*)
- **Solution Idea / Operations / Medium** — "Pilot scope could focus on imaging and durable medical equipment prior authorization status." (quote: *"high call volume, lots of document back-and-forth, and clear next steps"*)
- **Solution Idea / Customer Experience / Medium** — "Claims denial clarification for Medicare Advantage members could improve trust by explaining EOBs, denial codes, and appeal options." (quote: *"one of the most emotionally charged journeys"*)
- **KPI / Metric / Finance / High** — "Pilot targets: reduce repeat contacts by 20%, reduce average handle time by 18%, improve first-contact resolution by 15%." (quote: *"realistic pilot targets if the scope is narrow"*)
- **KPI / Metric / Operations / High** — "Classify inbound documents with 85% accuracy and reduce incorrectly routed work items by 30%." (quote: *"reduce incorrectly routed work items by 30%"*)
- **KPI / Metric / IT / Medium** — "Agent assist summary retrieval should have latency under five seconds and 99.5% business-hours availability." (quote: *"latency under five seconds"*)
- **KPI / Metric / Compliance / Critical** — "Zero unauthorized PHI exposure and 100% traceability for member-facing AI-assisted messages." (quote: *"100% traceability"*)
- **Risk / Dependency / IT / High** — "Claims API slowness or incomplete data could lead to stale status unless fallback behavior is defined." (quote: *"source-of-truth strategy and clear fallback behavior"*)
- **Risk / Dependency / Operations / Medium** — "Agent adoption depends on accurate summaries, super-users, daily feedback loops, and one-click bad recommendation reporting." (quote: *"agents will ignore it"*)
- **Risk / Dependency / Customer Experience / High** — "The digital experience must complete work, not just provide polished chatbot language." (quote: *"It has to complete work, not just answer questions."*)
- **Risk / Dependency / Finance / Medium** — "Scope creep could dilute pilot value; first 60 days should be tightly scoped with a decision gate." (quote: *"the value comes from moving one or two high-volume workflows fast"*)
- **Cost of Inaction / Operations / High** — "TLC may need 35-50 additional service and back-office staff next year just to maintain current service levels." (quote: *"35 to 50 additional service and back-office staff"*)
- **Cost of Inaction / Finance / High** — "Doing nothing could create $4M-$5.5M in avoidable labor, repeat contacts, and rework over the next 18 months." (quote: *"another $4 million to $5.5 million"*)
- **Business Outcome / Executive / High** — "Deliver a secure Azure-based orchestration pattern that scales beyond the pilot." (quote: *"can scale beyond the pilot without becoming technical debt"*)
- **Business Outcome / Customer Experience / High** — "Members receive clear, personalized, compliant answers about status and next steps." (quote: *"what is happening and what they need to do next"*)

If the agent produces something materially different from this — wildly more, wildly fewer, missing whole categories, missing the healthcare personas, or inventing systems and constraints not present in the transcript — that's a signal to tune the system prompt.
