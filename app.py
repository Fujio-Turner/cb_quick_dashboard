import aiohttp
import asyncio
import json
from flask import Flask, render_template, jsonify
import logging

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fetch_cluster_data(session, host, user, password):
    """Fetch data from a Couchbase cluster's /pools/default endpoint."""
    url = f"{host}/pools/default"
    try:
        async with session.get(url, auth=aiohttp.BasicAuth(user, password), timeout=10) as response:
            if response.status == 200:
                data = await response.json()
                return {"host": host, "data": data, "error": None}
            else:
                return {
                    "host": host,
                    "data": None,
                    "error": f"Failed with status {response.status}"
                }
    except Exception as e:
        logger.error(f"Error fetching data from {host}: {str(e)}")
        return {"host": host, "data": None, "error": str(e)}

async def fetch_bucket_data(session, host, bucket_name, user, password):
    """Fetch detailed data for a specific bucket."""
    url = f"{host}/pools/default/buckets/{bucket_name}"
    try:
        async with session.get(url, auth=aiohttp.BasicAuth(user, password), timeout=10) as response:
            if response.status == 200:
                data = await response.json()
                return {"bucket_name": bucket_name, "data": data, "error": None}
            else:
                return {
                    "bucket_name": bucket_name,
                    "data": None,
                    "error": f"Failed with status {response.status}"
                }
    except Exception as e:
        logger.error(f"Error fetching bucket data from {url}: {str(e)}")
        return {"bucket_name": bucket_name, "data": None, "error": str(e)}

async def fetch_bucket_stats(session, host, bucket_name, user, password):
    """Fetch stats data for a specific bucket."""
    url = f"{host}/pools/default/buckets/{bucket_name}/stats"
    try:
        async with session.get(url, auth=aiohttp.BasicAuth(user, password), timeout=10) as response:
            if response.status == 200:
                data = await response.json()
                return {"bucket_name": bucket_name, "stats": data, "error": None}
            else:
                return {
                    "bucket_name": bucket_name,
                    "stats": None,
                    "error": f"Failed with status {response.status}"
                }
    except Exception as e:
        logger.error(f"Error fetching bucket stats from {url}: {str(e)}")
        return {"bucket_name": bucket_name, "stats": None, "error": str(e)}

async def get_all_clusters_data(clusters):
    """Fetch data from all clusters and their buckets asynchronously with timeout handling."""
    async with aiohttp.ClientSession() as session:
        # Fetch /pools/default for all clusters with individual timeouts
        cluster_tasks = []
        for cluster in clusters:
            task = asyncio.create_task(
                fetch_cluster_data_with_timeout(session, cluster, 15)  # 15 second timeout per cluster
            )
            cluster_tasks.append(task)
        
        # Wait for all tasks to complete or timeout individually
        cluster_results = await asyncio.gather(*cluster_tasks, return_exceptions=True)

        # Process results and fetch bucket details
        all_results = []
        for i, cluster_result in enumerate(cluster_results):
            cluster_config = clusters[i]
            
            # Handle exceptions or timeouts
            if isinstance(cluster_result, Exception):
                logger.error(f"Error fetching data from {cluster_config['host']}: {str(cluster_result)}")
                result = {
                    "host": cluster_config["host"], 
                    "customName": cluster_config.get("customName"),
                    "data": None, 
                    "error": f"Timeout or error: {str(cluster_result)}", 
                    "buckets": [], 
                    "bucket_stats": []
                }
            else:
                result = {
                    "host": cluster_result["host"], 
                    "customName": cluster_config.get("customName"),
                    "data": cluster_result["data"], 
                    "error": cluster_result["error"], 
                    "buckets": [], 
                    "bucket_stats": []
                }
                
                # Only fetch bucket details if cluster data was successful
                if cluster_result["data"]:
                    bucket_names = [bucket["bucketName"] for bucket in cluster_result["data"].get("bucketNames", [])]
                    if bucket_names:
                        try:
                            # Fetch bucket data with timeout
                            bucket_tasks = [fetch_bucket_data(session, cluster_result["host"], bucket_name, cluster_config["user"], cluster_config["pass"]) for bucket_name in bucket_names]
                            bucket_stats_tasks = [fetch_bucket_stats(session, cluster_result["host"], bucket_name, cluster_config["user"], cluster_config["pass"]) for bucket_name in bucket_names]
                            
                            # Use timeout for bucket operations too
                            bucket_results = await asyncio.wait_for(asyncio.gather(*bucket_tasks, return_exceptions=True), timeout=10)
                            bucket_stats_results = await asyncio.wait_for(asyncio.gather(*bucket_stats_tasks, return_exceptions=True), timeout=10)
                            
                            result["buckets"] = [r for r in bucket_results if not isinstance(r, Exception)]
                            result["bucket_stats"] = [r for r in bucket_stats_results if not isinstance(r, Exception)]
                            
                        except asyncio.TimeoutError:
                            logger.warning(f"Bucket data fetch timeout for {cluster_result['host']}")
                        except Exception as e:
                            logger.error(f"Error fetching bucket data for {cluster_result['host']}: {str(e)}")
            
            all_results.append(result)
        return all_results

