import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "./permissions";

/**
 * Wrapper function for API routes that handles authentication and permission checking
 */
export async function withAuthAndPermission(
  request: NextRequest,
  requiredPermission: string,
  handler: (request: NextRequest, userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    const hasRequiredPermission = await hasPermission(session.user.id, requiredPermission);
    if (!hasRequiredPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Execute handler
    return await handler(request, session.user.id);
  } catch (error) {
    console.error("API wrapper error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Simplified wrapper for read operations (view permissions)
 */
export async function withReadPermission(
  request: NextRequest,
  resource: string,
  handler: (request: NextRequest, userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuthAndPermission(request, `${resource}.view`, handler);
}

/**
 * Simplified wrapper for create operations
 */
export async function withCreatePermission(
  request: NextRequest,
  resource: string,
  handler: (request: NextRequest, userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuthAndPermission(request, `${resource}.create`, handler);
}

/**
 * Simplified wrapper for update operations
 */
export async function withUpdatePermission(
  request: NextRequest,
  resource: string,
  handler: (request: NextRequest, userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuthAndPermission(request, `${resource}.update`, handler);
}

/**
 * Simplified wrapper for delete operations
 */
export async function withDeletePermission(
  request: NextRequest,
  resource: string,
  handler: (request: NextRequest, userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuthAndPermission(request, `${resource}.delete`, handler);
}
