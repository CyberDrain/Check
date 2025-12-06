/*
 * Core Rules Engine (Shared)
 * Purpose: Allow playground/offline analysis of pasted HTML using the SAME
 * rule data (detection-rules.json) semantics as the content script without
 * depending on live DOM APIs that require a browser tab context.
 *
 * This module avoids mutation of extension state. It:
 *  - Accepts raw HTML string (pageSource) and optional plain text (pageText) & URL
 *  - Processes phishing_indicators with context_required & additional_checks
 *  - Applies simplified blocking_rules where possible (form_action_validation,
 *    css_spoofing_validation, resource_validation approximated via string search)
 *  - Returns a normalized evaluation object consistent with proposed PlaygroundEvaluation schema
 *
 * Unsupported (flagged in result.unsupported):
 *  - Dynamic script interception (eval/Function overrides)
 *  - True network/header inspection (CSP, referrer, response headers)
 *  - Live stylesheet rule inspection (CORS-protected CSS)
 *
 * Design choices:
 *  - No direct DOM query: uses lightweight parsing via regex for forms/selectors
 *  - Keeps scoring weights aligned with content.js (critical=25, high=15, medium=10, low=5)
 *  - Exposes pure functions so background service worker or playground UI can import safely
 */

/**
 * Evaluates a page's HTML and text content against phishing and blocking rules.
 *
 * @param {Object} params - The parameters object.
 * @param {Object} params.rulesJson - The rules JSON object containing phishing_indicators and blocking_rules.
 * @param {string} params.pageSource - The raw HTML string of the page.
 * @param {string} [params.pageText] - Optional plain text version of the page.
 * @param {string} [params.url] - Optional URL of the page.
 * @param {Object} [params.options] - Optional additional options.
 * @returns {Object} PlaygroundEvaluation result object containing threats, score, blocking info, summary, and decision.
 *
 * @example
 * import { evaluatePageWithRules } from './rules-engine-core';
 * const result = evaluatePageWithRules({
 *   rulesJson: detectionRules,
 *   pageSource: '<html>...</html>',
 *   pageText: 'Visible text',
 *   url: 'https://example.com'
 * });
 * console.log(result.finalDecision); // 'pass', 'warn', or 'block'
 */
export function evaluatePageWithRules({
  rulesJson,
  pageSource,
  pageText,
  url,
  options = {},
}) {
  const started = Date.now();
  const safeText = pageText || stripHtmlToVisibleText(pageSource || "");
  const currentUrl = url || "about:blank";
  const result = baseResult(currentUrl);

  if (!rulesJson) {
    result.error = "No rulesJson supplied";
    return finalize(result, started);
  }
  if (!pageSource) {
    result.error = "No pageSource supplied";
    return finalize(result, started);
  }

  try {
    result.rulesVersion = rulesJson.version || "unknown";

    // 1. Phishing Indicators
    if (Array.isArray(rulesJson.phishing_indicators)) {
      const { threats, score } = processPhishingIndicators(
        rulesJson.phishing_indicators,
        pageSource,
        safeText,
        currentUrl
      );
      result.threats = threats;
      result.score = score;
    } else {
      result.notes.push("No phishing_indicators in rules file");
    }

    // 2. Blocking Rules (approximate)
    if (Array.isArray(rulesJson.blocking_rules)) {
      const blocking = runBlockingRulesApprox(
        rulesJson.blocking_rules,
        pageSource,
        safeText,
        currentUrl
      );
      result.blocking = blocking;
    } else {
      result.notes.push("No blocking_rules in rules file");
    }

    // 3. Final decision logic
    deriveFinalDecision(result);
  } catch (e) {
    result.error = e.message || String(e);
  }

  return finalize(result, started);
}

function baseResult(url) {
  return {
    timestamp: new Date().toISOString(),
    url,
    threats: [],
    score: 0,
    blocking: { shouldBlock: false, reason: "", triggeredRuleIds: [] },
    summary: {},
    finalDecision: "pass",
    notes: [],
    unsupported: [
      "dynamic_scripts",
      "network_headers",
      "live_stylesheet_rules",
      "referrer_validation",
    ],
  };
}

