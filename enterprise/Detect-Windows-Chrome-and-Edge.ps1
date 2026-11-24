# Check Extension - Intune Detection Script
# This script verifies that the Check by CyberDrain extension is correctly configured
# in the registry for both Chrome and Edge browsers.
#
# IMPORTANT: The settings below MUST match the values in your Deploy-Windows-Chrome-and-Edge.ps1.
# If any value differs, Intune will detect the app as "not installed" and trigger a reinstall.
#
# Exit codes: 0 = compliant (extension correctly configured), 1 = non-compliant (drift detected)

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
$validPageBadgeTimeout = 5 # Seconds before the valid page badge hides; default is 5; 0 keeps it visible until dismissed. Range: 0-300.
$enablePageBlocking = 1 # 0 = Unchecked, 1 = Checked (Enabled); default is 1; This will set the "Enable Page Blocking" option in the extension settings.
$forceToolbarPin = 1 # 0 = Not pinned, 1 = Force pinned to toolbar; default is 1
$enableCippReporting = 0 # 0 = Unchecked, 1 = Checked (Enabled); default is 0; This will set the "Enable CIPP Reporting" option in the extension settings.
$cippServerUrl = "" # This will set the "CIPP Server URL" option in the extension settings; default is blank; if you set $enableCippReporting to 1, you must set this to a valid URL including the protocol (e.g., https://cipp.cyberdrain.com). Can be vanity URL or the default azurestaticapps.net domain.
$cippTenantId = "" # This will set the "Tenant ID/Domain" option in the extension settings; default is blank; if you set $enableCippReporting to 1, you must set this to a valid Tenant ID.
$customRulesUrl = "" # This will set the "Config URL" option in the Detection Configuration settings; default is blank.
$updateInterval = 24 # This will set the "Update Interval" option in the Detection Configuration settings; default is 24 (hours). Range: 1-168 hours (1 hour to 1 week).
$urlAllowlist = @() # This will set the "URL Allowlist" option in the Detection Configuration settings; default is blank; if you want to add multiple URLs, add them as a comma-separated list within the brackets (e.g., @("https://example1.com", "https://example2.com")). Supports simple URLs with * wildcard (e.g., https://*.example.com) or advanced regex patterns (e.g., ^https:\/\/(www\.)?example\.com\/.*$).
$domainSquattingEnabled = 0 # 0 = Disabled, 1 = Enabled; default is 0; controls domain squatting detection from managed policy/config.
$protectedDomains = @() # Domains to protect from lookalike sites when domain squatting detection is enabled; default is blank; e.g. @("contoso.com", "fabrikam.com"). When blank, the domains in $urlAllowlist are protected instead.
$enableDebugLogging = 0 # 0 = Unchecked, 1 = Checked (Enabled); default is 0; This will set the "Enable Debug Logging" option in the Activity Log settings.

# Generic Webhook Settings
$enableGenericWebhook = 0 # 0 = Disabled, 1 = Enabled; default is 0; This will enable the generic webhook for sending detection events to a custom endpoint.
$webhookUrl = "" # This will set the "Webhook URL" option; default is blank; if you set $enableGenericWebhook to 1, you must set this to a valid URL including the protocol (e.g., https://webhook.example.com/endpoint).
$webhookEvents = @() # This will set the "Event Types" to send to the webhook; default is blank; if you set $enableGenericWebhook to 1, you can specify which events to send. Available events: "detection_alert", "false_positive_report", "page_blocked", "rogue_app_detected", "threat_detected", "validation_event", "domain_squatting_detected". Example: @("detection_alert", "page_blocked", "threat_detected").

# Custom Branding Settings
$companyName = "CyberDrain" # This will set the "Company Name" option in the Custom Branding settings; default is "CyberDrain".
$productName = "Check - Phishing Protection" # This will set the "Product Name" option in the Custom Branding settings; default is "Check - Phishing Protection".
$supportEmail = "" # This will set the "Support Email" option in the Custom Branding settings; default is blank.
$supportUrl = "" # This will set the "Support URL" option in the Custom Branding settings; default is blank.
$privacyPolicyUrl = "" # This will set the "Privacy URL" option in the Custom Branding settings; default is blank.
$aboutUrl = "" # This will set the "About URL" option in the Custom Branding settings; default is blank.
$primaryColor = "#F77F00" # This will set the "Primary Color" option in the Custom Branding settings; default is "#F77F00"; must be a valid hex color code (e.g., #FFFFFF).
$logoUrl = "" # This will set the "Logo URL" option in the Custom Branding settings; default is blank. Must be a valid URL including the protocol (e.g., https://example.com/logo.png); protocol must be https; recommended size is 48x48 pixels with a maximum of 128x128.

# Extension Settings
$installationMode = "force_installed"

# Helper to check a registry value matches expected
function Test-RegValue {
    param (
        [string]$Path,
        [string]$Name,
        $Expected
    )
    $val = (Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue).$Name
    return ($null -ne $val -and $val -eq $Expected)
}

