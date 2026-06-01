const ALLOWED_PROVIDERS = new Set(["google", "facebook", "linkedin_oidc"]);

const friendlyProviderError = (data) => {
  const message = data?.msg || data?.message || data?.error_description || data?.error;

  if (/provider.*not.*enabled|unsupported provider/i.test(String(message))) {
    return "This platform login is not enabled in Supabase yet. Enable the provider in Supabase Authentication > Providers, add its client ID/secret, then try Verify Owner again.";
  }

  return message || "Could not start platform verification.";
};

const isSameOriginRedirect = (request, value) => {
  try {
    const target = new URL(value);
    const source = new URL(request.url);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || source.protocol.replace(":", "");
    const expectedOrigin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : source.origin;

    return target.origin === expectedOrigin;
  } catch {
    return false;
  }
};

export async function POST(request) {
  try {
    const { provider, redirectTo, scopes, queryParams } = await request.json();
    const platformProvider = String(provider || "").trim();

    if (!ALLOWED_PROVIDERS.has(platformProvider)) {
      return Response.json({ error: "Unsupported OAuth provider." }, { status: 400 });
    }

    if (!redirectTo || !isSameOriginRedirect(request, redirectTo)) {
      return Response.json({ error: "Invalid OAuth redirect URL." }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return Response.json({ error: "Supabase URL is not configured." }, { status: 500 });
    }

    const authorizeUrl = new URL(
      "/auth/v1/authorize",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
    authorizeUrl.searchParams.set("provider", platformProvider);
    authorizeUrl.searchParams.set("redirect_to", redirectTo);
    if (scopes) authorizeUrl.searchParams.set("scopes", String(scopes));

    if (queryParams && typeof queryParams === "object") {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          authorizeUrl.searchParams.set(key, String(value));
        }
      });
    }

    const response = await fetch(authorizeUrl, {
      method: "GET",
      redirect: "manual",
    });

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      return Response.json({ redirectUrl: authorizeUrl.toString() });
    }

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    return Response.json(
      {
        error: friendlyProviderError(data),
        details: data,
      },
      { status: response.status || 400 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not start OAuth." },
      { status: 400 },
    );
  }
}
