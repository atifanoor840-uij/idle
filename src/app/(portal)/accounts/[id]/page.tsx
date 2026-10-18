import View from "./view";

export const metadata = { title: "Account" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <View id={decodeURIComponent(id)} />;
}
