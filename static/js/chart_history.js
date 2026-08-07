/**
 * Client-side chart history buffer for Couchbase bucket stats samples.
 *
 * Couchbase /stats default zoom returns ~60s at 1s resolution. This module
 * merges successive polls (by timestamp) and retains up to 30 minutes so the
 * UI can render selectable windows from 1–30 minutes.
 *
 * Works in browser (window.ChartHistory) and Node/Jest (module.exports).
 */
(function (global) {
  "use strict";

  var MAX_RETENTION_MINUTES = 30;
  var MAX_RETENTION_MS = MAX_RETENTION_MINUTES * 60 * 1000;
  var DEFAULT_WINDOW_MINUTES = 5;
  var STORAGE_KEY = "cb_dashboard_chart_window_minutes";

  /** @type {Map<string, Map<number, Object>>} */
  var buffers = new Map();

  function clampWindowMinutes(minutes) {
    var n = parseInt(minutes, 10);
    if (isNaN(n)) {
      n = DEFAULT_WINDOW_MINUTES;
    }
    if (n < 1) n = 1;
    if (n > MAX_RETENTION_MINUTES) n = MAX_RETENTION_MINUTES;
    return n;
  }

  function normalizeTimestamp(ts) {
    var n = Number(ts);
    if (!isFinite(n)) return null;
    // Seconds → ms (CB usually sends ms; guard anyway)
    if (n > 0 && n < 1e12) {
      n = n * 1000;
    }
    return Math.floor(n);
  }

  function historyKey(clusterId, bucketName) {
    return String(clusterId || "unknown") + "::" + String(bucketName || "unknown");
  }

  function getBuffer(key) {
    if (!buffers.has(key)) {
      buffers.set(key, new Map());
    }
    return buffers.get(key);
  }

  function pruneBuffer(buf, nowMs) {
    var cutoff = nowMs - MAX_RETENTION_MS;
    buf.forEach(function (_point, ts) {
      if (ts < cutoff) {
        buf.delete(ts);
      }
    });
  }

  /**
   * Merge one Couchbase `op.samples` object into the buffer for key.
   * @param {string} key
   * @param {Object} samples - { timestamp: number[], metricName: number[], ... }
   * @param {number} [nowMs]
   */
  function ingestSamples(key, samples, nowMs) {
    if (!samples || !Array.isArray(samples.timestamp) || samples.timestamp.length === 0) {
      return { added: 0, size: getBuffer(key).size };
    }
    var now = nowMs != null ? nowMs : Date.now();
    var buf = getBuffer(key);
    var timestamps = samples.timestamp;
    var metricNames = Object.keys(samples).filter(function (k) {
      return k !== "timestamp" && Array.isArray(samples[k]);
    });
    var added = 0;
    for (var i = 0; i < timestamps.length; i++) {
      var ts = normalizeTimestamp(timestamps[i]);
      if (ts == null) continue;
      var point = buf.has(ts) ? buf.get(ts) : {};
      var isNew = !buf.has(ts);
      for (var m = 0; m < metricNames.length; m++) {
        var name = metricNames[m];
        if (i < samples[name].length) {
          point[name] = samples[name][i];
        }
      }
      buf.set(ts, point);
      if (isNew) added++;
    }
    pruneBuffer(buf, now);
    return { added: added, size: buf.size };
  }

  /**
   * Build a samples-shaped object for the last `windowMinutes` minutes.
   * @returns {{ timestamp: number[], [metric: string]: Array }}
   */
  function getWindowSamples(key, windowMinutes, nowMs) {
    var now = nowMs != null ? nowMs : Date.now();
    var mins = clampWindowMinutes(windowMinutes);
    var buf = getBuffer(key);
    pruneBuffer(buf, now);
    var cutoff = now - mins * 60 * 1000;
    var timestamps = [];
    buf.forEach(function (_point, ts) {
      if (ts >= cutoff) timestamps.push(ts);
    });
    timestamps.sort(function (a, b) {
      return a - b;
    });

    var samples = { timestamp: timestamps };
    if (timestamps.length === 0) {
      return samples;
    }

    var metricSet = {};
    for (var i = 0; i < timestamps.length; i++) {
      var p = buf.get(timestamps[i]);
      if (!p) continue;
      Object.keys(p).forEach(function (k) {
        metricSet[k] = true;
      });
    }

    Object.keys(metricSet).forEach(function (name) {
      samples[name] = timestamps.map(function (ts) {
        var pt = buf.get(ts);
        if (!pt || pt[name] === undefined || pt[name] === null) {
          return null;
        }
        return pt[name];
      });
    });

    return samples;
  }

  function getBufferStats(key, nowMs) {
    var now = nowMs != null ? nowMs : Date.now();
    var buf = getBuffer(key);
    pruneBuffer(buf, now);
    if (buf.size === 0) {
      return {
        points: 0,
        oldest: null,
        newest: null,
        spanMinutes: 0,
        maxRetentionMinutes: MAX_RETENTION_MINUTES,
      };
    }
    var timestamps = Array.from(buf.keys()).sort(function (a, b) {
      return a - b;
    });
    var oldest = timestamps[0];
    var newest = timestamps[timestamps.length - 1];
    return {
      points: timestamps.length,
      oldest: oldest,
      newest: newest,
      spanMinutes: (newest - oldest) / 60000,
      maxRetentionMinutes: MAX_RETENTION_MINUTES,
    };
  }

  function clear(key) {
    if (key == null) {
      buffers.clear();
    } else {
      buffers.delete(key);
    }
  }

  function formatTimeLabels(timestamps) {
    return (timestamps || []).map(function (ts) {
      var date = new Date(ts);
      return date.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    });
  }

  function loadSavedWindowMinutes() {
    try {
      if (typeof localStorage === "undefined") return DEFAULT_WINDOW_MINUTES;
      var v = localStorage.getItem(STORAGE_KEY);
      if (v == null) return DEFAULT_WINDOW_MINUTES;
      return clampWindowMinutes(v);
    } catch (e) {
      return DEFAULT_WINDOW_MINUTES;
    }
  }

  function saveWindowMinutes(minutes) {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(STORAGE_KEY, String(clampWindowMinutes(minutes)));
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function windowOptionsHtml(selectedMinutes) {
    var sel = clampWindowMinutes(selectedMinutes);
    var parts = [];
    for (var m = 1; m <= MAX_RETENTION_MINUTES; m++) {
      parts.push(
        '<option value="' +
          m +
          '"' +
          (m === sel ? " selected" : "") +
          ">" +
          m +
          (m === 1 ? " minute" : " minutes") +
          "</option>"
      );
    }
    return parts.join("");
  }

  var api = {
    MAX_RETENTION_MINUTES: MAX_RETENTION_MINUTES,
    MAX_RETENTION_MS: MAX_RETENTION_MS,
    DEFAULT_WINDOW_MINUTES: DEFAULT_WINDOW_MINUTES,
    STORAGE_KEY: STORAGE_KEY,
    clampWindowMinutes: clampWindowMinutes,
    normalizeTimestamp: normalizeTimestamp,
    historyKey: historyKey,
    ingestSamples: ingestSamples,
    getWindowSamples: getWindowSamples,
    getBufferStats: getBufferStats,
    clear: clear,
    formatTimeLabels: formatTimeLabels,
    loadSavedWindowMinutes: loadSavedWindowMinutes,
    saveWindowMinutes: saveWindowMinutes,
    windowOptionsHtml: windowOptionsHtml,
    // test helper
    _buffers: buffers,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.ChartHistory = api;
})(typeof window !== "undefined" ? window : globalThis);
