---
description: >-
  This page will outline the various ways that you can deploy Check to your
  clients' environments
icon: bolt
---

# Chrome/Edge Deployment Instructions

Review the below options for how to deploy Check to your clients' environments. If you use a RMM not featured, please see the [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") option to script the install.

<details>

<summary>Intune</summary>

**Prepare Your Extension Configuration JSON**

You need to generate two JSON strings:

* One for **Chrome**
* One for **Edge**

Each JSON should include the following settings. Please review all settings. Any that you do not set will use the defaults. For more detailed descriptions of what each option is, please see the [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") script.

Chrome:

```json

{
  "benimdeioplgkhanklclahllklceahbe": {
    "installation_mode": "force_installed",
    "update_url": "https://clients2.google.com/service/update2/crx",
    "settings": {
      "showNotifications": true,
      "enableValidPageBadge": false,
      "enablePageBlocking": false,
      "enableCippReporting": true,
      "cippServerUrl": "https://yourserver.com",
      "cippTenantId": "your-tenant-id",
      "customRulesUrl": "https://yourrules.com",
      "updateInterval": 24,
      "enableDebugLogging": false,
      "customBranding": {
        "companyName": "Your Company",
        "productName": "Check",
        "supportEmail": "support@yourcompany.com",
        "primaryColor": "#FF0000",
        "logoUrl": "https://yourcompany.com/logo.png"
      }
    }
  }
}

```

Edge:

```json

{
  "knepjpocdagponkonnbggpcnhnaikajg": {
    "installation_mode": "force_installed",
    "update_url": "https://edge.microsoft.com/extensionwebstorebase/v1/crx",
    "settings": {
      "showNotifications": true,
      "enableValidPageBadge": false,
      "enablePageBlocking": false,
      "enableCippReporting": true,
      "cippServerUrl": "https://yourserver.com",
      "cippTenantId": "your-tenant-id",
      "customRulesUrl": "https://yourrules.com",
      "updateInterval": 60,
      "enableDebugLogging": false,
      "customBranding": {
        "companyName": "Your Company",
        "productName": "Check",
        "supportEmail": "support@yourcompany.com",
        "primaryColor": "#FF0000",
        "logoUrl": "https://yourcompany.com/logo.png"
      }
    }
  }
}

```

**Create a Custom Configuration Profile in Intune for Chrome**

1. **Sign in** to Microsoft Intune Admin Center
2. Go to **Devices** > Configuration profiles > Create Profile
3. Choose:
   1. Platform: Windows 10 and later
   2. Profile type: Templates
   3. Template name: Custom
4. Click Create and fill in:
   1. Name: Chrome Extension - Check
   2. Description: Deploys and configures the Check Chrome extension
5. Under Configuration settings, click Add and enter:
   1. Name: Chrome Extension Settings
   2. Description: Configure Check Chrome extension settings
   3. OMA-URI: ./Device/Vendor/MSFT/Policy/Config/Chrome~~Policy~~googlechrome/ExtensionSettings
   4. Data Type: String
   5. Value: Paste the Chrome JSON created above.
6. Click Next, assign the profile to the appropriate groups, and **Create** the profile

**Create a Custom Configuration Profile in Intune for Edge**

1. Repeat the steps above with the following changes:
   1. Name: Edge Extension - Check
   2. Description: Deploys and configures the Check Edge Extension
   3. OMA-URI: ./Device/Vendor/MSFT/Policy/Config/Edge/ExtensionSettings
   4. Value: Paste the Edge JSON created above

</details>

<details>

<summary>Generic PowerShell</summary>

**Modify the following script and copy it to your RMM's scripting engine to deploy Check:**

{% hint style="info" %}
This script is designed to deploy the extension to both Chrome and Edge. It is recommended to deploy both even if you standardize on one. This will provide you with better protection in the case someone uses the non-favored browser.
{% endhint %}

1. Review the Extension Configuration Settings and Custom Branding Settings variables and update those to your desired values. The current values in the script are the default values. Leaving any unchanged will set the defaults.
2. If you are leveraging a RMM that has the ability to define the variables in the deployment section of scripting, then you may be able to remove this section and enter the variable definitions into the RMM scripting pages.

{% code overflow="wrap" lineNumbers="true" fullWidth="true" %}
```powershell
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
$enableCippReporting = 0 # 0 = Unchecked, 1 = Checked (Enabled); default is 1; This will set the "Enable CIPP Reporting" option in the extension settings.
$cippServerUrl = "" # This will set the "CIPP Server URL" option in the extension settings; default is blank; if you set $enableCippReporting to 1, you must set this to a valid URL.
$cippTenantId = "" # This will set the "Tenant ID/Domain" option in the extension settings; default is blank; if you set $enableCippReporting to 1, you must set this to a valid Tenant ID.
$customRulesUrl = "" # This will set the "Config URL" option in the Detection Configuration settings; default is blank.
$updateInterval = 24 # This will set the "Update Interval" option in the Detection Configuration settings; default is 24 (hours). Range: 1-168 hours (1 hour to 1 week).
$enableDebugLogging = 0 # 0 = Unchecked, 1 = Checked (Enabled); default is 0; This will set the "Enable Debug Logging" option in the Activity Log settings.

# Custom Branding Settings
$companyName = "CyberDrain" # This will set the "Company Name" option in the Custom Branding settings; default is "CyberDrain".
$companyURL = "https://cyberdrain.com" # This will set the Company URL option in the Custom Branding settings; default is "https://cyberdrain.com"
$productName = "Check - Phishing Protection" # This will set the "Product Name" option in the Custom Branding settings; default is "Check - Phishing Protection".
$supportEmail = "" # This will set the "Support Email" option in the Custom Branding settings; default is blank.
$primaryColor = "#F77F00" # This will set the "Primary Color" option in the Custom Branding settings; default is "#F77F00"; must be a valid hex color code (e.g., #FFFFFF).
$logoUrl = "" # This will set the "Logo URL" option in the Custom Branding settings; default is blank.

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

    # Create and configure extension settings
    if (!(Test-Path $ExtensionSettingsKey)) {
        New-Item -Path $ExtensionSettingsKey -Force | Out-Null
    }

    # Set extension settings
    New-ItemProperty -Path $ExtensionSettingsKey -Name "installation_mode" -PropertyType String -Value $installationMode -Force | Out-Null
    New-ItemProperty -Path $ExtensionSettingsKey -Name "update_url" -PropertyType String -Value $UpdateUrl -Force | Out-Null

    Write-Output "Configured extension settings for $ExtensionId"
}

# Configure settings for Chrome and Edge
Configure-ExtensionSettings -ExtensionId $chromeExtensionId -UpdateUrl $chromeUpdateUrl -ManagedStorageKey $chromeManagedStorageKey -ExtensionSettingsKey $chromeExtensionSettingsKey
Configure-ExtensionSettings -ExtensionId $edgeExtensionId -UpdateUrl $edgeUpdateUrl -ManagedStorageKey $edgeManagedStorageKey -ExtensionSettingsKey $edgeExtensionSettingsKey
```
{% endcode %}

</details>

<details>

<summary>Group Policy</summary>

1. Download the following from the Check repo on GitHub
   1. ​[Deploy-ADMX.ps1](../../enterprise/Deploy-ADMX.ps1)
   2. ​[Check-Extension.admx](../../enterprise/admx/Check-Extension.admx)​
   3. ​[Check-Extension.adml](../../enterprise/admx/en-US/Check-Extension.adml)​
2. Run Deploy-ADMX.ps1. As long as you keep the other two files in the same folder, it will correctly add the available objects to Group Policy.
3. Open Group Policy and create a policy using the imported settings that can be found:

![](<../.gitbook/assets/image (2).png>)\\

</details>

<details>

<summary>Action1</summary>

For Action1, you can use the script in [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") to create a ps1 file and deploy it via a [custom package in the software repository](https://www.action1.com/documentation/add-custom-packages-to-app-store/) or via the [script library](https://www.action1.com/documentation/script-library/).

</details>

<details>

<summary>Acronis RMM</summary>

For Acronis RMM, you can use the script in [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention")to [create a script in the Script repository](https://www.acronis.com/en-us/support/documentation/CyberProtectionService/#cyber-scripting-creating-script.html) and then running the script via a [Script Plan](https://www.acronis.com/en-us/support/documentation/CyberProtectionService/#cyber-scripting-scripting-plans.html).

</details>

<details>

<summary>ConnectWise Automate</summary>

1. Go to **Automation** > **Scripts** > **Script Manager**
2. Create a new script
3. Add a PowerShell Execute Script step
4. Copy in the [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") script.
5. Save and assign the script to your targetted devices.

</details>

<details>

<summary>Datto RMM</summary>

1. Go to **Automation** > **Components**
2. Create a new Custom Component
3. Copy in the [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") script
4. Save and publish the component
5. Navigate to **Automation** > **Jobs** > **Create Job**
6. Name the job Check Browser Extension Deployment
7. Add the custom component you just created
8. Target your selected device(s)
9. Schedule the job

</details>

<details>

<summary>Immy.bot</summary>

Immy.bot includes a pre-built Global Computer Task for Check browser extension deployment.\
Due to how flexible Immy is, this may look intimidating at first, but it is quite easy and nearly purely UI-driven!\
Follow these steps to deploy Check using Immy.bot:

**Step 1: Create a Deployment**

1. **Navigate to Deployments** in the left menu
2. Click **New** to create a deployment
3. **Select the Global Task**: Choose "Check by Cyberdrain" from the available global tasks
4. **Configure Enforcement Type**:
   * **Required**: Automatically applies during maintenance sessions
   * **Onboarding**: Applied only during computer onboarding
   * **Ad Hoc**: Run only when explicitly triggered
5. **Select Targets**:
   * **Cross Tenant**: Apply to all computers across all tenants
   * **Single Tenant**: Apply to computers in a specific tenant
   * **Individual**: Target specific computers or users
   * Use filters, tags, or integration-specific targeting as needed

**Step 2: Customize Parameters**

1. **Configure Task Parameters** to customize the deployment for your environment:
   * Set company branding options (company name, logo URL, primary color)
   * Configure CIPP reporting settings (server URL, tenant ID)
   * Adjust notification and blocking preferences
   * Set custom detection rules URL if needed
2. **Set Dependencies** if required (e.g., ensure Windows updates are applied first)
3. **Configure Scheduling** if using time-based deployment

**Step 3: Deploy and Monitor**

1. Click **Create** to save the deployment
2. **Run a Maintenance Session** to apply the deployment:
   * Navigate to the target computers
   * Initiate maintenance session to execute deployments
3. **Monitor Results** through ImmyBot's maintenance session logs
4. Review deployment status and address any failures

**Best Practices for Immy.bot Deployment**

* **Test First**: Create a test deployment targeting a small group before rolling out globally
* **Use Targeting**: Leverage Immy's advanced targeting to deploy based on computer properties, user assignments, or custom criteria
* **Monitor Compliance**: Set up recurring maintenance sessions to ensure Check remains installed and properly configured
* **Handle Exceptions**: Create separate deployments for customers requiring different configurations

For detailed information about Immy deployments, tasks, and maintenance sessions, refer to the [Immy.bot Documentation](https://docs.immy.bot).

</details>

<details>

<summary>Kaseya VSA</summary>

1. Go to **Agent Procedures** > **Installer Wizards** > **Application Deploy**
2. Upload a .ps1 of the [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") script
3. Choose Private or Shared Files
4. Select installer type
5. Add command-line options
6. Name the procedure Check Browser Extension Deployment
7. Save and schedule the script for deployment

</details>

<details>

<summary>ManageEngine Endpoint Central</summary>

1. Navigate to **Manage** > **Extension Repository**
2. Click **Add Extensions** and click the desired browser
3. Select the Web Store Extension Type
4. Enter the extension ID:
   1. Chrome: benimdeioplgkhanklclahllklceahbe
   2. Edge: knepjpocdagponkonnbggpcnhnaikajg
5. Click **Add** after each
6. Navigate to **Browsers** > **Manage** > **Groups & Computers**
7. Select the custom groups or computers you wish to distribute the extension to
8. Click **Distribute Extensions**
9. Select the extensions you just added to the repository
10. Click **Distribute**

</details>

<details>

<summary>N-able N-Central</summary>

1. Go to **Configuration** > **Scheduled Tasks** > **Script/Software Repository**
2. Click **Add** > **Script**
3. Choose:
   1. Script Type: **PowerShell**
   2. Operating System: **Windows**
4. Upload a .ps1 of the [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") script or paste the script directly
5. Name the script `Check Browser Extension Deployment`
6. Save the script
7. Go to **Configuration** > **Scheduled Task** > **Add Task**
8. Choose **Run a Script**
9. Select the script you just uploaded
10. Configure the task
    1. Name: **Check Browser Extension Deployment**
    2. Target Devices: Choose specific devices, groups, or filters
    3. Schedule: Set to your desired interval. We recommend on login/startup for best results but a lower frequency can also ensure deployment to all macines
    4. Execution Context: **System Account**
11. Click **Save and Activate**

</details>

<details>

<summary>N-able N-Sight</summary>

1. Go to **Settings** > **Script Manager**
2. Click **New**
3. Enter `Check Browser Extension Deployment` for the name and a brief description
4. Set a timeout period for the script of 600 seconds
5. Upload a .ps1 file of the [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") script leaving `Script check and automated task` selected
6. Click **Save**
7. On the **All Devices** view, right-click your targeted Client or Site
8. Select **Task** > **Add**
9. Select the script you just uploaded
10. Enter a name for the task, e.g. `<Client/Site> Check Browser Extension Deployment`
11. Select `Once per day` for the frequency method
12. Set a **Start Date**, **Start Time**, **End Date**, and **End Time** as desired
13. Set a maximum permitted execution time e.g. 600 seconds
14. Set `Run task as soon as possible if schedule is missed`
15. Select **Next**
16. Select the targeted devices and click **Add Task**

</details>

<details>

<summary>NinjaOne</summary>

1. Go to **Administration** > **Library > Automation > Add > New Script**

1) Enter:
   1. Name `Check Browser Extension Deployment`
   2. Description: To deploy Check by CyberDrain for Edge and Chrome
   3. Categories: Select as approriate for your environment
   4. Language: PowerShell
   5. Operating System: Windows
   6. Architechture: All
   7. Run As: System
   8. Script Variables: Add as desired to customize
2) Copy the [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") script into the editor
3) Click **Save**
4) Go to **Administration** > **Policies**
5) Options are to create a new policy or add the automation to an existing policy targeting Windows devices
6) Select **Scheduled Automation** on the left
7) Click **Add a Scheduled automation** button
8) Select the script and set the options for frequency, add variables, etc.
9) Click **Add**
10) Click **Save**

