import React from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { ThemeOptions } from '../components/ThemeToggle';
import { PageHeader } from '../components/ui/Headers';
import { buttonClass } from '../components/ui/Button';

/** One setting: what it is on the left, its control on the right. */
const Row = ({ id, title, description, children }) => (
  <section aria-labelledby={id} className="grid gap-4 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-10">
    <div>
      <h2 id={id} className="text-body font-semibold text-fg">{title}</h2>
      <p className="mt-1 max-w-sm text-small text-fg-muted">{description}</p>
    </div>
    <div className="flex items-start md:justify-end">{children}</div>
  </section>
);

const Settings = () => (
  <AppShell page="settings">
    <PageHeader title="Settings" description="How Novard-AI looks, and where your account details live." />
    <div className="divide-y divide-line-subtle border-y border-line-subtle">
      <Row id="appearance-title" title="Appearance" description="Light, dark, or follow your device. Saved to your account, so it follows you to other devices.">
        <ThemeOptions />
      </Row>
      <Row id="account-title" title="Account" description="Your name, mobile number and bio. Your email comes from your Google sign-in.">
        <Link to="/profile" className={buttonClass({ variant: 'soft' })}>Edit on your profile</Link>
      </Row>
      <Row id="reports-title" title="Problem reports" description="Problems you have reported and the Novard team's replies.">
        <Link to="/reports" className={buttonClass({ variant: 'soft' })}>Open my reports</Link>
      </Row>
    </div>
  </AppShell>
);

export default Settings;
