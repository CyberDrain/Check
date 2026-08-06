---
icon: apple
---

# macOS

We recommend deploying Check through your MDM if the goal is to install it automatically without user interaction.

A custom `.mobileconfig` file can be uploaded to most MDMs if they don't have built-in profile-building functionality for Google Chrome or Microsoft Edge.

Here's an example XML profile for a mobile configuration that installs Check in Microsoft Edge and Google Chrome.

```
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>
		<dict>
			<key>ExtensionInstallForcelist</key>
			<array>
				<string>benimdeioplgkhanklclahllklceahbe</string>
			</array>
			<key>PayloadDisplayName</key>
			<string>Google Chrome</string>
			<key>PayloadIdentifier</key>
			<string>com.google.Chrome.23E5DDCF-1EB2-4869-9510-5E47D6640A85</string>
			<key>PayloadType</key>
			<string>com.google.Chrome</string>
			<key>PayloadUUID</key>
			<string>23E5DDCF-1EB2-4869-9510-5E47D6640A85</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>
		<dict>
			<key>ExtensionInstallForcelist</key>
			<array>
				<string>knepjpocdagponkonnbggpcnhnaikajg</string>
			</array>
			<key>PayloadDisplayName</key>
			<string>Microsoft Edge</string>
			<key>PayloadIdentifier</key>
			<string>com.microsoft.Edge.DD4A940A-B216-4D5E-8B2C-1EF2CAFF7F38</string>
			<key>PayloadType</key>
			<string>com.microsoft.Edge</string>
			<key>PayloadUUID</key>
			<string>DD4A940A-B216-4D5E-8B2C-1EF2CAFF7F38</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
		</dict>
	</array>
	<key>PayloadDescription</key>
	<string>This profile installs and enforces the 'Check' browser extension from CyberDrain on Google Chrome and Microsoft Edge web browsers. </string>
	<key>PayloadDisplayName</key>
	<string>Check CyberDrain</string>
	<key>PayloadIdentifier</key>
	<string>020D4Z7P-7F1A-4723-89CB-1826F8BAF4B5</string>
	<key>PayloadOrganization</key>
	<string>YOUR ORG NAME</string>
	<key>PayloadScope</key>
	<string>System</string>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadUUID</key>
	<string>020D4Z7P-7F1A-4723-89CB-1826F8BAF4B5</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
	<key>RemovalDate</key>
	<date>2044-05-19T21:46:44Z</date>
	<key>TargetDeviceType</key>
	<integer>5</integer>
</dict>
</plist>
```
You could also deploy it in Chrome from the command line by creating the appropriate JSON object in the correct location under the core `/Library` directory in macOS. Credit goes to @cezaraugusto for the script, which was slightly modified to install Check when no parameter is passed. You can also pass another Chrome extension ID after the script path to install that extension.

```
#!/bin/bash

# https://developer.chrome.com/docs/extensions/mv3/external_extensions/#preferences
# Credit to #cezaraugusto# from GitHub Gist for this script, slightly modified to install Check by CyberDrain if no parameter is passed
# https://gist.github.com/cezaraugusto
# https://gist.github.com/cezaraugusto/0101d2cb251c088f398ca0f8d4495ca0

extension=$1

if [[ -z "$extension" ]]; then
  extension="benimdeioplgkhanklclahllklceahbe"
fi
install_chrome_extension() {
  chrome_extensions_folder="/Library/Application Support/Google/Chrome/External Extensions"
  chrome_extensions_preferences_file="$chrome_extensions_folder/$extension.json"
  # This URL is used by Chrome to check for updates to external extensions
  update_services_url="https://clients2.google.com/service/update2/crx"

if [[ -d "$chrome_extensions_folder" ]]; then
  mkdir -p "$chrome_extensions_folder"
fi

  echo "{" > "$chrome_extensions_preferences_file"
  echo "  \"external_update_url\": \"$update_services_url\"" >> "$chrome_extensions_preferences_file"
  echo "}" >> "$chrome_extensions_preferences_file"

  echo "Added \"$chrome_extensions_preferences_file\""
}

if [ $# -ne 1 ]; then
  echo "Usage: $0 <extension_id>"
  exit 1
fi

install_chrome_extension "$extension"

# Usage:
# ./install_extension.sh <extension_id>
# Sample: adding React Dev Tools from the command line to Chrome
# ./install_extension.sh fmkadmapgofadopljbjfkapdkoienihi
```

This does not install the extension until the next time Chrome is launched. The user will then be required to approve it.

<img width="448" height="330" alt="SCR-20260520-krbi" src="https://github.com/user-attachments/assets/f53a13fe-c16b-4941-aa39-0799b2b32b6e" />
Due to limitations like this, it is better to deploy the extension through an MDM.

If you have experience deploying managed macOS browser extensions, please contribute to the [docs via GitHub](https://github.com/CyberDrain/Check/tree/dev/docs). All macOS resources in the GitHub repo should be considered inaccurate until tested.
