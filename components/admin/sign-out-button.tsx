"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client/api";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {});
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut /> Sign out
    </Button>
  );
}
