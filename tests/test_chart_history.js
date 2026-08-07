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
    expect(win.timestamp).toEqual([t0, t0 + 1000, t0 + 2000]);
    expect(win.cmd_get).toEqual([1, 2, 3]);

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
    expect(ChartHistory.getWindowSamples(key, 30, later).cmd_get).toEqual([99]);
  });

  test("getWindowSamples respects selected minutes", () => {
    const key = ChartHistory.historyKey("c1", "b");
    const now = 2_000_000_000_000;
    const timestamps = [];
    const values = [];
    // one point per minute for 20 minutes
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
    // points from now-5m through now inclusive ≈ 6
    expect(five.timestamp.length).toBe(6);
    expect(five.metric[0]).toBe(15);
    expect(five.metric[five.metric.length - 1]).toBe(20);

    const one = ChartHistory.getWindowSamples(key, 1, now);
    expect(one.timestamp.length).toBe(2);
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
