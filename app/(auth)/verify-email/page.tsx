import { Suspense } from "react"
import { VerifyEmailPage } from "@/components/pages/verify-email-page"

export const metadata = {
  title: "Verify Email — Postly",
  description: "Confirm your Postly email address",
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPage />
    </Suspense>
  )
}
