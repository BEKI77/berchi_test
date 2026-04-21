import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPermissions } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = await getUserPermissions(session.user.id);

    return NextResponse.json({
      permissions,
      permissionNames: permissions.map((p) => p.name),
    });
  } catch (error) {
    console.error("Error fetching current user permissions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
