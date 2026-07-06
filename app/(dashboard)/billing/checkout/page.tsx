import { Suspense } from "react"
import { CheckoutPage } from "@/components/pages/checkout-page"

export const metadata = { title: "Checkout — Postly" }

export default function Checkout() {
  // useSearchParams must be in a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <CheckoutPage />
    </Suspense>
  )
}
