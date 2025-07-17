#!/usr/bin/env python3
"""
Test runner script for Couchbase Quick Dashboard
Runs both Python backend tests and JavaScript frontend tests
"""

import subprocess
import sys
import os
from pathlib import Path


def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {command}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=False)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed with return code {e.returncode}")
        return False
    except Exception as e:
        print(f"❌ Error running {description}: {e}")
        return False


def check_dependencies():
    """Check if required dependencies are installed"""
    print("Checking dependencies...")
    
    # Check Python dependencies
    try:
        import pytest
        print("✅ pytest is available")
    except ImportError:
        print("❌ pytest not found. Install with: pip install -r requirements-test.txt")
        return False
    
    # Check if Node.js and npm are available for JavaScript tests
    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
        subprocess.run(["npm", "--version"], capture_output=True, check=True)
        print("✅ Node.js and npm are available")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("⚠️  Node.js/npm not found. JavaScript tests will be skipped.")
        return "python_only"
    
    return True


def install_js_dependencies():
    """Install JavaScript testing dependencies"""
    if not os.path.exists("node_modules"):
        print("Installing JavaScript dependencies...")
        return run_command("npm install", "JavaScript dependency installation")
    return True


def run_python_tests():
    """Run Python backend tests"""
    commands = [
        ("pytest test_app.py -v", "Python unit tests"),
        ("pytest test_app.py --cov=app --cov-report=html --cov-report=term", "Python tests with coverage")
    ]
    
    success = True
    for command, description in commands:
        if not run_command(command, description):
            success = False
    
    return success


def run_javascript_tests():
    """Run JavaScript frontend tests"""
    commands = [
        ("npm test", "JavaScript unit tests"),
        ("npm run test:coverage", "JavaScript tests with coverage")
    ]
    
    success = True
    for command, description in commands:
        if not run_command(command, description):
            success = False
    
    return success


def run_integration_tests():
    """Run integration tests if they exist"""
    if os.path.exists("test_integration.py"):
        return run_command("pytest test_integration.py -v", "Integration tests")
    else:
        print("No integration tests found (test_integration.py)")
        return True


def generate_test_report():
    """Generate a summary test report"""
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    
    # Check for coverage reports
    if os.path.exists("htmlcov/index.html"):
        print("📊 Python coverage report: htmlcov/index.html")
    
    if os.path.exists("coverage/index.html"):
        print("📊 JavaScript coverage report: coverage/index.html")
    
    # Check for test artifacts
    if os.path.exists("pytest_cache"):
        print("🗂️  Python test cache: pytest_cache/")
    
    print("\n📋 Test files:")
    for test_file in ["test_app.py", "test_scripts.js"]:
        if os.path.exists(test_file):
            print(f"   ✅ {test_file}")
        else:
            print(f"   ❌ {test_file} (missing)")


def main():
    """Main test runner function"""
    print("🧪 Couchbase Quick Dashboard Test Runner")
    print("=========================================")
    
    # Check dependencies
    deps_status = check_dependencies()
    if deps_status is False:
        sys.exit(1)
    
    all_success = True
    
    # Run Python tests
    print("\n🐍 Running Python Backend Tests...")
    if not run_python_tests():
        all_success = False
    
    # Run JavaScript tests if dependencies are available
    if deps_status is not "python_only":
        print("\n🟨 Running JavaScript Frontend Tests...")
        if install_js_dependencies():
            if not run_javascript_tests():
                all_success = False
        else:
            print("❌ Failed to install JavaScript dependencies")
            all_success = False
    
    # Run integration tests
    print("\n🔗 Running Integration Tests...")
    if not run_integration_tests():
        all_success = False
    
    # Generate report
    generate_test_report()
    
    # Final status
    print(f"\n{'='*60}")
    if all_success:
        print("🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print("💥 SOME TESTS FAILED!")
        sys.exit(1)


if __name__ == "__main__":
    main()
