import aiohttp
import asyncio
import json
import ssl
import os
from flask import Flask, render_template, jsonify
import logging
from logging.handlers import RotatingFileHandler

# Version information
# 🤖 AI ASSISTANT HINT: Please increment this version number on every significant update/save
# Use semantic versioning: MAJOR.MINOR.PATCH (e.g., 1.0.0 -> 1.0.1 for fixes, 1.1.0 for features)
__version__ = "1.2.0"

app = Flask(__name__)

# Global configuration
config = None
logger = None

# Dashboard listen defaults (port 5000 is commonly taken by other local services)
DEFAULT_SERVER_HOST = "127.0.0.1"
DEFAULT_SERVER_PORT = 5050
DEFAULT_SERVER_DEBUG = False


# Utility functions
def validate_host_url(host):
    """Validate that host URL has proper format."""
    if not host:
        return False
    return host.startswith("http://") or host.startswith("https://")


def validate_listen_host(host):
    """Validate dashboard bind host (hostname or IP, non-empty string)."""
    if not isinstance(host, str):
        return False
    host = host.strip()
    if not host:
        return False
    # Reject characters that break bind strings; allow IPv4/IPv6/hostnames
    if any(c.isspace() for c in host):
        return False
    return True


def validate_listen_port(port):
    """Validate TCP port number."""
    try:
        port_int = int(port)
    except (TypeError, ValueError):
        return False
    return 1 <= port_int <= 65535


def resolve_server_settings(config_data=None, argv=None, env=None):
    """Resolve dashboard listen host/port/debug.

    Precedence for host and port:
      1. CLI flags (--host / --port)
      2. Environment (CB_DASHBOARD_HOST / CB_DASHBOARD_PORT)
      3. config.json server.host / server.port
      4. Built-in defaults (127.0.0.1:5050)

    Debug: config server.debug, else default False. Forced False when frozen.
    """
    import argparse
    import sys as _sys

    if config_data is None:
        config_data = {}
    if argv is None:
        argv = _sys.argv[1:]
    if env is None:
        env = os.environ

    server_config = config_data.get("server") or {}

    host = DEFAULT_SERVER_HOST
    port = DEFAULT_SERVER_PORT
    debug = DEFAULT_SERVER_DEBUG
    sources = {"host": "default", "port": "default", "debug": "default"}

    # 3) config file
    if "host" in server_config and server_config["host"] is not None:
        host = str(server_config["host"]).strip()
        sources["host"] = "config"
    if "port" in server_config and server_config["port"] is not None:
        try:
            port = int(server_config["port"])
            sources["port"] = "config"
        except (TypeError, ValueError):
            pass
    if "debug" in server_config:
        debug = bool(server_config["debug"])
        sources["debug"] = "config"

    # 2) environment
    env_host = env.get("CB_DASHBOARD_HOST")
    if env_host:
        host = env_host.strip()
        sources["host"] = "env"
    env_port = env.get("CB_DASHBOARD_PORT")
    if env_port:
        try:
            port = int(env_port)
            sources["port"] = "env"
        except ValueError:
            pass

    # 1) CLI
    parser = argparse.ArgumentParser(
        prog="cb_dashboard",
        description=f"Couchbase Quick Dashboard v{__version__}",
        add_help=True,
    )
    parser.add_argument(
        "--host",
        dest="host",
        default=None,
        help=f"Bind address (default: {DEFAULT_SERVER_HOST})",
    )
    parser.add_argument(
        "--port",
        dest="port",
        type=int,
        default=None,
        help=f"Listen port (default: {DEFAULT_SERVER_PORT})",
    )
    parser.add_argument(
        "--debug",
        dest="debug_flag",
        action="store_true",
        default=False,
        help="Enable Flask debug mode",
    )
    parser.add_argument(
        "--no-debug",
        dest="no_debug_flag",
        action="store_true",
        default=False,
        help="Disable Flask debug mode",
    )
    args, _unknown = parser.parse_known_args(list(argv))

    if args.host is not None:
        host = args.host.strip()
        sources["host"] = "cli"
    if args.port is not None:
        port = int(args.port)
        sources["port"] = "cli"
    if args.debug_flag:
        debug = True
        sources["debug"] = "cli"
    elif args.no_debug_flag:
        debug = False
        sources["debug"] = "cli"

    # PyInstaller executables never use debug reloader
    if getattr(_sys, "frozen", False):
        debug = False
        sources["debug"] = "frozen"

    if not validate_listen_host(host):
        raise ValueError(f"Invalid listen host: {host!r}")
    if not validate_listen_port(port):
        raise ValueError(f"Invalid listen port: {port!r} (need 1-65535)")

    return {
        "host": host,
        "port": int(port),
        "debug": bool(debug),
        "url": f"http://{host}:{int(port)}",
        "sources": sources,
    }


