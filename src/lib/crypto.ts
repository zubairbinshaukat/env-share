export interface EncryptedPayload {
  ciphertext: string
  iv: string
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value))
}

function decodeJson<T>(bytes: Uint8Array): T {
  const text = new TextDecoder().decode(bytes)
  return JSON.parse(text) as T
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  )
}

export async function exportKeyB64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key)
  return bytesToBase64(new Uint8Array(raw))
}

export async function importKeyB64(base64Key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    asArrayBuffer(base64ToBytes(base64Key)),
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"],
  )
}

export async function encryptJSON(
  key: CryptoKey,
  value: unknown,
): Promise<EncryptedPayload> {
  const ivBytes = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(ivBytes) },
    key,
    asArrayBuffer(encodeJson(value)),
  )
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(ivBytes),
  }
}

export async function decryptJSON<T>(
  key: CryptoKey,
  payload: EncryptedPayload,
): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asArrayBuffer(base64ToBytes(payload.iv)) },
    key,
    asArrayBuffer(base64ToBytes(payload.ciphertext)),
  )
  return decodeJson<T>(new Uint8Array(plain))
}
