import { Suspense } from "react"
import { OnboardingPage } from "@/components/pages/onboarding-page"

export const metadata = {
  title: "Get Started — Postly",
  description: "Complete your Postly setup in just a few minutes",
}

export default function Onboarding() {
  return (
    <Suspense fallback={null}>
      <OnboardingPage />
    </Suspense>
  )
}
