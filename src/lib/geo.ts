/** Great-circle distance in km (haversine). Runs in the browser: the user's position never leaves it. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m away` : km < 10 ? `${km.toFixed(1)} km away` : `${Math.round(km)} km away`);
