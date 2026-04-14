import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DiscountType, PaymentMethod } from "@/generated/prisma/client";

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

  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          service: true,
          staff: true,
        },
      },
      products: {
        include: { product: true },
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
  const settings = await prisma.salonSettings.findFirst();
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
  const invoiceCount = await prisma.invoice.count({
    where: {
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      },
    },
  });
  const invoiceNumber = `INV-${dateStr}-${String(invoiceCount + 1).padStart(4, "0")}`;

  // Use a transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create invoice
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        orderId,
        subtotal,
        taxRate,
        taxAmount,
        discountType: discountType || null,
        discountValue,
        discountAmount,
        tipAmount,
        totalAmount,
        status: "PAID",
      },
    });

    // 2. Create payment
    const payment = await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        method: paymentMethod,
        amount: totalAmount,
      },
    });

    // 3. Update order status
    await tx.serviceOrder.update({
      where: { id: orderId },
      data: { status: "CHECKED_OUT" },
    });

    // 4. Decrement product stock and create stock movements
    for (const orderProduct of order.products) {
      await tx.product.update({
        where: { id: orderProduct.productId },
        data: {
          quantityOnHand: {
            decrement: orderProduct.quantity,
          },
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: orderProduct.productId,
          type: "USED_IN_SERVICE",
          quantityChange: -orderProduct.quantity,
          referenceId: orderId,
          note: `Used in order ${order.orderNumber}`,
          performedBy: session.user!.id,
        },
      });
    }

    // 5. Log commissions for each service item
    for (const item of order.items) {
      const staff = item.staff;
      const commissionRate = Number(staff.commissionRate);
      const serviceAmount = Number(item.unitPrice) * item.quantity;
      const commissionAmount = serviceAmount * (commissionRate / 100);

      if (commissionAmount > 0) {
        await tx.commissionLog.create({
          data: {
            staffId: item.staffId,
            invoiceId: invoice.id,
            serviceOrderItemId: item.id,
            commissionRate,
            serviceAmount,
            commissionAmount,
          },
        });
      }
    }

    return { invoice, payment };
  });

  return NextResponse.json(result);
}
