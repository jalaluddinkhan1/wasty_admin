"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getInitials } from "@/lib/utils";
import { destroySession } from "@/server/auth-actions";

export type SessionAccount = {
  name: string;
  email: string;
  role: string;
};

export function AccountSwitcher({ user }: { user: SessionAccount }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await destroySession();
      const auth = getFirebaseAuth();
      if (auth) await signOut(auth).catch(() => undefined);
      router.push("/auth/v2/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="size-8 rounded-lg">
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 rounded-lg" side="bottom" align="end" sideOffset={4}>
        <DropdownMenuLabel className="font-normal">
          <div className="grid text-sm leading-tight">
            <span className="truncate font-semibold">{user.name}</span>
            <span className="truncate text-muted-foreground text-xs">{user.email}</span>
            <span className="mt-1 text-muted-foreground text-xs">{user.role}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onClick={() => void handleLogout()}>
          <LogOut />
          {pending ? "Signing out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
