"use client"

import { removeBackground as removeBackgroundFn } from "@imgly/background-removal"

export async function removeBackground(imageUrl: string): Promise<string> {
  try {
    // Convert data URL to blob if needed
    let blob: Blob
    if (imageUrl.startsWith("data:")) {
      const response = await fetch(imageUrl)
      blob = await response.blob()
    } else {
      const response = await fetch(imageUrl)
      blob = await response.blob()
    }

    // Remove background
    const resultBlob = await removeBackgroundFn(blob, {
      progress: (key, current, total) => {
        console.log(`[v0] Background removal: ${key} ${current}/${total}`)
      },
    })

    // Convert result to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(resultBlob)
    })
  } catch (error) {
    console.error("[v0] Background removal failed:", error)
    throw error
  }
}
