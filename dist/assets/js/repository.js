import { db } from "./firebase.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  normalize,
  slugify
} from "./utils.js";

export async function listPosts(max = 200) {
  const snapshot = await getDocs(
    query(
      collection(db, "posts"),
      orderBy("updatedAt", "desc"),
      limit(max)
    )
  );

  return snapshot.docs
    .map(item => ({
      id: item.id,
      ...item.data()
    }))
    .filter(item => item.status !== "draft");
}

export async function getPost(id) {
  const snapshot = await getDoc(
    doc(db, "posts", id)
  );

  return snapshot.exists()
    ? {
        id: snapshot.id,
        ...snapshot.data()
      }
    : null;
}

export async function listSkills(max = 1000) {
  const response = await fetch("/api/wiki-skills", {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Không tải được Wiki Skill: HTTP ${response.status}`
    );
  }

  const payload = await response.json();

  if (!payload || !Array.isArray(payload.skills)) {
    throw new Error("Dữ liệu Wiki Skill không hợp lệ");
  }

  return payload.skills.slice(0, max);
}

export function postKey(row) {
  return (
    row.id?.trim() ||
    slugify(
      row.slug ||
      row.title ||
      crypto.randomUUID()
    )
  );
}

export function skillKey(row) {
  return (
    row.id?.trim() ||
    slugify(
      row.skillId ||
      row.name ||
      crypto.randomUUID()
    )
  );
}

export async function importRows(
  type,
  rows,
  onProgress = () => {}
) {
  const collectionName =
    type === "blog"
      ? "posts"
      : "wikiSkills";

  const keyFn =
    type === "blog"
      ? postKey
      : skillKey;

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (
    let start = 0;
    start < rows.length;
    start += 400
  ) {
    const part = rows.slice(start, start + 400);
    const batch = writeBatch(db);

    for (const raw of part) {
      const id = keyFn(raw);

      if (!id) {
        skipped++;
        continue;
      }

      const ref = doc(
        db,
        collectionName,
        id
      );

      const exists = (
        await getDoc(ref)
      ).exists();

      const base = {
        ...raw,
        id,
        searchKey: normalize(
          type === "blog"
            ? raw.title
            : raw.name
        ),
        updatedAt: serverTimestamp()
      };

      if (!exists) {
        base.createdAt = serverTimestamp();
      }

      batch.set(
        ref,
        base,
        {
          merge: true
        }
      );

      if (exists) {
        updated++;
      } else {
        created++;
      }
    }

    await batch.commit();

    onProgress(
      Math.min(
        start + part.length,
        rows.length
      ),
      rows.length
    );
  }

  return {
    created,
    updated,
    skipped
  };
}
