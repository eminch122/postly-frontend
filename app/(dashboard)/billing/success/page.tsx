import { Suspense } from "react"
import { CheckoutSuccessPage } from "@/components/pages/checkout-success-page"

export const metadata = { title: "Payment successful — Postly" }

export default function Success() {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccessPage />
    </Suspense>
  )
}
