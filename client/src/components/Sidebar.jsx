import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import mainlogo from '../images/mainlogo.png';
import { useReportFromAnywhere } from '../context/ReportContext';
import Icon from './ui/Icon';
import cx from './ui/cx';
import useFocusTrap from './ui/useFocusTrap';
import { NAV_GROUPS, PAGES } from '../lib/pages';

const ADMIN_ROLES = ['admin', 'superadmin'];

const studentGroups = (role) => {
  const groups = NAV_GROUPS.map((g) => ({ label: g.label, items: g.items.map((key) => ({ name: PAGES[key].name, icon: PAGES[key].icon, route: PAGES[key].path })) }));
  if (ADMIN_ROLES.includes(role)) groups[groups.length - 1].items.push({ name: 'Admin console', icon: 'shield', route: '/admin' });
  return groups;
};

/** True below the `lg` breakpoint, where the sidebar is a drawer. */
const isSmall = () => typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(min-width: 1024px)').matches;

/**
 * The left navigation of every signed-in page. From `lg` up it is fixed on
 * the left; below that it is a drawer opened from the top bar.
 *
 * The admin console uses the same sidebar with its own sections:
 *   items       [{ name, icon, route, badge? }] instead of the student menu
 *               (icon: an Icon name, or an element)
 *   footer      replaces the student footer
 *   subtitle    a small label under the logo (e.g. "Admin console")
 *   matchPrefix an item is active on its sub-pages too (/admin/risk/...)
 *   drawerOpen / onDrawerClose   the drawer's state, owned by the shell
 */
const Sidebar = ({ items, footer, subtitle, matchPrefix = false, drawerOpen = false, onDrawerClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const openReport = useReportFromAnywhere();
  const panel = useRef(null);

  const groups = items ? [{ label: null, items }] : studentGroups(user?.role);
  const first = groups[0]?.items[0]?.route;

  // A drawer on small screens: focus stays inside it and Escape closes it.
  const trapped = drawerOpen && isSmall();
  useFocusTrap(panel, trapped, onDrawerClose);

  // Closing on navigation: a route change from inside the drawer.
  const path = location.pathname;
  const lastPath = useRef(path);
  useEffect(() => {
    if (lastPath.current !== path && drawerOpen) onDrawerClose?.();
    lastPath.current = path;
  }, [path, drawerOpen, onDrawerClose]);

  const isActive = (route) => {
    if (route === '/admin' && !items) return false;
    if (matchPrefix && route !== first) return path === route || path.startsWith(`${route}/`);
    return path === route || (!matchPrefix && route !== '/home' && path.startsWith(`${route}/`));
  };

  const go = (route) => {
    navigate(route);
    onDrawerClose?.();
  };

  const navItem = (item) => {
    const active = isActive(item.route);
    return (
      <li key={item.route}>
        <button
          type="button"
          aria-current={active ? 'page' : undefined}
          onClick={() => go(item.route)}
          className={cx(
            'group flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-body transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
            active ? 'bg-accent-soft/70 font-medium text-accent-fg' : 'text-fg-muted hover:bg-raised hover:text-fg',
          )}
        >
          {typeof item.icon === 'string'
            ? <Icon name={item.icon} className={cx('h-5 w-5', active ? 'text-accent-fg' : 'text-fg-subtle group-hover:text-fg-muted')} />
            : <span className={active ? 'text-accent-fg' : 'text-fg-subtle'}>{item.icon}</span>}
          <span className="min-w-0 flex-1 truncate">{item.name}</span>
          {item.badge ? <span className="tabular rounded-full bg-accent px-1.5 text-caption font-medium text-on-accent">{item.badge}</span> : null}
        </button>
      </li>
    );
  };

  return (
    <>
      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/30 animate-fade-in dark:bg-black/60 lg:hidden" onClick={onDrawerClose} aria-hidden="true" />}
      <aside
        ref={panel}
        aria-label="Main navigation"
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-sidebar max-w-[85vw] flex-col border-r border-line-subtle bg-sunken transition-transform duration-200 ease-out lg:z-30 lg:translate-x-0',
          drawerOpen ? 'translate-x-0 shadow-modal lg:shadow-none' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 px-5">
          <img src={mainlogo} alt="" className="h-8 w-8 rounded-md dark:invert" />
          <span className="min-w-0 leading-none">
            <span className="block font-display text-title font-bold tracking-tight text-fg">NOVARD-AI</span>
            {subtitle && <span className="mt-1 block text-caption text-fg-subtle">{subtitle}</span>}
          </span>
          {drawerOpen && (
            <button type="button" onClick={onDrawerClose} className="ml-auto rounded-md p-1.5 text-fg-subtle hover:bg-raised hover:text-fg lg:hidden" aria-label="Close the menu">
              <Icon name="x" className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-4 pb-4 pt-3" aria-label="Pages">
          {groups.map((group, i) => (
            <div key={group.label || i} className={i > 0 ? 'mt-6' : ''}>
              {group.label && <p className="mb-1.5 px-3 text-caption font-medium text-fg-subtle">{group.label}</p>}
              <ul className="space-y-1">{group.items.map(navItem)}</ul>
            </div>
          ))}
        </nav>

        {footer}

        {!items && user && (
          <div className="border-t border-line-subtle px-4 py-3">
            <button
              type="button"
              onClick={() => { onDrawerClose?.(); openReport(); }}
              className="flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-body text-fg-muted transition-colors hover:bg-raised/60 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              <Icon name="flag" className="h-5 w-5 text-fg-subtle" />
              Report a problem
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
