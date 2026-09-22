'use client'

import { Mic, Loader2, History, Sparkles } from 'lucide-react'
import { useRoadmapStore } from '@/store/useRoadmapStore'
import { deriveScale } from '@/lib/roadmapUtils'
import { SCALE_PRESETS } from '@/data/initialData'
import { useVoiceCommand } from '@/lib/voice/useVoiceCommand'
import { useTranslation } from '@/lib/i18n/useTranslation'
import ScenarioSwitcher from '@/components/ScenarioSwitcher'
import type { ViewKey } from '@/types'

const TABS: [ViewKey, string][] = [['timeline', 'Timeline'], ['cross', 'Cross-Project'], ['resources', 'Resources'], ['costs', 'Costs'], ['compare', 'Compare'], ['settings', 'Settings']]
const SCALE_LABELS = ['Day', 'Week', 'Month', 'Quarter']

export default function Toolbar() {
  const { view, pxPerDay, showDeps, setView, setScale, zoom, onNewProject, toggleDeps, toggleHistory, toggleAnalysis } = useRoadmapStore()
  const si = deriveScale(pxPerDay)
  const voice = useVoiceCommand()
  const { t, locale, setLocale } = useTranslation()

  return (
    <header className="h-[53px] flex-none flex items-center gap-1.5 min-[1320px]:gap-2 min-[1480px]:gap-3.5 px-4 border-b border-[#ececec] bg-white" style={{ position: 'relative', zIndex: 45 }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 flex-none">
        <div className="w-[18px] h-[18px] rounded-[5px] bg-[#18181b] flex items-center justify-center">
          <div className="w-2 h-2 border-[1.5px] border-white rounded-[2px]" />
        </div>
        <span className="text-sm font-semibold tracking-tight whitespace-nowrap">Roadmap</span>
        <span className="hidden min-[1760px]:inline text-[13px] text-[#a1a1aa] whitespace-nowrap">Management</span>
      </div>

      <div className="w-px h-[22px] bg-[#ececec] flex-none" />

      <ScenarioSwitcher />

      <button
        onClick={toggleHistory}
        title={t('History')}
        className="flex-none w-7 h-7 border border-[#ececec] bg-white rounded-[7px] cursor-pointer text-[#52525b] flex items-center justify-center p-0"
      >
        <History size={14} />
      </button>

      <button
        onClick={toggleAnalysis}
        title={t('Analyze roadmap')}
        className="flex-none w-7 h-7 border border-[#ececec] bg-white rounded-[7px] cursor-pointer text-[#52525b] flex items-center justify-center p-0"
      >
        <Sparkles size={14} />
      </button>

      <div className="w-px h-[22px] bg-[#ececec] flex-none" />

      {/* View tabs */}
      <nav className="flex items-center gap-0.5 flex-none">
        {TABS.map(([k, l]) => {
          const active = view === k
          return (
            <button
              key={k}
              onClick={() => setView(k)}
              className="border-none bg-transparent text-[13px] px-2 min-[1480px]:px-2.5 py-1.5 rounded-[7px] cursor-pointer font-inherit whitespace-nowrap"
              style={{
                color: active ? '#18181b' : '#71717a',
                fontWeight: active ? 600 : 500,
                boxShadow: active ? 'inset 0 -2px 0 #18181b' : 'none',
              }}
            >
              {t(l)}
            </button>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Scale selector */}
      <div className="flex items-center gap-0.5 bg-[#f4f4f5] border border-[#ececec] rounded-lg p-0.5 flex-none">
        {SCALE_LABELS.map((l, i) => {
          const active = i === si
          return (
            <button
              key={l}
              onClick={() => setScale(i)}
              className="border-none text-xs px-2 min-[1480px]:px-[11px] py-[5px] rounded-md cursor-pointer font-inherit"
              style={{
                background: active ? '#fff' : 'transparent',
                color: active ? '#18181b' : '#71717a',
                fontWeight: active ? 600 : 500,
                boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {t(l)}
            </button>
          )
        })}
      </div>

      {/* Zoom buttons */}
      <div className="flex items-center gap-0.5 flex-none">
        {[['−', 0.8], ['+', 1.25]].map(([label, factor]) => (
          <button
            key={label as string}
            onClick={() => zoom(factor as number)}
            className="w-7 h-7 border border-[#ececec] bg-white rounded-[7px] cursor-pointer text-[#52525b] text-base flex items-center justify-center p-0"
          >
            {label as string}
          </button>
        ))}
      </div>

      {/* Voice command */}
      {voice.supported && (
        <button
          onClick={() => (voice.status === 'idle' ? voice.start() : voice.stop())}
          title={
            voice.status === 'listening' ? t('Voice session active — speak a command, or click to stop')
              : voice.status === 'thinking' ? t('Interpreting… click to stop the session')
              : t('Start a voice session (multiple commands, click again to stop)')
          }
          className="flex-none w-7 h-7 border rounded-[7px] cursor-pointer flex items-center justify-center p-0"
          style={{
            borderColor: voice.status !== 'idle' ? '#f1c0bc' : '#ececec',
            background: voice.status !== 'idle' ? '#fdeceb' : '#fff',
            color: voice.status !== 'idle' ? '#c0584f' : '#52525b',
          }}
        >
          {voice.status === 'thinking'
            ? <Loader2 size={14} className="animate-spin" />
            : <Mic size={14} />}
        </button>
      )}

      {/* Language toggle */}
      <button
        onClick={() => setLocale(locale === 'en' ? 'es' : 'en')}
        title={locale === 'en' ? t('Switch to Spanish') : t('Switch to English')}
        className="flex-none w-7 h-7 border border-[#ececec] bg-white rounded-[7px] cursor-pointer text-[#52525b] text-[11px] font-semibold flex items-center justify-center p-0"
      >
        {locale === 'en' ? 'EN' : 'ES'}
      </button>

      {/* New project */}
      <button
        onClick={onNewProject}
        title={t('New project')}
        className="flex-none flex items-center gap-1.5 bg-[#18181b] text-white border-none rounded-lg px-3 py-[7px] text-xs font-semibold cursor-pointer font-inherit whitespace-nowrap"
      >
        <span className="text-sm leading-none">+</span>
        <span className="hidden min-[1700px]:inline">{t('New project')}</span>
      </button>

      {/* Deps toggle — only on timeline */}
      {view === 'timeline' && (
        <button
          onClick={toggleDeps}
          title={t('Dependencies')}
          className="flex-none flex items-center gap-[7px] h-[30px] px-[9px] min-[1700px]:px-[11px] border rounded-lg cursor-pointer text-xs font-semibold font-inherit whitespace-nowrap"
          style={{
            borderColor: showDeps ? '#c2d4ff' : '#ececec',
            background: showDeps ? '#eaf1ff' : '#fff',
            color: showDeps ? '#1d4ed8' : '#52525b',
          }}
        >
          <span
            className="w-[13px] h-[13px] rounded-[4px] flex items-center justify-center text-white text-[9px] leading-none flex-none"
            style={{
              border: `1.5px solid ${showDeps ? '#3b6ef5' : '#cbcbd0'}`,
              background: showDeps ? '#3b6ef5' : '#fff',
            }}
          >
            {showDeps ? '✓' : ''}
          </span>
          <span className="hidden min-[1700px]:inline">{t('Dependencies')}</span>
        </button>
      )}
    </header>
  )
}
