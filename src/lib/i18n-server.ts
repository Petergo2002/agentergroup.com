import { cookies } from "next/headers";
import {
  LEGACY_PLATFORM_LANGUAGE_COOKIE,
  PLATFORM_LANGUAGE_COOKIE,
  resolvePlatformLanguage,
} from "@/lib/i18n";

export async function getServerLanguage() {
  const cookieStore = await cookies();
  const cookieValue =
    cookieStore.get(PLATFORM_LANGUAGE_COOKIE)?.value ??
    cookieStore.get(LEGACY_PLATFORM_LANGUAGE_COOKIE)?.value;
  return resolvePlatformLanguage(cookieValue);
}
