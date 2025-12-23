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

// Convert x/y percentages to natural language position description
function describePosition(x: number, y: number): string {
  // Horizontal position
  let horizontal: string
  if (x < 25) horizontal = "far left"
  else if (x < 40) horizontal = "left"
  else if (x < 60) horizontal = "center"
  else if (x < 75) horizontal = "right"
  else horizontal = "far right"

  // Vertical position
  let vertical: string
  if (y < 25) vertical = "top"
  else if (y < 40) vertical = "upper"
  else if (y < 60) vertical = "middle"
  else if (y < 75) vertical = "lower"
  else vertical = "bottom"

  // Combine into natural description
  if (horizontal === "center" && vertical === "middle") {
    return "in the center of the room"
  } else if (horizontal === "center") {
    return `in the ${vertical} center area`
  } else if (vertical === "middle") {
    return `on the ${horizontal} side`
  } else {
    return `in the ${vertical}-${horizontal} area`
  }
}

function isImageOnlyModel(model: string): boolean {
  return model.startsWith("bfl/") || model.startsWith("google/imagen")
}

function supportsImageInput(model: string): boolean {
  // Gemini models support image input, FLUX Kontext supports it, but basic FLUX and Imagen don't
  return model.includes("gemini") || model.includes("kontext")
}

export async function POST(req: Request) {
  const { images, hasBase, referenceCount, markers, prompt, settings, baseWidth, baseHeight, selectedObjectDescription } = (await req.json()) as {
    images: ImageData[]
    hasBase: boolean
    referenceCount: number
    markers: Marker[]
    prompt: string
    settings: { style: string; lighting: string; model: string; resolution?: string; aspectRatio?: string }
    baseWidth: number
    baseHeight: number
    selectedObjectDescription?: string
  }

  const model = settings?.model || "google/gemini-2.5-flash-image"

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

  // Room description from AI analysis
  const roomDescription = baseImage?.name || "room"

  const styleDesc = styleDescriptions[settings?.style] || styleDescriptions.photorealistic

  if (hasBase && referenceCount > 0) {
    // CASE: Base image + reference images (with or without markers)

    // Build object list with natural language placement descriptions
    const objectList = referenceImages
      .sort((a, b) => (a.referenceNumber || 0) - (b.referenceNumber || 0))
      .map((img) => {
        const refNum = img.referenceNumber || 0
        // Get ALL pin markers for this reference (user may want multiple copies)
        const refMarkers = markers.filter((m): m is Pin => m.referenceNumber === refNum && m.type === "pin")

        let placementInfo = ""
        if (refMarkers.length === 1) {
          placementInfo = ` → place it ${describePosition(refMarkers[0].x, refMarkers[0].y)}`
        } else if (refMarkers.length > 1) {
          // Multiple placements for same reference = user wants multiple copies
          const positions = refMarkers.map((m, i) => `  - Copy ${i + 1}: ${describePosition(m.x, m.y)}`).join("\n")
          placementInfo = ` → place ${refMarkers.length} copies:\n${positions}`
        }

        return `[${refNum}] ${img.name || "Object"}${placementInfo}`
      })
      .join("\n")

    imagePrompt = `Edit this room photo by adding furniture from the reference images.

ROOM: ${roomDescription}

OBJECTS TO ADD:
${objectList}

USER REQUEST: ${prompt || "Add the reference objects naturally into the room."}

REQUIREMENTS:
- Add each object at its specified location in the room
- Match the room's perspective, scale, lighting, and shadows perfectly
- Objects should look naturally placed, as if photographed in the room
- ${prompt?.toLowerCase().includes("remove") ? "Remove any elements the user asked to remove" : "Keep all existing furniture and decor"}
- Output dimensions: ${baseWidth}x${baseHeight} pixels
- Style: ${styleDesc}

Generate the edited room image.`

  } else if (images.length === 1 && baseImage) {
    // CASE: Single image edit (remove, modify, transform - no references)
    const targetObject = selectedObjectDescription
      ? `"${selectedObjectDescription}"`
      : "the selected/mentioned object"

    imagePrompt = `Edit this room photo.

ROOM: ${roomDescription}
${selectedObjectDescription ? `\nTARGET OBJECT: ${selectedObjectDescription} (this is what the user selected to edit)` : ""}

USER REQUEST: ${prompt}

RULES:
- The user wants to modify ${targetObject}
- Make ONLY the changes requested by the user to ${targetObject}
- If user asks to REMOVE: cleanly remove ${targetObject} and fill the area naturally with what would logically be behind it (wall, floor, etc.)
- If user asks to CHANGE/MODIFY: modify only ${targetObject}
- Keep everything else EXACTLY the same - do not remove or modify any other objects
- Maintain photorealistic quality
- Output dimensions: ${baseWidth}x${baseHeight} pixels
- Style: ${styleDesc}

Generate the edited image.`

  } else {
    // CASE: Multiple images without clear base (combine them)
    imagePrompt = `Combine these images into one cohesive interior design scene.

Use the first image as the main room/background. Integrate objects from other images naturally.

${prompt ? `USER REQUEST: ${prompt}` : ""}

RULES:
- Create a unified, realistic composition
- Match lighting and perspective across all elements
- Output dimensions: ${baseWidth}x${baseHeight} pixels
- Style: ${styleDesc}

Generate the combined image.`
  }

  // Debug: Log generation inputs
  console.log("=== GENERATION INPUT ===")
  console.log("Model:", model)
  console.log("User prompt:", prompt)
  console.log("Selected object:", selectedObjectDescription || "(none)")
  console.log("Has base:", !!baseImage)
  console.log("Reference count:", referenceCount)
  const pinMarkers = markers.filter((m): m is Pin => m.type === "pin")
  console.log("Markers:", pinMarkers.length, pinMarkers.map(m => `[${m.referenceNumber}] at (${Math.round(m.x)}%, ${Math.round(m.y)}%)`).join(", ") || "(none)")
  console.log("--- FULL IMAGE PROMPT ---")
  console.log(imagePrompt)
  console.log("--- END PROMPT ---")

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
        providerOptions: {
          google: {
            responseModalities: ["TEXT", "IMAGE"],
            ...(settings?.resolution && { sampleImageSize: settings.resolution }),
            ...(settings?.aspectRatio && settings.aspectRatio !== "auto" && { aspectRatio: settings.aspectRatio }),
          },
        },
      })

      console.log("=== GENERATE-ROOM OUTPUT ===")
      console.log("Files:", result.files?.length || 0)
      console.log("Text:", result.text?.slice(0, 100) || "(none)")

      // Check for files in various possible locations
      const generatedImages: Array<{ base64: string; mediaType: string }> = []

      // Try result.files first (standard location)
      for (const file of result.files || []) {
        if (file.mediaType.startsWith("image/")) {
          generatedImages.push({
            base64: file.base64,
            mediaType: file.mediaType,
          })
        }
      }

      // If no files found, try resolvedOutput (newer AI SDK format)
      if (generatedImages.length === 0 && "resolvedOutput" in result) {
        const resolved = (result as { resolvedOutput?: { files?: Array<{ base64: string; mediaType: string }> } }).resolvedOutput
        if (resolved?.files) {
          for (const file of resolved.files) {
            if (file.mediaType?.startsWith("image/")) {
              generatedImages.push({
                base64: file.base64,
                mediaType: file.mediaType,
              })
            }
          }
        }
      }

      // Also check steps for images (in files or content)
      if (generatedImages.length === 0 && "steps" in result) {
        const steps = (result as {
          steps?: Array<{
            files?: Array<{ base64: string; mediaType: string }>
            content?: Array<{ type: string; data?: string; mimeType?: string; image?: { base64: string; mimeType: string } }>
          }>
        }).steps

        for (const step of steps || []) {
          // Check step.files
          for (const file of step.files || []) {
            if (file.mediaType?.startsWith("image/")) {
              generatedImages.push({
                base64: file.base64,
                mediaType: file.mediaType,
              })
            }
          }

          // Check step.content for image parts
          if (Array.isArray(step.content)) {
            for (const part of step.content) {
              if (part.type === "image" && part.image) {
                generatedImages.push({
                  base64: part.image.base64,
                  mediaType: part.image.mimeType || "image/png",
                })
              }
              // Also check for inline data
              if (part.type === "file" && part.data && part.mimeType?.startsWith("image/")) {
                generatedImages.push({
                  base64: part.data,
                  mediaType: part.mimeType,
                })
              }
            }
          }
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
    console.error("Generation error:", error)

    let msg = "Something went wrong"

    if (error instanceof Error) {
      console.error("Full error message:", error.message)
      const e = error.message.toLowerCase()
      if (e.includes("payload") || e.includes("too large") || e.includes("413")) {
        msg = "Images too large"
      } else if (e.includes("gateway") || e.includes("502") || e.includes("503")) {
        msg = "AI busy, try again"
      } else if (e.includes("rate") || e.includes("429")) {
        msg = "Too fast, wait a bit"
      } else if (e.includes("timeout")) {
        msg = "Timed out"
      } else {
        // Include part of the actual error for debugging
        msg = error.message.slice(0, 100)
      }
    }

    return Response.json({ success: false, error: msg }, { status: 500 })
  }
}
