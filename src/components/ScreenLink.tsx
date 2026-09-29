import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * True in the single-file "embed" build (a preview inside claude.ai). There the
 * app runs in a sandboxed frame: new tabs lose the app's data, so public screens
 * open in the same frame instead.
 */
export const EMBED = import.meta.env.VITE_EMBED === '1';

/** Full URL of an app path, for sharing (e.g. on WhatsApp). */
export function shareUrl(path: string): string {
  return location.origin + import.meta.env.BASE_URL.replace(/\/$/, '') + path;
}

/**
 * Link to a screen meant for another window — live projector, owner bidding,
 * registration form. Normally opens a new tab; in the embed build it navigates
 * in place.
 */
export function ScreenLink({ to, className, children, title, ...rest }: { to: string; className?: string; children: ReactNode; title?: string; 'aria-label'?: string }) {
  if (EMBED) {
    return (
      <Link to={to} className={className} title={title} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={import.meta.env.BASE_URL.replace(/\/$/, '') + to} target="_blank" rel="noreferrer" className={className} title={title} {...rest}>
      {children}
    </a>
  );
}