</details>

<details>

<summary>Pulseway</summary>

1. Go to **Automation** > **Scripts**
2. (Optional) Create a new **Script Category** called Browser Extensions
3. Click **Create Script**
4. Name the Script `Check Browser Extension Deployment`
5. Toggle **Enabled** under the Windows tab
6. Select **PowerShell** as the script type
7. Paste the [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") script into the editor
8. Click **Save Script**
9. Navigate to **Automation** > **Tasks**
10. Click **Create Task**
11. Name the task `Check Browser Extension Deployment`
12. Choose the PowerShell script you just added
13. Set the **Scope** to **All Systems** or create a custom scope
14. Set **Daily** for **Schedule**
15. Save the task

</details>

<details>

<summary>SuperOps.ai</summary>

1. Navigate to **Modules** > **Scripts**
2. Click **+ Scrip**t
3. Name the script `Check Browser Extension Depoloyment`
4. Choose **PowerShell** as the language
5. Paste the [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") script
6. Set a timeout of 600 seconds
7. Choose to run as **System/Root User**
8. Save the script
9. SuperOps has multiple ways to deploy a scheduled action. Please review their documentation for your preferred method

</details>

<details>

<summary>Syncro</summary>

1. Navigate to the **Scripts** tab
2. Click **+Script**
3. Name the script `Check Browser Extension Deployment`
4. Choose **PowerShell** as the file type
5. Set **Run As** to **System**
6. Copy the [#generic-powershell](chrome-edge-deployment-instructions.md#generic-powershell "mention") script into the editor
7. Click **Create Script**
8. Navigate to **Policies**
9. Click **+New Policy**
10. Name the policy `Check Browser Extension Deployment`
11. Choose **Scripting** policy category
12. Click **+Add Entry**
13. Select the script you just created from the drop down
14. Select your desired frequency. We recommend at least daily
15. Click **Save Policy**

</details>
