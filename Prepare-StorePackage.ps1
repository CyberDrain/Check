# Store Publication Preparation Script
# Creates a single universal package for both Chrome Web Store and Edge Add-ons

param(
    [string]$Version = '1.3.0',
    [string]$OutputPath = 'store-packages'
)

Write-Host '🏪 Universal Store Package Preparation' -ForegroundColor Cyan

# Create output directory
if (!(Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath | Out-Null
}

# Determine source directory based on script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDir = $scriptDir  # Script is in the root directory

$devFilesToRemove = @(
    '*.md',
    '*.log',
    '.DS_Store',
    'Thumbs.db',
    '*.tmp'
)

function Remove-DevelopmentFiles {
    param(
        [string]$TargetDir
    )

    foreach ($pattern in $devFilesToRemove) {
        Get-ChildItem $TargetDir -Name $pattern -Recurse -Force 2>$null | ForEach-Object {
            $fullPath = Join-Path $TargetDir $_
            if (Test-Path $fullPath) {
                Remove-Item $fullPath -Force
                Write-Host "Removed dev file: $_" -ForegroundColor Gray
            }
        }
    }
}

function New-StorePackage {
    param(
        [string]$Title,
        [string]$TempDirName,
        [string[]]$FilesToInclude,
        [string]$PackageName,
        [switch]$RenameFirefoxManifest
    )

    $tempDir = Join-Path $env:TEMP $TempDirName
    Write-Host "📦 Preparing $Title..." -ForegroundColor Yellow

    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force
    }

    New-Item -ItemType Directory -Path $tempDir | Out-Null

    foreach ($item in $FilesToInclude) {
        $sourcePath = Join-Path $sourceDir $item
        if (Test-Path $sourcePath) {
            $destPath = Join-Path $tempDir $item
            if (Test-Path $sourcePath -PathType Container) {
                Copy-Item $sourcePath $destPath -Recurse -Force
            } else {
                Copy-Item $sourcePath $destPath -Force
            }
            Write-Host "✅ Included: $item" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Not found: $item" -ForegroundColor Yellow
        }
    }

    if ($RenameFirefoxManifest) {
        $firefoxManifestPath = Join-Path $tempDir 'manifest.firefox.json'
        $standardManifestPath = Join-Path $tempDir 'manifest.json'

        if (Test-Path $firefoxManifestPath) {
            if (Test-Path $standardManifestPath) {
                Remove-Item $standardManifestPath -Force
            }
            Rename-Item -Path $firefoxManifestPath -NewName 'manifest.json'
            Write-Host '✅ Renamed manifest.firefox.json to manifest.json' -ForegroundColor Green
        }
    }

    Remove-DevelopmentFiles -TargetDir $tempDir

    $manifestPath = Join-Path $tempDir 'manifest.json'
    if (Test-Path $manifestPath) {
        $manifest = Get-Content $manifestPath | ConvertFrom-Json
        $manifest.version = $Version
        $manifest.content_security_policy = @{
            extension_pages = "script-src 'self'; object-src 'self'"
        }

        $jsonString = $manifest | ConvertTo-Json -Depth 10
        $jsonString | Set-Content $manifestPath -Encoding UTF8
        Write-Host '✅ Updated manifest.json for store publishing' -ForegroundColor Green
    }

    $optionsPath = Join-Path $tempDir 'options\options.js'
    if (Test-Path $optionsPath) {
        $content = Get-Content $optionsPath -Raw
        $content = $content -replace 'const DEVELOPMENT_MODE = true', 'const DEVELOPMENT_MODE = false'
        $content | Set-Content $optionsPath -Encoding UTF8
        Write-Host '✅ Disabled development mode in options.js' -ForegroundColor Green
    }

    $packagePath = Join-Path $OutputPath $PackageName
    if (Test-Path $packagePath) {
        Remove-Item $packagePath -Force
    }

    Compress-Archive -Path "$tempDir\*" -DestinationPath $packagePath
    Remove-Item $tempDir -Recurse -Force

    $size = [math]::Round((Get-Item $packagePath).Length / 1MB, 2)
    Write-Host "✅ Created package: $PackageName ($size MB)" -ForegroundColor Green

    return @{
        Name = $PackageName
        Size = $size
    }
}

$baseFilesToInclude = @(
    'blocked.html',
    'config',
    'images',
    'options',
    'popup',
    'rules',
    'scripts',
    'styles'
)

$universalFilesToInclude = @('manifest.json') + $baseFilesToInclude
$firefoxFilesToInclude = @('manifest.firefox.json') + $baseFilesToInclude

$universalPackage = New-StorePackage `
    -Title 'universal Chrome/Edge package' `
    -TempDirName 'check-extension-package' `
    -FilesToInclude $universalFilesToInclude `
    -PackageName "check-extension-v$Version.zip"

$firefoxPackage = New-StorePackage `
    -Title 'Firefox package' `
    -TempDirName 'check-extension-package-firefox' `
    -FilesToInclude $firefoxFilesToInclude `
    -PackageName "check-extension-firefox-v$Version.zip" `
    -RenameFirefoxManifest

Write-Host ''
Write-Host '🎉 Store packages created successfully!' -ForegroundColor Green
Write-Host "📁 Location: $OutputPath" -ForegroundColor Cyan
Write-Host "  📦 $($universalPackage.Name) ($($universalPackage.Size) MB)" -ForegroundColor White
Write-Host "  🦊 $($firefoxPackage.Name) ($($firefoxPackage.Size) MB)" -ForegroundColor White

Write-Host ''
Write-Host '📋 Next Steps:' -ForegroundColor Yellow
Write-Host '1. Submit Chrome/Edge package to their stores:' -ForegroundColor White
Write-Host '   📤 Chrome Web Store: https://chrome.google.com/webstore/devconsole' -ForegroundColor Cyan
Write-Host '   📤 Edge Add-ons: https://partner.microsoft.com/dashboard/microsoftedge' -ForegroundColor Cyan
Write-Host '2. Submit Firefox package to AMO:' -ForegroundColor White
Write-Host '   🦊 Firefox Add-ons: https://addons.mozilla.org/developers/' -ForegroundColor Cyan
Write-Host '3. Note the assigned extension IDs from each store' -ForegroundColor White
Write-Host '4. Update enterprise registry files with store IDs:' -ForegroundColor White
Write-Host '   .\Update-StoreIDs.ps1 -ChromeID <chrome-id> -EdgeID <edge-id>' -ForegroundColor Gray
Write-Host '5. Test managed policies with store-installed extensions' -ForegroundColor White

Write-Host ''
Write-Host '💡 Remember: Firefox uses the dedicated Firefox ZIP from this script.' -ForegroundColor Yellow
