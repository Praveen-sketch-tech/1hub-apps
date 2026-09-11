import { useState } from 'react'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'
import { getAppNumber } from '@core/apps/appRegistry'
import { DocumentsPanel } from './panels/DocumentsPanel'
import { CompressPanel } from './panels/CompressPanel'
import { ResizePanel } from './panels/ResizePanel'
import { ConvertPanel } from './panels/ConvertPanel'
import './image-tools.css'

type Tab = 'documents' | 'compress' | 'resize' | 'convert'

const TABS: { key: Tab; label: string }[] = [
  { key: 'documents', label: '🇮🇳 Govt Photo & Signature' },
  { key: 'compress', label: 'Compress' },
  { key: 'resize', label: 'Resize' },
  { key: 'convert', label: 'Convert' },
]

export function ImageToolsPage() {
  const [tab, setTab] = useState<Tab>('documents')

  return (
    <PageContainer>
      <div className="tool-page psr-page">
        <ToolAppHeader
          appNumber={getAppNumber('image-tools')}
          title="Image Tools"
          description="Compress, resize, convert aur government photo/signature specs — sab kuch is browser ke andar hota hai. No upload, no server, no waiting, free."
        />

        <div className="it-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`it-tab ${tab === t.key ? 'is-active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'documents' && <DocumentsPanel />}
        {tab === 'compress' && <CompressPanel />}
        {tab === 'resize' && <ResizePanel />}
        {tab === 'convert' && <ConvertPanel />}
      </div>
    </PageContainer>
  )
}
