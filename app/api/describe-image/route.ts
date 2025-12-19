import { generateText } from "ai"
import { gateway } from "@ai-sdk/gateway"

export async function POST(req: Request) {
  const { image, filename } = (await req.json()) as {
    image: string
    filename?: string
  }

  if (!image) {
    return Response.json({ error: "No image provided" }, { status: 400 })
  }

  // Parse the data URL
  const match = image.match(/^data:([^;]+);base64,(.+)$/)
  const mimeType = match?.[1] || "image/png"
  const base64 = match?.[2] || image

  // Build context from filename if available
  const filenameHint = filename
    ? `The file was named "${filename}". Use this as a hint if it helps identify the object.`
    : ""

  try {
    const result = await generateText({
      model: gateway("openai/gpt-4.1-mini"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Describe this image in a short phrase (3-6 words).

${filenameHint}

Examples:
- Furniture: "Modern leather office chair"
- Room: "Minimalist living room"
- Person: "Woman in white dress"
- Fashion: "Man in blue suit and tie"
- Object: "Potted plant on stand"
- Art: "Abstract painting with gold frame"

Describe the WHOLE image, not just one element. If there's a person, mention them and what they're wearing.

Respond with ONLY the description, nothing else.`,
            },
            {
              type: "image",
              image: base64,
              mimeType,
            },
          ],
        },
      ],
      maxTokens: 20,
    })

    const name = result.text.trim()

    return Response.json({
      success: true,
      name: name || "Uploaded Image",
    })
  } catch (error) {
    console.error("Image description error:", error)

    // Fallback: try to extract something from filename
    if (filename) {
      const cleanName = filename
        .replace(/\.[^.]+$/, "") // Remove extension
        .replace(/[-_]/g, " ") // Replace separators
        .replace(/\d+/g, "") // Remove numbers
        .trim()

      if (cleanName) {
        return Response.json({
          success: true,
          name: cleanName.slice(0, 30),
        })
      }
    }

    return Response.json({
      success: true,
      name: "Uploaded Image",
    })
  }
}
