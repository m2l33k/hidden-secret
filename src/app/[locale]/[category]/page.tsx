import { headers } from "next/headers";
import { notFound } from "next/navigation";
import AnonymousSpace from "@/components/prototype/anonymous-space";
import { CATEGORIES, CategorySlug } from "@/lib/prototype-data";
import { isSupportedLocale, LOCALES, SupportedLocale } from "@/lib/i18n";

type PageParams = {
  params: Promise<{ locale: string; category: string }>;
};

const categorySet = new Set<CategorySlug>(CATEGORIES.map((item) => item.slug));

export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    CATEGORIES.map((category) => ({
      locale,
      category: category.slug,
    })),
  );
}

export default async function CategoryPage({ params }: PageParams) {
  const { locale, category } = await params;

  if (!isSupportedLocale(locale) || !categorySet.has(category as CategorySlug)) {
    notFound();
  }

  const headerStore = await headers();
  const countryCode = (headerStore.get("x-user-country") || "US").toUpperCase();

  await new Promise((resolve) => setTimeout(resolve, 500));

  return (
    <AnonymousSpace
      initialCategory={category as CategorySlug}
      activeLocale={locale as SupportedLocale}
      countryCode={countryCode}
    />
  );
}

