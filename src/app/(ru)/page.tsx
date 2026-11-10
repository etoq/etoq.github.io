import Portfolio from "@/components/Portfolio";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("ru");

export default function Page() {
  return <Portfolio locale="ru" />;
}
