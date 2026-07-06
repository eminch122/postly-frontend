import { AppShell } from "@/components/layout/app-shell"
import { NotificationsProvider } from "@/lib/notifications-context"
import { Toaster } from "@/components/ui/sonner"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationsProvider>
      <AppShell>{children}</AppShell>
      <Toaster position="top-right" richColors closeButton />
    </NotificationsProvider>
  )
}
