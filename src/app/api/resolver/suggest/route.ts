import type { NextRequest } from "next/server";
import { FEATURED_TARGETS } from "@/lib/featured-targets";

const knownNames = [
  ...FEATURED_TARGETS.map((target) => target.name),
  "Andromeda Galaxy (M31)", "Orion Nebula (M42)", "Crab Nebula (M1)",
  "Horsehead Nebula", "Pleiades (M45)", "Sombrero Galaxy (M104)",
  "Whirlpool Galaxy (M51)", "Ring Nebula (M57)", "Eagle Nebula (M16)",
  "Carina Nebula", "Lagoon Nebula (M8)", "Omega Centauri", "Betelgeuse",
  "Sirius", "Polaris", "Vega", "Proxima Centauri", "Jupiter", "Saturn",
  "Mars", "Venus", "Moon", "Sun", "Sagittarius A*",
];

function distance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return previous[b.length];
}

export async function GET(request: NextRequest): Promise<Response> {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ objects: [], articles: [] });
  const normalized = query.toLowerCase().replace(/[^a-z0-9*]+/g, " ").trim();
  const words = normalized.split(/\s+/);
  const objects = knownNames
    .map((name) => {
      const candidate = name.toLowerCase().replace(/[^a-z0-9*]+/g, " ").trim();
      const candidateWords = candidate.split(/\s+/);
      const score = candidate === normalized ? 0
        : candidate.startsWith(normalized) || normalized.startsWith(candidate) ? 1
        : candidateWords.some((word) => words.some((input) => word.includes(input) || input.includes(word))) ? 2
        : Math.min(distance(normalized, candidate), ...candidateWords.map((word) => distance(normalized, word))) + 3;
      return { name, score };
    })
    .filter((item) => item.score <= Math.max(4, Math.ceil(normalized.length * 0.45)))
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map(({ name }) => ({ name }));

  if (request.nextUrl.searchParams.get("kind") !== "articles") {
    return Response.json({ objects });
  }

  let articles: { title: string; description: string; url: string; image?: string }[] = [];
  try {
    const params = new URLSearchParams({ q: `${query} astronomy`, media_type: "image", page_size: "4" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(`https://images-api.nasa.gov/search?${params}`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (response.ok) {
      const payload = await response.json();
      articles = (payload.collection?.items ?? []).slice(0, 4).map((item: { data?: Array<{ title?: string; description?: string; nasa_id?: string }>; links?: Array<{ href?: string }> }) => ({
        title: item.data?.[0]?.title ?? "NASA image",
        description: item.data?.[0]?.description ?? "NASA image library result",
        url: `https://images.nasa.gov/details/${encodeURIComponent(item.data?.[0]?.nasa_id ?? "")}`,
        image: item.links?.[0]?.href,
      }));
    }
  } catch {
    // Object suggestions remain available if the NASA media search is offline.
  }
  return Response.json({ objects, articles });
}
