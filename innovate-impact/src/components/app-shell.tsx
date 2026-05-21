"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FolderKanban, Users, Workflow, FileText, Settings, HelpCircle } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/workshop", label: "Workshop Studio", icon: Users },
  { href: "/agents", label: "Agent Workflow", icon: Workflow },
  { href: "/artifacts", label: "Artifacts", icon: FileText },
  { href: "/help", label: "Help", icon: HelpCircle },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-800/80 bg-ink-900/60 backdrop-blur">
        <div className="px-5 py-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <Image
              src="/workshop-buddy-logo.png"
              alt="Workshop Buddy"
              width={40}
              height={40}
              className="rounded-lg bg-white/95 p-0.5"
              priority
            />
            <div>
              <div className="font-semibold leading-tight">Workshop</div>
              <div className="text-xs text-accent leading-tight">Buddy</div>
            </div>
          </div>
        </div>
        <nav className="px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition",
                  active ? "bg-accent/15 text-accent" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4 space-y-3">
          <div className="flex items-center justify-center">
            <Image
              src="/microsoft-logo.svg"
              alt="Microsoft"
              width={108}
              height={23}
              className="opacity-80"
            />
          </div>
          <div className="text-[11px] text-slate-500 text-center">
            Demo build • AI-drafted content requires human review.
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-ink-900/80">
          <div className="flex items-center gap-2">
            <Image
              src="/workshop-buddy-logo.png"
              alt="Workshop Buddy"
              width={28}
              height={28}
              className="rounded-md bg-white/95 p-0.5"
              priority
            />
            <span className="font-semibold">Workshop Buddy</span>
          </div>
        </header>
        <div className="px-6 py-6 md:px-10 md:py-8">{children}</div>
      </main>
    </div>
  );
}
