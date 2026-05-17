# Multi-Cluster Training Dashboard Enhancement Plan

**Project:** Couchbase Cluster Dashboard  
**Version:** 2.1.0  
**Focus:** Training Session Multi-Cluster Management  
**Status:** Planning Document

---

## Table of Contents

1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Enhancement Proposals](#enhancement-proposals)
   - [EP-001: Cluster Grouping and Labels](#ep-001-cluster-grouping-and-labels)
   - [EP-002: Quick Status Overview Dashboard](#ep-002-quick-status-overview-dashboard)
   - [EP-003: Session Management and Presets](#ep-003-session-management-and-presets)
   - [EP-004: Enhanced Training Visual Indicators](#ep-004-enhanced-training-visual-indicators)
   - [EP-005: Bulk Operations for Training Management](#ep-005-bulk-operations-for-training-management)
   - [EP-006: Cluster Comparison and Diff View](#ep-006-cluster-comparison-and-diff-view)
   - [EP-007: Improved Error Context for Training](#ep-007-improved-error-context-for-training)
   - [EP-008: Auto-Discovery and Registration](#ep-008-auto-discovery-and-registration)
   - [EP-009: Activity Timeline and History](#ep-009-activity-timeline-and-history)
   - [EP-010: Mobile and Tablet Optimization](#ep-010-mobile-and-tablet-optimization)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Configuration Schema Changes](#configuration-schema-changes)
6. [API Changes](#api-changes)
7. [UI/UX Considerations](#uiux-considerations)
8. [Testing Strategy](#testing-strategy)

---

## Overview

This document outlines a comprehensive enhancement plan for the Couchbase Cluster Dashboard to better support training scenarios where instructors need to monitor multiple student clusters simultaneously.

### Use Case Context

**Primary User:** Training instructors monitoring student Couchbase clusters during lab sessions  
**Typical Scale:** 15-50 clusters per session  
**Key Pain Points:**
- Difficulty organizing clusters by lab session, group, or student
- Overwhelming detail when viewing many clusters at once
- Manual configuration of similar clusters is tedious
- Hard to quickly identify which students need help
- No way to save/reuse session configurations

### Goals

1. Enable logical organization of clusters for training contexts
2. Provide multiple viewing modes suitable for different monitoring needs
3. Streamline configuration and management of many similar clusters
4. Add training-specific features like expected state validation
5. Maintain backward compatibility with existing configurations

---

## Current State Analysis

### Existing Strengths

- ✅ Async architecture with per-cluster timeouts
- ✅ Non-blocking requests (fast clusters display immediately)
- ✅ Custom cluster names via `customName` field
- ✅ Watch/unwatch toggle via `watch` boolean
- ✅ Drag-and-drop cluster reordering
- ✅ Comprehensive metrics (nodes, buckets, XDCR, charts)
- ✅ Error isolation (one cluster failure doesn't affect others)

### Current Configuration Schema

```json
{
  "server": { "port": 5000, "debug": false },
  "logging": { "level": "info", "file": "logs/app.log", "enabled": true },
  "clusters": [
    {
      "host": "http://127.0.0.1:8091",
      "user": "Administrator",
      "pass": "password",
      "customName": "Local Development",
      "watch": true
    }
  ]
}
```

### Gaps for Training Use Case

| Gap | Impact | Severity |
|-----|--------|----------|
| No grouping mechanism | Can't organize by lab/session | High |
| Single view mode | Detail overload with 20+ clusters | High |
| No bulk operations | Tedious to configure many clusters | Medium |
| No session persistence | Must reconfigure for each lab | Medium |
| No expected state validation | Hard to verify student progress | Medium |
| Limited mobile support | Can't easily monitor while walking around | Low |

---

## Enhancement Proposals

---

## EP-001: Cluster Grouping and Labels

### Objective

Add the ability to categorize clusters into logical groups for training sessions (e.g., "Lab Session A - Morning", "Group 3 - Advanced Track").

### Requirements

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001-01 | Add optional `group` field to cluster configuration | P0 |
| FR-001-02 | Support multiple groups per cluster (array) | P1 |
| FR-001-03 | Display group badge/label on cluster cards | P0 |
| FR-001-04 | Filter clusters by group in UI | P0 |
| FR-001-05 | Group-level health summary statistics | P1 |
| FR-001-06 | URL parameter support for group filtering | P2 |
| FR-001-07 | Color coding for different groups | P2 |

#### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-001-01 | Backward compatible (clusters without group work as before) |
| NFR-001-02 | Groups should not impact performance for <100 clusters |
| NFR-001-03 | Group names should support Unicode/special characters |

### Design

#### Configuration Changes

```json
{
  "clusters": [
    {
      "host": "http://student1.example.com:8091",
      "user": "Administrator",
      "pass": "student123",
      "customName": "Student 1",
      "group": "Lab Session A - Morning",
      "watch": true
    },
    {
      "host": "http://student2.example.com:8091",
      "user": "Administrator",
      "pass": "student123",
      "customName": "Student 2",
      "group": ["Lab Session A - Morning", "Advanced Track"],
      "watch": true
    }
  ]
}
```

#### Data Model Changes

**Backend (Python):**
- Modify `process_cluster_data()` to include group information
- Add group extraction logic in `load_config()`
- Create helper function `get_all_groups(clusters)` → returns unique sorted list

**Frontend (JavaScript):**
- Add `groups` array to cluster data object
- Create group filter UI component
- Add group badge rendering in cluster cards

#### UI Components

1. **Group Filter Bar** (above cluster grid)
   - Multi-select dropdown or chip-based filter
   - "All Groups" option
   - Active filter indicator with count

2. **Group Badge on Cards**
   - Small pill/badge showing group name
   - Truncated if too long with tooltip
   - Color-coded based on group hash or explicit color config

3. **Group Summary Panel** (optional sidebar)
   - Collapsible panel showing per-group stats
   - Example: "Lab A: 12 healthy, 2 issues, 1 not watching"

#### API Changes

**GET /api/clusters**
- Response includes `groups` field (array of strings) per cluster
- No breaking changes to existing response structure

**GET /api/groups** (NEW)
- Returns list of all groups with cluster counts
- Response: `[{ "name": "Lab A", "clusterCount": 15, "healthyCount": 12, ... }]`

### Implementation Steps

1. [ ] Update `config.json` schema validation to accept `group` (string or array)
2. [ ] Modify `validate_config()` to handle group field validation
3. [ ] Update `process_cluster_data()` to pass through group information
4. [ ] Add `get_all_groups()` helper function
5. [ ] Create new endpoint `GET /api/groups`
6. [ ] Update frontend to render group badges on cluster cards
7. [ ] Implement group filter UI component
8. [ ] Add URL parameter parsing for `?group=Lab%20A`
9. [ ] Write tests for group filtering logic
10. [ ] Update README with group configuration examples

### Testing Checklist

- [ ] Clusters without `group` field render correctly
- [ ] Single string group works
- [ ] Array of groups works (multi-group assignment)
- [ ] Filtering by group shows correct subset
- [ ] URL parameter pre-filters correctly
- [ ] Group summary stats are accurate
- [ ] Special characters in group names handled safely

### Files to Modify

| File | Changes |
|------|---------|
| `app.py` | Add group validation, processing, and new API endpoint |
| `templates/index.html` | Add group filter UI container |
| `static/js/scripts.js` | Add group rendering, filtering, and URL param handling |
| `static/css/styles.css` | Add group badge and filter styles |
| `README.md` | Document group feature usage |

### Estimated Effort

- Backend changes: 2-3 hours
- Frontend changes: 3-4 hours
- Testing: 1-2 hours
- Documentation: 30 minutes
- **Total: ~7-10 hours**

---

## EP-002: Quick Status Overview Dashboard

### Objective

Provide a compact, at-a-glance view optimized for monitoring many clusters simultaneously without detail overload.

### Requirements

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-002-01 | Add "Compact View" toggle to switch between detailed and grid views | P0 |
| FR-002-02 | Compact view shows: customName, health status, quick action buttons | P0 |
| FR-002-03 | Group summary cards showing aggregate health per group | P1 |
| FR-002-04 | Problem clusters highlighted and sortable to top | P0 |
| FR-002-05 | Click cluster in compact view opens detail modal or expands inline | P0 |
| FR-002-06 | Configurable columns for compact view (name, status, group, last update) | P2 |
| FR-002-07 | Export status as CSV/JSON button | P1 |

#### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-002-01 | Compact view should render 50+ clusters without performance issues |
| NFR-002-02 | Status updates should be smooth (no flickering) |
| NFR-002-03 | Must work on tablets (minimum 768px width) |

### Design

#### View Modes

1. **Detailed View** (Current)
   - Full cluster cards with all tabs (Nodes, Buckets, Stats, XDCR, Charts)
   - Suitable for 1-10 clusters

2. **Compact View** (New)
   - Grid of small cards (e.g., 200x80px)
   - Content: Icon + Name + Status Badge + Quick Actions
   - Click opens modal with full details

3. **Summary View** (New)
   - Group-level cards only
   - Shows: Group Name, Healthy/Total count, Issue count
   - Click expands to show clusters in that group

#### Compact Card Design

```
┌─────────────────────────────────────────┐
│ 🟢 Student 1 - Lab A          [👁] [↻] │
│ http://student1:8091                    │
└─────────────────────────────────────────┘

Legend:
🟢 = Healthy (green)
🟡 = Degraded/Warning (yellow)  
🔴 = Unhealthy/Error (red)
⚪ = Not Watching (gray)
👁 = Toggle watch
↻ = Force refresh single cluster
```

#### Group Summary Card Design

```
┌────────────────────────────────────────────────────┐
│ 📁 Lab Session A - Morning              12/15 🟢   │
│ 2 issues 🔴  1 not watching ⚪                     │
│                                                    │
│ [View Clusters] [Mark All Healthy]                 │
└────────────────────────────────────────────────────┘
```

### Implementation Steps

1. [ ] Add view mode state management in JavaScript
2. [ ] Create compact card HTML template
3. [ ] Implement view toggle UI (buttons or segmented control)
4. [ ] Add group summary aggregation logic
5. [ ] Create modal component for cluster detail in compact mode
6. [ ] Implement CSV/JSON export functionality
7. [ ] Add sort options (by name, status, group, last update)
8. [ ] Implement "highlight issues" filter
9. [ ] Add localStorage persistence for view preference
10. [ ] Write tests for view switching and export

### API Additions

**GET /api/clusters/summary** (Optional)
- Returns aggregated data only (no per-cluster bucket/node details)
- Faster for compact view when full details not needed
- Response includes group summaries and problem cluster list

### Files to Modify

| File | Changes |
|------|---------|
| `static/js/scripts.js` | Add view mode logic, compact rendering, export functions |
| `static/css/styles.css` | Add compact card styles, modal styles |
| `templates/index.html` | Add view toggle controls, modal container |
| `app.py` | Add optional summary endpoint (nice-to-have) |

### Estimated Effort

- Core compact view: 3-4 hours
- Group summaries: 2 hours
- Export functionality: 1-2 hours
- Modal and interactions: 2 hours
- Testing: 1 hour
- **Total: ~9-11 hours**

---

## EP-003: Session Management and Presets

### Objective

Allow instructors to save, load, and switch between different training session configurations without manually editing config.json.

### Requirements

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-003-01 | Define "sessions" section in config.json | P0 |
| FR-003-02 | Session selector dropdown in UI header | P0 |
| FR-003-03 | Session includes: name, description, cluster list or filter | P0 |
| FR-003-04 | Ability to switch sessions without restarting app | P1 |
| FR-003-05 | Session-specific refresh intervals | P2 |
| FR-003-06 | "Active Session" indicator in UI | P1 |
| FR-003-07 | Quick "Save Current View as Session" (future) | P3 |

#### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-003-01 | Session switching should be instant (<1s) |
| NFR-003-02 | Must support 10+ sessions in single config |
| NFR-003-03 | Session names must be unique |

### Design

#### Configuration Schema

```json
{
  "sessions": {
    "morning-lab": {
      "name": "Morning Lab Session",
      "description": "Introduction to Couchbase for new students",
      "groups": ["Lab Session A - Morning"],
      "refreshInterval": 10,
      "defaultView": "compact"
    },
    "afternoon-advanced": {
      "name": "Afternoon Advanced Lab",
      "description": "XDCR and performance tuning workshop",
      "groups": ["Lab Session B - Afternoon", "Advanced Track"],
      "refreshInterval": 5,
      "defaultView": "detailed"
    },
    "all-clusters": {
      "name": "All Clusters",
      "description": "View every configured cluster",
      "groups": "all",
      "refreshInterval": 15
    }
  },
  "defaultSession": "morning-lab",
  "clusters": [...]
}
```

#### Session Resolution Logic

When loading clusters:

1. Check for `?session=morning-lab` URL parameter
2. Fall back to `defaultSession` in config
3. If neither, show all clusters (current behavior)

#### UI Components

1. **Session Selector Dropdown**
   - Located in header next to title
   - Shows current session name
   - Lists all available sessions with descriptions on hover

2. **Session Info Banner** (optional)
   - Shows session description
   - Shows cluster count for this session
   - Dismissible

### Implementation Steps

1. [ ] Update config validation to handle `sessions` object
2. [ ] Add session resolution logic in `load_config()` or new helper
3. [ ] Modify `get_clusters_data()` to filter by session groups
4. [ ] Add `GET /api/sessions` endpoint to list available sessions
5. [ ] Create session selector UI component
6. [ ] Implement session switching (AJAX reload with session param)
7. [ ] Add URL parameter support for session
8. [ ] Persist selected session in localStorage
9. [ ] Update README with session configuration examples

### API Changes

**GET /api/sessions** (NEW)
```json
{
  "sessions": [
    {
      "id": "morning-lab",
      "name": "Morning Lab Session",
      "description": "...",
      "clusterCount": 15,
      "groups": ["Lab Session A - Morning"]
    }
  ],
  "current": "morning-lab"
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `app.py` | Session validation, resolution, filtering, new endpoint |
| `templates/index.html` | Add session selector dropdown |
| `static/js/scripts.js` | Session loading, switching, URL param handling |
| `README.md` | Document sessions feature |

### Estimated Effort

- Backend session logic: 2-3 hours
- Frontend selector: 1-2 hours
- URL/localStorage persistence: 1 hour
- Testing: 1 hour
- **Total: ~5-7 hours**

---

## EP-004: Enhanced Training Visual Indicators

### Objective

Add visual cues and validation features that help instructors quickly verify student cluster configurations match expected lab states.

### Requirements

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-004-01 | Add optional `expectedState` configuration per cluster or group | P1 |
| FR-004-02 | Expected state includes: nodeCount, bucketCount, bucketNames, version | P1 |
| FR-004-03 | Visual indicator showing "Matches Expected" / "Configuration Drift" | P1 |
| FR-004-04 | Detail view highlights differences from expected state | P1 |
| FR-004-05 | Add `studentId` or `labPosition` field for roster tracking | P2 |
| FR-004-06 | Quick note/annotation field per cluster (in-memory, session-only) | P2 |
| FR-004-07 | Progress indicator (e.g., "3/5 lab tasks completed") | P3 |

#### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-004-01 | Expected state validation should not block UI updates |
| NFR-004-02 | Annotations should persist in browser session (localStorage) |

### Design

#### Expected State Configuration

```json
{
  "clusters": [
    {
      "host": "http://student1.example.com:8091",
      "user": "Administrator",
      "pass": "student123",
      "customName": "Student 1",
      "group": "Lab Session A",
      "expectedState": {
        "nodeCount": 1,
        "bucketCount": 3,
        "bucketNames": ["travel-sample", "gamesim-sample", "beer-sample"],
        "minVersion": "7.2.0",
        "services": ["data", "query", "index"]
      },
      "studentId": "S001",
      "watch": true
    }
  ]
}
```

#### Validation Logic

Backend computes validation status:

```python
validation_status = {
    "matches": True,
    "checks": [
        {"name": "Node Count", "expected": 1, "actual": 1, "pass": True},
        {"name": "Bucket Count", "expected": 3, "actual": 2, "pass": False},
        {"name": "Bucket Names", "expected": [...], "actual": [...], "pass": False, "missing": ["beer-sample"]},
        {"name": "Version", "expected": "7.2.0+", "actual": "7.1.0", "pass": False}
    ],
    "summary": "2 of 4 checks passed"
}
```

#### UI Indicators

1. **Status Badge Enhancement**
   - Add second badge: "✅ Config OK" or "⚠️ Drift Detected"
   - Tooltip shows quick summary

2. **Validation Tab** (new tab in cluster detail)
   - Table showing each check with expected vs actual
   - Color-coded rows (green/red)
   - "Re-validate" button

3. **Annotation Icon**
   - Small note icon appears if annotation exists
   - Click opens inline editor
   - Persisted in localStorage

### Implementation Steps

1. [ ] Add `expectedState` to config validation schema
2. [ ] Create validation logic function `validate_cluster_state(cluster_data, expected)`
3. [ ] Include validation results in cluster processing
4. [ ] Add `studentId` field support (passthrough, no special logic)
5. [ ] Create validation status badge component
6. [ ] Add "Validation" tab to cluster detail modal/card
7. [ ] Implement annotation feature with localStorage
8. [ ] Add progress tracking stub (for future lab task integration)
9. [ ] Write tests for validation logic

### Files to Modify

| File | Changes |
|------|---------|
| `app.py` | Expected state validation logic, include in response |
| `static/js/scripts.js` | Validation badge, validation tab, annotation editor |
| `static/css/styles.css` | Validation result styles |
| `README.md` | Document expectedState configuration |

### Estimated Effort

- Backend validation: 2-3 hours
- Frontend validation UI: 3-4 hours
- Annotation feature: 1-2 hours
- Testing: 1 hour
- **Total: ~7-10 hours**

---

## EP-005: Bulk Operations for Training Management

### Objective

Enable efficient management of many similar clusters through bulk operations, reducing repetitive manual tasks.

### Requirements

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-005-01 | "Select All" / "Select Group" checkboxes in UI | P0 |
| FR-005-02 | Bulk toggle watch/unwatch for selected clusters | P0 |
| FR-005-03 | Bulk refresh for selected clusters | P1 |
| FR-005-04 | CSV import for adding clusters (template generation) | P1 |
| FR-005-05 | Bulk credential update (apply same user/pass to selection) | P2 |
| FR-005-06 | "Duplicate cluster config" with hostname substitution | P2 |
| FR-005-07 | Bulk delete clusters from config (with confirmation) | P3 |

#### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-005-01 | Bulk operations should provide progress feedback |
| NFR-005-02 | CSV import must validate all rows before applying |
| NFR-005-03 | Destructive operations require explicit confirmation |

### Design

#### CSV Import Format

```csv
host,user,pass,customName,group
http://student1:8091,Administrator,pass123,Student 1,Lab A
http://student2:8091,Administrator,pass123,Student 2,Lab A
http://student3:8091,Administrator,pass123,Student 3,Lab B
```

**Template Download Button:** Generates CSV with headers and example row based on current config patterns.

#### Bulk Action Bar

Appears when clusters are selected:

```
┌─────────────────────────────────────────────────────────────────┐
│ ☑ 5 clusters selected                    [Toggle Watch] [Refresh] │
│                                  [Update Credentials] [Export]   │
└─────────────────────────────────────────────────────────────────┘
```

#### Cluster Template Feature

1. User configures one "template" cluster with credentials
2. Provides list of hostnames or pattern (e.g., `student{1-20}.lab.local`)
3. System generates cluster entries with substituted hostnames

### Implementation Steps

1. [ ] Add checkbox to each cluster card in compact view
2. [ ] Implement selection state management
3. [ ] Create bulk action bar UI component
4. [ ] Implement bulk watch toggle (client-side + persist to config)
5. [ ] Add bulk refresh (parallel API calls with progress)
6. [ ] Create CSV import modal with file upload and preview
7. [ ] Add CSV validation and error reporting
8. [ ] Implement credential update modal for bulk
9. [ ] Add template generation feature
10. [ ] Write tests for CSV parsing and bulk operations

### Files to Modify

| File | Changes |
|------|---------|
| `app.py` | CSV parsing endpoint, bulk update endpoint |
| `static/js/scripts.js` | Selection logic, bulk actions, CSV handling |
| `static/css/styles.css` | Bulk action bar, checkbox styles |
| `templates/index.html` | Bulk action bar container, import modal |

### Estimated Effort

- Selection and bulk UI: 3-4 hours
- CSV import: 3-4 hours
- Template generation: 2 hours
- Testing: 2 hours
- **Total: ~10-12 hours**

---

## EP-006: Cluster Comparison and Diff View

### Objective

Allow instructors to compare two clusters side-by-side to identify configuration differences, useful for verifying student setups against a reference.

### Requirements

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-006-01 | "Compare" button on cluster cards opens comparison mode | P1 |
| FR-006-02 | Select second cluster to compare against | P1 |
| FR-006-03 | Side-by-side display of key metrics (nodes, buckets, versions) | P1 |
| FR-006-04 | Highlight differences in red/green | P1 |
| FR-006-05 | Compare against "reference cluster" marked in config | P2 |
| FR-006-06 | Export comparison report | P3 |

#### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-006-01 | Comparison should work with partial data (handle errors gracefully) |
| NFR-006-02 | Must handle comparing clusters with different bucket sets |

### Design

#### Comparison Modal Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Compare Clusters                                    [X] [Export]    │
├─────────────────────────────┬───────────────────────────────────────┤
│ Cluster A: Student 1        │ Cluster B: Student 2                  │
│ 🟢 Healthy                  │ 🟢 Healthy                            │
├─────────────────────────────┼───────────────────────────────────────┤
│ Nodes: 1                    │ Nodes: 1                    ✅        │
│ Version: 7.2.1              │ Version: 7.2.0              ⚠️        │
│ Buckets: 3                  │ Buckets: 3                    ✅      │
│   - travel-sample           │   - travel-sample             ✅      │
│   - gamesim-sample          │   - gamesim-sample            ✅      │
│   - beer-sample             │   - [missing]                 ❌      │
│ XDCR Tasks: 0               │ XDCR Tasks: 1                 ⚠️      │
│ Memory Used: 2.3 GB         │ Memory Used: 2.1 GB           ✅      │
└─────────────────────────────┴───────────────────────────────────────┘
```

#### Reference Cluster Feature

Mark a cluster as "reference" in config:

```json
{
  "host": "...",
  "customName": "Reference Configuration",
  "isReference": true
}
```

Then comparison UI offers "Compare to Reference" quick action.

### Implementation Steps

1. [ ] Add comparison state management in JavaScript
2. [ ] Create comparison modal component
3. [ ] Implement cluster selection for comparison target
4. [ ] Build diff logic for key metrics (nodes, buckets, versions, XDCR)
5. [ ] Add visual diff highlighting
6. [ ] Implement `isReference` config field and logic
7. [ ] Add "Compare to Reference" action
8. [ ] Implement export of comparison results
9. [ ] Test with various cluster states (errors, missing data)

### Files to Modify

| File | Changes |
|------|---------|
| `static/js/scripts.js` | Comparison logic, modal, diff rendering |
| `static/css/styles.css` | Comparison modal and diff styles |
| `templates/index.html` | Comparison modal container |
| `app.py` | Optional: dedicated comparison endpoint |

### Estimated Effort

- Core comparison: 4-5 hours
- Reference cluster feature: 1-2 hours
- Export: 1 hour
- Testing: 1-2 hours
- **Total: ~7-10 hours**

---

## EP-007: Improved Error Context for Training

### Objective

Enhance error messages and provide actionable guidance specific to common student setup issues during training.

### Requirements

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-007-01 | Categorize errors into types (connection, auth, timeout, partial) | P1 |
| FR-007-02 | Show suggested troubleshooting steps per error type | P1 |
| FR-007-03 | Link to common student setup issues documentation | P2 |
| FR-007-04 | "Expected vs Actual" error context (e.g., "Port 8091 refused - is Couchbase running?") | P1 |
| FR-007-05 | Quick "Test Connection" button for failed clusters | P2 |

#### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-007-01 | Error suggestions should not require additional API calls |
| NFR-007-02 | Must not expose sensitive credential information in error messages |

### Design

#### Error Categories and Suggestions

| Error Pattern | Category | Suggestion |
|---------------|----------|------------|
| `Connection refused` | Connection | "Verify Couchbase is running on the host. Check port 8091 is accessible." |
| `401 Unauthorized` | Authentication | "Credentials may be incorrect. Verify username/password match the cluster setup." |
| `timeout` | Timeout | "Cluster may be slow or unreachable. Check network connectivity and firewall rules." |
| `Partial data` | Partial | "Some endpoints failed. Cluster may be partially configured or under load." |
| `hostname not found` | DNS | "Hostname could not be resolved. Check DNS settings or use IP address instead." |

#### Enhanced Error Display

```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 Error: Connection refused                                │
│                                                             │
│ Unable to connect to http://student5:8091                   │
│                                                             │
│ 💡 Suggested Actions:                                       │
│ • Verify Couchbase Server is running on student5            │
│ • Check that port 8091 is not blocked by firewall           │
│ • Try accessing http://student5:8091 in your browser        │
│                                                             │
│ [Test Connection] [View Logs]                               │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Steps

1. [ ] Create error categorization function based on error message patterns
2. [ ] Build suggestion lookup table or mapping
3. [ ] Update error rendering in cluster cards to show suggestions
4. [ ] Add "Test Connection" action that retries fetch for single cluster
5. [ ] Create expandable "Troubleshooting Tips" section in UI
6. [ ] Ensure error messages don't leak credentials
7. [ ] Update logging to include categorized error types

### Files to Modify

| File | Changes |
|------|---------|
| `app.py` | Error categorization, enhanced error objects |
| `static/js/scripts.js` | Error display with suggestions, test connection action |
| `static/css/styles.css` | Enhanced error card styles |

### Estimated Effort

- Error categorization: 2 hours
- UI suggestions display: 2 hours
- Test connection: 1 hour
- Testing: 1 hour
- **Total: ~6 hours**

---

## EP-008: Auto-Discovery and Registration

### Objective

Enable dynamic registration of clusters, useful for cloud-based or ephemeral student environments where hostnames are not known in advance.

### Requirements

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-008-01 | POST endpoint for clusters to register themselves | P2 |
| FR-008-02 | Registration includes: host, credentials, metadata (studentId, lab) | P2 |
| FR-008-03 | Optional: auto-watch newly registered clusters | P2 |
| FR-008-04 | Registered clusters appear in dashboard without config.json edit | P2 |
| FR-008-05 | TTL or expiration for registered clusters (cleanup) | P3 |
| FR-008-06 | Registration secret/token for security | P2 |

#### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-008-01 | Registration should be idempotent (re-registering updates existing) |
| NFR-008-02 | Must validate registration requests (prevent abuse) |

### Design

#### Registration Endpoint

**POST /api/register**

Request:
```json
{
  "host": "http://dynamic-student-123.cloud.example.com:8091",
  "user": "Administrator",
  "pass": "temp-password-abc123",
  "customName": "Student 123",
  "group": "Cloud Lab Session",
  "metadata": {
    "studentId": "S123",
    "labSession": "cloud-2024-01-15"
  },
  "token": "registration-secret-from-instructor"
}
```

Response:
```json
{
  "status": "registered",
  "clusterId": "uuid-generated",
  "message": "Cluster registered successfully"
}
```

#### Security Considerations

- Require registration token (configured in server settings)
- Rate limiting on registration endpoint
- Optional: IP whitelist for registration

### Implementation Steps

1. [ ] Add registration token to server config section
2. [ ] Create `POST /api/register` endpoint with validation
3. [ ] Store registered clusters in memory (or file for persistence)
4. [ ] Merge registered clusters with config clusters on load
5. [ ] Add TTL cleanup job for expired registrations
6. [ ] Create student-side registration script/example
7. [ ] Document registration API for integration

### Files to Modify

| File | Changes |
|------|---------|
| `app.py` | Registration endpoint, cluster merging logic, TTL cleanup |
| `config.json` | Add registration settings example |
| `README.md` | Document registration feature and security |

### Estimated Effort

- Core registration: 3-4 hours
- Persistence and TTL: 2 hours
- Documentation: 1 hour
- **Total: ~6-7 hours**

---

## EP-009: Activity Timeline and History

### Objective

Track cluster state changes over time to provide session summaries and identify when issues occurred.

### Requirements

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-009-01 | Log significant state changes (healthy → unhealthy, etc.) | P2 |
| FR-009-02 | Display timeline of events per cluster | P2 |
| FR-009-03 | Session summary: "Started: 15 healthy, Currently: 13 healthy, 2 issues" | P2 |
| FR-009-04 | Export session report with timeline | P3 |
| FR-009-05 | Configurable event retention (in-memory vs persistent) | P3 |

#### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-009-01 | Timeline should not impact refresh performance |
| NFR-009-02 | In-memory timeline should handle 1000+ events |

### Design

#### Event Types

- `cluster_healthy`: Cluster transitioned to healthy state
- `cluster_unhealthy`: Cluster has errors or issues
- `cluster_timeout`: Cluster request timed out
- `bucket_created`: New bucket detected
- `bucket_deleted`: Bucket no longer present
- `xdcr_task_started`: XDCR task appeared
- `xdcr_task_completed`: XDCR task finished

#### Timeline Display

```
┌──────────────────────────────────────────────────────────────┐
│ 📅 Session Timeline                              [Export]    │
├──────────────────────────────────────────────────────────────┤
│ 09:15:00  🟢 Student 1 became healthy                         │
│ 09:17:23  🔴 Student 5 connection error                       │
│ 09:18:45  🟢 Student 5 recovered                              │
│ 09:22:10  📦 Student 3 created bucket "my-test-bucket"        │
│ 09:25:00  ⚠️ Student 8 XDCR task started                      │
│ ...                                                         │
└──────────────────────────────────────────────────────────────┘
```

### Implementation Steps

1. [ ] Create event logging system in backend
2. [ ] Define event types and triggers
3. [ ] Store events in memory (list with max size)
4. [ ] Add `GET /api/timeline` endpoint
5. [ ] Create timeline UI component (collapsible)
6. [ ] Implement session summary calculation
7. [ ] Add export functionality for timeline
8. [ ] Optional: persist timeline to file on shutdown

### Files to Modify

| File | Changes |
|------|---------|
| `app.py` | Event logging, timeline endpoint, summary calculation |
| `static/js/scripts.js` | Timeline display, event rendering |
| `static/css/styles.css` | Timeline styles |

### Estimated Effort

- Core event system: 3 hours
- Timeline UI: 2-3 hours
- Summary and export: 2 hours
- **Total: ~7-8 hours**

---

## EP-010: Mobile and Tablet Optimization

### Objective

Optimize the dashboard for use on tablets and mobile devices, enabling instructors to monitor clusters while walking around the training room.

### Requirements

#### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-010-01 | Responsive layout for tablets (768px - 1024px) | P1 |
| FR-010-02 | Larger tap targets (min 44x44px) for touch | P1 |
| FR-010-03 | Swipe gestures for cluster card navigation | P2 |
| FR-010-04 | Simplified compact view optimized for portrait mode | P1 |
| FR-010-05 | Quick status refresh pull-to-refresh | P2 |
| FR-010-06 | Sticky header with essential controls | P1 |

#### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-010-01 | Touch targets must meet WCAG 2.1 AA minimum size |
| NFR-010-02 | Must work in Chrome/Safari on iOS and Android tablets |

### Design

#### Tablet Optimizations

1. **Compact View as Default** on screens < 1024px
2. **Bottom Navigation Bar** for quick actions
3. **Card Stacking** instead of grid on very small screens
4. **Larger Status Icons** for visibility from distance
5. **Long-press Context Menu** for cluster actions

#### CSS Media Queries

```css
@media (max-width: 1024px) {
  /* Tablet styles */
  .cluster-card { min-height: 120px; }
  .status-badge { font-size: 1.2rem; }
}

@media (max-width: 768px) {
  /* Mobile styles */
  .cluster-card { width: 100%; }
}
```

### Implementation Steps

1. [ ] Audit current CSS for responsive issues
2. [ ] Add media queries for tablet breakpoints
3. [ ] Increase touch target sizes (buttons, cards, tabs)
4. [ ] Implement sticky header for mobile
5. [ ] Add pull-to-refresh using touch events
6. [ ] Optimize font sizes for readability
7. [ ] Test on actual tablet devices
8. [ ] Add touch-friendly drag-and-drop alternative (or disable on mobile)

### Files to Modify

| File | Changes |
|------|---------|
| `static/css/styles.css` | Media queries, touch target sizing |
| `static/js/scripts.js` | Pull-to-refresh, touch handlers |
| `templates/index.html` | Meta viewport (if not present) |

### Estimated Effort

- CSS responsive: 2-3 hours
- Touch interactions: 2 hours
- Testing on devices: 1-2 hours
- **Total: ~5-7 hours**

---

## Implementation Roadmap

### Phase 1: Foundation (Quick Wins)
**Estimated Total: 15-18 hours**

| EP | Feature | Priority | Dependencies |
|----|---------|----------|--------------|
| EP-001 | Cluster Grouping | P0 | None |
| EP-002 | Quick Status Overview | P0 | None |
| EP-003 | Session Management | P0 | EP-001 |

### Phase 2: Training Features
**Estimated Total: 20-25 hours**

| EP | Feature | Priority | Dependencies |
|----|---------|----------|--------------|
| EP-004 | Training Visual Indicators | P1 | EP-001 |
| EP-005 | Bulk Operations | P1 | EP-001, EP-002 |
| EP-007 | Improved Error Context | P1 | None |

### Phase 3: Advanced Features
**Estimated Total: 20-25 hours**

| EP | Feature | Priority | Dependencies |
|----|---------|----------|--------------|
| EP-006 | Cluster Comparison | P2 | None |
| EP-009 | Activity Timeline | P2 | None |
| EP-010 | Mobile Optimization | P2 | EP-002 |

### Phase 4: Future/Optional
**Estimated Total: 13-14 hours**

| EP | Feature | Priority | Dependencies |
|----|---------|----------|--------------|
| EP-008 | Auto-Discovery | P3 | None |

---

## Configuration Schema Changes

### Proposed Full Schema

```json
{
  "server": {
    "port": 5000,
    "debug": false,
    "registrationToken": "optional-secret-for-auto-discovery"
  },
  "logging": {
    "level": "info",
    "file": "logs/app.log",
    "enabled": true
  },
  "defaultSession": "morning-lab",
  "sessions": {
    "morning-lab": {
      "name": "Morning Lab",
      "description": "...",
      "groups": ["Lab A"],
      "refreshInterval": 10,
      "defaultView": "compact"
    }
  },
  "clusters": [
    {
      "host": "http://...",
      "user": "...",
      "pass": "...",
      "customName": "...",
      "group": "Lab A" | ["Lab A", "Group 1"],
      "studentId": "S001",
      "expectedState": {
        "nodeCount": 1,
        "bucketCount": 3,
        "bucketNames": ["travel-sample"],
        "minVersion": "7.2.0",
        "services": ["data", "query"]
      },
      "isReference": false,
      "watch": true
    }
  ]
}
```

---

## API Changes Summary

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List all groups with stats |
| GET | `/api/sessions` | List available sessions |
| POST | `/api/register` | Register a new cluster (EP-008) |
| GET | `/api/timeline` | Get activity timeline (EP-009) |
| GET | `/api/clusters/summary` | Get lightweight summary (EP-002) |

### Modified Endpoints

| Endpoint | Changes |
|----------|---------|
| GET `/api/clusters` | Add `groups`, `validationStatus`, `studentId` to response |
| GET `/` | Add `?session=X` and `?group=X` URL param support |

---

## UI/UX Considerations

### Color Palette for Status

| Status | Color | Hex |
|--------|-------|-----|
| Healthy | Green | #28a745 |
| Warning/Degraded | Yellow | #ffc107 |
| Error/Unhealthy | Red | #dc3545 |
| Not Watching | Gray | #6c757d |
| Group Badge | Blue (default) | #007bff |

### Iconography

- Use Font Awesome consistently
- Status icons: `fa-check-circle`, `fa-exclamation-triangle`, `fa-times-circle`, `fa-pause-circle`
- Group icon: `fa-folder`, `fa-users`
- Action icons: `fa-sync`, `fa-edit`, `fa-download`

### Accessibility

- All interactive elements must have ARIA labels
- Color should not be sole indicator of status (use icons + text)
- Keyboard navigation support for all controls
- High contrast mode compatible

---

## Testing Strategy

### Unit Tests (Backend)

- Config validation for new fields (group, sessions, expectedState)
- Group extraction and aggregation
- Session resolution logic
- Error categorization
- Validation state computation

### Integration Tests

- Full data fetch with grouped clusters
- Session filtering end-to-end
- Bulk operations workflow
- CSV import validation

### Frontend Tests

- View mode switching
- Group filter behavior
- Comparison diff logic
- Timeline event rendering

### Manual Testing Checklist

- [ ] 50+ clusters render in compact view without lag
- [ ] Group filtering works with special characters
- [ ] Session switching preserves state
- [ ] Mobile layout works on iPad and Android tablet
- [ ] CSV import handles edge cases (empty rows, missing columns)
- [ ] Error suggestions display correctly for each error type

---

## Documentation Updates Required

1. **README.md**
   - Add "Training Session Features" section
   - Document `group`, `sessions`, `expectedState` configuration
   - Add examples for common training scenarios

2. **New: docs/TRAINING_GUIDE.md**
   - Step-by-step guide for setting up a training lab
   - Best practices for organizing 20-50 student clusters
   - Troubleshooting common student setup issues

3. **API Documentation**
   - Document new endpoints
   - Provide curl examples for registration

---

## Open Questions

1. Should group colors be configurable or auto-generated from hash?
2. Should annotations persist across browser sessions or just current session?
3. Should timeline persist to disk or be in-memory only?
4. Is there interest in a "student roster" import feature (mapping student names to clusters)?
5. Should we support nested groups (e.g., "Morning > Group 1 > Table A")?

---

## Appendix: Quick Reference

### Priority Legend

| Priority | Meaning | Target Release |
|----------|---------|----------------|
| P0 | Must have for training use case | Next minor version |
| P1 | Important enhancement | Following version |
| P2 | Nice to have | Future consideration |
| P3 | Future/Stretch | Backlog |

### Effort Legend

| Effort | Hours | Suitable For |
|--------|-------|--------------|
| Small | 1-3 | Quick wins, single session |
| Medium | 4-8 | Multi-session implementation |
| Large | 9+ | Major feature, phased approach |

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-XX  
**Author:** Planning Phase  
**Next Review:** After Phase 1 implementation