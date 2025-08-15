import { type NextRequest, NextResponse } from 'next/server';

interface OAuthResponse {
  status: number;
  body: { oauthVerifier: string };
  location?: string;
  headers: Record<string, string>;
}

interface OAuthErrorResponse {
  error: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper function to encode password with special character handling
const encodePassword = (userPassword: string): string => {
  return encodeURIComponent(userPassword).replace(/\*/g, '%2A');
};

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

export async function GET(
  request: NextRequest
): Promise<NextResponse<OAuthResponse | OAuthErrorResponse>> {
  const { searchParams } = new URL(request.url);
  const oauthToken = searchParams.get('oauth_token');
  const email = searchParams.get('email');
  const password = searchParams.get('password');

  if (!(oauthToken && email && password)) {
    return NextResponse.json(
      {
        error: 'Missing required parameters: oauth_token, email, and password',
      },
      { status: 400 }
    );
  }

  // Validate email format
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: 'Invalid email format' },
      { status: 400 }
    );
  }

  const authorizeUrl = buildAuthorizeUrl(email, password, oauthToken);

  try {
    const response = await fetch(authorizeUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
      },
      redirect: 'manual',
    });

    const oauthVerifier = extractOAuthVerifier(
      response,
      await response.text(),
      authorizeUrl
    );

    if (!oauthVerifier) {
      return NextResponse.json(
        {
          error:
            'Could not extract OAuth verifier - invalid credentials or authorization failed',
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      status: response.status,
      body: { oauthVerifier },
      location: response.headers.get('location') || undefined,
      headers: Object.fromEntries(response.headers.entries()),
    });
  } catch (_error) {
    return NextResponse.json({ error: 'API request failed' }, { status: 500 });
  }
}
