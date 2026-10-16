import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { setupGlobalChrome } from './helpers/chrome-mock.js';

// browser-polyfill.js binds to the global chrome object when it is first
// imported, so install one mock for the whole file before importing.
const chromeMock = setupGlobalChrome();
const { init: initLogger } = await import('../scripts/utils/logger.js');
const { DetectionRulesManager } = await import('../scripts/modules/detection-rules-manager.js');
initLogger({ enabled: false });

const HOUR = 60 * 60 * 1000;
const CACHE_KEY = 'detection_rules_cache';
const BUNDLED_URL = chromeMock.runtime.getURL('rules/detection-rules.json');

const makeRules = (version) => ({ version, trusted_login_patterns: [], phishing_indicators: [] });
const BUNDLED_RULES = makeRules('1.2.0');
const DOWNLOADED_RULES = makeRules('1.2.5');
const NEW_RULES = makeRules('1.3.0');

const jsonResponse = (body, status = 200) => ({
  ok: status === 200,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  json: async () => JSON.parse(JSON.stringify(body))
});

let remoteHandler;
let remoteCalls;

async function seedCache(ageMs) {
  await chromeMock.storage.local.set({
    [CACHE_KEY]: { rules: DOWNLOADED_RULES, lastUpdate: Date.now() - ageMs, source: 'remote' }
  });
}

const storedCache = () => chromeMock.storage.local.getData()[CACHE_KEY];

async function startManager() {
  const manager = new DetectionRulesManager({ getConfig: async () => ({}) });
  await manager.initialize();
  // Let the background refresh started by initialize() finish.
  await new Promise((resolve) => setImmediate(resolve));
  return manager;
}

beforeEach(() => {
  chromeMock.reset();
  remoteCalls = 0;
  remoteHandler = async () => jsonResponse(NEW_RULES);
  global.fetch = async (url) => {
    if (url === BUNDLED_URL) return jsonResponse(BUNDLED_RULES);
    remoteCalls++;
    return remoteHandler();
  };
});

afterEach(() => {
  delete global.fetch;
});

test('keeps an expired cache when the update fails', async (t) => {
  const failures = {
    'network error': async () => { throw new TypeError('Failed to fetch'); },
    'HTTP 429': async () => jsonResponse({ message: 'rate limited' }, 429),
    'non-JSON response': async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }),
    'JSON that is not a rules file': async () => jsonResponse({ message: 'Not Found' })
  };

  for (const [name, handler] of Object.entries(failures)) {
    await t.test(name, async () => {
      chromeMock.reset();
      remoteHandler = handler;
      await seedCache(48 * HOUR);
      const cachedBefore = storedCache();

      const manager = await startManager();

      assert.strictEqual(remoteCalls, 1);
      assert.strictEqual((await manager.getDetectionRules()).version, '1.2.5');
      assert.strictEqual(manager.getCacheInfo().usingFallback, false);
      assert.deepStrictEqual(storedCache(), cachedBefore, 'cache must not be overwritten');
    });
  }
});

test('keeps downloaded rules when a refresh fails while running', async () => {
  const manager = await startManager();
  assert.strictEqual(manager.cachedRules.version, '1.3.0');

  manager.lastUpdate = Date.now() - 25 * HOUR;
  remoteHandler = async () => jsonResponse({}, 503);
  await manager.getDetectionRules();
  await manager._refreshInFlight;

  assert.strictEqual((await manager.getDetectionRules()).version, '1.3.0');
  assert.strictEqual(manager.getCacheInfo().usingFallback, false);
});

test('uses bundled rules only when nothing has been downloaded', async () => {
  remoteHandler = async () => { throw new TypeError('Failed to fetch'); };
  const manager = await startManager();

  assert.strictEqual((await manager.getDetectionRules()).version, '1.2.0');
  assert.strictEqual(manager.getCacheInfo().usingFallback, true);
  assert.strictEqual(storedCache(), undefined, 'bundled rules must not be persisted');
});

test('replaces expired rules when the update succeeds', async () => {
  await seedCache(48 * HOUR);
  const manager = await startManager();

  assert.strictEqual(manager.cachedRules.version, '1.3.0');
  assert.strictEqual(storedCache().rules.version, '1.3.0');
});

test('does not refetch a fresh cache', async () => {
  await seedCache(HOUR);
  const manager = await startManager();

  assert.strictEqual((await manager.getDetectionRules()).version, '1.2.5');
  assert.strictEqual(remoteCalls, 0);
});

test('does not retry a failed fetch on every request', async () => {
  remoteHandler = async () => jsonResponse({}, 429);
  await seedCache(48 * HOUR);
  const manager = await startManager();

  for (let i = 0; i < 5; i++) {
    await manager.getDetectionRules();
    await manager._refreshInFlight;
  }
  assert.strictEqual(remoteCalls, 1);

  // Retries once the retry delay has passed.
  manager._lastFailedFetchAt = Date.now() - 10 * 60 * 1000;
  await manager.getDetectionRules();
  await manager._refreshInFlight;
  assert.strictEqual(remoteCalls, 2);
});

test('forceUpdate reports a failed download and keeps the previous rules', async () => {
  remoteHandler = async () => jsonResponse({}, 503);
  await seedCache(48 * HOUR);
  const manager = await startManager();

  await assert.rejects(manager.forceUpdate(), /Still using the previously downloaded rules/);
  assert.strictEqual(manager.cachedRules.version, '1.2.5');

  remoteHandler = async () => jsonResponse(NEW_RULES);
  assert.strictEqual((await manager.forceUpdate()).version, '1.3.0');
});
