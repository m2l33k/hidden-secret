import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  SupportedLocale,
} from "./src/lib/i18n";

function extractLocaleFromPath(pathname: string): SupportedLocale | null {
  const maybeLocale = pathname.split("/")[1];
  if (isSupportedLocale(maybeLocale)) {
    return maybeLocale;
  }
  return null;
}

function pickLocale(request: NextRequest): SupportedLocale {
  const cookieLocale = request.cookies.get("locale")?.value;
  if (cookieLocale && isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const candidates = acceptLanguage
      .split(",")
      .map((part) => part.trim().split(";")[0].toLowerCase().split("-")[0]);

    for (const candidate of candidates) {
      if (isSupportedLocale(candidate)) {
        return candidate;
      }
    }
  }

  return DEFAULT_LOCALE;
}

function normalizeCountryCode(rawCountryCode: string | null): string {
  const normalized = (rawCountryCode || "US").toUpperCase().trim();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "US";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const countryCode = normalizeCountryCode(
    request.headers.get("x-vercel-ip-country"),
  );
  const localeFromPath = extractLocaleFromPath(pathname);

  if (!localeFromPath) {
    const locale = pickLocale(request);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("locale", locale, { path: "/", sameSite: "lax" });
    response.cookies.set("country_code", countryCode, {
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-country", countryCode);
  requestHeaders.set("x-user-locale", localeFromPath);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.cookies.set("locale", localeFromPath, { path: "/", sameSite: "lax" });
  response.cookies.set("country_code", countryCode, {
    path: "/",
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
