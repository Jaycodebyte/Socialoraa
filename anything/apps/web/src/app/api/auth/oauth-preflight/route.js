const isSupabaseAuthUrl = (value) => {
  try {
    const url = new URL(value);
    const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
      : null;

    return (
      configuredUrl &&
      url.origin === configuredUrl.origin &&
      url.pathname.startsWith("/auth/v1/authorize")
    );
  } catch {
    return false;
  }
};

const friendlyProviderError = (data) => {
  const message = data?.msg || data?.message || data?.error_description || data?.error;

  if (/provider.*not.*enabled|unsupported provider/i.test(String(message))) {
    return "This platform login is not enabled in Supabase yet. Enable the provider in Supabase Authentication > Providers, add its client ID/secret, then try Verify Owner again.";
  }

  return message || "Could not start platform verification.";
};

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!isSupabaseAuthUrl(url)) {
      return Response.json({ error: "Invalid OAuth verification URL." }, { status: 400 });
    }

    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      return Response.json({ ok: true });
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
      { error: error instanceof Error ? error.message : "Could not check OAuth provider." },
      { status: 400 },
    );
  }
}
