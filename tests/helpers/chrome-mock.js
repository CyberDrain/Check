export class ChromeMock {
  constructor() {
    this.storage = {
      local: new LocalStorageMock(),
      managed: new ManagedStorageMock(),
      session: new SessionStorageMock()
    };
    this.runtime = new RuntimeMock();
  }

  reset() {
    this.storage.local.clear();
    this.storage.managed.clear();
    this.storage.session.clear();
    this.runtime.reset();
  }
}

// Real chrome.storage areas accept an optional callback as well as returning a
// promise. browser-polyfill.js uses the callback form, so support both.
function settle(promise, callback) {
  if (typeof callback === 'function') {
    promise.then((result) => callback(result));
  }
  return promise;
}

class LocalStorageMock {
  constructor() {
    this.data = {};
  }

  get(keys, callback) {
    return settle(this._get(keys), callback);
  }

  set(items, callback) {
    return settle(this._set(items), callback);
  }

  remove(keys, callback) {
    return settle(this._remove(keys), callback);
  }

  clear(callback) {
    this.data = {};
    return settle(Promise.resolve(), callback);
  }

  _get(keys) {
    return new Promise((resolve) => {
      if (typeof keys === 'string') {
        resolve({ [keys]: this.data[keys] });
      } else if (Array.isArray(keys)) {
        const result = {};
        keys.forEach(key => {
          if (key in this.data) {
            result[key] = this.data[key];
          }
        });
        resolve(result);
      } else if (keys === null || keys === undefined) {
        resolve({ ...this.data });
      } else {
        resolve({});
      }
    });
  }

  _set(items) {
    return new Promise((resolve) => {
      Object.assign(this.data, items);
      resolve();
    });
  }

  _remove(keys) {
    return new Promise((resolve) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach(key => delete this.data[key]);
      resolve();
    });
  }

  getData() {
    return { ...this.data };
  }
}

class ManagedStorageMock {
  constructor() {
    this.data = {};
  }

  get(keys, callback) {
    return settle(this._get(keys), callback);
  }

  _get(keys) {
    return new Promise((resolve) => {
      if (keys === null || keys === undefined) {
        resolve({ ...this.data });
      } else if (typeof keys === 'string') {
        resolve({ [keys]: this.data[keys] });
      } else if (Array.isArray(keys)) {
        const result = {};
        keys.forEach(key => {
          if (key in this.data) {
            result[key] = this.data[key];
          }
        });
        resolve(result);
      } else {
        resolve({});
      }
    });
  }

  set(items) {
    Object.assign(this.data, items);
  }

  clear() {
    this.data = {};
  }
}

class SessionStorageMock {
  constructor() {
    this.data = {};
  }

  get(keys, callback) {
    return settle(this._get(keys), callback);
  }

  set(items, callback) {
    return settle(this._set(items), callback);
  }

  _get(keys) {
    return new Promise((resolve) => {
      if (typeof keys === 'string') {
        resolve({ [keys]: this.data[keys] });
      } else if (Array.isArray(keys)) {
        const result = {};
        keys.forEach(key => {
          if (key in this.data) {
            result[key] = this.data[key];
          }
        });
        resolve(result);
      } else {
        resolve({});
      }
    });
  }

  _set(items) {
    return new Promise((resolve) => {
      Object.assign(this.data, items);
      resolve();
    });
  }

  clear() {
    this.data = {};
  }
}

class RuntimeMock {
  constructor() {
    this.manifest = {
      version: '1.0.5',
      name: 'Check'
    };
    this.id = 'test-extension-id';
    this.lastError = null;
    this.messageListeners = [];
    this.sentMessages = [];
  }

  getManifest() {
    return this.manifest;
  }

  getURL(path) {
    return `chrome-extension://${this.id}/${path}`;
  }

  sendMessage(message, callback) {
    this.sentMessages.push(message);
    const response = Promise.resolve({ success: true });
    if (callback) {
      response.then((result) => setTimeout(() => callback(result), 0));
    }
    return response;
  }

  onMessage = {
    addListener: (listener) => {
      this.messageListeners.push(listener);
    }
  };

  reset() {
    this.lastError = null;
    this.messageListeners = [];
    this.sentMessages = [];
  }
}

export function setupGlobalChrome() {
  const chromeMock = new ChromeMock();
  global.chrome = chromeMock;
  return chromeMock;
}

export function teardownGlobalChrome() {
  delete global.chrome;
}
