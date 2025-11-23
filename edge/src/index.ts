export interface Env {
    redirects: D1Database;
    ASSETS: Fetcher;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // Handle API requests
        if (request.method === "POST" && url.pathname === "/api/url") {
            try {
                const body = await request.json() as { url?: string };
                if (!body.url) {
                    return new Response("Missing URL", { status: 400 });
                }

                // Generate a random slug (6 chars)
                const slug = Math.random().toString(36).substring(2, 8);

                // Insert into D1
                await env.redirects.prepare("INSERT INTO redirects (slug, url, clicks) VALUES (?, ?, 0)")
                    .bind(slug, body.url)
                    .run();

                return new Response(JSON.stringify({ slug, url: body.url }), {
                    headers: { "Content-Type": "application/json" }
                });
            } catch (e) {
                return new Response("Error creating redirect", { status: 500 });
            }
        }

        const slug = url.pathname.slice(1); // Remove leading slash

        // If root or no slug, try to serve assets (frontend)
        if (!slug || slug === "") {
            return env.ASSETS.fetch(request);
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
        return env.ASSETS.fetch(request);
    },
};
