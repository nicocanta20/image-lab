import { generateText } from "ai"

function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    return { mimeType: match[1], base64: match[2] }
  }
  return { mimeType: "image/png", base64: dataUrl }
}

type Reference = {
  referenceNumber: number
  name: string
  pinCount: number // How many pins placed for this reference
}

export async function POST(req: Request) {
  const { imageWithMarkers, references } = (await req.json()) as {
    imageWithMarkers: string // Room image with numbered pins drawn on it
    references: Reference[] // What each reference number represents + how many pins
  }

  if (!imageWithMarkers) {
    return Response.json({ success: false, error: "No image provided" }, { status: 400 })
  }

  if (!references || references.length === 0) {
    return Response.json({ success: false, error: "No references provided" }, { status: 400 })
  }

  // Build reference list with quantities
  const refList = references
    .map(r => {
      if (r.pinCount > 1) {
        return `[${r.referenceNumber}] = ${r.pinCount}x ${r.name} (${r.pinCount} pins visible)`
      }
      return `[${r.referenceNumber}] = ${r.name}`
    })
    .join(", ")

  const prompt = `Look at this room image VERY CAREFULLY. There are numbered terracotta/orange circles marking EXACT positions where furniture should be placed.

ITEMS TO PLACE: ${refList}

YOUR TASK:
1. Find each numbered circle in the image - look carefully, they are terracotta/orange colored with white numbers
2. Describe the PRECISE location of each circle using spatial references (left/right/center, front/back, near specific objects)
3. Be EXACT about where the dot is - not approximately, but exactly where it appears in the image

DESCRIBE ONLY WHERE THE DOT IS - not where furniture "should" go or how it should be oriented.

EXAMPLES OF PRECISE DESCRIPTIONS:
- "The [1] marker is on the floor to the left of the grey sofa, between the sofa and the window."
- "The [2] marker is in the back-right corner of the room, next to the potted plant."
- "There are two [1] markers: one on the left side of the coffee table, one on the right side."

Be extremely precise. The placement description will be used to guide image generation.`

  console.log("=== DESCRIBE-PLACEMENTS INPUT ===")
  console.log("References:", refList)
  console.log("=================================")

  try {
    const { base64, mimeType } = parseDataUrl(imageWithMarkers)

    const result = await generateText({
      model: "google/gemini-3-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: base64, mimeType },
          ],
        },
      ],
    })

    const description = result.text.trim().replace(/^["']|["']$/g, "") // Remove quotes if wrapped

    console.log("=== DESCRIBE-PLACEMENTS OUTPUT ===")
    console.log(description)
    console.log("==================================")

    return Response.json({
      success: true,
      description,
    })
  } catch (error) {
    console.error("Describe-placements error:", error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
