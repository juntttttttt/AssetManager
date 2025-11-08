# Quick Auto-Update Guide

## 🚀 Quick Setup (3 Steps)

### 1. Update `package.json`

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` in `package.json`:

```json
"repository": {
  "type": "git",
  "url": "https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git"
},
"build": {
  "publish": {
    "provider": "github",
    "owner": "YOUR_USERNAME",
    "repo": "YOUR_REPO_NAME"
  }
}
```

### 2. Initialize Git (if not already done)

```bash
# Initialize git repository (if not already initialized)
git init

# Check status
git status
```

### 3. Push to GitHub

```bash
# Add all changes
git add .

# Commit with a descriptive message
git commit -m "Setup auto-update system and initial release"

# Add remote (replace YOUR_USERNAME and YOUR_REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Or if remote already exists, update it:
# git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Check your remote:
git remote -v

# Push to GitHub
git push -u origin master
# Or if using 'main' branch:
# git push -u origin main
```

**Note**: 
- If you haven't created a GitHub repository yet, create one at https://github.com/new
- Make sure to replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name
- If you get authentication errors, you may need to set up a Personal Access Token or SSH keys

### 4. Create a Release

When you want to release an update:

1. Update version in `package.json` (e.g., `"version": "1.0.1"`)
2. Commit and push
3. Create a tag: `git tag v1.0.1 && git push origin v1.0.1`
4. GitHub Actions will automatically build and create a release!

## 📦 How It Works

1. **Automatic**: App checks for updates on startup and every 4 hours
2. **User Choice**: Users are asked if they want to download updates
3. **Easy Install**: Updates install automatically when the app restarts

## 🔄 Releasing Updates

### Option A: Automatic (Recommended)
```bash
# 1. Update version in package.json
# 2. Commit
git commit -am "Release v1.0.1"
git push

# 3. Create and push tag
git tag v1.0.1
git push origin v1.0.1

# GitHub Actions will automatically:
# - Build the app
# - Create a GitHub Release
# - Upload the executable
```

### Option B: Manual
1. Build locally: `npm run build:win`
2. Go to GitHub → Releases → Draft a new release
3. Upload the `.exe` from the `release/` folder
4. Publish the release

## ✅ That's It!

Your app will now automatically:
- Check for updates from GitHub Releases
- Notify users when updates are available
- Download and install updates with user permission

## 📚 Full Documentation

See `AUTO_UPDATE_SETUP.md` for detailed information and troubleshooting.

