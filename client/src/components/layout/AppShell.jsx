import React, { useCallback, useEffect, useState } from 'react';
import { Navigationinner } from '../navigationinner';
import Sidebar from '../Sidebar';
import ChatbotButton from '../ChatbotButton';
import cx from '../ui/cx';
import { PAGES, TOOLS, documentTitle } from '../../lib/pages';

/**
 * The frame of every signed-in student page: sidebar, top bar with the
 * breadcrumb, the content column and the Novard Agent launcher.
 *
 *   page   a key of lib/pages PAGES ('career', 'forum', ...): the breadcrumb and tab title
 *   tool   { key, onBack } when a tool inside the page is open (TOOLS key); its
 *          parent crumb then goes back to the page
 *   crumbs replaces the derived breadcrumb
 *   width  'default'  one reading column (max-w-6xl) — most pages
 *          'full'     fills the screen height and width — workspaces, chat, the forum thread
 *
 * From `sm` up, a 4.5rem strip on the right is kept free of content for the
 * launcher, so it never covers a button or a field.
 */
export default function AppShell({ page, tool, crumbs, width = 'default', title, agent = true, children, className }) {
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);

  const meta = PAGES[page];
  const toolMeta = tool && TOOLS[tool.key];
  const trail = crumbs || [
    ...(page === 'home' || !meta ? [] : [{ label: PAGES.home.name, to: PAGES.home.path }]),
    ...(meta ? [toolMeta ? { label: meta.name, ...(tool.onBack ? { onClick: tool.onBack } : { to: meta.path }) } : { label: meta.name }] : []),
    ...(toolMeta ? [{ label: toolMeta.name }] : []),
  ];

  const tabTitle = title || [toolMeta?.name, meta?.name].filter(Boolean).join(' · ');
  useEffect(() => {
    document.title = documentTitle(tabTitle);
  }, [tabTitle]);

  const full = width === 'full';

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded focus:bg-raised focus:px-3 focus:py-2 focus:text-body focus:text-fg focus:shadow-popover">
        Skip to content
      </a>
      <Navigationinner crumbs={trail} onMenu={() => setDrawer(true)} agent={agent} />
      <Sidebar drawerOpen={drawer} onDrawerClose={closeDrawer} />
      <main id="main" tabIndex={-1} className={cx('pt-14 focus:outline-none lg:pl-60', agent && 'sm:pr-[4.5rem]')}>
        <div
          className={cx(
            full
              ? 'flex min-h-[calc(100dvh-3.5rem)] flex-col px-4 py-4 sm:px-6 md:h-[calc(100dvh-3.5rem)] md:min-h-0 lg:px-8 lg:py-5'
              : 'mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 md:pt-8 lg:px-8',
            agent && 'sm:pr-0 lg:pr-0',
            className,
          )}
        >
          {children}
        </div>
      </main>
      {agent && <ChatbotButton />}
    </div>
  );
}
