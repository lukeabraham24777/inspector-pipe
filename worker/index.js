// Cloudflare Worker: serves the Vite frontend (frontend/dist) and passes /api/* to the FastAPI backend on Render, so
// the app keeps calling a same-origin /api as it did on Vercel. The backend is a free Render service that sleeps when
// idle: the first request after a quiet spell waits ~30–60s while it starts.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
    const init = { method: request.method, headers, redirect: "manual" };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;
    try {
      return await fetch(new URL(url.pathname + url.search, env.API_ORIGIN), init);
    } catch (e) {
      return Response.json({ detail: `The analysis server didn't answer (${e.message}). It may be waking up; try again in a minute.` }, { status: 502 });
    }
  },
};
