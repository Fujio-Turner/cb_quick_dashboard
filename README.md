# Couchbase Cluster Dashboard

A Python web application that monitors multiple Couchbase clusters with real-time updates.

## Features

- **Authentication**: Supports username/password authentication for each cluster
- **Async Data Fetching**: Concurrent requests to multiple clusters and buckets
- **Real-time Updates**: Refreshes data every 10 seconds automatically
- **Interactive UI**: Draggable and sortable cluster cards with jQuery UI tabs
- **Comprehensive Data**: Shows cluster health, memory/disk usage, nodes, buckets, and stats

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure your clusters in `config.json`:
```json
[
    {
        "host": "http://127.0.0.1:8091",
        "user": "Administrator",
        "pass": "password"
    }
]
```

3. Run the application:
```bash
python app.py
```

4. Open http://localhost:5000 in your browser

## API Endpoints

- `GET /` - Main dashboard page
- `GET /api/clusters` - JSON API for cluster data

## Configuration

Edit `config.json` to add your Couchbase clusters with their credentials.

## UI Features

- **Cluster Cards**: Each cluster displays in a draggable card
- **Health Status**: Visual indicators for cluster health
- **Memory/Disk Stats**: Real-time usage statistics
- **Tabs**: 
  - Nodes: Server information and status
  - Buckets: Detailed bucket statistics
  - Stats: System statistics
- **Auto-refresh**: Updates every 10 seconds
- **Sortable**: Drag and drop to reorder clusters
