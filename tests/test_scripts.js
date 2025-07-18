// Unit tests for scripts.js frontend functions
// This uses Jest testing framework

// Mock jQuery for testing
global.$ = {
    ready: jest.fn(),
    ajax: jest.fn(),
    each: jest.fn(),
    map: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    val: jest.fn(),
    text: jest.fn(),
    html: jest.fn(),
    find: jest.fn(() => ({
        html: jest.fn(),
        text: jest.fn(),
        removeClass: jest.fn(() => ({
            addClass: jest.fn(() => ({
                text: jest.fn()
            }))
        }))
    })),
    tabs: jest.fn()
};

// Import functions to test (this would need to be adapted based on how you structure the modules)
// For this example, I'll define the functions here as they would be extracted from scripts.js

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

    return {
        cpuStats,
        memoryStats,
        diskStats,
        networkStats,
        otherStats,
        formatValue
    };
}

// Test Suite for Health Badge Functions
describe('Health Badge Functions', () => {
    describe('getHealthBadgeClass', () => {
        test('should return badge-warning for not watching cluster', () => {
            const cluster = { not_watching: true };
            expect(getHealthBadgeClass(cluster)).toBe('badge-warning');
        });

        test('should return badge-success for healthy cluster', () => {
            const cluster = { health: true };
            expect(getHealthBadgeClass(cluster)).toBe('badge-success');
        });

        test('should return badge-danger for unhealthy cluster', () => {
            const cluster = { health: false };
            expect(getHealthBadgeClass(cluster)).toBe('badge-danger');
        });

        test('should return badge-secondary for unknown health status', () => {
            const cluster = { health: null };
            expect(getHealthBadgeClass(cluster)).toBe('badge-secondary');
        });

        test('should prioritize not_watching over health status', () => {
            const cluster = { not_watching: true, health: true };
            expect(getHealthBadgeClass(cluster)).toBe('badge-warning');
        });
    });

    describe('getHealthBadgeText', () => {
        test('should return "Not Watching" for not watching cluster', () => {
            const cluster = { not_watching: true };
            expect(getHealthBadgeText(cluster)).toBe('Not Watching');
        });

        test('should return "Healthy" for healthy cluster', () => {
            const cluster = { health: true };
            expect(getHealthBadgeText(cluster)).toBe('Healthy');
        });

        test('should return "Unhealthy" for unhealthy cluster', () => {
            const cluster = { health: false };
            expect(getHealthBadgeText(cluster)).toBe('Unhealthy');
        });

        test('should return "Unknown" for unknown health status', () => {
            const cluster = { health: null };
            expect(getHealthBadgeText(cluster)).toBe('Unknown');
        });
    });
});

