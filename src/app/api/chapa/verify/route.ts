import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments, invoices, serviceOrders } from "@/db/schema";
import { eq } from "drizzle-orm";

const CHAPA_VERIFY_URL = "https://api.chapa.co/v1/transaction/verify";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const txRef = searchParams.get("tx_ref");
  const chapaRef = searchParams.get("chapa_ref");

  if (!txRef) {
    return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 });
  }

  const chapaSecret = process.env.CHAPA_SECRET;
  if (!chapaSecret) {
    return NextResponse.json({ error: "Chapa is not configured" }, { status: 500 });
  }

  try {
    const verifyRes = await fetch(`${CHAPA_VERIFY_URL}/${txRef}`, {
      headers: {
        Authorization: `Bearer ${chapaSecret}`,
      },
    });

    const verifyData = await verifyRes.json();

    if (verifyData.status !== "success" || verifyData.data?.status !== "success") {
      return NextResponse.json(
        { error: "Payment not completed", status: verifyData.data?.status },
        { status: 400 }
      );
    }

    // Extract orderId from txRef pattern: BERCHI-{orderIdPrefix}-{timestamp}
    const parts = txRef.split("-");
    const orderIdPrefix = parts[1];

    // Find the payment by chapaTxRef
    const payment = await db.query.payments.findFirst({
      where: eq(payments.chapaTxRef, txRef),
      with: { invoice: true },
    });

    if (payment && payment.invoice) {
      // Already processed
      return NextResponse.json({ status: "already_processed", invoiceId: payment.invoice.id });
    }

    return NextResponse.json({
      status: "success",
      txRef,
      chapaRef: chapaRef || verifyData.data?.reference,
      amount: verifyData.data?.amount,
    });
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

// POST: Verify and complete checkout after Chapa payment
export async function POST(req: Request) {
  const body = await req.json();
  const { txRef, orderId } = body as { txRef: string; orderId: string };

  if (!txRef || !orderId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const chapaSecret = process.env.CHAPA_SECRET;
  if (!chapaSecret) {
    return NextResponse.json({ error: "Chapa is not configured" }, { status: 500 });
  }

  try {
    const verifyRes = await fetch(`${CHAPA_VERIFY_URL}/${txRef}`, {
      headers: {
        Authorization: `Bearer ${chapaSecret}`,
      },
    });

    const verifyData = await verifyRes.json();

    if (verifyData.status !== "success" || verifyData.data?.status !== "success") {
      return NextResponse.json(
        { error: "Payment not verified", chapaStatus: verifyData.data?.status },
        { status: 400 }
      );
    }

    // Now proceed with the standard checkout flow with CHAPA method
    const checkoutRes = await fetch(
      `${process.env.AUTH_URL || "http://localhost:3000"}/api/orders/${orderId}/checkout`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "CHAPA",
          chapaTxRef: txRef,
        }),
      }
    );

    const result = await checkoutRes.json();

    if (!checkoutRes.ok) {
      return NextResponse.json({ error: result.error || "Checkout failed" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Verification and checkout failed" }, { status: 500 });
  }
}
