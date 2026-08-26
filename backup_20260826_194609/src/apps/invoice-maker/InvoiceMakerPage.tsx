import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'

// Keep the actual processing logic in plain functions (not inside the component)
// so both this UI and chatActions.ts can call the exact same code.
// export function process...(input) { ... }

export function InvoiceMakerPage() {
  return (
    <PageContainer>
      <div className="tool-page">
        <ToolAppHeader
          appNumber="003"
          title="Invoice Maker"
          description="Create professional GST-ready invoices with your business logo details, itemized billing, tax and discount — download as PDF in seconds, no login needed."
        />

        <Card>
          <p className="tool-muted">
            Build the tool UI here. Replace this placeholder.
          </p>
        </Card>
      </div>
    </PageContainer>
  )
}
