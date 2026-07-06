import { Suspense } from "react"
import { LoginPage } from "@/components/pages/login-page"

export const metadata = {
  title: "Sign In — Postly",
  description: "Sign in to your Postly account",
}

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  )
}
