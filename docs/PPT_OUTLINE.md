# PPT Outline (12-14 slides)

Headline plus 3-4 short points or one visual per slide. Take screenshots from the running app (log in as the Chairman unless noted).

1. **Title** - NyayaSetu: Integrated Institution Complaint Monitoring and Status Dashboard. SIH26264, Team Uha. *(Dashboard screenshot)*
2. **The problem** - same institution, different bureaus (RB, PGRC...). No shared view: overlapping actions, delays, unclear ownership.
3. **Our solution in one line** - one dashboard where the institution ties every bureau's cases together and overlaps are flagged automatically.
4. **How it works** - complaint in -> match to institution -> triage and route -> track -> overlap detected -> coordinate -> report. *(Flow diagram)*
5. **Centralised institution profile** - AICTE Permanent ID, address, region, consolidated history. *(Screenshot: institution profile, e.g. ACE Engineering College or KLR College of Engineering Technology)*
6. **Case tracking and workflow history** - current bureau and officer, last/next action, expected disposal, timeline with transfers and escalations. *(Screenshot: case page)*
7. **The innovation: cross-bureau overlap detection** - "Potential Overlapping Cases – Coordination Required"; RB + PGRC highlighted; severity score. *(Screenshot: Overlap monitor)*
8. **Data matching** - "ACE Engg College", "ace engineering college, ghatkesar", or just the Permanent ID all resolve to one institution. *(Small table: typed text -> matched institution)*
9. **Coordination workflow** - link related cases, record lead bureau and decision; reopens if a new bureau joins; other bureaus get a read-only view. *(Screenshot: Coordinate tab)*
10. **Real-time dashboard and alerts** - total / pending / under process / disposed / transferred / escalated / overdue; approaching-timeline and pending reminders; in-app alert centre plus e-mail alerts. *(Screenshot: dashboard + alert centre)*
11. **Reports** - bureau, region, institution, status, ageing, overlap, monthly, quarterly; CSV and print. *(Screenshot: reports page)*
12. **Existing solutions vs NyayaSetu** - CPGRAMS / generic ticketing tools track one complaint through one department. NyayaSetu adds the institution view, multi-bureau overlap detection and coordination. *(Comparison table; check the facts before presenting)*
13. **Feasibility, scalability, architecture** - Next.js + API + MongoDB Atlas on Vercel; API intake; indexed queries; bureaus are configuration; starts with RB + PGRC. *(Architecture diagram)*
14. **Limitations and future scope** - WhatsApp/SMS alerts, file uploads, sync with the official institution database, SSO, trained ML model, multilingual. Links: GitHub, live demo, video. Thank you.

Tip: be upfront that the 103 Telangana institutions are real (from AICTE's public list) but the complaints and people are sample data; judges respond well to honest limits.
