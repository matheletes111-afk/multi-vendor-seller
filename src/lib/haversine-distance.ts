/**
 * Haversine Distance Formula Utilities
 * Calculates the great-circle distance between two points on the Earth's surface.
 */

export interface GeoCoordinate {
  latitude: number
  longitude: number
}

/**
 * Calculates distance in kilometers between two coordinates using the Haversine formula.
 */
export function calculateHaversineDistance(
  coord1: GeoCoordinate,
  coord2: GeoCoordinate
): number {
  const R = 6371 // Earth's radius in kilometers

  const dLat = toRadians(coord2.latitude - coord1.latitude)
  const dLon = toRadians(coord2.longitude - coord1.longitude)

  const lat1 = toRadians(coord1.latitude)
  const lat2 = toRadians(coord2.latitude)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return Math.round(distance * 100) / 100 // 2 decimal places
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Sorts an array of items with latitude/longitude by proximity to a target coordinate.
 */
export function sortByProximity<T extends { currentLatitude: number | null; currentLongitude: number | null }>(
  target: GeoCoordinate,
  items: T[]
): Array<T & { distanceKm: number }> {
  return items
    .filter((item) => item.currentLatitude != null && item.currentLongitude != null)
    .map((item) => {
      const distance = calculateHaversineDistance(target, {
        latitude: item.currentLatitude!,
        longitude: item.currentLongitude!,
      })
      return {
        ...item,
        distanceKm: distance,
      }
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
}
