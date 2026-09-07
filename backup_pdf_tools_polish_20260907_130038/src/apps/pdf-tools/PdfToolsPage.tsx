import { useState } from 'react'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { getAppNumber } from '@core/apps/appRegistry'
import { PdfEditorPanel } from './panels/PdfEditorPanel'
import { EditTextPanel } from './panels/EditTextPanel'
import { CompressPanel } from './panels/CompressPanel'
import { UnlockPanel } from './panels/UnlockPanel'
import { ProtectPanel } from './panels/ProtectPanel'
import { CreatePanel } from './panels/CreatePanel'
import './pdf-tools.css'

type Tab = 'editor' | 'edit-text' | 'compress' | 'unlock' | 'protect' | 'create'

const TABS: { key: Tab; label: string }[] = [
  { key: 'editor', label: 'PDF Editor' },
  { key: 'edit-text', label: 'Edit Text' },
  { key: 'compress', label: 'Compress' },
  { key: 'unlock', label: 'Unlock' },
  { key: 'protect', label: 'Protect' },
  { key: 'create', label: 'Create PDF' },
]

export function PdfToolsPage() {
  const [tab, setTab] = useState<Tab>('editor')

  return (
    <PageContainer>
      <div className="tool-page pdft-page">
        <ToolAppHeader
          appNumber={getAppNumber('pdf-tools')}
          title="PDF Tools"
          description="Merge, split, extract, images-to-PDF, unlock, protect aur create karo PDFs — sab kuch is browser ke andar hota hai. No upload, no server, free."
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

        {tab === 'editor' && <PdfEditorPanel />}
        {tab === 'edit-text' && <EditTextPanel />}
        {tab === 'compress' && <CompressPanel />}
        {tab === 'unlock' && <UnlockPanel />}
        {tab === 'protect' && <ProtectPanel />}
        {tab === 'create' && <CreatePanel />}
      </div>
    </PageContainer>
  )
}
