import { CrudPage } from "../crud-page";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  return <CrudPage slug="llm-providers" searchParams={searchParams} />;
}
