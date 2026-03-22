import { notFound } from "next/navigation";
import AnonymousSpace from "@/components/prototype/anonymous-space";
import { CATEGORIES, CategorySlug } from "@/lib/prototype-data";

type PageParams = {
  params: Promise<{ category: string }>;
};

const categorySet = new Set<CategorySlug>(CATEGORIES.map((item) => item.slug));

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category: category.slug }));
}

export default async function CategoryPage({ params }: PageParams) {
  const { category } = await params;

  if (!categorySet.has(category as CategorySlug)) {
    notFound();
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  return <AnonymousSpace initialCategory={category as CategorySlug} />;
}
