import { $, escapeHtml } from "../core/dom.js";
import { state } from "../core/state.js";

function findNode(nodes, id) { return (nodes || []).find(node => node.id === id) || null; }
function fillSelect(select, nodes, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` + (nodes || []).map(n => `<option value="${escapeHtml(n.id)}">${escapeHtml(n.name)}</option>`).join("");
  select.disabled = !(nodes || []).length;
}
export function selectedCategoryNodes() {
  const values = [1,2,3,4].map(level => $(`#categoryLevel${level}`).value).filter(Boolean);
  const selected = []; let nodes = state.categoryTree;
  for (const id of values) { const node = findNode(nodes, id); if (!node) break; selected.push(node); nodes = node.children || []; }
  return selected;
}
export function renderCategoryPath() {
  const nodes = selectedCategoryNodes();
  $("#categoryPathPreview").textContent = nodes.length ? nodes.map(n => n.name).join(" → ") : "Chưa chọn danh mục.";
}
export function renderCategoryRoot() {
  fillSelect($("#categoryLevel1"), state.categoryTree, "Chọn chuyên mục");
  fillSelect($("#categoryLevel2"), [], "Chọn danh mục");
  fillSelect($("#categoryLevel3"), [], "Chọn danh mục con");
  fillSelect($("#categoryLevel4"), [], "Chọn loại");
  renderCategoryPath();
}
export function renderCategoryLevel(level) {
  const a = findNode(state.categoryTree, $("#categoryLevel1").value);
  const b = a ? findNode(a.children, $("#categoryLevel2").value) : null;
  const c = b ? findNode(b.children, $("#categoryLevel3").value) : null;
  if (level <= 2) { fillSelect($("#categoryLevel2"), a?.children || [], "Chọn danh mục"); fillSelect($("#categoryLevel3"), [], "Chọn danh mục con"); fillSelect($("#categoryLevel4"), [], "Chọn loại"); }
  if (level <= 3) { fillSelect($("#categoryLevel3"), b?.children || [], "Chọn danh mục con"); fillSelect($("#categoryLevel4"), [], "Chọn loại"); }
  if (level <= 4) fillSelect($("#categoryLevel4"), c?.children || [], "Chọn loại");
  renderCategoryPath();
}
export function setCategoryPath(ids = []) {
  renderCategoryRoot();
  if (!ids.length) return;
  $("#categoryLevel1").value = ids[0] || ""; renderCategoryLevel(2);
  $("#categoryLevel2").value = ids[1] || ""; renderCategoryLevel(3);
  $("#categoryLevel3").value = ids[2] || ""; renderCategoryLevel(4);
  $("#categoryLevel4").value = ids[3] || ""; renderCategoryPath();
}
export async function initCategories() {
  const response = await fetch("/data/category-tree.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Không tải được cây danh mục.");
  state.categoryTree = await response.json();
  renderCategoryRoot();
}
export function bindCategoryEvents() {
  $("#categoryLevel1").addEventListener("change", () => renderCategoryLevel(2));
  $("#categoryLevel2").addEventListener("change", () => renderCategoryLevel(3));
  $("#categoryLevel3").addEventListener("change", () => renderCategoryLevel(4));
  $("#categoryLevel4").addEventListener("change", renderCategoryPath);
}
