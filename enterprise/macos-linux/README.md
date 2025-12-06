# Check Extension - Unix Enterprise Deployment (macOS & Linux)

This directory contains the necessary files for deploying the Check Microsoft 365 phishing protection extension in Unix-based enterprise environments, supporting both macOS and Linux distributions.

## Files Overview

### Universal Deployment
- **`deploy.sh`** - Universal deployment script that auto-detects OS and uses appropriate method

### macOS-Specific Files
#### Configuration Profiles (.mobileconfig)
- **`chrome-extension-config.mobileconfig`** - Chrome extension configuration profile for MDM
- **`edge-extension-config.mobileconfig`** - Microsoft Edge extension configuration profile for MDM

#### Deployment Scripts
- **`deploy-macos.sh`** - macOS-specific deployment script for Configuration Profiles and Managed Preferences
- **`verify-policies.sh`** - Script to verify policy installation and troubleshoot issues

### Linux-Specific Files
#### Deployment Script
- **`deploy-linux.sh`** - Linux-specific deployment script for browser policies

### Shared Policy Files (.json)
- **`chrome-managed-policy.json`** - Chrome browser policies (works on both macOS and Linux)
- **`edge-managed-policy.json`** - Microsoft Edge browser policies (works on both macOS and Linux)

## Quick Start

### Universal Deployment (Recommended)
```bash
# Auto-detect OS and deploy
sudo ./deploy.sh install

# Check installation status
sudo ./deploy.sh status

# Remove configuration
sudo ./deploy.sh uninstall

# Show OS detection info
./deploy.sh detect
```

### Platform-Specific Deployment

#### macOS (Configuration Profiles + Managed Preferences)
```bash
# Full deployment
sudo ./deploy-macos.sh install
sudo ./deploy-macos.sh status
sudo ./deploy-macos.sh uninstall

# Manual approach (if automated deployment fails)
# 1. Install configuration profiles manually via System Settings
# 2. Use manual commands for managed preferences:
sudo plutil -convert binary1 chrome-managed-policy.json -o "/Library/Managed Preferences/com.google.Chrome.plist"
sudo plutil -convert binary1 edge-managed-policy.json -o "/Library/Managed Preferences/com.microsoft.Edge.plist"
sudo chown root:wheel "/Library/Managed Preferences/com.google.Chrome.plist"
sudo chown root:wheel "/Library/Managed Preferences/com.microsoft.Edge.plist"

# Verify policies are working
sudo ./verify-policies.sh
```

#### Linux (Browser Policy Files)
```bash
# Linux - Browser policy files in system directories
sudo ./deploy-linux.sh install
sudo ./deploy-linux.sh status
sudo ./deploy-linux.sh uninstall

# Detect available browsers and directories
sudo ./deploy-linux.sh detect
```

### Manual Deployment

#### macOS Configuration Profiles
```bash
# Install Chrome profile
sudo profiles -I -F chrome-extension-config.mobileconfig

# Install Edge profile
sudo profiles -I -F edge-extension-config.mobileconfig

# List installed profiles
sudo profiles -P
```

#### macOS Managed Preferences
```bash
# Create directories
sudo mkdir -p "/Library/Managed Preferences"

# Install Chrome policy
sudo plutil -convert binary1 chrome-managed-policy.json -o "/Library/Managed Preferences/com.google.Chrome.plist"

# Install Edge policy
sudo plutil -convert binary1 edge-managed-policy.json -o "/Library/Managed Preferences/com.microsoft.Edge.plist"

# Set permissions
sudo chown root:wheel "/Library/Managed Preferences/com.google.Chrome.plist"
sudo chown root:wheel "/Library/Managed Preferences/com.microsoft.Edge.plist"
sudo chmod 644 "/Library/Managed Preferences/com.google.Chrome.plist"
sudo chmod 644 "/Library/Managed Preferences/com.microsoft.Edge.plist"
```

#### Linux Browser Policies
```bash
# Chrome/Chromium policies
sudo mkdir -p /etc/opt/chrome/policies/managed
sudo cp chrome-managed-policy.json /etc/opt/chrome/policies/managed/check-extension.json
sudo chmod 644 /etc/opt/chrome/policies/managed/check-extension.json

# Alternative Chrome directories (if needed)
sudo mkdir -p /etc/chromium/policies/managed
sudo cp chrome-managed-policy.json /etc/chromium/policies/managed/check-extension.json

# Microsoft Edge policies
sudo mkdir -p /etc/opt/edge/policies/managed
sudo cp edge-managed-policy.json /etc/opt/edge/policies/managed/check-extension.json
sudo chmod 644 /etc/opt/edge/policies/managed/check-extension.json
```

## Supported Platforms

### macOS
- **macOS 10.13+** (High Sierra and later)
- **Configuration Profiles** for MDM integration
- **Managed Preferences** for system-wide policies
- Compatible with Jamf Pro, Intune, Workspace ONE, etc.

### Linux Distributions
- **Ubuntu/Debian** - APT-based distributions
- **RHEL/CentOS/Fedora** - RPM-based distributions
- **SUSE/openSUSE** - Zypper-based distributions
- **Arch Linux** - Pacman-based distributions
- **FreeBSD** - Uses Linux deployment method

### Browsers Supported
- **Google Chrome** (all platforms)
- **Chromium** (Linux distributions)
- **Microsoft Edge** (all platforms)

## Configuration Settings

All settings are based on the managed schema and include:

