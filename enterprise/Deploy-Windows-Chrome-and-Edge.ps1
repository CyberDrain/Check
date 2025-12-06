# Define extension details
# Chrome
$chromeExtensionId = "benimdeioplgkhanklclahllklceahbe"
$chromeUpdateUrl = "https://clients2.google.com/service/update2/crx"
$chromeManagedStorageKey = "HKLM:\SOFTWARE\Policies\Google\Chrome\3rdparty\extensions\$chromeExtensionId\policy"
$chromeExtensionSettingsKey = "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionSettings\$chromeExtensionId"

#Edge
$edgeExtensionId = "knepjpocdagponkonnbggpcnhnaikajg"
$edgeUpdateUrl = "https://edge.microsoft.com/extensionwebstorebase/v1/crx"
$edgeManagedStorageKey = "HKLM:\SOFTWARE\Policies\Microsoft\Edge\3rdparty\extensions\$edgeExtensionId\policy"
$edgeExtensionSettingsKey = "HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionSettings\$edgeExtensionId"

# Extension Configuration Settings
$showNotifications = 1 # 0 = Unchecked, 1 = Checked (Enabled); default is 1; This will set the "Show Notifications" option in the extension settings.
$enableValidPageBadge = 0 # 0 = Unchecked, 1 = Checked (Enabled); default is 0; This will set the "Show Valid Page Badge" option in the extension settings.
$enablePageBlocking = 1 # 0 = Unchecked, 1 = Checked (Enabled); default is 1; This will set the "Enable Page Blocking" option in the extension settings.
$forceToolbarPin = 1 # 0 = Not pinned, 1 = Force pinned to toolbar; default is 1
$enableCippReporting = 0 # 0 = Unchecked, 1 = Checked (Enabled); default is 1; This will set the "Enable CIPP Reporting" option in the extension settings.
$cippServerUrl = "" # This will set the "CIPP Server URL" option in the extension settings; default is blank; if you set $enableCippReporting to 1, you must set this to a valid URL including the protocol (e.g., https://cipp.cyberdrain.com). Can be vanity URL or the default azurestaticapps.net domain.
$cippTenantId = "" # This will set the "Tenant ID/Domain" option in the extension settings; default is blank; if you set $enableCippReporting to 1, you must set this to a valid Tenant ID.
$customRulesUrl = "" # This will set the "Config URL" option in the Detection Configuration settings; default is blank.
$updateInterval = 24 # This will set the "Update Interval" option in the Detection Configuration settings; default is 24 (hours). Range: 1-168 hours (1 hour to 1 week).
$urlAllowlist = @() # This will set the "URL Allowlist" option in the Detection Configuration settings; default is blank; if you want to add multiple URLs, add them as a comma-separated list within the brackets (e.g., @("https://example1.com", "https://example2.com")). Supports simple URLs with * wildcard (e.g., https://*.example.com) or advanced regex patterns (e.g., ^https:\/\/(www\.)?example\.com\/.*$).
$enableDebugLogging = 0 # 0 = Unchecked, 1 = Checked (Enabled); default is 0; This will set the "Enable Debug Logging" option in the Activity Log settings.

# Generic Webhook Settings
$enableGenericWebhook = 0 # 0 = Disabled, 1 = Enabled; default is 0; This will enable the generic webhook for sending detection events to a custom endpoint.
$webhookUrl = "" # This will set the "Webhook URL" option; default is blank; if you set $enableGenericWebhook to 1, you must set this to a valid URL including the protocol (e.g., https://webhook.example.com/endpoint).
$webhookEvents = @() # This will set the "Event Types" to send to the webhook; default is blank; if you set $enableGenericWebhook to 1, you can specify which events to send. Available events: "detection_alert", "false_positive_report", "page_blocked", "rogue_app_detected", "threat_detected", "validation_event". Example: @("detection_alert", "page_blocked", "threat_detected").

