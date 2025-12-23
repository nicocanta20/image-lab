import { generateText, experimental_generateImage } from "ai"

type ImageData = {
  role: "reference"
  data: string
  name?: string
  referenceNumber?: number
}

function parseDataUrl(dataUrl: string): { base64: string; mediaType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    return { mediaType: match[1], base64: match[2] }
  }
  return { mediaType: "image/png", base64: dataUrl }
}

function isImageOnlyModel(model: string): boolean {
  return model.startsWith("bfl/") || model.startsWith("google/imagen")
}

export async function POST(req: Request) {
  const {
    prompt,
    references,
    settings,
  } = (await req.json()) as {
    prompt: string
    references?: ImageData[]
    settings: { style: string; lighting: string; model?: string; resolution?: string; aspectRatio?: string }
  }

  if (!prompt) {
    return Response.json({ success: false, error: "No prompt provided" }, { status: 400 })
  }

  // Default to Gemini 3 Pro Image for creation, or use specified model
  const model = settings?.model || "google/gemini-3-pro-image"

  const styleDescriptions: Record<string, string> = {
    photorealistic: "highly photorealistic with accurate textures and materials",
    modern: "sleek modern aesthetic with clean lines and contemporary design",
    minimalist: "minimalist style with simple forms and uncluttered spaces",
    cozy: "warm and cozy atmosphere with inviting textures",
    industrial: "industrial style with exposed materials and raw finishes",
  }

  const lightingDescriptions: Record<string, string> = {
    "natural-daylight": "natural daylight streaming through windows",
    warm: "warm ambient lighting creating a cozy atmosphere",
    cool: "cool modern lighting with clean white tones",
    dramatic: "dramatic lighting with strong shadows and highlights",
    soft: "soft diffused lighting that flatters the space",
  }

  const styleDesc = styleDescriptions[settings?.style] || styleDescriptions.photorealistic
  const lightingDesc = lightingDescriptions[settings?.lighting] || lightingDescriptions["natural-daylight"]

  // Build prompt for image creation from scratch
  let imagePrompt: string

  if (references && references.length > 0) {
    // Create with reference images as inspiration
    const refList = references
      .sort((a, b) => (a.referenceNumber || 0) - (b.referenceNumber || 0))
      .map((ref) => `[${ref.referenceNumber}] ${ref.name || "Reference item"}`)
      .join("\n")

    imagePrompt = `Create a new interior design image.

USER REQUEST: ${prompt}

REFERENCE ITEMS (incorporate these into the design):
${refList}

STYLE: ${styleDesc}
LIGHTING: ${lightingDesc}

Generate a high-quality interior design image that incorporates the reference items naturally into the scene.`
  } else {
    // Pure text-to-image generation
    imagePrompt = `Create a new interior design image.

USER REQUEST: ${prompt}

STYLE: ${styleDesc}
LIGHTING: ${lightingDesc}

Generate a high-quality, photorealistic interior design image.`
  }

  console.log("=== CREATE-IMAGE INPUT ===")
  console.log("Model:", model)
  console.log("References:", references?.length || 0)
  console.log("--- FULL PROMPT ---")
  console.log(imagePrompt)
  console.log("--- END ---")

  try {
    if (isImageOnlyModel(model)) {
      // Use generateImage for FLUX and Imagen models (text-only input)
      const result = await experimental_generateImage({
        model: model,
        prompt: imagePrompt,
      })

      console.log("=== CREATE-IMAGE OUTPUT ===")
      console.log("Image generated:", !!result.image)

      if (result.image) {
        return Response.json({
          success: true,
          image: {
            base64: result.image.base64,
            mediaType: "image/png",
          },
          text: null,
        })
      }

      return Response.json({
        success: false,
        message: "No image was generated.",
      })
    } else {
      // Use generateText for Gemini models (can include reference images)
      const content: Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }> = [
        { type: "text", text: imagePrompt },
      ]

      // Add reference images if provided
      if (references && references.length > 0) {
        const sortedRefs = [...references].sort((a, b) => (a.referenceNumber || 0) - (b.referenceNumber || 0))
        for (const ref of sortedRefs) {
          const { base64, mediaType } = parseDataUrl(ref.data)
          content.push({ type: "image", image: base64, mimeType: mediaType })
        }
      }

      console.log("Images sent:", content.filter(c => c.type === "image").length)

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
            ...(settings?.resolution && { sampleImageSize: settings.resolution }),
            ...(settings?.aspectRatio && settings.aspectRatio !== "auto" && { aspectRatio: settings.aspectRatio }),
          },
        },
      })

      console.log("=== CREATE-IMAGE OUTPUT ===")
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
    }
  } catch (error) {
    console.error("Create-image error:", error)
    const msg = error instanceof Error ? error.message.slice(0, 100) : "Unknown error"
    return Response.json({ success: false, error: msg }, { status: 500 })
  }
}