function finalize(result, started) {
  const severities = { critical: 0, high: 0, medium: 0, low: 0 };
  result.threats.forEach((t) => severities[t.severity]++);
  result.summary = {
    totalThreats: result.threats.length,
    ...severities,
    blocking: result.blocking.shouldBlock,
    score: result.score,
    processingMs: Date.now() - started,
  };
  return result;
}

function processPhishingIndicators(indicators, pageSource, pageText, url, options = {}) {
  // Patch: If scanCleaned is true, use cleaned source for all matching
  let actualSource = pageSource;
  let actualText = pageText;
  if (options.scanCleaned && typeof getCleanPageSource === "function") {
    actualSource = getCleanPageSource();
    if (typeof getCleanPageText === "function") {
      actualText = getCleanPageText();
    }
    if (typeof logger !== "undefined" && logger.log) {
      logger.log(`[rules-engine-core] scanCleaned enabled: using cleaned page source (${actualSource.length} chars)`);
    }
  }
  const threats = [];
  let totalScore = 0;

  for (const ind of indicators) {
    try {
      const pattern = new RegExp(ind.pattern, ind.flags || "i");
      let matches = false;
      let matchDetails = "";
      let snippet = "";
      let matchedFrom = ""; // source|text|url|additional

      // Helper to build a highlighted snippet
      const buildSnippet = (source, regex) => {
        try {
          regex.lastIndex = 0; // ensure from start
          const m = regex.exec(source);
          if (!m) return "";
          const idx = m.index;
          const match = m[0];
          const RADIUS = 60;
          const start = Math.max(0, idx - RADIUS);
          const end = Math.min(source.length, idx + match.length + RADIUS);
          let excerpt = source.slice(start, end);
          // Basic HTML escape
          excerpt = excerpt
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
          const escMatch = match
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
          // Highlight first occurrence inside excerpt
          const highlightIdx = excerpt.toLowerCase().indexOf(escMatch.toLowerCase());
          if (highlightIdx >= 0) {
            excerpt =
              excerpt.slice(0, highlightIdx) +
              '<mark>' + excerpt.slice(highlightIdx, highlightIdx + escMatch.length) + '</mark>' +
              excerpt.slice(highlightIdx + escMatch.length);
          }
          if (start > 0) excerpt = '…' + excerpt;
          if (end < source.length) excerpt = excerpt + '…';
          return excerpt;
        } catch {
          return "";
        }
      };

      // Code-driven logic if flagged in rules file
      if (ind.code_driven === true && ind.code_logic) {
        // Supported code-driven logic types
        if (ind.code_logic.type === "substring") {
          matches = (ind.code_logic.substrings || []).every(sub => actualSource.includes(sub));
          if (matches) {
            matchedFrom = "source (substring)";
            snippet = ind.code_logic.substrings.join(", ");
          }
        } else if (ind.code_logic.type === "substring_not") {
          matches = (ind.code_logic.substrings || []).every(sub => actualSource.includes(sub)) &&
                    (ind.code_logic.not_substrings || []).every(sub => !actualSource.includes(sub));
          if (matches) {
            matchedFrom = "source (substring + not)";
            snippet = ind.code_logic.substrings.join(", ");
          }
        } else if (ind.code_logic.type === "allowlist") {
          const lowerSource = actualSource.toLowerCase();
          const isAllowlisted = (ind.code_logic.allowlist || []).some(phrase => lowerSource.includes(phrase));
          if (!isAllowlisted && ind.code_logic.optimized_pattern) {
            const optPattern = new RegExp(ind.code_logic.optimized_pattern, ind.flags || "i");
            if (optPattern.test(actualSource)) {
              matches = true;
              matchedFrom = "source (optimized regex)";
              snippet = buildSnippet(actualSource, optPattern);
            }
          }
        } else if (ind.code_logic.type === "substring_not_allowlist") {
          const substring = ind.code_logic.substring;
          const allowlist = ind.code_logic.allowlist || [];
          
          if (substring && actualSource.includes(substring)) {
            const lowerSource = actualSource.toLowerCase();
            const isAllowed = allowlist.some(allowed => 
              lowerSource.includes(allowed.toLowerCase())
            );
            
            if (!isAllowed) {
              matches = true;
              matchedFrom = "source (substring not in allowlist)";
              snippet = substring;
            }
          }
        } else if (ind.code_logic.type === "substring_or_regex") {
          const substrings = ind.code_logic.substrings || [];
          const lowerSource = actualSource.toLowerCase();
          
          // Fast path: check if any substring is present
          for (const sub of substrings) {
            if (lowerSource.includes(sub.toLowerCase())) {
              matches = true;
              matchedFrom = "source (substring)";
              snippet = sub;
              break;
            }
          }
          
          // Fallback: use regex if no substring matched
          if (!matches && ind.code_logic.regex) {
            const pattern = new RegExp(ind.code_logic.regex, ind.code_logic.flags || "i");
            if (pattern.test(actualSource)) {
              matches = true;
              matchedFrom = "source (regex)";
              snippet = buildSnippet(actualSource, pattern);
            }
          }
        } else if (ind.code_logic.type === "substring_with_exclusions") {
          const lowerSource = actualSource.toLowerCase();
          
          // First check exclusions
          const excludeList = ind.code_logic.exclude_if_contains || [];
          const hasExclusion = excludeList.some(excl => 
            lowerSource.includes(excl.toLowerCase())
          );
          
          if (!hasExclusion) {
            if (ind.code_logic.match_any) {
              // Simple match - check if any phrase is present
              for (const phrase of ind.code_logic.match_any) {
                if (lowerSource.includes(phrase.toLowerCase())) {
                  matches = true;
                  matchedFrom = "source (substring with exclusions)";
                  snippet = phrase;
                  break;
                }
              }
            } else if (ind.code_logic.match_pattern_parts) {
              // Complex match - all pattern parts must be present
              const parts = ind.code_logic.match_pattern_parts;
              matches = parts.every(partGroup => 
                partGroup.some(part => lowerSource.includes(part.toLowerCase()))
              );
              if (matches) {
                matchedFrom = "source (pattern parts with exclusions)";
                snippet = parts.map(p => p.join('|')).join(' + ');
              }
            }
          }
        }
      } else {
        // Default regex-driven logic
        // Attempt match against full pageSource
        // Patch: Use actualSource/actualText for matching
        if (pattern.test(actualSource)) {
          matches = true;
          matchedFrom = "source";
          snippet = buildSnippet(actualSource, pattern);
        } else if (pattern.test(actualText)) {
          matches = true;
          matchedFrom = "text";
          snippet = buildSnippet(actualText, pattern);
        } else if (pattern.test(url)) {
          matches = true;
          matchedFrom = "url";
          snippet = url;
        }

        // additional_checks
        if (!matches && ind.additional_checks) {
          for (const check of ind.additional_checks) {
            if (pageSource.includes(check) || pageText.includes(check)) {
              matches = true;
              matchDetails = "additional check";
              break;
            }
          }
        }
      }

      // context_required (regex semantics)
      if (matches && ind.context_required) {
        let contextOk = false;
        for (const ctx of ind.context_required) {
          try {
            const rx = new RegExp(ctx, "i");
            if (rx.test(pageSource) || rx.test(pageText)) {
              contextOk = true;
              break;
            }
          } catch {
            // fallback substring
            const lc = ctx.toLowerCase();
            if (
              pageSource.toLowerCase().includes(lc) ||
              pageText.toLowerCase().includes(lc)
            ) {
              contextOk = true;
              break;
            }
          }
        }
        if (!contextOk) matches = false;
      }

      if (!matches) continue;

      const threat = {
        id: ind.id,
        severity: ind.severity || "medium",
        action: ind.action || "warn",
        category: ind.category || "general",
        confidence: ind.confidence ?? 0.5,
        description: ind.description || "",
        matchDetails: snippet || matchedFrom || matchDetails || "",
      };
      threats.push(threat);

      // weight scoring consistent with content script
      let weight = 0;
      switch (threat.severity) {
        case "critical":
          weight = 25;
          break;
        case "high":
          weight = 15;
          break;
        case "medium":
          weight = 10;
          break;
        case "low":
          weight = 5;
          break;
      }
      totalScore += weight * (threat.confidence || 0.5);
    } catch (e) {
      // skip faulty indicator
    }
  }

  return { threats, score: totalScore };
}

