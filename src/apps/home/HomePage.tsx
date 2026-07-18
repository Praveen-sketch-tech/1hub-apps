import { Link } from 'react-router-dom'
import { PageContainer } from '@shared/components/layout/PageContainer'
import { Card } from '@shared/components/ui/Card'
import { Button } from '@shared/components/ui/Button'
import { useAuth } from '@core/contexts/AuthContext'
import { ROUTES, APP_NAME } from '@core/config/constants'

const FEATURES = [
  {
    title: 'Authentication',
    description:
      'Login, signup, password reset, and session handling out of the box.'
  },
  {
    title: 'Profiles',
    description:
      'Name, email, mobile, avatar, and password management.'
  },
  {
    title: 'Self-hosted analytics',
    description:
      'Visitors, sessions, devices, and feature usage — stored in Supabase.'
  },
  {
    title: 'Admin panel',
    description:
      'Users, analytics, feedback, logs, and app settings in one place.'
  }
]

export function HomePage() {
  const { user } = useAuth()

  return (
    <PageContainer>
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{APP_NAME}</h1>

        <p className="max-w-xl text-slate-600 dark:text-slate-400">
          Useful, fast and privacy-friendly web tools built for everyday work.
        </p>

        {!user && (
          <div className="flex gap-3">
            <Link to={ROUTES.signup}>
              <Button>Get started</Button>
            </Link>

            <Link to={ROUTES.login}>
              <Button variant="secondary">Log in</Button>
            </Link>
          </div>
        )}
      </div>

      <section className="mb-12">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <div className="flex h-full flex-col gap-5">
              <div>
                <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                  App #001
                </p>

                <h2 className="text-xl font-bold">Smart Image Tools</h2>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Compress, resize, convert and crop images directly in your browser.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Compress
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Resize
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Convert
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Crop
                  </span>
                </div>
              </div>

              <div className="mt-auto pt-2">
                <Link to={ROUTES.smartImageTools}>
                  <Button>Open tool</Button>
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex h-full flex-col gap-5">
              <div>
                <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                  App #002
                </p>

                <h2 className="text-xl font-bold">Smart PDF Tools</h2>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Create, merge, split, reorder, rotate and compress PDFs directly in your browser.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Merge
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Split
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Compress
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Images to PDF
                  </span>
                </div>
              </div>

              <div className="mt-auto pt-2">
                <Link to={ROUTES.smartPdfTools}>
                  <Button>Open tool</Button>
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex h-full flex-col gap-5">
              <div>
                <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                  App #003
                </p>

                <h2 className="text-xl font-bold">
                  QR &amp; Barcode Studio
                </h2>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Create and scan QR codes and barcodes privately in your browser.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    QR Generator
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Barcode
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Scanner
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Wi-Fi QR
                  </span>
                </div>
              </div>

              <div className="mt-auto pt-2">
                <Link to={ROUTES.qrBarcodeStudio}>
                  <Button>Open tool</Button>
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex h-full flex-col gap-5">
              <div>
                <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                  App #004
                </p>

                <h2 className="text-xl font-bold">
                  Smart Text Tools
                </h2>

                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Clean, convert, compare and extract useful data from text instantly.
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Text Cleaner
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Case Converter
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    Compare
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
                    JSON
                  </span>
                </div>
              </div>

              <div className="mt-auto pt-2">
                <Link to={ROUTES.smartTextTools}>
                  <Button>Open tool</Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Platform features</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <h3 className="mb-1 text-base font-semibold">
                {feature.title}
              </h3>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </PageContainer>
  )
}
