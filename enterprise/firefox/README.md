# Firefox Enterprise Deployment

This directory contains the Firefox enterprise deployment template for the Check extension.

## File

- **`policies.json`** - Template for Firefox enterprise policy management

## Overview

Firefox uses a `policies.json` file for enterprise extension management. This file controls:
- Extension installation and updates
- Extension configuration (settings, branding, etc.)
- Extension locking (prevent users from disabling)

## Quick Start

1. Copy `policies.json` to the appropriate location for your OS:
   - **Windows**: `%ProgramFiles%\Mozilla Firefox\distribution\policies.json`
   - **macOS**: `/Applications/Firefox.app/Contents/Resources/distribution/policies.json`
   - **Linux**: `/etc/firefox/policies/policies.json`

2. Update the `install_url` with your signed .xpi file location

3. Customize the extension settings in the `3rdparty.Extensions` section

4. Restart Firefox on all target systems

## Installation URL

Before deploying, you need to:
1. Build the Firefox version: `npm run build:firefox`
2. Package and sign the extension through Mozilla Add-ons
3. Host the signed .xpi file on your server
4. Update `install_url` in policies.json with your .xpi URL

## Configuration

The template includes all Check configuration options:

### Force Installation
```json
"Extensions": {
  "Install": ["https://your-server.com/check-extension.xpi"],
  "Locked": ["check@cyberdrain.com"]
}
```

### Extension Settings
All Check settings are configured in the `3rdparty.Extensions.check@cyberdrain.com` section:
- Security notifications
- Page blocking
- CIPP reporting
- Detection rules
- Custom branding
- Webhook integration

See `../../config/managed_schema.json` for the complete settings schema.

## Extension ID

Firefox extension ID: **`check@cyberdrain.com`**

This ID is defined in `manifest.firefox.json` and must match in all policy configurations.

## Complete Documentation

For detailed deployment instructions, see:
- [Firefox Support Guide](../../docs/firefox-support.md)
- [Firefox Deployment Guide](../../docs/deployment/firefox-deployment.md)

## Verification

After deployment, verify the policy is active:
1. Open Firefox
2. Navigate to `about:policies`
3. Check that your policies appear under "Active Policies"
4. Verify the extension is installed at `about:addons`

## Support

For Firefox deployment issues:
- Check file permissions (policies.json must be readable)
- Verify JSON syntax
- Ensure Firefox version is 109+
- Check the Firefox Browser Console for errors
- See troubleshooting section in the [Firefox Deployment Guide](../../docs/deployment/firefox-deployment.md)
