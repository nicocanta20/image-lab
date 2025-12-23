import { generateText } from "ai"

type ImageData = {
  role: "base" | "reference"
  data: string
  name?: string
  referenceNumber?: number
  quantity?: number // How many copies to add (from pin count)
}

function parseDataUrl(dataUrl: string): { base64: string; mediaType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    return { mediaType: match[1], base64: match[2] }
  }
  return { mediaType: "image/png", base64: dataUrl }
}

export async function POST(req: Request) {
  const {
    baseImage,
    references,
    placementDescription,
    prompt,
    settings,
    baseWidth,
    baseHeight,
  } = (await req.json()) as {
    baseImage: ImageData
    references: ImageData[]
    placementDescription?: string // Natural language description from LLM
    prompt: string
    settings: { style: string; lighting: string }
    baseWidth: number
    baseHeight: number
  }

  if (!baseImage?.data) {
    return Response.json({ success: false, error: "No base image provided" }, { status: 400 })
  }

  if (!references?.length) {
    return Response.json({ success: false, error: "No reference images provided" }, { status: 400 })
  }

  const model = "google/gemini-3-pro-image"

  const styleDescriptions: Record<string, string> = {
    photorealistic: "highly photorealistic with accurate textures and materials",
    modern: "sleek modern aesthetic with clean lines and contemporary design",
    minimalist: "minimalist style with simple forms and uncluttered spaces",
    cozy: "warm and cozy atmosphere with inviting textures",
    industrial: "industrial style with exposed materials and raw finishes",
  }

  const styleDesc = styleDescriptions[settings?.style] || styleDescriptions.photorealistic
  const roomDescription = baseImage.name || "room"

  // List items being added (with quantities if multiple)
  const itemList = references
    .sort((a, b) => (a.referenceNumber || 0) - (b.referenceNumber || 0))
    .map(ref => {
      const qty = ref.quantity || 1
      const name = ref.name || "Object"
      return qty > 1 ? `- ${qty}x ${name}` : `- ${name}`
    })
    .join("\n")

  // Use LLM-generated placement description, or fall back to generic instruction
  const placementInstructions = placementDescription
    ? `PLACEMENT: ${placementDescription}`
    : "Place the items naturally in appropriate locations in the room."

  const imagePrompt = `Add furniture to this room photo.

ROOM: ${roomDescription}

ITEMS TO ADD:
${itemList}

${placementInstructions}

${prompt ? `ADDITIONAL NOTES: ${prompt}` : ""}

REQUIREMENTS:
- Match the room's perspective, lighting, and shadows exactly
- Scale furniture appropriately for the space
- Make it look like the furniture was photographed in the room
- Keep all existing furniture and decor unchanged

OUTPUT: ${baseWidth}x${baseHeight} pixels, ${styleDesc}

Generate the room with the new furniture added.`

  console.log("=== ADD-REFERENCES INPUT ===")
  console.log("Model:", model)
  console.log("Room:", roomDescription)
  console.log("References:", references.length)
  console.log("Placement:", placementDescription || "(none - will place naturally)")
  console.log("--- FULL PROMPT ---")
  console.log(imagePrompt)
  console.log("--- END ---")

  try {
    // Build content array: prompt + base image + reference images
    const content: Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }> = [
      { type: "text", text: imagePrompt },
    ]

    // Add base image
    const { base64: baseB64, mediaType: baseMime } = parseDataUrl(baseImage.data)
    content.push({ type: "image", image: baseB64, mimeType: baseMime })

    // Add reference images in order
    const sortedRefs = [...references].sort((a, b) => (a.referenceNumber || 0) - (b.referenceNumber || 0))
    for (const ref of sortedRefs) {
      const { base64, mediaType } = parseDataUrl(ref.data)
      content.push({ type: "image", image: base64, mimeType: mediaType })
    }

    console.log("Images sent:", content.filter(c => c.type === "image").length, "(1 room +", references.length, "references)")

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content,
        },
      ],
      providerOptions: {
        google: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      },
    })

    console.log("=== ADD-REFERENCES OUTPUT ===")
    console.log("Files:", result.files?.length || 0)
    console.log("Text:", result.text?.slice(0, 100) || "(none)")

    // Extract generated image
    const generatedImages: Array<{ base64: string; mediaType: string }> = []

    for (const file of result.files || []) {
      if (file.mediaType.startsWith("image/")) {
        generatedImages.push({
          base64: file.base64,
          mediaType: file.mediaType,
        })
      }
    }

    if (generatedImages.length > 0) {
      return Response.json({
        success: true,
        image: generatedImages[0],
        text: result.text,
      })
    }

    return Response.json({
      success: false,
      text: result.text,
      message: "No image was generated.",
    })
  } catch (error) {
    console.error("Add-references error:", error)
    const msg = error instanceof Error ? error.message.slice(0, 100) : "Unknown error"
    return Response.json({ success: false, error: msg }, { status: 500 })
  }
}
