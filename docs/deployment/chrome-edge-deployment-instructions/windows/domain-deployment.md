# Domain Deployment

{% tabs %}
{% tab title="Intune" %}
The simplest method of Intune deployment is through a Win32 script. Follow the steps below to deploy Check with Intune.

***

### Setup Script

1. Download a copy of the Setup-Windows-Chrome-and-Edge.ps1 script from the Check repository on GitHub using the button below.

<a href="https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/enterprise/Setup-Windows-Chrome-and-Edge.ps1" class="button primary">Download script</a>

2. Run the script locally on your computer to generate the following scripts:
   1. Deploy-Windows-Chrome-and-Edge.ps1
   2. Remove-Windows-Chrome-and-Edge.ps1
   3. Detect-Windows-Chrome-and-Edge.ps1
3. The setup script will prompt you to configure Check. Follow its guidance to ensure that you enter each value accurately. These values will be used by both the deployment and detection scripts to verify that the extension is properly deployed.
4. Set the output location the script will use to generate the three new scripts.

{% hint style="info" %}
You can also download the three scripts directly from the Check GitHub repo and edit the configuration settings manually.
{% endhint %}

***

### Adding to Intune

#### Prerequisites

* Microsoft Intune admin access
* The [Microsoft Win32 Content Prep Tool](https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool) (`IntuneWinAppUtil.exe`) to package scripts as `.intunewin` files

#### Step 1: Package the Scripts

Intune Win32 apps require an `.intunewin` package. Place your three configured scripts in a folder, then run:

```powershell
.\IntuneWinAppUtil.exe -c "C:\path\to\scripts\folder" -s "Deploy-Windows-Chrome-and-Edge.ps1" -o "C:\path\to\output"
```

This creates `Deploy-Windows-Chrome-and-Edge.intunewin`.

#### Step 2: Create the Win32 App in Intune

1. Open the [Microsoft Intune admin center](https://intune.microsoft.com)
2. Navigate to **Apps** > **Windows**
3. Click **Add** > Select **Windows app (Win32)** > **Select**
4. Upload the `.intunewin` file created in Step 1

#### Step 3: Configure App Information

| Field       | Value                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| Name        | `Check by CyberDrain - Browser Extension`                                                                    |
| Description | `Deploys and configures the Check by CyberDrain phishing protection extension for Chrome and Edge browsers.` |
| Publisher   | Your company name or `CyberDrain`                                                                            |

#### Step 4: Configure Program Settings

| Field                   | Value                                                                             |
| ----------------------- | --------------------------------------------------------------------------------- |
| Install command         | `powershell.exe -ExecutionPolicy Bypass -File Deploy-Windows-Chrome-and-Edge.ps1` |
| Uninstall command       | `powershell.exe -ExecutionPolicy Bypass -File Remove-Windows-Chrome-and-Edge.ps1` |
| Install behavior        | **System**                                                                        |
| Device restart behavior | **No specific action**                                                            |

#### Step 5: Configure Requirements

| Field                         | Value                                                   |
| ----------------------------- | ------------------------------------------------------- |
| Operating system architecture | **64-bit**                                              |
| Minimum operating system      | **Windows 10 1607** (or your minimum supported version) |

#### Step 6: Configure Detection Rules

1. Under **Detection rules**, select **Use a custom detection script**
2. Upload `Detect-Windows-Chrome-and-Edge.ps1`
3. Set the following:

| Field                                          | Value  |
| ---------------------------------------------- | ------ |
| Run script as 32-bit process on 64-bit clients | **No** |
| Enforce script signature check                 | **No** |

Keep **Run script as 32-bit process on 64-bit clients** set to **No** so the detection script runs in the 64-bit PowerShell/registry context on 64-bit devices. This is important because the script checks values under `HKLM:\SOFTWARE\Policies\...`; running it as 32-bit could read redirected `WOW6432Node` paths and cause detection to fail incorrectly. The detection script checks that all registry keys written by the install script exist and have the correct values. It exits with code `0` when everything matches (app detected) and code `1` when any value is missing or wrong (app not detected, triggers reinstall).

#### Step 7: Assign the App

1. Under **Assignments**, click **Add group** under **Required**
2. Choose your target:
   * **All devices** — deploys to every Intune-managed Windows device
   * **All users** — deploys to devices used by any licensed user
   * **Select groups** — deploy to specific Azure AD / Entra ID groups
3. Click **Review + create** > **Create**

### Updating Settings

When you need to change extension settings (e.g., enable page blocking or update branding):

1. Re-run the setup script with new values, or manually edit the config blocks in both `Deploy-` and `Detect-` scripts
2. Re-package with `IntuneWinAppUtil.exe`
3. In Intune, either update the existing app or delete and recreate it with the new package

Because the detection script body changes when settings change, Intune will detect the app as "not installed" on endpoints and automatically redeploy with the updated configuration.

### Uninstalling

To remove the extension from managed devices:

* **Option A:** In Intune, change the app assignment from **Required** to **Uninstall**. Intune will run the `Remove-Windows-Chrome-and-Edge.ps1` script on targeted devices.
* **Option B:** Delete the app from Intune entirely. Note that this stops management but does not actively remove the registry keys from devices that already have them.

### Troubleshooting

* **Extension not appearing after deployment:** Check that the install script ran as System (not User). Verify registry keys exist under `HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionSettings\` and `HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionSettings\`.
* **Intune keeps reinstalling the app:** The detection script values don't match what the install script wrote. Ensure both scripts have identical configuration values.
* **Detection script shows as failed:** Run the detection script manually on a test device as Administrator to see which check fails (it will exit at the first mismatch).
{% endtab %}

{% tab title="Group Policy" %}
1. Download the following files from the Check repository on GitHub:
   1. ​[Deploy-ADMX.ps1](https://github.com/CyberDrain/Check/blob/main/enterprise/Deploy-ADMX.ps1)
   2. ​[Check-Extension.admx](https://github.com/CyberDrain/Check/blob/main/enterprise/admx/Check-Extension.admx)​
   3. ​[Check-Extension.adml](https://github.com/CyberDrain/Check/blob/main/enterprise/admx/en-US/Check-Extension.adml)​
2. Run `Deploy-ADMX.ps1`. As long as you keep the other two files in the same folder, it will correctly add the available objects to Group Policy.
3. Open Group Policy and create a policy using the imported settings at `Computer Configuration → Policies → Administrative Templates → CyberDrain → Check - Microsoft 365 Phishing Protection`.

![](<../../../.gitbook/assets/image (2).png>)
{% endtab %}

{% tab title="CIPP Standard" %}
You can use a CIPP standard to deploy Check. It works the same way as the [#intune](domain-deployment.md#intune "mention") instructions, but CIPP handles the installation and detection-script creation.

For more, see our [Standards documentation](https://standards.cipp.app/standards/deploycheckchromeextension).
{% endtab %}
{% endtabs %}
