import { useRef } from 'react'
import { useT } from '../../i18n/index.js'
import { Logo } from '../ui/Logo.jsx'

// Login sahifasining chap paneli: CSS 3D sahna (kutubxonasiz).
// Sichqoncha harakatiga qarab sahna egiladi; prefers-reduced-motion bo'lsa animatsiyalar o'chadi (index.css).

function GlassCard({ className = '', style, children }) {
  return (
    <div
      className={`absolute rounded-2xl border border-white/15 bg-white/[0.07] p-4 text-white shadow-[0_20px_50px_-12px_rgb(0_0_0/0.6)] backdrop-blur-md ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

function Ring({ size, tilt, spin = 'animate-spin-slow', dot = '#a5b4fc', dashed = false }) {
  return (
    <div className="absolute top-1/2 left-1/2 [transform-style:preserve-3d]" style={{ transform: `translate(-50%, -50%) ${tilt}` }}>
      <div
        className={`relative rounded-full shadow-[0_0_24px_rgb(129_140_248/0.25)] ${dashed ? 'border-2 border-dashed border-violet-300/40' : 'border-2 border-indigo-300/45'} ${spin}`}
        style={{ width: size, height: size }}
      >
        <span
          className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full"
          style={{ background: dot, boxShadow: `0 0 16px 4px ${dot}` }}
        />
      </div>
    </div>
  )
}

export function LoginScene() {
  const { t } = useT()
  const stage = useRef(null)
  const frame = useRef(0)

  function onPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      stage.current?.style.setProperty('--ry', `${x * 18}deg`)
      stage.current?.style.setProperty('--rx', `${-y * 14}deg`)
    })
  }

  function onPointerLeave() {
    stage.current?.style.setProperty('--ry', '0deg')
    stage.current?.style.setProperty('--rx', '0deg')
  }

  return (
    <section
      className="relative hidden overflow-hidden bg-[#09090b] p-12 text-white lg:flex lg:flex-col"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {/* Rangli nur dog'lari */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="animate-blob absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-indigo-600/40 blur-[100px]" />
        <div className="animate-blob absolute top-1/3 -right-32 h-[380px] w-[380px] rounded-full bg-violet-600/30 blur-[100px] [animation-delay:-5s]" />
        <div className="animate-blob absolute -bottom-40 left-1/4 h-[360px] w-[360px] rounded-full bg-sky-500/20 blur-[110px] [animation-delay:-9s]" />
      </div>

      {/* Perspektivali pol to'ri — oldinga qarab harakatlanadi */}
      <div className="pointer-events-none absolute inset-x-[-50%] bottom-[-10%] h-[60%] [perspective:500px]" aria-hidden>
        <div
          className="animate-grid h-full w-full origin-bottom [mask-image:linear-gradient(to_top,black_10%,transparent_85%)]"
          style={{
            transform: 'rotateX(64deg)',
            backgroundImage:
              'linear-gradient(to right, rgb(129 140 248 / 0.28) 1px, transparent 1px), linear-gradient(to bottom, rgb(129 140 248 / 0.28) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="animate-fade-up relative z-10">
        <Logo className="text-white" />
      </div>

      {/* 3D sahna */}
      <div className="relative z-10 flex flex-1 items-center justify-center [perspective:1100px]" aria-hidden>
        <div
          ref={stage}
          className="relative h-[380px] w-[440px] transition-transform duration-300 ease-out [transform-style:preserve-3d]"
          style={{ transform: 'rotateX(calc(12deg + var(--rx, 0deg))) rotateY(var(--ry, 0deg))' }}
        >
          {/* Markaziy shar */}
          <div className="animate-float absolute top-1/2 left-1/2 [transform-style:preserve-3d]" style={{ transform: 'translate(-50%, -50%)' }}>
            <div className="relative h-36 w-36 rounded-full bg-[radial-gradient(circle_at_30%_28%,#c7d2fe_0%,#818cf8_22%,#4f46e5_55%,#1e1b4b_100%)] shadow-[0_0_80px_10px_rgb(99_102_241/0.45),inset_-14px_-18px_40px_rgb(0_0_0/0.45)]">
              <div className="absolute top-5 left-7 h-8 w-12 rotate-[-25deg] rounded-full bg-white/40 blur-md" />
              <svg viewBox="0 0 40 40" className="absolute inset-0 m-auto h-16 w-16 drop-shadow-[0_4px_10px_rgb(0_0_0/0.35)]">
                <path d="M27.8 13.2A10 10 0 1 0 30 20" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
                <path d="M24.5 17.4A4.6 4.6 0 1 0 24.6 20" fill="none" stroke="#e0e7ff" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="30" cy="20" r="2.6" fill="#fde68a" />
              </svg>
            </div>
          </div>

          {/* Orbita halqalari */}
          <Ring size={250} tilt="rotateX(72deg)" dot="#a5b4fc" />
          <Ring size={320} tilt="rotateX(72deg) rotateY(28deg)" spin="animate-spin-rev" dot="#c4b5fd" dashed />
          <Ring size={380} tilt="rotateX(80deg) rotateY(-20deg)" dot="#7dd3fc" />

          {/* Suzuvchi shisha kartalar (turli chuqurlikda) */}
          <GlassCard className="animate-float top-2 -left-10 w-52 [animation-delay:-1s]" style={{ transform: 'translateZ(90px) rotateY(14deg)' }}>
            <p className="text-[12px] text-white/60">{t('login.sceneRevenue')}</p>
            <p className="num mt-1 text-[22px] leading-none font-semibold">12 480 000</p>
            <div className="mt-3 flex h-10 items-end gap-1.5">
              {[40, 62, 48, 75, 58, 90, 70].map((h, i) => (
                <span key={i} className="flex-1 rounded-sm bg-gradient-to-t from-indigo-500 to-violet-300" style={{ height: `${h}%` }} />
              ))}
            </div>
          </GlassCard>

          <GlassCard className="animate-float -right-8 bottom-10 w-48 [animation-delay:-3s]" style={{ transform: 'translateZ(130px) rotateY(-16deg)' }}>
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold">{t('login.sceneTable')}</p>
              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300">{t('login.sceneOnTime')}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="animate-shimmer h-full w-2/3 rounded-full bg-[linear-gradient(90deg,#34d399,#a7f3d0,#34d399)] bg-[length:200%_100%]" />
            </div>
            <p className="num mt-2 text-[12px] text-white/60">02:14 / 03:00</p>
          </GlassCard>

          <GlassCard className="animate-float -bottom-2 left-6 w-40 [animation-delay:-4.5s]" style={{ transform: 'translateZ(50px) rotateY(10deg)' }}>
            <p className="text-[12px] text-white/60">{t('login.scenePromise')}</p>
            <p className="num mt-1 text-[24px] leading-none font-semibold text-emerald-300">98%</p>
          </GlassCard>
        </div>
      </div>

      <p className="animate-fade-up relative z-10 max-w-[480px] bg-gradient-to-r from-white via-white to-indigo-200 bg-clip-text text-[26px] leading-snug font-semibold tracking-[-0.02em] text-transparent [animation-delay:150ms]">
        {t('login.side')}
      </p>
    </section>
  )
}
