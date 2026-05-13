import zipData from "./data/zip-coords.json";
import { resolveZip } from "./zip-to-state";

type Tuple = [number, number, string];

const TABLE = zipData as unknown as Record<string, Tuple>;

export type ZipCoords = {
  zip: string;
  state: string;
  lat: number;
  lng: number;
  source: "zip" | "state-centroid";
};

export function getZipCoords(rawZip: string | null | undefined): ZipCoords | null {
  if (!rawZip) return null;
  const zip = String(rawZip).trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip)) return null;
  const hit = TABLE[zip];
  if (hit) {
    return { zip, lat: hit[0], lng: hit[1], state: hit[2], source: "zip" };
  }
  const fallback = resolveZip(zip);
  if (!fallback) return null;
  return {
    zip,
    lat: fallback.lat,
    lng: fallback.lng,
    state: fallback.state,
    source: "state-centroid",
  };
}
