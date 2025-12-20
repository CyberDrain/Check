/**
 * Blocked Page JavaScript - CSP Compliant External Script
 * Handles URL defanging, branding, and user interactions for blocked pages
 */

// Store detection details globally for false positive reporting
let globalDetectionDetails = null;
let webhookConfig = null;

// Parse URL parameters to get block details with enhanced defanging
function parseUrlParams() {
  console.log("parseUrlParams called");
  console.log("Current URL:", window.location.href);

  const urlParams = new URLSearchParams(window.location.search);
  console.log("URL params:", urlParams.toString());
  console.log("All URL params:");
  for (const [key, value] of urlParams.entries()) {
    console.log(`  ${key}: ${value}`);
  }

  // Parse details from the new format (from content script)
  const detailsParam = urlParams.get("details");
  console.log("Details param:", detailsParam);

  if (detailsParam) {
    try {
      // URLSearchParams.get() already decodes the URI component, so don't decode again
      const details = JSON.parse(detailsParam);
      console.log("Parsed details:", details);
      
      // Store details globally for false positive reporting
      globalDetectionDetails = details;

      // Update blocked URL with defanging
      if (details.url) {
        console.log("Setting blocked URL to:", details.url);
        const defangedUrl = defangUrl(details.url);
        console.log("Defanged URL:", defangedUrl);
        document.getElementById("blockedUrl").textContent = defangedUrl;
      } else {
        console.log("No URL in details, using fallback");
        const fallbackUrl = document.referrer || "Unknown URL";
        document.getElementById("blockedUrl").textContent =
          defangUrl(fallbackUrl);
      }

      // Update block reason
      if (details.reason) {
        console.log("Setting block reason to:", details.reason);
        document.getElementById("blockReason").textContent = details.reason;
      }

      // Update threat category based on type or rule description
      if (details.type === "domain_squatting") {
        document.getElementById("threatCategory").textContent = "Domain Squatting";
        // Custom messaging for domain squatting
        if (details.protectedDomain) {
          document.getElementById("blockReason").textContent = 
            `This website's domain closely resembles "${details.protectedDomain}" but is NOT the legitimate site. Entering your credentials here could compromise your account.`;
        }
      } else if (details.ruleDescription) {
        document.getElementById("threatCategory").textContent =
          details.ruleDescription;
      } else if (details.rule) {
        document.getElementById(
          "threatCategory"
        ).textContent = `Rule: ${details.rule}`;
      } else if (details.score !== undefined) {
        document.getElementById(
          "threatCategory"
        ).textContent = `Score: ${details.score}/${details.threshold}`;
      }

      // Populate technical details section
      populateTechnicalDetails(details);
    } catch (error) {
      console.warn("Failed to parse block details:", error);
      console.log("Error details:", error.message);
      // Fallback to legacy URL parsing
      const blockedUrl =
        urlParams.get("url") || document.referrer || "Unknown URL";
      console.log("Using fallback URL:", blockedUrl);
      document.getElementById("blockedUrl").textContent = defangUrl(blockedUrl);
    }
  } else {
    console.log("No details param, using legacy parsing");
    // Legacy URL parsing for backward compatibility
    const blockedUrl =
      urlParams.get("url") || document.referrer || "Unknown URL";
    console.log("Legacy blocked URL:", blockedUrl);
    document.getElementById("blockedUrl").textContent = defangUrl(blockedUrl);

    const reason = urlParams.get("reason");
    if (reason) {
      console.log("Legacy reason:", reason);
      document.getElementById("blockReason").textContent =
        decodeURIComponent(reason);
    }
  }

  console.log(
    "Final blocked URL element text:",
    document.getElementById("blockedUrl").textContent
  );
}

