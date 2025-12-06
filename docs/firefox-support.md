# Firefox Support

Check fully supports Firefox 109+ with all the same phishing protection features available in Chrome and Edge. This page covers installation, deployment, and Firefox-specific considerations.

## Quick Start

### Manual Installation (Development/Testing)

1. Clone or download the Check repository
2. Run `npm run build:firefox` to configure the extension for Firefox
3. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on**
5. Select the `manifest.json` file from the repository directory

{% hint style="info" %}
Temporary add-ons are removed when Firefox restarts. For permanent installation, see the Enterprise Deployment section below.
{% endhint %}

### Switching Back to Chrome/Edge

If you need to switch back to Chrome or Edge after building for Firefox:

```bash
npm run build:chrome
```

Alternatively, restore the original manifest from version control:

```bash
git checkout manifest.json
```

## Firefox-Specific Differences

The Firefox version of Check includes several technical differences from the Chrome/Edge version to ensure compatibility:

### Manifest Differences
- **Background Scripts**: Uses `background.scripts` instead of `service_worker`
- **Content Scripts**: Excludes `file:///` protocol (not supported in Firefox)
- **Options Page**: Uses `options_ui` instead of `options_page`
- **Browser Settings**: Includes `browser_specific_settings` with Gecko ID `check@cyberdrain.com`
- **Permissions**: Excludes `identity.email` permission (not needed in Firefox)

### Cross-Browser Compatibility

Check uses a browser polyfill (`scripts/browser-polyfill.js`) to handle API differences between Chrome and Firefox automatically. This ensures that:
- Extension APIs work consistently across browsers
- Code can be written once and work everywhere
- Updates maintain compatibility with all supported browsers

## Enterprise Deployment

### Prerequisites

- Firefox 109 or later
- Administrator access for system-wide deployment
- Extension signed by Mozilla (for permanent installation)

### Deployment Methods

Firefox supports enterprise deployment through the `policies.json` file. This method works on Windows, macOS, and Linux.

#### Windows Deployment

1. Create or edit the policies file at:
   ```
   %ProgramFiles%\Mozilla Firefox\distribution\policies.json
   ```

2. Use the template from `enterprise/firefox/policies.json` in the repository

3. Update the `install_url` to point to your signed .xpi file:
   ```json
   {
     "policies": {
       "Extensions": {
         "Install": ["https://your-server.com/check-extension.xpi"]
       }
     }
   }
   ```

#### macOS/Linux Deployment

1. Create the policies file at:
   - **macOS**: `/Applications/Firefox.app/Contents/Resources/distribution/policies.json`
   - **Linux**: `/etc/firefox/policies/policies.json` or `/usr/lib/firefox/distribution/policies.json`

2. Use the template from `enterprise/firefox/policies.json`

3. Set proper permissions:
   ```bash
   sudo chmod 644 /path/to/policies.json
   ```

### Extension Configuration

Firefox uses the `3rdparty` section in `policies.json` to configure extension settings:

```json
{
  "policies": {
    "3rdparty": {
      "Extensions": {
        "check@cyberdrain.com": {
          "showNotifications": true,
          "enableValidPageBadge": true,
          "enablePageBlocking": true,
          "enableCippReporting": false,
          "cippServerUrl": "",
          "cippTenantId": "",
          "customRulesUrl": "https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/rules/detection-rules.json",
          "updateInterval": 24,
          "urlAllowlist": [],
          "enableDebugLogging": false,
          "customBranding": {
            "companyName": "",
            "productName": "",
            "supportEmail": "",
            "primaryColor": "#F77F00",
            "logoUrl": ""
          },
          "genericWebhook": {
            "enabled": false,
            "url": "https://webhook.example.com/endpoint",
            "events": [
              "detection_alert",
              "page_blocked",
              "threat_detected"
            ]
          }
        }
      }
    }
  }
}
```

See the full configuration schema in `config/managed_schema.json` for all available settings.

For webhook configuration and payload details, see the [Webhook Documentation](webhooks.md).

### Force Installation

To force-install Check and prevent users from disabling it:

