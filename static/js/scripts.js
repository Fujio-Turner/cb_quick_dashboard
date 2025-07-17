$(document).ready(function() {
    let clustersData = [];
    let charts = {};
    let isInitialized = false;

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
                                <h4 class="mb-1 cluster-name">${cluster.clusterName}</h4>
                                <small class="text-muted cluster-host">${cluster.host}</small>
                            </div>
                            <div class="text-right">
                                <span class="badge cluster-health-badge badge-${cluster.health ? 'success' : 'danger'} mb-1">
                                    ${cluster.health ? 'Healthy' : 'Unhealthy'}
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
                        ${cluster.error ? `<div class="alert alert-danger">Error: ${cluster.error}</div>` : `
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
                                                    <th>vBuckets</th>
                                                    <th>Replicas</th>
                                                    <th>Items</th>
                                                    <th>Disk (MB)</th>
                                                    <th>Data (MB)</th>
                                                    <th>Mem (MB)</th>
                                                </tr>
                                            </thead>
                                            <tbody class="buckets-table-body">
                                                ${generateBucketsTable(cluster.buckets)}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div id="tabs-stats-${index}">
                                    <div class="row system-stats">
                                        ${generateSystemStats(cluster.systemStats)}
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
                
                if (tabId.includes('charts')) {
                    setTimeout(() => {
                        initializeCharts(clustersData[clusterIndex], clusterIndex);
                    }, 100);
                }
            }
        });

        // Make clusters draggable and sortable
        initializeDragSort();
    }

    function updateClustersData(clusters) {
        clusters.forEach((cluster, index) => {
            const clusterDiv = $(`.cluster[data-cluster-index="${index}"]`);
            if (clusterDiv.length) {
                // Update header info
                clusterDiv.find('.cluster-name').text(cluster.clusterName);
                clusterDiv.find('.cluster-host').text(cluster.host);
                clusterDiv.find('.cluster-health-badge')
                    .removeClass('badge-success badge-danger')
                    .addClass(cluster.health ? 'badge-success' : 'badge-danger')
                    .text(cluster.health ? 'Healthy' : 'Unhealthy');
                clusterDiv.find('.cluster-uuid').text(cluster.clusterUUID);
                clusterDiv.find('.cluster-memory').html(`${cluster.memory.used.toFixed(2)} / ${cluster.memory.total.toFixed(2)} GB 
                    (Quota: ${cluster.memory.quotaTotal.toFixed(2)} GB)`);
                clusterDiv.find('.cluster-disk').html(`${cluster.disk.used.toFixed(2)} / ${cluster.disk.total.toFixed(2)} GB 
                    (Free: ${cluster.disk.free.toFixed(2)} GB)`);

                // Update table data
                clusterDiv.find('.nodes-table-body').html(generateNodesTable(cluster.nodes));
                clusterDiv.find('.buckets-table-body').html(generateBucketsTable(cluster.buckets));
                clusterDiv.find('.system-stats').html(generateSystemStats(cluster.systemStats));

                // Update charts if the charts tab is active
                const activeTab = clusterDiv.find('.tabs').tabs('option', 'active');
                const tabPanel = clusterDiv.find('.ui-tabs-panel').eq(activeTab);
                if (tabPanel.attr('id').includes('charts')) {
                    updateCharts(cluster, index);
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
                <td>${bucket.numVBuckets}</td>
                <td>${bucket.replicaNumber}</td>
                <td>${bucket.basicStats.itemCount || 0}</td>
                <td>${((bucket.basicStats.diskUsed || 0) / (1024 * 1024)).toFixed(2)}</td>
                <td>${((bucket.basicStats.dataUsed || 0) / (1024 * 1024)).toFixed(2)}</td>
                <td>${((bucket.basicStats.memUsed || 0) / (1024 * 1024)).toFixed(2)}</td>
            </tr>
        `).join('');
    }

    function generateSystemStats(systemStats) {
        return Object.entries(systemStats).map(([key, value]) => `
            <div class="col-md-6 mb-2">
                <strong>${key.replace(/_/g, ' ').toUpperCase()}:</strong> ${typeof value === 'number' ? value.toFixed(2) : value}
            </div>
        `).join('');
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
                <div class="col-md-8">
                    <div class="selected-bucket-info" id="bucket-info-${index}">
                        <h5 class="mb-0" id="bucket-title-${index}"></h5>
                        <small class="text-muted" id="bucket-details-${index}"></small>
                    </div>
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
                            <canvas id="chart-bg-wait-${index}" width="400" height="200"></canvas>
                        </div>
                        <div class="col-md-6">
                            <canvas id="chart-ops-rates-${index}" width="400" height="200"></canvas>
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
        if (!cluster.bucket_stats) return;

        // Initialize bucket selector change event
        $(`#bucket-select-${clusterIndex}`).off('change').on('change', function() {
            const selectedBucketIndex = parseInt($(this).val());
            loadBucketCharts(cluster, clusterIndex, selectedBucketIndex);
        });

        // Load charts for the first bucket by default
        loadBucketCharts(cluster, clusterIndex, 0);
    }

    function loadBucketCharts(cluster, clusterIndex, bucketIndex) {
        const bucketStat = cluster.bucket_stats[bucketIndex];
        if (!bucketStat || !bucketStat.stats || !bucketStat.stats.op || !bucketStat.stats.op.samples) {
            return;
        }

        const samples = bucketStat.stats.op.samples;
        const timestamps = samples.timestamp || [];
        
        // Convert timestamps to relative seconds (last 60 seconds)
        const timeLabels = timestamps.map((ts, i) => `-${60 - i}s`);

        // Update bucket info
        $(`#bucket-title-${clusterIndex}`).text(`${bucketStat.name} Bucket Statistics`);
        $(`#bucket-details-${clusterIndex}`).text(`Type: ${bucketStat.bucketType || 'Unknown'} | vBuckets: ${bucketStat.numVBuckets || 'N/A'} | Replicas: ${bucketStat.replicaNumber || 'N/A'}`);

        // OPERATIONS GROUP
        // Operations - Hits
        createChart(`chart-ops-hits-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Get Hits',
                data: samples.get_hits || [],
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Cmd Get',
                data: samples.cmd_get || [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Cache Miss Rate (%)',
                data: samples.ep_cache_miss_rate || [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        }, 'Operations - Hits', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Operations/sec' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Miss Rate %' }, grid: { drawOnChartArea: false } }
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
                label: 'Incr Misses',
                data: samples.incr_misses || [],
                borderColor: 'rgb(153, 102, 255)',
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                tension: 0.1
            }]
        }, 'Operations - Misses');

        // Background Wait Operations
        createChart(`chart-bg-wait-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Avg BG Wait Time (μs)',
                data: samples.avg_bg_wait_time || [],
                borderColor: 'rgb(103, 58, 183)',
                backgroundColor: 'rgba(103, 58, 183, 0.2)',
                tension: 0.1
            }, {
                label: 'BG Fetched',
                data: samples.bg_fetched || [],
                borderColor: 'rgb(63, 81, 181)',
                backgroundColor: 'rgba(63, 81, 181, 0.2)',
                tension: 0.1
            }, {
                label: 'BG Meta',
                data: samples.bg_meta || [],
                borderColor: 'rgb(33, 150, 243)',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                tension: 0.1
            }]
        }, 'Background Operations');

        // Operations Rates
        createChart(`chart-ops-rates-${clusterIndex}`, {
            labels: timeLabels,
            datasets: [{
                label: 'Operations/sec',
                data: samples.ops || [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1
            }, {
                label: 'Cmd Set',
                data: samples.cmd_set || [],
                borderColor: 'rgb(255, 193, 7)',
                backgroundColor: 'rgba(255, 193, 7, 0.2)',
                tension: 0.1
            }, {
                label: 'Delete Hits',
                data: samples.delete_hits || [],
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1
            }]
        }, 'Operation Rates');

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
            }, {
                label: 'Swap Used (MB)',
                data: (samples.swap_used || []).map(val => (val / (1024 * 1024)).toFixed(2)),
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
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
                data: (samples.vb_active_resident_items_ratio || []).map(val => (val * 100).toFixed(2)),
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.1
            }, {
                label: 'Replica Resident Ratio (%)',
                data: (samples.vb_replica_resident_items_ratio || []).map(val => (val * 100).toFixed(2)),
                borderColor: 'rgb(255, 152, 0)',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                tension: 0.1
            }, {
                label: 'Pending Resident Ratio (%)',
                data: (samples.vb_pending_resident_items_ratio || []).map(val => (val * 100).toFixed(2)),
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1
            }]
        }, 'Items in Memory Ratio');

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
                label: 'Disk Write Queue',
                data: samples.disk_write_queue || [],
                borderColor: 'rgb(103, 58, 183)',
                backgroundColor: 'rgba(103, 58, 183, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Disk Updates',
                data: samples.ep_diskqueue_items || [],
                borderColor: 'rgb(63, 81, 181)',
                backgroundColor: 'rgba(63, 81, 181, 0.2)',
                tension: 0.1,
                yAxisID: 'y'
            }, {
                label: 'Disk Commit Time (s)',
                data: (samples.disk_commit_time || []).map(val => (val / 1000).toFixed(3)),
                borderColor: 'rgb(244, 67, 54)',
                backgroundColor: 'rgba(244, 67, 54, 0.2)',
                tension: 0.1,
                yAxisID: 'y1'
            }]
        }, 'Disk Commit Operations', {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Queue Items' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Time (s)' }, grid: { drawOnChartArea: false } }
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
                data: (samples.vb_active_queue_age || []).map(val => (val / 1000).toFixed(3)),
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
                data: (samples.vb_replica_queue_age || []).map(val => (val / 1000).toFixed(3)),
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
    }

    function createChart(canvasId, data, title, customScales) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        const chartKey = canvasId;
        if (charts[chartKey]) {
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
    }

    function updateCharts(cluster, clusterIndex) {
        if (!cluster.bucket_stats) return;

        // Get currently selected bucket
        const selectedBucketIndex = parseInt($(`#bucket-select-${clusterIndex}`).val()) || 0;
        const bucketStat = cluster.bucket_stats[selectedBucketIndex];
        
        if (!bucketStat || !bucketStat.stats || !bucketStat.stats.op || !bucketStat.stats.op.samples) {
            return;
        }

        const samples = bucketStat.stats.op.samples;
        const timestamps = samples.timestamp || [];
        const timeLabels = timestamps.map((ts, i) => `-${60 - i}s`);

        // Update each chart type
        const chartKeys = [
            `chart-ops-hits-${clusterIndex}`,
            `chart-ops-misses-${clusterIndex}`,
            `chart-bg-wait-${clusterIndex}`,
            `chart-ops-rates-${clusterIndex}`,
            `chart-memory-state-${clusterIndex}`,
            `chart-items-state-${clusterIndex}`,
            `chart-resident-ratio-${clusterIndex}`,
            `chart-connections-cpu-${clusterIndex}`,
            `chart-disk-size-${clusterIndex}`,
            `chart-disk-commit-${clusterIndex}`,
            `chart-disk-queue-active-${clusterIndex}`,
            `chart-disk-queue-replica-${clusterIndex}`,
            `chart-other-metrics-${clusterIndex}`,
            `chart-other-stats-${clusterIndex}`
        ];

        chartKeys.forEach(key => {
            if (charts[key]) {
                charts[key].data.labels = timeLabels;
                
                if (key.includes('ops-hits')) {
                    charts[key].data.datasets[0].data = samples.get_hits || [];
                    charts[key].data.datasets[1].data = samples.cmd_get || [];
                    charts[key].data.datasets[2].data = samples.ep_cache_miss_rate || [];
                } else if (key.includes('ops-misses')) {
                    charts[key].data.datasets[0].data = samples.get_misses || [];
                    charts[key].data.datasets[1].data = samples.delete_misses || [];
                    charts[key].data.datasets[2].data = samples.incr_misses || [];
                } else if (key.includes('bg-wait')) {
                    charts[key].data.datasets[0].data = samples.avg_bg_wait_time || [];
                    charts[key].data.datasets[1].data = samples.bg_fetched || [];
                    charts[key].data.datasets[2].data = samples.bg_meta || [];
                } else if (key.includes('ops-rates')) {
                    charts[key].data.datasets[0].data = samples.ops || [];
                    charts[key].data.datasets[1].data = samples.cmd_set || [];
                    charts[key].data.datasets[2].data = samples.delete_hits || [];
                } else if (key.includes('memory-state')) {
                    charts[key].data.datasets[0].data = (samples.mem_used || []).map(val => (val / (1024 * 1024)).toFixed(2));
                    charts[key].data.datasets[1].data = (samples.ep_mem_high_wat || []).map(val => (val / (1024 * 1024)).toFixed(2));
                    charts[key].data.datasets[2].data = (samples.ep_mem_low_wat || []).map(val => (val / (1024 * 1024)).toFixed(2));
                    charts[key].data.datasets[3].data = (samples.swap_used || []).map(val => (val / (1024 * 1024)).toFixed(2));
                } else if (key.includes('items-state')) {
                    charts[key].data.datasets[0].data = samples.curr_items || [];
                    charts[key].data.datasets[1].data = (samples.ep_meta || []).map(val => (val / (1024 * 1024)).toFixed(2));
                    charts[key].data.datasets[2].data = samples.vb_active_curr_items || [];
                } else if (key.includes('resident-ratio')) {
                    charts[key].data.datasets[0].data = (samples.vb_active_resident_items_ratio || []).map(val => (val * 100).toFixed(2));
                    charts[key].data.datasets[1].data = (samples.vb_replica_resident_items_ratio || []).map(val => (val * 100).toFixed(2));
                    charts[key].data.datasets[2].data = (samples.vb_pending_resident_items_ratio || []).map(val => (val * 100).toFixed(2));
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
                    charts[key].data.datasets[1].data = samples.ep_diskqueue_items || [];
                    charts[key].data.datasets[2].data = (samples.disk_commit_time || []).map(val => (val / 1000).toFixed(3));
                } else if (key.includes('disk-queue-active')) {
                    charts[key].data.datasets[0].data = samples.vb_active_queue_fill || [];
                    charts[key].data.datasets[1].data = samples.vb_active_queue_drain || [];
                    charts[key].data.datasets[2].data = (samples.vb_active_queue_age || []).map(val => (val / 1000).toFixed(3));
                } else if (key.includes('disk-queue-replica')) {
                    charts[key].data.datasets[0].data = samples.vb_replica_queue_fill || [];
                    charts[key].data.datasets[1].data = samples.vb_replica_queue_drain || [];
                    charts[key].data.datasets[2].data = (samples.vb_replica_queue_age || []).map(val => (val / 1000).toFixed(3));
                } else if (key.includes('other-metrics')) {
                    charts[key].data.datasets[0].data = samples.vb_active_num || [];
                    charts[key].data.datasets[1].data = samples.vb_replica_num || [];
                    charts[key].data.datasets[2].data = samples.vb_pending_num || [];
                } else if (key.includes('other-stats')) {
                    charts[key].data.datasets[0].data = samples.ep_total_cache_size || [];
                    charts[key].data.datasets[1].data = samples.auth_errors || [];
                    charts[key].data.datasets[2].data = samples.ep_tmp_oom_errors || [];
                }
                
                charts[key].update('none');
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
