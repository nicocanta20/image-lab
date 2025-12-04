import { generateText, experimental_generateImage } from "ai"

type Pin = {
  id: string
  referenceNumber: number
  x: number
  y: number
  type: "pin"
  color: string
}

type Lasso = {
  id: string
  referenceNumber: number
  points: { x: number; y: number }[]
  type: "lasso"
  color: string
}

type Marker = Pin | Lasso

type ImageData = {
  role: "base" | "reference"
  data: string
  referenceNumber?: number
}

function parseDataUrl(dataUrl: string): { base64: string; mediaType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    return { mediaType: match[1], base64: match[2] }
  }
  return { mediaType: "image/png", base64: dataUrl }
}

function describeMarker(marker: Marker): string {
  if (marker.type === "pin") {
    return `- Reference #${marker.referenceNumber}: Place at position (${Math.round(marker.x)}% from left, ${Math.round(marker.y)}% from top)`
  } else if (marker.type === "lasso" && marker.points.length > 2) {
    const minX = Math.round(Math.min(...marker.points.map((p) => p.x)))
    const maxX = Math.round(Math.max(...marker.points.map((p) => p.x)))
    const minY = Math.round(Math.min(...marker.points.map((p) => p.y)))
    const maxY = Math.round(Math.max(...marker.points.map((p) => p.y)))
    return `- Reference #${marker.referenceNumber}: Fill the drawn area from (${minX}%-${maxX}% horizontal, ${minY}%-${maxY}% vertical) with this object`
  }
  return ""
}

function isImageOnlyModel(model: string): boolean {
  return model.startsWith("bfl/") || model.startsWith("google/imagen")
}

function supportsImageInput(model: string): boolean {
  // Gemini models support image input, FLUX Kontext supports it, but basic FLUX and Imagen don't
  return model.includes("gemini") || model.includes("kontext")
}

