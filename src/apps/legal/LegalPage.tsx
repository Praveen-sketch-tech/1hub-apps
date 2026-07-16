import { PageContainer } from '@shared/components/layout/PageContainer'
import type { ReactNode } from 'react'

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PageContainer className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">{title}</h1>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{children}</div>
    </PageContainer>
  )
}

export function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>This is placeholder privacy policy content for the Hub Apps starter platform. Replace it with your own policy before going to production.</p>
      <p>Describe what data you collect (account info, analytics events, feedback), how it's stored (Supabase), and how users can request deletion.</p>
    </LegalPage>
  )
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>This is placeholder terms-of-service content. Replace it with your own terms before going to production.</p>
    </LegalPage>
  )
}

export function AboutPage() {
  return (
    <LegalPage title="About">
      <p>Hub Apps is a starter platform used as the base for every new application we build — authentication, profiles, analytics, an admin panel, and shared UI, all ready on day one.</p>
    </LegalPage>
  )
}

export function ContactPage() {
  return (
    <LegalPage title="Contact">
      <p>Have a question or found a bug? Use the feedback button in the bottom-left corner, or email us at support@example.com.</p>
    </LegalPage>
  )
}
