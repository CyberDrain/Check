# Detection Rules

This section controls how Check recognizes and responds to phishing threats. Most users can leave these at default settings, but here's how to manage them.

## Understanding How Detection Works

Check uses a constantly updated list of rules to identify fake Microsoft login pages. Think of it like antivirus definitions - they need to be kept current to protect against new threats.

## Detection Configuration

### **Config URL**

This field allows you to specify a custom URL for fetching detection rules. Leave this field empty to use the default CyberDrain rules. If your organization provides custom detection rules, enter the full HTTPS URL here (e.g., `https://your-company.com/custom-rules.json`).

**For most users:**

1. Leave the "Config URL" field empty or at its default
2. Set "Update Interval" to 24 hours
3. Click "Save Settings"

**For organizations with custom security rules:**

1. Enter your organization's custom rules URL (provided by IT)
2. Custom rules, including allow lists, can be created using [creating-detection-rules.md](../advanced/creating-detection-rules.md "mention").

### **Update Interval (hours)**

Controls how often Check fetches updated detection rules. The default is 24 hours. Set update interval based on your security requirements:

* High security environments: 6-12 hours
* Standard environments: 24 hours
* Limited bandwidth: 48-72 hours

### **URL Allowlist (Regex or URL with wildcards)**

{% hint style="info" %}
**Need to allowlist a phishing training service?**

