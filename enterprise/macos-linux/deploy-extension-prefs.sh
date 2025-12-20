#!/bin/bash

# Check - Microsoft 365 Phishing Protection Extension
# Modern macOS Extension Preferences Deployment
# Uses direct plist manipulation instead of deprecated MCX

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROME_PREFS_DIR="/Library/Application Support/Google/Chrome"
EDGE_PREFS_DIR="/Library/Application Support/Microsoft Edge"
CHROME_PLIST_PATH="/Library/Preferences/com.google.Chrome.extensions.benimdeioplgkhanklclahllklceahbe.plist"
EDGE_PLIST_PATH="/Library/Preferences/com.microsoft.Edge.extensions.knepjpocdagponkonnbggpcnhnaikajg.plist"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (sudo)"
        exit 1
    fi
}

create_extension_preferences() {
    local plist_path="$1"
    local browser_name="$2"
    local custom_rules_url="$3"

    log_info "Creating extension preferences for $browser_name..."

    # Create the directory if it doesn't exist
    mkdir -p "$(dirname "$plist_path")"

    # Create the plist with extension settings
    cat > "$plist_path" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>showNotifications</key>
    <true/>
    <key>enableValidPageBadge</key>
    <true/>
    <key>enablePageBlocking</key>
    <true/>
    <key>enableCippReporting</key>
    <false/>
    <key>cippServerUrl</key>
    <string></string>
    <key>cippTenantId</key>
    <string></string>
    <key>customRulesUrl</key>
    <string>$custom_rules_url</string>
    <key>updateInterval</key>
    <integer>24</integer>
    <key>enableDebugLogging</key>
    <false/>
    <key>customBranding</key>
    <dict>
        <key>companyName</key>
        <string></string>
        <key>productName</key>
        <string></string>
        <key>supportEmail</key>
        <string></string>
        <key>primaryColor</key>
        <string>#F77F00</string>
        <key>logoUrl</key>
        <string></string>
    </dict>
</dict>
</plist>
EOF

    # Set proper permissions
    chown root:wheel "$plist_path"
    chmod 644 "$plist_path"

    # Validate the plist
    if plutil -lint "$plist_path" >/dev/null 2>&1; then
        log_success "Extension preferences created for $browser_name"
        return 0
    else
        log_error "Invalid plist created for $browser_name"
        return 1
    fi
}

install_preferences() {
    log_info "Installing extension preferences..."

    # Chrome preferences
    create_extension_preferences "$CHROME_PLIST_PATH" "Chrome" "https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/rules/detection-rules.json"

    # Edge preferences
    create_extension_preferences "$EDGE_PLIST_PATH" "Edge" ""

    # Restart cfprefsd to reload preferences
    log_info "Restarting preferences daemon..."
    killall cfprefsd 2>/dev/null || true

    log_success "Extension preferences installed successfully"
}

show_status() {
    log_info "Extension Preferences Status:"

    if [[ -f "$CHROME_PLIST_PATH" ]]; then
        log_success "Chrome extension preferences found"
        echo "  Path: $CHROME_PLIST_PATH"
        echo "  Size: $(stat -f%z "$CHROME_PLIST_PATH") bytes"
        echo "  Modified: $(stat -f%Sm "$CHROME_PLIST_PATH")"
    else
        log_warning "Chrome extension preferences not found"
    fi

    echo

    if [[ -f "$EDGE_PLIST_PATH" ]]; then
        log_success "Edge extension preferences found"
        echo "  Path: $EDGE_PLIST_PATH"
        echo "  Size: $(stat -f%z "$EDGE_PLIST_PATH") bytes"
        echo "  Modified: $(stat -f%Sm "$EDGE_PLIST_PATH")"
    else
        log_warning "Edge extension preferences not found"
    fi
}

remove_preferences() {
    log_info "Removing extension preferences..."

    if [[ -f "$CHROME_PLIST_PATH" ]]; then
        rm -f "$CHROME_PLIST_PATH"
        log_success "Chrome extension preferences removed"
    else
        log_info "Chrome extension preferences not found"
    fi

    if [[ -f "$EDGE_PLIST_PATH" ]]; then
        rm -f "$EDGE_PLIST_PATH"
        log_success "Edge extension preferences removed"
    else
        log_info "Edge extension preferences not found"
    fi

    # Restart cfprefsd to reload preferences
    log_info "Restarting preferences daemon..."
    killall cfprefsd 2>/dev/null || true
}

main() {
    local command="${1:-install}"

    echo "Check - Microsoft 365 Phishing Protection Extension"
    echo "Modern Extension Preferences Deployment"
    echo "======================================"
    echo

    case "$command" in
        "install")
            check_root
            install_preferences
            echo
            log_warning "Important Notes:"
            echo "1. Close and restart all browser instances"
            echo "2. Extensions must be installed separately via configuration profiles"
            echo "3. Check chrome://policy/ and edge://policy/ to verify policy application"
            echo "4. Extension settings should appear in the extension's options page"
            ;;

        "status")
            show_status
            ;;

        "uninstall")
            check_root
            remove_preferences
            ;;

        *)
            echo "Usage: $0 {install|status|uninstall}"
            echo ""
            echo "Commands:"
            echo "  install   - Deploy extension preferences"
            echo "  status    - Show current deployment status"
            echo "  uninstall - Remove extension preferences"
            exit 1
            ;;
    esac
}

main "$@"