```json
{
  "policies": {
    "Extensions": {
      "Install": ["https://your-server.com/check-extension.xpi"],
      "Locked": ["check@cyberdrain.com"]
    },
    "ExtensionSettings": {
      "check@cyberdrain.com": {
        "installation_mode": "force_installed",
        "install_url": "https://your-server.com/check-extension.xpi",
        "default_area": "navbar"
      }
    }
  }
}
```

## Signing and Distribution

### Development Signing

For testing purposes, you can use Firefox's developer mode:
1. Navigate to `about:config`
2. Set `xpinstall.signatures.required` to `false`
3. Load the extension as a temporary add-on

{% hint style="warning" %}
Disabling signature verification is only recommended for development and testing environments.
{% endhint %}

### Production Signing

For production deployment, you need to sign the extension with Mozilla:

1. Create a Mozilla Add-ons account at [addons.mozilla.org](https://addons.mozilla.org)
2. Package your extension:
   ```bash
   npm run build:firefox
   zip -r check-firefox.zip . -x ".*" "node_modules/*" "tests/*" "*.md" "manifest.chrome.json"
   ```
3. Submit to Mozilla for signing (unlisted distribution for enterprise)
4. Download the signed .xpi file
5. Host the .xpi file on your server or use Mozilla's CDN

### Self-Distribution

For enterprise environments, you can self-distribute the signed .xpi:
1. Host the .xpi file on an internal web server
2. Configure `policies.json` with your internal URL
3. Deploy the policies file to managed devices

## Testing Firefox Extension

### Manual Testing

1. Load the extension using the Quick Start instructions
2. Open the test page: `test-extension-loading.html`
3. Verify that all components load correctly:
   - Background scripts initialize
   - Content scripts inject on pages
   - Popup and options pages display correctly

### Testing Detection Rules

1. Visit known phishing test sites (use safe testing environments)
2. Verify that warnings and blocks display correctly
3. Check the extension popup for detection status
4. Review browser console for any errors

### Cross-Browser Testing

When contributing or making changes, always test in both Chrome/Edge and Firefox:

1. Test in Chrome/Edge:
   ```bash
   npm run build:chrome
   # Load in Chrome
   ```

2. Test in Firefox:
   ```bash
   npm run build:firefox
   # Load in Firefox
   ```

3. Verify consistent behavior across browsers
4. Check for Firefox-specific console errors or warnings

## Troubleshooting

### Extension Not Loading

**Problem**: Extension doesn't load or shows errors

**Solutions**:
- Ensure you ran `npm run build:firefox` before loading
- Check that Firefox version is 109 or later
- Look for errors in Browser Console (Ctrl+Shift+J)
- Verify manifest.json has Firefox-specific structure

### Background Scripts Not Working

**Problem**: Background functionality fails in Firefox

**Solutions**:
- Firefox uses `background.scripts` not `service_worker`
- Verify the build script ran successfully
- Check for module loading errors in the Browser Console

### Policies Not Applied

**Problem**: Enterprise policies not taking effect

**Solutions**:
- Verify policies.json is in the correct location for your OS
- Check file permissions (must be readable by Firefox)
- Restart Firefox after adding/modifying policies
- Use `about:policies` to verify policy application
- Check JSON syntax in policies.json

### Extension Removed on Restart

**Problem**: Extension disappears when Firefox restarts

**Solutions**:
- Temporary add-ons are removed on restart - this is expected
- For permanent installation, use enterprise deployment with signed .xpi
- Alternatively, sign the extension through Mozilla's process

### Content Scripts Not Injecting

**Problem**: Content scripts don't run on web pages

**Solutions**:
- Firefox doesn't support `file:///` protocol in content scripts
- Ensure you're testing on `http://` or `https://` URLs
- Check content script permissions in manifest

## Firefox Extension ID

The Firefox extension uses the ID: `check@cyberdrain.com`

This ID is configured in the `browser_specific_settings` section of `manifest.firefox.json` and is required for:
- Enterprise policy management
- Extension configuration
- Add-on signing and distribution

## Support

For Firefox-specific issues:
- Check the [Common Issues](troubleshooting/common-issues.md) guide
- Review Firefox Browser Console for errors
- Verify you're using Firefox 109 or later
- Ensure the extension was built for Firefox using `npm run build:firefox`

For general extension support, see the main [README](../README.md) and [CONTRIBUTING](../CONTRIBUTING.md) guides.
