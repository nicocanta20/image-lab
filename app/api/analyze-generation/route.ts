import { generateObject } from "ai"
import { z } from "zod"

const QuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  header: z.string().optional().describe("Short 1-2 word category tag like 'Placement', 'Style', 'Color'"),
  options: z.array(z.object({
    label: z.string().describe("Short option label, 2-4 words max"),
    value: z.string(),
  })),
  allowCustom: z.boolean().default(true),
  multiSelect: z.boolean().default(false).describe("True if user can select multiple options"),
})

const AnalysisSchema = z.object({
  needsClarification: z.boolean(),
  questions: z.array(QuestionSchema).default([]),
  confidence: z.number().min(0).max(100),
  reasoning: z.string().optional(),
})

function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (match) {
    return { mimeType: match[1], base64: match[2] }
  }
  return { mimeType: "image/png", base64: dataUrl }
}

type ImageData = {
  role: "base" | "reference"
  data: string
  referenceNumber?: number
  name?: string
}

type Marker = {
  referenceNumber: number
  x: number
  y: number
}

export async function POST(req: Request) {
  const { images, hasBase, referenceCount, markers, prompt, settings } = (await req.json()) as {
    images: ImageData[]
    hasBase: boolean
    referenceCount: number
    markers: Marker[]
    prompt: string
    settings: { style: string; lighting: string }
  }

  // Build context description
  const baseImage = images.find((img) => img.role === "base")
  const referenceImages = images.filter((img) => img.role === "reference")

  let contextDescription = ""

  if (hasBase) {
    contextDescription += `Base room image: "${baseImage?.name || "Uploaded room"}"\n`
  } else {
    contextDescription += "No base room image uploaded.\n"
  }

  if (referenceCount > 0) {
    contextDescription += `\nReference images (${referenceCount}):\n`
    referenceImages.forEach((ref, i) => {
      const hasMarker = markers.some(m => m.referenceNumber === ref.referenceNumber)
      contextDescription += `- [${ref.referenceNumber}] "${ref.name || `Item ${i + 1}`}"${hasMarker ? " (has placement marker)" : " (no marker placed)"}\n`
    })
  }

  if (markers.length > 0) {
    contextDescription += `\nPlacement markers: ${markers.length} placed on the room image\n`
  }

  contextDescription += `\nSettings: Style="${settings.style}", Lighting="${settings.lighting}"\n`
  contextDescription += `User prompt: "${prompt || "(empty)"}"\n`

  const analysisPrompt = `You are analyzing a room design request. You can SEE the room image and any reference items attached.

CONTEXT:
${contextDescription}

IMAGES:
- First image: The room/space
- Following images (if any): Reference items to add

YOUR TASK:
Look at everything and decide if anything is genuinely unclear. If so, ask 1-3 short questions. If not, let it proceed.

QUESTION FORMAT:
- header: 1-2 word category
- question: Natural, conversational
- options: 2-4 SHORT options based on what you SEE
- multiSelect: true if multiple can apply

ASK ABOUT THESE IF USER DIDN'T SPECIFY IN PROMPT:
- Orientation: Which direction should it face? (facing window, facing sofa, etc.)
- Arrangement: If multiple items, how should they relate? (facing each other, side by side, etc.)
- Placement: Where exactly? (only if no marker placed)
- Scale: How big relative to existing items?
- Style: Match or contrast with existing decor?

ONLY SKIP QUESTIONS IF:
- User explicitly specified that detail in their prompt
- It's a simple modification (lighting, wall color) with no furniture

If user didn't specify, ASK. Don't assume.`

  try {
    // Build messages with image if available
    const content: Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }> = [
      { type: "text", text: analysisPrompt },
    ]

    // Add base image so model can see the room
    if (baseImage?.data) {
      const { base64, mimeType } = parseDataUrl(baseImage.data)
      content.push({
        type: "image",
        image: base64,
        mimeType,
      })
    }

    // Add reference images so model knows what items look like
    for (const ref of referenceImages) {
      if (ref.data) {
        const { base64, mimeType } = parseDataUrl(ref.data)
        content.push({
          type: "image",
          image: base64,
          mimeType,
        })
      }
    }

    const result = await generateObject({
      model: "openai/gpt-5.2",
      schema: AnalysisSchema,
      messages: [
        {
          role: "user",
          content,
        },
      ],
      providerOptions: {
        openai: {
          reasoningEffort: "none",
        },
      },
    })

    return Response.json({
      success: true,
      ...result.object,
    })
  } catch (error) {
    console.error("Analysis error:", error)
    // On error, just proceed without questions
    return Response.json({
      success: true,
      needsClarification: false,
      questions: [],
      confidence: 100,
    })
  }
}
