import { NextRequest, NextResponse } from "next/server";

function apiBaseURL() {
  return process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";
}

function escapeScriptJSON(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function redirectHTML(target: string, payload?: unknown) {
  const storePayload = payload
    ? `sessionStorage.setItem("google_auth_result", ${escapeScriptJSON(JSON.stringify(payload))});`
    : "";

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>Memproses Login Google</title>
  </head>
  <body>
    <script>
      ${storePayload}
      window.location.replace(${escapeScriptJSON(target)});
    </script>
  </body>
</html>`;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const credential = formData.get("credential");
  const mode = request.nextUrl.searchParams.get("mode") === "register" ? "register" : "login";

  if (typeof credential !== "string" || !credential) {
    return new NextResponse(redirectHTML(`/${mode}?google_error=missing_credential`), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const response = await fetch(`${apiBaseURL()}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));
    const data = body.data || body;

    if (!response.ok || !data?.access_token || !data?.user) {
      return new NextResponse(redirectHTML(`/${mode}?google_error=auth_failed`), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const nextResponse = new NextResponse(redirectHTML("/auth/google/complete", data), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) nextResponse.headers.set("set-cookie", setCookie);

    return nextResponse;
  } catch {
    return new NextResponse(redirectHTML(`/${mode}?google_error=service_unavailable`), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
