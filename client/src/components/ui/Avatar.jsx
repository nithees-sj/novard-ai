import React, { useState } from 'react';
import cx from './cx';

const SIZES = { xs: 'h-5 w-5 text-micro', sm: 'h-7 w-7 text-micro', md: 'h-8 w-8 text-caption', lg: 'h-10 w-10 text-small', xl: 'h-16 w-16 text-title' };

const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

/** A person: their photo, or their initials on a neutral disc when there is none (or it fails to load). */
export default function Avatar({ src, name, size = 'md', className }) {
  const [broken, setBroken] = useState(false);
  const base = cx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium', SIZES[size], className);
  if (src && !broken) {
    return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={cx(base, 'bg-sunken object-cover ring-1 ring-line-subtle')} />;
  }
  return <span className={cx(base, 'bg-sunken text-fg-muted ring-1 ring-inset ring-line')} aria-hidden="true">{initials(name)}</span>;
}
