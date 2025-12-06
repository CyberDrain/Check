# Branding

The Branding section lets you customize how Check looks, especially useful for organizations that want consistent branding.

{% hint style="info" %}
**For individual users**

Most individual users can skip this section unless they want to personalize the extension.
{% endhint %}

## Overview

All user-facing components (suspicious login banner, blocked page, extension popup, and options page) use the same branding configuration. Your custom branding will be displayed consistently across:

- **Suspicious Login Banner** - Warning banner shown on potentially malicious sites
- **Blocked Page** - Full-page block screen for confirmed threats
- **Extension Popup** - Extension icon popup
- **Options Page** - Extension settings page

## Company Information

{% hint style="warning" %}
#### What if Settings Are Not Visible?

If some settings do not appear on your version, it means your organization's IT department has set these for you. This is normal in business environments - your IT team wants to make sure everyone has the same security settings. You will also see text indicating that the extension is being managed by policy.
{% endhint %}

### Branding Properties

You can customize the following properties:

1. **Company Name** - Enter your organization's name. This appears in the extension interface and blocked page messages (displayed as "Protected by [Company Name]").
2. **Company URL** - Your company website URL (e.g., `https://yourcompany.com`). Used in extension branding and contact information. *(Firefox: required, Chrome/Edge: optional)*
3. **Product Name** - What you want to call the extension (like "Contoso Security" instead of "Check"). This replaces the default "Check" branding throughout the interface.
4. **Support Email** - Where users should go for help. This email address is used in the "Contact Admin" button when phishing sites are blocked.

## Visual Customization

1. **Primary Color** - Choose a color that matches your brand (hex format, e.g., `#FF5733`). This color is applied to buttons, headers, and other interface elements throughout the extension.
2. **Logo URL** - Link to your company logo or local path (e.g., `https://cdn.example.com/logo.png` or `images/custom-logo.png`). This replaces the default Check logo in the extension popup, options page, and blocked page warnings.

## Live Preview

The branding preview shows you exactly how your customizations will appear to users. Changes are reflected immediately as you modify the settings, showing:

* Your custom logo and company name in the header
* How the primary color affects buttons and interface elements
* The overall visual appearance users will see

## Configuration Methods

### Method 1: Manual Configuration (Options Page)

**Works with:** Chrome, Edge, Firefox

1. Open the extension's Options page
2. Navigate to the "Branding" section
3. Fill in your branding information:
   - Company Name
   - Logo (upload or provide URL)
   - Primary Color
   - Support Email
4. Click "Save"

Your branding will be immediately applied to all components.

### Method 2: Group Policy (GPO) - Chrome & Edge

For enterprise deployments using Windows Group Policy:

1. Create a new GPO or edit an existing one
2. Navigate to: `Computer Configuration > Administrative Templates > Google Chrome > Extensions`
3. Add a policy for the Check extension with the following structure:

```json
{
  "customBranding": {
    "companyName": "Your Company",
    "logoUrl": "https://example.com/logo.png",
    "primaryColor": "#FF5733",
    "supportEmail": "security@example.com"
  }
}
```

4. Apply the policy to target computers
5. The extension will automatically use the enterprise branding on managed devices

### Method 3: Firefox Policies (policies.json)

**Works with:** Firefox only

For Firefox deployments, configure branding through the `policies.json` file:

1. Locate or create the policies file:
   - **Windows:** `%ProgramFiles%\Mozilla Firefox\distribution\policies.json`
   - **macOS:** `/Applications/Firefox.app/Contents/Resources/distribution/policies.json`
   - **Linux:** `/etc/firefox/policies/policies.json`

2. Add the branding configuration under `3rdparty.Extensions`:

```json
{
  "policies": {
    "3rdparty": {
      "Extensions": {
        "check@cyberdrain.com": {
          "customBranding": {
            "companyName": "Your Company",
            "companyURL": "https://yourcompany.com",
            "productName": "Security Extension",
            "supportEmail": "security@example.com",
            "primaryColor": "#FF5733",
            "logoUrl": "https://example.com/logo.png"
          }
        }
      }
    }
  }
}
```

3. Save the file and restart Firefox

**Note:** The Firefox extension ID is `check@cyberdrain.com`

### Method 4: Microsoft Intune - Chrome & Edge

For organizations using Microsoft Intune with Chrome/Edge:

1. Create a new Configuration Profile
2. Select "Custom" configuration
3. Add the branding configuration as a JSON payload:

```json
{
  "customBranding": {
    "companyName": "Your Company",
    "logoUrl": "https://example.com/logo.png",
    "primaryColor": "#FF5733",
    "supportEmail": "security@example.com"
  }
}
```

4. Assign the profile to user or device groups
5. Branding will be applied on enrolled devices

### Method 5: Chrome Enterprise Policy

For Chrome Enterprise customers:

1. Access the Google Admin Console
2. Navigate to: `Devices > Chrome > Apps & Extensions`
3. Select the Check extension
4. Add the branding configuration under "Policy for extensions"
5. Save and publish the policy

