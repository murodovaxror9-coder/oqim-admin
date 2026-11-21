import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Logo } from '../components/layout/Sidebar.jsx'
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
    <div className="grid min-h-screen lg:grid-cols-[1fr_520px]">
      <section className="relative hidden overflow-hidden bg-navy p-12 text-white lg:flex lg:flex-col">
        <Logo />
        <div className="mt-auto max-w-[520px]">
          <svg viewBox="0 0 520 180" className="mb-10 w-full" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <path
                key={row}
                d={`M0 ${40 + row * 34} C 90 ${10 + row * 34}, 170 ${70 + row * 34}, 260 ${40 + row * 34} S 430 ${10 + row * 34}, 520 ${40 + row * 34}`}
                fill="none"
                stroke={row === 1 ? '#a5b4fc' : '#3f3f46'}
                strokeWidth={row === 1 ? 3 : 2}
              />
            ))}
            <circle cx="260" cy="74" r="7" fill="#6366f1" stroke="#18181b" strokeWidth="3" />
          </svg>
          <p className="text-[28px] leading-snug font-semibold tracking-[-0.01em]">{t('login.side')}</p>
        </div>
      </section>

      <section className="flex flex-col bg-white px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <span className="lg:invisible">
            <Logo className="text-navy" />
          </span>
          <div className="flex rounded-lg border border-rule p-0.5">
            {['uz', 'ru'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={`h-7 rounded-md px-2.5 text-[12px] font-semibold uppercase ${lang === code ? 'bg-navy text-white' : 'text-muted'}`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        <div className="m-auto w-full max-w-[360px] py-10">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">{t('login.title')}</h1>
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
            <Button type="submit" variant="primary" className="w-full justify-center" loading={loading} disabled={!phone || pin.length !== 4}>
              {t('login.submit')}
            </Button>
          </form>

          {demo.data?.demoMode && demo.data.logins.length > 0 && (
            <div className="mt-8 rounded-xl border border-dashed border-rule p-4">
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
                    className="flex w-full items-center justify-between rounded-lg bg-mist px-3 py-2 text-left hover:bg-tint"
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
