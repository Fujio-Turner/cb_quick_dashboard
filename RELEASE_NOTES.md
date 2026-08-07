# Release Notes — Couchbase Quick Dashboard

**Repository:** [Fujio-Turner/cb_quick_dashboard](https://github.com/Fujio-Turner/cb_quick_dashboard)  
**Document purpose:** Catalog what ships in the **1.0.x baseline** (current product surface), so improvement work has a frozen “before” picture.  
**Catalog date:** 2026-08-06  
**Branch baseline:** `main` at docs/plan kickoff  

---

## Version identity (as of this catalog)

| Source | Value | Notes |
|--------|--------|--------|
| Runtime / UI (`app.py` `__version__`) | **1.0.3** | Shown in UI corner, startup logs, console |
| Package metadata (`setup.py`) | **1.0.0** | Setuptools package version; **out of sync** with `__version__` |
| Marketing README header | May still mention older “2.1.0 / XDCR” branding | Align in improvement plan (version single-source) |
| This catalog label | **1.0.0 baseline** | Feature set of the current tree; patch level may be 1.0.3 |

**Convention going forward:** one canonical version string, bumped with every meaningful ship (see `settings/VERSION_GUIDE.md` and `IMPROVEMENT_PLAN.md`).

---

## 1.0.0 — Current baseline (feature catalog)

A local Python web app that monitors one or more Couchbase clusters via the REST management API, with a browser UI, optional PyInstaller executables, and a pytest/Jest test layout.

### Product summary

| Dimension | Baseline behavior |
|-----------|-------------------|
| Primary use | Ops / training glance dashboard for Couchbase clusters |
| Runtime | Flask sync app + aiohttp async fetches inside request handlers |
| UI stack | jQuery, jQuery UI (tabs + sortable), Bootstrap 4 (CDN), Chart.js (CDN), Font Awesome (CDN) |
| Config | `config.json` next to process CWD |
| Default listen | `server.port` default **5000**, Flask `app.run` (no explicit host → typically all interfaces / platform default) |
| Refresh | Frontend polls `/api/clusters` on an interval (~10s) |
| Auth to dashboard | **None** |
| Auth to Couchbase | HTTP Basic per cluster (`user` / `pass` in config) |
| TLS to cluster | HTTPS supported; **certificate verification disabled** |

---

### Configuration surface (`config.json`)

#### `server`

| Key | Type | Default (code) | Purpose |
|-----|------|----------------|---------|
| `port` | int | `5000` | HTTP listen port |
| `debug` | bool | `True` if key missing; shipped example `false` | Flask debug mode (forced `false` when PyInstaller frozen) |

#### `logging`

| Key | Type | Purpose |
|-----|------|---------|
| `level` | string | `trace` \| `debug` \| `info` \| `warning` \| `error` |
| `file` | path | Rotating file log (10 MB × 5 backups) |
| `enabled` | bool | File logging on/off (console always on) |

#### `clusters[]`

| Key | Required | Purpose |
|-----|----------|---------|
| `host` | yes | `http(s)://host:port` (mgmt port, usually 8091) |
| `user` | yes | Couchbase REST username |
| `pass` | yes | Couchbase REST password (plaintext in file) |
| `customName` | no | Friendly label in UI |
| `watch` | no (default `true`) | If `false`, cluster shown as “Not Watching” without API calls |

**CLI override today:** `--port <n>` overrides `server.port` at process start.

**Not in baseline:** `host` bind address, poll interval, timeouts, `verify_ssl`, env-based secrets, config path env var, hot-reload cache by mtime.

---

### HTTP API (dashboard)

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/` | Renders `templates/index.html` with `version` |
| `GET` | `/api/clusters` | Loads config → async fetch all watched clusters + buckets/stats → processed JSON for cards |
| `GET` | `/api/bucket/<cluster_host>/<bucket_name>/stats` | Detail stats + bucket doc for one bucket |
| `GET` | `/api/indexStatus` | `/indexStatus` per watched cluster |
| `GET` | `/api/xdcrStatus` | Remote clusters + XDCR-type tasks per watched cluster |

No API authentication, rate limiting, CORS policy, or health endpoint in baseline.

---

### Couchbase endpoints consumed

| Dashboard need | Cluster REST path |
|----------------|-------------------|
| Cluster / nodes / storage totals | `GET /pools/default` |
| Bucket detail | `GET /pools/default/buckets/{name}` |
| Bucket time-series stats | `GET /pools/default/buckets/{name}/stats` |
| GSI index status | `GET /indexStatus` |
| XDCR remotes | `GET /pools/default/remoteClusters` |
| XDCR tasks (filtered `type == xdcr`) | `GET /pools/default/tasks` |

**Timeouts (hard-coded):** ~10s per HTTP call; ~15s per cluster task wrapper; ~10s gather cap for bucket fan-out.

---

### Backend behavior (baseline)

- **Async fan-out:** `aiohttp.ClientSession` + `asyncio.gather` / `wait_for` so slow clusters do not block completion of others within a single request.
- **Watch gate:** `watch: false` → synthetic “not watching” result, no outbound calls.
- **Error isolation:** per-cluster / per-bucket errors become structured `error` fields; other clusters still render.
- **Processing (`process_cluster_data`):** health rollup from node statuses; memory/disk humanization; bucket quota/ops/eviction/durability/replica/storage fields; custom name passthrough; cluster UUID when present.
- **SSL:** for `https://` hosts, custom context with `check_hostname=False`, `CERT_NONE`.
- **Config load:** `open("config.json")` relative to **process CWD** on each relevant path (including every `/api/clusters`); validation via `validate_config`.
- **Event loop:** each API handler creates a **new** event loop, runs coroutine, closes loop (Flask sync bridge).
- **Packaging:** PyInstaller one-file via CI; `templates` + `static` + example `config.json` bundled; cross-platform matrix (Linux, Windows, macOS).

---

### Frontend behavior (baseline)

**Shell (`templates/index.html`):** title, version badge, healthy / not-watching / unhealthy counts, last-updated line, `#clusters` mount, CDN assets + local `styles.css` / `scripts.js`.

**Cards (`static/js/scripts.js`, large single file ~4k LOC):**

- Poll `/api/clusters`; first success builds cards; later polls update data in place.
- Per-cluster Bootstrap card with drag handle; jQuery UI sortable reordering (**not persisted**).
- Tabs (as applicable): **Nodes**, **Buckets**, **Stats**, **Index**, **XDCR**, **Data Charts**.
- Health badges: Healthy / Unhealthy / Not Watching / Unknown.
- Nodes: hostname links toward Couchbase UI (protocol/port aligned with cluster host), services, CPU/mem.
- Buckets: quota, usage %, ops, disk fetches, eviction, durability, replicas, backend.
- Stats: formatted system metrics.
- Charts: Chart.js series for ops/misses, memory, disk, connections/CPU/resident, XDCR ops/errors; bucket selector; scale control; system gauge/donut style charts.
- XDCR: remote cluster + task presentation + charts when data present.
- Errors: alert boxes for cluster-level failures; console logging (verbose in places).

**Styling:** `static/css/styles.css` + Bootstrap 4 utility classes.

---

### Metrics / views (user-visible)

- Cluster health and node service map  
- Memory / disk usage (cluster and node oriented)  
- Bucket memory quota and configuration  
- Ops-oriented series: gets/sets/deletes/CAS/lookup/incr/decr and related misses  
- Miss analytics and error-ish series (e.g. tmp OOM, auth errors where sampled)  
- Index status tab  
- XDCR status, ops, errors  
- Rolling chart windows (frontend-driven from stats samples)

---

### Distribution & DX (baseline)

| Artifact | Role |
|----------|------|
| `python app.py` | Dev / source run |
| `./cb_dashboard` / `.exe` | PyInstaller binary from GitHub Releases |
| `config.json` | **Tracked in git** with example credentials |
| `config.test.json` | Test fixture clusters |
| `requirements.txt` | `Flask==2.3.3`, `aiohttp==3.9.5` |
| `requirements-test.txt` | pytest, aioresponses, coverage, flake8, black, jest-related Python extras, etc. |
| `package.json` | Jest for `tests/test_scripts.js` (not wired in CI as of catalog) |
| `.github/workflows/build-and-release.yml` | Lint (soft flake8), black check, pytest, multi-OS build, tag release archives |
| `tests/test_app.py` | Unit tests for fetch/process/config/timeouts |
| `tests/test_complete_coverage.py` | Extra edge paths (index, process edges) |
| `tests/test_integration.py` | Flask client + workflow-style tests |
| `tests/test_scripts.js` | Frontend unit tests (local npm) |
| `README.md`, `README_RELEASE.md`, `README_TESTING.md` | User / release / test docs |
| `docs/work/multi-cluster-training-enhancements.md` | Separate **training-scale** product vision (not implemented in 1.0 baseline) |
| `LICENSE` | Project license file present |

---

### Known baseline limitations (catalog, not blame)

These are intentional snapshot facts for the improvement plan—not a full audit.

1. **Secrets:** cluster passwords live in plaintext `config.json`; file is git-tracked; binaries ship a copy of config.  
2. **Dashboard exposure:** no login; bind host not locked to localhost in code.  
3. **TLS:** verification off for HTTPS clusters.  
4. **XSS surface:** UI builds HTML via string templates without a systematic escape helper.  
5. **Structure:** almost all backend logic in `app.py`; almost all UI logic in one `scripts.js`.  
6. **Perf bridge:** new asyncio loop + full config read per API request; full poll payload every interval.  
7. **Port docs drift:** some release texts mention **5001** while app/README default **5000**.  
8. **Version drift:** `setup.py` 1.0.0 vs `__version__` 1.0.3 vs older README “2.1.0” strings.  
9. **Repo hygiene:** `build/` and `dist/` binaries have been tracked historically; large clone noise.  
10. **CI gaps:** Jest not in workflow; flake8 primary rules use `exit-zero` for style.  
11. **CDN risk:** Chart.js unpinned; jQuery/Bootstrap from CDN without SRI; offline binary UI depends on network for CDN assets unless cached.  
12. **CWD config:** running from another directory fails to find `config.json`.  
13. **Port contention:** default **5000** collides with many local stacks (other dashboards, dev servers, macOS airplay-ish habits, etc.)—mitigation is a first-class configurable port (already partly present; must be completed and documented)—see plan Phase A.

---

### What 1.0.0 is *not*

- Not a hosted multi-tenant SaaS control plane  
- Not Capella Management API native (uses classic REST shapes; Capella may need different auth/URLs)  
- Not a replacement for Couchbase UI / Prometheus / CB Multi  
- Does not implement the training multi-cluster EP-* items in `docs/work/multi-cluster-training-enhancements.md` (those remain a future product track)

---

### Baseline verification checklist (for release archaeology)

- [x] Multi-cluster config array  
- [x] `watch` flag  
- [x] `customName`  
- [x] Async timeouts / error isolation  
- [x] Nodes / Buckets / Stats / Charts tabs  
- [x] Index status API + UI  
- [x] XDCR status API + UI + charts  
- [x] Drag-and-drop card order (session only)  
- [x] Version badge in UI  
- [x] File + console logging with rotation  
- [x] PyInstaller CI matrix  
- [x] Pytest suite present  
- [ ] Dashboard auth  
- [ ] TLS verify on by default  
- [ ] `config.example.json` only in git  
- [ ] Configurable bind host + documented non-5000 default story  
- [ ] Modular JS/Python packages  

---

## Changelog skeleton (post-1.0.0)

Use this file for future ships. Newest first.

### Unreleased

See `IMPROVEMENT_PLAN.md` phases A–F and optional training track.

### 1.3.0 — In-app config editor (2026-08-07)

#### Added
- Settings **gear icon** (upper right) opens a modal to edit `config.json`
- Add / remove clusters, **Test** connection, watch toggle
- **Stats poll interval** (`server.poll_interval_seconds`, 5–300s) applied live
- Bind host/port + logging fields (host/port need process restart)
- API: `GET/PUT /api/config`, `POST /api/config/test`, `GET /api/meta`
- Passwords masked in UI (`********` keeps existing on save)

### 1.2.0 — Chart history 1–30 minutes (2026-08-07)

#### Added
- Client-side rolling history for bucket stats samples (`static/js/chart_history.js`)
  - Merges each 10s poll by timestamp; retains up to **30 minutes**
  - **Time range** dropdown on Data Charts: **1 / 5 / 15 / 30 minutes**
  - Preference saved in `localStorage`
  - Status line: points stored / window shown
- Jest tests: `tests/test_chart_history.js`

#### Changed
- Charts render from history window (not only the last ~60s Couchbase minute zoom)
- X-axis tick auto-skip for longer ranges
- Version **1.2.0**

### 1.1.0 — Configurable listen host/port (2026-08-07)

#### Added
- `server.host` (default `127.0.0.1`) and default **`server.port` 5050** (avoids crowded 5000)
- CLI: `--host`, `--port`, `--debug`, `--no-debug`
- Env: `CB_DASHBOARD_HOST`, `CB_DASHBOARD_PORT`
- Precedence: CLI → env → config.json → defaults
- Startup prints `Open: http://host:port` and bind-failure tips
- `config.example.json` template
- `resolve_server_settings()` + tests (`tests/test_server_settings.py`)
- `main()` entrypoint for console scripts

#### Changed
- Debug default is **false** when unset
- Flask binds explicit `host` (localhost by default)
- Version aligned to **1.1.0** (`app.py`, `setup.py`)

### 1.0.3 — (runtime string at prior catalog time)

Patch-level runtime version present in `app.py` at original catalog snapshot. Treat feature surface as **1.0.0 baseline** above unless a later note lists deltas.

### 1.0.0 — Baseline catalog

Initial cataloged product surface for improvement planning (this document).

---

## Related documents

| Doc | Role |
|-----|------|
| `IMPROVEMENT_PLAN.md` | Phased / sliced implementation plan for hardening + structure + DX |
| `docs/work/multi-cluster-training-enhancements.md` | Training instructor multi-cluster product enhancements (parallel track) |
| `settings/VERSION_GUIDE.md` | How to bump version strings |
| `README.md` | End-user quick start |
| `README_RELEASE.md` | Binary release usage |
| `README_TESTING.md` | Test how-to |
