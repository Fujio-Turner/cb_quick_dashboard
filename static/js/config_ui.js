/**
 * Dashboard settings UI — gear icon modal for config.json editing.
 * Depends on jQuery. Talks to /api/config and /api/config/test.
 */
(function (global) {
  "use strict";

  var PASSWORD_PLACEHOLDER = "********";
  var draft = null;
  var onSaved = null;

  function el(html) {
    return $(html);
  }

  function openModal() {
    $("#config-modal").addClass("is-open").attr("aria-hidden", "false");
    $("body").addClass("config-modal-open");
  }

  function closeModal() {
    $("#config-modal").removeClass("is-open").attr("aria-hidden", "true");
    $("body").removeClass("config-modal-open");
  }

  function setStatus(msg, kind) {
    var $s = $("#config-status");
    $s.removeClass("text-success text-danger text-muted").addClass(
      kind === "ok" ? "text-success" : kind === "err" ? "text-danger" : "text-muted"
    );
    $s.text(msg || "");
  }

  function emptyCluster() {
    return {
      host: "http://127.0.0.1:8091",
      user: "Administrator",
      pass: "",
      customName: "",
      watch: true,
      has_password: false,
    };
  }

  function renderClusterRows() {
    var $tbody = $("#config-clusters-body");
    $tbody.empty();
    if (!draft || !draft.clusters) draft.clusters = [];

    if (!draft.clusters.length) {
      $tbody.append(
        '<tr><td colspan="6" class="text-muted text-center py-3">No clusters — click Add cluster</td></tr>'
      );
      return;
    }

    draft.clusters.forEach(function (c, idx) {
      var passVal = c.has_password && (!c.pass || c.pass === PASSWORD_PLACEHOLDER)
        ? PASSWORD_PLACEHOLDER
        : c.pass || "";
      var $tr = el(
        '<tr data-idx="' +
          idx +
          '">' +
          '<td><input type="text" class="form-control form-control-sm cfg-host" value="" placeholder="http://host:8091"></td>' +
          '<td><input type="text" class="form-control form-control-sm cfg-name" value="" placeholder="Friendly name"></td>' +
          '<td><input type="text" class="form-control form-control-sm cfg-user" value="" placeholder="user"></td>' +
          '<td><input type="password" class="form-control form-control-sm cfg-pass" value="" placeholder="password" autocomplete="new-password"></td>' +
          '<td class="text-center"><input type="checkbox" class="cfg-watch" title="Watch / monitor"></td>' +
          '<td class="text-nowrap">' +
          '<button type="button" class="btn btn-sm btn-outline-secondary cfg-test" title="Test connection">Test</button> ' +
          '<button type="button" class="btn btn-sm btn-outline-danger cfg-remove" title="Remove">&times;</button>' +
          '<div class="small cfg-test-result mt-1"></div>' +
          "</td>" +
          "</tr>"
      );
      $tr.find(".cfg-host").val(c.host || "");
      $tr.find(".cfg-name").val(c.customName || "");
      $tr.find(".cfg-user").val(c.user || "");
      $tr.find(".cfg-pass").val(passVal);
      $tr.find(".cfg-watch").prop("checked", c.watch !== false);
      $tbody.append($tr);
    });
  }

  function readDraftFromForm() {
    if (!draft) draft = { server: {}, logging: {}, clusters: [] };
    draft.server = draft.server || {};
    draft.logging = draft.logging || {};

    draft.server.host = $("#cfg-server-host").val().trim() || "127.0.0.1";
    draft.server.port = parseInt($("#cfg-server-port").val(), 10) || 5050;
    draft.server.debug = $("#cfg-server-debug").is(":checked");
    draft.server.poll_interval_seconds =
      parseInt($("#cfg-poll-interval").val(), 10) || 10;

    draft.logging.level = $("#cfg-log-level").val() || "info";
    draft.logging.file = $("#cfg-log-file").val().trim() || "logs/app.log";
    draft.logging.enabled = $("#cfg-log-enabled").is(":checked");

    var clusters = [];
    $("#config-clusters-body tr[data-idx]").each(function () {
      var $tr = $(this);
      var prev = draft.clusters[parseInt($tr.attr("data-idx"), 10)] || {};
      var pass = $tr.find(".cfg-pass").val();
      clusters.push({
        host: $tr.find(".cfg-host").val().trim(),
        customName: $tr.find(".cfg-name").val().trim(),
        user: $tr.find(".cfg-user").val().trim(),
        pass: pass,
        watch: $tr.find(".cfg-watch").is(":checked"),
        has_password: !!(prev.has_password || (pass && pass !== PASSWORD_PLACEHOLDER)),
      });
    });
    draft.clusters = clusters;
    return draft;
  }

  function fillSettingsForm(cfg) {
    draft = cfg;
    var server = cfg.server || {};
    var logging = cfg.logging || {};
    $("#cfg-server-host").val(server.host || "127.0.0.1");
    $("#cfg-server-port").val(server.port != null ? server.port : 5050);
    $("#cfg-server-debug").prop("checked", !!server.debug);
    $("#cfg-poll-interval").val(
      server.poll_interval_seconds != null ? server.poll_interval_seconds : 10
    );
    $("#cfg-log-level").val(logging.level || "info");
    $("#cfg-log-file").val(logging.file || "logs/app.log");
    $("#cfg-log-enabled").prop(
      "checked",
      logging.enabled !== undefined ? !!logging.enabled : true
    );
    $("#cfg-config-path").text(cfg._path || "config.json");
    renderClusterRows();
  }

  function loadConfig() {
    setStatus("Loading…", "muted");
    return $.ajax({ url: "/api/config", method: "GET", dataType: "json" })
      .done(function (cfg) {
        fillSettingsForm(cfg);
        setStatus("", "muted");
      })
      .fail(function (xhr) {
        var err =
          (xhr.responseJSON && xhr.responseJSON.error) ||
          xhr.statusText ||
          "Failed to load config";
        setStatus(err, "err");
      });
  }

  function saveConfig() {
    readDraftFromForm();
    setStatus("Saving…", "muted");
    $("#cfg-save-btn").prop("disabled", true);
    return $.ajax({
      url: "/api/config",
      method: "PUT",
      contentType: "application/json",
      data: JSON.stringify(draft),
      dataType: "json",
    })
      .done(function (res) {
        setStatus("Saved. Poll interval: " + res.poll_interval_seconds + "s", "ok");
        if (res.config) fillSettingsForm(res.config);
        if (typeof onSaved === "function") {
          onSaved({
            poll_interval_seconds: res.poll_interval_seconds,
            cluster_count: res.cluster_count,
          });
        }
      })
      .fail(function (xhr) {
        var err =
          (xhr.responseJSON && xhr.responseJSON.error) ||
          xhr.statusText ||
          "Save failed";
        setStatus(err, "err");
      })
      .always(function () {
        $("#cfg-save-btn").prop("disabled", false);
      });
  }

  function testRow($tr) {
    var host = $tr.find(".cfg-host").val().trim();
    var user = $tr.find(".cfg-user").val().trim();
    var pass = $tr.find(".cfg-pass").val();
    var $out = $tr.find(".cfg-test-result");
    $out.removeClass("text-success text-danger").addClass("text-muted").text("Testing…");
    $tr.find(".cfg-test").prop("disabled", true);
    $.ajax({
      url: "/api/config/test",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ host: host, user: user, pass: pass }),
      dataType: "json",
    })
      .done(function (res) {
        if (res.ok) {
          $out
            .removeClass("text-muted text-danger")
            .addClass("text-success")
            .text(res.message || res.clusterName || "OK");
        } else {
          $out
            .removeClass("text-muted text-success")
            .addClass("text-danger")
            .text(res.error || "Failed");
        }
      })
      .fail(function (xhr) {
        var err =
          (xhr.responseJSON && xhr.responseJSON.error) ||
          xhr.statusText ||
          "Request failed";
        $out
          .removeClass("text-muted text-success")
          .addClass("text-danger")
          .text(err);
      })
      .always(function () {
        $tr.find(".cfg-test").prop("disabled", false);
      });
  }

  function bindEvents() {
    $(document).on("click", "#config-gear-btn", function (e) {
      e.preventDefault();
      openModal();
      loadConfig();
    });
    $(document).on("click", "#config-modal-backdrop, #cfg-cancel-btn, #cfg-close-x", function () {
      closeModal();
    });
    $(document).on("keydown", function (e) {
      if (e.key === "Escape" && $("#config-modal").hasClass("is-open")) {
        closeModal();
      }
    });
    $(document).on("click", "#config-modal-panel", function (e) {
      e.stopPropagation();
    });
    $(document).on("click", "#cfg-add-cluster", function () {
      readDraftFromForm();
      draft.clusters.push(emptyCluster());
      renderClusterRows();
    });
    $(document).on("click", ".cfg-remove", function () {
      var idx = parseInt($(this).closest("tr").attr("data-idx"), 10);
      readDraftFromForm();
      draft.clusters.splice(idx, 1);
      renderClusterRows();
    });
    $(document).on("click", ".cfg-test", function () {
      testRow($(this).closest("tr"));
    });
    $(document).on("click", "#cfg-save-btn", function () {
      saveConfig();
    });
    $(document).on("click", "#cfg-reload-btn", function () {
      loadConfig();
    });
    // Clear placeholder on focus so user can type a new password
    $(document).on("focus", ".cfg-pass", function () {
      if ($(this).val() === PASSWORD_PLACEHOLDER) {
        $(this).val("");
      }
    });
  }

  function init(opts) {
    opts = opts || {};
    onSaved = opts.onSaved || null;
    bindEvents();
  }

  global.DashboardConfigUI = {
    init: init,
    open: function () {
      openModal();
      loadConfig();
    },
    close: closeModal,
  };
})(typeof window !== "undefined" ? window : globalThis);
