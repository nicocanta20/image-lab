import { RoomDesigner } from "@/components/room-designer"
import { ThemeProvider } from "@/components/theme-provider"

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <main className="min-h-screen bg-background">
        <RoomDesigner />
      </main>
    </ThemeProvider>
  )
}
