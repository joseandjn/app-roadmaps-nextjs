'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/useTranslation'
import type { LlmEnvInfo } from '@engine/index'

const labelCls = 'text-[11px] font-semibold text-[#71717a] mb-1.5'
const btn = 'flex items-center gap-1.5 border border-[#ececec] text-[#52525b] bg-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer font-inherit disabled:opacity-40 disabled:cursor-not-allowed'

type Status = LlmEnvInfo & { ollama?: { reachable: boolean; models: string[]; installed: boolean } }
type TestResult = { ok: boolean; model?: string; ms?: number; error?: string; code?: string }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-[#f4f4f5] last:border-b-0">
      <span className="w-[120px] flex-none text-[12px] text-[#71717a]">{label}</span>
      <span className="flex-1 min-w-0 text-[13px] text-[#27272a] break-words">{children}</span>
    </div>
  )
}

const Ok = ({ children }: { children: React.ReactNode }) => <span className="inline-flex items-center gap-1 text-[#2f7d4f]"><CheckCircle2 size={13} />{children}</span>
const Bad = ({ children }: { children: React.ReactNode }) => <span className="inline-flex items-center gap-1 text-[#c0584f]"><XCircle size={13} />{children}</span>

// Which AI model the app uses (configured in .env, never edited here: the
// key stays out of the browser), whether it's reachable, and a connection test.
export default function AssistantSettings() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  useEffect(() => {
    let live = true
    fetch('/api/llm', { cache: 'no-store' })
      .then(r => r.json())
      .then(s => { if (live) setStatus(s as Status) })
      .catch(() => { if (live) setLoadError(true) })
    return () => { live = false }
  }, [])

  const test = async () => {
    setTesting(true); setResult(null)
    try { setResult(await (await fetch('/api/llm/test', { method: 'POST' })).json() as TestResult) }
    catch (e) { setResult({ ok: false, error: (e as Error).message }) }
    finally { setTesting(false) }
  }

  if (loadError) return <p className="text-[12px] text-[#c0584f] m-0">{t('Could not read the assistant configuration.')}</p>
  if (!status) return <p className="text-[12px] text-[#a1a1aa] m-0">{t('Checking…')}</p>

  const isClaude = status.provider === 'anthropic'
  const envExample = isClaude
    ? 'LLM_PROVIDER=anthropic\nANTHROPIC_API_KEY=sk-ant-…\nANTHROPIC_MODEL=' + status.model
    : 'LLM_PROVIDER=ollama\nOLLAMA_MODEL=' + status.model + '\nOLLAMA_BASE_URL=' + (status.baseUrl ?? '')

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className={labelCls}>{t('In use')}</div>
        <div className="bg-white border border-[#ececec] rounded-lg px-3 py-1">
          <Row label={t('Provider')}>{isClaude ? 'Claude (Anthropic)' : t('Ollama (local, on this machine)')}</Row>
          <Row label={t('Model')}><code className="text-[12px]">{status.model}</code></Row>
          {isClaude ? (
            <Row label={t('API key')}>{status.keyConfigured ? <Ok>{t('Configured')}</Ok> : <Bad>{t('Missing: set ANTHROPIC_API_KEY in .env')}</Bad>}</Row>
          ) : (
            <>
              <Row label={t('Server')}>
                <code className="text-[12px]">{status.baseUrl}</code>{' '}
                {status.ollama?.reachable ? <Ok>{t('responding')}</Ok> : <Bad>{t('not responding: is Ollama running?')}</Bad>}
              </Row>
              {status.ollama?.reachable && (
                <Row label={t('Installed')}>
                  {status.ollama.installed ? <Ok>{t('the model is installed')}</Ok> : <Bad>{t('the model is not installed: ollama pull {model}', { model: status.model })}</Bad>}
                  {status.ollama.models.length > 0 && <div className="text-[11px] text-[#a1a1aa] mt-1">{t('Available: {list}', { list: status.ollama.models.join(', ') })}</div>}
                </Row>
              )}
            </>
          )}
          <Row label={t('Used by')}>{t('Suggest duration, plan analysis and voice commands')}</Row>
        </div>
      </div>

      <div>
        <button className={btn} onClick={test} disabled={testing}>
          {testing ? <Loader2 size={13} className="animate-spin" /> : null}
          {testing ? t('Testing…') : t('Test connection')}
        </button>
        {result && (
          <p className="text-[12px] mt-2 mb-0">
            {result.ok
              ? <Ok>{t('Connected: {model} answered in {s} s', { model: result.model ?? status.model, s: ((result.ms ?? 0) / 1000).toFixed(1) })}</Ok>
              : <Bad>{t('No connection')}{result.error ? `: ${result.error}` : ''}</Bad>}
          </p>
        )}
      </div>

      <div className="h-px bg-[#f1f1f1]" />

      <div>
        <div className={labelCls}>{t('How to change it')}</div>
        <p className="text-[11px] text-[#a1a1aa] mb-2">{t('The model is set in the .env file at the root of the project (the API key never goes through the browser). After changing it, restart the server.')}</p>
        <pre className="m-0 text-[12px] text-[#27272a] bg-white border border-[#ececec] rounded-lg px-3 py-2 overflow-x-auto">{envExample}</pre>
      </div>
    </div>
  )
}
