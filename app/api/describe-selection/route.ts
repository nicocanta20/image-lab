import { generateText } from "ai"

function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    return { mimeType: match[1], base64: match[2] }
  }
  return { mimeType: "image/png", base64: dataUrl }
}

export async function POST(req: Request) {
  const { imageWithSelection } = (await req.json()) as {
    imageWithSelection: string
  }

  if (!imageWithSelection) {
    return Response.json({ success: false, error: "No image provided" }, { status: 400 })
  }

  try {
    const { base64 } = parseDataUrl(imageWithSelection)

    const result = await generateText({
      model: "google/gemini-3-flash",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Look at this room image. There is an orange/terracotta colored lasso circle drawn around ONE specific object.

Your task: Identify EXACTLY which object is circled, distinguishing it from any similar objects.

CRITICAL RULES:
- Include SPATIAL POSITION: use "left", "right", "front", "back", "near the window", etc.
- If there are similar objects (e.g., two chairs), specify WHICH ONE: "the LEFT armchair" not just "the armchair"
- Be specific about what makes THIS object unique from others
- Example: "the armchair on the LEFT side of the coffee table" (not "the beige armchair")
- Example: "the floor lamp in the FRONT-LEFT corner" (not "the floor lamp")
- Keep it concise but spatially precise: 4-10 words

Reply with ONLY the object description, nothing else.`,
            },
            {
              type: "image",
              image: base64,
            },
          ],
        },
      ],
    })

    const description = result.text?.trim() || "the selected object"

    console.log("=== SELECTION IDENTIFIED ===")
    console.log("Description:", description)
    console.log("===========================")

    return Response.json({
      success: true,
      description,
    })
  } catch (error) {
    console.error("Selection description error:", error)
    return Response.json({
      success: true,
      description: "the selected object", // Fallback - don't block the flow
    })
  }
}