MSPs and IT departments commonly need to exclude phishing training platforms (like KnowBe4, Proofpoint, etc.) from detection. Check [Advanced → Creating Detection Rules](../advanced/creating-detection-rules.md#exclusions) for technical details.
{% endhint %}

Add URLs or patterns that should be excluded from phishing detection. This is useful for internal company sites or trusted third-party services that might trigger false positives.

**Dual Protection:** Your allowlist serves two purposes:
1. **Prevents false positives** - Sites you add won't be flagged as phishing
2. **Domain squatting protection** - Domains extracted from your allowlist are automatically protected against typosquatting and look-alike attacks

For example, adding `https://yourcompany.com/*` will both allow that site AND protect against fake domains like `yourcompany.net`, `your-company.com`, or `y0urcompany.com`.

Learn more about [Domain Squatting Detection](../features/domain-squatting-detection.md).

**How it works:** Your allowlist patterns are **added to** (not replacing) the default CyberDrain exclusions, providing additional protection without losing baseline coverage.

You can use:

* **Simple URLs with wildcards:** `https://google.com/*` or `https://*.microsoft.com/*`
* **Advanced regex patterns:** `^https://trusted\.example\.com/.*`

**Copy-paste examples (based on existing default exclusions):**

```
https://*.google.com/*
https://*.auth0.com/*
https://*.amazon.com/*
https://*.facebook.com/*
https://training.your-company.com/*
https://*.internal-domain.com/*
```

Enter one pattern per line. These patterns are added to the exclusion rules without replacing the entire ruleset from your Config URL.

### Updating Rules Manually

Sometimes you need to update rules immediately:

1. **When to do this:**
   * You've heard about a new phishing campaign
   * Check isn't detecting a threat it should
   * Your IT department asks you to update
2. **How to do it:**
   * Go to Detection Rules section
   * Click "Update Rules Now"
   * Wait for the "Rules updated successfully" message

## Understanding the Configuration Overview

The Configuration Overview section displays your current detection rules in two viewing modes:

**Formatted View (default):**

* **Version number** - Higher numbers are newer
* **Last Updated** - Should be recent (within your update interval)
* **Total Rules** - More rules generally mean better protection
* **Rule Categories** - Shows breakdown by rule type (exclusions, indicators, etc.)

**Raw JSON View:**

* Click "Show Raw JSON" to view the complete detection rules file
* Useful for advanced users and troubleshooting
* Shows the exact configuration being used by the extension

**If you see problems:**

* Very old "Last Updated" date → Click "Update Rules Now"
* Version shows "Error loading" → Check your internet connection
* No rules showing → Contact support

{% hint style="warning" %}
#### What if Settings Are Not Visible?

If some settings do not appear in your version, it means your organization's IT department has set these for you. This is normal in business environments - your IT team wants to make sure everyone has the same security settings. You will also see text indicating that the extension is being managed by policy.
{% endhint %}

## Troubleshooting Rule Updates

### **Problem: Rules won't update**

1. Check your internet connection
2. Try clicking "Update Rules Now" again
3. If using custom rules URL, verify the URL is correct
4. Contact your IT department if the problem persists

### **Problem: Extension seems slow after rule update**

1. Wait 5-10 minutes for the new rules to fully load
2. Restart your browser
3. If still slow, try updating rules again

## Using the Rule Playground

{% hint style="warning" %}
Note that the Rule Playground is in Beta. Some limitations exist around how the rule playground can handle more complex detection filters so results may not be identical to the extension's behavior.
{% endhint %}

The rule playground is your chance to prototype and test detection rules locally.

### Setting Up Candidate Rules

There are two options for how to build out your candidate rules:

1. You can use the `Load Current` button to pull in the configured detection rules for the browser. You can test as is or add/edit the rules JSON until you have the candidate rules you want to test.
2. Create a fully custom candidate ruleset. These should be array. See the format of the default rule detection set for the structure of the data.

Once created, you have additional tools to review your JSON.&#x20;

* [**Validate**](detection-rules.md#understanding-the-validation-tool)
* [**Sanitize**](detection-rules.md#understanding-the-sanitize-tool)
* **Copy**: Copies the current JSON to your clipboard. This will allow you to paste it into the editor of your choice or use in creating a pull request to GitHub if you are contributing back to the source code.

#### Understanding the Validation Tool

What it checks:

1. JSON validity
   * Tries to parse the text. If parsing fails shows “Invalid JSON: \<error>” and stops.
2. Overall shape (must be ONE of):
   * An array of rule objects
   * An object with a rules array (parsed.rules)
   * A single rule object that has both id and type
   * If none match it will issue “JSON does not look like rule(s) array or object with 'rules'.”
3. For each rule it inspects ONLY these fields:
   * id: Missing → issue “Rule missing 'id'”
   * type: Missing → issue “Rule \<id or (unknown)> missing 'type'”
   * weight: Present but not a number → issue “Rule \<id> weight should be number”
   * description: Missing → suggestion “Rule \<id> missing description (optional but recommended)”
4. Output:
   * Issues (blocking problems) listed if any
   * Suggestions (non‑blocking) listed if any
   * “No blocking validation issues found.” if zero issues
   * Displays results panel; does NOT change your JSON

What Validate does NOT do

* Does not check regex correctness
* Does not verify severity/action/pattern semantics
* Does not add or remove fields
* Does not reformat or reorder anything
* Does not merge with stored extension rules

#### Understanding the Sanitize Tool

What Sanitize actually “fixes”

* Only whitespace / indentation / line structure,

What Sanitize does NOT change

* Field names, values, types
* Order of object properties beyond natural JS enumeration
* Array ordering
* Missing required fields (id/type etc.)
* Invalid logic or patterns
* It does not validate anything beyond being parseable JSON

### Testing Your Rules

Once you have your candidate rules, you can test your rule set by providing a test URL and sample HTML from that site. It's required to copy the HTML from the site since the tool will not fetch that live. The URL is needed for the rule set evaluation. Once you have the test URL and sample HTML, hit `Test Rules`. If you need to start fresh on your test, you can hit `Clear`.

### Reading the Test Results

Below the `Test Rules` button, you will see the output of your candidate rule set with the test URL and sample HTML.

* **Decision & Summary**: This will provide you with a high-level overview of the result of the test including the decision to allow, warn, or block.
* **Threats**: This will outline the rules that identified threats in the sample HTML along with a snippet of the HTML that resulted in the detection.
* **Unsupported Features**: An outline of the features that the playground was unable to check due to the more complex nature of those filters.
* **Raw JSON**: This will allow you to view the raw output of the playground's evaluation of the sample HTML.
