import { Suspense } from "react"
import { SignupPage } from "@/components/pages/signup-page"

export const metadata = {
  title: "Create Account — Postly",
  description: "Create your Postly account and get started for free",
}

export default function Signup() {
  return (
    <Suspense fallback={null}>
      <SignupPage />
    </Suspense>
  )
}
