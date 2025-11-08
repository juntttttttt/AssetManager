# Fix GitHub Authentication Error (403 Permission Denied)

## Problem
You're getting: `Permission to juntttttttt/AssetManager.git denied to wiettttttttt`

This means Git is using credentials for the wrong GitHub account.

## Solution: Clear Cached Credentials

### Method 1: Windows Credential Manager (Easiest)

1. **Open Windows Credential Manager:**
   - Press `Win + R`
   - Type: `control /name Microsoft.CredentialManager`
   - Press Enter

2. **Go to "Windows Credentials"**

3. **Find and remove GitHub credentials:**
   - Look for entries like `git:https://github.com`
   - Click on each one
   - Click "Remove"

4. **Try pushing again:**
   ```bash
   git push -u origin master
   ```
   - When prompted for username, enter: `juntttttttt`
   - When prompted for password, use a **Personal Access Token** (see below)

### Method 2: Use Personal Access Token

1. **Create a Personal Access Token:**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Name: "Git Push"
   - Select scope: `repo` (Full control)
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again!)

2. **Push using the token:**
   ```bash
   git push -u origin master
   ```
   - Username: `juntttttttt`
   - Password: **Paste your Personal Access Token** (not your GitHub password)

### Method 3: Use SSH (More Secure)

1. **Generate SSH key (if you don't have one):**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```
   - Press Enter to accept default location
   - Enter a passphrase (optional)

2. **Copy your public key:**
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
   - Or on Windows: `type %USERPROFILE%\.ssh\id_ed25519.pub`

3. **Add SSH key to GitHub:**
   - Go to: https://github.com/settings/keys
   - Click "New SSH key"
   - Paste your public key
   - Click "Add SSH key"

4. **Change remote to SSH:**
   ```bash
   git remote set-url origin git@github.com:juntttttttt/AssetManager.git
   ```

5. **Push:**
   ```bash
   git push -u origin master
   ```

## Quick Fix (Try This First)

1. Open Windows Credential Manager (see Method 1 above)
2. Remove all GitHub credentials
3. Run:
   ```bash
   git push -u origin master
   ```
4. When prompted:
   - Username: `juntttttttt`
   - Password: Use a Personal Access Token (create one at https://github.com/settings/tokens)

## Verify Your Remote

Make sure your remote URL is correct:
```bash
git remote -v
```

Should show:
```
origin  https://github.com/juntttttttt/AssetManager.git (fetch)
origin  https://github.com/juntttttttt/AssetManager.git (push)
```

If it's wrong, fix it:
```bash
git remote set-url origin https://github.com/juntttttttt/AssetManager.git
```

