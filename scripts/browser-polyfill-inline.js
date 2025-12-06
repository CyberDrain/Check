/**
 * Browser API Polyfill (Non-Module Version)
 * For use in content scripts, popup, and options pages
 * 
 * This provides Firefox compatibility by wrapping chrome.* APIs
 * and handling chrome.storage.session fallback for Firefox.
 */

(function() {
  'use strict';
  
  // Detect browser environment
  const isFirefox = typeof browser !== 'undefined' && browser.runtime;
  const isChrome = typeof chrome !== 'undefined' && chrome.runtime;
  
  // Use browser namespace if available (Firefox), otherwise chrome namespace
  const browserAPI = isFirefox ? browser : (isChrome ? chrome : {});
  
  // Session storage fallback using local storage with prefix
  const sessionPrefix = '__session__';
  const sessionKeys = new Set();
  
  // Set up session storage polyfill for browsers that don't support it natively
  // Only Firefox needs this polyfill; Chrome 88+ always supports chrome.storage.session
  const needsSessionPolyfill = isFirefox;
  
  // Ensure chrome API exists for Firefox - do this first before session polyfill
  if (isFirefox && !window.chrome) {
    window.chrome = {
      storage: {
        local: browser.storage.local,
        managed: browser.storage.managed
      },
      runtime: browser.runtime,
      tabs: browser.tabs,
      action: browser.action,
      scripting: browser.scripting,
      webRequest: browser.webRequest,
      alarms: browser.alarms,
      identity: browser.identity
    };
  }
  
  if (needsSessionPolyfill) {
    // Create session storage polyfill using local storage
    // Use the appropriate storage API based on browser
    const getStorage = (keys, callback) => {
      if (isFirefox) {
        // Firefox uses promises
        browser.storage.local.get(keys).then(callback).catch((err) => {
          console.error('Firefox storage.local.get error:', err);
          callback({});
        });
      } else {
        // Chrome uses callbacks
        chrome.storage.local.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            callback({});
          } else {
            callback(result);
          }
        });
      }
    };
    
    const setStorage = (items, callback) => {
      if (isFirefox) {
        browser.storage.local.set(items).then(() => callback && callback()).catch((err) => {
          console.error('Firefox storage.local.set error:', err);
          callback && callback();
        });
      } else {
        chrome.storage.local.set(items, callback);
      }
    };
    
    const removeStorage = (keys, callback) => {
      if (isFirefox) {
        browser.storage.local.remove(keys).then(() => callback && callback()).catch((err) => {
          console.error('Firefox storage.local.remove error:', err);
          callback && callback();
        });
      } else {
        chrome.storage.local.remove(keys, callback);
      }
    };
    
    chrome.storage.session = {
      get: function(keys, callback) {
        const prefixedKeys = Array.isArray(keys)
          ? keys.map(k => sessionPrefix + k)
          : (typeof keys === 'string' ? sessionPrefix + keys : null);
        
        getStorage(prefixedKeys, function(result) {
          const unprefixed = {};
          if (Array.isArray(prefixedKeys)) {
            for (const prefixedKey of prefixedKeys) {
              const originalKey = prefixedKey.replace(sessionPrefix, '');
              if (prefixedKey in result) {
                unprefixed[originalKey] = result[prefixedKey];
              }
            }
          } else if (prefixedKeys) {
            const originalKey = prefixedKeys.replace(sessionPrefix, '');
            if (prefixedKeys in result) {
              unprefixed[originalKey] = result[prefixedKeys];
            }
          } else {
            // Get all session keys
            for (const [key, value] of Object.entries(result)) {
              if (key.startsWith(sessionPrefix)) {
                unprefixed[key.replace(sessionPrefix, '')] = value;
              }
            }
          }
          
          callback && callback(unprefixed);
        });
      },
      
      set: function(items, callback) {
        const prefixed = {};
        for (const [key, value] of Object.entries(items)) {
          const prefixedKey = sessionPrefix + key;
          prefixed[prefixedKey] = value;
          sessionKeys.add(prefixedKey);
        }
        
        setStorage(prefixed, callback);
      },
      
      remove: function(keys, callback) {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        const prefixedKeys = keysArray.map(k => sessionPrefix + k);
        
        prefixedKeys.forEach(k => sessionKeys.delete(k));
        
        removeStorage(prefixedKeys, callback);
      }
    };
  }
  
  // Expose helper flags
  window.__browserPolyfill = {
    isFirefox: isFirefox,
    isChrome: isChrome,
    browserAPI: browserAPI
  };
})();
