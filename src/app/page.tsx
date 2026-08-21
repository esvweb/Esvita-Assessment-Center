import { redirect } from "next/navigation";
import LandingAuth from "@/components/LandingAuth";
import { isSignedIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  if (await isSignedIn()) redirect("/admin");
  const { as } = await searchParams;
  return <LandingAuth initialView={as === "staff" ? "staff" : as === "candidate" ? "candidate" : "choice"} />;
}
