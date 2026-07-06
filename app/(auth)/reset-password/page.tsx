import { Suspense } from "react"
import { ResetPasswordPage } from "@/components/pages/reset-password-page"

export const metadata = {
  title: "Reset Password — Postly",
  description: "Choose a new password for your Postly account",
}

export default function ResetPassword() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordPage />
    </Suspense>
  )
}
