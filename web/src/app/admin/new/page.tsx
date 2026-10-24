import { connection } from "next/server";
import NewClient from "./NewClient";

export const dynamic = "force-dynamic";

export default async function AdminNew({ searchParams }: { searchParams: Promise<{ fresh?: string }> }) {
  await connection();
  const { fresh } = await searchParams;
  return <NewClient fresh={fresh === "1"} />;
}
