// CRUD bộ nhớ AI toàn cục và đồng bộ bảng liên kết [[slug]].
// Hàm nhận DB từ bên ngoài, không phụ thuộc Electron; mọi thay đổi body đều gọi syncLinks.
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DB, DBTransaction } from "@main/db/client";
import { memories, memoryLinks } from "@main/db/schema";
import { extractLinks } from "@main/memory/links";
import type { MemoryDto, UpdateMemoryInput } from "@shared/memory";
import type { ReadingReportMemoryMutation } from "@main/reading-report/memory-workspace";

type MemoryRow = typeof memories.$inferSelect;

export interface MemoryNeighbor {
  slug: string;
  title: string;
  description: string;
}

/** Dữ liệu cho readMemory: nội dung, liên kết đi/đến và liên kết không có đích. */
export interface MemoryDetail extends MemoryRow {
  outgoing: MemoryNeighbor[];
  incoming: MemoryNeighbor[];
  danglingLinks: string[];
}

export interface CreateMemoryInput {
  slug: string;
  title: string;
  description: string;
  body: string;
}

function syncLinks(tx: DBTransaction, fromId: string, body: string): void {
  tx.delete(memoryLinks).where(eq(memoryLinks.fromId, fromId)).run();
  const slugs = extractLinks(body);
  if (slugs.length === 0) return;
  const targets = tx
    .select({ id: memories.id })
    .from(memories)
    .where(inArray(memories.slug, slugs))
    .all();
  if (targets.length === 0) return;
  tx.insert(memoryLinks)
    .values(targets.map((t) => ({ fromId, toId: t.id })))
    .run();
}

export function createMemory(db: DB, input: CreateMemoryInput): MemoryRow {
  return db.transaction((tx) => {
    const row = tx.insert(memories).values(input).returning().get();
    syncLinks(tx, row.id, row.body);
    return row;
  });
}

export function updateMemoryById(db: DB, patch: UpdateMemoryInput): MemoryRow | null {
  return db.transaction((tx) => {
    const row = tx
      .update(memories)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        updatedAt: Date.now(),
      })
      .where(eq(memories.id, patch.id))
      .returning()
      .get();
    if (!row) return null;
    if (patch.body !== undefined) syncLinks(tx, row.id, row.body);
    return row;
  });
}

export function deleteMemoryById(db: DB, id: string): void {
  db.delete(memories).where(eq(memories.id, id)).run(); // CASCADE xóa các cạnh liên kết.
}

export function getMemoryById(db: DB, id: string): MemoryRow | null {
  return db.select().from(memories).where(eq(memories.id, id)).get() ?? null;
}

export function getMemoryBySlug(db: DB, slug: string): MemoryDetail | null {
  const row = db.select().from(memories).where(eq(memories.slug, slug)).get();
  if (!row) return null;
  const linked = extractLinks(row.body);
  const outgoingRows =
    linked.length > 0
      ? db
          .select({ slug: memories.slug, title: memories.title, description: memories.description })
          .from(memories)
          .where(inArray(memories.slug, linked))
          .all()
      : [];
  // Giữ thứ tự [[slug]] trong body khi dựng liên kết đi; thứ tự truy vấn inArray không ổn định.
  const slugToRow = new Map(outgoingRows.map((r) => [r.slug, r]));
  const outgoing = linked.filter((s) => slugToRow.has(s)).map((s) => slugToRow.get(s)!);
  const existing = new Set(outgoingRows.map((o) => o.slug));
  const incoming = db
    .select({ slug: memories.slug, title: memories.title, description: memories.description })
    .from(memoryLinks)
    .innerJoin(memories, eq(memoryLinks.fromId, memories.id))
    .where(eq(memoryLinks.toId, row.id))
    .all();
  return {
    ...row,
    outgoing,
    incoming,
    danglingLinks: linked.filter((s) => !existing.has(s)),
  };
}

/** Sắp ổn định theo createdAt và ID cho cả chỉ mục lẫn danh sách quản lý. */
export function listMemories(db: DB): MemoryDto[] {
  return db
    .select({
      id: memories.id,
      slug: memories.slug,
      title: memories.title,
      description: memories.description,
      body: memories.body,
      createdAt: memories.createdAt,
      updatedAt: memories.updatedAt,
    })
    .from(memories)
    .orderBy(asc(memories.createdAt), asc(memories.id))
    .all();
}

export function applyReadingReportMemoryMutations(
  tx: DBTransaction,
  mutations: readonly ReadingReportMemoryMutation[],
  committedAt: number,
): void {
  const changed: Array<{ id: string; body: string }> = [];
  for (const mutation of mutations) {
    if (mutation.kind === "create") {
      const row = tx
        .insert(memories)
        .values({
          slug: mutation.slug,
          title: mutation.title,
          description: mutation.description,
          body: mutation.body,
          createdAt: committedAt,
          updatedAt: committedAt,
        })
        .returning({ id: memories.id, body: memories.body })
        .get();
      changed.push(row);
      continue;
    }
    const row = tx
      .update(memories)
      .set({
        title: mutation.title,
        description: mutation.description,
        body: mutation.body,
        updatedAt: committedAt,
      })
      .where(and(eq(memories.id, mutation.id), eq(memories.updatedAt, mutation.expectedUpdatedAt)))
      .returning({ id: memories.id, body: memories.body })
      .get();
    if (!row) throw new Error(`memory ${mutation.slug} changed during reading report generation`);
    changed.push(row);
  }
  for (const row of changed) syncLinks(tx, row.id, row.body);
}
