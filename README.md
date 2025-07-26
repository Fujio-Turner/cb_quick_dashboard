# Couchbase Cluster Dashboard

A Python web application that monitors multiple Couchbase clusters with real-time updates, advanced timeout handling, and comprehensive operations metrics.

![Dashboard Overview](img/CouchBase_1.png)

![Cluster Details](img/CouchBase_2.png)


##### Version 2.1.0


## Features

### Core Functionality
- **Multi-Cluster Monitoring**: Monitor unlimited Couchbase clusters simultaneously
- **Custom Cluster Names**: Add friendly names to clusters alongside system names
- **Advanced Timeout Handling**: Non-blocking requests - fast clusters display immediately without waiting for slow ones
- **Real-time Updates**: Auto-refresh every 10 seconds with live data
- **Async Architecture**: Concurrent requests to all clusters and buckets for optimal performance

### Dashboard Views
- **Cluster Overview**: Health status, memory/disk usage, and node information
- **Operations Metrics**: Detailed command tracking (cmd_gets, cmd_sets, delete_hits, cas_hits, lookup_hits, increment_hits, decrement_hits)
- **Miss Analytics**: Comprehensive miss tracking for all operation types
- **Bucket Management**: Memory allocation, quota usage, eviction policies, and durability settings
- **XDCR Monitoring**: Cross-datacenter replication status, operations tracking, and error monitoring
- **System Statistics**: Human-readable formatting with automatic unit conversion (MB/GB, percentages)

### Interactive Interface
- **Draggable Cards**: Reorder clusters via drag-and-drop
- **Responsive Charts**: Real-time visualization of operations and system metrics using Chart.js
- **Tabbed Navigation**: Organized data display across Nodes, Buckets, Stats, XDCR, and Charts
- **Error Resilience**: Clear error reporting for failed connections without blocking other clusters

## Executables

If you don't want to build from source and want an easy executable click here: [Releases (Download)](https://github.com/Fujio-Turner/cb_quick_dashboard/releases/)


### How to Run the Executable

1. After you Download the zip file and Unzip it.
2. Update the `config.json` with your cluster(s)  credentials and save.
3. Open a terminal `cd` into the folder
4. Run by `./cb_dashboard`

#### OUTPUT
```shell
# cb_dashboard-macos% ./cb_dashboard
2025-07-20 09:51:22,205 - __main__ - INFO - Couchbase Dashboard v2.1.0 starting up
2025-07-20 09:51:22,205 - __main__ - INFO - Logging configured: level=INFO, file=logs/app.log, enabled=True
Couchbase Dashboard v2.1.0
2025-07-20 09:51:22,205 - __main__ - INFO - Starting Flask server on port 5000 (debug=False)
 * Serving Flask app 'app'
 * Debug mode: off
WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
 * Running on http://127.0.0.1:5000
Press CTRL+C to quit
127.0.0.1 - - [26/Jul/2025 09:52:50] "GET / HTTP/1.1" 200 -
```

