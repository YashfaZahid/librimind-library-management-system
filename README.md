# LibriMind

LibriMind is a library for physical copies, a digital collection, and an assistant that has to check its work. The interface is an editorial reading room. The desk uses the same records as the shelves.

This repository is at **Phase 10**. The evaluation desk runs a fixed task set through a rule baseline, a single agent, and the multi-agent workflow, then shows the counts from that run.

## Create the database

In the Supabase dashboard, open **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql), and run it.

The file creates the tables, row-level security, storage buckets, subject list, loan rules, and the three approved external sources. Every new account is a student. After you register, promote a librarian from the same SQL editor:

```sql
update public.profiles
set role = 'admin'
where email = 'librarian@example.edu';
```

Copy the project URL and anon key into `frontend/.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8000
```

Put the same URL, the anon key, and the service role key in the root `.env` for the API. Do not put the service role key in the frontend.

## Run the interface

```bash
cd frontend
npm install
npm run dev
```

Open the address Vite prints. From sign-in, choose **Sample library** or **Sample desk**. Those banners say the records are preview data.

To use the database, fill `frontend/.env.local` and the root `.env`, start the API, register, and promote one librarian with the SQL above. The sample banner stays hidden once a session is loaded from Supabase.

## Digital files

After the main schema, run [`supabase/phase4.sql`](supabase/phase4.sql) once in the SQL editor. It adds the title, authors, and description stored with each PDF. Then restart the API. Library PDFs are limited to 20 MB. A repeated file is refused. A repeated title asks for confirmation. Personal files stay on the account that uploaded them.

```bash
npm test
npm run build
```

The API:

```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\pytest
.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Architecture | Approved |
| 1 | Design system, shells, auth screens, sample catalogue | Done |
| 2 | Supabase auth, roles, schema, API foundation | Done |
| 3 | Live catalogue, copies, loans, returns, reservations, fines | Done |
| 4 | Digital library, PDF upload, reader, personal shelf | Done |
| 5 | Interactive book room, with plain shelves as the fallback | Done |
| 6 | Approved-source discovery and permitted downloads | Done |
| 7 | Multi-agent assistant, verification, and run log | Done |
| 8 | Recommendations, wording search, demand, and stock forecast | Done |
| 9 | Admin analytics from stored records | Done |
| 10 | Evaluation of baseline, single-agent, and multi-agent runs | In review |

Approved choices that later phases must keep:

- Two roles: `student` and `admin`. Administrators do the librarian work.
- FastAPI owns catalogue, circulation, files, search, and agents. The browser uses Supabase for authentication only.
- The signature shelf is React Three Fiber, with a CSS fallback for small screens and machines without WebGL. That work is Phase 5. Phase 1 only browses the same records by subject.
- External downloads are limited to seeded open sources. There is no acquisition agent.
- Chat and embeddings use an OpenAI-compatible API. Semantic search can fall back to scikit-learn TF-IDF when no embedding key is set.

The folder plan, schema, routes, and agents are in [docs/architecture.md](docs/architecture.md). Environment names are in [.env.example](.env.example). No secrets belong in the frontend.

# librimind-library-management-system
 8e13c028b06091c842c9679c0c1d3e3708b6ffa0
