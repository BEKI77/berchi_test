/**
 * Verifies the order-workflow fixes against a real database.
 * Run:  npx tsx src/db/verify_order_workflow.ts
 */
import "dotenv/config";
import { eq, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import { staff, services, serviceOrders, serviceOrderItems } from "@/db/schema";
import { nextOrderNumber, localDateKey, getSalonTimezone } from "@/lib/order-numbers";
import { isOrderEditable } from "@/lib/orders";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  <- " + detail}`);
  if (!ok) failures++;
}

async function main() {
  const createdOrderIds: string[] = [];

  try {
    const tz = await getSalonTimezone();
    console.log(`\nSalon timezone: ${tz}\n`);

    // ---- 1. The midnight bug -------------------------------------------
    console.log("1. Order numbers use salon-local dates, not UTC");
    // 22:30 UTC on the 22nd is 01:30 on the 23rd in Addis Ababa (UTC+3).
    const lateUtc = new Date("2026-08-22T22:30:00Z");
    const oldWay = lateUtc.toISOString().slice(0, 10).replace(/-/g, "");
    const newWay = localDateKey("Africa/Addis_Ababa", lateUtc);
    check("local date key returns 20260823", newWay === "20260823", `got ${newWay}`);
    check("the previous UTC approach returned 20260822", oldWay === "20260822", `got ${oldWay}`);
    check("the two genuinely differ (this was the duplicate-number bug)", oldWay !== newWay);

    // ---- 2. Concurrency ------------------------------------------------
    console.log("\n2. Concurrent allocation yields distinct numbers");
    const N = 50;
    const numbers = await Promise.all(
      Array.from({ length: N }, () => nextOrderNumber(db, tz))
    );
    const unique = new Set(numbers);
    check(`${N} simultaneous allocations produced ${N} distinct numbers`,
      unique.size === N, `got ${unique.size} distinct`);

    const seqs = numbers
      .map((n) => Number(n.split("-").pop()))
      .sort((a, b) => a - b);
    const contiguous = seqs.every((v, i) => i === 0 || v === seqs[i - 1] + 1);
    check("allocated sequence is contiguous with no gaps", contiguous,
      `range ${seqs[0]}..${seqs[seqs.length - 1]}`);

    // ---- 3. Shared tickets ---------------------------------------------
    console.log("\n3. Two stylists can work one ticket");
    const stylists = await db.select().from(staff).where(eq(staff.role, "SERVER")).limit(2);
    const svc = await db.select().from(services).limit(2);

    if (stylists.length < 2 || svc.length < 2) {
      check("seed data has two stylists and two services", false,
        `stylists=${stylists.length} services=${svc.length}`);
    } else {
      const [orderRow] = await db.insert(serviceOrders).values({
        orderNumber: await nextOrderNumber(db, tz),
        customerId: null,          // reception opens a bare ticket
        serverId: stylists[0].id,  // who opened it, not who owns it
        status: "IN_PROGRESS",
      }).returning();
      createdOrderIds.push(orderRow.id);

      check("a ticket can be opened with no customer attached",
        orderRow.customerId === null);

      await db.insert(serviceOrderItems).values([
        { orderId: orderRow.id, serviceId: svc[0].id, unitPrice: svc[0].basePrice, quantity: 1, staffId: stylists[0].id },
        { orderId: orderRow.id, serviceId: svc[1].id, unitPrice: svc[1].basePrice, quantity: 1, staffId: stylists[1].id },
      ]);

      const lines = await db.select().from(serviceOrderItems)
        .where(eq(serviceOrderItems.orderId, orderRow.id));
      const creditedStaff = new Set(lines.map((l) => l.staffId));

      check("both stylists' work sits on one ticket", lines.length === 2, `got ${lines.length}`);
      check("each line is credited to a different stylist", creditedStaff.size === 2,
        `got ${creditedStaff.size}`);

      // ---- 4. Sending does not lock the ticket -------------------------
      console.log("\n4. Sending to the cashier does not lock the ticket");
      await db.update(serviceOrders).set({ status: "SENT_TO_CASHIER" })
        .where(eq(serviceOrders.id, orderRow.id));

      check("a sent ticket is still editable", isOrderEditable("SENT_TO_CASHIER"));
      check("a paid ticket is not editable", !isOrderEditable("CHECKED_OUT"));
      check("a cancelled ticket is not editable", !isOrderEditable("CANCELLED"));

      await db.insert(serviceOrderItems).values({
        orderId: orderRow.id, serviceId: svc[0].id,
        unitPrice: svc[0].basePrice, quantity: 1, staffId: stylists[1].id,
      });
      const afterSend = await db.select().from(serviceOrderItems)
        .where(eq(serviceOrderItems.orderId, orderRow.id));
      check("a late service still lands after sending", afterSend.length === 3,
        `got ${afterSend.length}`);

      // ---- 5. Lookup by number -----------------------------------------
      console.log("\n5. Lookup by order number");
      const found = await db.query.serviceOrders.findFirst({
        where: eq(serviceOrders.orderNumber, orderRow.orderNumber),
      });
      check(`ticket ${orderRow.orderNumber} is findable by its number`,
        found?.id === orderRow.id);
    }
  } finally {
    if (createdOrderIds.length) {
      await db.delete(serviceOrderItems).where(inArray(serviceOrderItems.orderId, createdOrderIds));
      await db.delete(serviceOrders).where(inArray(serviceOrders.id, createdOrderIds));
    }
    console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}\n`);
    process.exit(failures === 0 ? 0 : 1);
  }
}

main();
