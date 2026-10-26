# NyayaSetu - Unified Complaint Intelligence for AICTE


> **Real staff e-mails (this build).** `data/staff.csv` replaces three demo accounts with real addresses. Sign in (password `Demo@1234`) as
> `chairmannyayasetu@gmail.com` (Chairman Office), `vigneshkalakuntla.cs@gmail.com` (Head, Regulation Bureau) or
> `battuuhasubhadra@gmail.com` (Head, PGRC). The other demo logins below are unchanged, except that `head@nyayasetu.demo` and
> `head.regulation@nyayasetu.demo` no longer exist. Overlap alerts go to the heads and the officers working on the same institution.
> *Nyaya* = justice, *Setu* = bridge. One dashboard that bridges every AICTE bureau and cell.

> **Data note:** the institution registry is real public AICTE data (Telangana); complaints, officers and complainants are synthetic.

Prototype for **Smart India Hackathon 2026 - Problem Statement SIH26264**
*"Integrated Dashboard for Monitoring and Tracking Institution-Related Complaint Cases Across AICTE Bureaus/Cells"* (Theme: Smart Automation).

Built with **Next.js 14 (App Router) + MongoDB Atlas + Tailwind CSS + Recharts**. One codebase, one deploy.

> All data in the demo is **synthetic**. Institution names, people and complaints are invented. This is a prototype, not an official AICTE system.

---

## What it does

Mapped one-to-one to the problem statement's feature list:

| PS requirement | What NyayaSetu provides |
|---|---|
| **Single window, all cases** | One dashboard for every bureau/cell. Role-scoped: Chairman/management see everything, bureau staff their bureau, Regional Offices their region. |
| **Centralised institution profile** | Institution registry keyed by **AICTE Permanent ID** (name, address, city, state, region, type, year) with the consolidated complaint history, bureau mix and open-overlap status (`/institutions`). |
| **Case tracking** | Unique case ID, date of receipt, category, status, **presently assigned bureau**, assigned officer, **last action**, **next action required**, date of last action and **expected disposal date**. |
| **Cross-bureau overlap detection** | Cases are matched to the institution by **ID, not by wording**, so differently spelled names and different descriptions still group. When two or more bureaus have open cases on one institution (RB + PGRC flagged specially) the system shows **"Potential Overlapping Cases – Coordination Required"**. |
| **Link and coordinate** | Authorised officers link related cases (case-to-case) and record a coordination decision (lead bureau + note). Coordination expires automatically if another bureau joins later. |
| **Real-time dashboard** | Total, pending, under process, disposed, transferred, escalated, pending beyond timeline; institution-wise status; bureau-wise workload. |
| **Workflow and action history** | Chronological timeline with actor, bureau, time stamp, remarks, supporting-document links, transfer history (from -> to) and escalation history. |
| **Search and filters** | Institution name, AICTE Permanent ID, case ID, bureau, region, category, status, stage, date range, overlap-only, transferred-only. |
| **Alerts** | In-app alert centre (plus optional **email alerts**, see below): overlap, timeline (SLA) breach, approaching timeline (48 h), pending reminders (New > 48 h), escalations, next-action due, duplicates. |
| **Reports** | Bureau-wise, region-wise, institution-wise, status-wise, category-wise, pending ageing, overlapping cases, monthly and quarterly performance. CSV download and print/PDF. |

Plus the earlier platform features: public complaint form with honeypot and rate limiting, staff entry, CSV bulk import (up to 200 rows), AI triage (category, 0-100 priority, tags, summary; rule engine offline, optional LLM), least-loaded officer assignment, SLA clocks with automatic escalation Officer -> Bureau Head -> Chairman, text-similarity duplicate detection, public tracker (ID + email, citizen-safe view), bcrypt + httpOnly JWT cookie, server-side role checks.

**Data matching (the PS "innovation")**: every complaint's institution text is resolved against the registry with (1) an explicit AICTE Permanent ID, (2) exact normalised name, or (3) fuzzy matching (abbreviation expansion such as *Inst./Engg/Tech*, stop-word removal, one-typo tolerance, state check). Unknown names create an *unverified* registry entry so nothing is lost.

**Roles**: Chairman Office / management, Bureau Head, Case Officer, Regional Office. Staff outside the owning bureau can *view* a case (coordination view, complainant contact hidden) but cannot change it.

---

## Quick start (local)

**You need:** Node.js 20 LTS or newer (18.18+ works), Git, and a free MongoDB Atlas account.

