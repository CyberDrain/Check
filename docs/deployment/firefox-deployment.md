# Firefox Deployment

This guide covers deploying Check to Firefox across different platforms using enterprise policies.

## Overview

Firefox supports centralized extension management through the `policies.json` file. This method works across Windows, macOS, and Linux, making it ideal for enterprise deployments.

## Extension ID

The Check extension for Firefox uses the ID: **`check@cyberdrain.com`**

## Quick Reference

| Platform | Policy File Location |
|----------|---------------------|
| Windows | `%ProgramFiles%\Mozilla Firefox\distribution\policies.json` |
| macOS | `/Applications/Firefox.app/Contents/Resources/distribution/policies.json` |
| Linux (system) | `/etc/firefox/policies/policies.json` |
| Linux (app) | `/usr/lib/firefox/distribution/policies.json` |

## Prerequisites

Before deploying Check to Firefox:

1. **Firefox 109 or later** installed on target systems
2. **Administrator/root access** for system-wide deployment
3. **Signed extension package** (.xpi file) for production deployment
4. **Template policies.json** from `enterprise/firefox/policies.json` in the repository

## Deployment Steps

### 1. Prepare the Extension Package

For production deployment, you need a signed .xpi file:

#### Option A: Mozilla Add-ons Signing (Recommended)

1. Build the Firefox version:
   ```bash
   npm run build:firefox
   ```

2. Package the extension:
   ```bash
   zip -r check-firefox.zip . \
     -x ".*" \
     -x "node_modules/*" \
     -x "tests/*" \
     -x "*.md" \
     -x "manifest.chrome.json"
   ```

