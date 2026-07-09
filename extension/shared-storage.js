const EXT_DB_KEY = "personalLinkLibrary.extensionDb.v2";
const LEGACY_EXT_LINKS_KEY = "personalLinkLibrary.extensionLinks.v1";
const DEFAULT_STATUSES = ["未整理", "常用", "待研究", "已失效"];
const BACKUP_REMIND_DAYS = 7;
const DEFAULT_TREE = [
  { id: "group-study", name: "study", expanded: true, children: ["AI工具", "学习资料", "论文资料", "GitHub仓库", "图片素材"].map((name) => ({ id: createId("cat"), name })) },
  { id: "group-tools", name: "tools", expanded: true, children: ["编程开发", "视频工具", "硬件电子"].map((name) => ({ id: createId("cat"), name })) },
  { id: "group-other", name: "其他收藏夹", expanded: true, children: ["浏览器书签", "待研究", "未整理", "其他"].map((name) => ({ id: createId("cat"), name })) }
];
const DEFAULT_DB = {
  version: 2,
  categoryTree: DEFAULT_TREE,
  links: [],
  appearance: { mode: "soft", accentColor: "#2563eb", panelOpacity: "0.96", radius: "16" },
  sort: "updated-desc",
  viewMode: "standard",
  statuses: DEFAULT_STATUSES,
  tags: [],
  lastBackupAt: "",
  backupDismissedAt: "",
  updatedAt: new Date().toISOString()
};

async function loadExtensionDb() {
  const data = await chrome.storage.local.get([EXT_DB_KEY, LEGACY_EXT_LINKS_KEY]);
  let db = data[EXT_DB_KEY];
  if (!db || !Array.isArray(db.links)) db = clone(DEFAULT_DB);
  if (Array.isArray(data[LEGACY_EXT_LINKS_KEY]) && data[LEGACY_EXT_LINKS_KEY].length) {
    db.links = mergeLinks(db.links || [], data[LEGACY_EXT_LINKS_KEY].map(normalizeLink));
    await chrome.storage.local.remove(LEGACY_EXT_LINKS_KEY);
  }
  db.categoryTree = Array.isArray(db.categoryTree) && db.categoryTree.length ? db.categoryTree.map(normalizeGroup).filter(Boolean) : clone(DEFAULT_TREE);
  db.links = Array.isArray(db.links) ? db.links.map(normalizeLink) : [];
  const storedStatuses = Array.isArray(db.statuses) && db.statuses.length ? db.statuses.map(clean).filter(Boolean) : DEFAULT_STATUSES;
  db.statuses = unique([...storedStatuses, ...db.links.map((link) => clean(link.status)).filter(Boolean)]);
  db.tags = unique([...(Array.isArray(db.tags) ? db.tags.map(clean).filter(Boolean) : []), ...db.links.flatMap((link) => link.tags || [])]);
  db.appearance = { ...DEFAULT_DB.appearance, ...(db.appearance || {}) };
  db.sort = db.sort || "updated-desc";
  db.viewMode = ["standard", "compact", "card"].includes(db.viewMode) ? db.viewMode : "standard";
  db.lastBackupAt = db.lastBackupAt || "";
  db.backupDismissedAt = db.backupDismissedAt || "";
  ensureTreeContainsLinks(db);
  await saveExtensionDb(db);
  return db;
}

async function saveExtensionDb(db) {
  const next = { ...db, version: 2, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ [EXT_DB_KEY]: next });
  return next;
}

function exportDbShape(db) {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    categoryTree: db.categoryTree || [],
    links: db.links || [],
    statuses: db.statuses || DEFAULT_STATUSES,
    tags: db.tags || [],
    viewMode: db.viewMode || "standard",
    lastBackupAt: db.lastBackupAt || ""
  };
}

function mergeLinks(currentLinks, incomingLinks) {
  const urls = new Set(currentLinks.map((link) => normalizeUrl(link.url).toLowerCase()));
  const fresh = incomingLinks.filter((link) => {
    const url = normalizeUrl(link.url).toLowerCase();
    if (!url || urls.has(url)) return false;
    urls.add(url);
    return true;
  });
  return [...fresh, ...currentLinks];
}