function defangUrl(url) {
  if (!url || url === "about:blank" || url.includes("chrome-extension://")) {
    return "Unknown URL";
  }

  // Defang the URL by replacing only colons (less aggressive)
  let defanged = url.replace(/:/g, "[:]"); // Replace colons only

  // Truncate if too long
  if (defanged.length > 80) {
    defanged = defanged.substring(0, 77) + "...";
  }

  return defanged;
}

function truncateUrl(url) {
  if (url.length > 50) {
    return url.substring(0, 47) + "...";
  }
  return url;
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "about:blank";
  }
}

async function reportFalsePositive() {
  console.log("reportFalsePositive function called");
  
  const reportBtn = document.getElementById("reportFalsePositiveBtn");
  
  if (!webhookConfig || !webhookConfig.url) {
    console.error("No webhook configured");
    return;
  }
  
  try {
    reportBtn.disabled = true;
    reportBtn.textContent = "Sending...";
    reportBtn.style.background = "#6b7280";
    reportBtn.style.color = "white";
    
    const payload = {
      version: "1.0",
      type: "false_positive_report",
      timestamp: new Date().toISOString(),
      source: "Check Extension",
      extensionVersion: chrome.runtime.getManifest().version,
      data: {
        reportedUrl: document.getElementById("blockedUrl").textContent,
        reportedReason: document.getElementById("blockReason").textContent,
        reportTimestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        browserInfo: {
          platform: navigator.platform,
          language: navigator.language,
          vendor: navigator.vendor,
          cookiesEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine
        },
        screenResolution: {
          width: window.screen.width,
          height: window.screen.height,
          availWidth: window.screen.availWidth,
          availHeight: window.screen.availHeight,
          colorDepth: window.screen.colorDepth
        },
        detectionDetails: globalDetectionDetails || {},
        userComments: null
      }
    };
    
    console.log("Sending false positive report to:", webhookConfig.url);
    console.log("Report payload:", payload);
    
    const response = await fetch(webhookConfig.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Type": "false_positive_report",
        "X-Webhook-Version": "1.0"
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      console.log("False positive report sent successfully");
      reportBtn.textContent = "Report Sent Successfully";
      reportBtn.style.background = "#16a34a";
      reportBtn.style.color = "white";
    } else {
      console.warn("False positive report failed with HTTP status:", response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Failed to send false positive report:", error);
    reportBtn.textContent = `Failed: ${error.message}`;
    reportBtn.style.background = "#dc2626";
    reportBtn.style.color = "white";
  }
}

function contactAdmin() {
  console.log("contactAdmin function called");

  // Get support email from background script (centralized through config manager)
  try {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage(
        { type: "GET_BRANDING_CONFIG" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "Failed to get branding from background:",
              chrome.runtime.lastError.message
            );
            alert(
              "No support contact information has been configured by your administrator."
            );
            return;
          }

          if (
            response &&
            response.success &&
            response.branding &&
            response.branding.supportEmail
          ) {
            console.log(
              "Using branded support email:",
              response.branding.supportEmail
            );
            openMailto(response.branding.supportEmail);
          } else {
            console.log("No branded support email available");
            alert(
              "No support contact information has been configured by your administrator."
            );
          }
        }
      );
    } else {
      console.log("Chrome runtime not available, no support contact available");
      alert(
        "No support contact information has been configured by your administrator."
      );
    }
  } catch (error) {
    console.error("Error accessing branding config:", error);
    alert(
      "No support contact information has been configured by your administrator."
    );
  }
}

