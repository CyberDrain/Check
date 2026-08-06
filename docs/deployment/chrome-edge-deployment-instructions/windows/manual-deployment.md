# Manual Deployment

{% tabs %}
{% tab title="PowerShell" %}
**Modify the following script and copy it to your RMM's scripting engine or run the script directly on the endpoint to deploy Check:**

{% hint style="info" %}
This script is designed to deploy the extension to both Chrome and Edge. We recommend deploying it to both browsers, even if you standardize on one. This provides better protection in case someone uses the non-preferred browser.
{% endhint %}

1. Review the Extension Configuration Settings and Custom Branding Settings variables and update those to your desired values. The current values in the script are the default values. Leaving any unchanged will set the defaults.
2. If you are using an RMM that can define variables in its scripting interface, you may be able to remove this section and enter the variable definitions in the RMM instead.
3. For webhook deployment, configure `$enableGenericWebhook`, `$webhookUrl`, and `$webhookEvents` in the script. Supported events are documented in [Webhook Documentation](../../../webhooks.md).

<a href="https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/enterprise/Deploy-Windows-Chrome-and-Edge.ps1" class="button primary">Download the Script from GitHub</a>
{% endtab %}

{% tab title="Sideload" %}
Developers who wish to test their code changes can sideload the extension in their browser.

1. Fork the repository and clone your fork
2. Open `chrome://extensions` or `edge://extensions`
3. Enable **Developer mode** and choose **Load unpacked**
4. Select the repository root to load the extension. Reload the extension after making changes.
{% endtab %}
{% endtabs %}
