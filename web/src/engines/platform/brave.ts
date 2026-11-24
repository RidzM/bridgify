/** Brave exposes SpeechRecognition but its service always fails with a "network" error. */
export async function isBrave(): Promise<boolean> {
  const nav = navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }
  try { return Boolean(await nav.brave?.isBrave?.()) } catch { return false }
}
