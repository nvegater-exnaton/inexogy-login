/** biome-ignore-all lint/suspicious/noEvolvingTypes: <explanation> */
/** biome-ignore-all lint/suspicious/noConsole: <explanation> */
/** biome-ignore-all lint/style/useBlockStatements: <explanation> */
import { type NextRequest, NextResponse } from 'next/server';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    console.log(`[${requestId}] Incoming authorization request`);

    let body: { email?: string; password?: string; oauthToken?: string };
    try {
      body = await request.json();
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse request body:`, {
        error:
          parseError instanceof Error ? parseError.message : String(parseError),
        stack: parseError instanceof Error ? parseError.stack : undefined,
      });
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: 'Failed to parse JSON',
          requestId,
        },
        { status: 400 }
      );
    }

    const { email, password, oauthToken } = body;

    // Validate required fields
    if (!(email && password && oauthToken)) {
      const missing = [];
      if (!email) missing.push('email');
      if (!password) missing.push('password');
      if (!oauthToken) missing.push('oauthToken');

      console.error(`[${requestId}] Missing required fields:`, missing);
      return NextResponse.json(
        {
          error: 'Missing required fields',
          missing,
          requestId,
        },
        { status: 400 }
      );
    }

    // Log request details (sanitized)
    console.log(`[${requestId}] Authorization request details:`, {
      email,
      hasPassword: !!password,
      passwordLength: password.length,
      oauthToken,
    });

    // Build authorization URL
    const encodedPassword = encodeURIComponent(password).replace(/\*/g, '%2A');
    const encodedToken = encodeURIComponent(oauthToken);
    const encodedEmail = encodeURIComponent(email);

    const authorizeUrl = `https://api.inexogy.com/public/v1/oauth1/authorize?oauth_token=${encodedToken}&email=${encodedEmail}&password=${encodedPassword}&oauth_callback=oob`;

    console.log(`[${requestId}] Calling Inexogy API:`, {
      url: authorizeUrl,
      method: 'GET',
    });

    // Make the authorization request
    let response: Response;
    try {
      response = await fetch(authorizeUrl, {
        method: 'GET',
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
        },
        redirect: 'manual',
      });
    } catch (fetchError) {
      console.error(`[${requestId}] Network error calling Inexogy API:`, {
        error:
          fetchError instanceof Error ? fetchError.message : String(fetchError),
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
        cause: fetchError instanceof Error ? fetchError.cause : undefined,
      });
      return NextResponse.json(
        {
          error: 'Network error',
          details: 'Failed to connect to Inexogy API',
          message:
            fetchError instanceof Error
              ? fetchError.message
              : String(fetchError),
          requestId,
        },
        { status: 502 }
      );
    }

    // Parse response body
    let responseBody: string;
    try {
      responseBody = await response.text();
    } catch (textError) {
      console.error(`[${requestId}] Failed to read response body:`, {
        error:
          textError instanceof Error ? textError.message : String(textError),
        stack: textError instanceof Error ? textError.stack : undefined,
        status: response.status,
        statusText: response.statusText,
      });
      return NextResponse.json(
        {
          error: 'Failed to read response',
          details: 'Could not parse response body from Inexogy API',
          requestId,
        },
        { status: 502 }
      );
    }

    // Log response details
    const location = response.headers.get('location');
    console.log(`[${requestId}] Inexogy API response:`, {
      status: response.status,
      statusText: response.statusText,
      hasLocation: !!location,
      location: location || undefined,
      bodyLength: responseBody.length,
      bodyPreview: responseBody.substring(0, 200),
      headers: {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        location: response.headers.get('location'),
      },
    });

    // Check for error responses
    if (response.status >= 400) {
      console.error(`[${requestId}] Inexogy API returned error status:`, {
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
        location,
      });

      // Return error but include response details for client debugging
      return NextResponse.json(
        {
          error: 'Authorization failed',
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
          location,
          requestId,
        },
        { status: response.status }
      );
    }

    // Success response
    console.log(`[${requestId}] Authorization successful`);
    return NextResponse.json({
      status: response.status,
      body: responseBody,
      location,
      requestId,
    });
  } catch (error) {
    // Catch any unexpected errors
    console.error(`[${requestId}] Unexpected error in authorization route:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      cause: error instanceof Error ? error.cause : undefined,
    });

    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        requestId,
      },
      { status: 500 }
    );
  }
}