### 1. Create the database (MongoDB Atlas, free)
1. Go to <https://www.mongodb.com/cloud/atlas> -> sign up -> **Create a cluster** -> choose the free **M0** tier.
2. **Database Access** -> *Add New Database User* -> username + password (note them down; avoid special characters like `@` or `:` in the password).
3. **Network Access** -> *Add IP Address* -> **Allow access from anywhere** (`0.0.0.0/0`). Needed so Vercel can connect later.
4. **Database** -> *Connect* -> *Drivers* -> copy the connection string. It looks like  
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`  
   Put the database name in the path: `.../nyayasetu?retryWrites=true&w=majority`.

### 2. Configure and run
```bash
cd nyayasetu
npm install

# create your env file
cp .env.example .env.local          # Windows CMD:  copy .env.example .env.local
# open .env.local and set MONGODB_URI and JWT_SECRET (see the table below)

npm run seed     # creates 22 staff accounts, 103 Telangana institutions, 260 sample complaints (wipes the database first!)
npm run dev      # http://localhost:3000
```

Generate a strong `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Demo logins
Password for all demo users: **`Demo@1234`** (or whatever you set in `DEMO_PASSWORD`).

| Role | Email | Sees |
|---|---|---|
| Chairman Office | `chairman@nyayasetu.demo` | All bureaus, all regions |
| Bureau Head, PGRC | `head@nyayasetu.demo` | Public Grievance Redressal Cell |
| Bureau Head, RB | `head.regulation@nyayasetu.demo` | Regulation Bureau |
| Case Officer, PGRC | `officer@nyayasetu.demo` | Own queue |
| Regional Office (South Central) | `regional.south@nyayasetu.demo` | All bureaus, South Central region |

Other bureau heads: `head.approval@`, `head.fee@`, `head.academic@`, `head.vigilance@nyayasetu.demo`. Other regional offices: `regional.west@`, `regional.north@nyayasetu.demo`.  
The login page has one-click buttons for five of these (`NEXT_PUBLIC_DEMO_MODE=true`).

> The 103 institutions and their AICTE Permanent IDs come from AICTE's public list (Telangana only). Complaints and people are **sample data**. Without `data/institutions.csv` the built-in institutions and IDs are fictional.

### 4. Verify the logic without a database
```bash
npm test
```
Runs 38 offline checks: classifier accuracy, SLA maths, CSV parser (and CSV export with formula-injection guard), validation, duplicate detection, institution matching, overlap detection (incl. RB + PGRC, coordination going stale), alerts, email templates and sending, all report types, seed data consistency and analytics.

---

### Optional: use real institutions (10-50 rows)
This copy ships with `data/institutions.csv`: **103 real Telangana institutions** from AICTE's public list, so the seed uses them. Delete the file to fall back to 26 fictional institutions, or replace it with your own list: copy `data/institutions.template.csv`, add rows (`permanent_id,name,state` required; `city,address,type,year` optional) from AICTE's public list, and run `npm run seed`. Bad rows are reported by line number and skipped. Complaints stay synthetic sample data, so state that in your presentation. See `data/README.md`.

---

### Optional: email alerts (Resend)
Email is **off by default**; the app works fully without it. To turn it on:
1. Create a free account at <https://resend.com> and make an API key.
2. Set `RESEND_API_KEY` (and for demos `MAIL_DEMO_TO=<your own email>`) in `.env.local` / on Render. Resend's free test sender (`onboarding@resend.dev`) can only deliver to **your own Resend account email**, and the seeded staff addresses are fictional, so `MAIL_DEMO_TO` sends every email to you, with the intended recipient shown in the subject.
3. Sign in as Chairman, open **Alerts**, and click **Send test email**.

| Event | Who gets the email |
|---|---|
| Complaint received | Complainant (receipt with tracking link) |
| New / assigned / transferred / escalated case | The officer or head who now holds it |
| Potential overlapping cases | Bureau Heads of every bureau involved |
| Resolved / Closed | Complainant |
| Reminder digest (past timeline, due within 48 h, New for over 48 h) | Each assignee, at most once per 24 h per case. Sent whenever the SLA check runs (button, daily cron or an external scheduler). |

