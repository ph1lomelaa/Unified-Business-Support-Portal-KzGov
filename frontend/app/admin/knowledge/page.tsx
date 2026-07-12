import { KnowledgeManager, type AdminKnowledgeItem } from "@/components/admin/knowledge-manager";
import { serverFetch } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function AdminKnowledgePage() {
  const payload = await serverFetch<{ items: AdminKnowledgeItem[] }>(
    "/api/v1/admin/knowledge",
    { items: [] },
  );
  return <KnowledgeManager initialItems={payload.items} />;
}
