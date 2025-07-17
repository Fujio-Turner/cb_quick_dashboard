$(document).ready(function() {
    let clustersData = [];
    let charts = {};
    let isInitialized = false;

    function getHealthBadgeClass(cluster) {
        if (cluster.not_watching) {
            return 'badge-warning'; // Yellow for not watching
        } else if (cluster.health === true) {
            return 'badge-success'; // Green for healthy
        } else if (cluster.health === false) {
            return 'badge-danger'; // Red for unhealthy
        } else {
            return 'badge-secondary'; // Gray for unknown
        }
    }

    function getHealthBadgeText(cluster) {
        if (cluster.not_watching) {
            return 'Not Watching';
        } else if (cluster.health === true) {
            return 'Healthy';
        } else if (cluster.health === false) {
            return 'Unhealthy';
        } else {
            return 'Unknown';
        }
    }

    function fetchClusters() {
        $.ajax({
            url: '/api/clusters',
            method: 'GET',
            success: function(clusters) {
                clustersData = clusters;
                if (!isInitialized) {
                    initializeClusters(clusters);
                    isInitialized = true;
                } else {
                    updateClustersData(clusters);
                }
                updateLastUpdated();
            },
            error: function(xhr, status, error) {
                console.error('Error fetching cluster data:', error);
                $('#clusters').html('<div class="alert alert-danger">Error fetching data: ' + error + '</div>');
            }
        });
    }

    function updateLastUpdated() {
        const now = new Date();
        $('#last-updated').text('Last updated: ' + now.toLocaleString());
    }

    function initializeClusters(clusters) {
        let html = '';
        clusters.forEach((cluster, index) => {
            html += `
                <div class="cluster card mb-4" data-cluster-uuid="${cluster.clusterUUID}" data-cluster-index="${index}">
                    <div class="card-header drag-handle">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h4 class="mb-1 cluster-name">${cluster.clusterName}${cluster.customName ? ` (${cluster.customName})` : ''}</h4>
                                <small class="text-muted cluster-host">${cluster.host}</small>
                            </div>
                            <div class="text-right">
                                <span class="badge cluster-health-badge ${getHealthBadgeClass(cluster)} mb-1">
                                    ${getHealthBadgeText(cluster)}
                                </span>
                                <br>
                                <small class="text-muted">UUID: <span class="cluster-uuid">${cluster.clusterUUID}</span></small>
                            </div>
                        </div>
                        <div class="row mt-2">
                            <div class="col-md-6">
                                <small><strong>Memory:</strong> <span class="cluster-memory">${cluster.memory.used.toFixed(2)} / ${cluster.memory.total.toFixed(2)} GB 
                                (Quota: ${cluster.memory.quotaTotal.toFixed(2)} GB)</span></small>
                            </div>
                            <div class="col-md-6">
                                <small><strong>Disk:</strong> <span class="cluster-disk">${cluster.disk.used.toFixed(2)} / ${cluster.disk.total.toFixed(2)} GB 
                                (Free: ${cluster.disk.free.toFixed(2)} GB)</span></small>
                            </div>
                        </div>
                    </div>
                    <div class="card-body">
                        ${cluster.not_watching ? `<div class="alert alert-warning"><strong>This cluster is not being monitored.</strong><br>Set "watch": true in config.json to enable monitoring.</div>` : 
                          cluster.error ? `<div class="alert alert-danger">Error: ${cluster.error}</div>` : `
                            <div class="tabs" id="tabs-${index}">
                                <ul>
                                    <li><a href="#tabs-nodes-${index}">Nodes (${cluster.nodes.length})</a></li>
                                    <li><a href="#tabs-buckets-${index}">Buckets (${cluster.buckets.length})</a></li>
                                    <li><a href="#tabs-stats-${index}">Stats</a></li>
                                    <li><a href="#tabs-charts-${index}">Data Charts</a></li>
                                </ul>
                                <div id="tabs-nodes-${index}">
                                    <div class="table-responsive">
                                        <table class="table table-striped table-sm">
                                            <thead>
                                                <tr>
                                                    <th>Hostname</th>
                                                    <th>Status</th>
                                                    <th>Services</th>
                                                    <th>CPU %</th>
                                                    <th>Memory Total (GB)</th>
                                                    <th>Memory Free (GB)</th>
                                                </tr>
                                            </thead>
                                            <tbody class="nodes-table-body">
                                                ${generateNodesTable(cluster.nodes)}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div id="tabs-buckets-${index}">
                                    <div class="table-responsive">
                                        <table class="table table-striped table-sm">
                                        <thead>
                                        <tr>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Storage</th>
                                        <th>Replicas</th>
                                        <th>Items</th>
                                        <th>Quota (MB)</th>
                                        <th>Quota Used (%)</th>
                                        <th>Ops/Sec</th>
                                        <th>Disk Fetches</th>
                                            <th>Eviction Policy</th>
                                                <th>Durability</th>
                                                 </tr>
                                             </thead>
                                            <tbody class="buckets-table-body">
                                                ${generateBucketsTable(cluster.buckets)}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div id="tabs-stats-${index}">
                                    <div class="system-stats">
                                        ${generateSystemStats(cluster.systemStats, cluster)}
                                    </div>
                                </div>
                                <div id="tabs-charts-${index}">
                                    <div class="charts-container">
                                        ${generateChartsContainer(cluster, index)}
                                    </div>
                                </div>
                            </div>
                        `}
                    </div>
                </div>
            `;
        });
        $('#clusters').html(html);

        // Initialize tabs for each cluster
        $('.tabs').tabs({
            activate: function(event, ui) {
                const tabId = ui.newPanel.attr('id');
                const clusterIndex = tabId.split('-')[2];
                
                console.log('🔄 Tab activated:', tabId, 'clusterIndex:', clusterIndex);
                
                if (tabId.includes('charts')) {
                    // Check if charts are already initialized for this cluster
                    const chartExists = Object.keys(charts).some(key => key.includes(`-${clusterIndex}`));
                    console.log('📊 Charts tab activated - chartExists:', chartExists, 'existing charts:', Object.keys(charts).filter(key => key.includes(`-${clusterIndex}`)));
                    
                    if (!chartExists) {
                        console.log('🚀 Initializing charts for cluster:', clusterIndex);
                        setTimeout(() => {
                            initializeCharts(clustersData[clusterIndex], clusterIndex);
                        }, 100);
                    } else {
                        console.log('✅ Charts already exist for cluster:', clusterIndex);
                    }
                }
            }
        });

        // Make clusters draggable and sortable
        initializeDragSort();
    }

    function updateClustersData(clusters) {
        // console.log('🔄 updateClustersData called with', clusters.length, 'clusters'); // Commented out to reduce noise
        clusters.forEach((cluster, index) => {
            const clusterDiv = $(`.cluster[data-cluster-index="${index}"]`);
            if (clusterDiv.length) {
                // Update header info
                clusterDiv.find('.cluster-name').text(`${cluster.clusterName}${cluster.customName ? ` (${cluster.customName})` : ''}`);
                clusterDiv.find('.cluster-host').text(cluster.host);
                clusterDiv.find('.cluster-health-badge')
                    .removeClass('badge-success badge-danger badge-warning badge-secondary')
                    .addClass(getHealthBadgeClass(cluster))
                    .text(getHealthBadgeText(cluster));
                clusterDiv.find('.cluster-uuid').text(cluster.clusterUUID);
                clusterDiv.find('.cluster-memory').html(`${cluster.memory.used.toFixed(2)} / ${cluster.memory.total.toFixed(2)} GB 
                    (Quota: ${cluster.memory.quotaTotal.toFixed(2)} GB)`);
                clusterDiv.find('.cluster-disk').html(`${cluster.disk.used.toFixed(2)} / ${cluster.disk.total.toFixed(2)} GB 
                    (Free: ${cluster.disk.free.toFixed(2)} GB)`);

                // Update table data
                clusterDiv.find('.nodes-table-body').html(generateNodesTable(cluster.nodes));
                clusterDiv.find('.buckets-table-body').html(generateBucketsTable(cluster.buckets));
                clusterDiv.find('.system-stats').html(generateSystemStats(cluster.systemStats, cluster));

                // Update charts if the charts tab is active and charts exist
                const activeTab = clusterDiv.find('.tabs').tabs('option', 'active');
                const tabPanel = clusterDiv.find('.ui-tabs-panel').eq(activeTab);
                if (tabPanel.attr('id').includes('charts')) {
                    // Only update if charts exist for this cluster
                    const chartExists = Object.keys(charts).some(key => key.includes(`-${index}`));
                    if (chartExists) {
                        // console.log('📊 Charts tab is active, updating charts for cluster:', index); // Commented out to reduce noise
                        updateCharts(cluster, index);
                    } else {
                        console.log('⏭️ Charts tab active but no charts exist yet for cluster:', index);
                    }
                }
            }
        });
    }

    function generateNodesTable(nodes) {
        return nodes.map(node => `
            <tr>
                <td><a href="http://${node.hostname}:8091" target="_blank">${node.hostname}</a></td>
                <td><span class="badge badge-${node.status === 'healthy' ? 'success' : 'danger'}">${node.status}</span></td>
                <td><small>${node.services.join(', ')}</small></td>
                <td>${node.cpu_utilization.toFixed(1)}%</td>
                <td>${node.memory_total.toFixed(2)}</td>
                <td>${node.memory_free.toFixed(2)}</td>
            </tr>
        `).join('');
    }

    function generateBucketsTable(buckets) {
        return buckets.map(bucket => `
            <tr>
                <td><strong>${bucket.name}</strong></td>
                <td>${bucket.bucketType}</td>
                <td>${bucket.storageBackend}</td>
                <td>${bucket.replicaNumber}</td>
                <td>${bucket.basicStats.itemCount || 0}</td>
                <td>${((bucket.quota.ram || 0) / (1024 * 1024)).toFixed(2)}</td>
                <td>${bucket.quotaPercentUsed ? bucket.quotaPercentUsed.toFixed(2) + '%' : '0%'}</td>
                <td>${bucket.opsPerSec || 0}</td>
                <td>${bucket.diskFetches || 0}</td>
                <td>${bucket.evictionPolicy}</td>
                <td>${bucket.durabilityMinLevel}</td>
            </tr>
        `).join('');
    }

    function generateSystemStats(systemStats, cluster) {
        const formatValue = (key, value) => {
            if (typeof value !== 'number') return value;
            
            // Memory and Disk-related stats (convert to appropriate units)
            if (key.includes('mem') || key.includes('memory') || key.includes('swap') || 
                key.includes('disk') || key.includes('storage') || key.includes('hdd')) {
                
                // For very large values (> 1TB), show in TB
                if (value > 1024 * 1024 * 1024 * 1024) {
                    return `${(value / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
                }
                // For large values (> 1GB), show in GB
                else if (value > 1024 * 1024 * 1024) {
                    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
                }
                // For medium values (> 1MB), show in MB
                else if (value > 1024 * 1024) {
                    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
                }
                // For small values (> 1KB), show in KB
                else if (value > 1024) {
                    return `${(value / 1024).toFixed(2)} KB`;
                }
                // For very small values, show in bytes
                else {
                    return `${value.toFixed(0)} bytes`;
                }
            }
            
            // Percentage-related stats
            if (key.includes('rate') || key.includes('ratio') || key.includes('percent') || key.includes('utilization')) {
                return `${value.toFixed(2)}%`;
            }
            
            // Time-related stats (convert seconds to appropriate units)
            if (key.includes('time') && value > 60) {
                const minutes = Math.floor(value / 60);
                const seconds = (value % 60).toFixed(1);
                return `${minutes}m ${seconds}s`;
            }
            
            // Large numbers (add commas for readability)
            if (value > 1000) {
                return value.toLocaleString();
            }
            
            // Default formatting for other numeric values
            return value.toFixed(2);
        };

        // Group stats by category
        const cpuStats = {};
        const memoryStats = {};
        const diskStats = {};
        const networkStats = {};
        const otherStats = {};

        // Categorize system stats
        Object.entries(systemStats).forEach(([key, value]) => {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('cpu')) {
                cpuStats[key] = value;
            } else if (lowerKey.includes('mem') || lowerKey.includes('swap') || lowerKey.includes('ram')) {
                memoryStats[key] = value;
            } else if (lowerKey.includes('disk') || lowerKey.includes('storage') || lowerKey.includes('hdd')) {
                diskStats[key] = value;
            } else if (lowerKey.includes('net') || lowerKey.includes('network')) {
                networkStats[key] = value;
            } else {
                otherStats[key] = value;
            }
        });

        // Add cluster-level storage stats if available
        if (cluster && cluster.disk) {
            diskStats['cluster_total_disk'] = cluster.disk.total * 1024 * 1024 * 1024; // Convert GB to bytes
            diskStats['cluster_used_disk'] = cluster.disk.used * 1024 * 1024 * 1024;
            diskStats['cluster_free_disk'] = cluster.disk.free * 1024 * 1024 * 1024;
            diskStats['cluster_disk_utilization'] = ((cluster.disk.used / cluster.disk.total) * 100);
        }

        // Add cluster-level memory stats if available
        if (cluster && cluster.memory) {
            memoryStats['cluster_total_memory'] = cluster.memory.total * 1024 * 1024 * 1024;
            memoryStats['cluster_used_memory'] = cluster.memory.used * 1024 * 1024 * 1024;
            memoryStats['cluster_quota_memory'] = cluster.memory.quotaTotal * 1024 * 1024 * 1024;
            memoryStats['cluster_memory_utilization'] = ((cluster.memory.used / cluster.memory.total) * 100);
        }

        // Add bucket-level storage and operational stats if available
        if (cluster && cluster.buckets && cluster.buckets.length > 0) {
            let totalItems = 0;
            let totalOpsPerSec = 0;
            let totalDiskFetches = 0;
            let totalQuotaUsed = 0;
            let bucketCount = 0;

            cluster.buckets.forEach(bucket => {
                if (bucket.basicStats) {
                    totalItems += bucket.basicStats.itemCount || 0;
                    totalOpsPerSec += bucket.opsPerSec || 0;
                    totalDiskFetches += bucket.diskFetches || 0;
                    totalQuotaUsed += bucket.quotaPercentUsed || 0;
                    bucketCount++;
                }
            });

            otherStats['total_buckets'] = bucketCount;
            otherStats['total_items_across_buckets'] = totalItems;
            otherStats['total_operations_per_sec'] = totalOpsPerSec;
            otherStats['total_disk_fetches'] = totalDiskFetches;
            otherStats['average_quota_utilization'] = bucketCount > 0 ? (totalQuotaUsed / bucketCount) : 0;
        }

        // Add node-level stats if available
        if (cluster && cluster.nodes && cluster.nodes.length > 0) {
            let totalCpuUtil = 0;
            let totalMemoryTotal = 0;
            let totalMemoryFree = 0;
            let healthyNodes = 0;

            cluster.nodes.forEach(node => {
                totalCpuUtil += node.cpu_utilization || 0;
                totalMemoryTotal += node.memory_total || 0;
                totalMemoryFree += node.memory_free || 0;
                if (node.status === 'healthy') healthyNodes++;
            });

            cpuStats['average_cpu_utilization_across_nodes'] = cluster.nodes.length > 0 ? (totalCpuUtil / cluster.nodes.length) : 0;
            memoryStats['total_node_memory'] = totalMemoryTotal * 1024 * 1024 * 1024; // Convert GB to bytes
            memoryStats['total_node_memory_free'] = totalMemoryFree * 1024 * 1024 * 1024;
            memoryStats['node_memory_utilization'] = totalMemoryTotal > 0 ? (((totalMemoryTotal - totalMemoryFree) / totalMemoryTotal) * 100) : 0;
            
            otherStats['total_nodes'] = cluster.nodes.length;
            otherStats['healthy_nodes'] = healthyNodes;
            otherStats['node_health_percentage'] = cluster.nodes.length > 0 ? ((healthyNodes / cluster.nodes.length) * 100) : 0;
        }

        const generateSection = (title, stats, icon) => {
            if (Object.keys(stats).length === 0) return '';
            
            const statsHtml = Object.entries(stats).map(([key, value]) => `
                <div class="col-md-6 mb-2">
                    <div class="stat-item">
                        <strong>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong>
                        <span class="stat-value">${formatValue(key, value)}</span>
                    </div>
                </div>
            `).join('');

            return `
                <div class="stats-section">
                    <h6 class="stats-section-title">
                        <span class="stats-icon">${icon}</span>
                        ${title}
                    </h6>
                    <div class="row">
                        ${statsHtml}
                    </div>
                </div>
            `;
        };

        return `
            ${generateSection('CPU Performance', cpuStats, '🔧')}
            ${generateSection('Memory Usage', memoryStats, '🧠')}
            ${generateSection('Storage & Disk', diskStats, '💾')}
            ${generateSection('Network', networkStats, '🌐')}
            ${generateSection('Other Metrics', otherStats, '📊')}
        `;
    }

    function generateChartsContainer(cluster, index) {
        if (!cluster.bucket_stats || cluster.bucket_stats.length === 0) {
            return '<div class="alert alert-info">No bucket statistics available for charts.</div>';
        }

        let html = `
            <div class="row mb-3">
                <div class="col-md-4">
                    <label for="bucket-select-${index}">Select Bucket:</label>
                    <select id="bucket-select-${index}" class="form-control bucket-selector" data-cluster-index="${index}">
                        ${cluster.bucket_stats.map((bucketStat, bucketIndex) => 
                            `<option value="${bucketIndex}" ${bucketIndex === 0 ? 'selected' : ''}>${bucketStat.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="col-md-4">
                    <div class="selected-bucket-info" id="bucket-info-${index}">
                        <h5 class="mb-0" id="bucket-title-${index}"></h5>
                        <small class="text-muted" id="bucket-details-${index}"></small>
                    </div>
                </div>
                <div class="col-md-3">
                    <label>Chart Scale:</label>
                    <div class="btn-group btn-group-toggle" data-toggle="buttons" id="scale-toggle-${index}">
                        <label class="btn btn-outline-secondary btn-sm active">
                            <input type="radio" name="scale-${index}" value="linear" checked> Linear
                        </label>
                        <label class="btn btn-outline-secondary btn-sm">
                            <input type="radio" name="scale-${index}" value="logarithmic"> Logarithmic
                        </label>
                    </div>
                </div>
                <div class="col-md-1">
                    <label>&nbsp;</label>
                    <button class="btn btn-outline-primary btn-sm btn-block refresh-charts" data-cluster-index="${index}">
                        🔄 Refresh
                    </button>
                </div>
            </div>
            <div class="selected-bucket-charts" id="bucket-charts-${index}">
                <!-- Operations Group -->
                <div class="chart-group">
                    <h6 class="chart-group-title">Operations</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <canvas id="chart-ops-hits-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <canvas id="chart-ops-misses-${index}" width="400" height="200"></canvas>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <canvas id="chart-bg-operations-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <!-- Empty for spacing -->
                        </div>
                    </div>
                </div>

                <!-- State Group -->
                <div class="chart-group mt-4">
                    <h6 class="chart-group-title">State</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <canvas id="chart-memory-state-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <canvas id="chart-items-state-${index}" width="400" height="200"></canvas>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <canvas id="chart-resident-ratio-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <canvas id="chart-connections-cpu-${index}" width="400" height="200"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Disk Group -->
                <div class="chart-group mt-4">
                    <h6 class="chart-group-title">Disk</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <canvas id="chart-disk-size-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <canvas id="chart-disk-commit-${index}" width="400" height="200"></canvas>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <canvas id="chart-disk-queue-active-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <canvas id="chart-disk-queue-replica-${index}" width="400" height="200"></canvas>
                        </div>
                    </div>
                </div>

                <!-- vBucket Group -->
                <div class="chart-group mt-4">
                    <h6 class="chart-group-title">vBucket</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <canvas id="chart-dcp-operations-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <canvas id="chart-dcp-backoff-${index}" width="400" height="200"></canvas>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <canvas id="chart-dcp-queue-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <canvas id="chart-dcp-producer-${index}" width="400" height="200"></canvas>
                        </div>
                    </div>
                </div>

                <!-- XDCR Group -->
                <div class="chart-group mt-4">
                    <h6 class="chart-group-title">XDCR</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <canvas id="chart-xdcr-operations-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <canvas id="chart-meta-operations-${index}" width="400" height="200"></canvas>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <canvas id="chart-xdcr-errors-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <!-- Empty for spacing -->
                        </div>
                    </div>
                </div>

                <!-- Other Group -->
                <div class="chart-group mt-4">
                    <h6 class="chart-group-title">Other</h6>
                    <div class="row">
                        <div class="col-md-6">
                            <canvas id="chart-other-metrics-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <canvas id="chart-other-stats-${index}" width="400" height="200"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return html;
    }

    function initializeCharts(cluster, clusterIndex) {
        console.log('🎯 initializeCharts called for cluster:', clusterIndex, 'bucket_stats length:', cluster.bucket_stats?.length);
        
        if (!cluster.bucket_stats) {
            console.log('❌ No bucket_stats found for cluster:', clusterIndex);
            return;
        }

        // Check if already initialized to prevent duplicate initialization
        if (window.chartsInitialized && window.chartsInitialized[clusterIndex]) {
            console.log('⚠️ Charts already initialized for cluster:', clusterIndex);
            return;
        }

        console.log('🔧 Setting up event handlers for cluster:', clusterIndex);

        // Initialize bucket selector change event
        $(`#bucket-select-${clusterIndex}`).off('change').on('change', function() {
            const selectedBucketIndex = parseInt($(this).val());
            console.log('🔄 Bucket selector changed to:', selectedBucketIndex);
            loadBucketCharts(cluster, clusterIndex, selectedBucketIndex);
        });

        // Initialize scale toggle change event
        $(`#scale-toggle-${clusterIndex} input[type="radio"]`).off('change').on('change', function() {
            const scaleType = $(this).val();
            console.log('📏 Scale toggle changed to:', scaleType);
            updateChartScales(clusterIndex, scaleType);
        });

        // Initialize refresh button event
        $(`.refresh-charts[data-cluster-index="${clusterIndex}"]`).off('click').on('click', function() {
            console.log('🔄 Manual refresh triggered for cluster:', clusterIndex);
            updateCharts(clustersData[clusterIndex], clusterIndex);
        });

        // Enlarge functionality removed for simplicity

        // Load charts for the first bucket by default
        console.log('📈 Loading bucket charts for cluster:', clusterIndex);
        loadBucketCharts(cluster, clusterIndex, 0);

        // Mark as initialized
        if (!window.chartsInitialized) {
            window.chartsInitialized = {};
        }
        window.chartsInitialized[clusterIndex] = true;
        console.log('✅ Charts initialized and marked for cluster:', clusterIndex);
    }

    function loadBucketCharts(cluster, clusterIndex, bucketIndex) {
        console.log('📊 loadBucketCharts called for cluster:', clusterIndex, 'bucket:', bucketIndex);
        const bucketStat = cluster.bucket_stats[bucketIndex];
        if (!bucketStat || !bucketStat.stats || !bucketStat.stats.op || !bucketStat.stats.op.samples) {
            console.log('❌ Invalid bucket stats for cluster:', clusterIndex, 'bucket:', bucketIndex);
            return;
        }

        const samples = bucketStat.stats.op.samples;
        const timestamps = samples.timestamp || [];
        
        // Convert timestamps to human-readable time format (HH:MM:SS)
        const timeLabels = timestamps.map(ts => {
            const date = new Date(ts); // Timestamps are already in milliseconds
            return date.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
        });

        // Update bucket info
        $(`#bucket-title-${clusterIndex}`).text(`${bucketStat.name} Bucket Statistics`);
        $(`#bucket-details-${clusterIndex}`).text(`Type: ${bucketStat.bucketType || 'Unknown'} | vBuckets: ${bucketStat.numVBuckets || 'N/A'} | Replicas: ${bucketStat.replicaNumber || 'N/A'}`);

        // OPERATIONS GROUP
        // Calculate total ops if not available
        const cmd_gets = samples.cmd_get || [];
        const cmd_sets = samples.cmd_set || [];
        const delete_hits = samples.delete_hits || [];
        const cas_hits = samples.cas_hits || [];
        const lookup_hits = samples.lookup_hits || [];
        const incr_hits = samples.incr_hits || [];
        const decr_hits = samples.decr_hits || [];
        const total_ops = samples.ops || cmd_gets.map((_, i) => 
            (cmd_gets[i] || 0) + (cmd_sets[i] || 0) + (delete_hits[i] || 0) + 
            (cas_hits[i] || 0) + (lookup_hits[i] || 0) + (incr_hits[i] || 0) + (decr_hits[i] || 0)
        );

        // Operations - Hits/Operations
        createChart(`chart-ops-hits-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Cmd Gets',
                data: cmd_gets,
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Cmd Sets',
                data: cmd_sets,
                borderColor: 'rgb(255, 193, 7)',
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Delete Hits',
                data: delete_hits,
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'CAS Hits',
                data: cas_hits,
                borderColor: 'rgb(156, 39, 176)',
                backgroundColor: 'rgba(156, 39, 176, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Lookup Hits',
                data: lookup_hits,
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Increment Hits',
                data: incr_hits,
                borderColor: 'rgb(255, 152, 0)',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Decrement Hits',
                data: decr_hits,
                borderColor: 'rgb(103, 58, 183)',
                backgroundColor: 'rgba(103, 58, 183, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Total Ops',
                data: total_ops,
                borderColor: 'rgb(33, 150, 243)',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                tension: 0.1,
                borderWidth: 3,
                yAxisID: 'y'
            }, {
                label: 'Cache Miss Ratio (%)',
                data: samples.ep_cache_miss_ratio || [],
                borderColor: 'rgb(255, 87, 34)',
                backgroundColor: 'rgba(255, 87, 34, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        }, 'Operations - Hits/Commands', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Operations/sec' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Cache Miss Ratio (%)' }, min: 0, max: 100, grid: { drawOnChartArea: false } }
        });

        // Operations - Misses
        createChart(`chart-ops-misses-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Get Misses',
                data: samples.get_misses || [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1
            }, {
                label: 'Delete Misses',
                data: samples.delete_misses || [],
                borderColor: 'rgb(255, 159, 64)',
                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                tension: 0.1
            }, {
                label: 'CAS Misses',
                data: samples.cas_misses || [],
                borderColor: 'rgb(156, 39, 176)',
                backgroundColor: 'rgba(156, 39, 176, 0.2)',
                tension: 0.1
            }, {
                label: 'Lookup Misses',
                data: samples.lookup_misses || [],
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1
            }, {
                label: 'Increment Misses',
                data: samples.incr_misses || [],
                borderColor: 'rgb(255, 152, 0)',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                tension: 0.1
            }, {
                label: 'Decrement Misses',
                data: samples.decr_misses || [],
                borderColor: 'rgb(103, 58, 183)',
                backgroundColor: 'rgba(103, 58, 183, 0.2)',
                tension: 0.1
            }]
        }, 'Operations - Misses');

        // Background Operations 
        createChart(`chart-bg-operations-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Background Fetches',
                data: samples.ep_bg_fetched || [],
                borderColor: 'rgb(33, 150, 243)',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Background Gets',
                data: samples.ep_num_ops_get_meta || [],
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Background Wait Time (s)',
                data: samples.bg_wait_time || [],
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        }, 'Background Operations', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Operations/Items' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Wait Time (s)' }, grid: { drawOnChartArea: false } }
        });

        // STATE GROUP
        // Memory State
        createChart(`chart-memory-state-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Memory Used (MB)',
                data: (samples.mem_used || []).map(val => (val / (1024 * 1024)).toFixed(2)),
                borderColor: 'rgb(153, 102, 255)',
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'EP Mem High Watermark (MB)',
                data: (samples.ep_mem_high_wat || []).map(val => (val / (1024 * 1024)).toFixed(2)),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'EP Mem Low Watermark (MB)',
                data: (samples.ep_mem_low_wat || []).map(val => (val / (1024 * 1024)).toFixed(2)),
                borderColor: 'rgb(255, 152, 0)',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }]
        }, 'Memory State', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Memory (MB)' } }
        });

        // Items State
        createChart(`chart-items-state-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Current Items',
                data: samples.curr_items || [],
                borderColor: 'rgb(255, 159, 64)',
                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                tension: 0.1
            }, {
                label: 'EP Meta Data (MB)',
                data: (samples.ep_meta || []).map(val => (val / (1024 * 1024)).toFixed(2)),
                borderColor: 'rgb(156, 39, 176)',
                backgroundColor: 'rgba(156, 39, 176, 0.2)',
                tension: 0.1
            }, {
                label: 'vB Active Items',
                data: samples.vb_active_curr_items || [],
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1
            }]
        }, 'Items & Documents');

        // Resident Ratio
        createChart(`chart-resident-ratio-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Active Resident Ratio (%)',
                data: samples.vb_active_resident_items_ratio || [],
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1
            }, {
                label: 'Replica Resident Ratio (%)',
                data: samples.vb_replica_resident_items_ratio || [],
                borderColor: 'rgb(255, 152, 0)',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                tension: 0.1
            }, {
                label: 'Pending Resident Ratio (%)',
                data: samples.vb_pending_resident_items_ratio || [],
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1
            }]
        }, 'Items in Memory Ratio', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Percentage (%)' }, min: 0, max: 100 }
        });

        // Connections & CPU
        createChart(`chart-connections-cpu-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Current Connections',
                data: samples.curr_connections || [],
                borderColor: 'rgb(156, 39, 176)',
                backgroundColor: 'rgba(156, 39, 176, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'CPU Utilization (%)',
                data: samples.cpu_utilization_rate || [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }, {
                label: 'CPU User (%)',
                data: samples.cpu_user_rate || [],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        }, 'Connections & CPU', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Connections' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'CPU %' }, grid: { drawOnChartArea: false } }
        });

        // DISK GROUP
        // Disk Size & Fragmentation
        createChart(`chart-disk-size-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Total Disk Size (MB)',
                data: (samples.couch_total_disk_size || []).map(val => (val / (1024 * 1024)).toFixed(2)),
                borderColor: 'rgb(255, 205, 86)',
                backgroundColor: 'rgba(255, 205, 86, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Data Size (MB)',
                data: (samples.couch_docs_data_size || []).map(val => (val / (1024 * 1024)).toFixed(2)),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Fragmentation (%)',
                data: samples.couch_docs_fragmentation || [],
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        }, 'Disk Size & Fragmentation', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Size (MB)' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Fragmentation %' }, grid: { drawOnChartArea: false } }
        });

        // Disk Commit
        createChart(`chart-disk-commit-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Disk Write Queue Items',
                data: samples.disk_write_queue || [],
                borderColor: 'rgb(103, 58, 183)',
                backgroundColor: 'rgba(103, 58, 183, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Avg Disk Commit Time (ms)',
                data: (samples.avg_disk_commit_time || []).map(val => (val * 1000).toFixed(2)),
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        }, 'Disk Commit Operations', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Queue Items' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Time (ms)' }, grid: { drawOnChartArea: false } }
        });

        // Disk Queue Active
        createChart(`chart-disk-queue-active-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Active Fill',
                data: samples.vb_active_queue_fill || [],
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Active Drain',
                data: samples.vb_active_queue_drain || [],
                borderColor: 'rgb(139, 195, 74)',
                backgroundColor: 'rgba(139, 195, 74, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Active Queue Age (s)',
                data: (samples.vb_active_queue_age || []).map(val => (val / 1000000000).toFixed(3)),
                borderColor: 'rgb(255, 193, 7)',
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        }, 'Active Queue Operations', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Queue Items' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Age (s)' }, grid: { drawOnChartArea: false } }
        });

        // Disk Queue Replica
        createChart(`chart-disk-queue-replica-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Replica Fill',
                data: samples.vb_replica_queue_fill || [],
                borderColor: 'rgb(255, 152, 0)',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Replica Drain',
                data: samples.vb_replica_queue_drain || [],
                borderColor: 'rgb(255, 183, 77)',
                backgroundColor: 'rgba(255, 183, 77, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Replica Queue Age (s)',
                data: (samples.vb_replica_queue_age || []).map(val => (val / 1000000000).toFixed(3)),
                borderColor: 'rgb(255, 193, 7)',
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        }, 'Replica Queue Operations', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Queue Items' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Age (s)' }, grid: { drawOnChartArea: false } }
        });

        // OTHER GROUP
        // Other Metrics
        createChart(`chart-other-metrics-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'vBuckets Active',
                data: samples.vb_active_num || [],
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1
            }, {
                label: 'vBuckets Replica',
                data: samples.vb_replica_num || [],
                borderColor: 'rgb(255, 152, 0)',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                tension: 0.1
            }, {
                label: 'vBuckets Pending',
                data: samples.vb_pending_num || [],
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1
            }]
        }, 'vBucket Distribution');

        // Other Stats
        createChart(`chart-other-stats-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Total Items',
                data: samples.ep_total_cache_size || [],
                borderColor: 'rgb(33, 150, 243)',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                tension: 0.1
            }, {
                label: 'Auth Errors',
                data: samples.auth_errors || [],
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1
            }, {
                label: 'Temp OOM Errors',
                data: samples.ep_tmp_oom_errors || [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1
            }]
        }, 'Other Statistics');

        // VBUCKET GROUP
        // DCP Operations
        createChart(`chart-dcp-operations-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'DCP 2i Items Remaining',
                data: samples.ep_dcp_2i_items_remaining || [],
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1
            }, {
                label: 'DCP 2i Items Sent',
                data: samples.ep_dcp_2i_items_sent || [],
                borderColor: 'rgb(255, 152, 0)',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                tension: 0.1
            }, {
                label: 'DCP 2i Total Bytes',
                data: (samples.ep_dcp_2i_total_bytes || []).map(val => (val / (1024 * 1024)).toFixed(2)),
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        }, 'DCP 2i Operations', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Items' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Total Bytes (MB)' }, grid: { drawOnChartArea: false } }
        });

        // DCP Backoff
        createChart(`chart-dcp-backoff-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'DCP 2i Backoff',
                data: samples.ep_dcp_2i_backoff || [],
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1
            }, {
                label: 'DCP Other Backoff',
                data: samples.ep_dcp_other_backoff || [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1
            }, {
                label: 'DCP Replica Backoff',
                data: samples.ep_dcp_replica_backoff || [],
                borderColor: 'rgb(255, 193, 7)',
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                tension: 0.1
            }, {
                label: 'DCP Views Backoff',
                data: samples.ep_dcp_views_backoff || [],
                borderColor: 'rgb(156, 39, 176)',
                backgroundColor: 'rgba(156, 39, 176, 0.2)',
                tension: 0.1
            }]
        }, 'DCP Backoff Operations');

        // DCP Queue
        createChart(`chart-dcp-queue-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'DCP Queue Fill',
                data: samples.ep_dcp_queue_fill || [],
                borderColor: 'rgb(33, 150, 243)',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                tension: 0.1
            }, {
                label: 'DCP Queue Drain',
                data: samples.ep_dcp_queue_drain || [],
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1
            }, {
                label: 'DCP Queue Size',
                data: samples.ep_dcp_queue_size || [],
                borderColor: 'rgb(255, 152, 0)',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                tension: 0.1
            }]
        }, 'DCP Queue Operations');

        // DCP Producer
        createChart(`chart-dcp-producer-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'DCP Producer Count',
                data: samples.ep_dcp_producer_count || [],
                borderColor: 'rgb(103, 58, 183)',
                backgroundColor: 'rgba(103, 58, 183, 0.2)',
                tension: 0.1
            }, {
                label: 'DCP Replica Producer Count',
                data: samples.ep_dcp_replica_producer_count || [],
                borderColor: 'rgb(63, 81, 181)',
                backgroundColor: 'rgba(63, 81, 181, 0.2)',
                tension: 0.1
            }, {
                label: 'DCP Other Producer Count',
                data: samples.ep_dcp_other_producer_count || [],
                borderColor: 'rgb(255, 87, 34)',
                backgroundColor: 'rgba(255, 87, 34, 0.2)',
                tension: 0.1
            }]
        }, 'DCP Producer Operations');

        // XDCR GROUP
        // XDCR Operations
        createChart(`chart-xdcr-operations-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'XDCR Operations',
                data: samples.xdc_ops || [],
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1
            }, {
                label: 'XDCR Optimistic Replication',
                data: samples.replication_active_vbreps || [],
                borderColor: 'rgb(33, 150, 243)',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                tension: 0.1
            }, {
                label: 'XDCR Waiting Vbreps',
                data: samples.replication_waiting_vbreps || [],
                borderColor: 'rgb(255, 152, 0)',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                tension: 0.1
            }]
        }, 'XDCR Operations');

        // Meta Operations (moved from Other)
        createChart(`chart-meta-operations-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Get Meta Operations',
                data: samples.ep_num_ops_get_meta || [],
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1
            }, {
                label: 'Set Meta Operations',
                data: samples.ep_num_ops_set_meta || [],
                borderColor: 'rgb(255, 152, 0)',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                tension: 0.1
            }]
        }, 'Meta Operations');

        // XDCR Errors
        createChart(`chart-xdcr-errors-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'XDCR Checkpoints',
                data: samples.replication_checkpoint_ops || [],
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1
            }, {
                label: 'XDCR Rate Limit',
                data: samples.replication_rate_limit || [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1
            }, {
                label: 'XDCR Errors',
                data: samples.replication_errors || [],
                borderColor: 'rgb(255, 193, 7)',
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                tension: 0.1
            }]
        }, 'XDCR Errors & Status');
    }

    function createChart(canvasId, data, title, customScales) {
        console.log('🎨 createChart called for:', canvasId);
        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.log('❌ Canvas element not found:', canvasId);
            return;
        }

        const chartKey = canvasId;
        if (charts[chartKey]) {
            console.log('🔄 Destroying existing chart:', chartKey);
            charts[chartKey].destroy();
        }

        const defaultScales = {
            x: {
                display: true,
                title: {
                    display: true,
                    text: 'Time'
                }
            },
            y: {
                display: true,
                title: {
                    display: true,
                    text: 'Value'
                }
            }
        };

        const scales = customScales ? { ...defaultScales, ...customScales } : defaultScales;

        console.log('🏗️ Creating new chart:', chartKey);
        charts[chartKey] = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: title
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: scales,
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
        console.log('✅ Chart created successfully:', chartKey);
    }

    function updateChartScales(clusterIndex, scaleType) {
        const chartKeys = [
            `chart-ops-hits-${clusterIndex}`,
            `chart-ops-misses-${clusterIndex}`,
            `chart-bg-operations-${clusterIndex}`,
            `chart-memory-state-${clusterIndex}`,
            `chart-items-state-${clusterIndex}`,
            `chart-resident-ratio-${clusterIndex}`,
            `chart-connections-cpu-${clusterIndex}`,
            `chart-disk-size-${clusterIndex}`,
            `chart-disk-commit-${clusterIndex}`,
            `chart-disk-queue-active-${clusterIndex}`,
            `chart-disk-queue-replica-${clusterIndex}`,
            `chart-dcp-operations-${clusterIndex}`,
            `chart-dcp-backoff-${clusterIndex}`,
            `chart-dcp-queue-${clusterIndex}`,
            `chart-dcp-producer-${clusterIndex}`,
            `chart-xdcr-operations-${clusterIndex}`,
            `chart-meta-operations-${clusterIndex}`,
            `chart-xdcr-errors-${clusterIndex}`,
            `chart-other-metrics-${clusterIndex}`,
            `chart-other-stats-${clusterIndex}`
        ];

        chartKeys.forEach(key => {
            if (charts[key]) {
                const chart = charts[key];
                Object.keys(chart.options.scales).forEach(scaleKey => {
                    if (scaleKey === 'x') return; // Don't change time axis
                    chart.options.scales[scaleKey].type = scaleType;
                });
                chart.update('none');
            }
        });
    }

    // Enlarge functionality removed for simplicity

    function updateCharts(cluster, clusterIndex) {
        console.log('🔄 updateCharts called for cluster:', clusterIndex);
        
        // Throttle updates to prevent too frequent calls
        const now = Date.now();
        const lastUpdate = window.lastChartUpdate = window.lastChartUpdate || {};
        if (lastUpdate[clusterIndex] && (now - lastUpdate[clusterIndex]) < 2000) { // 2 second throttle
            console.log('⏭️ Throttling chart update for cluster:', clusterIndex);
            return;
        }
        lastUpdate[clusterIndex] = now;
        
        if (!cluster.bucket_stats) {
            console.log('❌ No bucket_stats in updateCharts for cluster:', clusterIndex);
            return;
        }

        // Get currently selected bucket
        const selectedBucketIndex = parseInt($(`#bucket-select-${clusterIndex}`).val()) || 0;
        console.log('📈 Updating charts for bucket index:', selectedBucketIndex);
        const bucketStat = cluster.bucket_stats[selectedBucketIndex];
        
        if (!bucketStat || !bucketStat.stats || !bucketStat.stats.op || !bucketStat.stats.op.samples) {
            return;
        }

        const samples = bucketStat.stats.op.samples;
        const timestamps = samples.timestamp || [];
        const timeLabels = timestamps.map(ts => {
            const date = new Date(ts); // Timestamps are already in milliseconds
            return date.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
        });

        // Update each chart type
        const chartKeys = [
            `chart-ops-hits-${clusterIndex}`,
            `chart-ops-misses-${clusterIndex}`,
            `chart-bg-operations-${clusterIndex}`,
            `chart-memory-state-${clusterIndex}`,
            `chart-items-state-${clusterIndex}`,
            `chart-resident-ratio-${clusterIndex}`,
            `chart-connections-cpu-${clusterIndex}`,
            `chart-disk-size-${clusterIndex}`,
            `chart-disk-commit-${clusterIndex}`,
            `chart-disk-queue-active-${clusterIndex}`,
            `chart-disk-queue-replica-${clusterIndex}`,
            `chart-dcp-operations-${clusterIndex}`,
            `chart-dcp-backoff-${clusterIndex}`,
            `chart-dcp-queue-${clusterIndex}`,
            `chart-dcp-producer-${clusterIndex}`,
            `chart-xdcr-operations-${clusterIndex}`,
            `chart-meta-operations-${clusterIndex}`,
            `chart-xdcr-errors-${clusterIndex}`,
            `chart-other-metrics-${clusterIndex}`,
            `chart-other-stats-${clusterIndex}`
        ];

        chartKeys.forEach(key => {
            if (charts[key]) {
                // Skip update if chart is being rendered to avoid conflicts
                if (charts[key].updating) {
                    console.log('⏭️ Skipping update for chart currently being rendered:', key);
                    return;
                }
                
                charts[key].updating = true;
                charts[key].data.labels = timeLabels;
                
                if (key.includes('ops-hits')) {
                    // Recalculate total ops for updates
                    const cmd_gets = samples.cmd_get || [];
                    const cmd_sets = samples.cmd_set || [];
                    const delete_hits = samples.delete_hits || [];
                    const cas_hits = samples.cas_hits || [];
                    const lookup_hits = samples.lookup_hits || [];
                    const incr_hits = samples.incr_hits || [];
                    const decr_hits = samples.decr_hits || [];
                    const total_ops = samples.ops || cmd_gets.map((_, i) => 
                        (cmd_gets[i] || 0) + (cmd_sets[i] || 0) + (delete_hits[i] || 0) + 
                        (cas_hits[i] || 0) + (lookup_hits[i] || 0) + (incr_hits[i] || 0) + (decr_hits[i] || 0)
                    );
                    
                    charts[key].data.datasets[0].data = cmd_gets;
                    charts[key].data.datasets[1].data = cmd_sets;
                    charts[key].data.datasets[2].data = delete_hits;
                    charts[key].data.datasets[3].data = cas_hits;
                    charts[key].data.datasets[4].data = lookup_hits;
                    charts[key].data.datasets[5].data = incr_hits;
                    charts[key].data.datasets[6].data = decr_hits;
                    charts[key].data.datasets[7].data = total_ops;
                    charts[key].data.datasets[8].data = samples.ep_cache_miss_ratio || [];
                } else if (key.includes('ops-misses')) {
                    charts[key].data.datasets[0].data = samples.get_misses || [];
                    charts[key].data.datasets[1].data = samples.delete_misses || [];
                    charts[key].data.datasets[2].data = samples.cas_misses || [];
                    charts[key].data.datasets[3].data = samples.lookup_misses || [];
                    charts[key].data.datasets[4].data = samples.incr_misses || [];
                    charts[key].data.datasets[5].data = samples.decr_misses || [];
                } else if (key.includes('bg-operations')) {
                    charts[key].data.datasets[0].data = samples.ep_bg_fetched || [];
                    charts[key].data.datasets[1].data = samples.ep_num_ops_get_meta || [];
                    charts[key].data.datasets[2].data = samples.bg_wait_time || [];
                } else if (key.includes('memory-state')) {
                    charts[key].data.datasets[0].data = (samples.mem_used || []).map(val => (val / (1024 * 1024)).toFixed(2));
                    charts[key].data.datasets[1].data = (samples.ep_mem_high_wat || []).map(val => (val / (1024 * 1024)).toFixed(2));
                    charts[key].data.datasets[2].data = (samples.ep_mem_low_wat || []).map(val => (val / (1024 * 1024)).toFixed(2));
                } else if (key.includes('items-state')) {
                    charts[key].data.datasets[0].data = samples.curr_items || [];
                    charts[key].data.datasets[1].data = (samples.ep_meta || []).map(val => (val / (1024 * 1024)).toFixed(2));
                    charts[key].data.datasets[2].data = samples.vb_active_curr_items || [];
                } else if (key.includes('resident-ratio')) {
                    charts[key].data.datasets[0].data = samples.vb_active_resident_items_ratio || [];
                    charts[key].data.datasets[1].data = samples.vb_replica_resident_items_ratio || [];
                    charts[key].data.datasets[2].data = samples.vb_pending_resident_items_ratio || [];
                } else if (key.includes('connections-cpu')) {
                    charts[key].data.datasets[0].data = samples.curr_connections || [];
                    charts[key].data.datasets[1].data = samples.cpu_utilization_rate || [];
                    charts[key].data.datasets[2].data = samples.cpu_user_rate || [];
                } else if (key.includes('disk-size')) {
                    charts[key].data.datasets[0].data = (samples.couch_total_disk_size || []).map(val => (val / (1024 * 1024)).toFixed(2));
                    charts[key].data.datasets[1].data = (samples.couch_docs_data_size || []).map(val => (val / (1024 * 1024)).toFixed(2));
                    charts[key].data.datasets[2].data = samples.couch_docs_fragmentation || [];
                } else if (key.includes('disk-commit')) {
                    charts[key].data.datasets[0].data = samples.disk_write_queue || [];
                    charts[key].data.datasets[1].data = (samples.avg_disk_commit_time || []).map(val => (val * 1000).toFixed(2));
                } else if (key.includes('disk-queue-active')) {
                    charts[key].data.datasets[0].data = samples.vb_active_queue_fill || [];
                    charts[key].data.datasets[1].data = samples.vb_active_queue_drain || [];
                    charts[key].data.datasets[2].data = (samples.vb_active_queue_age || []).map(val => (val / 1000000000).toFixed(3));
                } else if (key.includes('disk-queue-replica')) {
                    charts[key].data.datasets[0].data = samples.vb_replica_queue_fill || [];
                    charts[key].data.datasets[1].data = samples.vb_replica_queue_drain || [];
                    charts[key].data.datasets[2].data = (samples.vb_replica_queue_age || []).map(val => (val / 1000000000).toFixed(3));
                } else if (key.includes('other-metrics')) {
                    charts[key].data.datasets[0].data = samples.vb_active_num || [];
                    charts[key].data.datasets[1].data = samples.vb_replica_num || [];
                    charts[key].data.datasets[2].data = samples.vb_pending_num || [];
                } else if (key.includes('other-stats')) {
                    charts[key].data.datasets[0].data = samples.ep_total_cache_size || [];
                    charts[key].data.datasets[1].data = samples.auth_errors || [];
                    charts[key].data.datasets[2].data = samples.ep_tmp_oom_errors || [];
                } else if (key.includes('dcp-operations')) {
                    charts[key].data.datasets[0].data = samples.ep_dcp_2i_items_remaining || [];
                    charts[key].data.datasets[1].data = samples.ep_dcp_2i_items_sent || [];
                    charts[key].data.datasets[2].data = (samples.ep_dcp_2i_total_bytes || []).map(val => (val / (1024 * 1024)).toFixed(2));
                } else if (key.includes('dcp-backoff')) {
                    charts[key].data.datasets[0].data = samples.ep_dcp_2i_backoff || [];
                    charts[key].data.datasets[1].data = samples.ep_dcp_other_backoff || [];
                    charts[key].data.datasets[2].data = samples.ep_dcp_replica_backoff || [];
                    charts[key].data.datasets[3].data = samples.ep_dcp_views_backoff || [];
                } else if (key.includes('dcp-queue')) {
                    charts[key].data.datasets[0].data = samples.ep_dcp_queue_fill || [];
                    charts[key].data.datasets[1].data = samples.ep_dcp_queue_drain || [];
                    charts[key].data.datasets[2].data = samples.ep_dcp_queue_size || [];
                } else if (key.includes('dcp-producer')) {
                    charts[key].data.datasets[0].data = samples.ep_dcp_producer_count || [];
                    charts[key].data.datasets[1].data = samples.ep_dcp_replica_producer_count || [];
                    charts[key].data.datasets[2].data = samples.ep_dcp_other_producer_count || [];
                } else if (key.includes('xdcr-operations')) {
                    charts[key].data.datasets[0].data = samples.xdc_ops || [];
                    charts[key].data.datasets[1].data = samples.replication_active_vbreps || [];
                    charts[key].data.datasets[2].data = samples.replication_waiting_vbreps || [];
                } else if (key.includes('meta-operations')) {
                    charts[key].data.datasets[0].data = samples.ep_num_ops_get_meta || [];
                    charts[key].data.datasets[1].data = samples.ep_num_ops_set_meta || [];
                } else if (key.includes('xdcr-errors')) {
                    charts[key].data.datasets[0].data = samples.replication_checkpoint_ops || [];
                    charts[key].data.datasets[1].data = samples.replication_rate_limit || [];
                    charts[key].data.datasets[2].data = samples.replication_errors || [];
                }
                
                // Use 'none' mode to prevent animations and reduce visual disruption
                charts[key].update('none');
                charts[key].updating = false;
            }
        });
    }

    function initializeDragSort() {
        // Make clusters draggable
        $('.cluster').draggable({
            handle: '.drag-handle',
            stack: '.cluster',
            cursor: 'move',
            opacity: 0.8,
            revert: 'invalid',
            helper: 'clone'
        });

        // Make clusters sortable
        $('#clusters').sortable({
            handle: '.drag-handle',
            placeholder: 'ui-sortable-placeholder',
            forcePlaceholderSize: true,
            tolerance: 'pointer',
            distance: 5,
            update: function(event, ui) {
                console.log('Cluster order updated');
                // Update data-cluster-index attributes after sorting
                $('#clusters .cluster').each(function(index) {
                    $(this).attr('data-cluster-index', index);
                });
            }
        });
    }

    // Initial fetch
    fetchClusters();

    // Poll every 10 seconds
    setInterval(fetchClusters, 10000);
});
