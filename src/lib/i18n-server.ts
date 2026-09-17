import { cookies, headers } from "next/headers";
import { resolveRequestLanguage } from "./language-preference";
import {
  LEGACY_PLATFORM_LANGUAGE_COOKIE,
  PLATFORM_LANGUAGE_COOKIE,
} from "@/lib/i18n";

export async function getServerLanguage() {
  const cookieStore = await cookies();
  return resolveRequestLanguage(
    cookieStore.get(PLATFORM_LANGUAGE_COOKIE)?.value,
    cookieStore.get(LEGACY_PLATFORM_LANGUAGE_COOKIE)?.value,
    (await headers()).get("x-url"),
  );
}
