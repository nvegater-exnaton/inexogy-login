import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { email, password, oauthToken } = await request.json();

  const encodedPassword = encodeURIComponent(password);
  const encodedToken = encodeURIComponent(oauthToken);
  const encodedEmail = encodeURIComponent(email);

  const authorizeUrl = `https://api.inexogy.com/public/v1/oauth1/authorize?oauth_token=${encodedToken}&email=${encodedEmail}&password=${encodedPassword}&oauth_callback=oob`;

  const response = await fetch(authorizeUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
    },
    redirect: 'manual',
  });

  const responseBody = await response.text();

  return NextResponse.json({
    status: response.status,
    body: responseBody,
    location: response.headers.get('location'),
  });
}
