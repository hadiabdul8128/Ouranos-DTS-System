/**
 * Passphrase-encrypted backup so a closed tab or lost phone doesn't mean lost receipts.
 * AES-256-GCM with a PBKDF2-SHA-256 key; the passphrase never leaves the device and is not stored.
 */
const iterations = 600000;
const encoder = new TextEncoder();
const toBase64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = text => Uint8Array.from(atob(text), char => char.charCodeAt(0));

async function deriveKey(passphrase, salt, rounds) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function chunkedBase64(bytes) {
  let out = '';
  for (let index = 0; index < bytes.length; index += 0x8000) out += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(out);
}

export async function encryptBackup(data, passphrase) {
  if (String(passphrase || '').length < 10) throw new Error('Use a passphrase of at least 10 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data))));
  return JSON.stringify({
    format: 'ouranos-voucher-backup', version: 1, createdAt: new Date().toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv) }, data: chunkedBase64(ciphertext)
  });
}

export async function decryptBackup(text, passphrase) {
  let envelope;
  try { envelope = JSON.parse(text); } catch { throw new Error('This is not an Ouranos backup file.'); }
  if (envelope?.format !== 'ouranos-voucher-backup' || envelope.version !== 1) throw new Error('This is not an Ouranos backup file.');
  const key = await deriveKey(passphrase, fromBase64(envelope.kdf.salt), envelope.kdf.iterations);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv) }, key, fromBase64(envelope.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { throw new Error('Wrong passphrase, or the backup file is damaged.'); }
}
