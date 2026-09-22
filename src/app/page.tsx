import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

// Where each role lands, and the permission that page insists on.
//
// The two belong together because they have to agree. Every one of those pages
// sends a user who lacks the permission back here, so picking a destination
// without checking first bounces the browser between the two until it gives up
// -- ERR_TOO_MANY_REDIRECTS, with nothing in the log to say why. That is what an
// unseeded permissions table looks like from the outside: sign-in works, and
// then the app eats itself. Checking here costs one query and turns the loop
// into a sentence someone can act on.
const HOME_BY_ROLE = {
  SERVER: { path: "/server", permission: "orders.view" },
  CASHIER: { path: "/cashier", permission: "orders.checkout" },
  OWNER: { path: "/admin", permission: "dashboard.view" },
} as const;

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const home = HOME_BY_ROLE[session.user.role as keyof typeof HOME_BY_ROLE];

  // hasPermission swallows its own errors and returns false, so a database that
  // is down lands on the message below rather than in the loop.
  if (home && (await hasPermission(session.user.id, home.permission))) {
    redirect(home.path);
  }

  return <NoScreenToOpen role={session.user.role} />;
}

function NoScreenToOpen({ role }: { role: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/80 p-8 text-center shadow-xl shadow-pink-200/30 backdrop-blur-xl">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">
          There is no screen for this account yet
        </h1>
        <p className="mt-4 text-sm text-gray-600">
          You are signed in as <span className="font-semibold">{role}</span>, but that role has not
          been given access to anything, so there is nowhere to send you.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Whoever installed the salon needs to run the first-run setup against this database (
          <code className="rounded bg-pink-50 px-1.5 py-0.5 text-xs">npm run db:bootstrap</code>),
          then restart the app. Permission answers are cached for the life of the process, so the
          restart is not optional.
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="mt-6 h-11 w-full rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 text-sm font-semibold text-white shadow-lg shadow-pink-300/30 transition-all duration-300 hover:-translate-y-0.5"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
