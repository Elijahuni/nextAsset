import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client (cookie-based session for Next.js SSR)
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Singleton for client components
export const supabase = createSupabaseBrowserClient()
