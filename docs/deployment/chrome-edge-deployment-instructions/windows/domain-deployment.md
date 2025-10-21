# Domain Deployment

{% tabs %}
{% tab title="Intune" %}
You need to create **two custom profiles** in Intune (one for Chrome, one for Edge).\
Each profile contains **two OMA-URI settings**:

* **Installation policy** → tells the browser to force-install the extension.
* **Configuration policy** → applies your custom extension settings.

***

#### Step 1 – Open Intune and Start a New Profile

1. Go to Intune Admin Center.
2. Navigate to: **Devices → Configuration profiles**
3. Click on **Create → Import Policy**
4. Import the following file to deploy the extensions. This will deploy the configuration

<a href="https://raw.githubusercontent.com/CyberDrain/Check/refs/heads/main/docs/.gitbook/assets/Check%20Extension_%20Install%20for%20Chrome%20and%20Edge_2025-09-20T22_08_38.615Z.json" class="button primary">Import File</a>

***

#### Step 2: Configuration

Download  -- 
1. ​[Check-Extension.admx](../../../../enterprise/admx/Check-Extension.admx)​
2. ​[Check-Extension.adml](../../../../enterprise/admx/en-US/Check-Extension.adml)

Go to Intune Admin Center.

Navigate to: Devices → Configuration profiles
Click on Import ADMX Create → Import 
Import the following file​ Check-Extension.admx and Check-Extension.adml Review and Create.
Once finished uploading and is Available

Click on Policy 
Create → New Import Policy
Platform -> Windows 10 and later
Profile type -> Templates -> Imported Administratie Templates (Preview)
Give Templete Name
Configuration Settings -> Select CyberDrain -> Check -> Phishing Protect -> Configure Edge/Chrome
Scope tag - if needed
Assignment select Users or GRoup or Devices how ever you do it
Review and Create

{% endtab %}

{% tab title="Group Policy" %}


1. Download the following from the Check repo on GitHub
   1. ​[Deploy-ADMX.ps1](../../../../enterprise/Deploy-ADMX.ps1)
   2. ​[Check-Extension.admx](../../../../enterprise/admx/Check-Extension.admx)​
   3. ​[Check-Extension.adml](../../../../enterprise/admx/en-US/Check-Extension.adml)​
2. Run Deploy-ADMX.ps1. As long as you keep the other two files in the same folder, it will correctly add the available objects to Group Policy.
3. Open Group Policy and create a policy using the imported settings that can be found at `Computer Configuration → Policies → Administrative Templates → CyberDrain → Check - Microsoft 365 Phishing Protection`

![](<../../../.gitbook/assets/image (2).png>)
{% endtab %}
{% endtabs %}
