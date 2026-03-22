import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isSupportedLocale } from "@/lib/i18n";

type LocaleIndexParams = {
  params: Promise<{ locale: string }>;
};

export default async function LocaleIndexPage({ params }: LocaleIndexParams) {
  const { locale } = await params;
  const safeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  redirect(`/${safeLocale}/ideas`);
}

