from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [
        line.strip() for line in fh if line.strip() and not line.startswith("#")
    ]

setup(
    name="cb_quick_dashboard",
    version="1.0.0",
    author="Fujio Turner",
    description="A quick dashboard for monitoring Couchbase clusters",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Fujio-Turner/cb_quick_dashboard",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "test": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "flake8>=6.1.0",
            "black>=23.12.1",
        ],
    },
    entry_points={
        "console_scripts": [
            "cb_dashboard=app:main",
        ],
    },
)
