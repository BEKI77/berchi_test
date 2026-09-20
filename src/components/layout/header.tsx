"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileNav } from "./mobile-nav";
import { endTabletSession } from "./session-mode";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";

const roleLabels: Record<string, string> = {
  SERVER: "Stylist",
  CASHIER: "Cashier",
  OWNER: "Owner",
};

const roleConfig: Record<string, { bg: string; text: string; dot: string }> = {
  SERVER: { bg: "bg-blue-50 border-blue-200/60", text: "text-blue-600", dot: "bg-blue-400" },
  CASHIER: { bg: "bg-emerald-50 border-emerald-200/60", text: "text-emerald-600", dot: "bg-emerald-400" },
  OWNER: { bg: "bg-violet-50 border-violet-200/60", text: "text-violet-600", dot: "bg-violet-400" },
};

export function Header({ user }: { user: SessionUser }) {
  const router = useRouter();
  const role = roleConfig[user.role];

  async function handleSignOut() {
    // On the shared tablet, "done" hands it to the next stylist.
    if (user.signedInWith === "pin") {
      await endTabletSession();
      return;
    }
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-pink-100/50 bg-white/80 backdrop-blur-lg px-4 md:px-6">
      <Sheet>
        <SheetTrigger
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "md:hidden rounded-xl hover:bg-pink-50")}
        >
          <Menu className="h-5 w-5 text-pink-500" />
          <span className="sr-only">Toggle menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <MobileNav role={user.role} />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <div className="flex items-center gap-2.5">
        {/* Role badge */}
        <div className={cn("hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border", role.bg, role.text)}>
          <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", role.dot)} />
          {roleLabels[user.role]}
        </div>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "flex items-center gap-2.5 h-10 px-3 rounded-xl hover:bg-pink-50/70 transition-colors"
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-rose-400 text-white text-xs font-bold shadow-sm">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <span className="hidden sm:inline text-sm font-medium">
              {user.firstName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-rose-400 text-white text-sm font-bold shadow-sm">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold">{user.firstName} {user.lastName}</span>
                    {user.signedInWith !== "pin" && (
                      <span className="text-xs text-muted-foreground font-normal">
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-red-500 cursor-pointer rounded-lg mx-1 focus:bg-red-50 focus:text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Switch User / Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Logout button (desktop) */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="hidden sm:flex items-center gap-2 rounded-xl text-rose-500 border-rose-200/60 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 transition-all duration-200"
        >
          <LogOut className="h-3.5 w-3.5" />
          {user.signedInWith === "pin" ? "Done · switch stylist" : "Log Out"}
        </Button>
      </div>
    </header>
  );
}
