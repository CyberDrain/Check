/**
 * Domain Squatting Detector Module
 * Detects typosquatting, homoglyphs, combosquatting, and other domain impersonation techniques
 */

import logger from '../utils/logger.js';

export class DomainSquattingDetector {
  constructor() {
    this.protectedDomains = [];
    this.enabled = true;
    this.deviationThreshold = 2; // Maximum Levenshtein distance
    this.algorithms = {
      levenshtein: true,
      homoglyph: true,
      typosquat: true,
      combosquat: true
    };
    
    // Common homoglyphs (confusable characters)
    this.homoglyphs = {
      'a': ['à', 'á', 'â', 'ã', 'ä', 'å', 'ā', 'ă', 'ą', 'α', 'а'],
      'b': ['ḃ', 'ḅ', 'ḇ', 'ь', 'в'],
      'c': ['ć', 'ĉ', 'ċ', 'ç', 'č', 'ϲ', 'с'],
      'd': ['ď', 'ḋ', 'ḍ', 'ḏ', 'ḑ', 'ḓ', 'ԁ', 'ժ'],
      'e': ['è', 'é', 'ê', 'ë', 'ē', 'ĕ', 'ė', 'ę', 'ě', 'е', 'ε'],
      'g': ['ĝ', 'ğ', 'ġ', 'ģ', 'ց', 'ǥ'],
      'h': ['ĥ', 'ḣ', 'ḥ', 'ḧ', 'ḩ', 'ḫ', 'һ', 'հ'],
      'i': ['ì', 'í', 'î', 'ï', 'ĩ', 'ī', 'ĭ', 'į', 'ı', 'і', 'ι'],
      'j': ['ĵ', 'ј'],
      'k': ['ķ', 'ḱ', 'ḳ', 'ḵ', 'κ', 'к'],
      'l': ['ĺ', 'ļ', 'ľ', 'ḷ', 'ḹ', 'ḻ', 'ḽ', 'ӏ', 'ℓ'],
      'm': ['ḿ', 'ṁ', 'ṃ', 'м', 'ṁ'],
      'n': ['ñ', 'ń', 'ņ', 'ň', 'ṅ', 'ṇ', 'ṉ', 'ṋ', 'п'],
      'o': ['ò', 'ó', 'ô', 'õ', 'ö', 'ø', 'ō', 'ŏ', 'ő', 'ο', 'о', 'օ'],
      'p': ['ṕ', 'ṗ', 'р', 'ρ'],
      'q': ['ԛ'],
      'r': ['ŕ', 'ŗ', 'ř', 'ṙ', 'ṛ', 'ṝ', 'ṟ', 'г'],
      's': ['ś', 'ŝ', 'ş', 'š', 'ṡ', 'ṣ', 'ṥ', 'ṧ', 'ṩ', 'ѕ'],
      't': ['ţ', 'ť', 'ṫ', 'ṭ', 'ṯ', 'ṱ', 'т', 'τ'],
      'u': ['ù', 'ú', 'û', 'ü', 'ũ', 'ū', 'ŭ', 'ů', 'ű', 'ų', 'υ', 'и'],
      'v': ['ṽ', 'ṿ', 'ν', 'ѵ'],
      'w': ['ŵ', 'ẁ', 'ẃ', 'ẅ', 'ẇ', 'ẉ', 'ẘ', 'ԝ'],
      'x': ['ẋ', 'ẍ', 'х', 'χ'],
      'y': ['ý', 'ÿ', 'ŷ', 'ẏ', 'ẙ', 'ỳ', 'ỵ', 'у', 'ү'],
      'z': ['ź', 'ż', 'ž', 'ẑ', 'ẓ', 'ẕ', 'ᴢ'],
      '0': ['о', 'ο', 'о', '᧐'],
      '1': ['l', 'і', 'Ӏ', 'ǀ'],
      '3': ['з', 'ʒ', 'ȝ'],
      '5': ['ƽ'],
      '6': ['б'],
      '8': ['ց'],
      '9': ['ԛ', 'ց']
    };
    
    // Reverse lookup for homoglyphs
    this.homoglyphReverse = {};
    this.buildReverseHomoglyphMap();
  }
  
  /**
   * Build reverse lookup map for homoglyphs
   */
  buildReverseHomoglyphMap() {
    for (const [base, variants] of Object.entries(this.homoglyphs)) {
      for (const variant of variants) {
        this.homoglyphReverse[variant] = base;
      }
    }
  }
  
