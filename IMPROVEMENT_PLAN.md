# Improvement Plan — Couchbase Quick Dashboard

**Status:** Ready to execute (planning complete)  
**Baseline catalog:** `RELEASE_NOTES.md` (1.0.0 feature surface; runtime may read 1.0.3)  
**Branch for this planning drop:** `docs/release-notes-and-improvement-plan`  
**Parallel track (do not block):** `docs/work/multi-cluster-training-enhancements.md` (training-scale UX)

This plan turns the code review recommendations into **phases → steps → slices** small enough to PR, test, and ship without a big-bang rewrite. Each slice should leave `main` runnable.

---

## Goals

1. **Safe by default** for a laptop-local ops tool (bind, secrets, TLS, XSS).  
2. **Configurable listen port (and host)** so **5000 is never mandatory** — port 5000 is often crowded by other local services.  
3. **Maintainable structure** without killing the “download zip and run” story.  
4. **Honest docs/CI/versioning** so releases match what users run.  
5. Keep the training multi-cluster vision as a **later product track**, not mixed into P0 hardening.

### Non-goals (this plan)

- Rewriting the UI in React/Vue on day one (optional later).  
- Implementing all training EP-001…EP-010 here.  
- Turning the app into a multi-tenant cloud service.

---

## Success metrics

| Metric | Target |
|--------|--------|
| Default bind | `127.0.0.1` only |
| Port selection | Config + CLI + env; documented; example default **not** fighting a crowded 5000 (recommend **5050** or **18091**) |
| Secrets in git | Zero real/example production passwords in tracked `config.json` |
| TLS | Verify on by default; explicit opt-out per cluster |
| Version sources | Single canonical version string |
| CI | pytest required; jest required if JS tests kept; no `build/`/`dist/` binaries in git |
| Structure | `app.py` thin; fetch client one module; JS split or at least escaped + less noisy |

---

## Priority legend

| Tag | Meaning |
|-----|---------|
| **P0** | Security / data risk / can’t safely share |
| **P1** | Correctness, ops DX, structure that blocks velocity |
| **P2** | Polish, optional product, larger refactors |
| **Slice** | One PR-sized unit of work |

---

# Phase A — Safe local defaults + first-class port config (P0)

**Outcome:** Anyone can run the dashboard next to other local tools without port fights, without exposing cluster creds on the LAN by accident, and without committing passwords.

### Why port config is Phase A (not backlog)

Port **5000** is frequently taken (other internal dashboards, Flask demos, platform services). The baseline already has `server.port` and `--port`, but:

- Default remains 5000.  
- Bind host is not configurable / not locked down.  
- Env override missing.  
- Release README still mentions **5001** in places.  
- Startup does not print a clear “open this URL” with the **actual** host:port.  
- No guidance when the port is already in use.

Phase A makes port/host configuration **obvious, complete, and documented**.

---

## Step A1 — Listen address & port resolution

**Single resolution order (document and implement):**

1. CLI flags (highest): `--port`, `--host`  
2. Environment: `CB_DASHBOARD_PORT`, `CB_DASHBOARD_HOST` (and optional aliases `PORT` only if documented carefully)  
3. `config.json` → `server.port`, `server.host`  
4. Code defaults: **host `127.0.0.1`**, **port `5050`** (or `18091` — pick one in A1 and stick to it)

**Recommended defaults (proposal for implementation):**

```json
"server": {
  "host": "127.0.0.1",
  "port": 5050,
  "debug": false
}
```

Rationale: 5050 is rarely privileged, easy to remember, away from 5000/5001 noise; 18091 echoes Couchbase 8091 for muscle memory. **Decision to lock in A1 slice:** use **5050** unless you prefer 18091.

### Slice A1.1 — Config schema + validation
- Add `server.host` (string, default `127.0.0.1`).  
- Keep `server.port` (int, 1–65535).  
- Validate host/port in `validate_config`.  
- Default `debug` to **`false`** when key missing.  
- Update `config.example.json` (created in A2) and `config.test.json`.

### Slice A1.2 — Runtime bind
- `app.run(host=host, port=port, debug=debug)`.  
- Parse `--host` / `--port` (argparse preferred over manual argv walk).  
- Read env overrides.  
- On startup log + print:  
  `Couchbase Dashboard vX.Y.Z  →  http://127.0.0.1:5050`  
- If bind fails with “address already in use”, catch and print actionable message: try another `--port` or edit `server.port`.