function runBlockingRulesApprox(blockingRules, pageSource, pageText, url) {
  const triggered = [];

  for (const rule of blockingRules) {
    try {
      switch (rule.type) {
        case "form_action_validation": {
          const mustNotContain = rule.condition?.action_must_not_contain;
          const hasPw = rule.condition?.has_password_field;
          const forms = extractForms(pageSource);
          const hasPassword = hasPw ? forms.some((f) => f.hasPassword) : true;
          if (hasPassword && mustNotContain) {
            for (const f of forms) {
              if (f.action && f.action.includes(mustNotContain)) {
                triggered.push({ id: rule.id, description: rule.description });
                break;
              }
            }
          }
          break;
        }
        case "resource_validation": {
            const patt = rule.condition?.resource_pattern;
            const required = rule.condition?.required_origin;
            if (patt) {
              const regex = new RegExp(patt, "i");
              const links = extractLinksAndScripts(pageSource);
              const matches = links.filter((l) => regex.test(l));
              if (matches.length) {
                // If required origin present and mismatch requested
                if (rule.condition?.block_if_different_origin && required) {
                  if (matches.some((m) => !m.startsWith(required))) {
                    triggered.push({ id: rule.id, description: rule.description });
                  }
                }
              }
            }
            break;
        }
        case "css_spoofing_validation": {
          const cssIndicators = rule.condition?.css_indicators || [];
          let cssHits = 0;
          for (const ind of cssIndicators) {
            try {
              const rx = new RegExp(ind, "i");
              if (rx.test(pageSource)) cssHits++;
            } catch {
              if (pageSource.toLowerCase().includes(ind.toLowerCase())) cssHits++;
            }
          }
          const min = rule.condition?.minimum_css_matches || 3;
          const formActionNotContain = rule.condition?.form_action_must_not_contain;
          const hasCred = rule.condition?.has_credential_fields;
          if (cssHits >= min) {
            const forms = extractForms(pageSource);
            const hasPassword = hasCred ? forms.some((f) => f.hasPassword) : true;
            let actionMismatch = true;
            if (formActionNotContain) {
              actionMismatch = forms.some(
                (f) => f.action && f.action.includes(formActionNotContain)
              );
            }
            if (hasPassword && actionMismatch) {
              triggered.push({ id: rule.id, description: rule.description });
            }
          }
          break;
        }
        default:
          // Unsupported types are ignored (network/header etc.)
          break;
      }
    } catch (_) {
      // Continue
    }
  }

  if (triggered.length) {
    return {
      shouldBlock: true,
      reason: `${triggered.length} blocking rule(s) triggered`,
      triggeredRuleIds: triggered.map((t) => t.id),
    };
  }
  return { shouldBlock: false, reason: "No blocking rules triggered", triggeredRuleIds: [] };
}