  /**
   * Extract domains from URL allowlist patterns
   * Handles regex patterns, wildcards, and plain URLs/domains
   */
  extractDomainsFromAllowlist(allowlist) {
    if (!Array.isArray(allowlist) || allowlist.length === 0) {
      return [];
    }
    
    const domains = [];
    
    for (const pattern of allowlist) {
      if (!pattern || typeof pattern !== 'string') continue;
      
      try {
        let domain = null;
        
        // Remove regex anchors and escaping
        let cleaned = pattern.trim()
          .replace(/^\^/, '')  // Remove leading ^
          .replace(/\$$/, '')  // Remove trailing $
          .replace(/\\/g, ''); // Remove escape characters
        
        // Try to extract domain from URL pattern
        // Pattern formats:
        // - https://example.com/...
        // - ^https://example\.com$
        // - *.example.com
        // - example.com
        
        // Extract hostname from URL-like patterns
        const urlMatch = cleaned.match(/^(?:https?:\/\/)?([a-zA-Z0-9][\w\-\.]*[a-zA-Z0-9])/);
        if (urlMatch) {
          domain = urlMatch[1];
          
          // Remove wildcards
          domain = domain.replace(/^\*\./, '');
          
          // Remove path and query string indicators
          domain = domain.split('/')[0].split('?')[0].split('#')[0];
          
          // Remove regex patterns like (.*)?
          domain = domain.replace(/\(.*?\)/g, '');
          
          // Remove trailing dots or special chars
          domain = domain.replace(/[^\w\-\.]/g, '').replace(/\.$/, '');
          
          // Validate it looks like a domain
          if (domain && domain.includes('.') && domain.length > 3) {
            domains.push(domain.toLowerCase());
          }
        }
      } catch (error) {
        logger.debug(`Could not extract domain from pattern: ${pattern}`, error);
      }
    }
    
    // Remove duplicates
    return [...new Set(domains)];
  }
  
