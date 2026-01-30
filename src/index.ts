export interface Env {
  DB: D1Database;
  AI: any;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Serve the static homepage from /public via Assets (handled by Wrangler),
    // but we still need to handle our API routes here.

    if (url.pathname === "/analyze" && request.method === "POST") {
      try {
        const body = (await request.json()) as { text?: string; source?: string };
        const text = (body.text ?? "").trim();
        const source = (body.source ?? "web").trim();

        if (!text) {
          return Response.json({ error: "Missing 'text'." }, { status: 400 });
        }

        // Simple AI call example (Cloudflare AI binding)
        // You can change the model later.
        const aiResp = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            { role: "system", content: "You summarize user feedback in 1-2 sentences." },
            { role: "user", content: text }
          ]
        });

        const summary =
          aiResp?.response ??
          aiResp?.result ??
          aiResp?.output_text ??
          JSON.stringify(aiResp);

        const created_at = new Date().toISOString();

        // Store in D1
        await env.DB.prepare(
          `INSERT INTO feedback (source, text, created_at, ai_summary, ai_sentiment, ai_themes)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
          .bind(source, text, created_at, String(summary), null, null)
          .run();

        return Response.json({ summary: String(summary) });
      } catch (err: any) {
        return Response.json(
          { error: "Analyze failed", details: String(err?.message ?? err) },
          { status: 500 }
        );
      }
    }

    // If you go to / it will be served by Assets automatically.
    // Anything else:
    return new Response("Not found", { status: 404 });
  }
};