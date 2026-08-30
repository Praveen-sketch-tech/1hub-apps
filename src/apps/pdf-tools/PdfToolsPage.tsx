import { useState } from 'react'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { getAppNumber } from '@core/apps/appRegistry'
import { CompressPanel } from './panels/CompressPanel'
import { UnlockPanel } from './panels/UnlockPanel'
import { ProtectPanel } from './panels/ProtectPanel'
import { CreatePanel } from './panels/CreatePanel'
import './pdf-tools.css'

type Tab = 'compress' | 'unlock' | 'protect' | 'create'

const TABS: { key: Tab; label: string }[] = [
  { key: 'compress', label: 'Compress' },
  { key: 'unlock', label: 'Unlock' },
  { key: 'protect', label: 'Protect' },
  { key: 'create', label: 'Create PDF' },
]

export function PdfToolsPage() {
  const [tab, setTab] = useState<Tab>('compress')

  return (
    <PageContainer>
      <div className="tool-page pdft-page">
        <ToolAppHeader
          appNumber={getAppNumber('pdf-tools')}
          title="PDF Tools"
          description="Compress, unlock, protect aur create karo PDFs — sab kuch is browser ke andar hota hai. No upload, no server, free."
        />

        <div className="pdft-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`pdft-tab ${tab === t.key ? 'is-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'compress' && <CompressPanel />}
        {tab === 'unlock' && <UnlockPanel />}
        {tab === 'protect' && <ProtectPanel />}
        {tab === 'create' && <CreatePanel />}
      </div>
    </PageContainer>
  )
}
