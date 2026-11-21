import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { LoginScene } from '../components/login/LoginScene.jsx'
import { Logo, LogoMark } from '../components/ui/Logo.jsx'
import { Button } from '../components/ui/Button.jsx'
import { Field, Input } from '../components/ui/Field.jsx'
import { errorText, useT } from '../i18n/index.js'
import { api } from '../lib/api.js'
import { formatPhone } from '../lib/format.js'
import { useAuth } from '../store/auth.js'
import { useLang } from '../store/lang.js'

export function LoginPage() {
  const { t } = useT()
  const { lang, setLang } = useLang()
  const { token, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const demo = useQuery({ queryKey: ['demo-logins'], queryFn: () => api.get('/auth/demo'), retry: false })

  if (token) return <Navigate to={location.state?.from ?? '/'} replace />

  async function submit(event) {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await api.post('/auth/login', { phone, pin })
      login(result.token, result.user)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_540px]">
      <LoginScene />

      <section className="relative flex flex-col overflow-hidden bg-surface px-6 py-8 sm:px-12">
        <div className="pointer-events-none absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden />
        <div className="flex items-center justify-between">
          <span className="lg:invisible">
            <Logo className="text-ink" />
          </span>
          <div className="relative flex rounded-[10px] bg-sunken p-0.5">
            {['uz', 'ru'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`h-7 rounded-lg px-2.5 text-[12px] font-semibold uppercase transition-all ${lang === code ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(16_16_24/0.1)]' : 'text-muted hover:text-ink'}`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        <div className="animate-fade-up relative m-auto w-full max-w-[380px] py-10">
          <div className="mb-6 inline-flex rounded-2xl bg-surface p-2 shadow-lift ring-1 ring-line">
            <LogoMark size={44} animated />
          </div>
          <p className="text-[13px] font-medium text-brand">{t('login.welcome')}</p>
          <h1 className="mt-1 text-[30px] font-semibold tracking-[-0.03em]">{t('login.title')}</h1>
          <p className="mt-1 text-muted">{t('login.subtitle')}</p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <Field label={t('login.phone')}>
              {({ id }) => (
                <Input
                  id={id}
                  type="tel"
                  inputMode="tel"
                  autoComplete="username"
                  placeholder="+998 90 123 45 67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              )}
            </Field>
            <Field label={t('login.pin')}>
              {({ id }) => (
                <Input
                  id={id}
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="num tracking-[0.4em]"
                  required
                />
              )}
            </Field>
            {error && (
              <p role="alert" className="rounded-lg bg-late-bg px-3 py-2 text-[13px] font-medium text-late-ink">
                {errorText(t, error)}
              </p>
            )}
            <Button type="submit" variant="primary" className="hover-glow h-11 w-full justify-center" loading={loading} disabled={!phone || pin.length !== 4}>
              {t('login.submit')}
            </Button>
          </form>

          {demo.data?.demoMode && demo.data.logins.length > 0 && (
            <div className="mt-8 rounded-2xl border border-dashed border-rule p-4">
              <p className="text-[13px] font-semibold">{t('login.demo')}</p>
              <p className="text-[12px] text-muted">{t('login.demoHint')}</p>
              <div className="mt-3 space-y-2">
                {demo.data.logins.map((item) => (
                  <button
                    key={item.phone}
                    type="button"
                    onClick={() => {
                      setPhone(formatPhone(item.phone))
                      setPin(item.pin)
                    }}
                    className="hover-lift flex w-full items-center justify-between rounded-xl border border-transparent bg-mist px-3 py-2 text-left hover:bg-surface"
                  >
                    <span>
                      <span className="block text-[13px] font-semibold">{item.name}</span>
                      <span className="block text-[12px] text-muted">{t(`roles.${item.role}`)}</span>
                    </span>
                    <span className="num text-right text-[14px] text-muted">
                      {formatPhone(item.phone)}
                      <br />
                      PIN {item.pin}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