function openMailto(supportEmail) {
  const blockedUrl = document.getElementById("blockedUrl").textContent;
  const reason = document.getElementById("blockReason").textContent;

  // Create subject with defanged URL
  const subject = encodeURIComponent(
    `Security Alert: Website Blocked - ${blockedUrl}`
  );

  // Get phishing indicators from URL parameters if available
  const urlParams = new URLSearchParams(window.location.search);
  const detailsParam = urlParams.get("details");
  let phishingIndicators = "Not available";

  console.log("=== BLOCKED.JS DEBUG INFO ===");
  console.log("Blocked URL:", blockedUrl);
  console.log("Block Reason:", reason);
  console.log("URL Params:", urlParams.toString());
  console.log("Raw details param:", detailsParam);

  if (detailsParam) {
    try {
      const details = JSON.parse(decodeURIComponent(detailsParam));

      // Comprehensive logging of the details object
      console.log("=== PARSED DETAILS OBJECT ===");
      console.log("Full details object:", details);
      console.log("Details keys:", Object.keys(details));
      console.log("Details values:", Object.values(details));

      // Log each property individually
      Object.keys(details).forEach((key) => {
        console.log(`details.${key}:`, details[key]);
        if (Array.isArray(details[key])) {
          console.log(
            `  - Array with ${details[key].length} items:`,
            details[key]
          );
        }
      });

      // Try to extract phishing indicators from various possible fields
      if (
        details.phishingIndicators &&
        Array.isArray(details.phishingIndicators)
      ) {
        console.log("Using phishingIndicators field");
        phishingIndicators = details.phishingIndicators
          .map(
            (indicator) =>
              `- ${indicator.id || indicator.name || "Unknown"}: ${
                indicator.description || indicator.reason || "Detected"
              }`
          )
          .join("\n");
      } else if (details.matchedRules && Array.isArray(details.matchedRules)) {
        console.log("Using matchedRules field");
        phishingIndicators = details.matchedRules
          .map(
            (rule) =>
              `- ${rule.id || rule.name || "Unknown"}: ${
                rule.description || rule.reason || "Rule matched"
              }`
          )
          .join("\n");
      } else if (details.threats && Array.isArray(details.threats)) {
        console.log("Using threats field");
        // Filter out the summary threat and show only specific indicators
        const specificThreats = details.threats.filter((threat, index) => {
          // Skip first threat if it's a summary (contains "legitimacy score" or is a general threat type)
          // Keep threats with specific IDs (phishing rules)
          if (threat.id && threat.id.startsWith("phi_")) {
            return true;
          }
          // Keep threats with specific types that aren't summary types
          if (
            threat.type &&
            !threat.type.includes("threat") &&
            threat.description
          ) {
            return true;
          }

          // Keep anything else that looks like a specific threat
          return (
            threat.description && threat.description.length > 10 && threat.id
          );
        });
        console.log("Filtered specific threats for email:", specificThreats);
        phishingIndicators = specificThreats
          .map(
            (threat) =>
              `- ${
                threat.type ||
                threat.category ||
                threat.id ||
                "Phishing Indicator"
              }: ${threat.description || threat.reason || "Threat detected"}`
          )
          .join("\n");
      } else if (details.foundThreats && Array.isArray(details.foundThreats)) {
        console.log("Using foundThreats field");
        phishingIndicators = details.foundThreats
          .map(
            (threat) =>
              `- ${threat.id || threat}: ${threat.description || "Detected"}`
          )
          .join("\n");
      } else if (details.indicators && Array.isArray(details.indicators)) {
        console.log("Using indicators field");
        phishingIndicators = details.indicators
          .map(
            (indicator) =>
              `- ${indicator.id}: ${indicator.description || indicator.id} (${
                indicator.severity || "unknown"
              })`
          )
          .join("\n");
      } else if (
        details.foundIndicators &&
        Array.isArray(details.foundIndicators)
      ) {
        console.log("Using foundIndicators field");
        phishingIndicators = details.foundIndicators
          .map(
            (indicator) =>
              `- ${indicator.id || indicator}: ${indicator.description || ""}`
          )
          .join("\n");
      } else {
        // Fallback: Look for any array properties that might contain indicators
        const arrayProps = Object.keys(details).filter(
          (key) => Array.isArray(details[key]) && details[key].length > 0
        );
        console.log(
          "No standard indicator fields found. Array properties:",
          arrayProps
        );

        if (arrayProps.length > 0) {
          console.log("Examining array properties:");
          arrayProps.forEach((prop) => {
            console.log(`  ${prop}:`, details[prop]);
          });
          phishingIndicators = `Multiple indicators detected (${
            details.reason || "see browser console for details"
          })`;
        } else {
          console.log("No array properties found, using reason as fallback");
          phishingIndicators = `${
            details.reason || "Unknown detection criteria"
          }`;
        }
      }

      console.log("Final phishing indicators:", phishingIndicators);
    } catch (error) {
      console.error("Failed to parse phishing indicators:", error);
      phishingIndicators = "Parse error - check browser console";
    }
  } else {
    console.log("No details parameter found in URL");
  }

  console.log("=== END DEBUG INFO ==="); // Create a simplified body that won't exceed URL length limits
  const body = encodeURIComponent(`Security Alert: Website Access Blocked

Blocked URL: ${blockedUrl}
Timestamp: ${new Date().toLocaleString()}
Block Reason: ${reason}

Phishing Indicators Found:
${phishingIndicators}

This automated report was generated when a user attempted to access the above URL and was blocked by the security system. Please review the details to determine if this was a legitimate block or if the URL should be added to an allow list.

User Comment:
[Please provide additional context about your intended use of this website and/or how you got here]

---
Technical Details Available in the Activity Logs`);

  const mailtoUrl = `mailto:${supportEmail}?subject=${subject}&body=${body}`;

  // Check URL length and warn if too long
  if (mailtoUrl.length > 2000) {
    console.warn(
      "Mailto URL might be too long:",
      mailtoUrl.length,
      "characters"
    );
  }

  console.log("Opening mailto URL:", mailtoUrl);

  try {
    window.location.href = mailtoUrl;
  } catch (error) {
    console.error("Error opening mailto:", error);
    // Fallback: try using window.open
    try {
      window.open(mailtoUrl);
    } catch (openError) {
      console.error("Error with window.open:", openError);
      alert(`Please contact your IT administrator at: ${supportEmail}`);
    }
  }
}