async def fetch_cluster_data_with_timeout(session, cluster_config, timeout_seconds):
    """Fetch cluster data with individual timeout handling."""
    try:
        return await asyncio.wait_for(
            fetch_cluster_data(session, cluster_config["host"], cluster_config["user"], cluster_config["pass"]),
            timeout=timeout_seconds
        )
    except asyncio.TimeoutError:
        return {
            "host": cluster_config["host"],
            "data": None,
            "error": f"Request timeout after {timeout_seconds} seconds"
        }

def load_config():
    """Load cluster configurations from config.json."""
    try:
        with open("config.json", "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading config.json: {str(e)}")
        return []

def process_cluster_data(clusters_data):
    """Process cluster and bucket data for rendering."""
    clusters = []
    for cluster in clusters_data:
        if cluster["data"]:
            data = cluster["data"]
            bucket_details = []
            bucket_stats = []
            
            for bucket in cluster["buckets"]:
                if bucket["data"]:
                    bucket_details.append({
                        "name": bucket["bucket_name"],
                        "uuid": bucket["data"].get("uuid", "Unknown"),
                        "bucketType": bucket["data"].get("bucketType", "Unknown"),
                        "storageBackend": bucket["data"].get("storageBackend", "Unknown"),
                        "replicaNumber": bucket["data"].get("replicaNumber", 0),
                        "basicStats": bucket["data"].get("basicStats", {}),
                        "quota": bucket["data"].get("quota", {}),
                        "evictionPolicy": bucket["data"].get("evictionPolicy", "Unknown"),
                        "durabilityMinLevel": bucket["data"].get("durabilityMinLevel", "Unknown"),
                        "quotaPercentUsed": bucket["data"].get("basicStats", {}).get("quotaPercentUsed", 0),
                        "opsPerSec": bucket["data"].get("basicStats", {}).get("opsPerSec", 0),
                        "diskFetches": bucket["data"].get("basicStats", {}).get("diskFetches", 0),
                        "error": None
                    })
                else:
                    bucket_details.append({
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
                        "error": bucket["error"]
                    })
            
            for bucket_stat in cluster["bucket_stats"]:
                if bucket_stat["stats"]:
                    bucket_stats.append({
                        "name": bucket_stat["bucket_name"],
                        "stats": bucket_stat["stats"],
                        "error": None
                    })
                else:
                    bucket_stats.append({
                        "name": bucket_stat["bucket_name"],
                        "stats": None,
                        "error": bucket_stat["error"]
                    })
            
            cluster_info = {
                "host": cluster["host"],
                "customName": cluster.get("customName"),
                "clusterName": data.get("clusterName", "Unknown"),
                "clusterUUID": data.get("uuid", "Unknown"),
                "health": all(node["status"] == "healthy" for node in data.get("nodes", [])),
                "memory": {
                    "total": data.get("storageTotals", {}).get("ram", {}).get("total", 0) / (1024**3),
                    "used": data.get("storageTotals", {}).get("ram", {}).get("used", 0) / (1024**3),
                    "quotaTotal": data.get("storageTotals", {}).get("ram", {}).get("quotaTotal", 0) / (1024**3),
                },
                "disk": {
                    "total": data.get("storageTotals", {}).get("hdd", {}).get("total", 0) / (1024**3),
                    "used": data.get("storageTotals", {}).get("hdd", {}).get("used", 0) / (1024**3),
                    "free": data.get("storageTotals", {}).get("hdd", {}).get("free", 0) / (1024**3),
                },
                "nodes": [
                    {
                        "hostname": node.get("hostname", "Unknown"),
                        "status": node.get("status", "Unknown"),
                        "services": node.get("services", []),
                        "cpu_utilization": node.get("systemStats", {}).get("cpu_utilization_rate", 0),
                        "memory_total": node.get("memoryTotal", 0) / (1024**3),
                        "memory_free": node.get("memoryFree", 0) / (1024**3),
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
        clusters = load_config()
        cluster = next((c for c in clusters if c["host"] == f"http://{cluster_host}:8091"), None)
        if not cluster:
            return jsonify({"error": "Cluster not found"}), 404
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        async def fetch_detailed_stats():
            async with aiohttp.ClientSession() as session:
                # Fetch current bucket stats
                stats_result = await fetch_bucket_stats(session, cluster["host"], bucket_name, cluster["user"], cluster["pass"])
                # Fetch bucket details
                bucket_result = await fetch_bucket_data(session, cluster["host"], bucket_name, cluster["user"], cluster["pass"])
                return {"stats": stats_result, "bucket": bucket_result}
        
        result = loop.run_until_complete(fetch_detailed_stats())
        loop.close()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error in get_bucket_stats: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
