import { AvenroLogo } from "@/components/brand/AvenroLogo";
export { AvenroIcon } from "@/components/brand/AvenroIcon";

interface BrandLogoProps {
  className?: string;
  textColor?: string;
}

/**
 * Reusable modular BrandLogo component for Avenro.
 * Renders the official full vector SVG logo.
 */
export function BrandLogo({ className = "h-9 w-auto", textColor = "currentColor" }: BrandLogoProps) {
  return <AvenroLogo className={className} textColor={textColor} />;
}
