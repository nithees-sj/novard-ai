import React, { forwardRef } from 'react';
import cx from './cx';
import Icon from './Icon';
import Spinner from './Spinner';

/**
 * Buttons. Variants: primary (the one main action on a screen), soft (a
 * quieter blue action), secondary,
 * ghost (toolbars, quiet actions), danger (destructive), inverse (a dark
 * confirm button), link (inline text action).
 */
const BASE = 'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-[color,background-color,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50';

const VARIANTS = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-raised text-fg ring-1 ring-inset ring-line hover:bg-sunken hover:ring-line-strong',
  // A quieter blue action: next to content, when the page already has a primary button.
  soft: 'bg-accent-soft text-accent-fg ring-1 ring-inset ring-accent/15 hover:bg-accent/15 hover:ring-accent/30',
  ghost: 'text-fg-muted hover:bg-sunken hover:text-fg',
  danger: 'bg-raised text-danger-fg ring-1 ring-inset ring-line hover:bg-danger-soft hover:ring-danger/40',
  'danger-solid': 'bg-danger text-on-accent hover:brightness-95',
  inverse: 'bg-ink text-on-ink hover:bg-ink-hover',
  link: 'text-accent-fg underline-offset-4 hover:underline',
};

const SIZES = {
  xs: 'h-7 px-2 text-caption',
  sm: 'h-8 px-3 text-small',
  md: 'h-9 px-3.5 text-body',
  lg: 'h-10 px-4 text-body',
};
const ICON_SIZES = { xs: 'h-7 w-7', sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-10 w-10' };

export function buttonClass({ variant = 'primary', size = 'md', block = false, iconOnly = false, className } = {}) {
  return cx(BASE, VARIANTS[variant], variant === 'link' ? 'h-auto px-0' : iconOnly ? ICON_SIZES[size] : SIZES[size], block && 'w-full', className);
}

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', block = false, loading = false, loadingLabel, icon, iconRight, type = 'button', className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, block, className })}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon && <Icon name={icon} className="h-4 w-4" />}
      {loading && loadingLabel ? loadingLabel : children}
      {iconRight && !loading && <Icon name={iconRight} className="h-4 w-4" />}
    </button>
  );
});

/** A square button with only an icon. `label` is required: it is the accessible name and the tooltip. */
export const IconButton = forwardRef(function IconButton({ icon, label, variant = 'ghost', size = 'md', className, iconClassName = 'h-4 w-4', type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} aria-label={label} title={label} className={buttonClass({ variant, size, iconOnly: true, className: cx('px-0', className) })} {...rest}>
      <Icon name={icon} className={iconClassName} />
    </button>
  );
});

export default Button;
