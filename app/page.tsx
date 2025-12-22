import { SimpleRoomDesigner } from "@/components/simple-room-designer/SimpleRoomDesigner"
import { ThemeProvider } from "@/components/theme-provider"

export default function Home() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <SimpleRoomDesigner />
    </ThemeProvider>
  )
}
