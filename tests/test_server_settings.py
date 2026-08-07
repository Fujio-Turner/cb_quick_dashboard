"""Tests for dashboard listen host/port resolution (Phase A1)."""

import pytest

from app import (
    DEFAULT_SERVER_HOST,
    DEFAULT_SERVER_PORT,
    resolve_server_settings,
    validate_config,
    validate_listen_host,
    validate_listen_port,
)


class TestValidateListen:
    def test_valid_hosts(self):
        assert validate_listen_host("127.0.0.1")
        assert validate_listen_host("localhost")
        assert validate_listen_host("0.0.0.0")
        assert validate_listen_host("::1")

    def test_invalid_hosts(self):
        assert not validate_listen_host("")
        assert not validate_listen_host("  ")
        assert not validate_listen_host("127.0.0.1 bad")
        assert not validate_listen_host(None)
        assert not validate_listen_host(5050)

    def test_valid_ports(self):
        assert validate_listen_port(1)
        assert validate_listen_port(5050)
        assert validate_listen_port("65535")
        assert validate_listen_port(80)

    def test_invalid_ports(self):
        assert not validate_listen_port(0)
        assert not validate_listen_port(65536)
        assert not validate_listen_port(-1)
        assert not validate_listen_port("abc")
        assert not validate_listen_port(None)


class TestResolveServerSettings:
    def test_defaults(self):
        s = resolve_server_settings({}, argv=[], env={})
        assert s["host"] == DEFAULT_SERVER_HOST
        assert s["port"] == DEFAULT_SERVER_PORT
        assert s["debug"] is False
        assert s["url"] == f"http://{DEFAULT_SERVER_HOST}:{DEFAULT_SERVER_PORT}"
        assert s["sources"]["host"] == "default"
        assert s["sources"]["port"] == "default"

    def test_config_values(self):
        cfg = {"server": {"host": "0.0.0.0", "port": 5080, "debug": True}}
        s = resolve_server_settings(cfg, argv=[], env={})
        assert s["host"] == "0.0.0.0"
        assert s["port"] == 5080
        assert s["debug"] is True
        assert s["sources"]["host"] == "config"
        assert s["sources"]["port"] == "config"
        assert s["sources"]["debug"] == "config"

    def test_env_overrides_config(self):
        cfg = {"server": {"host": "0.0.0.0", "port": 5080}}
        env = {"CB_DASHBOARD_HOST": "127.0.0.1", "CB_DASHBOARD_PORT": "5090"}
        s = resolve_server_settings(cfg, argv=[], env=env)
        assert s["host"] == "127.0.0.1"
        assert s["port"] == 5090
        assert s["sources"]["host"] == "env"
        assert s["sources"]["port"] == "env"

    def test_cli_overrides_env_and_config(self):
        cfg = {"server": {"host": "0.0.0.0", "port": 5080}}
        env = {"CB_DASHBOARD_HOST": "127.0.0.1", "CB_DASHBOARD_PORT": "5090"}
        s = resolve_server_settings(
            cfg, argv=["--host", "localhost", "--port", "5060"], env=env
        )
        assert s["host"] == "localhost"
        assert s["port"] == 5060
        assert s["sources"]["host"] == "cli"
        assert s["sources"]["port"] == "cli"

    def test_cli_debug_flags(self):
        s = resolve_server_settings({}, argv=["--debug"], env={})
        assert s["debug"] is True
        assert s["sources"]["debug"] == "cli"

        s = resolve_server_settings(
            {"server": {"debug": True}}, argv=["--no-debug"], env={}
        )
        assert s["debug"] is False
        assert s["sources"]["debug"] == "cli"

    def test_invalid_port_raises(self):
        with pytest.raises(ValueError, match="Invalid listen port"):
            resolve_server_settings(
                {"server": {"port": 99999}}, argv=[], env={}
            )

    def test_invalid_cli_port_argparse(self):
        with pytest.raises(SystemExit):
            resolve_server_settings({}, argv=["--port", "nope"], env={})

    def test_empty_host_raises(self):
        with pytest.raises(ValueError, match="Invalid listen host"):
            resolve_server_settings({"server": {"host": "  "}}, argv=[], env={})


class TestValidateConfigServerSection:
    def _base(self):
        return {
            "logging": {"level": "info", "file": "logs/app.log", "enabled": True},
            "clusters": [
                {
                    "host": "http://localhost:8091",
                    "user": "u",
                    "pass": "p",
                }
            ],
        }

    def test_valid_server_section(self):
        cfg = self._base()
        cfg["server"] = {"host": "127.0.0.1", "port": 5050, "debug": False}
        assert validate_config(cfg) == []

    def test_invalid_server_port(self):
        cfg = self._base()
        cfg["server"] = {"port": 0}
        errors = validate_config(cfg)
        assert any("server.port" in e for e in errors)

    def test_invalid_server_host(self):
        cfg = self._base()
        cfg["server"] = {"host": ""}
        errors = validate_config(cfg)
        assert any("server.host" in e for e in errors)