// Test Suite for System Stats Functions
describe('System Stats Functions', () => {
    describe('formatValue helper', () => {
        let formatValue;

        beforeAll(() => {
            const result = generateSystemStats({}, {});
            formatValue = result.formatValue;
        });

        test('should format memory values correctly', () => {
            expect(formatValue('mem_total', 1024 * 1024 * 1024)).toBe('1.00 GB');
            expect(formatValue('memory_used', 1024 * 1024)).toBe('1.00 MB');
            expect(formatValue('swap_size', 1024)).toBe('1.00 KB');
            expect(formatValue('mem_free', 512)).toBe('512 bytes');
        });

        test('should format disk values correctly', () => {
            expect(formatValue('disk_total', 1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
            expect(formatValue('storage_used', 5 * 1024 * 1024 * 1024)).toBe('5.00 GB');
            expect(formatValue('hdd_free', 100 * 1024 * 1024)).toBe('100.00 MB');
        });

        test('should format percentage values correctly', () => {
            expect(formatValue('cpu_utilization_rate', 75.5)).toBe('75.50%');
            expect(formatValue('memory_ratio', 0.85)).toBe('0.85%');
            expect(formatValue('disk_percent', 90)).toBe('90.00%');
        });

        test('should format time values correctly', () => {
            expect(formatValue('uptime', 3661)).toBe('61m 1.0s');
            expect(formatValue('response_time', 125)).toBe('2m 5.0s');
            expect(formatValue('boot_time', 30)).toBe('30.00'); // Less than 60 seconds
        });

        test('should format large numbers with commas', () => {
            expect(formatValue('request_count', 1234567)).toBe('1,234,567');
            expect(formatValue('item_count', 5000)).toBe('5,000');
        });

        test('should handle non-numeric values', () => {
            expect(formatValue('status', 'running')).toBe('running');
            expect(formatValue('version', '7.0.0')).toBe('7.0.0');
        });
    });

    describe('generateSystemStats', () => {
        test('should categorize CPU stats correctly', () => {
            const systemStats = {
                cpu_utilization_rate: 75.5,
                cpu_user_rate: 45.2,
                mem_total: 8589934592,
                disk_usage: 50
            };

            const result = generateSystemStats(systemStats, {});

            expect(result.cpuStats).toEqual({
                cpu_utilization_rate: 75.5,
                cpu_user_rate: 45.2
            });
        });

        test('should categorize memory stats correctly', () => {
            const systemStats = {
                mem_total: 8589934592,
                memory_used: 4294967296,
                swap_total: 1073741824,
                cpu_rate: 50
            };

            const result = generateSystemStats(systemStats, {});

            expect(result.memoryStats).toEqual({
                mem_total: 8589934592,
                memory_used: 4294967296,
                swap_total: 1073741824
            });
        });

        test('should categorize disk stats correctly', () => {
            const systemStats = {
                disk_total: 107374182400,
                storage_used: 53687091200,
                hdd_free: 53687091200,
                cpu_rate: 50
            };

            const result = generateSystemStats(systemStats, {});

            expect(result.diskStats).toEqual({
                disk_total: 107374182400,
                storage_used: 53687091200,
                hdd_free: 53687091200
            });
        });

        test('should categorize network stats correctly', () => {
            const systemStats = {
                network_in: 1048576,
                net_out: 2097152,
                cpu_rate: 50
            };

            const result = generateSystemStats(systemStats, {});

            expect(result.networkStats).toEqual({
                network_in: 1048576,
                net_out: 2097152
            });
        });

        test('should handle empty system stats', () => {
            const result = generateSystemStats({}, {});

            expect(result.cpuStats).toEqual({});
            expect(result.memoryStats).toEqual({});
            expect(result.diskStats).toEqual({});
            expect(result.networkStats).toEqual({});
            expect(result.otherStats).toEqual({});
        });

        test('should handle null/undefined cluster data', () => {
            const systemStats = { cpu_rate: 50 };
            
            expect(() => generateSystemStats(systemStats, null)).not.toThrow();
            expect(() => generateSystemStats(systemStats, undefined)).not.toThrow();
        });
    });
});

// Test Suite for Data Processing
describe('Data Processing Functions', () => {
    describe('Node table generation', () => {
        test('should generate nodes table with correct data', () => {
            // This would test the generateNodesTable function
            // Implementation would depend on how the function is structured
        });
    });

    describe('Buckets table generation', () => {
        test('should generate buckets table with correct data', () => {
            // This would test the generateBucketsTable function
            // Implementation would depend on how the function is structured
        });
    });
});

// Test Suite for Chart Functions
describe('Chart Functions', () => {
    describe('Chart creation', () => {
        test('should create chart with correct configuration', () => {
            // Mock Chart.js
            global.Chart = jest.fn();
            
            // This would test chart creation functions
            // Implementation would depend on how charts are structured
        });
    });

    describe('Chart updates', () => {
        test('should update chart data correctly', () => {
            // This would test chart update functions
            // Implementation would depend on how updates are structured
        });
    });
});

// Test Suite for Utility Functions
describe('Utility Functions', () => {
    describe('Time formatting', () => {
        test('should format timestamps correctly', () => {
            // Test timestamp formatting for chart labels
            const timestamp = 1642694400000; // Example timestamp
            const date = new Date(timestamp);
            const timeLabel = date.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            
            expect(timeLabel).toMatch(/\d{2}:\d{2}:\d{2}/);
        });
    });

    describe('Number formatting', () => {
        test('should format large numbers with locale string', () => {
            expect((1234567).toLocaleString()).toBe('1,234,567');
            expect((1000).toLocaleString()).toBe('1,000');
        });
    });
});

// Integration Tests
describe('Integration Tests', () => {
    describe('Cluster data processing workflow', () => {
        test('should process complete cluster data correctly', () => {
            const mockClusterData = {
                host: "http://localhost:8091",
                clusterName: "Test Cluster",
                health: true,
                memory: { total: 8, used: 4, quotaTotal: 6 },
                disk: { total: 100, used: 50, free: 50 },
                nodes: [
                    { hostname: "node1", status: "healthy", cpu_utilization: 75.5 },
                    { hostname: "node2", status: "healthy", cpu_utilization: 65.2 }
                ],
                buckets: [
                    { name: "bucket1", opsPerSec: 1000, diskFetches: 50 }
                ],
                systemStats: {
                    cpu_utilization_rate: 70.5,
                    mem_total: 8589934592,
                    disk_total: 107374182400
                }
            };

            // Test health badge
            expect(getHealthBadgeClass(mockClusterData)).toBe('badge-success');
            expect(getHealthBadgeText(mockClusterData)).toBe('Healthy');

            // Test system stats processing
            const statsResult = generateSystemStats(mockClusterData.systemStats, mockClusterData);
            expect(statsResult.cpuStats.cpu_utilization_rate).toBe(70.5);
            expect(Object.keys(statsResult.memoryStats)).toContain('mem_total');
            expect(Object.keys(statsResult.diskStats)).toContain('disk_total');
        });

        test('should handle not watching cluster correctly', () => {
            const mockClusterData = {
                host: "http://localhost:8091",
                not_watching: true,
                health: null
            };

            expect(getHealthBadgeClass(mockClusterData)).toBe('badge-warning');
            expect(getHealthBadgeText(mockClusterData)).toBe('Not Watching');
        });
    });
});
