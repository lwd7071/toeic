import { ApiError } from "./errors";

export const PAGE_SIZE = 20;

export function pageToken(request: Request): string {
  const token = new URL(request.url).searchParams.get("pageToken") ?? "";
  if (token.length > 200 || (token && !/^[\w-]+$/.test(token))) throw new ApiError(400, "Trang không hợp lệ.");
  return token;
}

export async function firestorePage<T>(query: FirebaseFirestore.Query<T>, token: string) {
  const ordered = query.orderBy("__name__");
  const snapshot = await (token ? ordered.startAfter(token) : ordered).limit(PAGE_SIZE + 1).get();
  const docs = snapshot.docs.slice(0, PAGE_SIZE);
  return { docs, nextPageToken: snapshot.docs.length > PAGE_SIZE ? docs.at(-1)!.id : null };
}
