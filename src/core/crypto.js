const DEFAULT_ITERATIONS = 250000;

export function isCryptoAvailable() {
  return Boolean(
    typeof globalThis.crypto !== 'undefined' &&
    globalThis.crypto.subtle &&
    typeof globalThis.crypto.getRandomValues === 'function'
  );
}

export function isEncryptedEnvelope(obj) {
  return Boolean(
    obj &&
    typeof obj === 'object' &&
    obj.encrypted === true &&
    obj.alg === 'AES-GCM-256' &&
    typeof obj.ciphertext === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.salt === 'string'
  );
}

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    bin += String.fromCharCode.apply(null, slice);
  }
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function sanitizeMeta(meta = {}) {
  return {
    wikiId: String(meta.wikiId || ''),
    updatedAt: String(meta.updatedAt || ''),
    lang: meta.lang === 'en' ? 'en' : 'tr',
    palette: String(meta.palette || 'paper')
  };
}

export async function deriveKey(password, saltB64, iterations = DEFAULT_ITERATIONS) {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available in this context.');
  }
  const enc = new TextEncoder();
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(String(password)),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const saltBytes = base64ToBytes(saltB64);
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptWithDerivedKey(plainObj, key, saltB64, meta = {}, iterations = DEFAULT_ITERATIONS) {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available in this context.');
  }
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(plainObj));
  const encryptedBuf = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );
  return {
    v: 1,
    encrypted: true,
    alg: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: saltB64,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuf)),
    meta: sanitizeMeta(meta)
  };
}

export async function encryptStorePayload(plainObj, password, meta = {}) {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available in this context.');
  }
  const saltBytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToBase64(saltBytes);
  const key = await deriveKey(password, salt, DEFAULT_ITERATIONS);
  const envelope = await encryptWithDerivedKey(plainObj, key, salt, meta, DEFAULT_ITERATIONS);
  return { envelope, key, salt };
}

export async function decryptStoreEnvelope(envelope, password) {
  if (!isCryptoAvailable()) {
    throw new Error('Web Crypto API is not available in this context.');
  }
  if (!isEncryptedEnvelope(envelope)) {
    throw new Error('Invalid encrypted envelope.');
  }
  const iterations = Number(envelope.iterations) || DEFAULT_ITERATIONS;
  const key = await deriveKey(password, envelope.salt, iterations);
  const ivBytes = base64ToBytes(envelope.iv);
  const cipherBytes = base64ToBytes(envelope.ciphertext);
  let decryptedBuf;
  try {
    decryptedBuf = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      cipherBytes
    );
  } catch {
    const err = new Error('Invalid password or corrupted data.');
    err.code = 'INVALID_PASSWORD';
    throw err;
  }
  const dec = new TextDecoder();
  const payload = JSON.parse(dec.decode(decryptedBuf));
  return { payload, key, salt: envelope.salt };
}