A mail failure never blocks or fails the action that triggered it. Bulk import does not send emails. For real use, verify your own domain in Resend and set `MAIL_FROM`. Render's free plan blocks SMTP ports, which is why this uses Resend's HTTPS API.

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | **Yes** | Atlas connection string (include the DB name, e.g. `/nyayasetu`). |
| `JWT_SECRET` | **Yes** (prod) | Signs login cookies. 32+ random characters. |
| `DEMO_PASSWORD` | Seed only | Password given to all seeded demo users. Default `Demo@1234`. |
| `NEXT_PUBLIC_DEMO_PASSWORD` | Demo panel | Same value as `DEMO_PASSWORD`, used by the one-click demo buttons. |
| `NEXT_PUBLIC_DEMO_MODE` | No | `true` shows the demo-accounts panel on `/login`. Set `false` for a real deployment. |
| `CRON_SECRET` | Recommended | Authorises the scheduled `/api/escalate` call (Vercel Cron sends it automatically). |
| `AUTO_ESCALATE` | No | `true` = also run the SLA check (max once / 5 min) when the dashboard loads. Default `false`. |
| `RESEND_API_KEY` | No | Turns on email alerts (see above). |
| `MAIL_FROM` / `MAIL_DEMO_TO` / `APP_URL` | No | Sender, demo redirect address, public URL for links in emails. |
| `ANTHROPIC_API_KEY` | No | Enables LLM-refined category/summary/tags. Without it the rule engine is used. |
| `ANTHROPIC_MODEL` | No | Model for the above. Default `claude-haiku-5-5`. |

`NEXT_PUBLIC_*` values are baked in at build time. After changing them on Vercel, redeploy.

---

## Push to GitHub

1. On <https://github.com/new> create an **empty** repository named `nyayasetu` (do **not** add a README or .gitignore; they already exist).
2. In the project folder:

```bash
git init
git add .
git status          # CHECK: .env.local and node_modules must NOT be listed
git commit -m "NyayaSetu: AICTE complaint intelligence dashboard (SIH26264)"
git branch -M main
git remote add origin https://github.com/<your-username>/nyayasetu.git
git push -u origin main
```

If Git says *"Please tell me who you are"*: `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`, then commit again.  
When pushing, GitHub opens a browser sign-in (or asks for a Personal Access Token as the password).

> **Never commit `.env.local`.** It holds your database password. If you ever do, rotate the Atlas password immediately.

---

## Deploy to Vercel (free)

1. Sign in at <https://vercel.com> with GitHub -> **Add New... -> Project** -> import the `nyayasetu` repo. Framework is detected as Next.js; leave the defaults.
2. Open **Environment Variables** and add: `MONGODB_URI`, `JWT_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_DEMO_MODE` (`true` for the hackathon demo), `NEXT_PUBLIC_DEMO_PASSWORD`. Optionally `ANTHROPIC_API_KEY`.
3. Click **Deploy**. You get a live URL like `https://nyayasetu-xxxx.vercel.app`.
4. Seed the database once **from your own computer** (it uses the same Atlas database): `npm run seed`.
5. Open `https://<your-url>/api/health`. You should see `{"ok":true,"db":"connected","seeded":true}`. Then open `/login` and use a demo account.

**Scheduled SLA check:** `vercel.json` registers a daily cron (`/api/escalate`). Vercel's free plan only allows once-a-day crons. For a live demo use the dashboard's **Run SLA check** button. For more frequent automatic runs, set `AUTO_ESCALATE=true` or point a free scheduler (e.g. cron-job.org) at `GET /api/escalate` with the header `Authorization: Bearer <CRON_SECRET>`.

Every `git push` to `main` redeploys automatically.

---

## Project structure

```
nyayasetu/
├─ scripts/
│  ├─ seed.js                 # wipes + seeds staff, institution registry and 260 synthetic complaints
│  └─ selftest.js             # offline checks (npm test)
├─ public/sample-complaints.csv
├─ docs/                      # SIH abstract, demo script, PPT outline
├─ src/
│  ├─ models/                 # Mongoose: User, Complaint, Counter, Institution, OverlapRecord
│  ├─ lib/
│  │  ├─ classify.js          # rule-based triage + optional LLM + duplicate similarity
│  │  ├─ sla.js               # deadlines, SLA state
│  │  ├─ escalation.js        # SLA breach -> escalate engine
│  │  ├─ complaintService.js  # create: triage, duplicates, routing, assignment
│  │  ├─ analytics.js         # all dashboard numbers (pure, testable)
│  │  ├─ institutions.js      # institution data matching (ID / exact / fuzzy)
│  │  ├─ overlap.js, overlapService.js  # cross-bureau overlap detection + coordination status
│  │  ├─ alerts.js, reports.js, actions.js  # alert centre, report builder, last/next action
│  │  ├─ dnsFix.js            # automatic DNS fallback for Atlas SRV lookups
│  │  ├─ auth.js, api.js, db.js, validation.js, csv.js, constants.js, seedData.js
│  ├─ components/             # charts, UI kit, sidebar, forms
│  └─ app/
│     ├─ page.js, submit/, track/, login/        # public pages
│     ├─ (app)/dashboard, alerts, complaints, overlaps, institutions, reports, import  # staff area
│     └─ api/                                    # REST endpoints
├─ vercel.json                # daily SLA cron
└─ .env.example
```

