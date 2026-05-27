import { auth } from '@/auth'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'

export async function POST() {
  const session = await auth()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { ok } = rateLimit(session.user?.email ?? 'unknown', 10)
  if (!ok) return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })

  revalidatePath('/', 'layout')

  return Response.json({ revalidated: true, at: new Date().toISOString() })
}