### Slice A1.3 — Docs & release text alignment
- README, README_RELEASE, CI `dist/README.txt`: same default port/host.  
- Remove stray **5001** references or mark as “example alternate”.  
- Document resolution order in README **Configuration** section.  
- Executable quick start: “edit port if busy”.

### Slice A1.4 — Tests
- Unit tests for resolution order (CLI > env > config > default).  
- Integration: client hits app on chosen port (or Flask test client still OK; unit-test the resolver pure function).  
- Validation rejects port `0`, `70000`, non-int, empty host.

**Exit criteria A1:** Changing only `server.port` (or `--port 5060`) is enough to coexist with whatever owns 5000; dashboard binds localhost by default.

---

## Step A2 — Secrets & config hygiene (P0)

### Slice A2.1 — Example config only in git
- Add `config.example.json` (placeholder credentials, host `127.0.0.1`, port **5050**).  
- `.gitignore` `config.json` (and `dist/config.json` if needed).  
- Stop shipping real-looking passwords; README: `cp config.example.json config.json`.  
- CI: copy example → `config.json` before tests/validate, or point tests at `config.test.json`.  
- PyInstaller: bundle **example** as `config.example.json`, not a secrets file; first-run copy instruction in README_RELEASE.

### Slice A2.2 — Config path resolution
- Resolve config relative to:  
  1. `CB_DASHBOARD_CONFIG` env path  
  2. CWD `./config.json`  
  3. Directory of executable / package root (frozen + source)  
- Never depend solely on accidental CWD for binaries.

### Slice A2.3 — Optional env secret overlays (minimal)
- Per-cluster optional `"pass_env": "MY_CLUSTER_PASS"` → read password from env at runtime.  
- Or global documentation: keep pass in local untracked file only.  
- Do **not** log passwords.

**Exit criteria A2:** Fresh clone has no cluster passwords; app finds config when launched from another directory / as binary.

---

## Step A3 — TLS verify defaults (P0)

### Slice A3.1 — Shared request helper
- Replace five copy-pasted SSL blocks with `async def cb_request(session, host, path, user, password, *, timeout, verify_ssl)`.  
- Default `verify_ssl=True` for https.  
- Per-cluster `"verify_ssl": false` for lab/self-signed only.

### Slice A3.2 — Tests
- Mock https path uses verify flag; unit-test context factory.

**Exit criteria A3:** Production-like Capella/TLS clusters verify certs unless explicitly opted out.

---

## Step A4 — Bind-time safety note + optional token (P0/P1)

### Slice A4.1 — Document threat model
- README: “Local tool; binds 127.0.0.1; anyone on the machine can use cluster credentials via the proxy APIs.”

### Slice A4.2 — Optional shared token (small)
- `server.auth_token` or env `CB_DASHBOARD_TOKEN`.  
- If set, require `Authorization: Bearer …` or `?token=` for `/api/*` (and gate UI via cookie/local entry page later if needed).  
- If unset, localhost-only remains the control.

**Exit criteria A4:** Documented; optional token works when set.

---

# Phase B — Correctness, caching, async hygiene (P1)

**Outcome:** Fewer footguns under load; consistent behavior; cheaper polls.

## Step B1 — Config mtime cache
### Slice B1.1
- Cache parsed config; reload when file mtime changes.  
- Thread-safe enough for Flask dev server (simple lock).

## Step B2 — Event loop bridge
### Slice B2.1
- Replace manual `new_event_loop` / `set_event_loop` / `close` with `asyncio.run(...)` helper (or one module-level pattern).  
- Same behavior, less resource churn; document “sync Flask route → async work”.

## Step B3 — Timeout & poll knobs in config
### Slice B3.1
```json
"server": {
  "host": "127.0.0.1",
  "port": 5050,
  "debug": false,
  "poll_interval_seconds": 10
},
"timeouts": {
  "http_seconds": 10,
  "cluster_seconds": 15,
  "bucket_gather_seconds": 10
}
```
- Expose poll interval to frontend via `GET /api/meta` or embed in index template.  
- Stop hard-coding 10 throughout JS if possible (`window.DASHBOARD_META`).

## Step B4 — Health endpoint
### Slice B4.1
- `GET /healthz` → `{ "status": "ok", "version": "...", "port": ..., "clusters_configured": N }` (no secrets).

