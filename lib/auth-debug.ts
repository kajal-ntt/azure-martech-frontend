/**
 * Debugging utilities for authentication issues
 */

export function debugAuthCookies() {
  if (globalThis.window === undefined) return;

  const cookies = document.cookie.split(';').map(c => c.trim());
  console.log('[auth-debug] All cookies:', cookies);

  const authCookies = cookies.filter(c =>
    c.includes('auth') ||
    c.includes('session') ||
    c.includes('token') ||
    c.includes('better-auth')
  );
  console.log('[auth-debug] Auth-related cookies:', authCookies);

  if (authCookies.length === 0) {
    console.warn('[auth-debug] ⚠️ No auth cookies found! This may indicate:');
    console.warn('  1. User is not signed in');
    console.warn('  2. Cookies are not being set correctly');
    console.warn('  3. Cookie domain mismatch');
    console.warn('  4. SameSite or Secure attribute issues');
  }
}

export function debugAuthHeaders() {
  console.log('[auth-debug] Environment:');
  console.log('  NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
  console.log('  NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  console.log('  NEXT_PUBLIC_USE_MOCK:', process.env.NEXT_PUBLIC_USE_MOCK);
  console.log('  Current origin:', globalThis.window ? globalThis.window.location.origin : 'N/A');
}

export async function testAuthEndpoint() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/session`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[auth-debug] Session endpoint status:', response.status);
    console.log('[auth-debug] Session endpoint headers:', Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.json();
      console.log('[auth-debug] Session data:', data);
      return data;
    } else {
      console.error('[auth-debug] Session endpoint error:', response.statusText);
      return null;
    }
  } catch (error) {
    console.error('[auth-debug] Failed to fetch session:', error);
    return null;
  }
}

export function runAuthDiagnostics() {
  console.log('=== AUTH DIAGNOSTICS ===');
  debugAuthHeaders();
  debugAuthCookies();
  testAuthEndpoint();
  console.log('========================');
}
