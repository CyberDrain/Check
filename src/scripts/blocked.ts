/**
 * Blocked Page JavaScript - CSP Compliant External Script
 * Handles URL defanging, branding, and user interactions for blocked pages
 */

interface BlockDetails {
  url?: string;
  reason?: string;
  rule?: string;
  ruleDescription?: string;
  score?: number;
  threshold?: number;
  detectedElements?: string[];
  timestamp?: string;
  confidence?: number;
}

interface BrandingResponse {
  success: boolean;
  branding?: {
    supportEmail?: string;
  };
}

// Parse URL parameters to get block details with enhanced defanging
function parseUrlParams(): void {
  console.log('parseUrlParams called');
  console.log('Current URL:', window.location.href);

  const urlParams = new URLSearchParams(window.location.search);
  console.log('URL params:', urlParams.toString());
  console.log('All URL params:');
  urlParams.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });

  // Parse details from the new format (from content script)
  const detailsParam = urlParams.get('details');
  console.log('Details param:', detailsParam);

  if (detailsParam) {
    try {
      const details: BlockDetails = JSON.parse(decodeURIComponent(detailsParam));
      console.log('Parsed details:', details);

      // Update blocked URL with defanging
      const blockedUrlElement = document.getElementById('blockedUrl');
      if (details.url && blockedUrlElement) {
        console.log('Setting blocked URL to:', details.url);
        const defangedUrl = defangUrl(details.url);
        console.log('Defanged URL:', defangedUrl);
        blockedUrlElement.textContent = defangedUrl;
      } else {
        console.log('No URL in details, using fallback');
        const fallbackUrl = document.referrer || 'Unknown URL';
        if (blockedUrlElement) {
          blockedUrlElement.textContent = defangUrl(fallbackUrl);
        }
      }

      // Update block reason
      const blockReasonElement = document.getElementById('blockReason');
      if (details.reason && blockReasonElement) {
        console.log('Setting block reason to:', details.reason);
        blockReasonElement.textContent = details.reason;
      }

      // Update threat category based on rule description or score
      const threatCategoryElement = document.getElementById('threatCategory');
      if (threatCategoryElement) {
        if (details.ruleDescription) {
          threatCategoryElement.textContent = details.ruleDescription;
        } else if (details.rule) {
          threatCategoryElement.textContent = `Rule: ${details.rule}`;
        } else if (details.score !== undefined) {
          threatCategoryElement.textContent = `Score: ${details.score}/${details.threshold}`;
        }
      }

      // Populate technical details section
      populateTechnicalDetails(details);
    } catch (error) {
      console.warn('Failed to parse block details:', error);
      console.log('Error details:', error instanceof Error ? error.message : String(error));
      // Fallback to legacy URL parsing
      const blockedUrl = urlParams.get('url') || document.referrer || 'Unknown URL';
      console.log('Using fallback URL:', blockedUrl);
      const blockedUrlElement = document.getElementById('blockedUrl');
      if (blockedUrlElement) {
        blockedUrlElement.textContent = defangUrl(blockedUrl);
      }
    }
  } else {
    console.log('No details param, using legacy parsing');
    // Legacy URL parsing for backward compatibility
    const blockedUrl = urlParams.get('url') || document.referrer || 'Unknown URL';
    console.log('Legacy blocked URL:', blockedUrl);
    const blockedUrlElement = document.getElementById('blockedUrl');
    if (blockedUrlElement) {
      blockedUrlElement.textContent = defangUrl(blockedUrl);
    }

    const reason = urlParams.get('reason');
    if (reason) {
      console.log('Legacy reason:', reason);
      const blockReasonElement = document.getElementById('blockReason');
      if (blockReasonElement) {
        blockReasonElement.textContent = decodeURIComponent(reason);
      }
    }
  }

  const blockedUrlElement = document.getElementById('blockedUrl');
  console.log(
    'Final blocked URL element text:',
    blockedUrlElement?.textContent
  );
}

function defangUrl(url: string): string {
  if (!url || url === 'about:blank' || url.includes('chrome-extension://')) {
    return 'Unknown URL';
  }

  // Defang the URL by replacing only colons (less aggressive)
  let defanged = url.replace(/:/g, '[:]'); // Replace colons only

  // Truncate if too long
  if (defanged.length > 80) {
    defanged = defanged.substring(0, 77) + '...';
  }

  return defanged;
}

function truncateUrl(url: string): string {
  if (url.length > 50) {
    return url.substring(0, 47) + '...';
  }
  return url;
}

function goBack(): void {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = 'about:blank';
  }
}

