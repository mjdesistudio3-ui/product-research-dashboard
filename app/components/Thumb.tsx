/**
 * Product thumbnail with a neutral placeholder when no image URL exists.
 * Uses a plain <img> (not next/image) so external marketplace images
 * don't need remotePatterns config.
 */
export default function Thumb({
  src,
  alt,
  size = 96,
  className = '',
}: {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (!src) {
    return (
      <div
        style={style}
        className={`flex shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-medium uppercase tracking-wide text-slate-300 ${className}`}
        aria-label="No image"
      >
        No image
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      style={style}
      className={`shrink-0 rounded-md object-cover ${className}`}
    />
  );
}
