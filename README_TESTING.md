# Testing Guide for Couchbase Quick Dashboard

This document explains how to run the comprehensive test suite for the Couchbase Quick Dashboard application.

## 📋 Test Overview

The test suite includes:

- **Backend Unit Tests** (Python) - Tests for Flask app, async functions, data processing
- **Frontend Unit Tests** (JavaScript) - Tests for UI functions, data formatting, health badges  
- **Integration Tests** - End-to-end workflow testing
- **Configuration Tests** - Config loading and validation

## 🔧 Setup

### Prerequisites

1. **Python 3.7+** with pip
2. **Node.js 16+** with npm (for JavaScript tests)
3. **Virtual environment** (recommended)

### Install Dependencies

```bash
# Install Python testing dependencies
pip install -r requirements-test.txt

# Install JavaScript testing dependencies
npm install
```

## 🚀 Running Tests

### Quick Start - Run All Tests

```bash
python run_tests.py
```

This runs the complete test suite including:
- Python backend tests
- JavaScript frontend tests
- Integration tests
- Coverage reports

### Individual Test Suites

#### Python Backend Tests

```bash
# Run all Python tests
pytest test_app.py -v

# Run with coverage
pytest test_app.py --cov=app --cov-report=html --cov-report=term

# Run specific test class
pytest test_app.py::TestFetchClusterData -v

# Run specific test
pytest test_app.py::TestFetchClusterData::test_fetch_cluster_data_success -v
```

#### JavaScript Frontend Tests

```bash
# Run all JavaScript tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode (auto-rerun on changes)
npm run test:watch

# Run with verbose output
npm run test:verbose
```

#### Integration Tests

```bash
# Run integration tests
pytest test_integration.py -v

# Run with coverage
pytest test_integration.py --cov=app
```

## 📊 Test Coverage

### View Coverage Reports

After running tests with coverage:

- **Python Coverage**: Open `htmlcov/index.html` in browser
- **JavaScript Coverage**: Open `coverage/index.html` in browser

### Coverage Targets

- **Backend**: > 90% line coverage
- **Frontend**: > 85% line coverage
- **Integration**: > 80% workflow coverage

## 🧪 Test Structure

### Backend Tests (`test_app.py`)

```
TestFetchClusterData
├── test_fetch_cluster_data_success
├── test_fetch_cluster_data_http_error
└── test_fetch_cluster_data_exception

TestGetAllClustersData
├── test_get_all_clusters_data_with_watched_cluster
├── test_get_all_clusters_data_with_unwatched_cluster
└── test_get_all_clusters_data_default_watch_true

TestProcessClusterData
├── test_process_cluster_data_not_watching
├── test_process_cluster_data_healthy_cluster
└── test_process_cluster_data_error_cluster

TestCreateNotWatchingResult
└── test_create_not_watching_result
```

### Frontend Tests (`test_scripts.js`)

```
Health Badge Functions
├── getHealthBadgeClass tests
└── getHealthBadgeText tests

System Stats Functions
├── formatValue helper tests
└── generateSystemStats tests

Chart Functions
├── Chart creation tests
└── Chart update tests

Integration Tests
└── Complete workflow tests
```

### Integration Tests (`test_integration.py`)

```
TestIntegration
├── test_index_route
├── test_api_clusters_endpoint_success
└── test_api_clusters_endpoint_no_config

TestFullWorkflow
├── test_watched_cluster_workflow
├── test_unwatched_cluster_workflow
└── test_mixed_cluster_workflow

TestErrorHandling
├── test_cluster_timeout_handling
└── test_cluster_connection_error
```

## 🎯 Test Features

### Python Tests

- **Async Testing**: Full support for async/await functions
- **Mock HTTP Requests**: Mock aiohttp sessions and responses
- **Error Scenarios**: Timeout, connection errors, HTTP errors
- **Watch Field Logic**: Tests for watch=true/false behavior
- **Data Processing**: Cluster and bucket data transformation
- **Configuration**: Config loading and validation

### JavaScript Tests

- **Health Badge Logic**: All badge states (healthy, unhealthy, not watching)
- **Data Formatting**: Memory/disk size formatting, percentages, time
- **Stats Categorization**: CPU, memory, disk, network grouping
- **Chart Functions**: Chart creation and update logic
- **Utility Functions**: Time formatting, number formatting
- **Integration**: Complete data processing workflows

### Test Data

- **Mock Configs**: Test configurations in `config.test.json`
- **Sample Responses**: Mock Couchbase API responses
- **Edge Cases**: Empty data, malformed responses, network errors
- **Real Scenarios**: Production-like cluster configurations

## 📈 Continuous Testing

### Watch Mode

For active development:

```bash
# Python tests (manual rerun)
pytest --looponfail test_app.py

# JavaScript tests (auto rerun)
npm run test:watch
```

### Pre-commit Testing

Run before committing changes:

```bash
# Quick test suite
pytest test_app.py -x  # Stop on first failure
npm test

# Full test suite
python run_tests.py
```

## 🐛 Debugging Tests

### Failed Test Investigation

```bash
# Run single failing test with detailed output
pytest test_app.py::TestName::test_name -vvv -s

# Run with debugger on failure
pytest test_app.py --pdb

# Run with print statements visible
pytest test_app.py -s
```

### Mock Debugging

```bash
# Show mock call details
pytest test_app.py -v --tb=long
```

## 📁 File Structure

```
├── test_app.py                 # Backend unit tests
├── test_scripts.js             # Frontend unit tests  
├── test_integration.py         # Integration tests
├── config.test.json           # Test configuration
├── pytest.ini                 # Python test config
├── package.json               # JavaScript test config
├── requirements-test.txt      # Python test dependencies
└── run_tests.py               # Test runner script
```

## 🎨 Test Categories

### Unit Tests
- Test individual functions in isolation
- Mock external dependencies
- Fast execution (< 1 second per test)

### Integration Tests  
- Test complete workflows
- Multiple components working together
- Mock only external HTTP calls

### End-to-End Tests
- Test from HTTP request to response
- Include Flask test client
- Real configuration processing

## 🔍 Best Practices

1. **Test Names**: Descriptive and follow pattern `test_function_name_scenario`
2. **Mock Isolation**: Mock external calls, not internal logic
3. **Edge Cases**: Test error conditions, empty data, malformed input
4. **Assertions**: Use specific assertions with helpful messages
5. **Setup/Teardown**: Use pytest fixtures for common setup
6. **Coverage**: Aim for high coverage but focus on critical paths

## 📝 Adding New Tests

### For New Backend Functions

1. Add test class to `test_app.py`
2. Test success case, error cases, edge cases
3. Mock external dependencies (HTTP, file I/O)
4. Use `@pytest.mark.asyncio` for async functions

### For New Frontend Functions

1. Add test suite to `test_scripts.js`
2. Test with various input types
3. Mock DOM elements and jQuery
4. Test integration with other functions

### For New Features

1. Add integration test to `test_integration.py`
2. Test complete user workflow
3. Include error handling scenarios
4. Update test configuration if needed

## 🚨 Troubleshooting

### Common Issues

**"Module not found" errors**
```bash
pip install -r requirements-test.txt
```

**"npm command not found"**
```bash
# Install Node.js from nodejs.org
# Or use package manager: brew install node
```

**"pytest not found"**
```bash
pip install pytest
# Or activate virtual environment first
```

**Tests timing out**
```bash
# Increase timeout in pytest.ini
# Or run specific slow tests separately
```

This comprehensive test suite ensures the reliability and maintainability of the Couchbase Quick Dashboard application! 🎉