## Step B5 — Version single-source
### Slice B5.1
- Canonical `__version__` in one module; `setup.py` reads it; README badge/version section generated or manually synced via VERSION_GUIDE checklist.  
- Align package 1.0.0 vs runtime 1.0.3 drift.  
- Drop obsolete “2.1.0” README headers or turn them into historical notes in RELEASE_NOTES only.

**Exit criteria B:** Config hot-reload safe; timeouts configurable; `/healthz` green; one version string.

---

# Phase C — Frontend hardening (P0/P1)

**Outcome:** Safer HTML; less console noise; pin assets; preserve charts.

## Step C1 — XSS escape
### Slice C1.1
- Add `escapeHtml()` (or textContent-based DOM builders) for all dynamic fields: names, hosts, errors, bucket names in HTML strings.  
- Jest tests for escape helper.

## Step C2 — Asset strategy
### Slice C2.1
- Pin Chart.js / jQuery / Bootstrap versions in CDN URLs **or** vendor under `static/vendor/` for offline binary use (preferred for PyInstaller).  
- Add SRI if CDN kept.

## Step C3 — Chart lifecycle + logging
### Slice C3.1
- Chart registry: create / update / destroy APIs; no “skip HTML replace” landmines without comments.  
- Gate `console.log` behind `window.DASHBOARD_DEBUG` or strip for release.

## Step C4 — UX small wins
### Slice C4.1 — Persist card order in `localStorage` keyed by cluster UUID.  
### Slice C4.2 — Abort in-flight `/api/clusters` when a newer poll starts.  
### Slice C4.3 — Pause polling when `document.hidden`.

**Exit criteria C:** No raw unescaped cluster error strings in HTML; binaries usable offline if vendored; order sticks across reload.

---

# Phase D — Modularize backend & frontend (P1)

**Outcome:** Files a human can review; same behavior.

## Step D1 — Python package layout
Suggested:

```text
cb_dashboard/
  __init__.py          # __version__
  app_factory.py       # create_app()
  config.py            # load, validate, resolve path, mtime cache, port/host resolution
  cb_client.py         # aiohttp helpers + fetch_* 
  process.py           # process_cluster_data
  routes/
    pages.py
    api_clusters.py
    api_bucket.py
    api_index.py
    api_xdcr.py
    health.py
  logging_setup.py
app.py                 # thin entry: create_app + main()
```

### Slice D1.1 — Extract `config.py` + tests (no behavior change).  
### Slice D1.2 — Extract `cb_client.py`.  
### Slice D1.3 — Extract `process.py`.  
### Slice D1.4 — Extract routes + app factory.  
### Slice D1.5 — Fix PyInstaller hidden imports / spec paths for new package.

## Step D2 — Split `scripts.js`
Suggested:

```text
static/js/
  main.js
  api.js
  cards.js
  tabs.js
  charts/ops.js
  charts/system.js
  charts/xdcr.js
  charts/index.js
  util/escape.js
  util/format.js
```

Load via ordered script tags or a tiny bundle step later.

### Slice D2.1 — Extract utils + escape (no UI change).  
### Slice D2.2 — Extract charts modules.  
### Slice D2.3 — Extract cards/tabs.  
### Slice D2.4 — Wire Jest `collectCoverageFrom` to new paths; run in CI.

**Exit criteria D:** `app.py` < ~80 lines entry; no 4k-line JS monolith; tests green.

---

# Phase E — Repo hygiene, CI, packaging (P1)

**Outcome:** Clean clone; CI matches quality bar; releases trustworthy.

## Step E1 — Git hygiene
### Slice E1.1
- `.gitignore`: `build/`, `dist/`, `config.json`, `logs/*.log`, coverage, `.venv`.  
- Remove tracked binaries from git history **or** at least `git rm -r --cached build dist` going forward (history rewrite optional/out of band).

## Step E2 — CI
### Slice E2.1
- pytest required (already).  
- `npm ci && npm test` if Jest retained.  
- flake8: fail on real issues or replace with ruff.  
- black `--check` keep.  
- Build job uses `config.example.json`.  
- Artifact README uses resolved default port (**5050**).

## Step E3 — Dependencies
### Slice E3.1
- Drop dead `asynctest` if unused.  
- Pin with floors/ceilings appropriate for app (security).  
- Optional: merge test deps into `pyproject.toml` extras.