def extract_host_from_url(url):
    """Extract hostname from URL."""
    if not url:
        return None
    try:
        from urllib.parse import urlparse

        parsed = urlparse(url)
        return parsed.hostname
    except Exception:
        return None


def normalize_host_for_comparison(host):
    """Normalize host URL for comparison by extracting just the hostname."""
    if not host:
        return None
    try:
        from urllib.parse import urlparse

        parsed = urlparse(host)
        return parsed.hostname
    except Exception:
        return host


def find_cluster_by_host(clusters, target_host):
    """Find cluster configuration that matches the target host."""
    target_hostname = normalize_host_for_comparison(f"http://{target_host}")

    for cluster in clusters:
        cluster_hostname = normalize_host_for_comparison(cluster.get("host"))
        if cluster_hostname == target_hostname:
            return cluster
    return None


def setup_logging(config_data):
    """Setup logging based on configuration."""
    global logger

    # Create logs directory if it doesn't exist
    log_dir = os.path.dirname(
        config_data.get("logging", {}).get("file", "logs/app.log")
    )
    os.makedirs(log_dir, exist_ok=True)

    # Configure logging
    log_level = config_data.get("logging", {}).get("level", "info").upper()
    log_file = config_data.get("logging", {}).get("file", "logs/app.log")
    log_enabled = config_data.get("logging", {}).get("enabled", True)

    # Map string levels to logging constants
    level_map = {
        "TRACE": logging.DEBUG,  # Use DEBUG for TRACE since Python logging doesn't have TRACE
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "ERROR": logging.ERROR,
    }

    numeric_level = level_map.get(log_level, logging.INFO)

    # Create logger and assign to global variable
    logger = logging.getLogger(__name__)
    logger.setLevel(numeric_level)

    # Clear existing handlers
    logger.handlers.clear()

    # Create formatter
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    if log_enabled:
        # File handler with rotation
        file_handler = RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=5
        )
        file_handler.setLevel(numeric_level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    logger.info(f"Couchbase Dashboard v{__version__} starting up")
    logger.info(
        f"Logging configured: level={log_level}, file={log_file}, enabled={log_enabled}"
    )

    return logger


async def fetch_cluster_data(session, host, user, password):
    """Fetch data from a Couchbase cluster's /pools/default endpoint."""
    url = f"{host}/pools/default"
    try:
        # Create SSL context for HTTPS requests
        ssl_context = None
        if host.startswith("https://"):
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        async with session.get(
            url, auth=aiohttp.BasicAuth(user, password), timeout=10, ssl=ssl_context
        ) as response:
            if response.status == 200:
                data = await response.json()
                return {"host": host, "data": data, "error": None}
            else:
                return {
                    "host": host,
                    "data": None,
                    "error": f"Failed with status {response.status}",
                }
    except Exception as e:
        if logger:
            logger.error(f"Error fetching data from {host}: {str(e)}")
        return {"host": host, "data": None, "error": str(e)}


async def fetch_bucket_data(session, host, bucket_name, user, password):
    """Fetch detailed data for a specific bucket."""
    url = f"{host}/pools/default/buckets/{bucket_name}"
    try:
        # Create SSL context for HTTPS requests
        ssl_context = None
        if host.startswith("https://"):
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        async with session.get(
            url, auth=aiohttp.BasicAuth(user, password), timeout=10, ssl=ssl_context
        ) as response:
            if response.status == 200:
                data = await response.json()
                return {"bucket_name": bucket_name, "data": data, "error": None}
            else:
                return {
                    "bucket_name": bucket_name,
                    "data": None,
                    "error": f"Failed with status {response.status}",
                }
    except Exception as e:
        if logger:
            logger.error(f"Error fetching bucket data from {url}: {str(e)}")
        return {"bucket_name": bucket_name, "data": None, "error": str(e)}


async def fetch_bucket_stats(session, host, bucket_name, user, password):
    """Fetch stats data for a specific bucket."""
    url = f"{host}/pools/default/buckets/{bucket_name}/stats"
    try:
        # Create SSL context for HTTPS requests
        ssl_context = None
        if host.startswith("https://"):
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        async with session.get(
            url, auth=aiohttp.BasicAuth(user, password), timeout=10, ssl=ssl_context
        ) as response:
            if response.status == 200:
                data = await response.json()
                return {"bucket_name": bucket_name, "stats": data, "error": None}
            else:
                return {
                    "bucket_name": bucket_name,
                    "stats": None,
                    "error": f"Failed with status {response.status}",
                }
    except Exception as e:
        if logger:
            logger.error(f"Error fetching bucket stats from {url}: {str(e)}")
        return {"bucket_name": bucket_name, "stats": None, "error": str(e)}


async def fetch_index_status(session, host, user, password):
    """Fetch index status data from /indexStatus endpoint."""
    url = f"{host}/indexStatus"
    try:
        # Create SSL context for HTTPS requests
        ssl_context = None
        if host.startswith("https://"):
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        async with session.get(
            url, auth=aiohttp.BasicAuth(user, password), timeout=10, ssl=ssl_context
        ) as response:
            if response.status == 200:
                data = await response.json()
                return {"host": host, "data": data, "error": None}
            else:
                return {
                    "host": host,
                    "data": None,
                    "error": f"Failed with status {response.status}",
                }
    except Exception as e:
        if logger:
            logger.error(f"Error fetching index status from {url}: {str(e)}")
        return {"host": host, "data": None, "error": str(e)}


async def fetch_xdcr_data(session, host, user, password):
    """Fetch XDCR data from remote clusters and tasks endpoints."""
    try:
        # Create SSL context for HTTPS requests
        ssl_context = None
        if host.startswith("https://"):
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE

        # Fetch remote clusters
        remote_clusters_url = f"{host}/pools/default/remoteClusters"
        tasks_url = f"{host}/pools/default/tasks"

        # Fetch both endpoints concurrently
        async with session.get(
            remote_clusters_url,
            auth=aiohttp.BasicAuth(user, password),
            timeout=10,
            ssl=ssl_context,
        ) as remote_clusters_response, session.get(
            tasks_url,
            auth=aiohttp.BasicAuth(user, password),
            timeout=10,
            ssl=ssl_context,
        ) as tasks_response:

            remote_clusters_data = []
            xdcr_tasks_data = []
            errors = []

            # Process remote clusters response
            if remote_clusters_response.status == 200:
                remote_clusters_data = await remote_clusters_response.json()
            else:
                errors.append(
                    f"Remote clusters failed with status {remote_clusters_response.status}"
                )

            # Process tasks response
            if tasks_response.status == 200:
                all_tasks = await tasks_response.json()
                # Filter for XDCR tasks only
                xdcr_tasks_data = [
                    task for task in all_tasks if task.get("type") == "xdcr"
                ]
            else:
                errors.append(f"Tasks failed with status {tasks_response.status}")

            return {
                "host": host,
                "remoteClusters": remote_clusters_data,
                "xdcrTasks": xdcr_tasks_data,
                "error": "; ".join(errors) if errors else None,
            }

    except Exception as e:
        if logger:
            logger.error(f"Error fetching XDCR data from {host}: {str(e)}")
        return {
            "host": host,
            "remoteClusters": [],
            "xdcrTasks": [],
            "error": str(e),
        }


async def get_all_clusters_data(clusters):
    """Fetch data from all clusters and their buckets asynchronously with timeout handling."""
    async with aiohttp.ClientSession() as session:
        # Fetch /pools/default for all clusters with individual timeouts
        cluster_tasks = []
        cluster_configs = []

        for cluster in clusters:
            # Check if cluster should be watched
            if cluster.get(
                "watch", True
            ):  # Default to True if watch field is not present
                task = asyncio.create_task(
                    fetch_cluster_data_with_timeout(
                        session, cluster, 15
                    )  # 15 second timeout per cluster
                )
                cluster_tasks.append(task)
                cluster_configs.append(cluster)
            else:
                # For unwatched clusters, create a placeholder result
                cluster_tasks.append(
                    asyncio.create_task(create_not_watching_result(cluster))
                )
                cluster_configs.append(cluster)

        # Wait for all tasks to complete or timeout individually
        cluster_results = await asyncio.gather(*cluster_tasks, return_exceptions=True)

        # Process results and fetch bucket details
        all_results = []
        for i, cluster_result in enumerate(cluster_results):
            cluster_config = cluster_configs[i]

            # Handle exceptions or timeouts
            if isinstance(cluster_result, Exception):
                if logger:
                    logger.error(
                        f"Error fetching data from {cluster_config['host']}: {str(cluster_result)}"
                    )
                result = {
                    "host": cluster_config["host"],
                    "customName": cluster_config.get("customName"),
                    "data": None,
                    "error": f"Timeout or error: {str(cluster_result)}",
                    "buckets": [],
                    "bucket_stats": [],
                }
            else:
                result = {
                    "host": cluster_result["host"],
                    "customName": cluster_config.get("customName"),
                    "data": cluster_result["data"],
                    "error": cluster_result["error"],
                    "buckets": [],
                    "bucket_stats": [],
                }
                # Preserve not_watching flag if present
                if cluster_result.get("not_watching"):
                    result["not_watching"] = True

                # Only fetch bucket details if cluster data was successful
                if cluster_result["data"]:
                    bucket_names = [
                        bucket["bucketName"]
                        for bucket in cluster_result["data"].get("bucketNames", [])
                    ]
                    if bucket_names:
                        try:
                            # Fetch bucket data with timeout
                            bucket_tasks = [
                                fetch_bucket_data(
                                    session,
                                    cluster_result["host"],
                                    bucket_name,
                                    cluster_config["user"],
                                    cluster_config["pass"],
                                )
                                for bucket_name in bucket_names
                            ]
                            bucket_stats_tasks = [
                                fetch_bucket_stats(
                                    session,
                                    cluster_result["host"],
                                    bucket_name,
                                    cluster_config["user"],
                                    cluster_config["pass"],
                                )
                                for bucket_name in bucket_names
                            ]

                            # Use timeout for bucket operations too
                            bucket_results = await asyncio.wait_for(
                                asyncio.gather(*bucket_tasks, return_exceptions=True),
                                timeout=10,
                            )
                            bucket_stats_results = await asyncio.wait_for(
                                asyncio.gather(
                                    *bucket_stats_tasks, return_exceptions=True
                                ),
                                timeout=10,
                            )

                            result["buckets"] = [
                                r
                                for r in bucket_results
                                if not isinstance(r, Exception)
                            ]
                            result["bucket_stats"] = [
                                r
                                for r in bucket_stats_results
                                if not isinstance(r, Exception)
                            ]

                        except asyncio.TimeoutError:
                            if logger:
                                logger.warning(
                                    f"Bucket data fetch timeout for {cluster_result['host']}"
                                )
                        except Exception as e:
                            if logger:
                                logger.error(
                                    f"Error fetching bucket data for {cluster_result['host']}: {str(e)}"
                                )

            all_results.append(result)
        return all_results


async def fetch_cluster_data_with_timeout(session, cluster_config, timeout_seconds):
    """Fetch cluster data with individual timeout handling."""
    try:
        return await asyncio.wait_for(
            fetch_cluster_data(
                session,
                cluster_config["host"],
                cluster_config["user"],
                cluster_config["pass"],
            ),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError:
        return {
            "host": cluster_config["host"],
            "data": None,
            "error": f"Request timeout after {timeout_seconds} seconds",
        }


async def create_not_watching_result(cluster_config):
    """Create a result for clusters that are not being watched."""
    return {
        "host": cluster_config["host"],
        "data": None,
        "error": None,
        "not_watching": True,
    }


def validate_config(config_data):
    """Validate configuration structure and required fields."""
    errors = []

    # Check if config has required top-level structure
    if not isinstance(config_data, dict):
        errors.append("Config must be a JSON object")
        return errors

    # Validate logging section
    if "logging" not in config_data:
        errors.append("Missing 'logging' section in config")
    else:
        logging_config = config_data["logging"]
        if not isinstance(logging_config, dict):
            errors.append("'logging' must be an object")
        else:
            # Check required logging fields
            if "level" not in logging_config:
                errors.append("Missing 'level' in logging config")
            elif logging_config["level"] not in [
                "trace",
                "debug",
                "info",
                "warning",
                "error",
            ]:
                errors.append(
                    "Invalid logging level. Must be one of: trace, debug, info, warning, error"
                )

            if "file" not in logging_config:
                errors.append("Missing 'file' in logging config")

            if "enabled" not in logging_config:
                errors.append("Missing 'enabled' in logging config")

    # Validate optional server section (host/port/debug)
    if "server" in config_data:
        server_config = config_data["server"]
        if not isinstance(server_config, dict):
            errors.append("'server' must be an object")
        else:
            if "host" in server_config and not validate_listen_host(
                server_config.get("host")
            ):
                errors.append(
                    "Invalid 'server.host': must be a non-empty host/IP without spaces"
                )
            if "port" in server_config and not validate_listen_port(
                server_config.get("port")
            ):
                errors.append("Invalid 'server.port': must be an integer 1-65535")
            if "debug" in server_config and not isinstance(
                server_config.get("debug"), bool
            ):
                errors.append("'server.debug' must be a boolean")

    # Validate clusters section
    if "clusters" not in config_data:
        errors.append("Missing 'clusters' section in config")
    else:
        clusters = config_data["clusters"]
        if not isinstance(clusters, list):
            errors.append("'clusters' must be an array")
        else:
            for i, cluster in enumerate(clusters):
                if not isinstance(cluster, dict):
                    errors.append(f"Cluster {i} must be an object")
                    continue

                # Check required cluster fields
                required_fields = ["host", "user", "pass"]
                for field in required_fields:
                    if field not in cluster:
                        errors.append(f"Missing '{field}' in cluster {i}")

                # Validate host URL
                if "host" in cluster:
                    host = cluster["host"]
                    if not validate_host_url(host):
                        errors.append(
                            f"Invalid host format in cluster {i}: must start with http:// or https://"
                        )

                # Validate optional fields
                if "watch" in cluster and not isinstance(cluster["watch"], bool):
                    errors.append(f"'watch' field in cluster {i} must be a boolean")

    return errors


def load_config():
    """Load and validate cluster configurations from config.json."""
    global config
    try:
        with open("config.json", "r") as f:
            config_data = json.load(f)

        # Validate configuration
        errors = validate_config(config_data)
        if errors:
            for error in errors:
                if logger:
                    logger.error(f"Config validation error: {error}")
                else:
                    print(f"Config validation error: {error}")
            raise ValueError(f"Configuration validation failed: {'; '.join(errors)}")

        config = config_data
        return config_data["clusters"]
    except FileNotFoundError:
        error_msg = "config.json file not found"
        if logger:
            logger.error(error_msg)
        else:
            print(error_msg)
        return []
    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON in config.json: {str(e)}"
        if logger:
            logger.error(error_msg)
        else:
            print(error_msg)
        return []
    except Exception as e:
        error_msg = f"Error loading config.json: {str(e)}"
        if logger:
            logger.error(error_msg)
        else:
            print(error_msg)
        return []


def process_cluster_data(clusters_data):
    """Process cluster and bucket data for rendering."""
    clusters = []
    for cluster in clusters_data:
        if cluster.get("not_watching", False):
            # Handle not watching case
            cluster_info = {
                "host": cluster["host"],
                "customName": cluster.get("customName"),
                "clusterName": "Not Watching",
                "clusterUUID": "N/A",
                "health": None,  # Use None to indicate not watching status
                "memory": {"total": 0, "used": 0, "quotaTotal": 0},
                "disk": {"total": 0, "used": 0, "free": 0},
                "nodes": [],
                "buckets": [],
                "bucket_stats": [],
                "systemStats": {},
                "error": None,
                "not_watching": True,
            }
        elif cluster["data"]:
            data = cluster["data"]
            bucket_details = []
            bucket_stats = []

            for bucket in cluster["buckets"]:
                if bucket["data"]:
                    bucket_details.append(
                        {
                            "name": bucket["bucket_name"],
                            "uuid": bucket["data"].get("uuid", "Unknown"),
                            "bucketType": bucket["data"].get("bucketType", "Unknown"),
                            "storageBackend": bucket["data"].get(
                                "storageBackend", "Unknown"
                            ),
                            "replicaNumber": bucket["data"].get("replicaNumber", 0),
                            "basicStats": bucket["data"].get("basicStats", {}),
                            "quota": bucket["data"].get("quota", {}),
                            "evictionPolicy": bucket["data"].get(
                                "evictionPolicy", "Unknown"
                            ),
                            "durabilityMinLevel": bucket["data"].get(
                                "durabilityMinLevel", "Unknown"
                            ),
                            "quotaPercentUsed": bucket["data"]
                            .get("basicStats", {})
                            .get("quotaPercentUsed", 0),
                            "opsPerSec": bucket["data"]
                            .get("basicStats", {})
                            .get("opsPerSec", 0),
                            "diskFetches": bucket["data"]
                            .get("basicStats", {})
                            .get("diskFetches", 0),
                            "error": None,
                        }
                    )
                else:
                    bucket_details.append(
                        {
                            "name": bucket["bucket_name"],
                            "uuid": "Unknown",
                            "bucketType": "Unknown",
                            "storageBackend": "Unknown",
                            "replicaNumber": 0,
                            "basicStats": {},
                            "quota": {},
                            "evictionPolicy": "Unknown",
                            "durabilityMinLevel": "Unknown",
                            "quotaPercentUsed": 0,
                            "opsPerSec": 0,
                            "diskFetches": 0,
                            "error": bucket["error"],
                        }
                    )

            for bucket_stat in cluster["bucket_stats"]:
                if bucket_stat["stats"]:
                    bucket_stats.append(
                        {
                            "name": bucket_stat["bucket_name"],
                            "stats": bucket_stat["stats"],
                            "error": None,
                        }
                    )
                else:
                    bucket_stats.append(
                        {
                            "name": bucket_stat["bucket_name"],
                            "stats": None,
                            "error": bucket_stat["error"],
                        }
                    )

            # Extract cluster UUID from buckets URI if available
            cluster_uuid = data.get("uuid", "Unknown")
            if (
                cluster_uuid == "Unknown"
                and "buckets" in data
                and "uri" in data["buckets"]
            ):
                buckets_uri = data["buckets"]["uri"]
                if "uuid=" in buckets_uri:
                    cluster_uuid = buckets_uri.split("uuid=")[1].split("&")[0]

            cluster_info = {
                "host": cluster["host"],
                "customName": cluster.get("customName"),
                "clusterName": data.get("clusterName", "Unknown"),
                "clusterUUID": cluster_uuid,
                "health": all(
                    node["status"] == "healthy" for node in data.get("nodes", [])
                ),
                "memory": {
                    "total": data.get("storageTotals", {})
                    .get("ram", {})
                    .get("total", 0)
                    / (1024**3),
                    "used": data.get("storageTotals", {}).get("ram", {}).get("used", 0)
                    / (1024**3),
                    "quotaTotal": data.get("storageTotals", {})
                    .get("ram", {})
                    .get("quotaTotal", 0)
                    / (1024**3),
                },
                "disk": {
                    "total": data.get("storageTotals", {})
                    .get("hdd", {})
                    .get("total", 0)
                    / (1024**3),
                    "used": data.get("storageTotals", {}).get("hdd", {}).get("used", 0)
                    / (1024**3),
                    "free": data.get("storageTotals", {}).get("hdd", {}).get("free", 0)
                    / (1024**3),
                },
                "nodes": [
                    {
                        "hostname": node.get("hostname", "Unknown"),
                        "status": node.get("status", "Unknown"),
                        "services": node.get("services", []),
                        "cpu_utilization": node.get("systemStats", {}).get(
                            "cpu_utilization_rate", 0
                        ),
                        "memory_total": node.get("memoryTotal", 0) / (1024**3),
                        "memory_free": node.get("memoryFree", 0) / (1024**3),
                        "version": node.get("version", "Unknown"),
                    }
                    for node in data.get("nodes", [])
                ],
                "buckets": bucket_details,
                "bucket_stats": bucket_stats,
                "systemStats": data.get("nodes", [{}])[0].get("systemStats", {}),
                "error": None,
            }
        else:
            cluster_info = {
                "host": cluster["host"],
                "customName": cluster.get("customName"),
                "clusterName": "Error",
                "clusterUUID": "Unknown",
                "health": False,
                "memory": {"total": 0, "used": 0, "quotaTotal": 0},
                "disk": {"total": 0, "used": 0, "free": 0},
                "nodes": [],
                "buckets": [],
                "bucket_stats": [],
                "systemStats": {},
                "error": cluster["error"],
            }
        clusters.append(cluster_info)
    return clusters


@app.route("/")
def index():
    return render_template("index.html", version=__version__)


@app.route("/api/clusters")
def get_clusters_data():
    # Ensure logger is initialized
    if logger is None:
        initialize_app()

    # Load cluster configurations
    clusters_config = load_config()
    if not clusters_config:
        return jsonify({"error": "No clusters configured"}), 500

    # Run asynchronous data fetching
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    clusters_data = loop.run_until_complete(get_all_clusters_data(clusters_config))
    loop.close()

    # Process data for JSON response
    clusters = process_cluster_data(clusters_data)
    return jsonify(clusters)


@app.route("/api/bucket/<cluster_host>/<bucket_name>/stats")
def get_bucket_stats(cluster_host, bucket_name):
    """API endpoint to get detailed stats for a specific bucket."""
    try:
        # Ensure logger is initialized
        if logger is None:
            initialize_app()

        clusters = load_config()
        cluster = find_cluster_by_host(clusters, cluster_host)
        if not cluster:
            return jsonify({"error": "Cluster not found"}), 404

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def fetch_detailed_stats():
            async with aiohttp.ClientSession() as session:
                # Fetch current bucket stats
                stats_result = await fetch_bucket_stats(
                    session,
                    cluster["host"],
                    bucket_name,
                    cluster["user"],
                    cluster["pass"],
                )
                # Fetch bucket details
                bucket_result = await fetch_bucket_data(
                    session,
                    cluster["host"],
                    bucket_name,
                    cluster["user"],
                    cluster["pass"],
                )
                return {"stats": stats_result, "bucket": bucket_result}

        result = loop.run_until_complete(fetch_detailed_stats())
        loop.close()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error in get_bucket_stats: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/indexStatus")
def get_index_status():
    """API endpoint to get index status from all clusters."""
    try:
        # Ensure logger is initialized
        if logger is None:
            initialize_app()

        clusters = load_config()
        if not clusters:
            return jsonify({"error": "No clusters configured"}), 500

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def fetch_all_index_status():
            results = []
            async with aiohttp.ClientSession() as session:
                tasks = []
                for cluster in clusters:
                    if cluster.get("watch", True):
                        task = fetch_index_status(
                            session, cluster["host"], cluster["user"], cluster["pass"]
                        )
                        tasks.append(task)

                index_results = await asyncio.gather(*tasks, return_exceptions=True)

                cluster_index = 0
                for i, result in enumerate(index_results):
                    # Find the corresponding cluster that was watched
                    while cluster_index < len(clusters) and not clusters[
                        cluster_index
                    ].get("watch", True):
                        cluster_index += 1

                    if cluster_index >= len(clusters):
                        break

                    if isinstance(result, Exception):
                        logger.error(f"Error fetching index status: {str(result)}")
                        results.append(
                            {
                                "host": clusters[cluster_index]["host"],
                                "customName": clusters[cluster_index].get("customName"),
                                "data": None,
                                "error": str(result),
                            }
                        )
                    else:
                        results.append(
                            {
                                "host": result["host"],
                                "customName": clusters[cluster_index].get("customName"),
                                "data": result["data"],
                                "error": result["error"],
                            }
                        )

                    cluster_index += 1

            return results

        result = loop.run_until_complete(fetch_all_index_status())
        loop.close()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error in get_index_status: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/xdcrStatus")
def get_xdcr_status():
    """API endpoint to get XDCR status from all clusters."""
    try:
        # Ensure logger is initialized
        if logger is None:
            initialize_app()

        clusters = load_config()
        if not clusters:
            return jsonify({"error": "No clusters configured"}), 500

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def fetch_all_xdcr_status():
            results = []
            async with aiohttp.ClientSession() as session:
                tasks = []
                for cluster in clusters:
                    if cluster.get("watch", True):
                        task = fetch_xdcr_data(
                            session, cluster["host"], cluster["user"], cluster["pass"]
                        )
                        tasks.append(task)

                xdcr_results = await asyncio.gather(*tasks, return_exceptions=True)

                cluster_index = 0
                for i, result in enumerate(xdcr_results):
                    # Find the corresponding cluster that was watched
                    while cluster_index < len(clusters) and not clusters[
                        cluster_index
                    ].get("watch", True):
                        cluster_index += 1

                    if cluster_index >= len(clusters):
                        break

                    if isinstance(result, Exception):
                        logger.error(f"Error fetching XDCR status: {str(result)}")
                        results.append(
                            {
                                "host": clusters[cluster_index]["host"],
                                "customName": clusters[cluster_index].get("customName"),
                                "remoteClusters": [],
                                "xdcrTasks": [],
                                "error": str(result),
                            }
                        )
                    else:
                        results.append(
                            {
                                "host": result["host"],
                                "customName": clusters[cluster_index].get("customName"),
                                "remoteClusters": result.get("remoteClusters", []),
                                "xdcrTasks": result.get("xdcrTasks", []),
                                "error": result.get("error"),
                            }
                        )

                    cluster_index += 1

            return results

        result = loop.run_until_complete(fetch_all_xdcr_status())
        loop.close()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error in get_xdcr_status: {str(e)}")
        return jsonify({"error": str(e)}), 500


def initialize_app():
    """Initialize the application with configuration and logging."""
    global config, logger

    # Load configuration first
    config_data = {}
    try:
        with open("config.json", "r") as f:
            config_data = json.load(f)
    except Exception as e:
        print(f"Error loading config.json: {str(e)}")
        # Use default configuration if config.json fails to load
        config_data = {
            "logging": {"level": "info", "file": "logs/app.log", "enabled": True},
            "clusters": [],
        }

    # Setup logging
    logger = setup_logging(config_data)

    # Store global config
    config = config_data

    return config_data


def main(argv=None):
    """Application entrypoint used by ``python app.py`` and console scripts."""
    import sys

    # Initialize application
    config_data = initialize_app()

    try:
        settings = resolve_server_settings(config_data, argv=argv)
    except ValueError as e:
        print(f"Configuration error: {e}")
        sys.exit(1)

    host = settings["host"]
    port = settings["port"]
    debug = settings["debug"]
    url = settings["url"]

    # Print version and where to open the UI
    print(f"Couchbase Dashboard v{__version__}")
    print(f"Open: {url}")
    print(
        f"Listen: host={host} ({settings['sources']['host']}), "
        f"port={port} ({settings['sources']['port']}), "
        f"debug={debug} ({settings['sources']['debug']})"
    )

    if logger:
        logger.info(
            f"Starting Flask server on {host}:{port} (debug={debug}, url={url})"
        )

    try:
        app.run(host=host, port=port, debug=debug)
    except OSError as e:
        # Common when port is already taken
        print(f"Failed to bind {host}:{port}: {e}")
        print(
            "Tip: pick a free port, e.g.  python app.py --port 5060\n"
            "  or set server.port in config.json / CB_DASHBOARD_PORT"
        )
        if logger:
            logger.error(f"Failed to bind {host}:{port}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()