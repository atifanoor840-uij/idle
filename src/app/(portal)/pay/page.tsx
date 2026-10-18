import View from "./view";

export const metadata = { title: "Checkout" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <View orderId={sp.orderId || ""} platform={sp.platform || "MT5"} returnState={sp.success ? "success" : sp.cancelled ? "cancelled" : sp.payment || ""} />;
}
