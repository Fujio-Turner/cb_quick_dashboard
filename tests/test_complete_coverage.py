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
    fetch_index_status,
    process_cluster_data,
    get_all_clusters_data
)


class TestFetchIndexStatus:
    """Test cases for fetch_index_status function - MISSING COVERAGE"""
    
    @pytest.mark.asyncio
    async def test_fetch_index_status_success(self):
        """Test successful index status fetch"""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={"indexes": [{"name": "test-index"}]})
        
        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)
        
        result = await fetch_index_status(mock_session, "http://localhost:8091", "admin", "password")
        
        assert result["host"] == "http://localhost:8091"
        assert result["data"] == {"indexes": [{"name": "test-index"}]}
        assert result["error"] is None
    
    @pytest.mark.asyncio
    async def test_fetch_index_status_http_error(self):
        """Test index status fetch with HTTP error"""
        mock_session = Mock()
        mock_response = Mock()
        mock_response.status = 404
        
        mock_session.get.return_value.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.get.return_value.__aexit__ = AsyncMock(return_value=None)
        
        result = await fetch_index_status(mock_session, "http://localhost:8091", "admin", "password")
        
        assert result["host"] == "http://localhost:8091"
        assert result["data"] is None
        assert "Failed with status 404" in result["error"]
    
    @pytest.mark.asyncio
    async def test_fetch_index_status_exception(self):
        """Test index status fetch with network exception"""
        mock_session = Mock()
        mock_session.get.side_effect = Exception("Connection error")
        
        result = await fetch_index_status(mock_session, "http://localhost:8091", "admin", "password")
        
        assert result["host"] == "http://localhost:8091"
        assert result["data"] is None
        assert result["error"] == "Connection error"


class TestProcessClusterDataEdgeCases:
    """Test edge cases in process_cluster_data function - MISSING COVERAGE"""
    
    def test_process_cluster_data_with_custom_name(self):
        """Test processing cluster data with custom name"""
        clusters_data = [
            {
                "host": "http://localhost:8091",
                "customName": "My Custom Cluster",
                "data": {
                    "clusterName": "Production",
                    "uuid": "12345",
                    "nodes": [{"status": "healthy"}],
                    "storageTotals": {
                        "ram": {"total": 8589934592, "used": 4294967296, "quotaTotal": 6442450944},
                        "hdd": {"total": 107374182400, "used": 53687091200, "free": 53687091200}
                    },
                    "bucketNames": []
                },
                "buckets": [],
                "bucket_stats": [],
                "error": None
            }
        ]
        
        result = process_cluster_data(clusters_data)
        
        assert len(result) == 1
        cluster = result[0]
        assert cluster["customName"] == "My Custom Cluster"
        assert cluster["clusterName"] == "Production"
    
    def test_process_cluster_data_with_uuid_extraction(self):
        """Test UUID extraction from buckets URI"""
        clusters_data = [
            {
                "host": "http://localhost:8091",
                "data": {
                    "clusterName": "Test",
                    "uuid": "Unknown",
                    "buckets": {
                        "uri": "/pools/default/buckets?uuid=extracted-uuid-123&other=param"
                    },
                    "nodes": [{"status": "healthy"}],
                    "storageTotals": {
                        "ram": {"total": 8589934592, "used": 4294967296, "quotaTotal": 6442450944},
                        "hdd": {"total": 107374182400, "used": 53687091200, "free": 53687091200}
                    },
                    "bucketNames": []
                },
                "buckets": [],
                "bucket_stats": [],
                "error": None
            }
        ]
        
        result = process_cluster_data(clusters_data)
        
        assert len(result) == 1
        cluster = result[0]
        assert cluster["clusterUUID"] == "extracted-uuid-123"
    
    def test_process_cluster_data_with_bucket_errors(self):
        """Test processing cluster data with bucket errors"""
        clusters_data = [
            {
                "host": "http://localhost:8091",
                "data": {
                    "clusterName": "Test",
                    "uuid": "12345",
                    "nodes": [{"status": "healthy"}],
                    "storageTotals": {
                        "ram": {"total": 8589934592, "used": 4294967296, "quotaTotal": 6442450944},
                        "hdd": {"total": 107374182400, "used": 53687091200, "free": 53687091200}
                    },
                    "bucketNames": [{"bucketName": "test-bucket"}]
                },
                "buckets": [
                    {
                        "bucket_name": "test-bucket",
                        "data": None,
                        "error": "Bucket access denied"
                    }
                ],
                "bucket_stats": [
                    {
                        "bucket_name": "test-bucket",
                        "stats": None,
                        "error": "Stats access denied"
                    }
                ],
                "error": None
            }
        ]
        
        result = process_cluster_data(clusters_data)
        
        assert len(result) == 1
        cluster = result[0]
        assert len(cluster["buckets"]) == 1
        assert cluster["buckets"][0]["name"] == "test-bucket"
        assert cluster["buckets"][0]["error"] == "Bucket access denied"
        assert len(cluster["bucket_stats"]) == 1
        assert cluster["bucket_stats"][0]["error"] == "Stats access denied"
    
    def test_process_cluster_data_missing_storage_totals(self):
        """Test processing cluster data with missing storageTotals"""
        clusters_data = [
            {
                "host": "http://localhost:8091",
                "data": {
                    "clusterName": "Test",
                    "uuid": "12345",
                    "nodes": [{"status": "healthy"}],
                    "bucketNames": []
                },
                "buckets": [],
                "bucket_stats": [],
                "error": None
            }
        ]
        
        result = process_cluster_data(clusters_data)
        
        assert len(result) == 1
        cluster = result[0]
        assert cluster["memory"]["total"] == 0
        assert cluster["memory"]["used"] == 0
        assert cluster["disk"]["total"] == 0
        assert cluster["disk"]["used"] == 0
    
    def test_process_cluster_data_unhealthy_nodes(self):
        """Test processing cluster data with unhealthy nodes"""
        clusters_data = [
            {
                "host": "http://localhost:8091",
                "data": {
                    "clusterName": "Test",
                    "uuid": "12345",
                    "nodes": [
                        {"status": "healthy"},
                        {"status": "unhealthy"}
                    ],
                    "storageTotals": {
                        "ram": {"total": 8589934592, "used": 4294967296, "quotaTotal": 6442450944},
                        "hdd": {"total": 107374182400, "used": 53687091200, "free": 53687091200}
                    },
                    "bucketNames": []
                },
                "buckets": [],
                "bucket_stats": [],
                "error": None
            }
        ]
        
        result = process_cluster_data(clusters_data)
        
        assert len(result) == 1
        cluster = result[0]
        assert cluster["health"] is False  # Should be False when any node is unhealthy
        assert len(cluster["nodes"]) == 2


