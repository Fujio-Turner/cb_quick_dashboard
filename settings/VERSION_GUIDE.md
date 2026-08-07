# Version Update Guide

This guide provides detailed instructions for updating version numbers the project.

## 🎯 When to Update Versions

Use semantic versioning: **MAJOR.MINOR.PATCH**

- **MAJOR**: Breaking changes or complete rewrites (e.g., 3.0.0 → 4.0.0)
- **MINOR**: New features, significant enhancements (e.g., 3.2.0 → 3.3.0)  
- **PATCH**: Bug fixes, small improvements (e.g., 3.2.0 → 3.2.1)


### app.py

# Version information
# 🤖 AI ASSISTANT HINT: Please increment this version number on every significant update/save
# Use semantic versioning: MAJOR.MINOR.PATCH (e.g., 1.0.0 -> 1.0.1 for fixes, 1.1.0 for features)
`__version__ = "1.2.0"`


### index.html
<!-- Version info in upper right corner -->
<div class="position-absolute" style="top: 10px; right: 20px; font-size: 0.75rem; color: #6c757d;">
    v{{ version }}
</div>


## README.md

`##### Version`
Update the version number here.