import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { eq, gte, count as countFn, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  serviceOrders, invoices, payments, products,
  stockMovements, commissionLogs, salonSettings,
  productUsageLogs,
} from "@/db/schema";
import type { DiscountType, PaymentMethod } from "@/db/schema";

// POST: Checkout an order — create invoice + payment, update stock, log commissions
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "CASHIER" && session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;
  const body = await req.json();
  const {
    discountType,
    discountValue = 0,
    tipAmount = 0,
    paymentMethod,
  }: {
    discountType?: DiscountType;
    discountValue?: number;
    tipAmount?: number;
    paymentMethod: PaymentMethod;
  } = body;

  if (!paymentMethod) {
    return NextResponse.json(
      { error: "Payment method is required" },
      { status: 400 }
    );
  }

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

  if (order.status !== "SENT_TO_CASHIER") {
    return NextResponse.json(
      { error: "Order is not ready for checkout" },
      { status: 400 }
    );
  }

  // Calculate subtotal
  const servicesSubtotal = order.items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0
  );
  const productsSubtotal = order.products.reduce(
    (sum, p) => sum + Number(p.unitPrice) * p.quantity,
    0
  );
  const subtotal = servicesSubtotal + productsSubtotal;

  // Get salon settings for tax rate
  const [settings] = await db.select().from(salonSettings).limit(1);
  const taxRate = settings ? Number(settings.taxRate) : 0;
  const taxAmount = subtotal * (taxRate / 100);

  // Calculate discount
  let discountAmount = 0;
  if (discountType === "PERCENTAGE") {
    discountAmount = subtotal * (discountValue / 100);
  } else if (discountType === "FIXED") {
    discountAmount = discountValue;
  }

  const totalAmount = subtotal + taxAmount - discountAmount + tipAmount;

  // Generate invoice number: INV-YYYYMMDD-XXXX
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const [{ value: invoiceCount }] = await db
    .select({ value: countFn() })
    .from(invoices)
    .where(gte(invoices.createdAt, new Date(today.getFullYear(), today.getMonth(), today.getDate())));
  const invoiceNumber = `INV-${dateStr}-${String(Number(invoiceCount) + 1).padStart(4, "0")}`;

  // Use a transaction to ensure atomicity
  const result = await db.transaction(async (tx) => {
    // 1. Create invoice
    const [invoice] = await tx
      .insert(invoices)
      .values({
        invoiceNumber,
        orderId,
        subtotal: String(subtotal),
        taxRate: String(taxRate),
        taxAmount: String(taxAmount),
        discountType: discountType || null,
        discountValue: String(discountValue),
        discountAmount: String(discountAmount),
        tipAmount: String(tipAmount),
        totalAmount: String(totalAmount),
        status: "PAID",
      })
      .returning();

    // 2. Create payment
    const [payment] = await tx
      .insert(payments)
      .values({
        invoiceId: invoice.id,
        method: paymentMethod,
        amount: String(totalAmount),
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
      const commRate = Number(staffMember.commissionRate);
      const serviceAmount = Number(item.unitPrice) * item.quantity;
      const commissionAmount = serviceAmount * (commRate / 100);

      if (commissionAmount > 0) {
        await tx.insert(commissionLogs).values({
          staffId: item.staffId,
          invoiceId: invoice.id,
          serviceOrderItemId: item.id,
          commissionRate: String(commRate),
          serviceAmount: String(serviceAmount),
          commissionAmount: String(commissionAmount),
        });
      }
    }

    return { invoice, payment };
  });

  return NextResponse.json(result);
}
