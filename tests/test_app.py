import pytest
import asyncio
import json
import sys
import os
from unittest.mock import Mock, patch, AsyncMock
import aiohttp

# Add the parent directory to the path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import (
    fetch_cluster_data,
    fetch_bucket_data,
    fetch_bucket_stats,
    get_all_clusters_data,
    create_not_watching_result,
    process_cluster_data,
    load_config,
    fetch_cluster_data_with_timeout,
)


class TestFetchClusterData:
    """Test cases for fetch_cluster_data function"""

    @pytest.mark.asyncio
    async def test_fetch_cluster_data_success(self):
        """Test successful cluster data fetch"""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={"clusterName": "test-cluster"})

        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await fetch_cluster_data(
            mock_session, "http://localhost:8091", "admin", "password"
        )

        assert result["host"] == "http://localhost:8091"
        assert result["data"] == {"clusterName": "test-cluster"}
        assert result["error"] is None

    @pytest.mark.asyncio
    async def test_fetch_cluster_data_http_error(self):
        """Test cluster data fetch with HTTP error"""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status = 401

        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await fetch_cluster_data(
            mock_session, "http://localhost:8091", "admin", "wrong_password"
        )

        assert result["host"] == "http://localhost:8091"
        assert result["data"] is None
        assert "Failed with status 401" in result["error"]

    @pytest.mark.asyncio
    async def test_fetch_cluster_data_exception(self):
        """Test cluster data fetch with network exception"""
        mock_session = Mock()
        mock_session.get.side_effect = Exception("Connection error")

        result = await fetch_cluster_data(
            mock_session, "http://localhost:8091", "admin", "password"
        )

        assert result["host"] == "http://localhost:8091"
        assert result["data"] is None
        assert result["error"] == "Connection error"


class TestFetchBucketData:
    """Test cases for fetch_bucket_data function"""

    @pytest.mark.asyncio
    async def test_fetch_bucket_data_success(self):
        """Test successful bucket data fetch"""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={"bucketType": "membase"})

        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await fetch_bucket_data(
            mock_session, "http://localhost:8091", "test-bucket", "admin", "password"
        )

        assert result["bucket_name"] == "test-bucket"
        assert result["data"] == {"bucketType": "membase"}
        assert result["error"] is None

    @pytest.mark.asyncio
    async def test_fetch_bucket_data_http_error(self):
        """Test bucket data fetch with HTTP error"""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status = 404

        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await fetch_bucket_data(
            mock_session, "http://localhost:8091", "test-bucket", "admin", "password"
        )

        assert result["bucket_name"] == "test-bucket"
        assert result["data"] is None
        assert "Failed with status 404" in result["error"]

    @pytest.mark.asyncio
    async def test_fetch_bucket_data_exception(self):
        """Test bucket data fetch with network exception"""
        mock_session = Mock()
        mock_session.get.side_effect = Exception("Network error")

        result = await fetch_bucket_data(
            mock_session, "http://localhost:8091", "test-bucket", "admin", "password"
        )

        assert result["bucket_name"] == "test-bucket"
        assert result["data"] is None
        assert result["error"] == "Network error"


class TestFetchBucketStats:
    """Test cases for fetch_bucket_stats function"""

    @pytest.mark.asyncio
    async def test_fetch_bucket_stats_success(self):
        """Test successful bucket stats fetch"""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(
            return_value={"op": {"samples": {"timestamp": [123456789]}}}
        )

        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await fetch_bucket_stats(
            mock_session, "http://localhost:8091", "test-bucket", "admin", "password"
        )

        assert result["bucket_name"] == "test-bucket"
        assert result["stats"]["op"]["samples"]["timestamp"] == [123456789]
        assert result["error"] is None

    @pytest.mark.asyncio
    async def test_fetch_bucket_stats_http_error(self):
        """Test bucket stats fetch with HTTP error"""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status = 403

        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)

        result = await fetch_bucket_stats(
            mock_session, "http://localhost:8091", "test-bucket", "admin", "password"
        )

        assert result["bucket_name"] == "test-bucket"
        assert result["stats"] is None
        assert "Failed with status 403" in result["error"]

    @pytest.mark.asyncio
    async def test_fetch_bucket_stats_exception(self):
        """Test bucket stats fetch with network exception"""
        mock_session = Mock()
        mock_session.get.side_effect = Exception("Timeout error")

        result = await fetch_bucket_stats(
            mock_session, "http://localhost:8091", "test-bucket", "admin", "password"
        )

        assert result["bucket_name"] == "test-bucket"
        assert result["stats"] is None
        assert result["error"] == "Timeout error"


class TestCreateNotWatchingResult:
    """Test cases for create_not_watching_result function"""

    @pytest.mark.asyncio
    async def test_create_not_watching_result(self):
        """Test creation of not watching result"""
        cluster_config = {"host": "http://localhost:8091", "customName": "Test Cluster"}

        result = await create_not_watching_result(cluster_config)

        assert result["host"] == "http://localhost:8091"
        assert result["data"] is None
        assert result["error"] is None
        assert result["not_watching"] is True


