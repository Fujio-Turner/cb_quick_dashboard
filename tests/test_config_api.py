"""Tests for config API: mask/merge passwords, meta, save."""

import json
import os

import pytest

from app import (
    PASSWORD_PLACEHOLDER,
    app,
    get_poll_interval_seconds,
    mask_config_for_api,
    merge_config_passwords,
    validate_config,
)


@pytest.fixture
def client(tmp_path, monkeypatch):
    cfg_path = tmp_path / "config.json"
    cfg = {
        "server": {
            "host": "127.0.0.1",
            "port": 5050,
            "debug": False,
            "poll_interval_seconds": 15,
        },
        "logging": {"level": "info", "file": "logs/app.log", "enabled": True},
        "clusters": [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "s3cret",
                "customName": "Local",
                "watch": True,
            }
        ],
    }
    cfg_path.write_text(json.dumps(cfg), encoding="utf-8")
    monkeypatch.setenv("CB_DASHBOARD_CONFIG", str(cfg_path))
    monkeypatch.chdir(tmp_path)
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c, cfg_path


def test_mask_config_for_api():
    raw = {
        "clusters": [
            {"host": "http://h", "user": "u", "pass": "secret"},
            {"host": "http://h2", "user": "u", "pass": ""},
        ]
    }
    masked = mask_config_for_api(raw)
    assert masked["clusters"][0]["pass"] == PASSWORD_PLACEHOLDER
    assert masked["clusters"][0]["has_password"] is True
    assert masked["clusters"][1]["has_password"] is False
    # original unchanged
    assert raw["clusters"][0]["pass"] == "secret"


def test_merge_keeps_password_on_placeholder():
    existing = {
        "clusters": [
            {"host": "http://h", "user": "u", "pass": "real-secret", "watch": True}
        ]
    }
    incoming = {
        "server": {"host": "127.0.0.1", "port": 5050, "debug": False},
        "logging": {"level": "info", "file": "logs/app.log", "enabled": True},
        "clusters": [
            {
                "host": "http://h",
                "user": "u",
                "pass": PASSWORD_PLACEHOLDER,
                "watch": False,
            }
        ],
    }
    merged = merge_config_passwords(incoming, existing)
    assert merged["clusters"][0]["pass"] == "real-secret"
    assert merged["clusters"][0]["watch"] is False


def test_merge_updates_password_when_changed():
    existing = {
        "clusters": [{"host": "http://h", "user": "u", "pass": "old"}]
    }
    incoming = {
        "clusters": [{"host": "http://h", "user": "u", "pass": "new-pass"}]
    }
    merged = merge_config_passwords(incoming, existing)
    assert merged["clusters"][0]["pass"] == "new-pass"


def test_poll_interval_validation():
    base = {
        "logging": {"level": "info", "file": "logs/app.log", "enabled": True},
        "clusters": [
            {"host": "http://localhost:8091", "user": "a", "pass": "b"}
        ],
        "server": {"poll_interval_seconds": 3},
    }
    errs = validate_config(base)
    assert any("poll_interval" in e for e in errs)
    base["server"]["poll_interval_seconds"] = 10
    assert validate_config(base) == []


def test_get_poll_interval_seconds():
    assert (
        get_poll_interval_seconds(
            {"server": {"poll_interval_seconds": 20}}
        )
        == 20
    )
    assert get_poll_interval_seconds({"server": {}}) == 10
    assert get_poll_interval_seconds(None) == 10


def test_api_meta(client):
    c, _path = client
    rv = c.get("/api/meta")
    assert rv.status_code == 200
    data = rv.get_json()
    assert data["poll_interval_seconds"] == 15
    assert data["version"]
    assert "config_path" in data


def test_api_get_config_masks_password(client):
    c, _path = client
    rv = c.get("/api/config")
    assert rv.status_code == 200
    data = rv.get_json()
    assert data["clusters"][0]["pass"] == PASSWORD_PLACEHOLDER
    assert data["clusters"][0]["has_password"] is True


def test_api_put_config_preserves_password(client):
    c, cfg_path = client
    rv = c.get("/api/config")
    cfg = rv.get_json()
    cfg["server"]["poll_interval_seconds"] = 30
    cfg["clusters"][0]["customName"] = "Renamed"
    # leave password as placeholder
    rv2 = c.put(
        "/api/config",
        data=json.dumps(cfg),
        content_type="application/json",
    )
    assert rv2.status_code == 200, rv2.get_data(as_text=True)
    body = rv2.get_json()
    assert body["ok"] is True
    assert body["poll_interval_seconds"] == 30

    on_disk = json.loads(cfg_path.read_text(encoding="utf-8"))
    assert on_disk["clusters"][0]["pass"] == "s3cret"
    assert on_disk["clusters"][0]["customName"] == "Renamed"
    assert on_disk["server"]["poll_interval_seconds"] == 30


def test_api_put_rejects_bad_poll(client):
    c, _path = client
    rv = c.get("/api/config")
    cfg = rv.get_json()
    cfg["server"]["poll_interval_seconds"] = 1
    rv2 = c.put(
        "/api/config",
        data=json.dumps(cfg),
        content_type="application/json",
    )
    assert rv2.status_code == 400
