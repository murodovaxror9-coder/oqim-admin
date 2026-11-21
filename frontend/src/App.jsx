import { Navigate, Route, Routes, useLocation } from 'react-router'
import { AppLayout } from './components/layout/AppLayout.jsx'
import { Toasts } from './components/ui/Toasts.jsx'
import { AuditPage } from './pages/AuditPage.jsx'
import { BookingsPage } from './pages/BookingsPage.jsx'
import { ExceptionsPage } from './pages/ExceptionsPage.jsx'
import { ForecastPage } from './pages/ForecastPage.jsx'
import { HallPage } from './pages/HallPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { MenuPage } from './pages/MenuPage.jsx'
import { NotFoundPage } from './pages/NotFoundPage.jsx'
import { ReportsPage } from './pages/ReportsPage.jsx'
import { SettingsPage } from './pages/SettingsPage.jsx'
import { StaffPage } from './pages/StaffPage.jsx'
import { TablesPage } from './pages/TablesPage.jsx'
import { TodayPage } from './pages/TodayPage.jsx'
import { useAuth } from './store/auth.js'

function RequireAuth({ children }) {
  const token = useAuth((state) => state.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<TodayPage />} />
          <Route path="hall" element={<HallPage />} />
          <Route path="exceptions" element={<ExceptionsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="menu" element={<MenuPage />} />
          <Route path="tables" element={<TablesPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="forecast" element={<ForecastPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toasts />
    </>
  )
}
