"""
Integration tests for Couchbase Quick Dashboard
Tests the full application workflow end-to-end
"""

import pytest
import json
import asyncio
import sys
import os
from unittest.mock import patch, Mock, AsyncMock

# Add the parent directory to the path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, get_all_clusters_data, process_cluster_data


class TestIntegration:
    """Integration tests for the complete application workflow"""

    def setup_method(self):
        """Set up test client"""
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_index_route(self):
        """Test the main index route"""
        response = self.client.get("/")
        assert response.status_code == 200
        assert b"Couchbase Cluster Dashboard" in response.data

    @patch("app.load_config")
    @patch("app.get_all_clusters_data")
    @patch("app.process_cluster_data")
    def test_api_clusters_endpoint_success(
        self, mock_process, mock_get_data, mock_load_config
    ):
        """Test successful API clusters endpoint"""
        # Mock configuration
        mock_load_config.return_value = [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "password",
                "watch": True,
            }
        ]

        # Mock cluster data fetch
        mock_get_data.return_value = [
            {
                "host": "http://localhost:8091",
                "data": {"clusterName": "test-cluster"},
                "error": None,
            }
        ]

        # Mock processed data
        mock_process.return_value = [
            {
                "host": "http://localhost:8091",
                "clusterName": "test-cluster",
                "health": True,
                "memory": {"total": 8, "used": 4, "quotaTotal": 6},
                "disk": {"total": 100, "used": 50, "free": 50},
                "nodes": [],
                "buckets": [],
                "bucket_stats": [],
                "systemStats": {},
            }
        ]

        response = self.client.get("/api/clusters")
        assert response.status_code == 200

        data = json.loads(response.data)
        assert len(data) == 1
        assert data[0]["clusterName"] == "test-cluster"
        assert data[0]["health"] is True

    @patch("app.load_config")
    def test_api_clusters_endpoint_no_config(self, mock_load_config):
        """Test API clusters endpoint with no configuration"""
        mock_load_config.return_value = []

        response = self.client.get("/api/clusters")
        assert response.status_code == 500

        data = json.loads(response.data)
        assert "error" in data
        assert "No clusters configured" in data["error"]

    def test_api_bucket_stats_missing_cluster(self):
        """Test bucket stats endpoint with missing cluster"""
        response = self.client.get("/api/bucket/nonexistent:8091/test-bucket/stats")
        assert response.status_code == 404

        data = json.loads(response.data)
        assert "error" in data
        assert "Cluster not found" in data["error"]


class TestFullWorkflow:
    """Test the complete workflow from config to display"""

    @pytest.mark.asyncio
    async def test_watched_cluster_workflow(self):
        """Test complete workflow for watched cluster"""
        # Test configuration
        clusters = [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "password",
                "watch": True,
            }
        ]

        # Mock successful cluster response
        mock_cluster_data = {
            "clusterName": "Production",
            "uuid": "12345-67890",
            "nodes": [
                {
                    "hostname": "node1.cluster.local",
                    "status": "healthy",
                    "services": ["kv", "n1ql", "index"],
                    "systemStats": {
                        "cpu_utilization_rate": 75.5,
                        "mem_total": 8589934592,
                        "mem_free": 4294967296,
                    },
                }
            ],
            "storageTotals": {
                "ram": {
                    "total": 8589934592,
                    "used": 4294967296,
                    "quotaTotal": 6442450944,
                },
                "hdd": {
                    "total": 107374182400,
                    "used": 53687091200,
                    "free": 53687091200,
                },
            },
            "bucketNames": [{"bucketName": "test-bucket"}],
        }

        with patch("app.fetch_cluster_data_with_timeout") as mock_fetch:
            mock_fetch.return_value = {
                "host": "http://localhost:8091",
                "data": mock_cluster_data,
                "error": None,
            }

            # Test data fetching
            results = await get_all_clusters_data(clusters)
            assert len(results) == 1
            assert results[0]["data"]["clusterName"] == "Production"

            # Test data processing
            processed = process_cluster_data(results)
            assert len(processed) == 1

            cluster = processed[0]
            assert cluster["clusterName"] == "Production"
            assert cluster["health"] is True
            assert cluster["memory"]["total"] == 8.0  # GB
            assert cluster["disk"]["total"] == 100.0  # GB
            assert len(cluster["nodes"]) == 1
            assert not cluster.get("not_watching", False)

    @pytest.mark.asyncio
    async def test_unwatched_cluster_workflow(self):
        """Test complete workflow for unwatched cluster"""
        clusters = [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "password",
                "watch": False,
            }
        ]

        # Test data fetching (should not make HTTP calls)
        results = await get_all_clusters_data(clusters)
        assert len(results) == 1
        assert results[0]["not_watching"] is True
        assert results[0]["data"] is None

        # Test data processing
        processed = process_cluster_data(results)
        assert len(processed) == 1

        cluster = processed[0]
        assert cluster["clusterName"] == "Not Watching"
        assert cluster["health"] is None
        assert cluster["not_watching"] is True

    @pytest.mark.asyncio
    async def test_mixed_cluster_workflow(self):
        """Test workflow with both watched and unwatched clusters"""
        clusters = [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "password",
                "watch": True,
            },
            {
                "host": "http://localhost:8092",
                "user": "admin",
                "pass": "password",
                "watch": False,
            },
        ]

        with patch("app.fetch_cluster_data_with_timeout") as mock_fetch:
            mock_fetch.return_value = {
                "host": "http://localhost:8091",
                "data": {"clusterName": "Watched Cluster"},
                "error": None,
            }

            results = await get_all_clusters_data(clusters)
            assert len(results) == 2

            # First cluster should be watched
            assert not results[0].get("not_watching", False)
            assert results[0]["data"]["clusterName"] == "Watched Cluster"

            # Second cluster should be unwatched
            assert results[1]["not_watching"] is True
            assert results[1]["data"] is None

            # Test processing
            processed = process_cluster_data(results)
            assert len(processed) == 2
            assert processed[0]["clusterName"] == "Watched Cluster"
            assert processed[1]["clusterName"] == "Not Watching"


