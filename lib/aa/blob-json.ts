import { BlobNotFoundError, get, put } from "@vercel/blob"

/** Returns null for a missing blob, which is a normal state, not an error. */
export async function readJsonBlob(pathname: string): Promise<unknown | null> {
  try {
    const result = await get(pathname, { access: "private" })
    if (!result) return null
    const text = await new Response(result.stream).text()
    return JSON.parse(text) as unknown
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null
    console.error("Failed to read blob:", pathname, error)
    return null
  }
}

export async function writeJsonBlob(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}
