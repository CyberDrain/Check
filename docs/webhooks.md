# Webhook System

## Configuration

Configure a single generic webhook that can receive multiple event types:

```json
{
  "genericWebhook": {
    "enabled": true,
    "url": "https://webhook.example.com/endpoint",
    "events": [
      "detection_alert",
      "false_positive_report",
      "page_blocked",
      "rogue_app_detected"
    ]
  }
}
```

CIPP reporting uses separate dedicated settings:

```json
{
  "enableCippReporting": true,
  "cippServerUrl": "https://cipp-server.com",
  "cippTenantId": "tenant-id"
}
```

## Unified Webhook Schema

All webhook payloads follow a consistent structure:

```json
{
  "version": "1.0",
  "type": "<event_type>",
  "timestamp": "2025-11-05T22:00:00.000Z",
  "source": "Check Extension",
  "extensionVersion": "1.0.0",
  "user": { /* optional user profile */ },
  "browser": { /* optional browser context */ },
  "tenantId": "tenant-id",
  "data": {
    "url": "https://example.com",
    "severity": "high|medium|low|critical|info",
    "score": 0,
    "threshold": 85,
    "reason": "Description of event",
    "detectionMethod": "rules_engine|rogue_app_detection|etc",
    "rule": "rule-id",
    "ruleDescription": "Rule description",
    "category": "phishing|oauth_threat|validation|etc",
    "context": {
      "referrer": null,
      "pageTitle": null,
      "domain": null,
      "redirectTo": null
    }
  }
}
```

## Webhook Types

### detection_alert
General phishing detection events.

```json
{
  "version": "1.0",
  "type": "detection_alert",
  "timestamp": "2025-11-05T22:00:00.000Z",
  "source": "Check Extension",
  "extensionVersion": "1.0.0",
  "data": {
    "url": "https://phishing-site.example.com",
    "severity": "high",
    "score": 15,
    "threshold": 85,
    "reason": "Multiple phishing indicators detected",
    "detectionMethod": "rules_engine",
    "rule": "rule-1",
    "ruleDescription": "Form posts to non-Microsoft domain",
    "category": "phishing",
    "confidence": 0.9,
    "matchedRules": ["rule-1", "rule-2"],
    "context": {
      "referrer": "https://email-client.com",
      "pageTitle": "Microsoft Login",
      "domain": "phishing-site.example.com",
      "redirectTo": null
    }
  }
}
```

### false_positive_report
User-submitted false positive reports from blocked pages.

```json
{
  "version": "1.0",
  "type": "false_positive_report",
  "timestamp": "2025-11-05T22:00:00.000Z",
  "source": "Check Extension",
  "extensionVersion": "1.0.0",
  "data": {
    "url": "https://legitimate-site.example.com",
    "severity": "info",
    "reason": "User reported false positive",
    "reportTimestamp": "2025-11-05T22:00:00.000Z",
    "userAgent": "Mozilla/5.0...",
    "browserInfo": {
      "platform": "Linux x86_64",
      "language": "en-US"
    },
    "detectionDetails": {},
    "userComments": null,
    "context": {
      "referrer": null,
      "pageTitle": null,
      "domain": null
    }
  }
}
```

### page_blocked
Sent when a page is blocked.

```json
{
  "version": "1.0",
  "type": "page_blocked",
  "timestamp": "2025-11-05T22:00:00.000Z",
  "source": "Check Extension",
  "extensionVersion": "1.0.0",
  "data": {
    "url": "https://malicious-site.example.com",
    "severity": "critical",
    "score": 0,
    "threshold": 85,
    "reason": "Phishing attempt detected",
    "detectionMethod": "rules_engine",
    "rule": "critical-rule-id",
    "ruleDescription": "Critical phishing indicator detected",
    "category": "phishing",
    "action": "blocked",
    "context": {
      "referrer": null,
      "pageTitle": "Fake Login",
      "domain": "malicious-site.example.com",
      "redirectTo": null
    }
  }
}
```

### rogue_app_detected
OAuth rogue application detection events.

```json
{
  "version": "1.0",
  "type": "rogue_app_detected",
  "timestamp": "2025-11-05T22:00:00.000Z",
  "source": "Check Extension",
  "extensionVersion": "1.0.0",
  "data": {
    "url": "https://login.microsoftonline.com/...",
    "severity": "critical",
    "reason": "Rogue OAuth application detected",
    "detectionMethod": "rogue_app_detection",
    "category": "oauth_threat",
    "clientId": "app-client-id",
    "appName": "Suspicious App",
    "appInfo": {
      "description": "Known malicious OAuth application",
      "tags": ["BEC", "exfiltration"],
      "references": ["https://..."],
      "risk": "high"
    },
    "context": {
      "referrer": null,
      "pageTitle": null,
      "domain": null,
      "redirectTo": "https://malicious-redirect.com",
      "isLocalhost": false,
      "isPrivateIP": false
    }
  }
}
```

### threat_detected
General threat detection events.

```json
{
  "version": "1.0",
  "type": "threat_detected",
  "timestamp": "2025-11-05T22:00:00.000Z",
  "source": "Check Extension",
  "extensionVersion": "1.0.0",
  "data": {
    "url": "https://suspicious-site.example.com",
    "severity": "medium",
    "score": 50,
    "threshold": 85,
    "reason": "Suspicious content detected",
    "detectionMethod": "content_analysis",
    "rule": null,
    "category": "credential_harvesting",
    "confidence": 0.75,
    "indicators": ["fake-login-form", "typosquatting"],
    "matchedRules": ["rule-a", "rule-b"],
    "context": {
      "referrer": null,
      "pageTitle": "Login",
      "domain": "suspicious-site.example.com",
      "redirectTo": null
    }
  }
}
```

### validation_event
Legitimate page validation events.

```json
{
  "version": "1.0",
  "type": "validation_event",
  "timestamp": "2025-11-05T22:00:00.000Z",
  "source": "Check Extension",
  "extensionVersion": "1.0.0",
  "data": {
    "url": "https://login.microsoftonline.com",
    "severity": "info",
    "reason": "Legitimate domain validated",
    "detectionMethod": "domain_validation",
    "category": "validation",
    "result": "legitimate",
    "confidence": 1.0,
    "context": {
      "referrer": null,
      "pageTitle": null,
      "domain": "login.microsoftonline.com",
      "redirectTo": null
    }
  }
}
```

## HTTP Headers

All webhook requests include:

```
Content-Type: application/json
User-Agent: Check/{version}
X-Webhook-Type: {webhook-type}
X-Webhook-Version: 1.0
```

