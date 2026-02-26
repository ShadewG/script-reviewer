const BASE = "https://www.courtlistener.com/api/rest/v4";

async function clFetch(path: string, params: Record<string, string>) {
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.COURTLISTENER_API_KEY) {
    headers.Authorization = `Token ${process.env.COURTLISTENER_API_KEY}`;
  }
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) return null;
  return res.json();
}

export async function searchOpinions(query: string, court?: string) {
  const params: Record<string, string> = { q: query, type: "o" };
  if (court) params.court = court;
  return clFetch("/search/", params);
}

export async function searchDockets(query: string, court?: string) {
  const params: Record<string, string> = { q: query, type: "r" };
  if (court) params.court = court;
  return clFetch("/search/", params);
}
