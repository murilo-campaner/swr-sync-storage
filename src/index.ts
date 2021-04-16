import { cache } from 'swr';

const STORAGE_KEY_PREFIX = 'swr-';

let asyncStorage: any;
try {
  asyncStorage = require('@react-native-async-storage/async-storage');
} catch (error) {}

function getStorage(mode: 'local' | 'session' | 'asyncStorage') {
  switch (mode) {
    case 'local':
      return localStorage;
    case 'session':
      return sessionStorage;
    case 'asyncStorage': {
      if (asyncStorage === undefined) {
        throw new Error('AsyncStorage is not available. Check if "@react-native-async-storage/async-storage" is installed as a dependency in package.json')
      }
      return asyncStorage;
    }
    default: {
      throw new Error(
        `Invalid mode ${mode}, it must be either local or session.`
      );
    }
  }
}

// the value of SWR could be either undefined or an object
// if you had other values you will need to check them here
// and parse it correctly (e.g. use Number for number)
function baseParser(value: string): any {
  return value === 'undefined' ? undefined : JSON.parse(value);
}

function getAsyncStorageKeyPairs(storage: any): any {
  const keys = storage.getAllKeys();
  const swrKeys = keys.filter((key: string) => key.startsWith(STORAGE_KEY_PREFIX));
  const callback = new Promise(async (resolve, reject) => {
    try {
      storage.multiGet(swrKeys, resolve);
    } catch (error) {
      reject(error);
    }
  })

  return callback;
}

export async function syncWithStorage(
  mode: 'local' | 'session' | 'asyncStorage',
  parser = baseParser
) {
  
  const storage = getStorage(mode);
  const storageKeyPairs = mode === 'asyncStorage'
    ? await getAsyncStorageKeyPairs(storage)
    : Object.entries(storage);

  // Get all key from the storage
  for (let [key, data] of storageKeyPairs) {
    if (!key.startsWith(STORAGE_KEY_PREFIX)) continue;
    // update SWR cache with the value from the storage
    cache.set(
      key.slice(4),
      parser(data).swrValue,
      false // don't notify the cache change, no-one is listening yet anyway
    );
  }

  // Subscribe to SWR cache changes in the future
  return cache.subscribe(() => {
    // get all the keys in cache
    const keys = cache.keys();
    // save each key in SWR with the prefix swr-
    for (let key of keys) {
      storage.setItem(
        `swr-${key}`,
        JSON.stringify({ swrValue: cache.get(key) })
      );
    }
  });
}

export function syncWithLocalStorage(parser?: typeof baseParser) {
  return syncWithStorage('local', parser);
}

export function syncWithSessionStorage(parser?: typeof baseParser) {
  return syncWithStorage('session', parser);
}

export function syncWithAsyncStorage(parser?: typeof baseParser) {
  return syncWithStorage('asyncStorage', parser);
}
