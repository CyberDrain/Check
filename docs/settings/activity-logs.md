# Activity Logs

## Controls and Configuration

The Activity Logs show you everything Check has been doing to protect you. Here's how to use this information effectively.

## Debug and Developer Settings

### **Enable Debug Logging**

When enabled, Check logs additional detail about page scans, rule evaluations, and internal operations. By default, Check only logs blocked pages and security events. Enable debug logging when:

- Troubleshooting detection issues
- Working with support to diagnose problems
- Investigating false positives or missed detections

**Important:** Debug logging increases storage usage and should be disabled after troubleshooting.

### **Developer Mode**

Enables additional console logging visible in the browser's Developer Tools. This provides real-time information about Check's operations for advanced troubleshooting.

### **Simulate Enterprise Policy Mode (Dev Only)**

This development-only feature simulates how the extension behaves when managed by enterprise policies. It is useful for administrators testing policy deployments or understanding the end-user experience under policy management.

## Log Filtering and Management

### **Event Type Filter**

Filter logs by event type to focus on specific activities:

- **All Events** - Shows everything Check has logged
- **Security Events** - Threats detected, pages blocked, warnings issued
- **URL Access** - Pages Check has analyzed (requires debug logging)
- **Threats Detected** - Only shows actual threats found and blocked
- **Page Scans** - Detailed scanning activity (requires debug logging)
- **Debug Events** - Internal operations and detailed analysis (requires debug logging)

### **Log Actions**

- **Refresh** - Reload the current logs from storage
- **Clear Logs** - Permanently delete all stored logs (cannot be undone)
- **Export Logs** - Download logs as a JSON file for support or analysis

## Reading Your Logs <a href="#reading-your-logs" id="reading-your-logs"></a>

When you open the Activity Logs section, you'll see a table with recent activity. Here's what each column means:

- **Timestamp** - When the event happened
- **Event Type** - What kind of activity (like "Threat Blocked" or "Page Scanned")
- **URL/Domain** - Which website was involved
- **Threat Level** - How dangerous it was (None, Low, Medium, High, Critical)
- **Action Taken** - What Check did about it
- **Details** - A summary of what happened

Additionally, clicking a row allows you to review detailed information about the event and the criteria used to determine the threat level.

{% hint style="info" %}
By default, Check only logs blocked pages. If you want to show valid login pages, check `Enable Debug Logging`.
{% endhint %}

### Understanding Common Log Entries <a href="#understanding-common-log-entries" id="understanding-common-log-entries"></a>

**"Page Scanned" with Threat Level "None"**

- This is normal—Check scanned a page and found it safe
- You'll see lots of these for legitimate websites

**"Threat Blocked" with Threat Level "High"**

- Check found a dangerous page and blocked it
- This is Check protecting you from a real threat

**"Legitimate Access" with Threat Level "None"**

- Check verified this was a real Microsoft login page
- You can trust this page with your credentials

### Investigating Suspicious Activity <a href="#investigating-suspicious-activity" id="investigating-suspicious-activity"></a>

If you think something suspicious happened:

1. **Look for recent "Threat Blocked" entries**
2. **Click on the entry to expand details**
3. **Check the URL** - Does it look like a site you tried to visit?
4. **Note the time** - Does it match when you had problems?

**Example Investigation:**

You tried to log in to Office 365 but were blocked. The logs show:

* **Timestamp:** 2024-01-15 14:30:22
* **Event Type:** Threat Blocked
* **URL:** office365-login-secure.com (suspicious domain)
* **Threat Level:** High
* **Details:** Phishing page impersonating Microsoft login

This shows that Check correctly blocked a fake Office 365 page.

### Configuring Log Detail Level <a href="#configuring-log-detail-level" id="configuring-log-detail-level"></a>

**For regular users:**

- Leave "Enable Debug Logging" unchecked
- Leave "Enable Developer Console Logging" unchecked
- Leave "Simulate Enterprise Policy Mode (Dev Only)" unchecked

**For troubleshooting or working with support:**

1. Check "Enable Debug Logging"
2. Reproduce the problem
3. Export logs (see below)
4. Send logs to support (see [Common Issues](../troubleshooting/common-issues.md) for additional troubleshooting steps)
5. Uncheck debug logging when done (saves storage space)

**For admins wanting to simulate the end-user experience:**

1. Click "Simulate Enterprise Policy Mode (Dev Only)"
2. Review behavior, investigate settings, and capture screenshots for documentation
3. Uncheck the setting when done and refresh the page to return to normal operations

### Managing Your Log Data <a href="#managing-your-log-data" id="managing-your-log-data"></a>

**Refreshing Logs:**

- Click "Refresh" to see the latest activity
- Useful if you just experienced a security event

**Clearing Old Logs:**

1. Click "Clear Logs"
2. Confirm you want to delete all log history
3. **Warning:** This permanently deletes all logs

**Exporting Logs for Support:**

1. Click "Export Logs"
2. Choose where to save the file
3. The file will be named like `check-logs-2024-01-15.json`
4. Send this file to support when reporting issues

### Real-World Scenarios <a href="#real-world-scenarios" id="real-world-scenarios"></a>

**Scenario 1: Checking if Check is working**

1. Go to Activity Logs
2. Look for recent "Page Scanned" entries
3. If you see recent entries, Check is working
4. If no recent entries, try visiting a Microsoft website to test

**Scenario 2: Investigating a blocked page**

1. Note the time when you were blocked
2. Go to Activity Logs
3. Look for "Threat Blocked" entries around that time
4. Click the entry to see why it was blocked
5. If you think it was blocked incorrectly, contact support with the log details or check [Common Issues](../troubleshooting/common-issues.md) for known problems

**Scenario 3: Preparing for support**

1. Enable debug logging
2. Try to reproduce the problem
3. Export logs immediately after the problem occurs
4. Disable debug logging
5. Send the exported file to support or check [Common Issues](../troubleshooting/common-issues.md) first
