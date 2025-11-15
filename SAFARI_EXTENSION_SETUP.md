# Safari Extension + Deep Link Setup Guide

This guide will help you set up the Safari Web Extension that allows users to import recipes from web pages directly into your Defaff Recipes mobile app.

## Overview

The system consists of two parts:
1. **Safari Web Extension**: Detects recipes on web pages and provides import functionality
2. **React Native App**: Handles deep links to import recipe data

## Quick Start

### 1. Extension Setup
The Safari extension files are located in `/safari-extension/`:
- `manifest.json` - Extension configuration
- `content.js` - Recipe detection logic
- `popup.html/js` - User interface
- `background.js` - Extension coordination

### 2. App Deep Link Configuration
Your app already has the URL scheme configured in `app.json`:
```json
"scheme": "com.alastairblair.recipeparser"
```

The deep link handler has been added to `App.js` and will:
- Listen for URLs like `com.alastairblair.recipeparser://import?data=...`
- Parse the recipe data from the extension
- Display the imported recipe in your app

## Installation Steps

### For Development/Testing

1. **Prepare Extension Icons**:
   ```bash
   cd safari-extension/icons
   # Copy your app logo or create custom icons
   cp ../../assets/images/Logo.png icon-128.png
   # Resize for other sizes (16, 32, 48 pixels)
   ```

2. **Load Extension in Safari**:
   - Open Safari
   - Safari → Settings → Extensions
   - Click "Load Unsigned Extension..."
   - Select the `safari-extension` folder

3. **Test the Extension**:
   - Visit a recipe website (AllRecipes, BBC Good Food, etc.)
   - Look for green badge on extension icon
   - Click extension → "Add to Defaff Recipes"

### For Distribution

#### Option 1: Mac App Store (Recommended)
1. Create an Xcode project for the Safari extension
2. Use Safari Extension Converter or create manually
3. Submit to Mac App Store

#### Option 2: Direct Distribution
1. Sign the extension with Apple Developer certificate
2. Distribute the signed extension file
3. Users install via Safari settings

## How It Works

### Recipe Detection Flow
1. **Content Script** (`content.js`) runs on all web pages
2. **Detects recipes** using multiple methods:
   - JSON-LD structured data (preferred)
   - Microdata markup
   - Heuristic analysis as fallback
3. **Notifies background script** when recipe found
4. **Updates extension badge** to show detection status

### Import Flow
1. **User clicks extension** → popup opens
2. **Shows recipe preview** with title and URL
3. **User clicks "Add to App"** → creates deep link
4. **Opens mobile app** with recipe data
5. **App processes data** and shows imported recipe

### Deep Link Format
```
com.alastairblair.recipeparser://import?data=ENCODED_JSON
```

Where `ENCODED_JSON` contains:
```json
{
  "url": "https://example.com/recipe",
  "recipe": {
    "name": "Recipe Title",
    "ingredients": ["ingredient 1", "ingredient 2"],
    "instructions": ["step 1", "step 2"],
    "prepTime": "15 minutes",
    "cookTime": "30 minutes",
    "servings": "4"
  }
}
```

## Testing

### Test Recipe Sites
These sites typically have good structured data:
- AllRecipes.com
- Food.com
- BBC Good Food
- Serious Eats
- King Arthur Baking

### Debug Checklist
1. **Extension loads**: Check Safari Extensions settings
2. **Detection works**: Badge appears on recipe pages
3. **Popup shows data**: Recipe title and URL display
4. **Deep link works**: App opens when clicking "Add to App"
5. **Recipe imports**: Data appears correctly in app

### Console Debugging
- **Content script logs**: Safari Web Inspector on the page
- **Popup logs**: Web Inspector on extension popup
- **App logs**: React Native debugger or device logs

## Customization

### Modify Recipe Detection
Edit `content.js` to:
- Add support for specific websites
- Improve heuristic detection
- Handle additional recipe formats

### Customize Popup UI
Edit `popup.html` and `popup.js` to:
- Change styling and branding
- Add preview features
- Modify user interface

### Enhance Deep Link Handling
Edit the `handleDeepLink` function in `App.js` to:
- Add validation
- Handle errors gracefully
- Support additional data formats

## Production Considerations

### Security
- Extension only reads public web page data
- No external network requests from extension
- Data only sent to user's own app via local deep links

### Performance
- Content script is lightweight
- Runs only detection logic, no heavy processing
- Lazy loading for popup interface

### Compatibility
- Requires Safari 14+ (macOS Big Sur+)
- iOS 15+ for mobile Safari extensions
- React Native Expo app with Linking support

## Troubleshooting

### Common Issues

**Extension not appearing in Safari**:
- Check Safari version compatibility
- Verify manifest.json syntax
- Reload extension in Safari settings

**Recipe not detected**:
- Check if site has structured data
- View page source for JSON-LD or microdata
- Check console for detection errors

**App not opening**:
- Verify app is installed
- Check URL scheme matches exactly
- Test deep link manually in browser

**Recipe data missing**:
- Some sites have incomplete structured data
- Extension extracts available data only
- Users may need to edit imported recipes

### Getting Help
- Check Safari Developer documentation
- Review React Native Linking documentation
- Test with known working recipe sites
- Use browser developer tools for debugging

## Next Steps

1. **Create proper icons** for the extension
2. **Test on multiple recipe sites** to verify compatibility
3. **Consider universal links** as fallback for iOS
4. **Add error handling** for edge cases
5. **Prepare for App Store submission** if distributing widely