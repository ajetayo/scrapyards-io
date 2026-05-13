export function metersBetween(
  a: { lat: string | number | null; lng: string | number | null },
  b: { lat: string | number | null; lng: string | number | null },
): number {
  const R = 6371000;
  const lat1 = Number(a.lat) * (Math.PI / 180);
  const lat2 = Number(b.lat) * (Math.PI / 180);
  const dLat = lat2 - lat1;
  const dLng = (Number(b.lng) - Number(a.lng)) * (Math.PI / 180);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