# Custom Branding Settings
$companyName = "CyberDrain" # This will set the "Company Name" option in the Custom Branding settings; default is "CyberDrain".
$companyURL = "https://cyberdrain.com" # This will set the Company URL option in the Custom Branding settings; default is "https://cyberdrain.com"; Must include the protocol (e.g., https://).
$productName = "Check - Phishing Protection" # This will set the "Product Name" option in the Custom Branding settings; default is "Check - Phishing Protection".
$supportEmail = "" # This will set the "Support Email" option in the Custom Branding settings; default is blank.
$primaryColor = "#F77F00" # This will set the "Primary Color" option in the Custom Branding settings; default is "#F77F00"; must be a valid hex color code (e.g., #FFFFFF).
$logoUrl = "" # This will set the "Logo URL" option in the Custom Branding settings; default is blank. Must be a valid URL including the protocol (e.g., https://example.com/logo.png); protocol must be https; recommended size is 48x48 pixels with a maximum of 128x128.

# Extension Settings
# These settings control how the extension is installed and what permissions it has. It is recommended to leave these at their default values unless you have a specific need to change them.
$installationMode = "force_installed"

# Function to check and install extension
function Configure-ExtensionSettings {
    param (
        [string]$ExtensionId,
        [string]$UpdateUrl,
        [string]$ManagedStorageKey,
        [string]$ExtensionSettingsKey
    )

    # Create and configure managed storage key
    if (!(Test-Path $ManagedStorageKey)) {
        New-Item -Path $ManagedStorageKey -Force | Out-Null
    }

    # Set extension configuration settings
    New-ItemProperty -Path $ManagedStorageKey -Name "showNotifications" -PropertyType DWord -Value $showNotifications -Force | Out-Null
    New-ItemProperty -Path $ManagedStorageKey -Name "enableValidPageBadge" -PropertyType DWord -Value $enableValidPageBadge -Force | Out-Null
    New-ItemProperty -Path $ManagedStorageKey -Name "enablePageBlocking" -PropertyType DWord -Value $enablePageBlocking -Force | Out-Null
    New-ItemProperty -Path $ManagedStorageKey -Name "enableCippReporting" -PropertyType DWord -Value $enableCippReporting -Force | Out-Null
    New-ItemProperty -Path $ManagedStorageKey -Name "cippServerUrl" -PropertyType String -Value $cippServerUrl -Force | Out-Null
    New-ItemProperty -Path $ManagedStorageKey -Name "cippTenantId" -PropertyType String -Value $cippTenantId -Force | Out-Null
    New-ItemProperty -Path $ManagedStorageKey -Name "customRulesUrl" -PropertyType String -Value $customRulesUrl -Force | Out-Null
    New-ItemProperty -Path $ManagedStorageKey -Name "updateInterval" -PropertyType DWord -Value $updateInterval -Force | Out-Null
    New-ItemProperty -Path $ManagedStorageKey -Name "enableDebugLogging" -PropertyType DWord -Value $enableDebugLogging -Force | Out-Null

    # Create and configure URL allow list
    $urlAllowlistKey = "$ManagedStorageKey\urlAllowlist"
    if (!(Test-Path $urlAllowlistKey)) {
        New-Item -Path $urlAllowlistKey -Force | Out-Null
    }

    # Clear any existing properties
    Remove-ItemProperty -Path $urlAllowlistKey -Name * -Force | Out-Null

    # Set URL allow list properties with names starting from 1
    for ($i = 0; $i -lt $urlAllowlist.Count; $i++) {
        $propertyName = ($i + 1).ToString()
        $propertyValue = $urlAllowlist[$i]
        New-ItemProperty -Path $urlAllowlistKey -Name $propertyName -PropertyType String -Value $propertyValue -Force | Out-Null
    }

    # Create and configure custom branding
    $customBrandingKey = "$ManagedStorageKey\customBranding"
    if (!(Test-Path $customBrandingKey)) {
        New-Item -Path $customBrandingKey -Force | Out-Null
    }

    # Set custom branding settings
    New-ItemProperty -Path $customBrandingKey -Name "companyName" -PropertyType String -Value $companyName -Force | Out-Null
    New-ItemProperty -Path $customBrandingKey -Name "companyURL" -PropertyType String -Value $companyURL -Force | Out-Null
    New-ItemProperty -Path $customBrandingKey -Name "productName" -PropertyType String -Value $productName -Force | Out-Null
    New-ItemProperty -Path $customBrandingKey -Name "supportEmail" -PropertyType String -Value $supportEmail -Force | Out-Null
    New-ItemProperty -Path $customBrandingKey -Name "primaryColor" -PropertyType String -Value $primaryColor -Force | Out-Null
    New-ItemProperty -Path $customBrandingKey -Name "logoUrl" -PropertyType String -Value $logoUrl -Force | Out-Null

    # Create and configure generic webhook
    $genericWebhookKey = "$ManagedStorageKey\genericWebhook"
    if (!(Test-Path $genericWebhookKey)) {
        New-Item -Path $genericWebhookKey -Force | Out-Null
    }

    # Set generic webhook settings
    New-ItemProperty -Path $genericWebhookKey -Name "enabled" -PropertyType DWord -Value $enableGenericWebhook -Force | Out-Null
    New-ItemProperty -Path $genericWebhookKey -Name "url" -PropertyType String -Value $webhookUrl -Force | Out-Null

    # Create and configure webhook events list
    $webhookEventsKey = "$genericWebhookKey\events"
    if (!(Test-Path $webhookEventsKey)) {
        New-Item -Path $webhookEventsKey -Force | Out-Null
    }

    # Clear any existing properties
    Remove-ItemProperty -Path $webhookEventsKey -Name * -Force | Out-Null

    # Set webhook events with names starting from 1
    for ($i = 0; $i -lt $webhookEvents.Count; $i++) {
        $propertyName = ($i + 1).ToString()
        $propertyValue = $webhookEvents[$i]
        New-ItemProperty -Path $webhookEventsKey -Name $propertyName -PropertyType String -Value $propertyValue -Force | Out-Null
    }

    # Create and configure extension settings
    if (!(Test-Path $ExtensionSettingsKey)) {
        New-Item -Path $ExtensionSettingsKey -Force | Out-Null
    }

    # Set extension settings
    New-ItemProperty -Path $ExtensionSettingsKey -Name "installation_mode" -PropertyType String -Value $installationMode -Force | Out-Null
    New-ItemProperty -Path $ExtensionSettingsKey -Name "update_url" -PropertyType String -Value $UpdateUrl -Force | Out-Null

    # Add toolbar pinning if enabled
    if ($forceToolbarPin -eq 1) {
        if ($ExtensionId -eq $edgeExtensionId) {
            New-ItemProperty -Path $ExtensionSettingsKey -Name "toolbar_state" -PropertyType String -Value "force_shown" -Force | Out-Null
        } elseif ($ExtensionId -eq $chromeExtensionId) {
            New-ItemProperty -Path $ExtensionSettingsKey -Name "toolbar_pin" -PropertyType String -Value "force_pinned" -Force | Out-Null
        }
    }
 
    Write-Output "Configured extension settings for $ExtensionId"
}

# Configure settings for Chrome and Edge
Configure-ExtensionSettings -ExtensionId $chromeExtensionId -UpdateUrl $chromeUpdateUrl -ManagedStorageKey $chromeManagedStorageKey -ExtensionSettingsKey $chromeExtensionSettingsKey
Configure-ExtensionSettings -ExtensionId $edgeExtensionId -UpdateUrl $edgeUpdateUrl -ManagedStorageKey $edgeManagedStorageKey -ExtensionSettingsKey $edgeExtensionSettingsKey