# Define browser configurations for detection
$browsers = @(
    @{
        Name                = 'Chrome'
        ExtensionId         = $chromeExtensionId
        UpdateUrl           = $chromeUpdateUrl
        ManagedStorageKey   = $chromeManagedStorageKey
        ExtensionSettingsKey = $chromeExtensionSettingsKey
        ToolbarProp          = 'toolbar_pin'
        ToolbarPinnedValue   = 'force_pinned'
        ToolbarUnpinnedValue = 'default_unpinned'
    },
    @{
        Name                = 'Edge'
        ExtensionId         = $edgeExtensionId
        UpdateUrl           = $edgeUpdateUrl
        ManagedStorageKey   = $edgeManagedStorageKey
        ExtensionSettingsKey = $edgeExtensionSettingsKey
        ToolbarProp          = 'toolbar_state'
        ToolbarPinnedValue   = 'force_shown'
        ToolbarUnpinnedValue = 'hidden'
    }
)

function Write-DetectionFailure {
    param(
        [string]$BrowserName,
        [string]$KeyPath,
        [string]$ValueName,
        [object]$ExpectedValue,
        [object]$ActualValue
    )

    if ([string]::IsNullOrEmpty($ValueName)) {
        Write-Output "$BrowserName detection failed: missing registry key '$KeyPath'."
        return
    }

    Write-Output "$BrowserName detection failed for '$ValueName' at '$KeyPath': expected '$ExpectedValue', actual '$ActualValue'."
}

function Test-RegValueWithDetails {
    param(
        [string]$BrowserName,
        [string]$KeyPath,
        [string]$ValueName,
        [object]$ExpectedValue
    )

    $matches = Test-RegValue $KeyPath $ValueName $ExpectedValue
    if ($matches) {
        return $true
    }

    $actualValue = '<missing>'
    if (Test-Path $KeyPath) {
        try {
            $property = Get-ItemProperty -Path $KeyPath -Name $ValueName -ErrorAction Stop
            $actualValue = $property.$ValueName
        }
        catch {
            $actualValue = '<missing>'
        }
    }

    Write-DetectionFailure -BrowserName $BrowserName -KeyPath $KeyPath -ValueName $ValueName -ExpectedValue $ExpectedValue -ActualValue $actualValue
    return $false
}

