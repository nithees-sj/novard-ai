import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import { useReportProblem } from "../context/ReportContext";
import { useTheme } from "../context/ThemeContext";
import Breadcrumbs from "./layout/Breadcrumbs";
import Icon from "./ui/Icon";
import Avatar from "./ui/Avatar";
import Menu, { MenuItem, MenuSeparator, MenuHeader } from "./ui/Menu";
import mainlogo from "../images/mainlogo.png";

const ADMIN_ROLES = ["admin", "superadmin"];

const iconButton = "inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition-colors duration-150 hover:bg-sunken hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * The header of every signed-in page: where you are (breadcrumbs) on the
 * left; the theme switch, notifications and the one account menu on the
 * right. The admin console reuses it with its own account (`account`,
 * `menuLinks`, `onSignOut`) and no bell.
 *
 *   crumbs   [{ label, to?, onClick? }]   (falls back to `title`)
 *   onMenu   opens the sidebar drawer (shown below lg)
 *   agent    show the Novard Agent button here on phones (where the floating one is hidden)
 */
export const Navigationinner = ({ crumbs, title, showBell = true, account, menuLinks, onSignOut, actions = null, onMenu, agent = false }) => {
  const auth = useAuth();
  const user = account || auth.user;
  const navigate = useNavigate();
  const openReport = useReportProblem();
  const { preference, setPreference } = useTheme();

  const links = menuLinks || [
    { label: "My reports", icon: "inbox", onClick: () => navigate("/reports") },
    { label: "Report a problem", icon: "flag", onClick: () => openReport({}) },
    ...(ADMIN_ROLES.includes(user?.role) ? [{ label: "Admin console", icon: "shield", onClick: () => navigate("/admin") }] : []),
  ];
  const trail = crumbs || (title ? [{ label: title }] : []);
  const name = user?.displayName || user?.name;
  const picture = user?.photoURL || user?.picture;

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line-subtle bg-canvas/90 backdrop-blur-md lg:left-60">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        {onMenu && (
          <button type="button" onClick={onMenu} className={`${iconButton} -ml-1 lg:hidden`} aria-label="Open the menu">
            <Icon name="menu" className="h-5 w-5" />
          </button>
        )}
        {onMenu && <img src={mainlogo} alt="" className="hidden h-6 w-6 rounded-md dark:invert min-[400px]:block lg:hidden" />}

        <Breadcrumbs crumbs={trail} className="flex-1" />

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {actions}
          {agent && (
            <button type="button" onClick={() => navigate("/chatbot")} className={`${iconButton} sm:hidden`} aria-label="Open Novard Agent">
              <Icon name="bot" className="h-5 w-5" />
            </button>
          )}
          <div className="hidden sm:block"><ThemeToggle /></div>
          {showBell && user && <NotificationBell />}

          {user && (
            <Menu
              label="Account"
              width="w-64"
              className="ml-1"
              trigger={(props) => (
                <button type="button" {...props} aria-label={`Account: ${name || "you"}`} className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  <Avatar src={picture} name={name} size="md" />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuHeader>
                    <div className="flex items-center gap-3">
                      <Avatar src={picture} name={name} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-body font-medium text-fg">{name}</p>
                        {user.email && <p className="truncate text-small text-fg-subtle">{user.email}</p>}
                      </div>
                    </div>
                  </MenuHeader>
                  <MenuSeparator />
                  {links.map((link) => (
                    <MenuItem key={link.label} icon={link.icon || "arrowRight"} onSelect={() => { close(false); link.onClick(); }}>{link.label}</MenuItem>
                  ))}
                  {/* The theme lives here on phones, where the header has no room for its own button. */}
                  <div className="sm:hidden">
                    <MenuSeparator />
                    <p className="px-2.5 pb-1 pt-1.5 text-caption text-fg-subtle">Theme</p>
                    {[["light", "Light", "sun"], ["dark", "Dark", "moon"], ["system", "System", "monitor"]].map(([value, label, icon]) => (
                      <MenuItem key={value} icon={icon} checked={preference === value} onSelect={() => setPreference(value)}>{label}</MenuItem>
                    ))}
                  </div>
                  <MenuSeparator />
                  <MenuItem icon="logout" onSelect={() => { close(false); (onSignOut || auth.signOut)(); }}>Sign out</MenuItem>
                </>
              )}
            </Menu>
          )}
        </div>
      </div>
    </header>
  );
};