## Step E4 — Packaging clarity
### Slice E4.1
- Prefer `pyproject.toml` as truth; slim `setup.py` or remove.  
- Console entrypoint `cb-dashboard` → `main()` that exists (fix broken `app:main` if `main` missing).

**Exit criteria E:** CI red on regressions; no multi‑MB binary in source tree; `pip install -e .` works.

---

# Phase F — Production-ish run path & product extras (P2)

**Outcome:** Optional harder deploy; nicer ops.

## Step F1 — WSGI/ASGI path
- Document `waitress` (`waitress-serve --listen=127.0.0.1:5050 app:app`) or migrate to Quart/FastAPI if async-native is desired.  
- Keep PyInstaller path on Flask for desktop users.

## Step F2 — Operator UX
- In-UI pause watch (writes config or session override).  
- Export JSON snapshot button.  
- Dark/dense theme for projector/training walls.  
- Capella notes (auth, TLS, URLs).

## Step F3 — Training track handoff
- After A–E stable, schedule items from `docs/work/multi-cluster-training-enhancements.md` (grouping, presets, bulk watch, comparison) as **Phase T** separately.

**Exit criteria F:** Optional; only after hardening.

---

# Cross-cutting: Configurable port (full specification)

Implementers should treat this block as the acceptance spec for port work (Phase A1).

## Requirements

| ID | Requirement |
|----|-------------|
| P-1 | User can set listen port via `config.json` `server.port` |
| P-2 | User can set listen port via CLI `--port` |
| P-3 | User can set listen port via env `CB_DASHBOARD_PORT` |
| P-4 | Precedence: CLI > env > config > default |
| P-5 | Default port is **not** 5000 (use **5050** unless project decides 18091) |
| P-6 | User can set bind host via config/CLI/env; default **127.0.0.1** |
| P-7 | Startup prints exact URL to open |
| P-8 | Bind failure message mentions port conflict and how to change port |
| P-9 | All docs (README, RELEASE, CI dist README) agree on default port |
| P-10 | UI optional: show “Listening on …” in footer from `/api/meta` |
| P-11 | Tests cover precedence and validation |

## Example config (target)

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 5050,
    "debug": false,
    "poll_interval_seconds": 10
  },
  "logging": {
    "level": "info",
    "file": "logs/app.log",
    "enabled": true
  },
  "timeouts": {
    "http_seconds": 10,
    "cluster_seconds": 15,
    "bucket_gather_seconds": 10
  },
  "clusters": [
    {
      "host": "http://127.0.0.1:8091",
      "user": "Administrator",
      "pass": "password",
      "customName": "Local Development",
      "watch": true,
      "verify_ssl": true
    }
  ]
}
```

## Example commands

```bash
cp config.example.json config.json
# edit clusters + port if needed

python app.py
# → http://127.0.0.1:5050