### Method 6: Windows Registry (Advanced) - Chrome & Edge

For direct registry configuration with Chrome/Edge:

1. Open Registry Editor
2. Navigate to: `HKLM\Software\Policies\Google\Chrome\3rdparty\extensions\[extension-id]`
3. Create a new key named `customBranding`
4. Add string values for each branding property
5. Restart the browser

## Configuration Priority

When multiple configuration methods are used, they are applied in this order (highest to lowest priority):

1. **Enterprise Policy** (GPO/Intune/Chrome Enterprise/Firefox Policies)
2. **Manual Configuration** (Options page)
3. **Default Configuration** (Built-in defaults)

Enterprise policies always take precedence over manual settings.

## Logo Requirements and Tips

### **Technical requirements:**

* Format: PNG, JPG, or SVG
* Size: 48x48 pixels recommended (maximum 128x128, recommended 200x200px or smaller for enterprise deployments)
* Must be accessible via HTTPS URL

### **Design tips:**

* Use a square logo for best results
* Ensure it looks good on both light and dark backgrounds
* Keep it simple - small logos need to be clear

### **Common logo hosting options:**

* Your company website: `https://yourcompany.com/logo.png`
* Cloud storage: Upload to Google Drive, Dropbox, etc. and get a public link
* Image hosting: Use services like Imgur or similar

## Browser-Specific Notes

### Firefox
- Uses extension ID: `check@cyberdrain.com`
- Configuration is managed through `policies.json` file
- Supports additional `companyURL` property
- Policies file location varies by operating system

### Chrome & Edge
- Configuration through GPO, Intune, or Chrome Enterprise Policy
- Uses Windows Registry for advanced configurations
- Supports standard Chrome extension policy format

## Troubleshooting Branding Issues

### **Logo not showing:**

1. Check that the URL is correct and accessible
2. Try opening the logo URL in a new browser tab
3. Make sure the URL starts with `https://`
4. Verify the image file isn't too large
5. Verify logo URLs are publicly accessible (if using external URL)
6. Check image format (PNG, JPG, SVG supported)
7. Ensure image size is reasonable

### **Colors not applying:**

1. Make sure you clicked "Save Settings"
2. Try refreshing the page
3. Check if your organization has locked branding settings

### **Preview not updating:**

1. Try changing the color slightly and changing it back
2. Refresh the settings page
3. Clear your browser cache if problems persist

### **Branding Not Appearing**
- Verify the configuration is saved correctly
- Check browser console for errors
- Ensure logo URLs are accessible
- Restart the browser after configuration changes

### **Enterprise Policy Not Working**
- Verify the policy is applied to the correct organizational unit
- Check that the extension ID matches your deployment
- Allow 15-30 minutes for policy propagation
- Run `gpupdate /force` on Windows to force policy refresh

## Example Configurations

### **Example 1: Small Business Setup**

```
Company Name: Smith & Associates Law
Product Name: Smith Security
Support Email: it@smithlaw.com
Primary Color: #1f4e79 (professional blue)
Logo URL: https://smithlaw.com/images/logo-small.png
```

### **Example 2: Large Corporation**

```
Company Name: Global Manufacturing Inc.
Product Name: GMI Security Suite
Support Email: cybersecurity@globalmfg.com
Primary Color: #c41e3a (corporate red)
Logo URL: https://assets.globalmfg.com/security/gmi-logo-48.png
```

### **Example 3: Basic Branding (Chrome/Edge)**

```json
{
  "customBranding": {
    "companyName": "Acme Corp",
    "primaryColor": "#00AA00"
  }
}
```

### **Example 4: Full Branding (Chrome/Edge)**

```json
{
  "customBranding": {
    "companyName": "Contoso Corporation",
    "productName": "Contoso Defender",
    "logoUrl": "https://contoso.com/assets/logo.png",
    "primaryColor": "#0078D4",
    "supportEmail": "security@contoso.com"
  }
}
```

### **Example 5: Firefox Policy Example**

```json
{
  "policies": {
    "3rdparty": {
      "Extensions": {
        "check@cyberdrain.com": {
          "customBranding": {
            "companyName": "Contoso Corporation",
            "companyURL": "https://contoso.com",
            "productName": "Contoso Defender",
            "logoUrl": "https://contoso.com/assets/logo.png",
            "primaryColor": "#0078D4",
            "supportEmail": "security@contoso.com"
          }
        }
      }
    }
  }
}
```

## Additional Resources

### Firefox-Specific Documentation
- [Firefox Support Guide](../firefox-support.md)
- [Firefox Deployment Guide](../deployment/firefox-deployment.md)
- Template: `enterprise/firefox/policies.json`

### Chrome/Edge Documentation
- [Chrome/Edge Deployment](../deployment/chrome-edge-deployment-instructions/README.md)
- Schema: `config/managed_schema.json`