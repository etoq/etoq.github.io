import type { ReactNode } from "react";
import SiteDocument from "@/components/SiteDocument";

export default function Layout({ children }: { children: ReactNode }) {
  return <SiteDocument locale="ru">{children}</SiteDocument>;
}
