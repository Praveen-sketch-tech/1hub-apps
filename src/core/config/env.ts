// Central place to read environment variables.
// Never import.meta.env directly elsewhere — always go through this file.

function required(name: string, value: string | undefined): string {
  if (!value) {
    // eslint-disable-next-line no-console
    console.warn(`[env] Missing environment variable: ${name}. Add it to your .env file.`)
    return ''
  }
  return value
}

export const env = {
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: required('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY),
  appName: import.meta.env.VITE_APP_NAME || 'Hub Apps',
  appEnv: import.meta.env.VITE_APP_ENV || 'development'
}
