import { cn } from "@/lib/utils";

// Custom QR-inspired wordmark, drawn in a single colour so it adapts to the
// surface it sits on. No gradients, no photos.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("text-foreground", className)}
      aria-hidden
    >
      {/* Three QR finder patterns: a rounded ring with a solid centre. */}
      <rect x="2.5" y="2.5" width="7" height="7" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4.9" y="4.9" width="2.2" height="2.2" rx="0.7" fill="currentColor" />
      <rect x="14.5" y="2.5" width="7" height="7" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="16.9" y="4.9" width="2.2" height="2.2" rx="0.7" fill="currentColor" />
      <rect x="2.5" y="14.5" width="7" height="7" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <rect x="4.9" y="16.9" width="2.2" height="2.2" rx="0.7" fill="currentColor" />
      {/* Data modules in the remaining quadrant. */}
      <rect x="14.3" y="14.3" width="2.4" height="2.4" rx="0.7" fill="currentColor" />
      <rect x="19.1" y="14.3" width="2.4" height="2.4" rx="0.7" fill="currentColor" />
      <rect x="16.7" y="16.7" width="2.4" height="2.4" rx="0.7" fill="currentColor" />
      <rect x="14.3" y="19.1" width="2.4" height="2.4" rx="0.7" fill="currentColor" />
      <rect x="19.1" y="19.1" width="2.4" height="2.4" rx="0.7" fill="currentColor" />
    </svg>
  );
}

export function Logo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={cn("size-6", markClassName)} />
      <span className="text-lg font-semibold tracking-tight">Snaptie</span>
    </span>
  );
}