// Load branding configuration with proper async handling
async function loadBranding() {
  console.log("loadBranding function called");

  try {
    // Get branding configuration from background script (centralized through config manager)
    const brandingResult = await new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage(
          { type: "GET_BRANDING_CONFIG" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "Failed to get branding from background:",
                chrome.runtime.lastError.message
              );
              resolve(null);
            } else {
              resolve(response);
            }
          }
        );
      } else {
        console.log("Chrome runtime not available");
        resolve(null);
      }
    });

    console.log("Branding response from background:", brandingResult);

    if (brandingResult && brandingResult.success && brandingResult.branding) {
      const storageResult = brandingResult.branding;
      console.log("Using branding from background script:", storageResult);

      // Apply branding from background script
      const companyName =
        storageResult.companyName || storageResult.productName || "Check";
      console.log("Setting company name from background to:", companyName);
      document.getElementById("companyName").textContent = companyName;
      document.title = `Access Blocked - ${companyName}`;

      // Update product name if available
      if (storageResult.productName) {
        console.log("Setting product name:", storageResult.productName);
        document.querySelector(
          "h1"
        ).textContent = `Access Blocked by ${storageResult.productName}`;
      }

      // Handle logo display - use custom logo or default branding
      const customLogo = document.getElementById("customLogo");
      const defaultIcon = document.getElementById("defaultIcon");

      if (customLogo && defaultIcon) {
        if (storageResult.logoUrl) {
          console.log(
            "Setting custom logo as main icon:",
            storageResult.logoUrl
          );

          // Try to load the custom logo
          const logoSrc = storageResult.logoUrl.startsWith("http")
            ? storageResult.logoUrl
            : chrome.runtime.getURL(storageResult.logoUrl);

          console.log("Loading logo from:", logoSrc);

          customLogo.src = logoSrc;
          customLogo.style.width = "80px";
          customLogo.style.height = "80px";
          customLogo.style.borderRadius = "50%";
          customLogo.style.objectFit = "contain";
          customLogo.style.background = "white";
          customLogo.style.padding = "4px";
          customLogo.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
          customLogo.style.border = "1px solid #e5e7eb";

          customLogo.onload = () => {
            console.log("Custom logo loaded successfully");
            customLogo.style.display = "block";
            defaultIcon.style.display = "none";
          };
          customLogo.onerror = () => {
            console.warn(
              "Failed to load custom logo, using default Check logo"
            );
            // Fall back to default Check logo
            customLogo.src = chrome.runtime.getURL("images/icon128.png");
            customLogo.style.display = "block";
            defaultIcon.style.display = "none";
          };
        } else {
          console.log("No custom logo configured, using default Check logo");
          // Use default Check logo instead of Unicode icon
          customLogo.src = chrome.runtime.getURL("images/icon48.png");
          customLogo.style.width = "80px";
          customLogo.style.height = "80px";
          customLogo.style.borderRadius = "50%";
          customLogo.style.objectFit = "contain";
          customLogo.style.background = "white";
          customLogo.style.padding = "4px";
          customLogo.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
          customLogo.style.border = "1px solid #e5e7eb";
          customLogo.style.display = "block";
          defaultIcon.style.display = "none";
        }
      }

      // Update primary color if available
      if (storageResult.primaryColor) {
        console.log("Applying primary color:", storageResult.primaryColor);
        const style = document.createElement("style");
        style.textContent = `
          :root {
            --primary-color: ${storageResult.primaryColor} !important;
            --primary-hover: ${storageResult.primaryColor}dd !important;
          }
          .icon { background: ${storageResult.primaryColor} !important; }
          h1 { color: ${storageResult.primaryColor} !important; }
          .btn-primary { background: ${storageResult.primaryColor} !important; }
          .btn-primary:hover { background: ${storageResult.primaryColor}dd !important; }
        `;
        document.head.appendChild(style);
      }

      // Check if support email is available and hide/show contact button accordingly
      const contactBtn = document.getElementById("contactAdminBtn");
      if (storageResult.supportEmail && storageResult.supportEmail.trim()) {
        console.log("Support email available, showing contact button");
        if (contactBtn) {
          contactBtn.style.display = "inline-block";
        }
      } else {
        console.log("No support email available, hiding contact button");
        if (contactBtn) {
          contactBtn.style.display = "none";
        }
      }
      
      // Check if false positive webhook is configured and show button accordingly
      const falsePositiveBtn = document.getElementById("reportFalsePositiveBtn");
      const genericWebhook = storageResult.genericWebhook;
      if (genericWebhook && genericWebhook.enabled && genericWebhook.url) {
        const events = genericWebhook.events || [];
        if (events.includes("false_positive_report")) {
          console.log("False positive webhook configured, showing report button");
          webhookConfig = { url: genericWebhook.url };
          if (falsePositiveBtn) {
            falsePositiveBtn.style.display = "inline-block";
          }
          return;
        }
      }
      console.log("No false positive webhook configured, hiding report button");
      if (falsePositiveBtn) {
        falsePositiveBtn.style.display = "none";
      }

      return; // Exit early if we loaded from background script
    }

    // Fallback: try to load from branding.json file
    console.log("No background config available, trying branding.json file");
    try {
      const response = await fetch(
        chrome.runtime.getURL("config/branding.json")
      );
      if (response.ok) {
        const brandingConfig = await response.json();
        console.log("Loaded branding from file:", brandingConfig);

        const companyName = brandingConfig.companyName || "Check";
        console.log("Setting company name from file to:", companyName);
        document.getElementById("companyName").textContent = companyName;
        document.title = `Access Blocked - ${companyName}`;
      }
    } catch (fetchError) {
      console.warn("Could not load branding.json:", fetchError);
    }
  } catch (error) {
    console.error("Could not load branding configuration:", error);
  }

  // Final fallback - ensure something is always set
  const currentCompanyName = document.getElementById("companyName").textContent;
  if (!currentCompanyName || currentCompanyName.trim() === "") {
    console.log("No company name set, using final fallback");
    document.getElementById("companyName").textContent = "Check";
    document.title = "Access Blocked - Check";
  }

  // Hide contact button by default if no background config was loaded
  const contactBtn = document.getElementById("contactAdminBtn");
  if (
    contactBtn &&
    (!brandingResult ||
      !brandingResult.success ||
      !brandingResult.branding ||
      !brandingResult.branding.supportEmail)
  ) {
    console.log(
      "No branded config loaded or no support email, hiding contact button"
    );
    contactBtn.style.display = "none";
  }

  console.log(
    "Final company name:",
    document.getElementById("companyName").textContent
  );
}

