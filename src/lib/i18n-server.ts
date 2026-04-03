import { cookies } from "next/headers";
import {
  PLATFORM_LANGUAGE_COOKIE,
  resolvePlatformLanguage,
} from "@/lib/i18n";

export async function getServerLanguage() {
  const cookieStore = await cookies();
  return resolvePlatformLanguage(cookieStore.get(PLATFORM_LANGUAGE_COOKIE)?.value);
}
