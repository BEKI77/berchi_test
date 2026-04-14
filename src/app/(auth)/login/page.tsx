"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Scissors, Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email or password");
        setIsLoading(false);
        return;
      }

      toast.success("Welcome back!");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50" />
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: "radial-gradient(circle at 20% 50%, rgba(236,72,153,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(168,85,247,0.08) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(244,114,182,0.06) 0%, transparent 50%)"
      }} />

      {/* Floating decorations */}
      <div className="absolute top-[15%] left-[10%] opacity-20" style={{ animation: "float 6s ease-in-out infinite" }}>
        <Scissors className="h-8 w-8 text-pink-400 rotate-45" />
      </div>
      <div className="absolute top-[25%] right-[15%] opacity-15" style={{ animation: "float 8s ease-in-out infinite 1s" }}>
        <Heart className="h-6 w-6 text-rose-400" />
      </div>
      <div className="absolute bottom-[20%] left-[20%] opacity-15" style={{ animation: "float 7s ease-in-out infinite 2s" }}>
        <Sparkles className="h-7 w-7 text-fuchsia-400" />
      </div>
      <div className="absolute bottom-[30%] right-[10%] opacity-20" style={{ animation: "float 5s ease-in-out infinite 0.5s" }}>
        <Heart className="h-5 w-5 text-pink-300" />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-[420px]">
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-pink-200 via-rose-200 to-fuchsia-200 opacity-50 blur-lg" />
        <div className="relative rounded-2xl border border-white/60 bg-white/80 shadow-2xl shadow-pink-200/30 backdrop-blur-xl overflow-hidden">
          {/* Top gradient strip */}
          <div className="h-1.5 bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400" />

          {/* Header */}
          <div className="text-center pt-10 pb-2 px-8">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 shadow-lg shadow-pink-300/40" style={{ animation: "float 4s ease-in-out infinite" }}>
              <Scissors className="h-10 w-10 text-white drop-shadow-sm" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-600 via-rose-600 to-fuchsia-600 bg-clip-text text-transparent">
              Berchi Salon
            </h1>
            <p className="mt-2 text-sm text-muted-foreground flex items-center justify-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-pink-400" />
              Welcome back, beautiful
              <Sparkles className="h-3.5 w-3.5 text-pink-400" />
            </p>
          </div>

          {/* Form */}
          <div className="px-8 pb-10 pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground/80">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@berchi.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 rounded-xl border-pink-100 bg-pink-50/40 text-base placeholder:text-pink-300 focus:border-pink-300 focus:ring-pink-200 transition-all duration-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground/80">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 rounded-xl border-pink-100 bg-pink-50/40 text-base placeholder:text-pink-300 focus:border-pink-300 focus:ring-pink-200 transition-all duration-200"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-xl text-base font-semibold bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 hover:from-pink-600 hover:via-rose-600 hover:to-fuchsia-600 shadow-lg shadow-pink-300/30 hover:shadow-pink-400/40 transition-all duration-300 hover:-translate-y-0.5"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In
                    <Heart className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