foreach ($browser in $browsers) {
    # Verify managed storage key exists
    if (!(Test-Path $browser.ManagedStorageKey)) {
        Write-DetectionFailure -BrowserName $browser.Name -KeyPath $browser.ManagedStorageKey -ValueName $null -ExpectedValue $null -ActualValue $null
        exit 1
    }

    $policyKey = $browser.ManagedStorageKey

    # Core DWord settings
    if (!(Test-RegValueWithDetails $browser.Name $policyKey 'showNotifications' $showNotifications)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $policyKey 'enableValidPageBadge' $enableValidPageBadge)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $policyKey 'validPageBadgeTimeout' $validPageBadgeTimeout)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $policyKey 'enablePageBlocking' $enablePageBlocking)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $policyKey 'enableCippReporting' $enableCippReporting)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $policyKey 'updateInterval' $updateInterval)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $policyKey 'enableDebugLogging' $enableDebugLogging)) { exit 1 }

    # Core String settings
    if (!(Test-RegValueWithDetails $browser.Name $policyKey 'cippServerUrl' $cippServerUrl)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $policyKey 'cippTenantId' $cippTenantId)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $policyKey 'customRulesUrl' $customRulesUrl)) { exit 1 }

    # domainSquatting subkey
    $domainSquattingKey = "$policyKey\domainSquatting"
    if (!(Test-Path $domainSquattingKey)) {
        Write-DetectionFailure -BrowserName $browser.Name -KeyPath $domainSquattingKey -ValueName $null -ExpectedValue $null -ActualValue $null
        exit 1
    }
    if (!(Test-RegValueWithDetails $browser.Name $domainSquattingKey 'enabled' $domainSquattingEnabled)) { exit 1 }

    # domainSquatting\protectedDomains subkey — verify exact count and values
    $protectedDomainsKey = "$domainSquattingKey\protectedDomains"
    if (!(Test-Path $protectedDomainsKey)) {
        Write-DetectionFailure -BrowserName $browser.Name -KeyPath $protectedDomainsKey -ValueName $null -ExpectedValue $null -ActualValue $null
        exit 1
    }
    $protectedDomainsCount = @((Get-Item $protectedDomainsKey).Property).Count
    if ($protectedDomainsCount -ne $protectedDomains.Count) {
        Write-Output "$($browser.Name): Registry key '$protectedDomainsKey' has $protectedDomainsCount protected domain value(s); expected $($protectedDomains.Count)."
        exit 1
    }
    for ($i = 0; $i -lt $protectedDomains.Count; $i++) {
        if (!(Test-RegValueWithDetails $browser.Name $protectedDomainsKey ($i + 1).ToString() $protectedDomains[$i])) { exit 1 }
    }

    # customBranding subkey
    $brandingKey = "$policyKey\customBranding"
    if (!(Test-Path $brandingKey)) {
        Write-DetectionFailure -BrowserName $browser.Name -KeyPath $brandingKey -ValueName $null -ExpectedValue $null -ActualValue $null
        exit 1
    }
    if (!(Test-RegValueWithDetails $browser.Name $brandingKey 'companyName' $companyName)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $brandingKey 'productName' $productName)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $brandingKey 'supportEmail' $supportEmail)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $brandingKey 'supportUrl' $supportUrl)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $brandingKey 'privacyPolicyUrl' $privacyPolicyUrl)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $brandingKey 'aboutUrl' $aboutUrl)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $brandingKey 'primaryColor' $primaryColor)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $brandingKey 'logoUrl' $logoUrl)) { exit 1 }

    # genericWebhook subkey
    $webhookKey = "$policyKey\genericWebhook"
    if (!(Test-Path $webhookKey)) {
        Write-DetectionFailure -BrowserName $browser.Name -KeyPath $webhookKey -ValueName $null -ExpectedValue $null -ActualValue $null
        exit 1
    }
    if (!(Test-RegValueWithDetails $browser.Name $webhookKey 'enabled' $enableGenericWebhook)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $webhookKey 'url' $webhookUrl)) { exit 1 }

    # genericWebhook\events subkey — verify exact count and values
    $eventsKey = "$webhookKey\events"
    if (!(Test-Path $eventsKey)) {
        Write-DetectionFailure -BrowserName $browser.Name -KeyPath $eventsKey -ValueName $null -ExpectedValue $null -ActualValue $null
        exit 1
    }
    if ($webhookEvents.Count -gt 0) {
        $eventsCount = (Get-Item $eventsKey).Property.Count
        if ($eventsCount -ne $webhookEvents.Count) {
            Write-Output "$($browser.Name): Registry key '$eventsKey' has $eventsCount event value(s); expected $($webhookEvents.Count)."
            exit 1
        }
        for ($i = 0; $i -lt $webhookEvents.Count; $i++) {
            if (!(Test-RegValueWithDetails $browser.Name $eventsKey ($i + 1).ToString() $webhookEvents[$i])) { exit 1 }
        }
    } else {
        $existingEvents = (Get-Item $eventsKey).Property
        if ($null -ne $existingEvents -and $existingEvents.Count -gt 0) {
            Write-Output "$($browser.Name): Registry key '$eventsKey' has unexpected event value(s); expected none."
            exit 1
        }
    }

    # urlAllowlist subkey — verify exact count and values
    $allowlistKey = "$policyKey\urlAllowlist"
    if (!(Test-Path $allowlistKey)) {
        Write-DetectionFailure -BrowserName $browser.Name -KeyPath $allowlistKey -ValueName $null -ExpectedValue $null -ActualValue $null
        exit 1
    }
    if ($urlAllowlist.Count -gt 0) {
        $allowlistCount = (Get-Item $allowlistKey).Property.Count
        if ($allowlistCount -ne $urlAllowlist.Count) {
            Write-Output "$($browser.Name): Registry key '$allowlistKey' has $allowlistCount allowlist value(s); expected $($urlAllowlist.Count)."
            exit 1
        }
        for ($i = 0; $i -lt $urlAllowlist.Count; $i++) {
            if (!(Test-RegValueWithDetails $browser.Name $allowlistKey ($i + 1).ToString() $urlAllowlist[$i])) { exit 1 }
        }
    } else {
        $existingAllowlist = (Get-Item $allowlistKey).Property
        if ($null -ne $existingAllowlist -and $existingAllowlist.Count -gt 0) {
            Write-Output "$($browser.Name): Registry key '$allowlistKey' has unexpected allowlist value(s); expected none."
            exit 1
        }
    }

    # ExtensionSettings key
    if (!(Test-Path $browser.ExtensionSettingsKey)) {
        Write-DetectionFailure -BrowserName $browser.Name -KeyPath $browser.ExtensionSettingsKey -ValueName $null -ExpectedValue $null -ActualValue $null
        exit 1
    }
    if (!(Test-RegValueWithDetails $browser.Name $browser.ExtensionSettingsKey 'installation_mode' $installationMode)) { exit 1 }
    if (!(Test-RegValueWithDetails $browser.Name $browser.ExtensionSettingsKey 'update_url' $browser.UpdateUrl)) { exit 1 }

    # Toolbar pin - always verified; deploy script writes either pinned or unpinned value based on $forceToolbarPin
    $expectedToolbar = if ($forceToolbarPin -eq 1) { $browser.ToolbarPinnedValue } else { $browser.ToolbarUnpinnedValue }
    if (!(Test-RegValueWithDetails $browser.Name $browser.ExtensionSettingsKey $browser.ToolbarProp $expectedToolbar)) { exit 1 }
}

Write-Output "Check extension is correctly configured for Chrome and Edge."
exit 0
