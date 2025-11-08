# Roblox Mass Uploader

A modern desktop application for mass uploading Roblox audios and decals using Open Cloud API keys and cookies.

## Features

- 🎵 **Audio Upload** - Upload multiple audio files using Open Cloud API
- 🖼️ **Decal Upload** - Upload multiple decal images with cookie authentication
- 📊 **Asset Management** - View all uploaded audios and decals
- 🛡️ **Moderation Check** - Check moderation status of any asset by ID
- 👑 **Owner Dashboard** - Delete inappropriate content (owner access)

## Tech Stack

- **Electron** - Desktop application framework
- **React** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Navigation

## Installation

1. Install dependencies:
```bash
npm install
```

2. Run in development mode:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Configuration

1. Open the app and click "Settings" on the Upload page
2. Enter your Open Cloud API key (required for all uploads)
3. Enter your Roblox cookie (required for decal uploads)
4. Optionally enter your Universe ID

## Usage

### Upload Assets
- Navigate to the Upload page
- Select Audio or Decal type
- Choose files to upload
- Click Upload

### View Assets
- Use the Audios or Decals pages to view all uploaded assets
- Search by name or asset ID

### Check Moderation
- Go to the Moderation page
- Enter an asset ID
- Select the asset type
- Click "Check Status"

### Owner Dashboard
- Access the Owner page to manage all assets
- Delete inappropriate content
- Filter by type or search

## Notes

- This app stores upload history in localStorage
- Make sure to keep your API keys and cookies secure
- The app uses Roblox Open Cloud API for audio uploads
- Decal uploads require a valid Roblox cookie

## License

**Proprietary - All Rights Reserved**

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without the express written permission of the copyright holder.

See LICENSE file for full terms.

