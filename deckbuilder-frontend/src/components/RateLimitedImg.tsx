import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import {
  enqueueScryfallImageLoad,
  isScryfallCdnUrl,
  releaseScryfallImageSlot,
} from "../lib/scryfallImageQueue";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  src?: string;
};

/**
 * <img> that paces loads against Scryfall CDN hosts.
 * Non-Scryfall URLs load immediately.
 */
export function RateLimitedImg({ src, alt, onLoad, onError, ...rest }: Props) {
  const [activeSrc, setActiveSrc] = useState<string | undefined>(() =>
    src && !isScryfallCdnUrl(src) ? src : undefined
  );
  const held = useRef(false);

  useEffect(() => {
    held.current = false;
    if (!src) {
      setActiveSrc(undefined);
      return;
    }
    if (!isScryfallCdnUrl(src)) {
      setActiveSrc(src);
      return;
    }

    let cancelled = false;
    setActiveSrc(undefined);

    enqueueScryfallImageLoad(() => {
      if (cancelled) {
        releaseScryfallImageSlot();
        return;
      }
      held.current = true;
      setActiveSrc(src);
    });

    return () => {
      cancelled = true;
      if (held.current) {
        held.current = false;
        releaseScryfallImageSlot();
      }
    };
  }, [src]);

  return (
    <img
      {...rest}
      src={activeSrc}
      alt={alt}
      onLoad={(e) => {
        if (held.current) {
          held.current = false;
          releaseScryfallImageSlot();
        }
        onLoad?.(e);
      }}
      onError={(e) => {
        if (held.current) {
          held.current = false;
          releaseScryfallImageSlot();
        }
        onError?.(e);
      }}
    />
  );
}
