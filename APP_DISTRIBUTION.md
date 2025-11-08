# Where to Put Your App - Distribution Guide

## 📦 App Distribution Overview

Your app is automatically distributed through **GitHub Releases**. Here's where everything goes:

## 🎯 For Users (How They Get the App)

### Initial Download
Users download the app from:
**https://github.com/juntttttttt/AssetManager/releases**

1. Go to your GitHub repository
2. Click "Releases" on the right sidebar
3. Download the latest `Asset Manager.exe` file
4. Run the `.exe` file (it's a portable app - no installation needed!)

### Updates
- **Automatic**: App checks for updates on startup and every 4 hours
- **Source**: GitHub Releases (same place as initial download)
- **No action needed**: Users get notified automatically when you release updates

## 🔨 For You (Where the App is Built)

### Local Build Output
When you build the app locally:
```bash
npm run build:win
```

The built app goes to:
```
release/
  └── Asset Manager.exe  ← This is the portable executable
```

### GitHub Actions Build
When you push a version tag (e.g., `v1.0.0`):
1. GitHub Actions builds the app automatically
2. Creates a GitHub Release
3. Uploads `Asset Manager.exe` to the release
4. Users can download from the release page

## 📂 File Structure

```
your-project/
├── release/                    ← Local build output (gitignored)
│   └── Asset Manager.exe      ← Built app (portable)
│
├── .github/
│   └── workflows/
│       └── release.yml        ← Builds & uploads to GitHub Releases
│
├── package.json               ← Contains build config
│   └── "build": {
│       "directories": {
│         "output": "release"  ← Where local builds go
│       }
│     }
│
└── dist/                      ← Frontend build (temporary)
```

## 🚀 Releasing Your App

### Step 1: Build Locally (Optional - for testing)
```bash
npm run build:win
```
This creates `release/Asset Manager.exe` locally.

### Step 2: Release to GitHub
```bash
# 1. Update version in package.json
# 2. Commit
git add package.json
git commit -m "Release v1.0.0"
git push

# 3. Create and push version tag
git tag v1.0.0
git push origin v1.0.0
```

### Step 3: GitHub Actions Does the Rest
- ✅ Builds the app
- ✅ Creates GitHub Release
- ✅ Uploads `Asset Manager.exe` to release
- ✅ Makes it available for download

## 📍 Where Users Install/Run the App

### Portable App (Current Setup)
Your app is built as a **portable executable**, which means:
- ✅ No installation required
- ✅ Users can put it anywhere (Desktop, Downloads, Program Files, etc.)
- ✅ Just double-click to run
- ✅ All files stay in the same folder as the .exe

### Recommended Locations for Users
Users can put the app anywhere:
- `C:\Users\Username\Desktop\Asset Manager.exe`
- `C:\Users\Username\Downloads\Asset Manager.exe`
- `C:\Program Files\Asset Manager\Asset Manager.exe`
- Any folder they prefer!

## 🔄 Auto-Update Storage

When the app auto-updates:
- **Updates are downloaded to**: `%APPDATA%\Asset Manager\` (Windows AppData folder)
- **Current app stays where user put it**: The original location doesn't change
- **After update**: App restarts with the new version from the same location

## 📋 Summary

| What | Where |
|------|-------|
| **Build output (local)** | `release/Asset Manager.exe` |
| **Distribution** | GitHub Releases (automatic) |
| **User download** | https://github.com/juntttttttt/AssetManager/releases |
| **User installation** | Anywhere (portable app) |
| **Update source** | GitHub Releases (automatic check) |
| **Update storage** | `%APPDATA%\Asset Manager\` |

## ✅ Next Steps

1. **First Release**:
   ```bash
   # Update version to 1.0.0 in package.json
   git add package.json
   git commit -m "Release v1.0.0"
   git push
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Share with Users**:
   - Give them the GitHub Releases link
   - They download `Asset Manager.exe`
   - They can put it anywhere and run it

3. **Future Updates**:
   - Just push a new version tag
   - Users get notified automatically
   - Updates download and install seamlessly

## 🎉 That's It!

Your app is automatically distributed through GitHub Releases. You don't need to manually upload files or manage distribution - GitHub Actions handles everything!

