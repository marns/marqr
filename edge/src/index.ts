export interface Env {
    redirects: D1Database;
    ASSETS?: Fetcher;
}

const slugLength = 8;
const maxSlugValue = BigInt(36) ** BigInt(slugLength);
const adminTokenBytes = 18; // ~24 chars when base64url encoded

function generateSlug() {
    // Generate 6 random bytes (48 bits), map to fixed-length base36 string.
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);

    let num = 0n;
    for (const byte of bytes) {
        num = (num << 8n) + BigInt(byte);
    }

    const slugValue = num % maxSlugValue;
    return slugValue.toString(36).padStart(slugLength, "0");
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

function generateAdminToken() {
    const bytes = new Uint8Array(adminTokenBytes);
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

export default {

    async createRedirect(env: Env, url: string, origin: string) {
        const maxAttempts = 4;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const slug = generateSlug();
            const token = generateAdminToken();

            try {
                await env.redirects.prepare("INSERT INTO redirects (slug, url, clicks, admin_secret) VALUES (?, ?, 0, ?)")
                    .bind(slug, url, token)
                    .run();

                console.log("Redirect created:", slug, url);

                const shortUrl = `${origin}/${slug}`;
                const manageUrl = `${origin}/?slug=${slug}&token=${token}`;

                return jsonResponse({
                    slug,
                    url,
                    shortUrl,
                    token,
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
    },

    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // Handle API requests
        if (request.method === "POST" && url.pathname === "/api/url") {
            const body = await request.json() as { url?: string };
            const targetUrl = body.url?.trim();
            if (!targetUrl) {
                return new Response("Missing URL", { status: 400 });
            }
            if (!isValidUrl(targetUrl)) {
                return new Response("Invalid URL", { status: 400 });
            }
            return this.createRedirect(env, targetUrl, url.origin);
        }

        if (request.method === "GET" && url.pathname.startsWith("/api/url/")) {
            const segments = url.pathname.split("/").filter(Boolean);
            const slug = segments[2];
            const adminToken = url.searchParams.get("token")
                ?? url.searchParams.get("ownerToken")
                ?? url.searchParams.get("adminToken");

            if (!slug) {
                return new Response("Missing slug", { status: 400 });
            }

            if (!adminToken) {
                return new Response("Missing admin token", { status: 401 });
            }

            const result = await env.redirects.prepare("SELECT slug, url, clicks, created_at, admin_secret FROM redirects WHERE slug = ?")
                .bind(slug)
                .first<{ slug: string; url: string; clicks: number; created_at: number; admin_secret: string }>();

            if (!result) {
                return new Response("Not found", { status: 404 });
            }

            if (result.admin_secret !== adminToken) {
                return new Response("Forbidden", { status: 403 });
            }

            const shortUrl = `${url.origin}/${result.slug}`;
            const manageUrl = `${url.origin}/?slug=${result.slug}&token=${adminToken}`;

            return jsonResponse({
                slug: result.slug,
                url: result.url,
                clicks: result.clicks,
                createdAt: result.created_at,
                token: adminToken,
                shortUrl,
                manageUrl,
            });
        }

        if (request.method === "PATCH" && url.pathname.startsWith("/api/url/")) {
            const segments = url.pathname.split("/").filter(Boolean);
            const slug = segments[2];
            if (!slug) {
                return new Response("Missing slug", { status: 400 });
            }

            const body = await request.json() as { url?: string; adminToken?: string; ownerToken?: string; token?: string };
            const token = body.token ?? body.ownerToken ?? body.adminToken;
            if (!token) {
                return new Response("Missing token", { status: 401 });
            }
            const targetUrl = body.url?.trim();
            if (!targetUrl || !isValidUrl(targetUrl)) {
                return new Response("Invalid URL", { status: 400 });
            }

            const result = await env.redirects.prepare(
                "UPDATE redirects SET url = ? WHERE slug = ? AND admin_secret = ?"
            )
                .bind(targetUrl, slug, token)
                .run();

            if (!result.success || result.meta.changes === 0) {
                return new Response("Forbidden or not found", { status: 403 });
            }

            const shortUrl = `${url.origin}/${slug}`;
            const manageUrl = `${url.origin}/?slug=${slug}&token=${token}`;
            const updated = await env.redirects.prepare(
                "SELECT clicks, created_at FROM redirects WHERE slug = ?"
            )
                .bind(slug)
                .first<{ clicks: number; created_at: number }>();

            return jsonResponse({
                slug,
                url: targetUrl,
                shortUrl,
                token,
                manageUrl,
                clicks: updated?.clicks ?? null,
                createdAt: updated?.created_at ?? null,
            });
        }

        const slug = url.pathname.slice(1); // Remove leading slash

        // If root or no slug, try to serve assets (frontend)
        if (!slug || slug === "") {
            return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
        }

        // Query for the redirect URL
        const stmt = env.redirects.prepare("SELECT url FROM redirects WHERE slug = ?").bind(slug);
        const result = await stmt.first<{ url: string }>();

        if (result) {
            // Async update click count
            ctx.waitUntil(
                env.redirects.prepare("UPDATE redirects SET clicks = clicks + 1 WHERE slug = ?")
                    .bind(slug)
                    .run()
            );

            return Response.redirect(result.url, 302);
        }

        // Fallback to assets if not a redirect (e.g. /assets/..., /favicon.ico)
        return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });
    },
};
