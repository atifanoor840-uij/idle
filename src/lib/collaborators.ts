import { db, DBOrder, DBUser } from "./db";

export const COLLABORATOR_COMMISSION_RATE = 20;

/**
 * Records a sale only when the purchaser registered through a collaborator link.
 *
 * Runs after the order itself is already saved, so it must never throw: a
 * missing collaborator table (schema not applied) or any other failure here
 * used to turn a successful order update / payment fulfilment into a 500.
 */
export async function recordCollaboratorSale(order: DBOrder, user: DBUser) {
  try {
    const attribution = await db.getCollaboratorAttribution(user.id);
    if (!attribution) return;

    const commissionAmount = Number(
      (Number(order.amountPaid) * (COLLABORATOR_COMMISSION_RATE / 100)).toFixed(2),
    );

    await db.saveCollaboratorSale({
      referredUserId: user.id,
      collaboratorId: attribution.collaboratorId,
      orderId: order.id,
      saleAmount: Number(order.amountPaid),
      commissionAmount,
      status: "approved",
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn(`Collaborator sale not recorded for order ${order.id}:`, error);
  }
}