// Initialize page with CSP-compliant event handlers
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing page");

  // Add event listeners for buttons (CSP compliant)
  document.getElementById("goBackBtn").addEventListener("click", goBack);
  document
    .getElementById("contactAdminBtn")
    .addEventListener("click", contactAdmin);
  document
    .getElementById("reportFalsePositiveBtn")
    .addEventListener("click", reportFalsePositive);

  // Add technical details toggle listener
  const techDetailsHeader = document.querySelector(".technical-details-header");
  if (techDetailsHeader) {
    console.log("Adding click listener to technical details header");
    techDetailsHeader.addEventListener("click", toggleTechnicalDetails);
  } else {
    console.log("Technical details header not found");
  }

  // Parse URL parameters and load branding
  parseUrlParams();
  loadBranding();

  // Debug: Check if URL was set properly
  setTimeout(() => {
    console.log(
      "After 1 second - URL element:",
      document.getElementById("blockedUrl").textContent
    );
  }, 1000);

  // Show the resulting page
  document.body.classList.remove('loading');
});

// Handle keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // ESC key to go back
  if (e.key === "Escape") {
    goBack();
  }
  // Ctrl+R or F5 to go back (prevent refresh on blocked page)
  if ((e.ctrlKey && e.key === "r") || e.key === "F5") {
    e.preventDefault();
    goBack();
  }
});

