import { redirect } from "next/navigation";

// Accounts & Delivery now lives inside each order on the Orders & Accounts desk.
export default function Page() {
  redirect("/idlecrm/orders?filter=deliver");
}
