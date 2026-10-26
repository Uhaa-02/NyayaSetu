# SIH 2026 - Idea Submission Content

Copy the sections you need into the SIH portal / PPT. Edit the team details before submitting.

**Problem Statement ID:** SIH26264
**Organization:** AICTE
**Title:** Integrated Dashboard for Monitoring and Tracking Institution-Related Complaint Cases Across AICTE Bureaus/Cells
**Category:** Software
**Theme:** Smart Automation
**Proposed solution name:** NyayaSetu - Integrated Institution Complaint Monitoring and Status Dashboard

---

## 1. Problem (what is wrong today)
Complaints about one technical institution can reach the Regulation Bureau (RB), the Public Grievance Redressal Cell (PGRC) and other bureaus separately. Each unit tracks its own cases. Nobody can see, in one place, which bureau is dealing with an institution, so actions overlap or conflict, disposal is delayed, and officers cannot easily tell who is responsible for what.

## 2. Proposed solution (what we built)
NyayaSetu is a single-window dashboard where every bureau/cell logs, tracks and coordinates institution-related complaints, with the institution as the unit that ties them together.

1. **Centralised institution profile.** Registry keyed by AICTE Permanent ID with name, address, region, type and the consolidated history of all complaints against that institution.
2. **Complete case tracking.** Unique case ID, date of receipt, category, status, presently assigned bureau and officer, last action, next action required, date of last action and expected disposal date.
3. **Cross-bureau overlap detection.** Cases are matched to the institution by data matching (ID, normalised name, fuzzy match), not by wording. When RB, PGRC or other bureaus have open cases on the same institution, the system shows **"Potential Overlapping Cases – Coordination Required"**, scores severity, and alerts authorised officials.
4. **Link and coordinate.** Officers link related cases and record a coordination decision (lead bureau + note). If another bureau later joins, coordination is automatically marked as required again.
5. **Real-time dashboard.** Total, pending, under process, disposed, transferred, escalated and overdue cases; institution-wise status; bureau-wise workload.
6. **Workflow and action history.** Chronological timeline with officer/bureau, time stamp, remarks, supporting documents, transfer and escalation history.
7. **Search, alerts and reports.** Search by institution, Permanent ID, case ID, bureau, region, category, status and date range. Alerts for overlaps, approaching and breached timelines, pending reminders and escalations, shown in the app and optionally sent by e-mail (receipt to the complainant; assignment, escalation and overlap alerts to officers and bureau heads; reminder digests). Bureau-, region-, institution- and status-wise reports, ageing, disposal rate, overlap report, monthly and quarterly performance (CSV / print).
8. **Triage and SLA automation.** AI-assisted category and priority scoring, routing to the least-loaded officer, SLA timers and automatic escalation Officer -> Bureau Head -> Chairman.
9. **Target users covered.** RB, PGRC and other bureaus, Regional Offices (region-scoped view), senior management and the competent authority, plus a public tracker for complainants.

## 3. How it works (technical approach)
* **Frontend:** Next.js 14 (React), Tailwind CSS, Recharts.
* **Backend:** Next.js API routes (Node.js); JWT httpOnly-cookie authentication, bcrypt, role- and region-based access enforced on the server.
* **Database:** MongoDB Atlas. Collections: complaints (with timeline, transfers, links, documents), institutions, overlap records, users.
* **Data matching:** abbreviation expansion, stop-word removal, one-typo tolerance and a state check, resolved against the institution registry. Unmatched names create an unverified record so no case is lost.
* **Overlap engine:** groups open cases by institution ID, counts distinct bureaus, flags RB + PGRC, computes a severity score and compares against recorded coordination.
* **AI layer:** explainable rule-based classifier and priority scorer (works offline); optional LLM refinement with automatic fallback; Jaccard duplicate detection.
* **Deployment:** Vercel + MongoDB Atlas, no servers to manage.

## 4. Innovation / what makes it different
* **The institution is the join key.** Generic grievance portals track a complaint through one department; NyayaSetu detects that several bureaus are acting on the same institution even when the complaints and references look different.
* **Coordination workflow, not just a flag**: link, decide a lead bureau, record the decision; it reopens when circumstances change.
* **Explainable** scoring and matching, suited to a regulator.
* **Role- and region-aware views**: a read-only coordination view lets other bureaus see a case without being able to alter it.

## 5. Feasibility and viability
* Built on widely used open-source technology and free-tier cloud services; one deployment.
* Working prototype: 6 bureau/cell roles plus Regional Offices, a registry of 103 real Telangana institutions (AICTE public list, with Permanent IDs), 260 sample cases including overlapping RB/PGRC cases, 33 automated checks, tested against a real database and in the browser.
* Complaint intake is API-based (`POST /api/complaints`, bulk import), so existing AICTE portals can feed it. The institution registry can be synced from the official database.
* Can start with RB and PGRC and add bureaus as roles, with no code change to the overlap logic.

## 6. Impact
* Reduces duplicate and conflicting parallel action between bureaus.
* Faster disposal through deadlines, reminders and escalation.
* Clear accountability: every case shows who holds it and what happens next.
* Management can monitor institutions and complaints in real time and use the reports for decisions.

## 7. Limitations and future scope
E-mail alerts are optional and working; WhatsApp / SMS are next. Supporting documents are stored as links (file upload needs object storage). Triage is rule-based; a trained ML model needs real labelled data. The prototype covers Telangana only and the complaints are sample data; production would sync with the official AICTE database and use AICTE single sign-on. Multilingual intake and semantic duplicate search are further steps.

## 8. Tech stack (one line, for forms)
Next.js, React, Tailwind CSS, Recharts, Node.js, MongoDB Atlas, JWT, bcrypt, Vercel; optional LLM API for classification.

## 9. Team
Team name: Uha
Members: *(add names, roles and college)*
Links: *(GitHub repository, live demo URL, demo video)*