class TestGetAllClustersDataEdgeCases:
    """Test edge cases in get_all_clusters_data function - MISSING COVERAGE"""
    
    @pytest.mark.asyncio
    async def test_get_all_clusters_data_with_bucket_timeout(self):
        """Test get_all_clusters_data with bucket fetch timeout"""
        clusters = [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "password",
                "watch": True
            }
        ]
        
        with patch('app.fetch_cluster_data_with_timeout') as mock_fetch_cluster, \
             patch('app.fetch_bucket_data') as mock_fetch_bucket, \
             patch('app.fetch_bucket_stats') as mock_fetch_stats:
            
            mock_fetch_cluster.return_value = {
                "host": "http://localhost:8091",
                "data": {
                    "bucketNames": [{"bucketName": "test-bucket"}]
                },
                "error": None
            }
            
            # Simulate timeout on bucket operations
            mock_fetch_bucket.side_effect = asyncio.TimeoutError()
            mock_fetch_stats.side_effect = asyncio.TimeoutError()
            
            result = await get_all_clusters_data(clusters)
            
            assert len(result) == 1
            assert result[0]["host"] == "http://localhost:8091"
            assert result[0]["buckets"] == []
            assert result[0]["bucket_stats"] == []
    
    @pytest.mark.asyncio
    async def test_get_all_clusters_data_with_cluster_exception(self):
        """Test get_all_clusters_data with cluster fetch exception"""
        clusters = [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "password",
                "watch": True
            }
        ]
        
        with patch('app.fetch_cluster_data_with_timeout') as mock_fetch_cluster:
            mock_fetch_cluster.side_effect = Exception("Connection failed")
            
            result = await get_all_clusters_data(clusters)
            
            assert len(result) == 1
            assert result[0]["host"] == "http://localhost:8091"
            assert result[0]["data"] is None
            assert "Connection failed" in result[0]["error"]
    
    @pytest.mark.asyncio
    async def test_get_all_clusters_data_bucket_fetch_exception(self):
        """Test get_all_clusters_data with bucket fetch exception"""
        clusters = [
            {
                "host": "http://localhost:8091",
                "user": "admin",
                "pass": "password",
                "watch": True
            }
        ]
        
        with patch('app.fetch_cluster_data_with_timeout') as mock_fetch_cluster, \
             patch('app.fetch_bucket_data') as mock_fetch_bucket, \
             patch('app.fetch_bucket_stats') as mock_fetch_stats:
            
            mock_fetch_cluster.return_value = {
                "host": "http://localhost:8091",
                "data": {
                    "bucketNames": [{"bucketName": "test-bucket"}]
                },
                "error": None
            }
            
            # Simulate exception on bucket operations
            mock_fetch_bucket.side_effect = Exception("Bucket fetch failed")
            mock_fetch_stats.side_effect = Exception("Stats fetch failed")
            
            result = await get_all_clusters_data(clusters)
            
            assert len(result) == 1
            assert result[0]["host"] == "http://localhost:8091"
            # Should have empty lists since exceptions were filtered out
            assert result[0]["buckets"] == []
            assert result[0]["bucket_stats"] == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
