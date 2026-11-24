import { useEffect, useId, useState } from 'react'
import { Copy, Download, Volume2, FileDown } from 'lucide-react'
import { ToolFrame } from '@/components/shell/ToolFrame'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/tool/Field'
import { Segmented } from '@/components/tool/Segmented'
import { DotGrid } from '@/components/tool/DotGrid'
import { toast } from '@/components/ui/Toast'
import { TABLES, toBraille, type Table } from '@/engines/braille/client'
import { toBrf } from '@/engines/braille/cells'
import { Speaker } from '@/engines/speech/tts'
import { downloadText } from '@/lib/download'

const speaker = new Speaker()

export default function TextToBraillePage() {
  const [table, setTable] = useState<Table>('en-ueb-g1')
  const [text, setText] = useState('HELLO, HOW ARE YOU?')
  const [out, setOut] = useState('')
  const [engine, setEngine] = useState<'liblouis' | 'offline-grade1' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<{ input: string; braille: string; table: Table }[]>([])
  const inputId = useId()

  useEffect(() => {
    let live = true
    const t = setTimeout(() => {
      if (!text.trim()) { setOut(''); return }
      toBraille(text, table)
        .then((r) => { if (live) { setOut(r.unicode); setEngine(r.engine); setError(null) } })
        .catch((e: Error) => { if (live) { setOut(''); setError(e.message) } })
    }, 200)
    return () => { live = false; clearTimeout(t) }
  }, [text, table])

  const remember = () => { if (out && log.at(-1)?.input !== text) setLog((l) => [...l, { input: text, braille: out, table }]) }

  const downloadLog = () => {
    const entries = log.length ? log : out ? [{ input: text, braille: out, table }] : []
    const body = ['Bridgify: text to braille', '='.repeat(26), '', ...entries.map((e, i) => `[${i + 1}] Input: ${e.input}\n    Braille (${TABLES.find((t) => t.id === e.table)?.label}): ${e.braille.replace(/⠀/g, ' ')}\n`)].join('\n')
    downloadText('bridgify-braille.txt', body)
  }

  return (
    <ToolFrame title="Text to braille" purpose="Type text and see it as braille: Grade 1, Grade 2 or Hindi Bharati." privacy={{ where: 'device', detail: 'Translated on this device' }}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel label="Input" className="flex flex-col gap-4 p-5">
          <Segmented label="Braille" value={table} options={TABLES.map((t) => ({ id: t.id, label: t.label }))} onChange={setTable} />
          <p className="-mt-2 text-[0.875rem] text-ink-muted">{TABLES.find((t) => t.id === table)?.note}</p>
          <div>
            <label htmlFor={inputId} className="mb-1.5 block font-medium">Text</label>
            <textarea id={inputId} value={text} onChange={(e) => setText(e.target.value)} onBlur={remember} rows={5} lang={table === 'hi-in-g1' ? 'hi' : 'en'}
              placeholder={table === 'hi-in-g1' ? 'हिंदी में लिखें' : 'Type here'}
              className="w-full resize-y rounded-[10px] border border-line bg-bg px-4 py-3 text-[1.25rem] leading-snug outline-none placeholder:text-ink-muted focus:border-brand" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => speaker.speak(text, { lang: table === 'hi-in-g1' ? 'hi-IN' : 'en-IN' })} disabled={!text.trim()} icon={<Volume2 aria-hidden size={16} />}>Speak</Button>
          </div>
        </Panel>

        <Panel label="Braille output" className="flex flex-col gap-5 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.875rem] font-medium text-ink-muted">Braille</p>
            {engine === 'offline-grade1' && <p className="text-[0.875rem] text-warn">Offline: Grade 1 only</p>}
          </div>
          {error ? <p role="alert">{error}</p> : out ? (
            <>
              <p className="sr-only" aria-label={`Braille text: ${out}`}>{out}</p>
              <DotGrid unicode={out} />
            </>
          ) : <p className="text-ink-muted">Braille appears here as you type.</p>}
          <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-4">
            <Button onClick={async () => { await navigator.clipboard.writeText(out); toast('Braille copied') }} disabled={!out} icon={<Copy aria-hidden size={16} />}>Copy braille</Button>
            <Button onClick={() => { remember(); downloadLog() }} disabled={!out} icon={<Download aria-hidden size={16} />}>Download .txt</Button>
            <Button onClick={() => downloadText('bridgify-braille.brf', toBrf(out), 'text/plain')} disabled={!out || table === 'hi-in-g1'} icon={<FileDown aria-hidden size={16} />}>Download .brf</Button>
          </div>
        </Panel>
      </div>
    </ToolFrame>
  )
}
