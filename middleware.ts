import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  SupportedLocale,
} from "./src/lib/i18n";

const SESSION_COOKIE_NAME = "qs_sid";
const SAFE_DEFAULT_COUNTRY = "US";

const securedCookieOptions = {
  path: "/",
  sameSite: "strict" as const,
  secure: true,
  httpOnly: true,
};

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
  if (!rawCountryCode) {
    return SAFE_DEFAULT_COUNTRY;
  }

  const firstSegment = rawCountryCode.split(",")[0].trim();
  const normalized = firstSegment.toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : SAFE_DEFAULT_COUNTRY;
}

function resolveCountryCode(request: NextRequest) {
  const hasTrustedVercelHeaders = request.headers.has("x-vercel-id");
  if (!hasTrustedVercelHeaders) {
    return SAFE_DEFAULT_COUNTRY;
  }

  return normalizeCountryCode(request.headers.get("x-vercel-ip-country"));
}

function hasValidSessionCookie(request: NextRequest) {
  const rawSession = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawSession) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    rawSession,
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const countryCode = resolveCountryCode(request);
  const localeFromPath = extractLocaleFromPath(pathname);

  if (!localeFromPath) {
    const locale = pickLocale(request);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set("locale", locale, securedCookieOptions);
    response.cookies.set("country_code", countryCode, securedCookieOptions);
    if (!hasValidSessionCookie(request)) {
      response.cookies.set(
        SESSION_COOKIE_NAME,
        crypto.randomUUID(),
        securedCookieOptions,
      );
    }
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-country", countryCode);
  requestHeaders.set("x-user-locale", localeFromPath);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.cookies.set("locale", localeFromPath, securedCookieOptions);
  response.cookies.set("country_code", countryCode, securedCookieOptions);
  if (!hasValidSessionCookie(request)) {
    response.cookies.set(
      SESSION_COOKIE_NAME,
      crypto.randomUUID(),
      securedCookieOptions,
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
