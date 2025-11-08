# Auto-Update Setup Guide

This guide explains how to set up automatic updates for your Electron app using GitHub Releases.

## Overview

The app uses `electron-updater` to automatically check for updates from GitHub Releases. When you create a new release on GitHub, users will be notified and can download the update.

## Setup Instructions

### 1. Update Repository Information

Edit `package.json` and replace the placeholders:

```json
{
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
}
```

Replace:
- `YOUR_USERNAME` with your GitHub username
- `YOUR_REPO_NAME` with your repository name

### 2. Create a GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Electron App Releases")
4. Select scopes:
   - `repo` (Full control of private repositories) - if your repo is private
   - `public_repo` - if your repo is public
5. Click "Generate token"
6. Copy the token (you won't see it again!)

### 3. Add GitHub Token to GitHub Actions

The GitHub Actions workflow automatically uses `GITHUB_TOKEN` which is provided by GitHub Actions. No additional setup needed for public repositories!

For private repositories, you may need to configure additional permissions in your workflow.

### 4. How to Release Updates

#### Method 1: Using Git Tags (Recommended)

1. Update the version in `package.json`:
   ```json
   {
     "version": "1.0.1"
   }
   ```

2. Commit and push your changes:
   ```bash
   git add .
   git commit -m "Release v1.0.1"
   git push
   ```

3. Create and push a version tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. GitHub Actions will automatically:
   - Build the app
   - Create a GitHub Release
   - Upload the Windows executable
   - Users will be notified of the update

#### Method 2: Manual Release

1. Build the app locally:
   ```bash
   npm run build:win
   ```

2. Go to your GitHub repository → Releases → "Draft a new release"

3. Create a new tag (e.g., `v1.0.1`) or use an existing tag

4. Upload the built executable from the `release/` folder

5. Click "Publish release"

### 5. How Updates Work for Users

1. **Automatic Check**: The app automatically checks for updates:
   - 5 seconds after startup
   - Every 4 hours while the app is running

2. **Update Available**: When an update is found:
   - A dialog appears asking if the user wants to download
   - User can choose "Download" or "Later"

3. **Download Progress**: While downloading:
   - Progress is shown in the console
   - You can listen to update events in the renderer process

4. **Update Ready**: When download completes:
   - A dialog asks if the user wants to restart now
   - User can choose "Restart Now" or "Later"
   - If "Restart Now" is chosen, the app restarts and installs the update

### 6. Manual Update Check (Optional)

You can add a "Check for Updates" button in your UI by calling:

```typescript
// In your renderer process
const result = await window.electronAPI.invoke('check-for-updates')
if (result.success) {
  console.log('Checking for updates...')
} else {
  console.error('Error:', result.error)
}
```

The update events are automatically sent to the renderer process via IPC:
- `update-checking` - Started checking for updates
- `update-available` - Update is available
- `update-not-available` - No update available
- `update-error` - Error occurred
- `update-download-progress` - Download progress
- `update-downloaded` - Update downloaded and ready

### 7. Development vs Production

- **Development**: Auto-updater is **disabled** when running `npm run dev`
- **Production**: Auto-updater is **enabled** only in packaged builds

### 8. Testing Updates

To test the auto-update system:

1. Build and package your app:
   ```bash
   npm run build:win
   ```

2. Install the built app locally

3. Create a new release on GitHub with a higher version

4. Launch the app - it should check for updates and notify you

### 9. Troubleshooting

#### Updates not being detected

1. Check that your `package.json` has the correct repository URL
2. Verify the GitHub Release exists and has the correct tag format (`v*`)
3. Check that the release has the Windows executable attached
4. Look at the console logs for error messages

#### Build fails in GitHub Actions

1. Check the Actions tab in your GitHub repository
2. Look for error messages in the build logs
3. Ensure all dependencies are correctly listed in `package.json`
4. Verify the workflow file (`.github/workflows/release.yml`) is correct

#### Update download fails

1. Check your internet connection
2. Verify the GitHub Release is accessible
3. Check the console for error messages
4. Ensure the app has write permissions to install updates

### 10. Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes

Example version progression:
- v1.0.0 → v1.0.1 (patch)
- v1.0.1 → v1.1.0 (minor)
- v1.1.0 → v2.0.0 (major)

## Files Modified

- `package.json` - Added repository and publish configuration
- `electron/main.ts` - Added auto-updater setup and IPC handlers
- `.github/workflows/release.yml` - GitHub Actions workflow for automatic releases
- `.github/workflows/build.yml` - GitHub Actions workflow for builds (no release)

## Next Steps

1. Update `package.json` with your GitHub repository information
2. Push your code to GitHub
3. Create your first release using a version tag
4. Test the auto-update functionality

## Additional Resources

- [electron-updater Documentation](https://www.electron.build/auto-update)
- [GitHub Releases API](https://docs.github.com/en/rest/releases/releases)
- [Semantic Versioning](https://semver.org/)

