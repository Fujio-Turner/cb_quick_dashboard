# Couchbase Quick Dashboard - Release Distribution

This is a standalone executable version of the Couchbase Quick Dashboard.

## Quick Start

1. **Download** the appropriate version for your operating system:
   - **Windows**: `cb_dashboard-windows.zip`
   - **macOS**: `cb_dashboard-macos.tar.gz`
   - **Linux**: `cb_dashboard-linux.tar.gz`

2. **Extract** the archive to a folder of your choice

3. **Configure** your Couchbase clusters by editing the `config.json` file

4. **Run** the dashboard:
   - **Windows**: Double-click `cb_dashboard.exe` or run from command line
   - **macOS/Linux**: Open terminal and run `./cb_dashboard`

## Configuration

Edit the `config.json` file to configure your Couchbase clusters and logging settings:

```json
{
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
            "customName": "Local Dev",
            "watch": true
        }
    ]
}
```

### Configuration Options

#### Logging Section
- `level`: Log level (`trace`, `debug`, `info`, `warning`, `error`)
- `file`: Path to log file (directory will be created if it doesn't exist)
- `enabled`: Enable/disable file logging (console logging is always enabled)

#### Clusters Section
- `host`: Couchbase cluster URL (http:// or https://)
- `user`: Username for authentication
- `pass`: Password for authentication
- `customName`: Display name for the cluster (optional)
- `watch`: Enable/disable monitoring for this cluster (optional, defaults to true)

### HTTPS and Self-Signed Certificates

The dashboard supports both HTTP and HTTPS connections. For HTTPS connections with self-signed certificates, the dashboard will automatically accept them without validation.

## Accessing the Dashboard

After starting the application, open your web browser and navigate to:
http://localhost:5001

## Logs

Log files are written to the `logs/` directory (created automatically). The application uses rotating log files to prevent excessive disk usage.

## Troubleshooting

1. **Configuration Errors**: Check the console output and log files for configuration validation errors
2. **Connection Issues**: Verify that your Couchbase cluster URLs are correct and accessible
3. **Permission Issues**: Ensure the application has write permissions for the logs directory

## Version Information

This release includes:
- Configurable logging with multiple levels
- Support for both HTTP and HTTPS connections
- Self-signed certificate support
- Configuration validation
- Automatic log file rotation

For more information, visit: https://github.com/Fujio-Turner/cb_quick_dashboard
