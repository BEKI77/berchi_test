import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    switch (session.user.role) {
      case "SERVER":
        redirect("/server");
      case "CASHIER":
        redirect("/cashier");
      case "OWNER":
        redirect("/admin");
    }
  }

  redirect("/login");
}
