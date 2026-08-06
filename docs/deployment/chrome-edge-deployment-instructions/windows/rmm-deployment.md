---
description: >-
  This page will outline the various ways that you can deploy Check to Windows
  devices
---

# RMM Deployment

Review the following options for deploying Check to Windows devices through an RMM. If you use an RMM that is not listed, see the script in [#powershell](manual-deployment.md#powershell "mention") to automate the installation.

<details>

<summary>Action1</summary>

For Action1, you can save the script in [#powershell](manual-deployment.md#powershell "mention") as a `.ps1` file and deploy it through a [custom package in the software repository](https://www.action1.com/documentation/add-custom-packages-to-app-store/) or the [script library](https://www.action1.com/documentation/script-library/).

</details>

<details>

<summary>Acronis RMM</summary>

For Acronis RMM, you can use the script in [#powershell](manual-deployment.md#powershell "mention") to [create a script in the Script repository](https://www.acronis.com/en-us/support/documentation/CyberProtectionService/#cyber-scripting-creating-script.html) and then run it through a [Script Plan](https://www.acronis.com/en-us/support/documentation/CyberProtectionService/#cyber-scripting-scripting-plans.html).

</details>

<details>

<summary>ConnectWise Automate</summary>

1. Go to **Automation** → **Scripts** → **Script Manager**
2. Create a new script
3. Add a PowerShell Execute Script step
4. Copy in the [#powershell](manual-deployment.md#powershell "mention") script.
5. Save and assign the script to your targeted devices.

</details>

<details>

<summary>Datto RMM</summary>

1. Go to **Automation** → **Components**
2. Create a new Custom Component
3. Copy in the [#powershell](manual-deployment.md#powershell "mention") script
4. Save and publish the component
5. Navigate to **Automation** → **Jobs** → **Create Job**
6. Name the job Check Browser Extension Deployment
7. Add the custom component you just created
8. Target your selected device(s)
9. Schedule the job

</details>

<details>

<summary>ImmyBot</summary>

ImmyBot includes a pre-built Global Computer Task for Check browser extension deployment.\
Due to Immy's flexibility, this may look intimidating at first, but the process is straightforward and almost entirely UI-driven.\
Follow these steps to deploy Check using ImmyBot:

**Step 1: Create a Deployment**

1. **Navigate to Deployments** in the left menu
2. Click **New** to create a deployment
3. **Select the Global Task**: Choose "Check by CyberDrain" from the available global tasks
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
   * Initiate a maintenance session to execute deployments
3. **Monitor Results** through ImmyBot's maintenance session logs
4. Review deployment status and address any failures

**Best Practices for ImmyBot Deployment**

* **Test First**: Create a test deployment targeting a small group before rolling out globally
* **Use Targeting**: Leverage Immy's advanced targeting to deploy based on computer properties, user assignments, or custom criteria
* **Monitor Compliance**: Set up recurring maintenance sessions to ensure Check remains installed and properly configured
* **Handle Exceptions**: Create separate deployments for customers requiring different configurations

For detailed information about Immy deployments, tasks, and maintenance sessions, refer to the [ImmyBot Documentation](https://docs.immy.bot).

</details>

<details>

<summary>Kaseya VSA</summary>

1. Go to **Agent Procedures** → **Installer Wizards** → **Application Deploy**
2. Upload the [#powershell](manual-deployment.md#powershell "mention") script as a `.ps1` file
3. Choose Private or Shared Files
4. Select installer type
5. Add command-line options
6. Name the procedure Check Browser Extension Deployment
7. Save and schedule the script for deployment

</details>

<details>

<summary>ManageEngine Endpoint Central</summary>

1. Navigate to **Manage** → **Extension Repository**
2. Click **Add Extensions** and click the desired browser
3. Select the Web Store Extension Type
4. Enter the extension ID:
   1. Chrome: benimdeioplgkhanklclahllklceahbe
   2. Edge: knepjpocdagponkonnbggpcnhnaikajg
5. Click **Add** after each
6. Navigate to **Browsers** → **Manage** → **Groups & Computers**
7. Select the custom groups or computers you wish to distribute the extension to
8. Click **Distribute Extensions**
9. Select the extensions you just added to the repository
10. Click **Distribute**

{% hint style="warning" %}
ManageEngine's documentation is not clear about how to manage the extension settings through this method. It may be necessary to transition to scripted deployment.
{% endhint %}

</details>

<details>

<summary>N-able N-Central</summary>

1. Go to **Configuration** → **Scheduled Tasks** → **Script/Software Repository**
2. Click **Add** → **Script**
3. Choose:
   1. Script Type: **PowerShell**
   2. Operating System: **Windows**
4. Upload the [#powershell](manual-deployment.md#powershell "mention") script as a `.ps1` file or paste the script directly
5. Name the script `Check Browser Extension Deployment`
6. Save the script
7. Go to **Configuration** → **Scheduled Task** → **Add Task**
8. Choose **Run a Script**
9. Select the script you just uploaded
10. Configure the task
    1. Name: **Check Browser Extension Deployment**
    2. Target Devices: Choose specific devices, groups, or filters
    3. Schedule: Set your desired interval. We recommend running on login or startup for the best results, but a lower frequency can also ensure deployment to all machines
    4. Execution Context: **System Account**
11. Click **Save and Activate**

</details>

<details>

<summary>N-able N-Sight</summary>

1. Go to **Settings** → **Script Manager**
2. Click **New**
3. Enter `Check Browser Extension Deployment` for the name and a brief description
4. Set a timeout period for the script of 600 seconds
5. Upload the [#powershell](manual-deployment.md#powershell "mention") script as a `.ps1` file, leaving `Script check and automated task` selected
6. Click **Save**
7. On the **All Devices** view, right-click your targeted Client or Site
8. Select **Task** → **Add**
9. Select the script you just uploaded
10. Enter a name for the task, e.g., `<Client/Site> Check Browser Extension Deployment`
11. Select `Once per day` for the frequency method
12. Set a **Start Date**, **Start Time**, **End Date**, and **End Time** as desired
13. Set a maximum permitted execution time, e.g., 600 seconds
14. Set `Run task as soon as possible if schedule is missed`
15. Select **Next**
16. Select the targeted devices and click **Add Task**

</details>

<details>

<summary>NinjaOne</summary>

1. Go to **Administration** → **Library** → **Automation** → **Add** → **New Script**

1. Enter:
   1. Name `Check Browser Extension Deployment`
   2. Description: To deploy Check by CyberDrain for Edge and Chrome
   3. Categories: Select as appropriate for your environment
   4. Language: PowerShell
   5. Operating System: Windows
   6. Architecture: All
   7. Run As: System
   8. Script Variables: Add as desired to customize
2. Copy the [#powershell](manual-deployment.md#powershell "mention") script into the editor
3. Click **Save**
4. Go to **Administration** → **Policies**
5. Create a new policy or add the automation to an existing policy that targets Windows devices
6. Select **Scheduled Automation** on the left
7. Click **Add a Scheduled automation** button
8. Select the script and set the options for frequency, add variables, etc.
9. Click **Add**
10. Click **Save**

</details>

<details>

<summary>Pulseway</summary>

1. Go to **Automation** → **Scripts**
2. (Optional) Create a new **Script Category** called Browser Extensions
3. Click **Create Script**
4. Name the Script `Check Browser Extension Deployment`
5. Toggle **Enabled** under the Windows tab
6. Select **PowerShell** as the script type
7. Paste the [#powershell](manual-deployment.md#powershell "mention") script into the editor
8. Click **Save Script**
9. Navigate to **Automation** → **Tasks**
10. Click **Create Task**
11. Name the task `Check Browser Extension Deployment`
12. Choose the PowerShell script you just added
13. Set the **Scope** to **All Systems** or create a custom scope
14. Set **Daily** for **Schedule**
15. Save the task

</details>

<details>

<summary>SuperOps.ai</summary>

1. Navigate to **Modules** → **Scripts**
2. Click **+ Script**
3. Name the script `Check Browser Extension Deployment`
4. Choose **PowerShell** as the language
5. Paste the [#powershell](manual-deployment.md#powershell "mention") script
6. Set a timeout of 600 seconds
7. Choose to run as **System/Root User**
8. Save the script
9. SuperOps has multiple ways to deploy a scheduled action. Review its documentation to choose your preferred method.

</details>

<details>

<summary>Syncro</summary>

1. Navigate to the **Scripts** tab
2. Click **+Script**
3. Name the script `Check Browser Extension Deployment`
4. Choose **PowerShell** as the file type
5. Set **Run As** to **System**
6. Copy the [#powershell](manual-deployment.md#powershell "mention") script into the editor
7. Click **Create Script**
8. Navigate to **Policies**
9. Click **+New Policy**
10. Name the policy `Check Browser Extension Deployment`
11. Choose the **Scripting** policy category
12. Click **+Add Entry**
13. Select the script you just created from the drop-down list
14. Select your desired frequency. We recommend running it at least daily.
15. Click **Save Policy**

</details>
