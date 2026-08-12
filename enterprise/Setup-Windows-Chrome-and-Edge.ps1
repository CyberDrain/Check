# Check Extension - Interactive Setup Script
# Downloads the latest Check extension deployment scripts from GitHub and walks you
# through configuring each setting. Outputs ready-to-upload scripts for Intune.
#
# Usage: Run this script in PowerShell. It will prompt for each setting and generate
# configured Deploy, Remove, and Detect scripts in your chosen output directory.
#
# For Intune deployment instructions, see:
# https://docs.check.tech/deployment/chrome-edge-deployment-instructions/windows/domain-deployment#intune

Write-Host ""
Write-Host "======================================================" -ForegroundColor DarkCyan
Write-Host "  Check by CyberDrain - Intune Deployment Setup" -ForegroundColor DarkCyan
Write-Host "======================================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "This script will download the latest Check extension scripts from GitHub"
Write-Host "and walk you through configuring each setting for your environment."
Write-Host ""

# GitHub raw URLs for the template scripts
$baseUrl = "https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/enterprise"
$scripts = @{
    Deploy = @{ Url = "$baseUrl/Deploy-Windows-Chrome-and-Edge.ps1"; FileName = "Deploy-Windows-Chrome-and-Edge.ps1" }
    Remove = @{ Url = "$baseUrl/Remove-Windows-Chrome-and-Edge.ps1"; FileName = "Remove-Windows-Chrome-and-Edge.ps1" }
    Detect = @{ Url = "$baseUrl/Detect-Windows-Chrome-and-Edge.ps1"; FileName = "Detect-Windows-Chrome-and-Edge.ps1" }
}