// Prevent right-click context menu on blocked page
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

// Toggle technical details section
function toggleTechnicalDetails() {
  console.log("toggleTechnicalDetails called");
  const details = document.getElementById("technicalDetails");
  console.log("Technical details element:", details);
  console.log("Current classes:", details.className);

  details.classList.toggle("expanded");

  console.log("After toggle classes:", details.className);
}

// Make sure function is accessible globally
window.toggleTechnicalDetails = toggleTechnicalDetails;

// Populate technical details from parsed data
function populateTechnicalDetails(details) {
  console.log("=== POPULATING TECHNICAL DETAILS ===");
  console.log("Full details object:", details);
  console.log("Details.threats:", details.threats);
  console.log("Details.phishingIndicators:", details.phishingIndicators);
  console.log("Details.foundIndicators:", details.foundIndicators);
  console.log("Details.type:", details.type);

  // Handle domain squatting specific details
  if (details.type === "domain_squatting") {
    console.log("Populating domain squatting details");
    
    // Detection Scores - use confidence for domain squatting
    if (details.confidence !== undefined) {
      document.getElementById("techScore").textContent = `${Math.round(details.confidence * 100)}%`;
    }
    document.getElementById("techThreshold").textContent = "Domain Similarity";
    
    // Threat Analysis - use techniques
    let indicatorCount = 0;
    if (details.techniques && Array.isArray(details.techniques)) {
      indicatorCount = details.techniques.length;
      document.getElementById("techIndicatorCount").textContent = indicatorCount;
      
      // Set severity
      const severityElement = document.getElementById("techSeverity");
      const severityMap = { critical: "CRITICAL", high: "HIGH", medium: "MEDIUM", low: "LOW" };
      const severityText = severityMap[details.severity] || details.severity.toUpperCase();
      severityElement.innerHTML = `<span class="tech-badge ${details.severity}">${severityText}</span>`;
      
      // Populate techniques as indicators
      populatePhishingIndicatorsList(details.techniques, details);
    }
    
    // Detection method
    document.getElementById("techDetectionMethod").textContent = "Domain Squatting Detection";
    
    // Page Information
    if (details.testDomain) {
      document.getElementById("techPageTitle").textContent = `Suspicious Domain: ${details.testDomain}`;
    }
    if (details.protectedDomain) {
      const userAgent = document.getElementById("techUserAgent");
      userAgent.textContent = `Impersonating: ${details.protectedDomain}`;
    }
    document.getElementById("techTimestamp").textContent = details.detectionTime 
      ? new Date(details.detectionTime).toLocaleString() 
      : new Date().toLocaleString();
    
    return; // Exit early for domain squatting
  }

  // Detection Scores for phishing detection
  if (details.score !== undefined) {
    document.getElementById("techScore").textContent = details.score;
  }
  if (details.threshold !== undefined) {
    document.getElementById("techThreshold").textContent = details.threshold;
  }

  // Threat Analysis - Use multiple data sources for phishing
  let phishingIndicators = [];
  let indicatorCount = 0;

  // Try to get indicators from multiple sources
  if (details.threats && Array.isArray(details.threats)) {
    console.log("Processing threats array for indicators");
    const specificThreats = details.threats.filter((threat) => {
      if (threat.id) return true;
      if (threat.type && !threat.type.includes("threat") && threat.description)
        return true;
      if (threat.description && threat.description.includes("legitimacy score"))
        return false;
      return threat.description && threat.description.length > 10;
    });
    console.log("Filtered specific threats:", specificThreats);
    phishingIndicators = specificThreats;
    indicatorCount = specificThreats.length;
  }

  // Fallback: use phishingIndicators array if available
  if (
    indicatorCount === 0 &&
    details.phishingIndicators &&
    Array.isArray(details.phishingIndicators)
  ) {
    console.log(
      "Using phishingIndicators array as fallback:",
      details.phishingIndicators
    );
    phishingIndicators = details.phishingIndicators;
    indicatorCount = details.phishingIndicators.length;
  }

  // Fallback: use foundIndicators array if available
  if (
    indicatorCount === 0 &&
    details.foundIndicators &&
    Array.isArray(details.foundIndicators)
  ) {
    console.log(
      "Using foundIndicators array as fallback:",
      details.foundIndicators
    );
    phishingIndicators = details.foundIndicators;
    indicatorCount = details.foundIndicators.length;
  }

  // If we still have no indicators, try to count from the email section
  if (
    indicatorCount === 0 &&
    details.reason &&
    details.reason.includes("phishing indicators:")
  ) {
    const match = details.reason.match(/phishing indicators: (\d+)/);
    if (match) {
      indicatorCount = parseInt(match[1]);
      console.log(
        "Extracted indicator count from reason string:",
        indicatorCount
      );
    }
  }

  document.getElementById("techIndicatorCount").textContent =
    indicatorCount || "--";

  // Find highest severity
  if (phishingIndicators.length > 0) {
    const severities = phishingIndicators
      .map((t) => t.severity)
      .filter((s) => s);
    console.log("Severities found:", severities);
    if (severities.length > 0) {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const highestSeverity = severities.reduce((a, b) =>
        (severityOrder[a] || 0) > (severityOrder[b] || 0) ? a : b
      );
      const severityElement = document.getElementById("techSeverity");
      severityElement.innerHTML = `<span class="tech-badge ${highestSeverity}">${highestSeverity.toUpperCase()}</span>`;
      console.log("Highest severity set to:", highestSeverity);
    } else {
      // Fallback: if we have threats but no severity, assume "high" based on the fact it was blocked
      if (indicatorCount > 0) {
        const severityElement = document.getElementById("techSeverity");
        severityElement.innerHTML = `<span class="tech-badge high">HIGH</span>`;
        console.log("Set fallback severity to HIGH");
      }
    }
  }

  // Populate phishing indicators list
  populatePhishingIndicatorsList(phishingIndicators, details);

  // Detection method
  if (details.detectionMethod) {
    document.getElementById("techDetectionMethod").textContent =
      details.detectionMethod;
  } else {
    document.getElementById("techDetectionMethod").textContent =
      "Phishing Indicators";
  }

  // Page Information
  if (details.pageTitle) {
    document.getElementById("techPageTitle").textContent = details.pageTitle;
  }
  if (details.userAgent) {
    document.getElementById("techUserAgent").textContent = details.userAgent;
  }
  if (details.timestamp) {
    document.getElementById("techTimestamp").textContent = new Date(
      details.timestamp
    ).toLocaleString();
  } else {
    document.getElementById("techTimestamp").textContent =
      new Date().toLocaleString();
  }
}

