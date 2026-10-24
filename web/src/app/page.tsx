import { redirect } from "next/navigation";
import { CURRENT_CHALLENGE_ID } from "@/lib/challenge";

export default function Home() {
  redirect(`/c/${CURRENT_CHALLENGE_ID}`);
}
