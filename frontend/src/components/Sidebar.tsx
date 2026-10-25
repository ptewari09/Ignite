import { ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router';
import { Brand } from './Brand';
import { navigationItems } from './navigation';

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  return (
    <div className="sidebar-content">
      <div className="brand-container"><Brand onNavigate={onNavigate} /></div>
      <nav aria-label={mobile ? 'Mobile navigation' : 'Primary navigation'} className="sidebar-nav">
        {(['Workspace', 'Review & delivery'] as const).map((group) => (
          <div className="nav-group" key={group}>
            <p className="nav-group-label">{group}</p>
            <ul className="space-y-1">
              {navigationItems.filter((item) => item.group === group).map(({ path, label, icon: Icon }) => (
                <li key={path}>
                  <NavLink to={path} end onClick={onNavigate} className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}>
                    <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                    <span>{label}</span>
                    <span className="nav-active-mark" aria-hidden="true" />
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-note">
          <ShieldCheck size={21} strokeWidth={1.6} className="text-brand-accent" aria-hidden="true" />
          <p><span className="sidebar-note-title">Evidence comes first.</span><span className="sidebar-note-copy">Clear context. Informed decisions.</span></p>
        </div>
      </div>
    </div>
  );
}
