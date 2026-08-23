import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { hasPermission } from "@/lib/permissions";
import {
  serviceOrders, invoices, payments, products,
  stockMovements, commissionLogs, salonSettings,
  productUsageLogs,
} from "@/db/schema";
import type { DiscountType, PaymentMethod } from "@/db/schema";
import { nextInvoiceNumber, getSalonTimezone } from "@/lib/order-numbers";
import { isOrderEditable } from "@/lib/orders";
import { toSantim, toBasisPoints, applyRate, sumSantim, formatMoney } from "@/lib/money";

// POST: Checkout an order — create invoice + payment, update stock, log commissions
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canCheckout = await hasPermission(session.user.id, "orders.checkout");
  if (!canCheckout) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;
  const body = await req.json();
  const {
    discountType,
    discountValue = 0,
    tipAmount = 0,
    // The till has a single Confirm Payment button and sends no method, so
    // this defaults to CASH. It stays in the payload because the Chapa routes
    // still pass CHAPA, and reporting can split by method if that is turned on.
    paymentMethod = "CASH",
    chapaTxRef,
  }: {
    discountType?: DiscountType;
    discountValue?: number;
    tipAmount?: number;
    paymentMethod?: PaymentMethod;
    chapaTxRef?: string;
  } = body;

  const order = await db.query.serviceOrders.findFirst({
    where: eq(serviceOrders.id, orderId),
    with: {
      items: {
        with: { 
          service: {
            with: { consumables: true }
          }, 
          staff: true,
          consumablesUsed: true 
        },
      },
      products: {
        with: { product: true },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Any ticket that is still open can be paid. Sending to the cashier is a
  // signal that the stylist is finished, not a precondition -- a walk-in who
  // only buys a product never gets "sent" at all.
  if (!isOrderEditable(order.status)) {
    return NextResponse.json(
      { error: "This ticket has already been closed" },
      { status: 409 }
    );
  }

  // Every figure below is an integer: santim for money, basis points for
  // rates. The request carries human units (ETB, percent), so it is converted
  // once here at the edge and never turned back into a float.
  const tipSantim = toSantim(tipAmount);
  const discountFixedSantim = discountType === "FIXED" ? toSantim(discountValue) : 0;
  const discountRateBp = discountType === "PERCENTAGE" ? toBasisPoints(discountValue) : 0;

  // unitPrice is already santim, so these sums are exact.
  const servicesSubtotal = sumSantim(
    order.items.map((item) => item.unitPrice * item.quantity)
  );
  const productsSubtotal = sumSantim(
    order.products.map((p) => p.unitPrice * p.quantity)
  );
  const subtotal = servicesSubtotal + productsSubtotal;

  const [settings] = await db.select().from(salonSettings).limit(1);
  const taxRateBp = settings?.taxRate ?? 0;
  const taxAmount = applyRate(subtotal, taxRateBp);

  const discountAmount =
    discountType === "PERCENTAGE"
      ? applyRate(subtotal, discountRateBp)
      : discountType === "FIXED"
        ? discountFixedSantim
        : 0;

  if (discountAmount > subtotal + taxAmount) {
    return NextResponse.json(
      { error: `Discount of ${formatMoney(discountAmount)} is more than the bill` },
      { status: 400 }
    );
  }
  if (tipSantim < 0 || discountAmount < 0) {
    return NextResponse.json(
      { error: "Discount and tip cannot be negative" },
      { status: 400 }
    );
  }

  const totalAmount = subtotal + taxAmount - discountAmount + tipSantim;

  const timeZone = await getSalonTimezone();

  // Use a transaction to ensure atomicity
  const result = await db.transaction(async (tx) => {
    // 1. Create invoice. The number is allocated inside the transaction, from a
    // counter row rather than a count of today's rows, so two tills closing at
    // the same moment cannot mint the same invoice number.
    const invoiceNumber = await nextInvoiceNumber(tx, timeZone);

    const [invoice] = await tx
      .insert(invoices)
      .values({
        invoiceNumber,
        orderId,
        subtotal,
        taxRate: taxRateBp,
        taxAmount,
        discountType: discountType || null,
        // Basis points for a percentage discount, santim for a fixed one --
        // the unit follows discountType, as it always has.
        discountValue: discountType === "PERCENTAGE" ? discountRateBp : discountFixedSantim,
        discountAmount,
        tipAmount: tipSantim,
        totalAmount,
        status: "PAID",
      })
      .returning();

    // 2. Create payment
    const [payment] = await tx
      .insert(payments)
      .values({
        invoiceId: invoice.id,
        method: paymentMethod,
        amount: totalAmount,
        ...(chapaTxRef ? { chapaTxRef } : {}),
      })
      .returning();

    // 3. Update order status
    await tx
      .update(serviceOrders)
      .set({ status: "CHECKED_OUT" })
      .where(eq(serviceOrders.id, orderId));

    // 4. Decrement product stock and create stock movements
    for (const orderProduct of order.products) {
      await tx
        .update(products)
        .set({
          quantityOnHand: sql`${products.quantityOnHand} - ${orderProduct.quantity}`,
        })
        .where(eq(products.id, orderProduct.productId));

      await tx.insert(stockMovements).values({
        productId: orderProduct.productId,
        type: "USED_IN_SERVICE",
        quantityChange: -orderProduct.quantity,
        referenceId: orderId,
        note: `Used in order ${order.orderNumber}`,
        performedBy: session.user!.id,
      });
    }

    // 5. Process service consumables (multi-use products)
    for (const item of order.items) {
      // Use dynamic usage if recorded, otherwise use service defaults
      const consumables = item.consumablesUsed.length > 0 
        ? item.consumablesUsed.map(c => ({ productId: c.productId, portionsRequired: c.portionsUsed }))
        : item.service.consumables.map(c => ({ productId: c.productId, portionsRequired: c.portionsRequired }));

      for (const consumable of consumables) {
        const product = await tx.query.products.findFirst({
          where: eq(products.id, consumable.productId),
        });

        if (!product || !product.isConsumable) continue;

        const totalPortionsUsed = consumable.portionsRequired * item.quantity;
        let newRemainingPortions = (product.remainingPortions || 0) - totalPortionsUsed;
        let quantityDecrement = 0;

        if (newRemainingPortions <= 0) {
          const portionsPerUnit = product.portionsPerUnit || 1;
          // Calculate how many full units need to be "opened"
          const extraBottlesNeeded = Math.floor(Math.abs(newRemainingPortions) / portionsPerUnit) + 1;
          quantityDecrement = extraBottlesNeeded;
          newRemainingPortions = (extraBottlesNeeded * portionsPerUnit) + newRemainingPortions;
        }

        // Update product stock
        await tx
          .update(products)
          .set({
            remainingPortions: newRemainingPortions,
            quantityOnHand: sql`${products.quantityOnHand} - ${quantityDecrement}`,
          })
          .where(eq(products.id, consumable.productId));

        // Log detailed usage for analytics
        await tx.insert(productUsageLogs).values({
          productId: consumable.productId,
          orderId: order.id,
          staffId: item.staffId,
          portionsUsed: totalPortionsUsed,
          note: `Consumed during ${item.service.name}`,
        });

        // Log stock movement
        await tx.insert(stockMovements).values({
          productId: consumable.productId,
          type: "USED_IN_SERVICE",
          quantityChange: -quantityDecrement,
          portionsChange: -totalPortionsUsed,
          referenceId: orderId,
          note: `Portion usage in order ${order.orderNumber} for ${item.service.name}`,
          performedBy: session.user!.id,
        });
      }
    }

    // 6. Log commissions for each service item
    for (const item of order.items) {
      const staffMember = item.staff;
      const commRateBp = staffMember.commissionRate;
      const serviceAmount = item.unitPrice * item.quantity;
      const commissionAmount = applyRate(serviceAmount, commRateBp);

      if (commissionAmount > 0) {
        await tx.insert(commissionLogs).values({
          staffId: item.staffId,
          invoiceId: invoice.id,
          serviceOrderItemId: item.id,
          commissionRate: commRateBp,
          serviceAmount,
          commissionAmount,
        });
      }
    }

    return { invoice, payment };
  });

  return NextResponse.json(result);
}
