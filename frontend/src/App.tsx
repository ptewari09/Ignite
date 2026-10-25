import { Navigate, Route, Routes } from 'react-router';
import { applicationRoutes } from './components/navigation';
import { AppLayout } from './layouts/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        {applicationRoutes.filter((item) => item.path !== '/overview').map((item) => (
          <Route key={item.path} path={item.path.slice(1)} element={<PlaceholderPage title={item.label} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
