import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in or sign up",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
