import { fal } from "@fal-ai/client"

fal.config({
  credentials: process.env.FAL_KEY,
})

type EsrganOutput = {
  image: {
    url: string
    content_type: string
    width: number
    height: number
  }
}

export async function POST(req: Request) {
  const { image } = (await req.json()) as { image: string }

  if (!image) {
    return Response.json({ success: false, error: "No image provided" }, { status: 400 })
  }

  if (!process.env.FAL_KEY) {
    return Response.json({ success: false, error: "FAL_KEY not configured" }, { status: 500 })
  }

  try {
    let imageUrl: string

    // Check if image is a base64 data URL or a regular URL
    const base64Match = image.match(/^data:([^;]+);base64,(.+)$/)

    if (base64Match) {
      // Convert base64 to Blob and upload to fal storage
      const mimeType = base64Match[1]
      const base64Data = base64Match[2]
      const binaryData = Buffer.from(base64Data, "base64")
      const blob = new Blob([binaryData], { type: mimeType })
      const file = new File([blob], "image.jpg", { type: mimeType })

      // Upload to fal storage first
      imageUrl = await fal.storage.upload(file)
    } else if (image.startsWith("http://") || image.startsWith("https://")) {
      // Regular URL - use directly
      imageUrl = image
    } else {
      return Response.json({ success: false, error: "Invalid image format" }, { status: 400 })
    }

    // Now call ESRGAN with the image URL
    const result = await fal.subscribe<{ image_url: string; scale: number }, EsrganOutput>("fal-ai/esrgan", {
      input: {
        image_url: imageUrl,
        scale: 2,
      },
    })

    if (result.data?.image?.url) {
      // Fetch the upscaled image and convert to base64
      const imageResponse = await fetch(result.data.image.url)
      const imageBuffer = await imageResponse.arrayBuffer()
      const resultBase64 = Buffer.from(imageBuffer).toString("base64")
      const resultMimeType = result.data.image.content_type || "image/png"

      return Response.json({
        success: true,
        image: `data:${resultMimeType};base64,${resultBase64}`,
        width: result.data.image.width,
        height: result.data.image.height,
      })
    }

    return Response.json({ success: false, error: "No image returned" }, { status: 500 })
  } catch (error) {
    console.error("Upscale error:", error)
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
