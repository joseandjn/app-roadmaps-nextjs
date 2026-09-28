import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// The app has no login, so it only answers requests meant for this machine.
//
// - Host: a page on another site can't reach the app by pointing its own
//   domain at 127.0.0.1 (DNS rebinding), because the browser still sends that
//   domain as the Host. Allowed: localhost, 127.0.0.1, [::1], plus the
//   comma-separated names in ALLOWED_HOSTS (needed when the app is opened to
//   the network, see docs/docker.md).
// - Origin: a request that changes something must come from the app itself,
//   not from a page on another site or port. Requests without an Origin
//   (curl, scripts) pass, since only this machine can reach the port.

const DEFAULT_HOSTS = ['localhost', '127.0.0.1', '[::1]']

function allowedHosts(): Set<string> {
  const extra = (process.env.ALLOWED_HOSTS ?? '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
  return new Set([...DEFAULT_HOSTS, ...extra])
}

function hostnameOf(host: string): string | null {
  try { return new URL(`http://${host}`).hostname.toLowerCase() } catch { return null }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  const hostname = hostnameOf(host)
  if (!hostname || !allowedHosts().has(hostname)) {
    return new NextResponse('Forbidden host', { status: 403 })
  }

  if (!SAFE_METHODS.has(request.method)) {
    const origin = request.headers.get('origin')
    if (origin !== null) {
      let originHost: string | null = null
      try { originHost = new URL(origin).host.toLowerCase() } catch { /* "null" or malformed */ }
      if (originHost !== host.toLowerCase()) {
        return new NextResponse('Forbidden origin', { status: 403 })
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  // Everything but static build assets.
  matcher: '/((?!_next/static|favicon.ico).*)',
}
