import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Public routes that ANYONE can access (Client Portal, Assets, Admin Login)
  if (
    pathname.startsWith('/portal') || 
    pathname.startsWith('/admin') || 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // 2. Check for the Master Admin Cookie for ALL other internal routes
  const hasAdminKey = request.cookies.get('yaya_master_key');

  if (!hasAdminKey) {
    // 3. If they don't have the Master Key, kick them to the secure Admin Login
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  // 4. If they have the key, let them access the internal OS
  return NextResponse.next();
}