// Populate the phishing indicators list
function populatePhishingIndicatorsList(indicators, details) {
  console.log("=== POPULATING PHISHING INDICATORS LIST ===");
  console.log("Indicators to display:", indicators);
  console.log("Details type:", details.type);

  const container = document.getElementById("techPhishingIndicators");

  if (!indicators || indicators.length === 0) {
    console.log("No specific indicators found, trying to extract from details");

    // Try to extract from the email-style phishing indicators that were already processed
    let indicatorText = "No specific indicators available";

    // Check if we have processed phishing indicators from the email function
    if (details.threats && Array.isArray(details.threats)) {
      const nonSummaryThreats = details.threats.filter(
        (t) => t.description && !t.description.includes("legitimacy score")
      );
      if (nonSummaryThreats.length > 0) {
        indicatorText = nonSummaryThreats
          .map(
            (threat) =>
              `• ${threat.id || threat.type || "Indicator"}: ${
                threat.description
              }`
          )
          .join("<br>");
      }
    }

    container.innerHTML = indicatorText;
    return;
  }

  // Handle domain squatting techniques differently
  if (details.type === "domain_squatting") {
    console.log("Displaying domain squatting techniques");
    const techniquesHTML = indicators
      .map((technique) => {
        const techniqueName = technique.technique || technique.id || "Unknown Technique";
        const description = technique.description || "Domain similarity detected";
        
        return `<div style="margin-bottom: 8px; padding: 6px; background: #fef3c7; border-radius: 4px; border-left: 3px solid #f59e0b;">
        <strong>${techniqueName}</strong><br>
        <span style="color: #6b7280; font-size: 11px;">${description}</span>
      </div>`;
      })
      .join("");
    
    container.innerHTML = techniquesHTML;
    console.log("Populated domain squatting techniques with", indicators.length, "techniques");
    return;
  }

  // Create formatted list of indicators for phishing
  const indicatorHTML = indicators
    .map((indicator) => {
      const id = indicator.id || indicator.type || "Unknown";
      const description =
        indicator.description || indicator.reason || "Detected";
      const severity = indicator.severity
        ? ` <span class="tech-badge ${
            indicator.severity
          }" style="margin-left: 8px;">${indicator.severity.toUpperCase()}</span>`
        : "";

      return `<div style="margin-bottom: 8px; padding: 6px; background: #f9fafb; border-radius: 4px; border-left: 3px solid #f77f00;">
      <strong>${id}</strong>${severity}<br>
      <span style="color: #6b7280; font-size: 11px;">${description}</span>
    </div>`;
    })
    .join("");

  container.innerHTML = indicatorHTML;
  console.log(
    "Populated phishing indicators list with",
    indicators.length,
    "indicators"
  );
}
