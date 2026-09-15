import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import {
  enqueueScryfallImageLoad,
  isImageWarmed,
  isScryfallCdnUrl,
  markImageWarmed,
  releaseScryfallImageSlot,
} from "../lib/scryfallImageQueue";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  src?: string;
};

/**
 * <img> that paces loads against Scryfall CDN hosts and reuses warmed URLs.
 */
export function RateLimitedImg({ src, alt, onLoad, onError, ...rest }: Props) {
  const [activeSrc, setActiveSrc] = useState<string | undefined>(() => {
    if (!src) return undefined;
    if (!isScryfallCdnUrl(src) || isImageWarmed(src)) return src;
    return undefined;
  });
  const held = useRef(false);

  useEffect(() => {
    held.current = false;
    if (!src) {
      setActiveSrc(undefined);
      return;
    }
    if (!isScryfallCdnUrl(src) || isImageWarmed(src)) {
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
        if (src) markImageWarmed(src);
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
