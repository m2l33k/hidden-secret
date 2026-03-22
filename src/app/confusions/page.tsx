import { redirect } from "next/navigation";
import { DEFAULT_LOCALE } from "@/lib/i18n";

export default function ConfusionsRedirectPage() {
  redirect(`/${DEFAULT_LOCALE}/confusions`);
}
