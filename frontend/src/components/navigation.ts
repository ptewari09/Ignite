import { FileSpreadsheet, FileUp, Files, FolderKanban, GitCompareArrows, LayoutDashboard, Radar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  path: string;
  label: string;
  group: 'Workspace' | 'Review & delivery';
  icon: LucideIcon;
  showInNavigation: boolean;
}

export const applicationRoutes: readonly NavigationItem[] = [
  { path: '/overview', label: 'Overview', group: 'Workspace', icon: LayoutDashboard, showInNavigation: true },
  { path: '/projects', label: 'Projects', group: 'Workspace', icon: FolderKanban, showInNavigation: true },
  { path: '/upload-reports', label: 'Upload Reports', group: 'Workspace', icon: FileUp, showInNavigation: true },
  { path: '/evidence', label: 'Evidence Explorer', group: 'Workspace', icon: Files, showInNavigation: true },
  { path: '/reconciliation', label: 'Reconciliation', group: 'Review & delivery', icon: GitCompareArrows, showInNavigation: false },
  { path: '/blocker-radar', label: 'Smart Blocker Radar', group: 'Review & delivery', icon: Radar, showInNavigation: false },
  { path: '/customer-reports', label: 'Customer Reports', group: 'Review & delivery', icon: FileSpreadsheet, showInNavigation: true },
];

export const navigationItems = applicationRoutes.filter((item) => item.showInNavigation);
