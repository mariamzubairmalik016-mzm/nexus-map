import { useState } from "react";

import { FALLBACK_IMAGE } from "../../services/destinationImage";

/**
 * Lazy destination image with a shimmer skeleton, blur-to-sharp fade-in, and a
 * graceful fallback. `className` sizes the frame; `imgClassName` adds effects
 * such as hover zoom.
 */
const DestinationImage = ({
  src,
  alt,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-slate-900/40 ${className ?? ""}`}>
      {!loaded && <span className="nexus-shimmer absolute inset-0 block bg-white/[0.04]" aria-hidden />}
      <img
        src={failed ? FALLBACK_IMAGE : src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!failed) setFailed(true);
          else setLoaded(true);
        }}
        className={`h-full w-full object-cover transition duration-700 ${imgClassName ?? ""} ${
          loaded ? "opacity-100 blur-0" : "opacity-0 blur-md"
        }`}
      />
    </div>
  );
};

export default DestinationImage;
