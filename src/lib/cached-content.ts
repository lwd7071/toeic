import { unstable_cache } from "next/cache";
import { db } from "./firebase-admin";
import { ApiError } from "./errors";
import { searchTitle } from "./content-counts";

const TTL = 900;

async function page(collectionName: string, limit: number, token: string, search = "") {
  const collection = db().collection(collectionName);
  const query = search
    ? collection.where("archivedAt", "==", null).orderBy("searchTitle").orderBy("__name__").startAt(search).endAt(search + "\uf8ff")
    : collection.where("archivedAt", "==", null).orderBy("__name__");
  const cursor = token ? await collection.doc(token).get() : null;
  if (cursor && (!cursor.exists || cursor.data()?.archivedAt || (search && !String(cursor.data()?.searchTitle).startsWith(search)))) throw new ApiError(400, "Trang không hợp lệ.");
  const snapshot = await (cursor ? query.startAfter(cursor) : query).limit(limit === 3 ? 3 : limit + 1).get();
  const docs = snapshot.docs.slice(0, limit);
  return { items: docs.map(d => ({ id: d.id, ...d.data() })), nextPageToken: snapshot.size > limit ? docs.at(-1)!.id : null };
}

export const cachedTopics = unstable_cache(
  async (limit: number, token: string, search: string) => page("vocabTopics", limit, token, searchTitle(search)),
  ["content-v3", "topics"], { tags: ["content:topics"], revalidate: TTL },
);
export const cachedLessons = unstable_cache(
  async (limit: number, token: string) => page("grammarLessons", limit, token),
  ["content-v3", "lessons"], { tags: ["content:lessons"], revalidate: TTL },
);
export const cachedListening = unstable_cache(
  async (limit: number, token: string) => page("listeningSets", limit, token),
  ["content-v3", "listening"], { tags: ["content:listening"], revalidate: TTL },
);
