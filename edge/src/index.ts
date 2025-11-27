export interface Env {
    redirects: D1Database;
    ASSETS?: Fetcher;
    BASE_URL?: string;
}

const slugLength = 6;
const base62Chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const maxSlugValue = BigInt(62) ** BigInt(slugLength);
const secretBytes = 18; // ~24 chars when base64url encoded

function generateSlug() {
    // Generate 6 random bytes (48 bits), map to fixed-length base62 string.
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);

    let num = 0n;
    for (const byte of bytes) {
        num = (num << 8n) + BigInt(byte);
    }

    let slugValue = num % maxSlugValue;
    let result = "";
    for (let i = 0; i < slugLength; i++) {
        result = base62Chars[Number(slugValue % 62n)] + result;
        slugValue = slugValue / 62n;
    }
    return result;
}

function isUniqueConstraintError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("UNIQUE constraint failed") || message.includes("SQLITE_CONSTRAINT");
}

function toBase64Url(bytes: Uint8Array) {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    // btoa is available in workers
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateSecret() {
    const bytes = new Uint8Array(secretBytes);
    crypto.getRandomValues(bytes);
    return toBase64Url(bytes);
}

function isValidUrl(input: string) {
    try {
        const parsed = new URL(input);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (e) {
        console.warn("Invalid URL provided", e);
        return false;
    }
}

function jsonResponse(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function getOrigin(env: Env, requestOrigin: string) {
    return env.BASE_URL || requestOrigin;
}

async function handleCreateRedirect(env: Env, request: Request, url: URL) {
    const body = await request.json() as { url?: string };
    const targetUrl = body.url?.trim();

    if (!targetUrl) {
        return new Response("Missing URL", { status: 400 });
    }
    if (!isValidUrl(targetUrl)) {
        return new Response("Invalid URL", { status: 400 });
    }

    const maxAttempts = 4;
    const origin = getOrigin(env, url.origin);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const slug = generateSlug();
        const secret = generateSecret();

        try {
            await env.redirects.prepare("INSERT INTO redirects (slug, url, clicks, secret) VALUES (?, ?, 0, ?)")
                .bind(slug, targetUrl, secret)
                .run();

            console.log("Redirect created:", slug, targetUrl);

            const shortUrl = `${origin}/${slug}`;
            const manageUrl = `${origin}/?slug=${slug}&secret=${secret}`;

            return jsonResponse({
                slug,
                url: targetUrl,
                shortUrl,
                secret,
                manageUrl,
                clicks: 0,
            });
        } catch (e) {
            if (isUniqueConstraintError(e) && attempt < maxAttempts - 1) {
                console.warn("Slug collision, retrying:", slug);
                continue;
            }

            console.error("Error creating redirect:", e);
            return new Response("Error creating redirect", { status: 500 });
        }
    }

    return new Response("Error creating redirect", { status: 500 });
}

async function handleGetRedirect(env: Env, url: URL) {
    const segments = url.pathname.split("/").filter(Boolean);
    const slug = segments[2];
    const secret = url.searchParams.get("secret")
        ?? url.searchParams.get("token")
        ?? url.searchParams.get("ownerToken")
        ?? url.searchParams.get("adminToken");

    if (!slug) {
        return new Response("Missing slug", { status: 400 });
    }

    if (!secret) {
        return new Response("Missing secret", { status: 401 });
    }

    const result = await env.redirects.prepare("SELECT slug, url, clicks, created_at, secret FROM redirects WHERE slug = ?")
        .bind(slug)
        .first<{ slug: string; url: string; clicks: number; created_at: number; secret: string }>();

    if (!result) {
        return new Response("Not found", { status: 404 });
    }

    if (result.secret !== secret) {
        return new Response("Forbidden", { status: 403 });
    }

    const origin = getOrigin(env, url.origin);
    const shortUrl = `${origin}/${result.slug}`;
    const manageUrl = `${origin}/?slug=${result.slug}&secret=${secret}`;

    return jsonResponse({
        slug: result.slug,
        url: result.url,
        clicks: result.clicks,
        createdAt: result.created_at,
        secret,
        shortUrl,
        manageUrl,
    });
}

async function handleUpdateRedirect(env: Env, request: Request, url: URL) {
    const segments = url.pathname.split("/").filter(Boolean);
    const slug = segments[2];

    if (!slug) {
        return new Response("Missing slug", { status: 400 });
    }

    const body = await request.json() as { url?: string; secret?: string; token?: string; adminToken?: string; ownerToken?: string };
    const secret = body.secret ?? body.token ?? body.ownerToken ?? body.adminToken;

    if (!secret) {
        return new Response("Missing secret", { status: 401 });
    }

    const targetUrl = body.url?.trim();
    if (!targetUrl || !isValidUrl(targetUrl)) {
        return new Response("Invalid URL", { status: 400 });
    }

    const result = await env.redirects.prepare(
        "UPDATE redirects SET url = ? WHERE slug = ? AND secret = ?"
    )
        .bind(targetUrl, slug, secret)
        .run();

    if (!result.success || result.meta.changes === 0) {
        return new Response("Forbidden or not found", { status: 403 });
    }

    const origin = getOrigin(env, url.origin);
    const shortUrl = `${origin}/${slug}`;
    const manageUrl = `${origin}/?slug=${slug}&secret=${secret}`;
    const updated = await env.redirects.prepare(
        "SELECT clicks, created_at FROM redirects WHERE slug = ?"
    )
        .bind(slug)
        .first<{ clicks: number; created_at: number }>();

    return jsonResponse({
        slug,
        url: targetUrl,
        shortUrl,
        secret,
        manageUrl,
        clicks: updated?.clicks ?? null,
        createdAt: updated?.created_at ?? null,
    });
}

function handleRedirect(env: Env, ctx: ExecutionContext, slug: string) {
    return async () => {
        console.log("Redirect requested for slug:", slug);

        const result = await env.redirects.prepare("SELECT url FROM redirects WHERE slug = ?")
            .bind(slug)
            .first<{ url: string }>();

        if (!result) {
            return new Response("Not found", { status: 404 });
        }

        // Async update click count
        ctx.waitUntil(
            env.redirects.prepare("UPDATE redirects SET clicks = clicks + 1 WHERE slug = ?")
                .bind(slug)
                .run()
        );

        return Response.redirect(result.url, 302);
    };
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // API routes
        if (url.pathname === "/api/url" && request.method === "POST") {
            return handleCreateRedirect(env, request, url);
        }

        if (url.pathname.startsWith("/api/url/")) {
            if (request.method === "GET") {
                return handleGetRedirect(env, url);
            }
            if (request.method === "PATCH") {
                return handleUpdateRedirect(env, request, url);
            }
        }

        // Redirect lookup for 6-char slugs
        const slug = url.pathname.slice(1);
        if (slug.length === slugLength) {
            return handleRedirect(env, ctx, slug)();
        }

        // Serve frontend assets
        return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
    },
};
