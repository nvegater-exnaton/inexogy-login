'use client';

import { useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useEffect, useState } from 'react';

// Helper function to extract OAuth verifier from response
const extractOAuthVerifier = (
  location: string | null,
  responseBody: string
): string | null => {
  // Extract verifier from Location header or fallback to body
  let oauthVerifier: string | null = null;
  if (location) {
    const redirected = new URL(location, 'https://api.inexogy.com');
    oauthVerifier = redirected.searchParams.get('oauth_verifier');
  }
  if (!oauthVerifier) {
    const bodyParams = new URLSearchParams(responseBody);
    oauthVerifier = bodyParams.get('oauth_verifier');
  }

  return oauthVerifier;
};

// Helper function to validate authorization response
const isAuthorizationSuccessful = (
  oauthVerifier: string | null,
  responseBody: string
): boolean => {
  return !!(oauthVerifier || responseBody.includes('oauth_verifier'));
};

// Helper function to handle successful authorization redirect
const handleSuccessfulAuthorization = (
  oauthVerifier: string,
  token: string,
  targetRedirectUrl: string
) => {
  const finalRedirectUrl = new URL(targetRedirectUrl);
  finalRedirectUrl.searchParams.set('oauth_verifier', oauthVerifier);
  finalRedirectUrl.searchParams.set('oauth_token', token);
  window.location.href = finalRedirectUrl.toString();
};

function HomeContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [oauthToken, setOauthToken] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');

  useEffect(() => {
    const token = searchParams.get('oauth_token');
    // biome-ignore lint/suspicious/noConsole: to check the token
    console.log('Extracted token: ', token);
    const redirect = searchParams.get('oauth_callback');

    if (token) {
      setOauthToken(token);
    }
    if (redirect) {
      setRedirectUrl(redirect);
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Call server-side API route
      const response = await fetch('/api/oauth1/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          oauthToken,
        }),
      });

      // Process response from API route
      const data = await response.json();
      const oauthVerifier = extractOAuthVerifier(data.location, data.body);

      // Validate authorization success
      if (!isAuthorizationSuccessful(oauthVerifier, data.body)) {
        throw new Error('Invalid credentials or authorization failed');
      }

      // Handle successful authorization
      if (oauthVerifier && redirectUrl) {
        handleSuccessfulAuthorization(oauthVerifier, oauthToken, redirectUrl);
      } else {
        setError('Missing verifier or redirect URL');
      }
    } catch (err) {
      // biome-ignore lint/suspicious/noConsole: We need to see this
      console.error('Authorization failed:', JSON.stringify(err, null, 2));
      setError(err instanceof Error ? err.message : 'Authorization failed');
    } finally {
      setLoading(false);
    }
  };

  if (!oauthToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 font-bold text-2xl">Missing OAuth Token</h1>
          <p>This page requires an oauth_token parameter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h1 className="font-bold text-3xl text-gray-900">Sign In</h1>
          <p className="mt-2 text-gray-600">
            Enter your credentials to authorize
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label
              className="block font-medium text-gray-700 text-sm"
              htmlFor="email"
            >
              Email
            </label>
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              type="email"
              value={email}
            />
          </div>

          <div>
            <label
              className="block font-medium text-gray-700 text-sm"
              htmlFor="password"
            >
              Password
            </label>
            <input
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </div>

          {error && (
            <div className="text-center text-red-600 text-sm">{error}</div>
          )}

          <button
            className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Authorizing...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
