'use client';

import { useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useState, Suspense } from 'react';

// Helper function to encode password with special character handling
const encodePassword = (userPassword: string): string => {
  return encodeURIComponent(userPassword).replace(/\*/g, '%2A');
};

// Helper function to build authorization URL
const buildAuthorizeUrl = (
  userEmail: string,
  userPassword: string,
  token: string
): string => {
  const encodedPassword = encodePassword(userPassword);
  const baseUrl = 'https://api.inexogy.com/public/v1/oauth1/authorize';
  const params = new URLSearchParams({
    oauth_token: token,
    email: userEmail,
    password: encodedPassword,
  });
  return `${baseUrl}?${params.toString()}`;
};

// Helper function to get request headers
const getRequestHeaders = () => ({
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
});

// Helper function to extract OAuth verifier from response
const extractOAuthVerifier = (
  response: Response,
  responseBody: string,
  authorizeUrl: string
): string | null => {
  // Try to get verifier from redirect location header
  const location = response.headers.get('location');
  if (location) {
    const redirectedUrl = new URL(location, authorizeUrl);
    const verifier = redirectedUrl.searchParams.get('oauth_verifier');
    if (verifier) {
      return verifier;
    }
  }

  // Try to get verifier from response body
  const bodyParams = new URLSearchParams(responseBody);
  return bodyParams.get('oauth_verifier');
};

// Helper function to validate authorization response
const isAuthorizationSuccessful = (
  oauthVerifier: string | null,
  isRedirect: boolean,
  responseBody: string
): boolean => {
  return !!(
    oauthVerifier ||
    isRedirect ||
    responseBody.includes('oauth_verifier')
  );
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
    const redirect = searchParams.get('redirect_url');

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
      // Build request URL and make API call
      const authorizeUrl = buildAuthorizeUrl(email, password, oauthToken);
      const response = await fetch(authorizeUrl, {
        method: 'GET',
        headers: getRequestHeaders(),
        redirect: 'manual',
      });

      // Process response
      const isRedirect = response.status >= 300 && response.status < 400;
      const responseBody = await response.text();
      const oauthVerifier = extractOAuthVerifier(
        response,
        responseBody,
        authorizeUrl
      );

      // Validate authorization success
      if (!isAuthorizationSuccessful(oauthVerifier, isRedirect, responseBody)) {
        throw new Error('Invalid credentials or authorization failed');
      }

      // Handle successful authorization
      if (oauthVerifier && redirectUrl) {
        handleSuccessfulAuthorization(oauthVerifier, oauthToken, redirectUrl);
      } else {
        setError('Missing verifier or redirect URL');
      }
    } catch (err) {
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
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
