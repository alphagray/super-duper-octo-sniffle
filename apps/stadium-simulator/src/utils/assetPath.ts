/**
 * Asset Path Utility
 *
 * Resolves asset paths based on the Vite base configuration.
 * This ensures assets load correctly across all deployment targets:
 * - Vercel: base = '/'
 * - GitHub Pages: base = '/stadium-simulator/'
 * - itch.io: base = './'
 */

/**
 * Get the full path to an asset based on the current base URL
 *
 * @param path - Relative path from public directory (e.g., 'assets/file.json')
 * @returns Full path including base URL
 *
 * @example
 * // On Vercel (base = '/')
 * getAssetPath('assets/file.json') // => '/assets/file.json'
 *
 * // On GitHub Pages (base = '/stadium-simulator/')
 * getAssetPath('assets/file.json') // => '/stadium-simulator/assets/file.json'
 *
 * // On itch.io (base = './')
 * getAssetPath('assets/file.json') // => './assets/file.json'
 */
export function getAssetPath(path: string): string {
  const baseUrl = import.meta.env.BASE_URL;

  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Ensure base URL ends with / and construct full path
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  return `${base}${cleanPath}`;
}
