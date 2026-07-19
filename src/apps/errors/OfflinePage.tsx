export function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-5xl">📡</span>
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="text-sm text-slate-500">Check your internet connection and try again.</p>
    </div>
  )
}
