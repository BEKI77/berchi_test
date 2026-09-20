"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Delete, Lock, Scissors } from "lucide-react";
import { MAX_PIN_ATTEMPTS, PIN_LENGTH, PIN_LOCK_MINUTES } from "@/lib/pin-config";

type Stylist = { id: string; name: string; locked: boolean };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

// The shared tablet's sign-in: pick your name, tap your PIN. It signs in the
// moment the last digit goes in, so a stylist is in after four taps.
export default function TabletPage() {
  const router = useRouter();
  const [stylists, setStylists] = useState<Stylist[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "off" | "error">("loading");
  const [selected, setSelected] = useState<Stylist | null>(null);
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [wrong, setWrong] = useState(false);
  const [signedOutNotice, setSignedOutNotice] = useState("");

  const loadStylists = useCallback(async () => {
    try {
      const res = await fetch("/api/tablet/staff", { cache: "no-store" });
      if (res.status === 404) return setStatus("off");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStylists(data.staff);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadStylists();
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "idle") setSignedOutNotice("Signed out because the tablet was idle.");
  }, [loadStylists]);

  function pick(s: Stylist) {
    setSelected(s);
    setDigits("");
    setMessage("");
    setWrong(false);
    setSignedOutNotice("");
  }

  function back() {
    setSelected(null);
    setDigits("");
    setMessage("");
    setWrong(false);
    loadStylists(); // pick up a lock that just started
  }

  const submit = useCallback(
    async (pin: string) => {
      if (!selected) return;
      setBusy(true);
      setMessage("");
      try {
        const result = await signIn("pin", { staffId: selected.id, pin, redirect: false });
        if (!result?.error) {
          router.push("/server");
          router.refresh();
          return;
        }
        setDigits("");
        setWrong(true);
        const code = result.code ?? "";
        if (code === "pin_locked") {
          setMessage(`Too many wrong tries. Wait ${PIN_LOCK_MINUTES} minutes, or ask the owner to reset your PIN.`);
        } else if (code.startsWith("pin_wrong_")) {
          const left = Number(code.slice("pin_wrong_".length));
          setMessage(`Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.`);
        } else {
          setMessage("That did not work. Try again.");
        }
      } catch {
        setDigits("");
        setMessage("Could not reach the salon computer. Check the Wi-Fi.");
      } finally {
        setBusy(false);
      }
    },
    [selected, router]
  );

  const press = useCallback(
    (d: string) => {
      if (busy) return;
      setWrong(false);
      setDigits((cur) => {
        if (cur.length >= PIN_LENGTH) return cur;
        const next = cur + d;
        if (next.length === PIN_LENGTH) setTimeout(() => submit(next), 120); // let the last dot fill in first
        return next;
      });
    },
    [busy, submit]
  );

  const erase = useCallback(() => {
    if (busy) return;
    setWrong(false);
    setDigits((cur) => cur.slice(0, -1));
  }, [busy]);

  // A physical keyboard works too: handy for testing, and for a tablet with one.
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") erase();
      else if (e.key === "Escape") back();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- back() only reloads the list; press/erase are stable enough per render
  }, [selected, press, erase]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50" />

      <div className="relative w-full max-w-2xl">
        <div className="rounded-3xl border border-white/60 bg-white/85 shadow-2xl shadow-pink-200/30 backdrop-blur-xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400" />

          <div className="px-6 sm:px-10 pt-8 pb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 shadow-md shadow-pink-300/40">
                <Scissors className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-rose-700">Berchi Salon</h1>
                <p className="text-sm text-muted-foreground">
                  {selected ? "Enter your PIN" : "Who is working?"}
                </p>
              </div>
            </div>

            {signedOutNotice && !selected && (
              <p className="mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
                {signedOutNotice}
              </p>
            )}

            {status === "loading" && (
              <div className="py-20 flex justify-center">
                <div className="h-9 w-9 rounded-full border-[3px] border-pink-200 border-t-pink-500 animate-spin" />
              </div>
            )}

            {status === "off" && (
              <div className="py-14 text-center space-y-4">
                <p className="text-base">PIN sign-in is not turned on here.</p>
                <Link href="/login" className="inline-block rounded-xl bg-rose-500 px-6 py-3 font-semibold text-white">
                  Sign in with email
                </Link>
              </div>
            )}

            {status === "error" && (
              <div className="py-14 text-center space-y-4">
                <p className="text-base">Could not reach the salon computer. Check the Wi-Fi.</p>
                <button onClick={loadStylists} className="rounded-xl bg-rose-500 px-6 py-3 font-semibold text-white">
                  Try again
                </button>
              </div>
            )}

            {status === "ready" && !selected && (
              <>
                {stylists.length === 0 ? (
                  <p className="py-14 text-center text-muted-foreground">
                    No stylist has a PIN yet. The owner can set one under Staff.
                  </p>
                ) : (
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {stylists.map((s) => (
                      <button
                        key={s.id}
                        disabled={s.locked}
                        onClick={() => pick(s)}
                        className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-pink-100 bg-white px-3 py-5 min-h-[7.5rem] text-center transition-all hover:border-pink-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:hover:border-pink-100 disabled:hover:shadow-none focus-visible:outline-2 focus-visible:outline-rose-500"
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-rose-400 text-lg font-bold text-white">
                          {s.locked ? <Lock className="h-5 w-5" /> : s.name[0]}
                        </span>
                        <span className="text-base font-semibold leading-tight">{s.name}</span>
                        {s.locked && <span className="text-xs text-muted-foreground">Locked for a few minutes</span>}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-8 text-center text-sm text-muted-foreground">
                  Cashier or owner?{" "}
                  <Link href="/login" className="font-semibold text-rose-600 underline underline-offset-2">
                    Sign in with email
                  </Link>
                </p>
              </>
            )}

            {status === "ready" && selected && (
              <div className="mt-4 flex flex-col items-center">
                <button
                  onClick={back}
                  className="self-start inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-pink-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Not you?
                </button>

                <p className="mt-2 text-xl font-semibold">{selected.name}</p>

                <div
                  role="status"
                  aria-live="polite"
                  aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}
                  className={`mt-5 flex gap-4 ${wrong ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
                >
                  {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-4 w-4 rounded-full border-2 transition-colors ${i < digits.length ? "border-rose-500 bg-rose-500" : "border-pink-300"} ${wrong ? "border-red-500" : ""}`}
                    />
                  ))}
                </div>

                <p className={`mt-3 h-10 max-w-xs text-center text-sm ${wrong ? "text-red-600" : "text-muted-foreground"}`}>
                  {message || (busy ? "Checking..." : `${MAX_PIN_ATTEMPTS} tries before it locks`)}
                </p>

                <div className="mt-2 grid grid-cols-3 gap-3">
                  {KEYS.map((d) => (
                    <PadKey key={d} label={d} onPress={() => press(d)} disabled={busy} />
                  ))}
                  <span />
                  <PadKey label="0" onPress={() => press("0")} disabled={busy} />
                  <button
                    type="button"
                    aria-label="Delete last digit"
                    onClick={erase}
                    disabled={busy}
                    className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full text-muted-foreground hover:bg-pink-50 active:scale-95 disabled:opacity-50"
                  >
                    <Delete className="h-6 w-6" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PadKey({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      aria-label={`Digit ${label}`}
      onClick={onPress}
      disabled={disabled}
      className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-2 border-pink-100 bg-white text-2xl font-semibold tabular-nums transition-all hover:border-pink-300 hover:bg-pink-50 active:scale-95 active:bg-pink-100 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