# Download templates
Write-Host "Downloading latest scripts from GitHub..." -ForegroundColor Yellow
$templates = @{}
foreach ($key in $scripts.Keys) {
    try {
        $templates[$key] = Invoke-WebRequest -Uri $scripts[$key].Url -UseBasicParsing -TimeoutSec 30 | Select-Object -ExpandProperty Content
        Write-Host "  Downloaded $($scripts[$key].FileName)" -ForegroundColor Green
    } catch {
        Write-Host "  Failed to download $($scripts[$key].FileName): $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Please check your internet connection and try again." -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Prompt helper functions
function Read-Setting {
    param (
        [string]$Name,
        [string]$Description,
        [string]$Default,
        [string]$Type = "string"
    )
    $prompt = "$Name - $Description"
    if ($Default -ne "") {
        $prompt += " [default: $Default]"
    } else {
        $prompt += " [default: blank]"
    }
    $value = Read-Host $prompt
    if ($value -eq "") { $value = $Default }

    if ($Type -eq "bool") {
        while ($value -ne "0" -and $value -ne "1") {
            Write-Host "  Please enter 0 or 1." -ForegroundColor Yellow
            $value = Read-Host $prompt
            if ($value -eq "") { $value = $Default }
        }
    }
    if ($Type -eq "int") {
        while ($value -notmatch '^\d+$') {
            Write-Host "  Please enter a number." -ForegroundColor Yellow
            $value = Read-Host $prompt
            if ($value -eq "") { $value = $Default }
        }
        if ($Name -eq "updateInterval") {
            while ([int]$value -lt 1 -or [int]$value -gt 168) {
                Write-Host "  Update interval must be between 1 and 168 hours." -ForegroundColor Yellow
                $value = Read-Host $prompt
                if ($value -eq "") { $value = $Default }
            }
        }
    }
    if ($Type -eq "string" -and $value -match '"') {
        while ($value -match '"') {
            Write-Host "  Double-quote characters are not supported in this field." -ForegroundColor Yellow
            $value = Read-Host $prompt
            if ($value -eq "") { $value = $Default }
        }
    }
    return $value
}

function Read-ArraySetting {
    param (
        [string]$Name,
        [string]$Description
    )
    Write-Host "$Name - $Description"
    Write-Host "  Enter values one at a time. Press Enter on a blank line when done."
    $values = @()
    $i = 1
    while ($true) {
        $entry = Read-Host "  [$i]"
        if ($entry -eq "") { break }
        $values += $entry
        $i++
    }
    return $values
}

#######################################################################
# Extension Configuration Settings
#######################################################################
Write-Host "--- Extension Configuration Settings ---" -ForegroundColor Cyan
Write-Host ""

$cfg_showNotifications = Read-Setting -Name "showNotifications" -Description "Show notifications (0 = Disabled, 1 = Enabled)" -Default "1" -Type "bool"
$cfg_enableValidPageBadge = Read-Setting -Name "enableValidPageBadge" -Description "Show valid page badge (0 = Disabled, 1 = Enabled)" -Default "0" -Type "bool"
$cfg_enablePageBlocking = Read-Setting -Name "enablePageBlocking" -Description "Enable page blocking (0 = Disabled, 1 = Enabled)" -Default "1" -Type "bool"
$cfg_forceToolbarPin = Read-Setting -Name "forceToolbarPin" -Description "Force pin extension to toolbar (0 = Not pinned, 1 = Force pinned)" -Default "1" -Type "bool"
$cfg_updateInterval = Read-Setting -Name "updateInterval" -Description "Update interval in hours (1-168)" -Default "24" -Type "int"
$cfg_enableDebugLogging = Read-Setting -Name "enableDebugLogging" -Description "Enable debug logging (0 = Disabled, 1 = Enabled)" -Default "0" -Type "bool"
$cfg_domainSquattingEnabled = Read-Setting -Name "domainSquattingEnabled" -Description "Enable domain squatting detection (0 = Disabled, 1 = Enabled)" -Default "0" -Type "bool"
$cfg_customRulesUrl = Read-Setting -Name "customRulesUrl" -Description "Custom rules/config URL (leave blank if not used)" -Default ""
Write-Host ""

#######################################################################
# CIPP Reporting
#######################################################################
Write-Host "--- CIPP Reporting ---" -ForegroundColor Cyan
Write-Host ""

$cfg_enableCippReporting = Read-Setting -Name "enableCippReporting" -Description "Enable CIPP reporting (0 = Disabled, 1 = Enabled)" -Default "0" -Type "bool"
if ($cfg_enableCippReporting -eq "1") {
    $cfg_cippServerUrl = Read-Setting -Name "cippServerUrl" -Description "CIPP Server URL (e.g., https://cipp.cyberdrain.com)" -Default ""
    $cfg_cippTenantId = Read-Setting -Name "cippTenantId" -Description "Tenant ID or domain for CIPP reporting" -Default ""
} else {
    $cfg_cippServerUrl = ""
    $cfg_cippTenantId = ""
}
Write-Host ""

#######################################################################
# Generic Webhook Settings
#######################################################################
Write-Host "--- Generic Webhook Settings ---" -ForegroundColor Cyan
Write-Host ""

$cfg_enableGenericWebhook = Read-Setting -Name "enableGenericWebhook" -Description "Enable generic webhook (0 = Disabled, 1 = Enabled)" -Default "0" -Type "bool"
if ($cfg_enableGenericWebhook -eq "1") {
    $cfg_webhookUrl = Read-Setting -Name "webhookUrl" -Description "Webhook URL (e.g., https://webhook.example.com/endpoint)" -Default ""
    $cfg_webhookEvents = Read-ArraySetting -Name "webhookEvents" -Description "Event types to send. Available: detection_alert, false_positive_report, page_blocked, rogue_app_detected, threat_detected, validation_event"
} else {
    $cfg_webhookUrl = ""
    $cfg_webhookEvents = @()
}
Write-Host ""

#######################################################################
# URL Allowlist
#######################################################################
Write-Host "--- URL Allowlist ---" -ForegroundColor Cyan
Write-Host ""

$cfg_urlAllowlist = Read-ArraySetting -Name "urlAllowlist" -Description "URLs to allowlist. Supports wildcards (e.g., https://*.example.com) and regex patterns"
Write-Host ""

#######################################################################
# Custom Branding Settings
#######################################################################
Write-Host "--- Custom Branding Settings ---" -ForegroundColor Cyan
Write-Host ""

$cfg_companyName = Read-Setting -Name "companyName" -Description "Company name" -Default "CyberDrain"
$cfg_productName = Read-Setting -Name "productName" -Description "Product name" -Default "Check - Phishing Protection"
$cfg_supportEmail = Read-Setting -Name "supportEmail" -Description "Support email address" -Default ""
$cfg_supportUrl = Read-Setting -Name "supportUrl" -Description "Support URL" -Default ""
$cfg_privacyPolicyUrl = Read-Setting -Name "privacyPolicyUrl" -Description "Privacy policy URL" -Default ""
$cfg_aboutUrl = Read-Setting -Name "aboutUrl" -Description "About URL" -Default ""
$cfg_primaryColor = Read-Setting -Name "primaryColor" -Description "Primary color (hex code)" -Default "#F77F00"
$cfg_logoUrl = Read-Setting -Name "logoUrl" -Description "Logo URL (https, recommended 48x48, max 128x128)" -Default ""
Write-Host ""

#######################################################################
# Output Path
#######################################################################
Write-Host "--- Output ---" -ForegroundColor Cyan
Write-Host ""

$defaultOutputPath = (Get-Location).Path
$outputPath = Read-Host "Output directory [default: $defaultOutputPath]"
if ($outputPath -eq "") { $outputPath = $defaultOutputPath }

if (!(Test-Path $outputPath)) {
    New-Item -Path $outputPath -ItemType Directory -Force | Out-Null
    Write-Host "Created output directory: $outputPath" -ForegroundColor Green
}
Write-Host ""

#######################################################################
# Build replacement map
#######################################################################

# Helper to build a PowerShell array literal string from an array
function Format-ArrayLiteral {
    param ([string[]]$Values)
    if ($Values.Count -eq 0) { return '@()' }
    $quoted = $Values | ForEach-Object { $escaped = $_ -replace "'", "''"; "'$escaped'" }
    return "@($($quoted -join ', '))"
}

# Helper to emit a single-quoted PowerShell string literal from a value.
# Single quotes prevent $ and backtick interpolation in the generated scripts.
function Format-SingleQuoted {
    param ([string]$Value)
    $escaped = $Value -replace "'", "''"
    return "'$escaped'"
}

# Each entry: variable assignment pattern to find -> replacement value
# Scalar replacements target the value + start of inline comment
$replacements = @(
    @{ Pattern = '$showNotifications = 1 #';         Value = "`$showNotifications = $cfg_showNotifications #" }
    @{ Pattern = '$enableValidPageBadge = 0 #';      Value = "`$enableValidPageBadge = $cfg_enableValidPageBadge #" }
    @{ Pattern = '$enablePageBlocking = 1 #';        Value = "`$enablePageBlocking = $cfg_enablePageBlocking #" }
    @{ Pattern = '$forceToolbarPin = 1 #';           Value = "`$forceToolbarPin = $cfg_forceToolbarPin #" }
    @{ Pattern = '$enableCippReporting = 0 #';       Value = "`$enableCippReporting = $cfg_enableCippReporting #" }
    @{ Pattern = '$cippServerUrl = "" #';            Value = "`$cippServerUrl = $(Format-SingleQuoted $cfg_cippServerUrl) #" }
    @{ Pattern = '$cippTenantId = "" #';             Value = "`$cippTenantId = $(Format-SingleQuoted $cfg_cippTenantId) #" }
    @{ Pattern = '$customRulesUrl = "" #';           Value = "`$customRulesUrl = $(Format-SingleQuoted $cfg_customRulesUrl) #" }
    @{ Pattern = '$updateInterval = 24 #';           Value = "`$updateInterval = $cfg_updateInterval #" }
    @{ Pattern = '$domainSquattingEnabled = 0 #';    Value = "`$domainSquattingEnabled = $cfg_domainSquattingEnabled #" }
    @{ Pattern = '$enableDebugLogging = 0 #';        Value = "`$enableDebugLogging = $cfg_enableDebugLogging #" }
    @{ Pattern = '$enableGenericWebhook = 0 #';      Value = "`$enableGenericWebhook = $cfg_enableGenericWebhook #" }
    @{ Pattern = '$webhookUrl = "" #';               Value = "`$webhookUrl = $(Format-SingleQuoted $cfg_webhookUrl) #" }
    @{ Pattern = '$companyName = "CyberDrain" #';    Value = "`$companyName = $(Format-SingleQuoted $cfg_companyName) #" }
    @{ Pattern = '$productName = "Check - Phishing Protection" #'; Value = "`$productName = $(Format-SingleQuoted $cfg_productName) #" }
    @{ Pattern = '$supportEmail = "" #';             Value = "`$supportEmail = $(Format-SingleQuoted $cfg_supportEmail) #" }
    @{ Pattern = '$supportUrl = "" #';               Value = "`$supportUrl = $(Format-SingleQuoted $cfg_supportUrl) #" }
    @{ Pattern = '$privacyPolicyUrl = "" #';         Value = "`$privacyPolicyUrl = $(Format-SingleQuoted $cfg_privacyPolicyUrl) #" }
    @{ Pattern = '$aboutUrl = "" #';                 Value = "`$aboutUrl = $(Format-SingleQuoted $cfg_aboutUrl) #" }
    @{ Pattern = '$primaryColor = "#F77F00" #';      Value = "`$primaryColor = $(Format-SingleQuoted $cfg_primaryColor) #" }
    @{ Pattern = '$logoUrl = "" #';                  Value = "`$logoUrl = $(Format-SingleQuoted $cfg_logoUrl) #" }
)

# Array replacements — replace the full assignment line including inline comment
$arrayReplacements = @(
    @{ Pattern = '$urlAllowlist = @() #';     Value = "`$urlAllowlist = $(Format-ArrayLiteral $cfg_urlAllowlist) #" }
    @{ Pattern = '$webhookEvents = @() #';    Value = "`$webhookEvents = $(Format-ArrayLiteral $cfg_webhookEvents) #" }
)

#######################################################################
# Apply replacements and write output files
#######################################################################

function Apply-Replacements {
    param (
        [string]$Content,
        [string]$TemplateName
    )

    $missing = [System.Collections.Generic.List[string]]::new()

    foreach ($r in $replacements) {
        if ($Content.Contains($r.Pattern)) {
            $Content = $Content.Replace($r.Pattern, $r.Value)
        } else {
            $missing.Add($r.Pattern)
        }
    }
    foreach ($r in $arrayReplacements) {
        if ($Content.Contains($r.Pattern)) {
            $Content = $Content.Replace($r.Pattern, $r.Value)
        } else {
            $missing.Add($r.Pattern)
        }
    }

    if ($missing.Count -gt 0) {
        $list = ($missing | ForEach-Object { "  - $_" }) -join "`n"
        throw "Failed to customize the $TemplateName template; the following expected pattern(s) were not found:`n$list`nThe upstream template format may have changed."
    }

    return $Content
}

# Deploy script — apply all replacements
$deployContent = Apply-Replacements -Content $templates['Deploy'] -TemplateName 'Deploy'
$deployPath = Join-Path $outputPath $scripts['Deploy'].FileName
Set-Content -Path $deployPath -Value $deployContent -Encoding UTF8
Write-Host "Written: $deployPath" -ForegroundColor Green

# Detect script — apply all replacements (same config block format)
$detectContent = Apply-Replacements -Content $templates['Detect'] -TemplateName 'Detect'
$detectPath = Join-Path $outputPath $scripts['Detect'].FileName
Set-Content -Path $detectPath -Value $detectContent -Encoding UTF8
Write-Host "Written: $detectPath" -ForegroundColor Green

# Remove script — copy as-is (no config to replace)
$removePath = Join-Path $outputPath $scripts['Remove'].FileName
Set-Content -Path $removePath -Value $templates['Remove'] -Encoding UTF8
Write-Host "Written: $removePath" -ForegroundColor Green

Write-Host ""
Write-Host "======================================================" -ForegroundColor DarkCyan
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "Your configured scripts are in: $outputPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Package the scripts as a Win32 app (.intunewin) or use Intune's script deployment"
Write-Host "  2. Upload to Microsoft Intune admin center > Apps > Windows"
Write-Host "  3. Set install command:   powershell.exe -ExecutionPolicy Bypass -File Deploy-Windows-Chrome-and-Edge.ps1"
Write-Host "  4. Set uninstall command: powershell.exe -ExecutionPolicy Bypass -File Remove-Windows-Chrome-and-Edge.ps1"
Write-Host "  5. Add detection script:  Detect-Windows-Chrome-and-Edge.ps1"
Write-Host "  6. Assign to devices/users as Required"
Write-Host ""