class TestErrorHandling:
    """Test error handling scenarios"""

    @pytest.mark.asyncio
    async def test_cluster_timeout_handling(self):
        """Test handling of cluster timeouts"""
        clusters = [
            {
                "host": "http://timeout-cluster:8091",
                "user": "admin",
                "pass": "password",
                "watch": True,
            }
        ]

        with patch("app.fetch_cluster_data_with_timeout") as mock_fetch:
            mock_fetch.return_value = {
                "host": "http://timeout-cluster:8091",
                "data": None,
                "error": "Request timeout after 15 seconds",
            }

            results = await get_all_clusters_data(clusters)
            processed = process_cluster_data(results)

            assert len(processed) == 1
            cluster = processed[0]
            assert cluster["clusterName"] == "Error"
            assert cluster["health"] is False
            assert "timeout" in cluster["error"]

    @pytest.mark.asyncio
    async def test_cluster_connection_error(self):
        """Test handling of connection errors"""
        clusters = [
            {
                "host": "http://unreachable-cluster:8091",
                "user": "admin",
                "pass": "password",
                "watch": True,
            }
        ]

        with patch("app.fetch_cluster_data_with_timeout") as mock_fetch:
            mock_fetch.return_value = {
                "host": "http://unreachable-cluster:8091",
                "data": None,
                "error": "Connection refused",
            }

            results = await get_all_clusters_data(clusters)
            processed = process_cluster_data(results)

            assert len(processed) == 1
            cluster = processed[0]
            assert cluster["health"] is False
            assert "Connection refused" in cluster["error"]


class TestConfigurationHandling:
    """Test configuration loading and validation"""

    def test_load_test_config(self):
        """Test loading the test configuration file"""
        # First load the actual test config to see what we expect
        config_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "config.test.json",
        )
        with open(config_path, "r") as f:
            test_config = json.load(f)

        # Now test the load_config function with mocked file operations
        with patch("builtins.open", create=True) as mock_open:
            with patch("json.load") as mock_json:
                mock_json.return_value = test_config

                from app import load_config

                config = load_config()

                assert len(config) == 3
                assert config[0]["watch"] is True
                assert config[1]["watch"] is False
                assert "watch" not in config[2] or config[2].get("watch") is None

    def test_default_watch_behavior(self):
        """Test that clusters default to watch=True when not specified"""
        cluster_config = {
            "host": "http://localhost:8091",
            "user": "admin",
            "pass": "password",
            # No watch field
        }

        # Should default to True
        watch_value = cluster_config.get("watch", True)
        assert watch_value is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
