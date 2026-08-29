/**
 * Resolve which LAN URL should drive the host QR.
 * Selection is kept only while the server is running and the URL is still listed.
 */
export function nextPrimaryUrl(
  urls: string[],
  selected: string | null,
  serverRunning: boolean
): string | null {
  if (!serverRunning) return null
  if (selected !== null && urls.includes(selected)) return selected
  return urls[0] ?? null
}
