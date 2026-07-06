"use client"

import Link from "next/link"
import {
  ArrowRight, BarChart3, Sparkles, Zap, Users,
  TrendingUp, Calendar, CheckCircle2, Twitter,
  Instagram, Linkedin, Facebook, Star, Play,
  Shield, Clock, Globe
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/* ─── Ticker ─── */
const tickerItems = [
  { icon: Twitter, text: "12.4K tweets scheduled today" },
  { icon: Instagram, text: "98% avg. engagement boost" },
  { icon: TrendingUp, text: "2.5B posts published" },
  { icon: Users, text: "50,000+ active teams" },
  { icon: Star, text: "Rated 4.9/5 on G2" },
  { icon: Linkedin, text: "Top-rated LinkedIn tool 2025" },
]

function Ticker() {
  return (
    <div className="border-b border-border bg-secondary overflow-hidden py-2.5">
      <div
        className="flex w-max"
        style={{ animation: "ticker-scroll 28s linear infinite" }}
      >
        {[...tickerItems, ...tickerItems].map((item, i) => {
          const Icon = item.icon
          return (
            <div
              key={i}
              className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap"
              style={{ marginRight: 64 }}
            >
              <Icon className="w-3.5 h-3.5 text-brand shrink-0" />
              {item.text}
              <span className="text-border ml-6">✦</span>
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes ticker-scroll { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes float-y { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        .animate-float { animation: float-y 5s ease-in-out infinite }
        .animate-fade-up { animation: fade-up 0.6s ease both }
        .delay-100 { animation-delay: 0.1s }
        .delay-200 { animation-delay: 0.2s }
        .delay-300 { animation-delay: 0.3s }
        .delay-400 { animation-delay: 0.4s }
      `}</style>
    </div>
  )
}

/* ─── Dashboard mock ─── */
function DashMock() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl animate-float">
      {/* Topbar */}
      <div className="bg-secondary border-b border-border px-4 py-3 flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
        <span className="ml-3 text-[11px] font-mono text-muted-foreground">postly.app/dashboard</span>
      </div>
      {/* Stats */}
      <div className="p-4 grid grid-cols-3 gap-3">
        {[
          { label: "Reach", value: "1.2M", delta: "+18%" },
          { label: "Engagements", value: "84K", delta: "+31%" },
          { label: "Scheduled", value: "47", delta: "this week" },
        ].map((s) => (
          <div key={s.label} className="bg-secondary rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{s.label}</p>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[11px] text-brand mt-0.5">{s.delta}</p>
          </div>
        ))}
      </div>
      {/* Bar chart */}
      <div className="px-4 pb-4 flex items-end gap-1.5 h-20">
        {[35, 55, 45, 70, 60, 85, 78, 92, 68, 88, 74, 96].map((h, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-sm transition-all",
              i === 11 ? "bg-brand" : "bg-brand/20"
            )}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      {/* Posts preview */}
      <div className="border-t border-border px-4 py-3 space-y-2.5">
        {[
          { platform: "Twitter", time: "2:00 PM", status: "Scheduled" },
          { platform: "Instagram", time: "5:30 PM", status: "Draft" },
        ].map((p) => (
          <div key={p.platform} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                {p.platform === "Twitter"
                  ? <Twitter className="w-3.5 h-3.5 text-muted-foreground" />
                  : <Instagram className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <span className="text-sm text-foreground">{p.platform}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{p.time}</span>
              <Badge
                className={cn(
                  "text-[10px] border-0",
                  p.status === "Scheduled"
                    ? "bg-brand-soft text-brand"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {p.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Main ─── */
const features = [
  { icon: Calendar, title: "Smart Scheduling", description: "Post at the exact moment your audience is most active, powered by ML time-slot predictions." },
  { icon: BarChart3, title: "Deep Analytics", description: "Real-time engagement data with AI-predicted trend curves and cohort comparisons." },
  { icon: Sparkles, title: "AI Copilot", description: "Draft captions, remix content, and get live optimization tips — all from one prompt." },
  { icon: Users, title: "Team Collaboration", description: "Multi-role workflows with approval gates, comment threads, and brand-voice locking." },
  { icon: TrendingUp, title: "Trend Intelligence", description: "Spot viral topics 48 hours early with Postly's proprietary signal network." },
  { icon: Zap, title: "Multi-Channel", description: "Unified inbox and composer for Instagram, X, LinkedIn, Facebook, TikTok, and more." },
]

const steps = [
  { n: "01", title: "Connect your accounts", sub: "OAuth in seconds. Zero setup headaches." },
  { n: "02", title: "Plan your content calendar", sub: "Drag-and-drop, AI fill, or bulk upload." },
  { n: "03", title: "Publish at peak times", sub: "Automatic time-slot optimisation per platform." },
  { n: "04", title: "Analyze and compound", sub: "Reinvest insights into your next content cycle." },
]

const testimonials = [
  { name: "Sofia M.", role: "Head of Growth, Nexara", text: "Postly tripled our LinkedIn reach in 6 weeks. The AI suggestions are eerily good.", stars: 5 },
  { name: "Ravi K.", role: "Founder, Loopcraft", text: "Finally a social tool that doesn't feel like it was designed in 2015.", stars: 5 },
  { name: "Ines T.", role: "Brand Director, Stratos", text: "Our team went from 4 hours of scheduling to under 30 minutes a week.", stars: 5 },
]

const stats = [
  { num: "50K+", label: "Active teams" },
  { num: "2.5B", label: "Posts scheduled" },
  { num: "98%", label: "Satisfaction rate" },
  { num: "4.9★", label: "Average rating" },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Ticker />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-border, rgba(255,255,255,0.05)) 1px, transparent 1px), linear-gradient(90deg, var(--color-border, rgba(255,255,255,0.05)) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            opacity: 0.4,
          }}
        />
        {/* Glow orb */}
        <div className="absolute -top-24 -right-24 w-[480px] h-[480px] rounded-full bg-brand/10 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 -left-32 w-[320px] h-[320px] rounded-full bg-brand/5 blur-[80px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center min-h-[88vh]">
          {/* Left */}
          <div className="animate-fade-up">
            <Badge className="mb-6 bg-brand-soft text-brand border-0 uppercase tracking-wider text-[10px] font-semibold px-3 py-1.5">
              <Sparkles className="w-3 h-3 mr-1.5" />
              AI-Powered Social Intelligence
            </Badge>

            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.08] mb-6">
              Social media,{" "}
              <span className="bg-gradient-to-r from-brand via-brand/80 to-brand/50 bg-clip-text text-transparent">
                supercharged
              </span>{" "}
              by AI.
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8 delay-100 animate-fade-up">
              Schedule smarter, grow faster, and understand your audience with the only social platform built for the AI era.
            </p>

            <div className="flex flex-wrap gap-3 mb-8 delay-200 animate-fade-up">
              <Button
                asChild
                size="lg"
                className="bg-brand hover:bg-brand/90 text-background font-semibold gap-2 px-6"
              >
                <Link href="/signup">
                  Start free — no card needed
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-2 border-border hover:bg-secondary"
              >
                <a href="#demo">
                  <Play className="w-4 h-4" />
                  Watch demo
                </a>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground delay-300 animate-fade-up">
              {["14-day free trial", "Cancel anytime", "SOC 2 certified"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="relative delay-400 animate-fade-up">
            <div className="absolute inset-0 bg-brand/5 blur-3xl rounded-full pointer-events-none" />
            <DashMock />
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-border bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
            {stats.map((s) => (
              <div key={s.label} className="py-8 px-6 text-center">
                <p className="text-4xl font-bold text-brand mb-1">{s.num}</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-brand-soft text-brand border-0 uppercase tracking-wider text-[10px] font-semibold">
              Features
            </Badge>
            <h2 className="text-4xl font-bold text-foreground tracking-tight mb-4">
              Everything your team{" "}
              <span className="bg-gradient-to-r from-brand to-brand/50 bg-clip-text text-transparent">
                actually needs
              </span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              One platform to plan, publish, analyze, and grow — across every channel that matters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-6 hover:border-brand/30 hover:shadow-md transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-10 h-10 rounded-xl bg-brand-soft border border-brand/20 flex items-center justify-center mb-4">
                  <f.icon className="w-4 h-4 text-brand" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 bg-secondary/40 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <Badge className="mb-6 bg-brand-soft text-brand border-0 uppercase tracking-wider text-[10px] font-semibold">
              How it works
            </Badge>
            <h2 className="text-4xl font-bold text-foreground tracking-tight mb-10">
              Live in minutes,{" "}
              <span className="bg-gradient-to-r from-brand to-brand/50 bg-clip-text text-transparent">
                results in days.
              </span>
            </h2>
            <div className="space-y-0">
              {steps.map((s, i) => (
                <div key={i}>
                  <div className="flex gap-5 items-start">
                    <div className="w-10 h-10 shrink-0 rounded-xl bg-brand-soft border border-brand/25 flex items-center justify-center text-[11px] font-bold text-brand tracking-wide">
                      {s.n}
                    </div>
                    <div className="pb-1">
                      <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.sub}</p>
                    </div>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="ml-[19px] w-px h-8 bg-gradient-to-b from-brand/40 to-transparent my-1" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI Copilot mock */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl animate-float">
            {/* Header */}
            <div className="bg-secondary border-b border-border px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-brand-soft border border-brand/20 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-brand" />
              </div>
              <span className="text-sm font-semibold text-foreground">AI Copilot</span>
              <Badge className="ml-auto text-[10px] bg-success-soft text-success border-0">Live</Badge>
            </div>
            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="bg-secondary rounded-xl p-4 text-sm text-muted-foreground italic leading-relaxed">
                "Write a LinkedIn post about our Q4 growth announcement. Keep it professional but punchy."
              </div>
              <div className="text-sm text-foreground leading-relaxed">
                🚀 Q4 was a milestone quarter — the numbers say it all. We grew 180% YoY, onboarded our 50,000th team, and shipped 12 major updates. None of this happens without{" "}
                <strong className="text-brand">you</strong>. Thank you for building with us.
              </div>
              <div className="flex flex-wrap gap-2">
                {["Shorter", "More casual", "Add emoji"].map((op) => (
                  <span
                    key={op}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  >
                    {op}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  Score: <strong className="text-brand">91/100</strong> engagement prediction
                </span>
                <Button
                  asChild
                  size="sm"
                  className="bg-brand hover:bg-brand/90 text-background text-xs h-8"
                >
                  <Link href="/signup">Use this →</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-brand-soft text-brand border-0 uppercase tracking-wider text-[10px] font-semibold">
              Testimonials
            </Badge>
            <h2 className="text-4xl font-bold text-foreground tracking-tight">
              Loved by{" "}
              <span className="bg-gradient-to-r from-brand to-brand/50 bg-clip-text text-transparent">
                high-growth teams
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-6 hover:border-brand/20 transition-colors">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-brand text-brand" />
                  ))}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-5 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-soft border border-brand/20 flex items-center justify-center text-sm font-bold text-brand shrink-0">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust badges ── */}
      <section className="py-12 border-y border-border bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "SOC 2 Certified", sub: "Enterprise-grade security" },
              { icon: Globe, title: "99.9% Uptime", sub: "Built for reliability" },
              { icon: Clock, title: "14-Day Free Trial", sub: "No credit card required" },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-soft border border-brand/20 flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4 text-brand" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-card border border-brand/20 rounded-3xl p-12 text-center relative overflow-hidden shadow-lg shadow-brand/5">
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-brand/5 pointer-events-none" />
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-brand/10 blur-[80px] rounded-full pointer-events-none" />

            <div className="relative">
              <Badge className="mb-6 bg-brand-soft text-brand border-0 uppercase tracking-wider text-[10px] font-semibold">
                Get started today
              </Badge>
              <h2 className="text-4xl lg:text-5xl font-bold text-foreground tracking-tight mb-4">
                Your audience is waiting.{" "}
                <span className="bg-gradient-to-r from-brand to-brand/50 bg-clip-text text-transparent">
                  Don't keep them.
                </span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-8">
                Join 50,000 teams already using Postly to grow smarter on social media.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  asChild
                  size="lg"
                  className="bg-brand hover:bg-brand/90 text-background font-semibold gap-2 px-8"
                >
                  <Link href="/signup">
                    Start your free trial
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="gap-2 border-border hover:bg-secondary"
                >
                  <Link href="/demo">Book a demo</Link>
                </Button>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">14 days free. No credit card. Cancel anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-brand/60 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-background" />
            </div>
            <span className="font-bold text-foreground">Postly</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            {["Privacy", "Terms", "Status", "Docs"].map((l) => (
              <a key={l} href="#" className="hover:text-foreground transition-colors">
                {l}
              </a>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">© 2025 Postly, Inc.</p>
        </div>
      </footer>
    </div>
  )
}