3. Submit to [addons.mozilla.org](https://addons.mozilla.org) for signing
4. Download the signed .xpi file
5. Host on your internal server or use Mozilla's CDN

#### Option B: Development Installation

For testing or development:
- Use temporary add-on installation (no signing required)
- Enable unsigned extensions in Firefox developer edition
- Not recommended for production deployments

### 2. Configure policies.json

Create or modify `policies.json` based on the template in `enterprise/firefox/policies.json`:

```json
{
  "policies": {
    "Extensions": {
      "Install": [
        "https://your-server.com/path/to/check-extension.xpi"
      ],
      "Locked": [
        "check@cyberdrain.com"
      ]
    },
    "ExtensionSettings": {
      "check@cyberdrain.com": {
        "installation_mode": "force_installed",
        "install_url": "https://your-server.com/path/to/check-extension.xpi",
        "default_area": "navbar"
      }
    },
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
            "companyName": "Your Company Name",
            "companyURL": "https://yourcompany.com",
            "productName": "Security Extension",
            "supportEmail": "support@yourcompany.com",
            "primaryColor": "#F77F00",
            "logoUrl": "https://yourcompany.com/logo.png"
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

### 3. Deploy by Platform

{% tabs %}
{% tab title="Windows" %}
#### Windows Deployment

**Manual Deployment:**

1. Create the distribution folder if it doesn't exist:
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:ProgramFiles\Mozilla Firefox\distribution"
   ```

2. Copy your configured `policies.json`:
   ```powershell
   Copy-Item policies.json "$env:ProgramFiles\Mozilla Firefox\distribution\policies.json"
   ```

3. Restart Firefox on all systems

**Group Policy Deployment:**

Firefox also supports Windows GPO. For organizations using Active Directory:

1. Download Firefox ADMX templates from Mozilla
2. Import into Group Policy Management
3. Configure extension policies through GPO
4. Link to appropriate OUs

**Intune Deployment:**

Deploy via Microsoft Intune using a PowerShell script:

```powershell
$policiesPath = "$env:ProgramFiles\Mozilla Firefox\distribution"
$policiesFile = "$policiesPath\policies.json"

# Create directory if needed
if (!(Test-Path $policiesPath)) {
    New-Item -ItemType Directory -Force -Path $policiesPath
}

# Download or embed policies.json
$policiesJson = @'
{
  "policies": {
    // Your policies here
  }
}
'@

# Write policies file
$policiesJson | Out-File -FilePath $policiesFile -Encoding UTF8

Write-Output "Firefox policies deployed successfully"
```
{% endtab %}

{% tab title="macOS" %}
#### macOS Deployment

**Manual Deployment:**

1. Create the distribution folder:
   ```bash
   sudo mkdir -p "/Applications/Firefox.app/Contents/Resources/distribution"
   ```

2. Copy your configured `policies.json`:
   ```bash
   sudo cp policies.json "/Applications/Firefox.app/Contents/Resources/distribution/policies.json"
   ```

3. Set appropriate permissions:
   ```bash
   sudo chmod 644 "/Applications/Firefox.app/Contents/Resources/distribution/policies.json"
   sudo chown root:wheel "/Applications/Firefox.app/Contents/Resources/distribution/policies.json"
   ```

**MDM Deployment (Jamf, Intune, etc.):**

Deploy using a script payload:

```bash
#!/bin/bash

POLICIES_DIR="/Applications/Firefox.app/Contents/Resources/distribution"
POLICIES_FILE="$POLICIES_DIR/policies.json"

# Create directory
mkdir -p "$POLICIES_DIR"

# Write policies (embed your policies.json content)
cat > "$POLICIES_FILE" << 'EOF'
{
  "policies": {
    // Your policies here
  }
}
EOF

# Set permissions
chmod 644 "$POLICIES_FILE"
chown root:wheel "$POLICIES_FILE"

echo "Firefox policies deployed successfully"
```

**Configuration Profile (Alternative):**

Some MDM systems support Firefox configuration profiles. Check your MDM documentation for Firefox-specific configuration options.
{% endtab %}

{% tab title="Linux" %}
#### Linux Deployment

**System-Wide Deployment:**

1. Create the policies directory:
   ```bash
   sudo mkdir -p /etc/firefox/policies
   ```

2. Copy your configured `policies.json`:
   ```bash
   sudo cp policies.json /etc/firefox/policies/policies.json
   ```

3. Set proper permissions:
   ```bash
   sudo chmod 644 /etc/firefox/policies/policies.json
   ```

**Distribution-Specific Locations:**

Different Linux distributions may use different paths:

- **Debian/Ubuntu**: `/etc/firefox/policies/policies.json`
- **RHEL/CentOS/Fedora**: `/usr/lib64/firefox/distribution/policies.json`
- **SUSE/openSUSE**: `/usr/lib/firefox/distribution/policies.json`
- **Snap package**: Policies not supported via traditional methods

**Automated Deployment:**

Using Ansible:
```yaml
- name: Deploy Firefox Check Extension Policy
  copy:
    src: policies.json
    dest: /etc/firefox/policies/policies.json
    owner: root
    group: root
    mode: '0644'
  notify: restart firefox
```

Using Puppet:
```puppet
file { '/etc/firefox/policies':
  ensure => directory,
  mode   => '0755',
}

file { '/etc/firefox/policies/policies.json':
  ensure  => file,
  source  => 'puppet:///modules/firefox/policies.json',
  mode    => '0644',
  require => File['/etc/firefox/policies'],
}
```
{% endtab %}
{% endtabs %}

## Configuration Options

All Check configuration options are available through the `3rdparty.Extensions` section of policies.json.

### Security Settings

```json
{
  "showNotifications": true,           // Display detection notifications
  "enableValidPageBadge": true,        // Show badge on legitimate sites
  "enablePageBlocking": true,          // Block confirmed phishing sites
  "enableDebugLogging": false          // Enable debug logging
}
```

### CIPP Integration

```json
{
  "enableCippReporting": true,
  "cippServerUrl": "https://cipp.yourcompany.com",
  "cippTenantId": "your-tenant-id"
}
```

### Detection Rules

```json
{
  "customRulesUrl": "https://your-server.com/detection-rules.json",
  "updateInterval": 24,                // Hours between rule updates
  "urlAllowlist": [                    // Domains to never flag
    "trusted-domain.com"
  ]
}
```

### Custom Branding

```json
{
  "customBranding": {
    "companyName": "Your Company",
    "productName": "Security Extension",
    "supportEmail": "support@yourcompany.com",
    "primaryColor": "#F77F00",
    "logoUrl": "https://yourcompany.com/logo.png"
  }
}
```

### Generic Webhook

Configure a webhook to receive detection events:

```json
{
  "genericWebhook": {
    "enabled": true,
    "url": "https://webhook.example.com/endpoint",
    "events": [
      "detection_alert",
      "page_blocked",
      "threat_detected",
      "rogue_app_detected"
    ]
  }
}
```

**Available Event Types:**
- `detection_alert` - General phishing detection events
- `false_positive_report` - User-submitted false positive reports
- `page_blocked` - Page blocking events
- `rogue_app_detected` - OAuth rogue application detection
- `threat_detected` - General threat detection events
- `validation_event` - Legitimate page validation events

For webhook payload schema and implementation details, see the [Webhook Documentation](../webhooks.md).

For all available options, see `config/managed_schema.json` in the repository.

## Verification

### Check Policy Application

After deployment, verify policies are applied:

1. Open Firefox
2. Navigate to `about:policies`
3. Verify that your policies appear under "Active Policies"
4. Check for any error messages

### Verify Extension Installation

1. Navigate to `about:addons`
2. Confirm Check extension is installed
3. Verify it shows as "Managed by your organization"
4. Check that users cannot disable or remove it (if locked)

### Test Functionality

1. Visit a test phishing site
2. Verify the extension detects and blocks/warns appropriately
3. Check the extension popup for status
4. Test branding appears correctly

## Updating the Extension

### Update Process

When a new version is released:

1. Build and sign the new version
2. Upload to your distribution server
3. Update the `install_url` in policies.json if the URL changed
4. Firefox will automatically update the extension based on the update manifest

### Force Immediate Update

To force an immediate update:

1. Remove the extension from `policies.json`
2. Push the updated policy (Firefox will remove the extension)
3. Re-add the extension with the new URL
4. Push the updated policy again

## Troubleshooting

### Policies Not Applied

**Check these items:**

1. **File location**: Verify policies.json is in the correct path for your OS
2. **File permissions**: Must be readable by Firefox (644 recommended)
3. **JSON syntax**: Validate your JSON at jsonlint.com
4. **Firefox restart**: Policies apply on Firefox startup
5. **about:policies**: Check for error messages

### Extension Not Installing

**Common causes:**

1. **Unsigned extension**: Production deployments require signed .xpi
2. **Unreachable URL**: Verify the install_url is accessible
3. **Network restrictions**: Check firewall/proxy settings
4. **Firefox version**: Ensure Firefox 109+

### Configuration Not Working

**Verify:**

1. Extension ID matches: `check@cyberdrain.com`
2. Settings are in the `3rdparty.Extensions` section
3. JSON formatting is correct
4. Firefox was restarted after policy deployment

### Users Can Still Disable Extension

**Ensure:**

1. Extension is in the `Locked` array
2. `installation_mode` is set to `force_installed`
3. Policies.json was properly deployed
4. Firefox has been restarted since deployment

## Removal

To remove the Check extension:

### Option 1: Update policies.json

Remove the extension from Install and ExtensionSettings:

```json
{
  "policies": {
    "Extensions": {
      "Uninstall": ["check@cyberdrain.com"]
    }
  }
}
```

### Option 2: Delete policies.json

Remove the entire policies file (will remove all managed extensions and policies).

## Best Practices

1. **Test First**: Deploy to a pilot group before organization-wide rollout
2. **Version Control**: Keep policies.json in version control
3. **Monitor Logs**: Check Firefox logs during initial deployment
4. **Document Changes**: Record configuration changes and reasons
5. **Update Regularly**: Keep the extension updated for latest protections
6. **Validate JSON**: Always validate policies.json syntax before deployment

## Support Resources

- **Template**: `enterprise/firefox/policies.json`
- **Schema**: `config/managed_schema.json`
- **Firefox Policies**: [Mozilla Policy Documentation](https://github.com/mozilla/policy-templates)
- **General Support**: See [Firefox Support](../firefox-support.md)

## Additional Resources

- [Firefox Enterprise Support](https://support.mozilla.org/en-US/products/firefox-enterprise)
- [Firefox Policy Templates](https://github.com/mozilla/policy-templates)
- [Enterprise Information for IT](https://support.mozilla.org/en-US/kb/enterprise-information-it)
