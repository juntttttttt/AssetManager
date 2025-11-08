# Icon Files

Place your icon files here:

- `icon.ico` - Windows icon file (required for built app)
- `icon.png` - PNG icon (optional, for reference)
- `icon.svg` - SVG icon (optional, vector format)
- `icon-generator.html` - Interactive icon generator tool

## Quick Start

1. **Open `icon-generator.html`** in your web browser
2. **Customize** your icon (letter, colors, corner radius)
3. **Download** 512x512 or 1024x1024 PNG
4. **Convert** PNG to ICO using https://convertio.co/png-ico/
5. **Save** as `icon.ico` in this directory

## Creating Icons

### Option 1: Use Icon Generator (Recommended)
1. Open `build/icon-generator.html` in your browser
2. Customize the design
3. Download PNG and convert to ICO

### Option 2: Manual Creation
1. Create a square image (512x512 or 1024x1024 pixels)
2. Convert to .ico format using:
   - https://convertio.co/png-ico/
   - https://www.icoconverter.com/
3. Save as `icon.ico` in this directory

### Option 3: Use SVG
1. Edit `icon.svg` to customize
2. Convert SVG to PNG using an online tool
3. Convert PNG to ICO

## Default Icon Design

- **Letter**: A (for Asset Manager)
- **Background**: Blue to Purple gradient
- **Style**: Modern, clean, rounded corners
- **Size**: 512x512 or 1024x1024 pixels

## After Creating Icon

Once you have `build/icon.ico`:
- The icon will be used in the built Electron app
- It will appear in desktop shortcut, taskbar, start menu, and window title bar
- Build the app with `npm run build:win` to see it in action

If no icon is provided, electron-builder will use default Electron icons.