function normalizeLink(link) {
  const group = clean(link.categoryGroup || guessGroupByCategory(link.category) || "未整理");
  const category = clean(link.category || "未整理");
  return {
    id: String(link.id || createId("link")),
    title: clean(link.title),
    url: normalizeUrl(clean(link.url)),
    favicon: clean(link.favicon || link.icon || ""),
    categoryGroup: group,
    category,
    tags: Array.isArray(link.tags) ? unique(link.tags.map(clean).filter(Boolean)) : parseTags(link.tags || ""),
    description: clean(link.description) || "待补充：这个网站是干什么的。",
    useCase: clean(link.useCase) || "待补充：以后什么时候用。",
    markdownNote: clean(link.markdownNote),
    rating: clampRating(link.rating),
    status: clean(link.status) || "未整理",
    createdAt: link.createdAt || now(),
    lastOpenedAt: link.lastOpenedAt || "",
    updatedAt: link.updatedAt || link.lastOpenedAt || link.createdAt || now()
  };
}

function normalizeGroup(group) {
  if (!group || !clean(group.name)) return null;
  return {
    id: String(group.id || createId("group")),
    name: clean(group.name),
    expanded: group.expanded !== false,
    children: Array.isArray(group.children) ? group.children.map((child) => ({ id: String(child.id || createId("cat")), name: clean(child.name) || "未整理" })) : []
  };
}

function ensureTreeContainsLinks(db) {
  db.links.forEach((link) => ensureCategoryExists(db, link.categoryGroup, link.category));
}

function ensureCategoryExists(db, groupName, categoryName) {
  const groupClean = clean(groupName) || "未整理";
  const categoryClean = clean(categoryName) || "未整理";
  let group = db.categoryTree.find((item) => item.name === groupClean);
  if (!group) {
    group = { id: createId("group"), name: groupClean, expanded: true, children: [] };
    db.categoryTree.push(group);
  }
  if (!group.children.some((child) => child.name === categoryClean)) group.children.push({ id: createId("cat"), name: categoryClean });
}

function mergeCategoryTrees(baseTree, incomingTree) {
  const merged = clone(baseTree || []);
  incomingTree.forEach((incomingGroup) => {
    let group = merged.find((item) => item.name === incomingGroup.name);
    if (!group) {
      merged.push(incomingGroup);
      return;
    }
    incomingGroup.children.forEach((child) => {
      if (!group.children.some((item) => item.name === child.name)) group.children.push(child);
    });
  });
  return merged;
}

function guessGroupByCategory(category) {
  const found = DEFAULT_TREE.find((group) => group.children.some((child) => child.name === category));
  return found?.name || "未整理";
}

async function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  await chrome.downloads.download({ url, filename, saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseTags(text) { return unique(String(text || "").split(/[，,]/).map(clean).filter(Boolean)); }
function normalizeUrl(url) { const text = String(url || "").trim(); if (!text) return ""; return /^https?:\/\//i.test(text) ? text : `https://${text}`; }
function isValidUrl(url) { try { const parsed = new URL(normalizeUrl(url)); return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname); } catch { return false; } }
function clampRating(value) { const rating = Number(value); return Number.isNaN(rating) ? 3 : Math.min(5, Math.max(1, rating)); }
function createId(prefix = "id") { return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2)}`; }
function unique(items) { return [...new Set(items.filter(Boolean))]; }
function clean(value) { return String(value || "").trim(); }
function now() { return new Date().toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escapeAttribute(value) { return escapeHtml(value); }
function formatDate(value) { if (!value) return "从未"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "未知"; return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function toTime(value) { const time = new Date(value || 0).getTime(); return Number.isNaN(time) ? 0 : time; }
function daysSince(value) { if (!value) return Infinity; return Math.floor((Date.now() - toTime(value)) / 86400000); }
function getStatusClass(status) { if (status === "常用") return "status-common"; if (status === "待研究") return "status-research"; if (status === "已失效") return "status-broken"; return ""; }
function getInitial(text) { return clean(text).slice(0, 1).toUpperCase() || "L"; }
function safeFavicon(value) { const url = clean(value); if (!url) return ""; if (url.startsWith("data:image/") && url.length < 45000) return url; return /^https?:\/\//i.test(url) || /^chrome-extension:\/\//i.test(url) ? url : ""; }
function renderFavicon(link) {
  const icon = safeFavicon(link.favicon);
  return icon ? `<img class="favicon-img" src="${escapeAttribute(icon)}" alt="">` : escapeHtml(getInitial(link.title));
}
function renderMarkdown(markdown) {
  let html = escapeHtml(markdown);
  html = html.replace(/^### (.*)$/gm, "<h4>$1</h4>").replace(/^## (.*)$/gm, "<h3>$1</h3>").replace(/^# (.*)$/gm, "<h2>$1</h2>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>').replace(/^- (.*)$/gm, "<li>$1</li>").replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>").replace(/\n/g, "<br>");
  return html;
}
