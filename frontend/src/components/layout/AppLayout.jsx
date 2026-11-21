import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { api } from '../../lib/api.js'
import { CommandPalette } from './CommandPalette.jsx'
import { Sidebar } from './Sidebar.jsx'
import { Topbar } from './Topbar.jsx'

export function AppLayout() {
  const [drawer, setDrawer] = useState(false)
  const [palette, setPalette] = useState(false)
  const location = useLocation()
  const status = useQuery({ queryKey: ['status'], queryFn: () => api.get('/status'), refetchInterval: 10_000 })

  useEffect(() => setDrawer(false), [location.pathname])

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPalette((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openPalette = () => {
    setDrawer(false)
    setPalette(true)
  }

  return (
    <div className="min-h-screen bg-mist lg:grid lg:h-screen lg:grid-cols-[264px_1fr] lg:overflow-hidden">
      <aside className="hidden h-screen lg:block">
        <Sidebar status={status.data} onSearch={openPalette} />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawer(false)} aria-label="×" />
          <aside className="animate-[pop-in_0.2s_ease-out] relative h-full w-[272px] shadow-pop">
            <Sidebar status={status.data} onNavigate={() => setDrawer(false)} onSearch={openPalette} />
          </aside>
        </div>
      )}

      {/* Inset panel: kontent fon ustida suzib turgan yumaloq yuzada */}
      <div className="relative min-w-0 bg-surface lg:my-2 lg:mr-2 lg:overflow-y-auto lg:rounded-[20px] lg:border lg:border-line lg:shadow-card">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[340px] bg-[radial-gradient(60%_100%_at_20%_0%,rgb(99_102_241/0.10),transparent_70%),radial-gradient(40%_80%_at_85%_0%,rgb(168_85_247/0.08),transparent_70%)]"
          aria-hidden
        />
        <Topbar status={status.data} onMenu={() => setDrawer(true)} onSearch={openPalette} />
        <main key={location.pathname} className="animate-fade-up relative mx-auto max-w-[1440px] px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  )
}
