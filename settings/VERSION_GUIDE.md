# Version Update Guide

This guide provides detailed instructions for updating version numbers throughout the project.

## 🎯 When to Update Versions

Use semantic versioning: **MAJOR.MINOR.PATCH**

- **MAJOR**: Breaking changes or complete rewrites (e.g., 3.0.0 → 4.0.0)
- **MINOR**: New features, significant enhancements (e.g., 3.2.0 → 3.3.0)  
- **PATCH**: Bug fixes, small improvements (e.g., 3.2.0 → 3.2.1)

## 📋 Required Version Updates

When updating the project version, you MUST update these files:

### 1. app.py
**Location**: Line 13
```python
__version__ = "X.Y.Z"
```
**Purpose**: Main application version used in logs and UI

### 2. README.md  
**Location**: Around line 10
```markdown
##### Version X.Y.Z
```
**Purpose**: Documentation version display

## 🤖 AI Agent Instructions

When updating project versions:

1. **Always update BOTH files above**
2. **Use the same version number in both locations**
3. **Follow semantic versioning rules**
4. **Update Release Notes section in README.md** with new features/changes
5. **Search for any other version references** using grep before completing

### Example Update Process:
```bash
# 1. Find current version
grep -r "__version__" app.py
grep -r "##### Version" README.md

# 2. Update both files with new version
# 3. Add release notes to README.md
# 4. Verify all locations updated
```

## ✅ Verification Checklist

- [ ] app.py `__version__` updated
- [ ] README.md `##### Version` updated  
- [ ] Release Notes section updated with changes
- [ ] Version numbers match in all locations
- [ ] No other version references missed