import { db } from "/js/firebase-config.js";
import {
  collection,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const REDIRECT_DELAY_MS = 250;
const title = document.querySelector("#title");
const message = document.querySelector("#message");
const spinner = document.querySelector("#spinner");
const errorBox = document.querySelector("#errorBox");
const actions = document.querySelector("#actions");

function normalizeSlug(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

function getSlug() {
  const fromQuery = new URLSearchParams(location.search).get("slug");
  if (fromQuery) return normalizeSlug(fromQuery);

  const parts = location.pathname.split("/").filter(Boolean);
  return normalizeSlug(parts[0] === "go" ? parts[1] : "");
}

function showError(text) {
  title.textContent = "Không thể mở Smart Link";
  message.textContent = "Liên kết có thể đã bị tắt, bị xóa hoặc nhập sai địa chỉ.";
  spinner.style.display = "none";
  errorBox.textContent = text;
  errorBox.style.display = "block";
  actions.style.display = "flex";
}

function isSafeDestination(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function resolveSmartLink(slug) {
  const smartLinks = collection(db, "smartLinks");
  const lookup = query(
    smartLinks,
    where("slug", "==", slug),
    where("active", "==", true),
    limit(1)
  );

  const snapshot = await getDocs(lookup);
  if (snapshot.empty) return null;

  const document = snapshot.docs[0];
  return { ref: document.ref, id: document.id, ...document.data() };
}

async function recordClick(link) {
  try {
    await updateDoc(link.ref, {
      clicks: increment(1),
      lastClickedAt: serverTimestamp()
    });
  } catch (error) {
    // Không chặn chuyển hướng nếu bộ đếm tạm thời không cập nhật được.
    console.warn("Không ghi được lượt click Smart Link:", error);
  }
}

async function start() {
  const slug = getSlug();
  if (!slug) {
    showError("Đường dẫn thiếu slug. Ví dụ hợp lệ: /go/aumix3d");
    return;
  }

  try {
    const link = await resolveSmartLink(slug);
    if (!link) {
      showError(`Không tìm thấy Smart Link đang hoạt động: ${slug}`);
      return;
    }

    const targetUrl = link.targetUrl || link.url || "";
    if (!isSafeDestination(targetUrl)) {
      showError("URL đích của Smart Link không hợp lệ.");
      return;
    }

    title.textContent = link.name ? `Đang mở ${link.name}…` : "Đang chuyển hướng…";
    await recordClick(link);

    window.setTimeout(() => {
      location.replace(targetUrl);
    }, REDIRECT_DELAY_MS);
  } catch (error) {
    console.error("Smart Link redirect error:", error);
    showError(error?.message || "Không thể đọc dữ liệu Smart Link.");
  }
}

start();
