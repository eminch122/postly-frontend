import { Suspense } from "react"
import { SettingsPage } from "@/components/pages/settings-page"

export const metadata = { title: "Settings — Postly" }

export default function Settings() {
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  )
}
