
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function authorized(request, env) {
  const expected = env.ADMIN_TOKEN;
  const supplied = request.headers.get("Authorization") || "";

  if (!expected || !supplied.startsWith("Bearer ")) {
    return false;
  }

  const a = new TextEncoder().encode(supplied.slice(7));
  const b = new TextEncoder().encode(expected);

  if (a.length !== b.length) return false;

  let diff = 0;

  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}

function detectImageType(bytes) {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export async function onRequestPost({ request, env }) {
  if (!authorized(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!env.MUSIC_BUCKET) {
    return json({ error: "R2 storage unavailable" }, 503);
  }

  try {
    const contentType = request.headers.get("Content-Type") || "";

    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return json({ error: "Expected multipart form upload" }, 400);
    }

    const contentLength = Number(
      request.headers.get("Content-Length") || 0
    );

    if (contentLength > MAX_BYTES + 1024 * 1024) {
      return json({ error: "Image is too large. Maximum 10 MB." }, 413);
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return json({ error: "Select an image to upload" }, 400);
    }

    if (file.size === 0 || file.size > MAX_BYTES) {
      return json({ error: "Image must be between 1 byte and 10 MB" }, 413);
    }

    if (!ALLOWED_TYPES[file.type]) {
      return json({ error: "Use JPG, PNG, or WebP" }, 400);
    }

    const buffer = await file.arrayBuffer();
    const actualType = detectImageType(new Uint8Array(buffer));

    if (!actualType || actualType !== file.type) {
      return json({ error: "Invalid image format" }, 400);
    }

    const extension = ALLOWED_TYPES[actualType];
    const key = `covers/${crypto.randomUUID()}.${extension}`;

    await env.MUSIC_BUCKET.put(key, buffer, {
      httpMetadata: {
        contentType: actualType
      }
    });

    return json({
      ok: true,
      cover_key: key,
      content_type: actualType,
      byte_size: file.size
    }, 201);

  } catch (error) {
    console.error("Album cover upload failed", error);

    return json({
      error: "Cover upload failed. Check Cloudflare logs."
    }, 500);
  }
}
