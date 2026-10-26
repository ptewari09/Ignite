import { Navigate, Route, Routes } from 'react-router';
import { applicationRoutes } from './components/navigation';
import { AppLayout } from './layouts/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { UploadReportsPage } from './pages/UploadReportsPage';
import { EvidenceExplorerPage } from './pages/EvidenceExplorerPage';

export function App() {
  return (
    <WorkspaceProvider><Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="upload-reports" element={<UploadReportsPage />} />
        <Route path="evidence" element={<EvidenceExplorerPage />} />
        {applicationRoutes.filter((item) => !['/overview', '/projects', '/upload-reports', '/evidence'].includes(item.path)).map((item) => (
          <Route key={item.path} path={item.path.slice(1)} element={<PlaceholderPage title={item.label} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes></WorkspaceProvider>
  );
}
