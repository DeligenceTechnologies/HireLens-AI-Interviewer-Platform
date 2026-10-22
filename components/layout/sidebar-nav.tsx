"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, FileStack, LayoutDashboard, LifeBuoy, Settings, Users, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/interviews", label: "Interviews", icon: Video },
  { href: "/templates", label: "Templates", icon: FileStack },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help and support", icon: LifeBuoy },
];

/** `hidden` lists nav hrefs the current role can't open (computed on the server). */
export function SidebarNav({ onNavigate, hidden = [] }: { onNavigate?: () => void; hidden?: string[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((n) => !hidden.includes(n.href)).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