function deriveFinalDecision(result) {
  // 1. Hard block from blocking rules
  if (result.blocking.shouldBlock) {
    result.finalDecision = "block";
    return;
  }
  const threats = result.threats;
  const anyBlockThreat = threats.some(
    (t) => t.action === "block" && (t.severity === "critical" || t.severity === "high")
  );
  if (anyBlockThreat) {
    result.finalDecision = "block";
    return;
  }
  const anyWarn = threats.some((t) => t.action === "warn" || t.severity !== "low");
  if (anyWarn && threats.length) {
    result.finalDecision = "warn";
    return;
  }
  result.finalDecision = "pass";
}

// Helpers --------------------------------------------------------------

function stripHtmlToVisibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractForms(html) {
  const forms = [];
  const formRegex = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = formRegex.exec(html))) {
    const formTag = m[0];
    const inner = m[1];
    const actionMatch = formTag.match(/action=["']([^"']+)["']/i);
    const action = actionMatch ? actionMatch[1] : "";
    const hasPassword = /type=["']password["']/i.test(inner);
    forms.push({ action, hasPassword });
  }
  return forms;
}

function extractLinksAndScripts(html) {
  const out = [];
  const linkRegex = /<(?:link|script)[^>]+(?:href|src)=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = linkRegex.exec(html))) {
    out.push(m[1]);
  }
  return out;
}
