import aiohttp
import asyncio
import json
import ssl
import os
from flask import Flask, render_template, jsonify
import logging
from logging.handlers import RotatingFileHandler

# Version information
__version__ = "1.0.0"

app = Flask(__name__)

# Global configuration
config = None
logger = None


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
                    if not (host.startswith("http://") or host.startswith("https://")):
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
    return render_template("index.html")


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
        cluster = next(
            (c for c in clusters if c["host"] == f"http://{cluster_host}:8091"), None
        )
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


if __name__ == "__main__":
    import sys

    # Initialize application
    config_data = initialize_app()

    # Print version information
    print(f"Couchbase Dashboard v{__version__}")

    # Parse command line arguments
    port = 5001
    debug = True

    # Check if we're running as a PyInstaller executable
    if getattr(sys, "frozen", False):
        # Running as PyInstaller executable - disable debug mode
        debug = False

    # Parse command line arguments for port
    if len(sys.argv) > 1:
        for i, arg in enumerate(sys.argv):
            if arg == "--port" and i + 1 < len(sys.argv):
                try:
                    port = int(sys.argv[i + 1])
                except ValueError:
                    print(f"Invalid port number: {sys.argv[i + 1]}")
                    sys.exit(1)

    # Run the application
    app.run(debug=debug, port=port)
