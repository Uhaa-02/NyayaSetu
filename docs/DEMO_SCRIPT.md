# Demo Script (about 4-5 minutes)


> **Real staff e-mails (this build).** `data/staff.csv` replaces three demo accounts with real addresses. Sign in (password `Demo@1234`) as
> `chairmannyayasetu@gmail.com` (Chairman Office), `vigneshkalakuntla.cs@gmail.com` (Head, Regulation Bureau) or
> `battuuhasubhadra@gmail.com` (Head, PGRC). The other demo logins below are unchanged, except that `head@nyayasetu.demo` and
> `head.regulation@nyayasetu.demo` no longer exist. Overlap alerts go to the heads and the officers working on the same institution.
**Before the demo**
* Run `npm run seed` right before presenting so the SLA and overlap data are fresh.
* Sign in once, then sign out, to warm up the server (first request on Vercel is slowest).
* Record a 2-minute backup video.
* Have three tabs ready: public site, a normal window and an incognito window.

## 1. The problem (20 s)
"The same institution can have cases with the Regulation Bureau, the Grievance Cell and others at once. No one sees the whole picture, so actions overlap. NyayaSetu gives one view per institution and flags the overlap."

## 2. One complaint, matched to the institution (40 s) - incognito, `/submit`
1. Type institution as **"ACE Engg College"** (state Telangana). Note the suggestion list.
2. Sample text: *"The admission staff demanded a cash donation of two lakh rupees for a seat, over and above the official fee."*
3. Submit; show the complaint ID, category and routed bureau. Open `/track` with ID + email to show the citizen view (no internal notes).

## 3. The overlap alert (70 s) - `chairman@nyayasetu.demo`
1. Dashboard: red banner **"Potential Overlapping Cases – Coordination Required"**, KPI cards (pending, under process, disposed, transferred, overdue).
2. Open **Overlap monitor**. Pick **KLR College of Engineering Technology (1-46222649885)**: several bureaus including RB and PGRC are handling open cases. (Overlaps come from the seed; if it was re-seeded with different data, pick any row marked RB + PGRC.) Point out the severity and that a few of these cases were typed with different spellings but matched by ID.
3. Open two of its cases, link them, then **Coordinate**: choose lead bureau, add a note. The status changes to *Coordinated*.

## 4. Case tracking and history (45 s)
Open one case: assigned bureau and officer, last action, next action and due date, expected disposal date, timeline with a transfer between bureaus, supporting documents.

## 5. Institution profile (30 s)
Institutions -> KLR College of Engineering Technology (or ACE Engineering College): Permanent ID, address, region, bureau mix, full complaint history.

## 6. Bureau view and read-only coordination (40 s)
Sign in as `head.regulation@nyayasetu.demo`: only RB cases are editable; open a PGRC case on the same institution: read-only banner, complainant contact hidden. Optionally show `regional.south@nyayasetu.demo` seeing every bureau but only South Central.

## 7. Alerts and reports (45 s) - back as Chairman
1. **Alerts**: overlaps, breached and approaching timelines, pending reminders. If e-mail is on, click **Send test email**, and show the inbox: submit a complaint and the receipt and overlap alert arrive by e-mail. Click **Run SLA check** on the dashboard to see automatic escalation (audit trail: "SLA breached. Auto-escalated...").
2. **Reports**: bureau-wise, then ageing or overlap report; **Download CSV**.

## 8. Close (20 s)
"One institution, every bureau, one picture. Overlaps found automatically, coordination recorded, deadlines watched, reports ready. Next: WhatsApp/SMS alerts, file uploads, sync with the official institution database and SSO."

---

> The demo uses the 103 real Telangana institutions in `data/institutions.csv`. Complaints are sample data. Open the Overlap monitor after seeding and confirm which institutions show RB and PGRC together.

---

# Likely judge questions

**How is this different from CPGRAMS or a normal ticketing tool?**
Those track a complaint through a department. NyayaSetu's unit is the institution: it finds when several bureaus act on the same one, even if complaints are worded differently, and supports coordinating them. (Verify current details of existing systems before quoting them.)

**How does it know two complaints are about the same institution?**
Each complaint is matched to an institution registry by AICTE Permanent ID, exact normalised name, or fuzzy name matching (abbreviations, typos, state check). Overlap detection then groups by institution ID. Unmatched names are kept as unverified records.

**What if the match is wrong?**
Fuzzy matches need a minimum score and margin over the next best; ambiguous names are not merged. Unverified entries can be reviewed by staff.

**Is the AI real or just rules?**
Default is explainable rules, which suits a regulator. An optional LLM refines category and summary and always falls back to rules. Overlap detection itself is deterministic.

**Is the overlap alert only a notification?**
No. Officers can link cases and record a lead bureau and decision. If another bureau joins later, it returns to "Coordination Required".

**Who can see what?**
Enforced on the server: officers their queue, bureau heads their bureau, Regional Offices their region, Chairman everything. Other bureaus get a read-only view with complainant contact hidden. The public tracker never shows internal notes.

**Does it send e-mail or SMS?**
E-mail, yes (optional, through Resend): receipts, assignments, escalations, overlap alerts and reminder digests. SMS/WhatsApp is future scope.

**Can it scale?**
MongoDB Atlas with indexes and serverless functions. For national volume: aggregation pipelines for analytics, caching, a shared rate-limit store.

**How would it connect to AICTE systems?**
Intake and bulk import are API-based; the institution registry can be synchronised from the official database; login can move to AICTE single sign-on.

**Is real data used?**
The institution registry (103 Telangana institutions, with AICTE Permanent IDs) comes from AICTE's public list. People and complaints are synthetic sample data.
