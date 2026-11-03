import type { NextRequest } from "next/server";

export const runtime = "nodejs";

type GaiaStar = {
  sourceId: string;
  ra: number;
  dec: number;
  magnitude: number | null;
  parallax: number | null;
};

function parseIpacTable(body: string): GaiaStar[] {
  const lines = body.split(/\r?\n/);
  const headerLine = lines.find((line) => /^\|\s*source_id\s*\|/i.test(line));
  if (!headerLine) throw new Error("The Gaia catalog returned an unreadable table.");
  const columns = headerLine.split("|").slice(1, -1).map((column) => column.trim().toLowerCase());
  const index = (name: string) => columns.indexOf(name);
  const sourceIndex = index("source_id");
  const raIndex = index("ra");
  const decIndex = index("dec");
  const magIndex = index("phot_g_mean_mag");
  const parallaxIndex = index("parallax");
  if (sourceIndex < 0 || raIndex < 0 || decIndex < 0) throw new Error("The Gaia catalog response is missing coordinate columns.");

  const stars: GaiaStar[] = [];
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    const ra = Number(cells[raIndex]);
    const dec = Number(cells[decIndex]);
    if (!cells[sourceIndex] || !Number.isFinite(ra) || !Number.isFinite(dec)) continue;
    const magnitude = Number(cells[magIndex]);
    const parallax = Number(cells[parallaxIndex]);
    stars.push({
      sourceId: cells[sourceIndex],
      ra,
      dec,
      magnitude: Number.isFinite(magnitude) ? magnitude : null,
      parallax: Number.isFinite(parallax) ? parallax : null,
    });
  }
  return stars;
}

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const ra = Number(params.get("ra"));
  const dec = Number(params.get("dec"));
  const size = Number(params.get("size"));
  if (!Number.isFinite(ra) || ra < 0 || ra > 360 || !Number.isFinite(dec) || dec < -90 || dec > 90 || !Number.isFinite(size) || size <= 0 || size > 2) {
    return Response.json({ success: false, error: "Enter valid sky coordinates and image size." }, { status: 400 });
  }

  const radiusArcmin = Math.max(0.5, Math.min(60, size * 30));
  const query = new URLSearchParams({
    catalog: "gaia_dr3_source",
    spatial: "cone",
    objstr: `${ra} ${dec}`,
    radius: String(radiusArcmin),
    radunits: "arcmin",
    outfmt: "1",
    selcols: "source_id,ra,dec,phot_g_mean_mag,parallax",
    constraints: "phot_g_mean_mag<16",
    outrows: "100",
    order: "phot_g_mean_mag",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40_000);
  try {
    const upstream = await fetch(`https://irsa.ipac.caltech.edu/cgi-bin/Gator/nph-query?${query}`, {
      signal: controller.signal,
      headers: { Accept: "text/plain" },
      cache: "no-store",
    });
    const body = await upstream.text();
    if (!upstream.ok) throw new Error(`IRSA catalog replied with status ${upstream.status}.`);
    if (/\bERROR\b|\bQUERY ERROR\b/i.test(body.slice(0, 1200))) throw new Error("IRSA could not complete this Gaia catalog query.");
    return Response.json({ success: true, stars: parseIpacTable(body), catalog: "Gaia DR3", center: { ra, dec }, radiusArcmin });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The star catalog took too long to respond. Try again."
      : error instanceof Error ? error.message : "The star catalog could not be reached.";
    return Response.json({ success: false, error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
