import { generateObject } from "ai"
import { z } from "zod"

const QuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  header: z.string().optional().describe("Short 1-2 word category tag like 'Placement', 'Style', 'Color'"),
  options: z.array(z.object({
    label: z.string().describe("Short option label, 2-4 words max"),
    value: z.string(),
    naturalPhrase: z.string().describe("How the user would write this if they included it in their original prompt. E.g., if asking which chair and they pick 'left one', this could be 'Remove only the left armchair'"),
  })),
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
  const { images, hasBase, referenceCount, markers, prompt, settings, imageWithSelection, imageWithMarkers, selectedObjectDescription, generationMode } = (await req.json()) as {
    images: ImageData[]
    hasBase: boolean
    referenceCount: number
    markers: Marker[]
    prompt: string
    settings: { style: string; lighting: string }
    imageWithSelection?: string // Base image with lasso overlay (presence = inpainting mode)
    imageWithMarkers?: string // Base image with numbered markers showing placements
    selectedObjectDescription?: string // AI-identified description of selected object
    generationMode?: "create" | "edit" | "add-references" // What type of generation
  }

  // Derived
  const hasMask = !!imageWithSelection

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

  if (hasMask) {
    contextDescription += `\nUSER HAS DRAWN A SELECTION (lasso) on an area of the room image. This is INPAINTING MODE - the selected area will be edited.\n`
  }

  contextDescription += `\nSettings: Style="${settings.style}", Lighting="${settings.lighting}"\n`
  contextDescription += `User prompt: "${prompt || "(empty)"}"\n`

  // Different prompts based on generation mode
  let analysisPrompt: string

  if (generationMode === "create" || !hasBase) {
    // CREATE MODE: Generating a new room from scratch
    analysisPrompt = `You are analyzing a request to CREATE a new interior design image from scratch.

CONTEXT:
${contextDescription}

${referenceCount > 0 ? "REFERENCE IMAGES: The user has provided reference images to incorporate into the design." : ""}

YOUR TASK:
Analyze the user's prompt and determine if it has enough detail to generate a good image. If the prompt is vague or missing key details, ask 1-3 clarifying questions.

QUESTION FORMAT:
- header: 1-2 word category (e.g., "Room Type", "Style", "View")
- question: Natural, conversational
- options: Each with label, value, and naturalPhrase (how user would write it, e.g., "Create a modern living room")
- multiSelect: true if multiple can apply

THINGS TO CLARIFY (if not specified in prompt):
- Room type: What kind of room? (living room, bedroom, kitchen, bathroom, office, etc.)
- Style: What aesthetic? (modern, minimalist, traditional, bohemian, scandinavian, industrial, etc.)
- View/Angle: What perspective? (wide shot, corner view, close-up detail, etc.)
- Key elements: What should be the focal point? (a specific piece of furniture, window view, fireplace, etc.)
- Mood: What atmosphere? (cozy, bright, dramatic, serene, etc.)
- Time of day: Daylight, evening, night?

SKIP QUESTIONS IF:
- The prompt already describes the room in detail (room type + style + key elements)
- The prompt is very specific about what to create
- Reference images provide enough context

EXAMPLES OF VAGUE PROMPTS THAT NEED QUESTIONS:
- "a nice room" → Ask about room type and style
- "modern living room" → Could ask about view angle or focal point
- "bedroom" → Ask about style and mood

EXAMPLES OF DETAILED PROMPTS THAT DON'T NEED QUESTIONS:
- "A cozy scandinavian living room with a grey sofa facing a fireplace, large windows with natural light"
- "Modern minimalist kitchen with white cabinets, marble countertops, and pendant lights"

Be helpful but not excessive - only ask if something important is truly unclear.`
  } else if (hasMask) {
    // EDIT MODE: User has a selection/lasso
    analysisPrompt = `You are analyzing a room EDIT request. The user has drawn a selection (lasso) on an area.

CONTEXT:
${contextDescription}
${selectedObjectDescription ? `SELECTED OBJECT: "${selectedObjectDescription}"` : ""}

IMAGES:
- First image: The room with a terracotta/orange lasso showing what's selected
- Following images: Reference items (if any)

YOUR TASK:
1. Look at the lasso selection carefully
2. Check if there are SIMILAR objects in the room (e.g., two chairs, multiple lamps, matching pillows)
3. If the user wants to remove/modify something and there are similar objects, ASK which one(s)

QUESTION FORMAT:
- header: 1-2 word category
- question: Natural, conversational
- options: Each with label, value, and naturalPhrase (how user would write it, e.g., "Replace it with a modern lamp")
- multiSelect: true if multiple can apply

SKIP QUESTIONS IF:
- The SELECTED OBJECT already has position info (left/right/front/back) - it's already unique
- User's prompt clearly states the action

ONLY ASK IF:
- Action unclear (didn't say remove/replace/modify)
- Replace but didn't say with what
- Modify but didn't say how`
  } else {
    // FURNITURE MODE: Adding references to existing room
    analysisPrompt = `You are analyzing a furniture placement request.

CONTEXT:
${contextDescription}

IMAGES:
- First image: The room (may have numbered markers showing placements)
- Following images: Reference items to add

IMPORTANT:
- If there are numbered circles (1, 2, 3...), those show WHERE each reference item should go

YOUR TASK:
Look at everything and decide if placement is genuinely unclear. If so, ask 1-2 short questions.

QUESTION FORMAT:
- header: 1-2 word category
- question: Natural, conversational
- options: Each with label, value, and naturalPhrase (how user would write it, e.g., "Place the chair facing the window")
- multiSelect: true if multiple can apply

ASK ABOUT (only if unclear):
- Orientation: Which direction should it face? (facing window, facing sofa, etc.)
- Arrangement: If multiple items, how should they relate?
- Placement: Where exactly? (only if no marker placed)
- Scale: How big relative to existing items?

SKIP QUESTIONS IF:
- Markers already show clear placement
- User specified orientation/arrangement in prompt
- It's obvious from context where/how items should go

Don't over-ask. If markers are placed and it looks reasonable, proceed.`
  }

  try {
    // Build messages with image if available
    const content: Array<{ type: "text"; text: string } | { type: "image"; image: string; mimeType?: string }> = [
      { type: "text", text: analysisPrompt },
    ]

    // Add room image - prefer annotated version if available
    // Priority: selection overlay > markers overlay > original
    const roomImage = imageWithSelection || imageWithMarkers || baseImage?.data
    if (roomImage) {
      const { base64, mimeType } = parseDataUrl(roomImage)
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

    console.log("=== ANALYZER INPUT ===")
    console.log("Model:", "google/gemini-3-flash")
    console.log("Generation mode:", generationMode || "(not specified)")
    console.log("Has base image:", hasBase)
    console.log("Has selection overlay:", !!imageWithSelection)
    console.log("Has markers overlay:", !!imageWithMarkers)
    console.log("Selected object description:", selectedObjectDescription || "(none)")
    console.log("User prompt:", prompt)
    console.log("Image count:", content.filter(c => c.type === "image").length)
    console.log("======================")

    const result = await generateObject({
      model: "google/gemini-3-flash",
      schema: AnalysisSchema,
      messages: [
        {
          role: "user",
          content,
        },
      ],
    })

    console.log("=== ANALYZER OUTPUT ===")
    console.log("Needs clarification:", result.object.needsClarification)
    console.log("Confidence:", result.object.confidence)
    console.log("Questions:", result.object.questions?.length || 0)
    if (result.object.questions?.length) {
      result.object.questions.forEach((q, i) => {
        console.log(`  Q${i + 1}: ${q.question}`)
        console.log(`      Options: ${q.options.map(o => o.label).join(", ")}`)
      })
    }
    console.log("Reasoning:", result.object.reasoning || "(none)")
    console.log("=======================")

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