export async function POST(req: Request) {
  const { images, hasBase, referenceCount, markers, prompt, settings, baseWidth, baseHeight } = (await req.json()) as {
    images: ImageData[]
    hasBase: boolean
    referenceCount: number
    markers: Marker[]
    prompt: string
    settings: { style: string; lighting: string; model: string }
    baseWidth: number
    baseHeight: number
  }

  const model = settings?.model || "google/gemini-3-pro-image-preview"

  const styleDescriptions: Record<string, string> = {
    photorealistic: "highly photorealistic with accurate textures and materials",
    modern: "sleek modern aesthetic with clean lines and contemporary design",
    minimalist: "minimalist style with simple forms and uncluttered spaces",
    cozy: "warm and cozy atmosphere with inviting textures",
    industrial: "industrial style with exposed materials and raw finishes",
  }

  const lightingDescriptions: Record<string, string> = {
    original: "the exact same lighting as in the original image - DO NOT change the lighting",
    "natural-daylight": "natural daylight streaming through windows",
    warm: "warm ambient lighting creating a cozy atmosphere",
    cool: "cool modern lighting with clean white tones",
    dramatic: "dramatic lighting with strong shadows and highlights",
    soft: "soft diffused lighting that flatters the space",
  }

  const lightingInstruction =
    settings?.lighting === "original"
      ? "KEEP THE ORIGINAL LIGHTING: Preserve the exact lighting conditions from the source image. Do not modify brightness, shadows, or color temperature."
      : `LIGHTING: Apply ${lightingDescriptions[settings?.lighting] || lightingDescriptions.original}.`

  let imagePrompt: string
  const baseImage = images.find((img) => img.role === "base")
  const referenceImages = images.filter((img) => img.role === "reference")

  if (hasBase && referenceCount > 0) {
    const markerDescriptions = markers
      .map((marker) => describeMarker(marker))
      .filter(Boolean)
      .join("\n")

    imagePrompt = `You are an expert image compositor. Your task is to ADD objects to an existing image WITHOUT changing anything else.

INPUT:
1. BASE IMAGE: The original image with position markers (circles with numbers)
2. ${referenceCount} REFERENCE IMAGE(s): Objects to add to the scene

CRITICAL - PRESERVE THE BASE IMAGE EXACTLY:
- The output MUST be the EXACT same image as the base input
- Same composition, same background, same everything
- The ONLY change should be the added objects from the references
- DO NOT crop, resize, or change the aspect ratio
- DO NOT modify colors, lighting, or any existing elements
- The base image dimensions are ${baseWidth}x${baseHeight} pixels - OUTPUT MUST MATCH THIS EXACTLY

UNDERSTANDING THE MARKERS:
The base image has numbered circles or outlined areas. These tell you WHERE to place objects:
- A numbered CIRCLE (pin) = place that reference object centered at that exact point
- A numbered OUTLINED AREA (lasso) = scale and place that reference object to fill that region

MARKER POSITIONS:
${markerDescriptions || "No specific markers - use natural placement"}

ABSOLUTE REQUIREMENTS:
1. **REMOVE ALL MARKERS**: The circles and numbers are instructions - they must NOT appear in your output
2. **EXACT BASE REPRODUCTION**: The output must be pixel-perfect identical to the base, except with objects added
3. **SEAMLESS OBJECT INTEGRATION**: 
   - Remove backgrounds from reference objects
   - Match perspective and scale to the scene
   - Add natural shadows under objects
   - Blend edges seamlessly
4. **NO CROPPING OR AR CHANGE**: Output dimensions must match input base image exactly

STYLE: ${styleDescriptions[settings?.style] || styleDescriptions.photorealistic}
${lightingInstruction}

${prompt ? `ADDITIONAL INSTRUCTIONS: ${prompt}` : ""}

Generate the base image with objects seamlessly added at the marked positions. The output must have NO markers visible and must be the EXACT same dimensions as the input.`
  } else if (images.length === 1) {
    imagePrompt = `You are an expert image editor.

USER REQUEST: ${prompt}

CRITICAL REQUIREMENTS:
1. REPLICATE THE EXACT IMAGE: Start with an exact copy of the input image
2. APPLY ONLY THE USER'S REQUEST: Make ONLY the changes specified above
3. PRESERVE EVERYTHING ELSE: Any element not mentioned should remain IDENTICAL
4. SAME DIMENSIONS: Output must have the exact same dimensions as the input (${baseWidth}x${baseHeight} pixels)
5. PHOTOREALISTIC OUTPUT: The result must look like a real photograph

STYLE: ${styleDescriptions[settings?.style] || styleDescriptions.photorealistic}
${lightingInstruction}

Generate a high-quality image based on the user's specific request. DO NOT change the dimensions or aspect ratio.`
  } else {
    imagePrompt = `You are an expert interior design AI. Combine the provided images into one cohesive interior design scene.

The first image should be the main room/background. Integrate objects from other images naturally.

CRITICAL: Maintain the same dimensions as the first (base) image: ${baseWidth}x${baseHeight} pixels.

STYLE: ${styleDescriptions[settings?.style] || styleDescriptions.photorealistic}
${lightingInstruction}

${prompt ? `USER INSTRUCTIONS: ${prompt}` : ""}

Generate a photorealistic combined image with the SAME dimensions as the base image.`
  }

  try {
    if (isImageOnlyModel(model)) {
      // Use generateImage for FLUX and Imagen models
      const result = await experimental_generateImage({
        model: model,
        prompt: imagePrompt,
        // Note: Most image-only models don't support image input
        // FLUX Kontext does support it via a different mechanism
      })

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
      // Use generateText for Gemini models (multimodal)
      const content: Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }> = [
        { type: "text", text: imagePrompt },
      ]

      if (baseImage) {
        const { base64, mediaType } = parseDataUrl(baseImage.data)
        content.push({
          type: "image",
          image: base64,
          mimeType: mediaType,
        })
      }

      const sortedRefs = [...referenceImages].sort((a, b) => (a.referenceNumber || 0) - (b.referenceNumber || 0))
      for (const ref of sortedRefs) {
        const { base64, mediaType } = parseDataUrl(ref.data)
        content.push({
          type: "image",
          image: base64,
          mimeType: mediaType,
        })
      }

      const result = await generateText({
        model: model,
        messages: [
          {
            role: "user",
            content,
          },
        ],
      })

      const generatedImages = []
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
        message: "No image was generated. The model may have returned text only.",
      })
    }
  } catch (error) {
    console.error("Generation error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to generate image"
    return Response.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
