/**
 * Validates image URLs and rejects placeholder/fake URLs
 * Centralizes image URL validation to prevent flashing/broken images
 */

/**
 * Known fake/placeholder URL patterns that should be rejected as profile photos
 */
const INVALID_URL_PATTERNS = [
  'example.com',
  '/path/to/',
  'johndoe',
  'john-doe',
  'placeholder',
  'youtube.com/channel',
  'youtube.com/watch',
  'youtube.com/',
  '/images/default-profile',
  'nophoto_p_b.png',
  '/profile/photo/imageURL',
  'agent-finder-showcase-banner',
  'digitallibrary.zillowgroup.com',  // Generic Zillow banners, not profile photos
];

/**
 * Validates an image URL and returns a placeholder if invalid
 * @param url - The image URL to validate
 * @param fallback - The fallback URL to use (defaults to '/placeholder.svg')
 * @returns A valid image URL or the fallback
 */
export function getValidImageUrl(url: string | null | undefined, fallback: string = '/placeholder.svg'): string {
  if (!url) return fallback;
  
  const lowerUrl = url.toLowerCase();
  
  // Reject known fake/placeholder patterns
  if (INVALID_URL_PATTERNS.some(pattern => lowerUrl.includes(pattern))) {
    return fallback;
  }
  
  // Must be a valid absolute URL (http/https) or start with /
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
    return fallback;
  }
  
  return url;
}

/**
 * Checks if a URL is a valid image URL (without returning fallback)
 * @param url - The URL to check
 * @returns true if valid, false otherwise
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  
  // Check for invalid patterns
  if (INVALID_URL_PATTERNS.some(pattern => lowerUrl.includes(pattern))) {
    return false;
  }
  
  // Must be a valid absolute URL (http/https) or start with /
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
    return false;
  }
  
  return true;
}
