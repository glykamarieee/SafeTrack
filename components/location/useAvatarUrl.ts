import { useEffect, useState } from "react";

import { getProfileAvatarUrl } from "../../services/profileAvatarService";

// Signed URLs last an hour; reuse them for 50 minutes.
const TTL_MS = 50 * 60 * 1000;
const cache = new Map<string, { url: string | null; expires: number; pending?: Promise<string | null> }>();

async function signedUrl(path: string) {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.pending ?? hit.url;

  const pending = getProfileAvatarUrl(path).catch(() => null);
  cache.set(path, { url: null, expires: Date.now() + TTL_MS, pending });
  const url = await pending;
  // A failed signature is retried after a minute rather than 50.
  cache.set(path, { url, expires: Date.now() + (url ? TTL_MS : 60_000) });

  return url;
}

/**
 * A displayable photo URL for a profile avatar stored in `profile-avatars`.
 * `knownUrl` (already signed by the profile service) is used when present.
 */
export function useAvatarUrl(path?: string | null, knownUrl?: string | null) {
  const [url, setUrl] = useState<string | null>(knownUrl ?? null);

  useEffect(() => {
    if (knownUrl) {
      setUrl(knownUrl);
      return;
    }
    if (!path) {
      setUrl(null);
      return;
    }

    let active = true;
    void signedUrl(path).then((value) => {
      if (active) setUrl(value);
    });

    return () => {
      active = false;
    };
  }, [path, knownUrl]);

  return url;
}
