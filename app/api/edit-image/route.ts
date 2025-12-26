import { generateText } from "ai"

type ImageData = {
  role: "base"
  data: string
  name?: string
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
    imageWithSelection,
    prompt,
    selectedObjectDescription,
    settings,
  } = (await req.json()) as {
    baseImage: ImageData
    imageWithSelection?: string // Image with lasso overlay showing what to edit
    prompt: string
    selectedObjectDescription?: string
    settings: { style: string; lighting: string }
  }

  if (!baseImage?.data) {
    return Response.json({ success: false, error: "No base image provided" }, { status: 400 })
  }

  // Gemini 2.5 Flash is best for editing existing images
  const model = "google/gemini-2.5-flash-image"

  const styleDescriptions: Record<string, string> = {
    photorealistic: "highly photorealistic with accurate textures and materials",
    modern: "sleek modern aesthetic with clean lines and contemporary design",
    minimalist: "minimalist style with simple forms and uncluttered spaces",
    cozy: "warm and cozy atmosphere with inviting textures",
    industrial: "industrial style with exposed materials and raw finishes",
  }

  const styleDesc = styleDescriptions[settings?.style] || styleDescriptions.photorealistic

  // Detect action type from prompt
  const promptLower = prompt.toLowerCase()
  const isRemove = promptLower.includes("remove") || promptLower.includes("delete") || promptLower.includes("get rid")
  const isReplace = promptLower.includes("replace") || promptLower.includes("swap") || promptLower.includes("change to")

  // Build focused prompt based on action
  let actionInstructions: string
  if (isRemove) {
    actionInstructions = `REMOVE ONLY "${selectedObjectDescription || "the selected object"}" - nothing else.
Fill that specific area naturally with what would logically be behind it (wall, floor, continuation of background).
Make the removal seamless - no traces of the removed object.
IMPORTANT: If there are similar objects nearby (like another chair, lamp, etc.), DO NOT touch them.`
  } else if (isReplace) {
    actionInstructions = `REPLACE ONLY "${selectedObjectDescription || "the selected object"}" with what the user specified.
Keep the same position and approximate scale.
Match lighting and perspective perfectly.
IMPORTANT: If there are similar objects nearby, DO NOT replace them - only the specified one.`
  } else {
    actionInstructions = `MODIFY ONLY "${selectedObjectDescription || "the selected object"}" as requested.
Keep its position, only change the specified attributes.
Maintain consistency with the rest of the image.
IMPORTANT: If there are similar objects nearby, DO NOT modify them.`
  }

  const hasLasso = !!imageWithSelection

  const imagePrompt = `Edit this room photo.

${hasLasso ? "IMPORTANT: There is a TERRACOTTA/ORANGE LASSO CIRCLE drawn on the image showing EXACTLY which object to edit. Edit ONLY the object inside that lasso circle." : ""}

TARGET: "${selectedObjectDescription || "the object inside the lasso selection"}"

REQUEST: ${prompt}

${actionInstructions}

CRITICAL RULES:
${hasLasso ? "- The lasso circle shows EXACTLY what to edit - focus on that area only" : ""}
- Modify ONLY the object inside the selection
- Keep ALL other objects exactly the same
- Preserve the original image composition, lighting, and quality
- Style: ${styleDesc}

Generate the edited image.`

  console.log("=== EDIT-IMAGE INPUT ===")
  console.log("Model:", model)
  console.log("Has lasso overlay:", hasLasso)
  console.log("Target object:", selectedObjectDescription || "(from prompt)")
  console.log("Action type:", isRemove ? "REMOVE" : isReplace ? "REPLACE" : "MODIFY")
  console.log("User prompt:", prompt)
  console.log("--- FULL PROMPT ---")
  console.log(imagePrompt)
  console.log("--- END ---")

  try {
    // Use image with lasso overlay if available, otherwise use base image
    const imageToEdit = imageWithSelection || baseImage.data
    const { base64, mediaType } = parseDataUrl(imageToEdit)

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: imagePrompt },
            { type: "image", image: base64, mimeType: mediaType },
          ],
        },
      ],
      providerOptions: {
        google: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      },
    })

    console.log("=== EDIT-IMAGE OUTPUT ===")
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
    console.error("Edit-image error:", error)
    const msg = error instanceof Error ? error.message.slice(0, 100) : "Unknown error"
    return Response.json({ success: false, error: msg }, { status: 500 })
  }
}