5. Open your browser and go to: [http://127.0.0.1:5000](http://127.0.0.1:5000)



## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd cb_quick_dashboard
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure your clusters in `config.json`:
```json
{
    "server": {
        "port": 5000,
        "debug": false
    },
    "logging": {
        "level": "info",
        "file": "logs/app.log",
        "enabled": true
    },
    "clusters": [
                {
                    "host": "http://127.0.0.1:8091",
                    "user": "Administrator",
                    "pass": "password",
                    "customName": "Local Development",
                    "watch":true
                },
                {
                    "host": "http://production.example.com:8091",
                    "user": "Administrator",
                    "pass": "secure_password",
                    "customName": "Production Cluster",
                    "watch":false
                }
                ]
}
```

4. Run the application:
```bash
python app.py
```

5. Open http://localhost:5000 in your browser

## Configuration

### config.json Structure

The configuration file contains three main sections:

#### Server Configuration
- **`server.port`**: Port number for the Flask web server (default: 5000)
- **`server.debug`**: Enable Flask debug mode for development (boolean, default: false)

#### Logging Configuration  
- **`logging.level`**: Log level for application messages (options: "debug", "info", "warning", "error")
- **`logging.file`**: Path to log file for persistent logging (creates directory if needed)
- **`logging.enabled`**: Enable/disable file logging (boolean, set false for console-only logging)

#### Cluster Configuration
Each cluster in the `clusters` array supports:
- **`host`**: Couchbase cluster URL with protocol and port (required)
  - Format: `http://hostname:port` or `https://hostname:port`
  - Standard Couchbase port is 8091
- **`user`**: Authentication username for cluster access (required)
- **`pass`**: Authentication password for cluster access (required)  
- **`customName`**: Friendly display name shown in dashboard (optional)
  - If not provided, uses the hostname from the URL
- **`watch`**: Enable/disable monitoring for this specific cluster (boolean, optional, default: true)
  - Set to `false` to temporarily disable monitoring without removing cluster configuration

### Timeout Settings
- **Cluster timeout**: 15 seconds per cluster
- **Bucket operations**: 10 seconds per cluster
- **Individual timeouts**: Each cluster operates independently

## API Endpoints

- `GET /` - Main dashboard page
- `GET /api/clusters` - JSON API for all cluster data
- `GET /api/bucket/<cluster_host>/<bucket_name>/stats` - Detailed bucket statistics
- `GET /api/xdcrStatus` - XDCR status and metrics for all clusters

## Dashboard Tabs

### Nodes Tab
- Server hostnames with direct links to Couchbase UI
- Health status indicators
- Service assignments (data, index, query, etc.)
- CPU utilization and memory statistics

### Buckets Tab
- **Memory Management**: Quota allocation (MB), quota usage percentage
- **Performance**: Operations per second, disk fetches
- **Configuration**: Eviction policy, durability minimum level
- **Storage**: Replica count, storage backend type

### Stats Tab
- **Human-readable formatting**: Automatic conversion to MB/GB
- **Percentage indicators**: All rates and ratios display with % symbols
- **System metrics**: CPU, memory, and network statistics

### XDCR Tab
- **Replication Status**: Real-time monitoring of cross-datacenter replication tasks
- **Operations Tracking**: XDCR operations per second and cumulative metrics
- **Error Monitoring**: XDCR error rates and failure analysis
- **Remote Cluster Management**: Status of remote cluster connections

### Data Charts Tab
- **Operations Charts**: Real-time tracking of all command types and their corresponding misses
- **Memory State**: Usage, watermarks, and swap statistics
- **Disk Analytics**: Size, fragmentation, commit operations, and queue statistics
- **Performance Metrics**: Connections, CPU utilization, and resident ratios
- **XDCR Charts**: Operations and error visualization for replication monitoring

## Technical Architecture

### Backend (Flask + aiohttp)
- Asynchronous request handling for optimal performance
- Individual cluster timeout management
- Exception handling that doesn't block other operations
- Comprehensive error logging and reporting

### Frontend (jQuery + Chart.js)
- Real-time chart updates without page refresh
- Responsive design with Bootstrap 4
- Dynamic bucket selection for detailed metrics
- Drag-and-drop cluster reordering with jQuery UI

### Data Processing
- Automatic unit conversion (bytes → MB/GB)
- Calculated metrics (total operations from individual commands)
- Time-series data visualization with 60-second rolling windows

## Performance Features

- **Non-blocking Architecture**: Fast clusters display immediately
- **Concurrent Processing**: All API calls execute in parallel
- **Smart Caching**: Efficient data updates without full page reloads
- **Error Isolation**: Failed clusters don't impact others
- **Timeout Management**: Prevents hanging on unresponsive clusters

## Dependencies

- **Flask 2.3.3**: Web framework
- **aiohttp 3.9.5**: Async HTTP client for Couchbase API calls
- **Chart.js**: Real-time data visualization
- **jQuery UI**: Interactive interface components
- **Bootstrap 4**: Responsive styling

## Browser Compatibility

Tested and supported on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### Common Issues
1. **Slow loading**: Check cluster connectivity and adjust timeout settings
2. **Missing data**: Verify Couchbase credentials and network access
3. **Chart not updating**: Ensure bucket statistics are enabled in Couchbase

### Log Monitoring
The application provides detailed logging for:
- Connection timeouts
- Authentication failures
- Bucket access errors
- API response issues

## Release Notes

### Version 2.1.0 - XDCR Monitoring Release

#### 🚀 New Features
- **XDCR Tab**: Complete cross-datacenter replication monitoring
  - Real-time XDCR task status tracking
  - Operations per second metrics for replication streams
  - Error rate monitoring and failure analysis
  - Remote cluster connection status
- **Enhanced API**: New `/api/xdcrStatus` endpoint for XDCR metrics
- **Visual Charts**: XDCR operations and error visualization in Data Charts tab

#### 🔧 Improvements
- Extended tabbed navigation to include XDCR monitoring
- Comprehensive XDCR data collection from remote clusters and tasks endpoints
- Async XDCR data fetching for optimal performance
- Error handling and timeout management for XDCR operations

#### 📋 Technical Details
- XDCR task filtering for focused monitoring
- Integration with existing timeout and error handling systems
- Responsive chart rendering for XDCR metrics
- JSON API support for external XDCR monitoring tools

### Previous Releases
