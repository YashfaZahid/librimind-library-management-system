# LibriMind architecture

Approved in Phase 0. The preview catalogue is still what you see when Supabase is not configured. A signed-in session reads and writes the database.

## System boundary

- Frontend: Vite, React, TypeScript, Tailwind CSS.
- Authentication: Supabase Auth, connected in Phase 2. The anon key is the only Supabase key allowed in the browser.
- Domain API: FastAPI. Catalogue, circulation, files, search, and agents go through it.
- Data: Postgres on Supabase, with pgvector. Row-level security stays on. Catalogue and circulation calls send the signed-in reader’s token, so a student only receives their own loans, reservations, and fines. The API also rejects desk actions from a student token.
- Files: Supabase Storage, split into `covers/`, `institutional/`, and `personal/{user_id}/`.
- Agents: LangGraph. Tools call backend services. The model does not write SQL.
- Models: OpenAI-compatible chat and embeddings from environment variables. If no embedding key is set, semantic search uses a scikit-learn TF-IDF index.
- Shelf: React Three Fiber in Phase 5, plus a CSS fallback when WebGL is missing, the screen is small, or the user prefers reduced motion.

Roles are `student` and `admin`. A student cannot call an admin route. Students reserve physical copies. Administrators issue and return them. There is no acquisition agent and no purchase workflow.

## Repository

```text
frontend/src
  app/            router
  components/     brand, ui, books, shell
  data/           getLibrary(), the only door pages use for records
  domain/         types and pure catalogue rules
  layouts/        auth, student, admin
  mocks/          preview catalogue, imported only by getLibrary()
  pages/          screens
backend/          Phase 2
supabase/migrations
```

## Preview routes

These exist now:

- `/login`, `/register`
- `/library`, `/library/shelf`, `/library/stacks`, `/library/catalogue`, `/library/books/:bookId`, `/library/digital`, `/library/digital/:assetId`, `/library/collection`, `/library/discover`, `/library/assistant`, `/library/for-you`, `/library/wording`, `/library/loans`
- `/admin`, `/admin/analytics`, `/admin/catalogue`, `/admin/digital`, `/admin/circulation`, `/admin/readers`, `/admin/sources`, `/admin/assistant`, `/admin/insights`, `/admin/evaluation`, `/admin/books/:bookId`

Stacks is a subject browse. `/library/shelf` is the book room: a React Three Fiber shelf when the screen is wide, WebGL is available, motion is allowed, and the catalogue has at most 80 titles. Otherwise the same records are drawn as plain shelves.

The evaluation study is on the librarian desk. It runs a fixed task set on a private catalogue and reports the counts from that run.

## Data model for Phase 2

The runnable schema is [`supabase/schema.sql`](../supabase/schema.sql). `profiles.id` references `auth.users.id` and stores the role, name, and interests.

| Table | Role |
| --- | --- |
| `categories` | Subject shelves |
| `books` | One title, including `embedding vector` |
| `book_copies` | Physical copies and status |
| `digital_assets` | Institutional or personal PDF, EPUB reserved |
| `personal_shelf_items` | A student’s collection |
| `loans` | Issued copy, due date, return |
| `reservations` | Hold on a title; a loan starts only when an admin issues a copy |
| `fines` | Open, paid, or waived |
| `notifications` | Due, overdue, ready, fine |
| `reading_events` | Views, progress, downloads, reserves |
| `external_sources` | Seeded approved sites, not student-editable |
| `system_settings` | Loan length, loan limit, daily fine, hold window |
| `agent_runs`, `agent_events` | Workflow trace |
| `recommendation_logs` | Score, reason, model version |

Defaults: 14-day loan, 5 active loans, 3-day hold once a reservation is ready. ISBN and file SHA-256 catch duplicates. Title and author similarity is a warning.

Students read the institutional catalogue and only their own profile, shelf, loans, reservations, and personal files. Admin mutations go through FastAPI.

## API

Prefix `/api/v1`. Every protected route checks the Supabase JWT.

Profile, categories, books, keyword search, copies, loans, returns, reservations, fines, digital upload and read URL, personal shelf, discovery search and permitted save, assistant runs, recommendations, and admin reports. Students receive 403 on admin operations. A personal file is readable by its owner and an admin.

Discovery may save a file only when the source explicitly permits the download and the file validates. Otherwise the product says the book is not available for download. A lawful link may be shown. The file is not fetched.

Approved sources are Project Gutenberg and Open Library / Internet Archive records that are explicitly public domain or openly licensed. An admin may enable or disable a seeded source. The screen cannot add an arbitrary URL.

## Agents

One LangGraph state carries the user, role, request, intent, plan, tool results, errors, verification, response, and trace.

| Agent | Work |
| --- | --- |
| Orchestrator | Intent, routing, final answer. No direct database writes. |
| Search | Catalogue, then approved external sources, later semantic search. |
| Metadata | Extract fields, validate them, find duplicates. |
| Recommendation | Interests, history, and a written reason. |
| Circulation | Reserve, issue, return, dues, fines, after a fresh availability and role check. |
| Inventory | Stock, low stock, demand, CPU forecast. |
| Verification | Re-read the database or storage after a claimed success and report failure. |

Every tool call is stored on `agent_events`. Phase 10 runs the same tasks through a rule baseline, a single-agent graph, and this multi-agent graph, and records completion, tool accuracy, policy compliance, verification accuracy, and elapsed time from those logs. Results are not invented in advance.

## Environment

Names live in the root `.env.example`. `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `LLM_API_KEY` stay on the server.
