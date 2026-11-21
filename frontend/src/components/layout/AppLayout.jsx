import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { api } from '../../lib/api.js'
import { Sidebar } from './Sidebar.jsx'
import { Topbar } from './Topbar.jsx'

export function AppLayout() {
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  const status = useQuery({ queryKey: ['status'], queryFn: () => api.get('/status'), refetchInterval: 10_000 })

  useEffect(() => setDrawer(false), [location.pathname])

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block">
        <Sidebar status={status.data} />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setDrawer(false)} aria-label="×" />
          <aside className="relative h-full w-[260px]">
            <Sidebar status={status.data} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className="min-w-0">
        <Topbar status={status.data} onMenu={() => setDrawer(true)} />
        <main key={location.pathname} className="animate-fade-up mx-auto max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
