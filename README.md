# Image Lab

AI-powered image generation and editing tool built with Next.js.

Originally built and tested for a furniture company to stage products into room photos, but designed to work for any use case — product shots, interior design, creative mockups, or anything you can describe.

## What makes it different

When your prompt is ambiguous, the AI asks clarifying questions directly in the UI before generating. For example, if you write "remove the chair" and there are multiple chairs, it'll ask which one. This means fewer wasted generations and better results.

## Features

- **Create** — Generate images from text prompts with optional reference images
- **Edit** — Select areas with lasso and describe changes in natural language
- **References** — Drop numbered reference images onto a scene to guide generation
- **Smart clarification** — AI analyzes your prompt and asks follow-up questions when needed
- **Upscale** — Enhance image resolution with AI upscaling
- **Background removal** — Remove backgrounds from any image

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
