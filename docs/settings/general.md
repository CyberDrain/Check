---
description: This is where you control the main features of Check.
---

# General

## Extension Settings

### **Enable Page Blocking**

This is Check's main job - blocking dangerous websites. When this is turned on (which we recommend), Check will stop you from visiting fake Microsoft login pages and show you a warning instead. There are times you need to disable the checkbox for testing purposes. Removing this checkbox removes most of your protection so it's recommended to leave this setting enabled.

### Enable CIPP Reporting

CIPP is a system that IT professionals use to monitor security across multiple organizations. Enabling CIPP monitoring allows you to send detection information from Check directly to CIPP, thus allowing you to alert and report on what's happening with your endpoints. When enabled, you would configure the CIPP Server URL and Tenant ID/Domain below.

View CIPP reporting activity in the [Activity Logs](activity-logs.md) section.

### **CIPP Server URL**

Enter the base URL of your CIPP server for reporting Microsoft 365 logon detections. This should be the full URL to your CIPP instance (e.g., `https://your-cipp-server.com`). This field is only active when CIPP Reporting is enabled.

### **Tenant ID/Domain**

Enter your tenant identifier to include with CIPP alerts for multi-tenant environments. You can use either your tenant GUID or your primary domain (e.g., `contoso.onmicrosoft.com` or the tenant GUID). This helps CIPP identify which tenant the alert belongs to when managing multiple clients.

{% hint style="info" %}
Currently, CIPP displays these alerts in the logbook. Future updates to CIPP are planned to provide additional functionality. Keep an eye on the CIPP release notes for more updates!

You can monitor CIPP reporting status and activity in [Activity Logs](activity-logs.md).
{% endhint %}

### **False Positive Webhook URL**

This setting allows you to configure a webhook endpoint that receives false positive reports from users. When configured, a "Report False Positive" button will appear on blocked pages, allowing users to report when Check has incorrectly blocked a legitimate website.

Enter the full URL to your webhook endpoint (e.g., `https://your-server.com/api/false-positive`). When a user clicks the "Report False Positive" button, Check will send a POST request with comprehensive detection data to help you review and improve your detection rules.

#### Webhook Payload Structure

Your webhook endpoint will receive a POST request with `Content-Type: application/json` containing the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp when the report was submitted |
| `reportType` | string | Always "false_positive" |
| `blockedUrl` | string | The defanged URL that was blocked (colons replaced with `[:]`) |
| `blockReason` | string | User-facing explanation for why the page was blocked |
| `userAgent` | string | Complete browser user agent string |
| `browserInfo` | object | Browser environment details (see below) |
| `screenResolution` | object | Display information (see below) |
| `detectionDetails` | object | Complete detection data (see below) |
| `extensionVersion` | string | Version of Check that generated the report |

**browserInfo object:**
- `platform` - Operating system (e.g., "Linux x86_64", "Win32", "MacIntel")
- `language` - Browser language setting (e.g., "en-US")
- `vendor` - Browser vendor (e.g., "Google Inc.")
- `cookiesEnabled` - Boolean indicating if cookies are enabled
- `onLine` - Boolean indicating network connectivity status

**screenResolution object:**
- `width` - Screen width in pixels
- `height` - Screen height in pixels
- `availWidth` - Available screen width (excluding taskbars)
- `availHeight` - Available screen height (excluding taskbars)
- `colorDepth` - Color depth in bits (e.g., 24)

**detectionDetails object:**
- `url` - Original URL (non-defanged)
- `score` - Legitimacy score assigned by detection engine
- `threshold` - Threshold value that triggered the block
- `reason` - Detailed technical reason for blocking
- `pageTitle` - Title of the blocked page
- `timestamp` - When the page was blocked
- `threats` - Array of threat objects with `id`, `type`, `description`, and `severity`
- `phishingIndicators` - Array of specific indicators that triggered detection
- Additional fields depending on detection method used

#### Complete Payload Example

```json
{
  "timestamp": "2025-11-05T21:30:00.000Z",
  "reportType": "false_positive",
  "blockedUrl": "https[:]//example[.]com/login",
  "blockReason": "This website looks like it has tried to steal your login credentials, to prevent you from logging in we've blocked access.",
  "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "browserInfo": {
    "platform": "Linux x86_64",
    "language": "en-US",
    "vendor": "Google Inc.",
    "cookiesEnabled": true,
    "onLine": true
  },
  "screenResolution": {
    "width": 1920,
    "height": 1080,
    "availWidth": 1920,
    "availHeight": 1040,
    "colorDepth": 24
  },
  "detectionDetails": {
    "url": "https://example.com/login",
    "score": 42,
    "threshold": 50,
    "reason": "Multiple phishing indicators detected: score 42/50 (3 phishing indicators)",
    "pageTitle": "Sign In - Example Services",
    "timestamp": "2025-11-05T21:29:45.000Z",
    "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
    "threats": [
      {
        "id": "phi_suspicious_domain",
        "type": "domain_analysis",
        "description": "Domain closely resembles microsoft.com",
        "severity": "high"
      },
      {
        "id": "phi_fake_login_form",
        "type": "form_analysis",
        "description": "Login form mimics Microsoft 365 sign-in",
        "severity": "medium"
      }
    ],
    "phishingIndicators": [
      {
        "id": "phi_suspicious_domain",
        "description": "Domain closely resembles microsoft.com",
        "severity": "high"
      },
      {
        "id": "phi_fake_login_form",
        "description": "Login form mimics Microsoft 365 sign-in",
        "severity": "medium"
      },
      {
        "id": "phi_suspicious_title",
        "description": "Page title suggests Microsoft login",
        "severity": "low"
      }
    ]
  },
  "extensionVersion": "1.0.0"
}
```

#### Webhook Requirements

Your webhook endpoint should:
1. Accept POST requests with `Content-Type: application/json`
2. Respond with HTTP status codes:
   - `200 OK` - Report successfully received
   - `4xx` - Client error (user will see error message)
   - `5xx` - Server error (user will see error message)
3. Respond within 30 seconds to avoid timeout
4. Use HTTPS to protect sensitive detection data in transit

{% hint style="info" %}
**Usage Notes:**
- Leave this field empty if you don't want to enable false positive reporting
- The "Report False Positive" button only appears when this webhook URL is configured
{% endhint %}

## User Interface

### **Show Notifications**

When Check blocks a dangerous website or finds something suspicious, it can show you a small popup message to let you know what's going on. We recommend leaving this setting enabled

### **Show Valid Page Badge**

This adds a small green checkmark to real Microsoft login pages. This feature is optional.

### **Valid Page Badge Timeout**

This setting controls how long the "Verified Microsoft Domain" badge stays visible on legitimate Microsoft login pages before automatically dismissing.

- **Set to 0**: Badge stays visible until you manually dismiss it (no timeout)
- **Set to 1-300 seconds**: Badge automatically disappears after the specified number of seconds
- **Default**: 5 seconds

This allows you to customize the badge experience based on your preferences. If you want to see the badge every time you visit a Microsoft login page, set it to 0. If you prefer it to disappear quickly, use a smaller number like 3-5 seconds.

{% hint style="warning" %}
#### What if Settings Are Not Visible?

If some settings do not appear on my version, it means your organization's IT department has set these for you. This is normal in business environments - your IT team wants to make sure everyone has the same security settings. You will also see text indicating that the extension is being managed by policy.
{% endhint %}