### Security Settings
- **`showNotifications`** - Display security notifications (default: true)
- **`enableValidPageBadge`** - Show validation badge on legitimate pages (default: true)
- **`validPageBadgeTimeout`** - Auto-dismiss timeout for valid page badge in seconds (default: 5, set to 0 for no timeout)
- **`enablePageBlocking`** - Enable blocking of malicious pages (default: true)
- **`enableCippReporting`** - Enable CIPP server reporting (default: false)
- **`enableDebugLogging`** - Enable debug logging (default: false)

### CIPP Integration
- **`cippServerUrl`** - CIPP server URL for reporting
- **`cippTenantId`** - Tenant identifier for multi-tenant environments

### Rule Management
- **`customRulesUrl`** - URL for custom detection rules
- **`updateInterval`** - Rule update interval in hours (default: 24)

### Custom Branding
- **`companyName`** - Company name for white labeling
- **`productName`** - Custom extension name
- **`supportEmail`** - Support contact email
- **`primaryColor`** - Primary theme color (hex format)
- **`logoUrl`** - Company logo URL

## Extension IDs

- **Chrome**: `benimdeioplgkhanklclahllklceahbe`
- **Microsoft Edge**: `knepjpocdagponkonnbggpcnhnaikajg`

## Enterprise Features

### Force Installation
Both configurations include force installation settings that:
- Automatically install the extension for all users
- Prevent users from disabling the extension
- Enable operation in incognito/private browsing mode
- Grant all necessary permissions automatically

### Policy Management
The deployment supports:
- **macOS**: Configuration Profiles + Managed Preferences
- **Linux**: System-wide browser policy files
- Centralized configuration management
- Real-time policy updates
- Integration with existing MDM/configuration management solutions

## MDM Integration

### macOS MDM Compatibility
- **Jamf Pro** - Import .mobileconfig files directly
- **Microsoft Intune** - Convert to .intunemac format
- **VMware Workspace ONE** - Upload as custom settings
- **Kandji** - Use as custom profiles
- **SimpleMDM** - Import configuration profiles

### Linux Configuration Management
- **Ansible** - Use file and template modules
- **Puppet** - Deploy with file resources
- **Chef** - Use cookbook file resources
- **SaltStack** - Deploy with file.managed states
- **Manual** - Copy JSON files to policy directories

## Troubleshooting

### Universal
```bash
# Show OS detection and available methods
./deploy.sh detect

# Check installation status
sudo ./deploy.sh status
```

### macOS-Specific
```bash
# Check profiles
sudo profiles -P | grep cyberdrain

# Check managed preferences
plutil -p "/Library/Managed Preferences/com.google.Chrome.plist"
plutil -p "/Library/Managed Preferences/com.microsoft.Edge.plist"
```

### Linux-Specific
```bash
# Check Chrome policies
ls -la /etc/opt/chrome/policies/managed/
cat /etc/opt/chrome/policies/managed/check-extension.json

# Check Edge policies
ls -la /etc/opt/edge/policies/managed/
cat /etc/opt/edge/policies/managed/check-extension.json

# Check alternative directories
ls -la /etc/chromium/policies/managed/
ls -la /etc/microsoft-edge/policies/managed/
```

### Common Issues
1. **Permission denied** - Ensure running with sudo/administrator privileges
2. **Profile installation failed (macOS)** - Check .mobileconfig syntax and permissions
3. **Policy not applied** - Restart browser after installation, check file permissions
4. **Extension not loading** - Verify extension IDs are correct, check browser logs
5. **Browser not detected (Linux)** - Install browsers first, check alternative directories

### Logs and Debugging
- **macOS System logs**: `sudo log show --predicate 'process == "profiles"' --last 1h`
- **Linux System logs**: `journalctl -u browser-service --since "1 hour ago"`
- **Browser logs**: Check extension developer tools and browser console
- **File permissions**: Ensure policy files are readable by browser processes

## Customization

Before deployment, edit the JSON files to customize:
1. **CIPP Integration** - Set `cippServerUrl` and `cippTenantId`
2. **Custom Rules** - Set `customRulesUrl` to your rules endpoint
3. **Branding** - Configure company name, colors, and logo URL
4. **Security Settings** - Adjust notification and blocking preferences
5. **Debug Mode** - Enable `enableDebugLogging` for troubleshooting

## Security Considerations

- Policy files contain extension configuration only (no sensitive data)
- All settings can be centrally managed and updated
- Private browsing mode is enabled by default for full protection
- Extension requires minimal permissions for threat detection
- System-wide deployment ensures consistent security posture
- Policies can be applied per-user or system-wide depending on deployment method

## Platform-Specific Notes

### macOS
- Configuration Profiles provide the most robust deployment method
- Managed Preferences work for organizations without full MDM
- Requires administrator privileges for system-wide deployment
- Compatible with existing Apple enterprise management tools

### Linux
- Browser policy files provide system-wide configuration
- Multiple directory locations supported for different distributions
- Works with both installed and portable browser versions
- Integrates with existing Linux configuration management tools

## Support

For enterprise deployment assistance:
- **Universal**: Use `./deploy.sh detect` to identify deployment options
- **macOS**: Check MDM documentation for Configuration Profile deployment
- **Linux**: Verify browser installation and policy directory permissions
- **Customization**: Edit JSON files according to managed schema documentation
- **Integration**: Contact CyberDrain support for specific enterprise requirements
