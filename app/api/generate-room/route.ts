import { generateText, experimental_generateImage } from "ai"

type Pin = {
  id: string
  referenceNumber: number
  x: number
  y: number
  type: "pin"
  objectName?: string
}

type Lasso = {
  id: string
  referenceNumber: number
  points: { x: number; y: number }[]
  type: "lasso"
  objectName?: string
}

type Marker = Pin | Lasso

type ImageData = {
  role: "base" | "reference"
  data: string
  referenceNumber?: number
  name?: string
}

function parseDataUrl(dataUrl: string): { base64: string; mediaType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    return { mediaType: match[1], base64: match[2] }
  }
  return { mediaType: "image/png", base64: dataUrl }
}

function describeMarker(marker: Marker): string {
  const name = marker.objectName || "Object"
  const ref = marker.referenceNumber
  if (marker.type === "pin") {
    return `- Marker "${ref}: ${name}" → Take the object from Reference image [${ref}] and place it at this marker`
  } else if (marker.type === "lasso" && marker.points.length > 2) {
    return `- Marker "${ref}: ${name}" → Take the object from Reference image [${ref}] and fill the outlined area`
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
    const hasMarkers = markers.length > 0

    // Build object list from reference images - match marker numbers
    const objectList = referenceImages
      .sort((a, b) => (a.referenceNumber || 0) - (b.referenceNumber || 0))
      .map((img, idx) => `- Reference image [${img.referenceNumber || idx + 1}]: ${img.name || "Object"}`)
      .join("\n")

    // Build marker instructions
    const markerInstructions = markers
      .map((marker) => describeMarker(marker))
      .filter(Boolean)
      .join("\n")

    if (hasMarkers) {
      // Build narrative description of what to place
      const placements = markers
        .map((m) => {
          const name = m.objectName || "Object"
          return `Take the ${name} from Reference image [${m.referenceNumber}] and place it exactly where you see the marker labeled "${m.referenceNumber}: ${name}" on the room photo.`
        })
        .join(" ")

      imagePrompt = `You are compositing objects into a photograph. I'm giving you a room photo with markers drawn on it, plus separate reference images showing the objects to add.

The first image is the room. Look carefully - you'll see numbered markers drawn on it (black circles with labels like "1: Woman in white dress"). These markers show exactly where each object should be placed.

${objectList.replace(/^- /gm, "").replace(/Reference image \[(\d+)\]/g, "Reference image [$1] shows the")}

Your task: ${placements}

Cut out each object cleanly from its reference image, removing the background. Then paste it into the room at the marker position, matching the room's perspective and lighting. Add natural shadows beneath each object.

${prompt ? `The user also asked: "${prompt}"` : ""}

Keep every single pixel of the room identical - the walls, floor, ceiling, existing furniture, lighting, and shadows must stay exactly the same. The only change should be the new objects appearing at the marker positions. ${prompt ? "Unless the user's instructions above specifically ask to modify something existing." : ""}

Remove the marker labels from the final image - they were just placement guides.

Output the composite at ${baseWidth}x${baseHeight} pixels.`
    } else {
      // No markers - place objects naturally
      imagePrompt = `You are compositing objects into a photograph. I'm giving you a room photo plus separate reference images showing objects to add.

The first image is the room. The other images show objects to add to the scene.

${objectList.replace(/^- /gm, "").replace(/Reference image \[(\d+)\]/g, "Reference image [$1] shows a")}

${prompt ? `The user wants: "${prompt}"` : "Add the objects naturally into the room where they fit best."}

Cut out each object cleanly from its reference image, removing the background. Place them in the room at natural positions, matching the room's perspective and lighting. Add natural shadows beneath each object.

Keep the room identical - walls, floor, ceiling, existing furniture, lighting stay exactly the same. Only add the new objects. ${prompt ? "Unless the user's instructions specifically ask to modify something existing." : ""}

Output the composite at ${baseWidth}x${baseHeight} pixels.`
    }
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

    let msg = "Something went wrong"

    if (error instanceof Error) {
      const e = error.message.toLowerCase()
      if (e.includes("payload") || e.includes("too large") || e.includes("413")) {
        msg = "Images too large"
      } else if (e.includes("gateway") || e.includes("502") || e.includes("503")) {
        msg = "AI busy, try again"
      } else if (e.includes("rate") || e.includes("429")) {
        msg = "Too fast, wait a bit"
      } else if (e.includes("timeout")) {
        msg = "Timed out"
      }
    }

    return Response.json({ success: false, error: msg }, { status: 500 })
  }
}
