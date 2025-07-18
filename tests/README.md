# Tests Directory

This directory contains all test files for the Couchbase Quick Dashboard project.

## Test Files

### Python Tests
- **`test_app.py`** - Unit tests for the Flask backend functionality
- **`test_integration.py`** - Integration tests for the complete application workflow

### JavaScript Tests
- **`test_scripts.js`** - Unit tests for frontend JavaScript functions

## Running Tests

### From Project Root
```bash
# Run all tests
python run_tests.py

# Run specific test file
pytest tests/test_app.py -v
pytest tests/test_integration.py -v

# Run all Python tests
pytest tests/ -v
```

### From Tests Directory
```bash
cd tests
python -m pytest test_app.py -v
python -m pytest test_integration.py -v
```

## Test Structure

The tests are organized using pytest and follow the standard Python testing conventions:
- Test classes are prefixed with `Test`
- Test methods are prefixed with `test_`
- Async tests use `@pytest.mark.asyncio`
- Mocking is done using `unittest.mock`

## Dependencies

Make sure you have the required test dependencies installed:
```bash
pip install -r requirements-test.txt
```

## Configuration

Test configuration is managed through:
- `pytest.ini` - pytest configuration
- `config.test.json` - test configuration data
- `__init__.py` - makes tests directory a Python package
