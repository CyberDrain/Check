# Domain Squatting Detection

Domain squatting protection helps keep you safe from fake websites that try to trick you by using look-alike domain names. Attackers create these fake domains to steal your login credentials.

## What is Domain Squatting?

Domain squatting (sometimes called "typosquatting") is when attackers register website addresses that are intentionally similar to legitimate sites. For example:

- `micros0ft.com` (using a zero instead of the letter O)
- `microsоft.com` (using a Cyrillic "о" that looks like an English "o")
- `login-microsoft.com` (adding extra words to a real domain)

These fake sites often look exactly like the real Microsoft login page, but they're designed to capture your username and password.

## How Check Protects You

Check automatically watches for these fake domains using four smart detection methods:

### 1. **Character Difference Detection**
Spots domains where characters are changed, missing, or swapped around.

**Examples Check catches:**
- `microsft.com` → missing the letter "o"
- `micorsoft.com` → letters swapped ("or" instead of "ro")
- `microosoft.com` → extra letter added

### 2. **Look-Alike Character Detection**
Finds domains using special characters that look similar to normal letters.

**Examples Check catches:**
- `micrоsoft.com` → uses a Cyrillic "о" that looks like an English "o"
- `microsоft.com` → mixes different alphabet characters
- `micro𝐬oft.com` → uses special Unicode characters

### 3. **Typing Mistake Detection**
Identifies domains based on common typing errors and keyboard slip-ups.

**Examples Check catches:**
- `micrisoft.com` → finger slipped to nearby key
- `microssoft.com` → double-typed a letter
- `microosft.com` → typo mixing up letters

### 4. **Suspicious Word Combination Detection**
Spots domains that add words before or after legitimate domains to look more official.

**Examples Check catches:**
- `secure-microsoft.com`
- `login-microsoft-verify.com`
- `microsoft-auth.com`
- `official-microsoft-support.com`

Common suspicious words attackers use: `login`, `secure`, `verify`, `official`, `support`, `auth`, `signin`, `portal`

## What Domains Are Protected?

Check protects **30+ popular domains** by default, including:

**Microsoft Services:**
- microsoft.com, microsoftonline.com, office.com, outlook.com, onedrive.com, and more

**Other Popular Services:**
- google.com, github.com, facebook.com, amazon.com, apple.com, paypal.com, and more

**Plus: Your URL Allowlist**

{% hint style="info" %}
**Unified Protection:** Check uses your [URL Allowlist](../settings/detection-rules.md#url-allowlist-regex-or-url-with-wildcards) for double protection. Any domains you add there are automatically protected from squatting attempts too!

For example, if you add `https://yourcompany.com/*` to your allowlist, Check will also protect against fake domains like `yourcompany.net` or `your-company.com`.
{% endhint %}

## How It Works in Practice

When you visit a website, Check automatically:

1. **Checks** if the domain looks similar to any protected domain
2. **Analyzes** using all four detection methods
3. **Warns** you if it finds a suspicious match
4. **Blocks** the page if it's clearly a phishing attempt

You don't need to do anything - the protection works automatically in the background!

## Configuration

{% hint style="warning" %}
**For most users**: Domain squatting detection works automatically with default settings. You don't need to change anything!
{% endhint %}

### Page Blocking Control

Check has an **"Enable Page Blocking"** setting in the extension options that controls how suspicious pages are handled:

- **Page Blocking Enabled** + **Action: "block"** = Page is completely blocked with full-page warning
- **Page Blocking Enabled** + **Action: "warn"** = Warning banner shown, page remains accessible
- **Page Blocking Disabled** = Warning banner shown regardless of action setting (never blocks)

This gives you control over whether you want aggressive blocking or just warnings for suspicious domains.

### For Advanced Users and IT Departments

Domain squatting detection is configured in your detection rules file (not in the Settings UI). This follows the same pattern as other advanced security features like Rogue Apps Detection.

#### How to Configure

Edit your `rules/detection-rules.json` file to customize:

**Enable/Disable Detection:**
```json
{
  "domain_squatting": {
    "enabled": true,  // Turn detection on/off
    "action": "block" // Action when detected: "block" or "warn"
  }
}
```

**Set Action Type:**
```json
{
  "domain_squatting": {
    "action": "block"  // "block" = full page block, "warn" = banner only
  }
}
```
Note: Page blocking also requires "Enable Page Blocking" to be turned ON in settings.

**Adjust Sensitivity:**
    "enabled": true
  }
}
```

**Adjust Sensitivity** (how strict the checking is):
```json
{
  "domain_squatting": {
    "deviation_threshold": 2
  }
}
```
- Lower numbers (1) = Very strict, catches fewer variations
- Higher numbers (3-5) = More lenient, catches more variations
- Default is 2 (recommended for most organizations)

**Choose Detection Methods:**
```json
{
  "domain_squatting": {
    "algorithms": {
      "levenshtein": true,
      "homoglyph": true,
      "typosquat": true,
      "combosquat": true
    }
  }
}
```

You can turn individual detection methods on/off. We recommend keeping all four enabled for maximum protection.

## For MSPs and Enterprise IT

### Enterprise Policy Management

Domain squatting detection can be managed through Group Policy (GPO) or Microsoft Intune, just like other Check settings.

**What You Can Control via Policy:**
- Detection sensitivity (character difference threshold)
- Which detection methods are active
- Additional protected domains specific to your organization

**What's in the Rules File:**
- Enable/disable domain squatting detection
- Default protected domains list
- Detection rules and patterns

This separation gives you flexibility - you control the core security settings through your detection rules file, while still allowing policy-based customization for different clients or departments.

### Adding Organization-Specific Domains

{% hint style="info" %}
**Use the URL Allowlist!** 

The easiest way to protect your organization's domains is to add them to the URL Allowlist in Detection Rules settings. This automatically:
1. Prevents false positives on your internal sites
2. Protects those domains from squatting attempts
3. Works without modifying detection rules files
{% endhint %}

**Example:** Adding `https://contoso.com/*` to your allowlist protects against fake domains like:
- `cont0so.com` (zero instead of o)
- `contos0.com` (zero at the end)
- `login-contoso.com` (suspicious prefix)

### CIPP Reporting and Webhooks

Domain squatting detections are automatically reported through your existing Check monitoring:

- **Activity Logs**: View all domain squatting warnings and blocks
- **CIPP Integration**: Squatting detections appear in your CIPP logbook
- **Webhooks**: Configure webhooks to receive `domain_squatting_detected` events

See [General Settings](../settings/general.md) for configuring reporting and webhooks.

## Troubleshooting

### "Check blocked a legitimate site"

If Check blocks a site you trust:

1. **Add it to your URL Allowlist** in Detection Rules settings
2. The site will be both allowed and protected from squatting
3. Report the false positive to help improve Check

### "A phishing site wasn't detected"

Domain squatting detection works alongside Check's other phishing protections. If a site gets through:

1. Use "Report False Negative" if you encounter a phishing site
2. Check will update rules to catch it in the future
3. Your report helps protect the entire community

### "Settings are grayed out"

If you can't see or change domain squatting settings, your IT department has configured these centrally. This is normal for managed deployments - contact your IT team if you need adjustments.

## Related Documentation

- [Detection Rules](../settings/detection-rules.md) - Configure your URL allowlist
- [General Settings](../settings/general.md) - Set up reporting and webhooks
- [Enterprise Deployment](../deployment/) - Deploy Check across your organization
- [Creating Detection Rules](../advanced/creating-detection-rules.md) - Advanced rule customization
