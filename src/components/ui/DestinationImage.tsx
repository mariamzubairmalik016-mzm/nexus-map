import { useState } from "react";
import Image from "next/image";

import { FALLBACK_IMAGE } from "../../services/destinationImage";

/**
 * Lazy destination image with a shimmer skeleton, blur-to-sharp fade-in, and a
 * graceful fallback. `className` sizes the frame; `imgClassName` adds effects
 * such as hover zoom.
 *
 * Uses next/image (fill) so the framework serves optimized, responsive
 * AVIF/WebP with automatic lazy loading — while the wrapper keeps the custom
 * shimmer, blur-up and error fallback. Pass `sizes` when the frame's rendered
 * width differs from the default card grid, so the correct source is fetched.
 */
const DestinationImage = ({
  src,
  alt,
  className,
  imgClassName,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-slate-900/40 ${className ?? ""}`}>
      {!loaded && <span className="nexus-shimmer absolute inset-0 block bg-white/[0.04]" aria-hidden />}
      <Image
        src={failed ? FALLBACK_IMAGE : src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes ?? "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!failed) setFailed(true);
          else setLoaded(true);
        }}
        className={`object-cover transition duration-700 ${imgClassName ?? ""} ${
          loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
        }`}
      />
    </div>
  );
};

export default DestinationImage;
