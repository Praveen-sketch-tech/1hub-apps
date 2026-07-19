import { PageContainer } from '@shared/components/layout/PageContainer'
import { GlobalSearch } from '@shared/components/search/GlobalSearch'

export function SearchPage() {
  return (
    <PageContainer>
      <h1 className="mb-6 text-center text-xl font-semibold">Search</h1>
      <GlobalSearch />
    </PageContainer>
  )
}