  /**
   * Initialize with configuration
   */
  async initialize(config, urlAllowlist = []) {
    try {
      if (config.domain_squatting) {
        this.enabled = config.domain_squatting.enabled !== false;
        this.protectedDomains = config.domain_squatting.protected_domains || [];
        this.deviationThreshold = config.domain_squatting.deviation_threshold || 2;
        
        if (config.domain_squatting.algorithms) {
          this.algorithms = { ...this.algorithms, ...config.domain_squatting.algorithms };
        }
      }
      
      // Extract domains from URL allowlist patterns
      const allowlistDomains = this.extractDomainsFromAllowlist(urlAllowlist);
      if (allowlistDomains.length > 0) {
        // Merge with protected domains from rules (avoid duplicates)
        const allDomains = [...new Set([...this.protectedDomains, ...allowlistDomains])];
        this.protectedDomains = allDomains;
        logger.log(`Added ${allowlistDomains.length} domains from URL allowlist`);
      }
      
      logger.log('DomainSquattingDetector initialized:', {
        enabled: this.enabled,
        protectedDomains: this.protectedDomains.length,
        fromRules: config.domain_squatting?.protected_domains?.length || 0,
        fromAllowlist: allowlistDomains.length,
        deviationThreshold: this.deviationThreshold
      });
    } catch (error) {
      logger.error('Failed to initialize DomainSquattingDetector:', error);
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config) {
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
    if (config.protected_domains) {
      this.protectedDomains = config.protected_domains;
    }
    if (config.deviation_threshold !== undefined) {
      this.deviationThreshold = config.deviation_threshold;
    }
    if (config.algorithms) {
      this.algorithms = { ...this.algorithms, ...config.algorithms };
    }
  }
  
  /**
   * Check if a domain is attempting to squat on protected domains
   * @param {string} testDomain - Domain to test
   * @returns {Object|null} Detection result or null if no squatting detected
   */
  checkDomain(testDomain) {
    if (!this.enabled || !testDomain) {
      return null;
    }
    
    // Extract domain without subdomain and TLD for comparison
    const testBase = this.extractBaseDomain(testDomain);
    
    for (const protectedDomain of this.protectedDomains) {
      const protectedBase = this.extractBaseDomain(protectedDomain);
      
      // Skip if domains are identical
      if (testBase === protectedBase) {
        continue;
      }
      
      // Run detection algorithms
      const detections = [];
      
      if (this.algorithms.levenshtein) {
        const levenshteinResult = this.detectLevenshtein(testBase, protectedBase);
        if (levenshteinResult) {
          detections.push(levenshteinResult);
        }
      }
      
      if (this.algorithms.homoglyph) {
        const homoglyphResult = this.detectHomoglyph(testBase, protectedBase);
        if (homoglyphResult) {
          detections.push(homoglyphResult);
        }
      }
      
      if (this.algorithms.typosquat) {
        const typosquatResult = this.detectTyposquat(testBase, protectedBase);
        if (typosquatResult) {
          detections.push(typosquatResult);
        }
      }
      
      if (this.algorithms.combosquat) {
        const combosquatResult = this.detectCombosquat(testBase, protectedBase);
        if (combosquatResult) {
          detections.push(combosquatResult);
        }
      }
      
      // If any detection triggered, return result
      if (detections.length > 0) {
        return {
          detected: true,
          testDomain: testDomain,
          protectedDomain: protectedDomain,
          techniques: detections,
          severity: this.calculateSeverity(detections),
          confidence: this.calculateConfidence(detections)
        };
      }
    }
    
    return null;
  }
  
  /**
   * Extract base domain without subdomain and TLD
   */
  extractBaseDomain(domain) {
    if (!domain) return '';
    
    // Remove protocol
    domain = domain.replace(/^https?:\/\//, '');
    
    // Remove path
    domain = domain.split('/')[0];
    
    // Remove port
    domain = domain.split(':')[0];
    
    // Split by dots
    const parts = domain.split('.');
    
    // Get the main domain part (second-to-last typically)
    if (parts.length >= 2) {
      // Handle common two-part TLDs like .co.uk, .com.au
      if (parts.length >= 3 && ['co', 'com', 'net', 'org', 'gov', 'edu'].includes(parts[parts.length - 2])) {
        return parts[parts.length - 3];
      }
      return parts[parts.length - 2];
    }
    
    return parts[0] || '';
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Detect domain squatting using Levenshtein distance
   */
  detectLevenshtein(testDomain, protectedDomain) {
    const distance = this.levenshteinDistance(testDomain, protectedDomain);
    
    if (distance > 0 && distance <= this.deviationThreshold) {
      return {
        technique: 'levenshtein',
        description: `Domain differs by ${distance} character(s) from protected domain`,
        distance: distance,
        confidence: 1 - (distance / this.deviationThreshold)
      };
    }
    
    return null;
  }
  
  /**
   * Normalize domain by replacing homoglyphs with standard characters
   */
  normalizeHomoglyphs(domain) {
    let normalized = '';
    for (const char of domain) {
      normalized += this.homoglyphReverse[char] || char;
    }
    return normalized;
  }
  
  /**
   * Detect homoglyph substitution
   */
  detectHomoglyph(testDomain, protectedDomain) {
    const normalized = this.normalizeHomoglyphs(testDomain);
    
    if (normalized !== testDomain && normalized === protectedDomain) {
      return {
        technique: 'homoglyph',
        description: 'Domain uses confusable characters (homoglyphs) to mimic protected domain',
        original: testDomain,
        normalized: normalized,
        confidence: 0.95
      };
    }
    
    // Also check if normalized version is close to protected domain
    const distance = this.levenshteinDistance(normalized, protectedDomain);
    if (normalized !== testDomain && distance > 0 && distance <= this.deviationThreshold) {
      return {
        technique: 'homoglyph',
        description: 'Domain uses confusable characters and differs slightly from protected domain',
        original: testDomain,
        normalized: normalized,
        distance: distance,
        confidence: 0.85 - (distance * 0.1)
      };
    }
    
    return null;
  }
  
  /**
   * Detect common typosquatting patterns
   */
  detectTyposquat(testDomain, protectedDomain) {
    // Check for character swaps (transposition)
    for (let i = 0; i < protectedDomain.length - 1; i++) {
      const swapped = protectedDomain.substring(0, i) +
                      protectedDomain.charAt(i + 1) +
                      protectedDomain.charAt(i) +
                      protectedDomain.substring(i + 2);
      
      if (swapped === testDomain) {
        return {
          technique: 'typosquat',
          description: 'Domain has swapped adjacent characters',
          pattern: 'character_swap',
          position: i,
          confidence: 0.9
        };
      }
    }
    
    // Check for missing character
    for (let i = 0; i < protectedDomain.length; i++) {
      const missing = protectedDomain.substring(0, i) + protectedDomain.substring(i + 1);
      
      if (missing === testDomain) {
        return {
          technique: 'typosquat',
          description: 'Domain is missing a character',
          pattern: 'character_omission',
          position: i,
          confidence: 0.85
        };
      }
    }
    
    // Check for duplicate character
    for (let i = 0; i < protectedDomain.length; i++) {
      const duplicated = protectedDomain.substring(0, i + 1) +
                         protectedDomain.charAt(i) +
                         protectedDomain.substring(i + 1);
      
      if (duplicated === testDomain) {
        return {
          technique: 'typosquat',
          description: 'Domain has a duplicated character',
          pattern: 'character_duplication',
          position: i,
          confidence: 0.85
        };
      }
    }
    
    // Check for adjacent key substitution (common keyboard mistakes)
    const keyboardAdjacent = {
      'q': ['w', 'a'],
      'w': ['q', 'e', 's', 'a'],
      'e': ['w', 'r', 'd', 's'],
      'r': ['e', 't', 'f', 'd'],
      't': ['r', 'y', 'g', 'f'],
      'y': ['t', 'u', 'h', 'g'],
      'u': ['y', 'i', 'j', 'h'],
      'i': ['u', 'o', 'k', 'j'],
      'o': ['i', 'p', 'l', 'k'],
      'p': ['o', 'l'],
      'a': ['q', 'w', 's', 'z'],
      's': ['a', 'w', 'd', 'x', 'z'],
      'd': ['s', 'e', 'f', 'c', 'x'],
      'f': ['d', 'r', 'g', 'v', 'c'],
      'g': ['f', 't', 'h', 'b', 'v'],
      'h': ['g', 'y', 'j', 'n', 'b'],
      'j': ['h', 'u', 'k', 'm', 'n'],
      'k': ['j', 'i', 'l', 'm'],
      'l': ['k', 'o', 'p'],
      'z': ['a', 's', 'x'],
      'x': ['z', 's', 'd', 'c'],
      'c': ['x', 'd', 'f', 'v'],
      'v': ['c', 'f', 'g', 'b'],
      'b': ['v', 'g', 'h', 'n'],
      'n': ['b', 'h', 'j', 'm'],
      'm': ['n', 'j', 'k']
    };
    
    for (let i = 0; i < protectedDomain.length; i++) {
      const char = protectedDomain.charAt(i);
      const adjacentKeys = keyboardAdjacent[char] || [];
      
      for (const adjacentKey of adjacentKeys) {
        const substituted = protectedDomain.substring(0, i) +
                           adjacentKey +
                           protectedDomain.substring(i + 1);
        
        if (substituted === testDomain) {
          return {
            technique: 'typosquat',
            description: 'Domain has keyboard-adjacent character substitution',
            pattern: 'adjacent_key_substitution',
            position: i,
            original: char,
            substituted: adjacentKey,
            confidence: 0.8
          };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Detect combosquatting (adding prefixes/suffixes)
   */
  detectCombosquat(testDomain, protectedDomain) {
    // Check if protected domain is contained in test domain
    if (testDomain.includes(protectedDomain) && testDomain !== protectedDomain) {
      const prefix = testDomain.substring(0, testDomain.indexOf(protectedDomain));
      const suffix = testDomain.substring(testDomain.indexOf(protectedDomain) + protectedDomain.length);
      
      // Common combosquatting prefixes and suffixes
      const commonCombos = [
        'secure', 'login', 'account', 'verify', 'support', 'help', 'my',
        'auth', 'sso', 'signin', 'app', 'portal', 'online', 'web',
        'mobile', 'service', 'official', 'verified', 'safe'
      ];
      
      const hasCommonCombo = commonCombos.some(combo => 
        prefix.includes(combo) || suffix.includes(combo)
      );
      
      if (hasCommonCombo) {
        return {
          technique: 'combosquat',
          description: 'Domain adds suspicious prefix/suffix to protected domain',
          pattern: 'common_combo',
          prefix: prefix,
          suffix: suffix,
          confidence: 0.9
        };
      }
      
      // Any prefix/suffix is suspicious but lower confidence
      if (prefix || suffix) {
        return {
          technique: 'combosquat',
          description: 'Domain adds prefix/suffix to protected domain',
          pattern: 'generic_combo',
          prefix: prefix,
          suffix: suffix,
          confidence: 0.7
        };
      }
    }
    
    // Check if test domain contains protected domain with separator
    const separators = ['-', '_', ''];
    for (const sep of separators) {
      if (testDomain.startsWith(protectedDomain + sep) || testDomain.endsWith(sep + protectedDomain)) {
        return {
          technique: 'combosquat',
          description: `Domain adds text with separator '${sep || '(none)'}' to protected domain`,
          pattern: 'separator_combo',
          separator: sep,
          confidence: 0.75
        };
      }
    }
    
    return null;
  }
  
  /**
   * Calculate overall severity based on detections
   */
  calculateSeverity(detections) {
    const maxConfidence = Math.max(...detections.map(d => d.confidence));
    
    if (maxConfidence >= 0.9) return 'critical';
    if (maxConfidence >= 0.8) return 'high';
    if (maxConfidence >= 0.6) return 'medium';
    return 'low';
  }
  
  /**
   * Calculate overall confidence based on detections
   */
  calculateConfidence(detections) {
    if (detections.length === 0) return 0;
    
    // If multiple techniques detected, increase confidence
    const avgConfidence = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;
    const multiTechniqueBonus = detections.length > 1 ? 0.1 : 0;
    
    return Math.min(0.99, avgConfidence + multiTechniqueBonus);
  }
}

export default DomainSquattingDetector;
