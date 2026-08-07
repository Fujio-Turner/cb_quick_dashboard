/**
 * Jest tests for static/js/chart_history.js
 */

const ChartHistory = require("../static/js/chart_history.js");

describe("ChartHistory", () => {
  beforeEach(() => {
    ChartHistory.clear();
  });

  test("clampWindowMinutes snaps to 1, 5, 15, 30", () => {
    expect(ChartHistory.WINDOW_OPTIONS).toEqual([1, 5, 15, 30]);
    expect(ChartHistory.clampWindowMinutes(0)).toBe(1);
    expect(ChartHistory.clampWindowMinutes(-5)).toBe(1);
    expect(ChartHistory.clampWindowMinutes(1)).toBe(1);
    expect(ChartHistory.clampWindowMinutes(5)).toBe(5);
    expect(ChartHistory.clampWindowMinutes(15)).toBe(15);
    expect(ChartHistory.clampWindowMinutes(30)).toBe(30);
    expect(ChartHistory.clampWindowMinutes(99)).toBe(30);
    // nearest-option snap for legacy localStorage values
    expect(ChartHistory.clampWindowMinutes(3)).toBe(1);
    expect(ChartHistory.clampWindowMinutes(7)).toBe(5);
    expect(ChartHistory.clampWindowMinutes(12)).toBe(15);
    expect(ChartHistory.clampWindowMinutes(20)).toBe(15);
    expect(ChartHistory.clampWindowMinutes(25)).toBe(30);
    expect(ChartHistory.clampWindowMinutes("nope")).toBe(
      ChartHistory.DEFAULT_WINDOW_MINUTES
    );
  });

  test("normalizeTimestamp converts seconds to ms", () => {
    expect(ChartHistory.normalizeTimestamp(1700000000)).toBe(1700000000000);
    expect(ChartHistory.normalizeTimestamp(1700000000000)).toBe(1700000000000);
  });

  test("ingest merges by timestamp and prunes beyond 30 minutes", () => {
    const key = ChartHistory.historyKey("c1", "cache");
    const t0 = 1_700_000_000_000;

    ChartHistory.ingestSamples(
      key,
      {
        timestamp: [t0, t0 + 1000],
        cmd_get: [1, 2],
        cmd_set: [10, 20],
      },
      t0 + 1000
    );

    let stats = ChartHistory.getBufferStats(key, t0 + 1000);
    expect(stats.points).toBe(2);

    // Later poll overlaps + adds
    ChartHistory.ingestSamples(
      key,
      {
        timestamp: [t0 + 1000, t0 + 2000],
        cmd_get: [2, 3],
        cmd_set: [20, 30],
      },
      t0 + 2000
    );
    stats = ChartHistory.getBufferStats(key, t0 + 2000);
    expect(stats.points).toBe(3);

    const win = ChartHistory.getWindowSamples(key, 30, t0 + 2000);
    // Full 30m grid — last samples should hold cmd_get=3
    expect(win.timestamp[0]).toBe(t0 + 2000 - 30 * 60 * 1000);
    expect(win.timestamp[win.timestamp.length - 1]).toBe(t0 + 2000);
    expect(win.cmd_get[win.cmd_get.length - 1]).toBe(3);
    // Before first ingested point, values are null
    expect(win.cmd_get[0]).toBeNull();

    // 31 minutes later — old points pruned
    const later = t0 + 31 * 60 * 1000;
    ChartHistory.ingestSamples(
      key,
      {
        timestamp: [later],
        cmd_get: [99],
      },
      later
    );
    stats = ChartHistory.getBufferStats(key, later);
    expect(stats.points).toBe(1);
    const winLater = ChartHistory.getWindowSamples(key, 30, later);
    expect(winLater.cmd_get[winLater.cmd_get.length - 1]).toBe(99);
  });

  test("getWindowSamples spans full selected window on a grid", () => {
    const key = ChartHistory.historyKey("c1", "b");
    const now = 2_000_000_000_000;
    // only a few points in the last ~10s
    ChartHistory.ingestSamples(
      key,
      {
        timestamp: [now - 10000, now - 5000, now],
        metric: [1, 2, 3],
      },
      now
    );

    const one = ChartHistory.getWindowSamples(key, 1, now);
    const thirty = ChartHistory.getWindowSamples(key, 30, now);

    expect(one.timestamp[0]).toBe(now - 1 * 60 * 1000);
    expect(one.timestamp[one.timestamp.length - 1]).toBe(now);
    expect(thirty.timestamp[0]).toBe(now - 30 * 60 * 1000);
    expect(thirty.timestamp[thirty.timestamp.length - 1]).toBe(now);

    // Wider window must start earlier (different x-axis range)
    expect(thirty.timestamp[0]).toBeLessThan(one.timestamp[0]);
    // More grid points on longer windows (or equal if capped)
    expect(thirty.timestamp.length).toBeGreaterThanOrEqual(one.timestamp.length);

    // Values null before first sample, then held
    const firstDataIdx = one.timestamp.findIndex((t) => t >= now - 10000);
    expect(one.metric[0]).toBeNull();
    expect(one.metric[firstDataIdx]).toBe(1);
    expect(one.metric[one.metric.length - 1]).toBe(3);
  });

  test("getWindowSamples denser grid still respects 5-minute slice of history", () => {
    const key = ChartHistory.historyKey("c1", "dense");
    const now = 2_000_000_000_000;
    const timestamps = [];
    const values = [];
    for (let m = 0; m <= 20; m++) {
      timestamps.push(now - (20 - m) * 60 * 1000);
      values.push(m);
    }
    ChartHistory.ingestSamples(
      key,
      { timestamp: timestamps, metric: values },
      now
    );

    const five = ChartHistory.getWindowSamples(key, 5, now);
    expect(five.timestamp[0]).toBe(now - 5 * 60 * 1000);
    expect(five.metric[five.metric.length - 1]).toBe(20);
    // earliest grid cells before first in-window source stay null or hold
    expect(five._windowMinutes).toBe(5);
  });

  test("windowOptionsHtml is 1, 5, 15, 30 with selected", () => {
    const html = ChartHistory.windowOptionsHtml(15);
    expect(html).toContain('value="1"');
    expect(html).toContain('value="5"');
    expect(html).toContain('value="15" selected');
    expect(html).toContain('value="30"');
    expect(html).not.toContain('value="10"');
    expect((html.match(/<option/g) || []).length).toBe(4);
    // legacy 10 snaps selected to 5
    const htmlSnap = ChartHistory.windowOptionsHtml(10);
    expect(htmlSnap).toContain('value="5" selected');
  });

  test("formatTimeLabels produces HH:MM:SS style strings", () => {
    const labels = ChartHistory.formatTimeLabels([Date.parse("2026-08-07T11:12:29Z")]);
    expect(labels[0]).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});