## API overview

| Method & path | Who | What |
|---|---|---|
| `POST /api/complaints` | Public / staff | Create + triage + match institution + route. Staff response also reports the matched institution and any overlap. |
| `GET /api/complaints` | Staff | List; filters: `status, stage, priority, category, bureau, region, institutionId, from, to, transferred, overlap, q, sla=overdue, escalated=1, duplicates=1, sort, page` |
| `GET /api/complaints/:id` | Staff | Detail. Outside your bureau/region it is a **read-only coordination view**. |
| `PATCH /api/complaints/:id` | Staff (role-gated) | `action`: `status, note, next_action, link, unlink, document, assign, priority, escalate, reassign_bureau` (transfer) |
| `GET /api/overlaps` | Staff (scoped) | Overlap groups with severity and coordination status |
| `POST /api/overlaps` | Bureau Head of an involved bureau / Chairman | `coordinate` (lead bureau + note) or `link_all` |
| `GET /api/institutions`, `/api/institutions/:id` | Staff | Registry list and profile with history |
| `GET /api/institutions/search?q=` | Public | Type-ahead for the complaint form |
| `GET /api/alerts` (`?summary=1`) | Staff (scoped) | Alert centre / counts |
| `GET/POST /api/mail` | Staff / Chairman | Email status / send a test email |
| `GET /api/reports?type=&from=&to=&format=csv` | Staff (scoped) | Reports, CSV optional |
| `POST /api/complaints/bulk` | Staff | Import up to 200 rows |
| `GET /api/analytics` | Staff (scoped) | Every dashboard metric |
| `POST/GET /api/escalate` | Staff or cron secret | Run the SLA escalation engine |
| `POST /api/track` | Public | Citizen tracker (ID + email) |
| `GET /api/users` | Managers | Staff list for assignment |
| `POST /api/auth/login`, `/logout`, `GET /api/auth/me` | - | Session |
| `GET /api/health` | Public | Database connectivity check |

## How triage works

* **Category**: keyword scoring over title + description across 9 categories (title weighted double). Harassment and safety cues always win.
* **Priority score (0-100)** = category severity base (8-45) + urgency cues (fraud, forged, ragging, harassment, capitation, collapse risk, ...) + students affected (up to +25) + repeat-institution bonus (up to +15). Bands: **Critical >= 70**, **High >= 50**, **Medium >= 28**, else **Low**.
* **SLA**: Critical 3 days, High 7, Medium 14, Low 30. On breach: +72 h at Bureau Head level, +48 h at Chairman level.
* **Duplicates**: Jaccard similarity of keyword sets >= 0.5 against complaints about the same institution in the last 120 days.
* **LLM (optional)**: if `ANTHROPIC_API_KEY` is set, the model proposes category, priority, summary and tags. The final priority is the **higher** of rules and model. Any API failure falls back to the rule engine.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `MONGODB_URI is not set` | Create `.env.local` (not `.env.example`) and restart `npm run dev`. |
| `MongoServerSelectionError` / "Could not reach the database" | Atlas -> Network Access must allow your IP (or `0.0.0.0/0`). Check username/password in the URI; URL-encode special characters. |
| "Invalid email or password" for demo users | You have not seeded yet, or you seeded a different database. Run `npm run seed`. |
| Bounced back to `/login` repeatedly | `JWT_SECRET` missing/changed (set it, then sign in again). |
| Dashboard empty on Vercel | Seed the same Atlas database (`npm run seed` locally), then check `/api/health`. |
| Demo buttons say invalid password | Set `NEXT_PUBLIC_DEMO_PASSWORD` equal to `DEMO_PASSWORD` and redeploy. |

## Known limitations / future scope

* **Alerts are in-app, plus optional e-mail** (Resend). WhatsApp / SMS are future scope. Reminder emails go out when the SLA check runs, so on a sleeping free host use an external scheduler.
* **Supporting documents are stored as links**, not uploaded files (upload needs object storage).
* **Triage is rule-based** by default (explainable); the optional LLM only refines it. A trained classifier needs real labelled data.
* Institution registry is **demo data**. In production it would be synchronised from the official AICTE institution database.
* Local accounts for login; production should use AICTE single sign-on.
* Rate limiting is in-memory per server instance; use a shared store (e.g. Redis) at scale.

## Upgrading from an older copy of NyayaSetu

Bureau names, roles and the database schema changed. After copying the new files over the old folder, keep your `.env.local`, run `npm install`, then `npm run seed` (it wipes and recreates the demo data), then `npm run dev`.
