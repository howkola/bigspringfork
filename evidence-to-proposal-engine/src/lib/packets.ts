import type {
  LoadPacketResponse,
  PacketData,
  PacketMeta,
  SavePacketResponse,
} from "../../shared/types";

/* Client persistence API. Persistence is optional: when the server returns 503
   (Supabase not configured), savePacket throws PersistenceUnavailable so the UI
   can disable Save without treating it as a hard error. */

export class PersistenceUnavailable extends Error {}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return (body && (body as { error?: string }).error) || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function savePacket(
  data: PacketData,
  slug?: string
): Promise<SavePacketResponse> {
  const res = await fetch("/api/packets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, data }),
  });
  if (res.status === 503) throw new PersistenceUnavailable(await parseError(res));
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as SavePacketResponse;
}

export async function loadPacket(slug: string): Promise<LoadPacketResponse> {
  const res = await fetch(`/api/packets?slug=${encodeURIComponent(slug)}`);
  if (res.status === 503) throw new PersistenceUnavailable(await parseError(res));
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as LoadPacketResponse;
}

export async function listPackets(): Promise<PacketMeta[]> {
  const res = await fetch("/api/packets?list=1");
  if (!res.ok) return [];
  const body = (await res.json()) as { items?: PacketMeta[] };
  return body.items || [];
}
