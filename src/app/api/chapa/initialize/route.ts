import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { serviceOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fromSantim } from "@/lib/money";

const CHAPA_BASE_URL = "https://api.chapa.co/v1/transaction/initialize";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canCheckout = await hasPermission(session.user.id, "orders.checkout");
  if (!canCheckout) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { amount, email, firstName, lastName, orderId, phone } = body as {
    amount: number;
    email: string;
    firstName: string;
    lastName: string;
    orderId: string;
    phone?: string;
  };

  if (!amount || !email || !firstName || !lastName || !orderId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const order = await db.query.serviceOrders.findFirst({
    where: eq(serviceOrders.id, orderId),
    with: { customer: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const txRef = `BERCHI-${orderId.slice(0, 8)}-${Date.now()}`;

  const chapaSecret = process.env.CHAPA_SECRET;

  console.log("CHAPA_SECRET:", chapaSecret);
  if (!chapaSecret) {
    return NextResponse.json({ error: "Chapa is not configured" }, { status: 500 });
  }

  try {
    const chapaRes = await fetch(CHAPA_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chapaSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // The caller passes santim; Chapa wants ETB as a decimal string.
        amount: fromSantim(amount).toFixed(2),
        currency: "ETB",
        email,
        first_name: firstName,
        last_name: lastName,
        tx_ref: txRef,
        callback_url: `${process.env.AUTH_URL || "http://localhost:3000"}/api/chapa/verify`,
        return_url: `${process.env.AUTH_URL || "http://localhost:3000"}/cashier/checkout/${orderId}`,
        customization: {
          title: "Berchi Salon",
          description: `Payment for order ${order.orderNumber}`,
        },
      }),
    });

    const chapaData = await chapaRes.json();

    if (chapaData.status !== "success") {
      console.error("Chapa init failed:", JSON.stringify(chapaData));
      return NextResponse.json(
        { error: chapaData.message || chapaData.error || "Chapa initialization failed", details: chapaData },
        { status: 400 }
      );
    }

    return NextResponse.json({
      txRef,
      checkoutUrl: chapaData.data?.checkout_url,
      chapaRef: chapaData.data?.reference,
    });
  } catch {
    return NextResponse.json({ error: "Failed to initialize Chapa payment" }, { status: 500 });
  }
}
