# Image Lab

AI-powered image generation and editing tool built with Next.js.

Upload images, add references, and use AI to create, edit, and transform visuals — from interior design to product shots to anything you can describe.

## Features

- **Create** — Generate images from text prompts with optional reference images
- **Edit** — Modify existing images using lasso selection and natural language
- **Add References** — Place reference objects into scenes with numbered markers
- **Upscale** — Enhance image resolution
- **Background Removal** — Remove backgrounds from any image

## Tech Stack

- **Framework**: Next.js 16 / React 19
- **AI Models**: Gemini (via AI SDK Gateway)
- **Image Processing**: fal.ai, @imgly/background-removal
- **Styling**: Tailwind CSS 4, Radix UI
- **Deployment**: Vercel

## Getting Started

```bash
pnpm install
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

You'll need to set up environment variables for the AI SDK Gateway and fal.ai API keys.
