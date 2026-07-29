# Chrome and Edge (Windows)

If you need to fully remove Check managed enterprise configuration from Windows endpoints, use the uninstall script instead of manually deleting registry values.

This removes all extension-specific policy values created during deployment for both Chrome and Edge, including nested settings such as domain squatting, webhook, branding, and allowlist values.

## Uninstall Script

1. Run the script as Administrator on the target endpoint.
2. Use the script when testing policy changes and you want a clean baseline before redeploying.
3. After running the script, restart Chrome and Edge to ensure that their policies refresh.

<a href="https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/enterprise/Remove-Windows-Chrome-and-Edge.ps1" class="button primary">Download the Uninstall Script from GitHub</a>
