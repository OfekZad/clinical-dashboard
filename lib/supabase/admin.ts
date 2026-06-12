import { createClient } from "@supabase/supabase-js"

let adminClient: ReturnType<typeof createClient> | null = null

/**
 * Returns a Supabase client authenticated with the service_role key.
 * This bypasses RLS and should ONLY be used in API routes / server-side code,
 * never on the client.
 */
export function getSupabaseAdminClient() {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service-role credentials")
  }

  adminClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}