class TestGetAllClustersData:
    """Test cases for get_all_clusters_data function"""

    @pytest.mark.asyncio
    async def test_get_all_clusters_data_with_watched_cluster(self):
        """Test get_all_clusters_data with watched cluster"""
        clusters = [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "password",
                "watch": True,
            }
        ]

        with patch("app.fetch_cluster_data_with_timeout") as mock_fetch:
            mock_fetch.return_value = {
                "host": "http://localhost:8091",
                "data": {"clusterName": "test"},
                "error": None,
            }

            result = await get_all_clusters_data(clusters)

            assert len(result) == 1
            assert result[0]["host"] == "http://localhost:8091"
            assert not result[0].get("not_watching", False)

    @pytest.mark.asyncio
    async def test_get_all_clusters_data_with_unwatched_cluster(self):
        """Test get_all_clusters_data with unwatched cluster"""
        clusters = [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "password",
                "watch": False,
            }
        ]

        result = await get_all_clusters_data(clusters)

        assert len(result) == 1
        assert result[0]["host"] == "http://localhost:8091"
        assert result[0]["not_watching"] is True

    @pytest.mark.asyncio
    async def test_get_all_clusters_data_default_watch_true(self):
        """Test get_all_clusters_data with missing watch field (defaults to True)"""
        clusters = [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "password",
                # No watch field - should default to True
            }
        ]

        with patch("app.fetch_cluster_data_with_timeout") as mock_fetch:
            mock_fetch.return_value = {
                "host": "http://localhost:8091",
                "data": {"clusterName": "test"},
                "error": None,
            }

            result = await get_all_clusters_data(clusters)

            assert len(result) == 1
            assert not result[0].get("not_watching", False)


class TestProcessClusterData:
    """Test cases for process_cluster_data function"""

    def test_process_cluster_data_not_watching(self):
        """Test processing not watching cluster data"""
        clusters_data = [
            {
                "host": "http://localhost:8091",
                "customName": "Test Cluster",
                "not_watching": True,
                "data": None,
                "error": None,
            }
        ]

        result = process_cluster_data(clusters_data)

        assert len(result) == 1
        cluster = result[0]
        assert cluster["host"] == "http://localhost:8091"
        assert cluster["clusterName"] == "Not Watching"
        assert cluster["health"] is None
        assert cluster["not_watching"] is True

    def test_process_cluster_data_healthy_cluster(self):
        """Test processing healthy cluster data"""
        clusters_data = [
            {
                "host": "http://localhost:8091",
                "customName": "Test Cluster",
                "data": {
                    "clusterName": "Production",
                    "uuid": "12345",
                    "nodes": [{"status": "healthy"}],
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
                    "bucketNames": [],
                },
                "buckets": [],
                "bucket_stats": [],
                "error": None,
            }
        ]

        result = process_cluster_data(clusters_data)

        assert len(result) == 1
        cluster = result[0]
        assert cluster["host"] == "http://localhost:8091"
        assert cluster["clusterName"] == "Production"
        assert cluster["health"] is True
        assert not cluster.get("not_watching", False)
        assert cluster["memory"]["total"] == 8.0  # 8GB
        assert cluster["disk"]["total"] == 100.0  # 100GB

    def test_process_cluster_data_error_cluster(self):
        """Test processing cluster with error"""
        clusters_data = [
            {
                "host": "http://localhost:8091",
                "customName": "Test Cluster",
                "data": None,
                "error": "Connection timeout",
                "buckets": [],
                "bucket_stats": [],
            }
        ]

        result = process_cluster_data(clusters_data)

        assert len(result) == 1
        cluster = result[0]
        assert cluster["host"] == "http://localhost:8091"
        assert cluster["clusterName"] == "Error"
        assert cluster["health"] is False
        assert cluster["error"] == "Connection timeout"


class TestLoadConfig:
    """Test cases for load_config function"""

    @patch("builtins.open")
    @patch("json.load")
    def test_load_config_success(self, mock_json_load, mock_open):
        """Test successful config loading"""
        mock_config = [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "password",
                "watch": True,
            }
        ]
        mock_json_load.return_value = mock_config

        result = load_config()

        assert result == mock_config
        mock_open.assert_called_once_with("config.json", "r")

    @patch("builtins.open")
    def test_load_config_file_not_found(self, mock_open):
        """Test config loading with file not found"""
        mock_open.side_effect = FileNotFoundError("File not found")

        result = load_config()

        assert result == []

    @patch("builtins.open")
    @patch("json.load")
    def test_load_config_invalid_json(self, mock_json_load, mock_open):
        """Test config loading with invalid JSON"""
        mock_json_load.side_effect = json.JSONDecodeError("Invalid JSON", "", 0)

        result = load_config()

        assert result == []


class TestFetchClusterDataWithTimeout:
    """Test cases for fetch_cluster_data_with_timeout function"""

    @pytest.mark.asyncio
    async def test_fetch_cluster_data_with_timeout_success(self):
        """Test successful fetch with timeout"""
        cluster_config = {
            "host": "http://localhost:8091",
            "user": "admin",
            "pass": "password",
        }

        with patch("app.fetch_cluster_data") as mock_fetch:
            mock_fetch.return_value = {
                "host": "http://localhost:8091",
                "data": {"clusterName": "test"},
                "error": None,
            }

            result = await fetch_cluster_data_with_timeout(None, cluster_config, 10)

            assert result["host"] == "http://localhost:8091"
            assert result["data"]["clusterName"] == "test"
            assert result["error"] is None

    @pytest.mark.asyncio
    async def test_fetch_cluster_data_with_timeout_timeout(self):
        """Test fetch with timeout error"""
        cluster_config = {
            "host": "http://localhost:8091",
            "user": "admin",
            "pass": "password",
        }

        with patch("app.fetch_cluster_data") as mock_fetch:
            mock_fetch.side_effect = asyncio.TimeoutError()

            result = await fetch_cluster_data_with_timeout(None, cluster_config, 10)

            assert result["host"] == "http://localhost:8091"
            assert result["data"] is None
            assert "timeout after 10 seconds" in result["error"]


if __name__ == "__main__":
    pytest.main([__file__])
