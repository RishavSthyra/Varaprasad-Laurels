"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCachedSignedAssetUrl,
  getCachedSignedAssetUrls,
  getSignedAssetUrl,
  getSignedAssetUrls,
} from "@/src/lib/signed-assets";

export function useSignedAssetUrl(input?: string | null) {
  const [signedAsset, setSignedAsset] = useState<{
    input: string;
    url: string;
  } | null>(() => {
    if (!input) {
      return null;
    }

    const cachedUrl = getCachedSignedAssetUrl(input);
    return cachedUrl ? { input, url: cachedUrl } : null;
  });

  useEffect(() => {
    let cancelled = false;

    if (!input) {
      return;
    }

    const cachedUrl = getCachedSignedAssetUrl(input);

    if (cachedUrl) {
      return;
    }

    void getSignedAssetUrl(input)
      .then((url) => {
        if (!cancelled) {
          setSignedAsset({ input, url });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignedAsset(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [input]);

  if (!input) {
    return null;
  }

  if (signedAsset?.input === input) {
    return signedAsset.url;
  }

  return getCachedSignedAssetUrl(input);
}

export function useSignedAssetUrls(inputs: string[]) {
  // Progress updates can pass a fresh array. Only changed contents should
  // cancel a request; React Strict Mode must also be able to re-subscribe.
  const inputsKey = JSON.stringify([...new Set(inputs.filter(Boolean))]);
  const normalizedInputs = useMemo(
    () => JSON.parse(inputsKey) as string[],
    [inputsKey],
  );
  const cachedSignedUrls = getCachedSignedAssetUrls(normalizedInputs);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>(
    cachedSignedUrls,
  );

  useEffect(() => {
    let cancelled = false;

    if (normalizedInputs.length === 0) {
      return;
    }

    void getSignedAssetUrls(normalizedInputs)
      .then((urls) => {
        if (!cancelled) {
          setSignedUrls(urls);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignedUrls({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedInputs]);

  const resolvedSignedUrls = useMemo(
    () => ({
      ...cachedSignedUrls,
      ...signedUrls,
    }),
    [cachedSignedUrls, signedUrls],
  );

  return Object.fromEntries(
    normalizedInputs
      .map((input) => [input, resolvedSignedUrls[input]] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
