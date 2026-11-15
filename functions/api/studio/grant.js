
// Short-lived, tamper-evident download grants.
// Keep Stripe credentials server-side.

const encoder = new TextEncoder();

const b64 = bytes =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const unb64 = s =>
  Uint8Array.from(
    atob(
      s.replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - s.length % 4) % 4)
    ),
    c => c.charCodeAt(0)
  );

// FIXED: Correct Web Crypto importKey arguments.
async function key(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode('big-solis-download-v1:' + secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function makeGrant(secret, id, session) {
  const payload = b64(
    encoder.encode(
      JSON.stringify({
        id,
        session,
        exp: Math.floor(Date.now() / 1000) + 900
      })
    )
  );

  const sig = b64(
    new Uint8Array(
      await crypto.subtle.sign(
        'HMAC',
        await key(secret),
        encoder.encode(payload)
      )
    )
  );

  return payload + '.' + sig;
}

export async function verifyGrant(secret, token, id) {
  try {
    if (typeof token !== 'string' || token.length > 2000) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payload, sig] = parts;

    const valid = await crypto.subtle.verify(
      'HMAC',
      await key(secret),
      unb64(sig),
      encoder.encode(payload)
    );

    if (!valid) return null;

    const data = JSON.parse(
      new TextDecoder().decode(unb64(payload))
    );

    const now = Math.floor(Date.now() / 1000);

    if (
      data.id !== id ||
      !Number.isSafeInteger(data.exp) ||
      data.exp < now ||
      data.exp > now + 900 ||
      !/^cs_(test_|live_)[A-Za-z0-9]+$/.test(data.session)
    ) {
      return null;
    }

    return data;

  } catch {
    return null;
  }
}
