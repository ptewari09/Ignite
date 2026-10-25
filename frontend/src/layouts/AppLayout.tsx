import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronRight, Folder, Menu, X } from 'lucide-react';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { applicationRoutes } from '../components/navigation';

export function AppLayout() {
  const { pathname } = useLocation();
  const title = applicationRoutes.find((item) => item.path === pathname)?.label ?? 'Page not found';
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  const closeMenu = useCallback(() => {
    dialogRef.current?.close();
    setMenuOpen(false);
  }, []);

  function keepFocusInMenu(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  useEffect(() => {
    if (menuOpen && !dialogRef.current?.open) dialogRef.current?.showModal();
    if (!menuOpen && dialogRef.current?.open) dialogRef.current?.close();
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  useEffect(() => {
    document.title = `${title} | TraceSync`;
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      mainRef.current?.focus();
      window.scrollTo({ top: 0 });
    }
  }, [pathname, title]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const handleResize = () => { if (desktop.matches) closeMenu(); };
    desktop.addEventListener('change', handleResize);
    return () => desktop.removeEventListener('change', handleResize);
  }, [closeMenu]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="desktop-sidebar"><Sidebar /></aside>

      <dialog ref={dialogRef} id="mobile-navigation" className="mobile-navigation" aria-label="Navigation menu"
        onKeyDown={keepFocusInMenu}
        onClose={() => setMenuOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) closeMenu(); }}>
        <div className="mobile-sidebar">
          <button className="mobile-close icon-button" type="button" aria-label="Close navigation" onClick={closeMenu}>
            <X size={20} aria-hidden="true" />
          </button>
          <Sidebar mobile onNavigate={closeMenu} />
        </div>
      </dialog>

      <div className="app-workspace">
        <header className="app-header">
          <div className="flex min-w-0 items-center gap-3">
            <button className="menu-toggle icon-button" type="button" aria-label="Open navigation" aria-expanded={menuOpen}
              aria-controls="mobile-navigation" onClick={() => setMenuOpen(true)}>
              <Menu size={21} aria-hidden="true" />
            </button>
            <div className="header-breadcrumb"><span className="breadcrumb-root">Workspace</span><ChevronRight size={14} aria-hidden="true" /><span className="header-title">{title}</span></div>
          </div>
          <span className="project-context"><Folder size={15} strokeWidth={1.7} aria-hidden="true" /><span className="project-context-full">No project selected</span><span className="project-context-short">No project</span></span>
        </header>
        <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="workspace-footer"><span>Every finding has a source. Every decision has context.</span><span>TraceSync</span></footer>
      </div>
    </div>
  );
}
