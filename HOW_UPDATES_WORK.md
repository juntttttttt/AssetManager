# How Auto-Updates Work

## ✅ Yes, Your App Will Auto-Update!

When you release a new version on GitHub, users will automatically get notified and can update their app.

## How It Works

### 1. **You Release a New Version**

When you want to release an update:

```bash
# 1. Update version in package.json (e.g., "1.0.1")
# 2. Commit and push
git add package.json
git commit -m "Release v1.0.1"
git push

# 3. Create and push a version tag
git tag v1.0.1
git push origin v1.0.1
```

**GitHub Actions will automatically:**
- Build your app
- Create a GitHub Release
- Upload the Windows executable (.exe)

### 2. **App Checks for Updates**

Your app automatically checks for updates:
- **On startup** (5 seconds after app opens)
- **Every 4 hours** (while app is running)

The app checks GitHub Releases for your repository (`juntttttttt/AssetManager`).

### 3. **Users Get Notified**

When a new version is found:
1. **Dialog appears**: "Update Available - A new version (X.X.X) is available!"
2. **User chooses**: "Download" or "Later"
3. **If user clicks "Download"**:
   - Update downloads in background
   - Progress bar shows download status
   - When complete: "Update Ready - Restart Now or Later"

### 4. **User Installs Update**

When update is downloaded:
- User can click "Restart Now" to install immediately
- Or click "Later" and it will install when they quit the app
- App restarts with the new version

## Update Flow Diagram

```
You Release v1.0.1
    ↓
GitHub Actions builds & creates release
    ↓
User opens app (or 4 hours pass)
    ↓
App checks GitHub Releases
    ↓
New version found! (v1.0.1 > v1.0.0)
    ↓
Dialog: "Update Available!"
    ↓
User clicks "Download"
    ↓
Update downloads (shows progress)
    ↓
Dialog: "Update Ready! Restart Now?"
    ↓
User clicks "Restart Now"
    ↓
App restarts with v1.0.1 ✅
```

## Important Notes

### ✅ What Works:
- **Automatic checking** - App checks for updates automatically
- **User-friendly** - Users get notified and can choose when to update
- **Seamless installation** - Updates install when app restarts
- **Version comparison** - Only notifies if new version is higher

### ⚠️ Requirements:
- **Public repository** - Updates only work if repo is public (users can't authenticate to private repos)
- **Version tags** - Must create version tags (v1.0.1, v2.0.0, etc.)
- **GitHub Releases** - Must publish releases on GitHub (automatic with GitHub Actions)

### 📝 Version Format:
- Use semantic versioning: `1.0.0`, `1.0.1`, `1.1.0`, `2.0.0`
- Must be higher than current version
- Electron-updater compares versions automatically

## Testing Updates

### In Development:
- Auto-updater is **disabled** in development mode
- You need to build the app (`npm run build:win`) to test updates

### In Production:
- Auto-updater is **enabled** in built apps
- Users will automatically check for updates

## Example: Releasing v1.0.1

```bash
# 1. Update package.json
# Change: "version": "1.0.0" → "version": "1.0.1"

# 2. Commit
git add package.json
git commit -m "Release v1.0.1"
git push

# 3. Create tag and push
git tag v1.0.1
git push origin v1.0.1

# 4. GitHub Actions automatically:
#    - Builds the app
#    - Creates GitHub Release v1.0.1
#    - Uploads AssetManager.exe

# 5. Users will see update notification next time they open the app (or within 4 hours)
```

## Manual Update Check

Users can also manually check for updates from the Settings page (if you add that feature).

## Summary

**Yes, your app WILL auto-update!** 

- ✅ You release a new version → GitHub Actions builds it
- ✅ Users open app → App checks for updates automatically
- ✅ New version found → Users get notified
- ✅ Users download → Update installs on restart

The whole process is automatic once you push a version tag!