function contactAdmin(): void {
  console.log('contactAdmin function called');

  // Get support email from background script (centralized through config manager)
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(
        { type: 'GET_BRANDING_CONFIG' },
        (response: BrandingResponse) => {
          if (chrome.runtime.lastError) {
            console.warn(
              'Failed to get branding from background:',
              chrome.runtime.lastError.message
            );
            alert(
              'No support contact information has been configured by your administrator.'
            );
            return;
          }

          if (
            response?.success &&
            response.branding?.supportEmail
          ) {
            console.log(
              'Using branded support email:',
              response.branding.supportEmail
            );
            openMailto(response.branding.supportEmail);
          } else {
            console.log('No branded support email available');
            alert(
              'No support contact information has been configured by your administrator.'
            );
          }
        }
      );
    } else {
      console.log('Chrome runtime not available, no support contact available');
      alert(
        'No support contact information has been configured by your administrator.'
      );
    }
  } catch (error) {
    console.error('Error accessing branding config:', error);
    alert(
      'No support contact information has been configured by your administrator.'
    );
  }
}

function openMailto(supportEmail: string): void {
  const blockedUrlElement = document.getElementById('blockedUrl');
  const blockReasonElement = document.getElementById('blockReason');
  
  const blockedUrl = blockedUrlElement?.textContent || 'Unknown URL';
  const reason = blockReasonElement?.textContent || 'Unknown reason';

  // Create subject with defanged URL
  const subject = encodeURIComponent(
    `Security Alert: Website Blocked - ${blockedUrl}`
  );

  // Get phishing indicators from URL parameters if available
  const urlParams = new URLSearchParams(window.location.search);
  const detailsParam = urlParams.get('details');
  let phishingIndicators = 'Not available';

  console.log('=== BLOCKED.JS DEBUG INFO ===');
  console.log('Blocked URL:', blockedUrl);
  console.log('Block Reason:', reason);
  console.log('URL Params:', urlParams.toString());
  console.log('Raw details param:', detailsParam);

  if (detailsParam) {
    try {
      const details: BlockDetails = JSON.parse(decodeURIComponent(detailsParam));
      if (details.detectedElements && details.detectedElements.length > 0) {
        phishingIndicators = details.detectedElements.join(', ');
      }
      console.log('Phishing indicators:', phishingIndicators);
    } catch (error) {
      console.warn('Failed to parse details for email:', error);
    }
  }

  // Create email body with technical details
  const body = encodeURIComponent(`
Dear Administrator,

A potentially malicious website has been blocked by the Check security extension.

BLOCKED WEBSITE DETAILS:
- URL: ${blockedUrl}
- Block Reason: ${reason}
- Date/Time: ${new Date().toLocaleString()}
- Phishing Indicators: ${phishingIndicators}

This email was automatically generated by the Check browser extension. 
Please review the blocked URL and take appropriate action if necessary.

Best regards,
Check Security Extension
  `.trim());

  // Open email client
  const mailtoUrl = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
  console.log('Opening mailto URL:', mailtoUrl);
  
  try {
    window.open(mailtoUrl, '_blank');
  } catch (error) {
    console.error('Failed to open email client:', error);
    // Fallback: copy email details to clipboard
    navigator.clipboard?.writeText(`
Support Email: ${supportEmail}
Subject: Security Alert: Website Blocked - ${blockedUrl}
Details: ${reason}
Time: ${new Date().toLocaleString()}
    `.trim()).then(() => {
      alert('Email details copied to clipboard. Please contact your administrator.');
    }).catch(() => {
      alert(`Please contact your administrator at: ${supportEmail}`);
    });
  }
}

function populateTechnicalDetails(details: BlockDetails): void {
  const technicalDetailsElement = document.getElementById('technicalDetails');
  if (!technicalDetailsElement) return;

  let detailsHtml = '<h4>Technical Details</h4>';
  
  if (details.timestamp) {
    detailsHtml += `<p><strong>Detection Time:</strong> ${new Date(details.timestamp).toLocaleString()}</p>`;
  }
  
  if (details.confidence !== undefined) {
    detailsHtml += `<p><strong>Confidence Score:</strong> ${(details.confidence * 100).toFixed(1)}%</p>`;
  }
  
  if (details.detectedElements && details.detectedElements.length > 0) {
    detailsHtml += '<p><strong>Detected Elements:</strong></p>';
    detailsHtml += '<ul>';
    details.detectedElements.forEach(element => {
      detailsHtml += `<li>${element}</li>`;
    });
    detailsHtml += '</ul>';
  }

  technicalDetailsElement.innerHTML = detailsHtml;
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', parseUrlParams);
} else {
  parseUrlParams();
}

// Make functions available globally for HTML onclick handlers
(window as any).goBack = goBack;
(window as any).contactAdmin = contactAdmin;