python app.py --port 5060
CB_DASHBOARD_PORT=5070 python app.py
CB_DASHBOARD_HOST=127.0.0.1 CB_DASHBOARD_PORT=5080 python app.py --port 5090  # CLI wins → 5090
```

---

# Suggested PR / slice order (execution queue)

Do in order unless noted parallelizable.

| Order | Slice | Phase | Est. effort | Depends on |
|------:|-------|-------|-------------|------------|
| 1 | A1.1 Config host/port schema + defaults (5050) | A | S | — |
| 2 | A1.2 Runtime bind + argparse + env | A | S | 1 |
| 3 | A1.3 Docs port alignment | A | S | 1–2 |
| 4 | A1.4 Port resolver tests | A | S | 2 |
| 5 | A2.1 config.example + gitignore config.json | A | S | — (parallel with 1) |
| 6 | A2.2 Config path resolution | A | M | 5 |
| 7 | A3.1–A3.2 TLS helper + verify default | A | M | — |
| 8 | A4.1 Threat model docs | A | S | 2 |
| 9 | A4.2 Optional token | A | M | 2 |
| 10 | B5 Version single-source | B | S | — |
| 11 | B1 Config mtime cache | B | S | 6 |
| 12 | B2 asyncio.run helper | B | S | — |
| 13 | B3 Timeouts + poll interval + meta | B | M | 2 |
| 14 | B4 /healthz | B | S | 10 |
| 15 | C1 escapeHtml | C | M | — |
| 16 | C2 Vendor or pin assets | C | M | — |
| 17 | C3–C4 charts/logging/order/poll | C | M | 15 |
| 18 | E1 gitignore build/dist | E | S | — (early OK) |
| 19 | E2 CI jest + stricter lint | E | M | 17 partial |
| 20 | D1 Python split (series of PRs) | D | L | A–B stable |
| 21 | D2 JS split | D | L | C stable |
| 22 | E3–E4 deps/packaging | E | M | D1 |
| 23 | F* optional | F | L | E |

**S** ≈ half day, **M** ≈ 1–2 days, **L** ≈ multi-day / multiple PRs.

---

# Testing strategy per phase

| Phase | Minimum tests |
|-------|----------------|
| A | Resolver unit tests; validate_config; app boots with custom port (subprocess or create_app + config inject); config missing file path fallback |
| B | mtime reload; healthz JSON shape; timeout values honored (mock sleep/wait_for) |
| C | Jest escape + one chart registry smoke; no XSS fixture |
| D | Existing pytest suite still green after moves; update imports |
| E | CI green on clean clone with only example config |
| F | As features add |

Manual smoke each phase:

1. `cp config.example.json config.json` → set one real cluster.  
2. Run on **5050**, confirm UI.  
3. Run with `--port 5060`, confirm.  
4. Occupy 5050, confirm clear error.  
5. Binary build still starts (after packaging slices).

---

# Versioning during the plan

| Milestone | Suggested version | Notes |
|-----------|-------------------|--------|
| Planning docs only | 1.0.3 (no code bump) or 1.0.4 docs | This branch |
| Phase A complete | **1.1.0** | Port/host defaults, secrets hygiene, TLS verify — user-visible safe defaults |
| Phase B complete | **1.2.0** | Meta/timeouts/health/cache |
| Phase C complete | **1.2.x / 1.3.0** | Frontend hardening |
| Phase D complete | **1.4.0** | Structure (behavior-preserving) |
| Phase E complete | **1.4.x** | CI/packaging |
| Phase F / training | **1.5+ or 2.0** | Product features / training track |

Update `RELEASE_NOTES.md` on every ship (newest section first).

---

# Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Changing default port surprises existing users | Changelog + startup banner; keep reading old config keys; document migration “if you relied on 5000, set server.port” |
| gitignoring `config.json` breaks CI | CI copies example → config or uses `config.test.json` explicitly |
| PyInstaller breaks after package split | One vertical slice with binary smoke in CI |
| Vendoring JS increases repo size | Accept small vendor dir; still smaller than tracking `dist/cb_dashboard` |
| Optional auth half-done confuses users | Ship token only with docs; default off |
| Scope creep into training EP-* | Keep EP-* in Phase T; link only |

---

# Decision log (lock these when implementing)

| Decision | Proposal | Status |
|----------|----------|--------|
| New default port | **5050** | Proposed — confirm before A1 merge |
| Default bind host | **127.0.0.1** | Proposed |
| Env prefix | `CB_DASHBOARD_*` | Proposed |
| TLS default | verify **on** | Proposed |
| First major version bump after hardening | 1.1.0 after Phase A | Proposed |
| Training enhancements | Separate Phase T after E | Proposed |

---

# How to use this plan in implementation sessions

1. Open this file; pick the next **Order** row not done.  
2. Create branch `feat/a1-port-resolution` (slice id).  
3. Implement only that slice + tests + RELEASE_NOTES Unreleased bullet.  
4. PR → merge → check off slice here (or move to a TRACKING checkbox list).  
5. Do not start D (big split) until A–C safety nets exist.

### Checkbox tracker (paste updates as you go)

- [ ] A1.1 Schema/defaults  
- [ ] A1.2 Bind + CLI + env  
- [ ] A1.3 Docs port  
- [ ] A1.4 Tests port  
- [ ] A2.1 Example config + gitignore  
- [ ] A2.2 Config path  
- [ ] A2.3 pass_env optional  
- [ ] A3 TLS helper  
- [ ] A4 Threat model + optional token  
- [ ] B1–B5  
- [ ] C1–C4  
- [ ] D1–D2  
- [ ] E1–E4  
- [ ] F* optional  
- [ ] Phase T training (external doc)

---

# Related documents

- `RELEASE_NOTES.md` — frozen 1.0.0 baseline catalog  
- `docs/work/multi-cluster-training-enhancements.md` — training product track  
- `settings/VERSION_GUIDE.md` — version bump mechanics  
- `README.md` / `README_RELEASE.md` / `README_TESTING.md` — update during A1.3 / E
