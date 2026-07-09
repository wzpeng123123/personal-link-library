const $ = (selector) => document.querySelector(selector);
const fields = {
  title: $("#titleInput"), url: $("#urlInput"), categoryGroup: $("#categoryGroupInput"), category: $("#categoryInput"),
  tags: $("#tagsInput"), description: $("#descriptionInput"), useCase: $("#useCaseInput"), markdownNote: $("#markdownNoteInput"), message: $("#message")
};
let activeTab = null;
let pageMeta = { description: "", favicon: "" };

init();
$("#saveBtn").addEventListener("click", saveCurrent);
$("#exportBtn").addEventListener("click", exportJson);
$("#openLibraryBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("#clearFormBtn").addEventListener("click", clearForm);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab || null;
  fields.title.value = tab?.title || "";
  fields.url.value = tab?.url || "";
  pageMeta.favicon = tab?.favIconUrl || "";
  await fillPageMeta(tab);
}

async function fillPageMeta(tab) {
  if (!tab?.id || !/^https?:\/\//i.test(tab.url || "")) {
    fields.description.placeholder = "浏览器内部页面无法自动读取简介，可手动填写";
    return;
  }
  try {
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPageMeta });
    const meta = result?.result || {};
    if (meta.title && (!fields.title.value || fields.title.value === tab.title)) fields.title.value = meta.title;
    if (meta.description && !fields.description.value) {
      fields.description.value = meta.description;
      show("已自动填充网页简介，可直接修改后保存。", false);
    } else {
      fields.description.placeholder = "这个网站没有可读取简介，可手动填写";
    }
    pageMeta.description = meta.description || "";
    pageMeta.favicon = meta.favicon || tab.favIconUrl || "";
  } catch (error) {
    pageMeta.favicon = tab.favIconUrl || "";
    fields.description.placeholder = "当前网页限制读取简介，可手动填写";
  }
}

function readPageMeta() {
  const get = (selector, attr = "content") => document.querySelector(selector)?.getAttribute(attr)?.trim() || "";
  const metaDescription = get('meta[name="description"]') || get('meta[property="og:description"]') || get('meta[name="twitter:description"]');
  const title = get('meta[property="og:title"]') || document.title || "";
  const firstParagraph = [...document.querySelectorAll('main p, article p, p')]
    .map((node) => node.innerText.replace(/\s+/g, ' ').trim())
    .find((text) => text.length >= 36 && text.length <= 260) || "";
  const description = metaDescription || firstParagraph;
  const iconHref = get('link[rel~="icon"]', "href") || get('link[rel="shortcut icon"]', "href") || "/favicon.ico";
  let favicon = "";
  try { favicon = new URL(iconHref, location.href).href; } catch {}
  return { title, description, favicon };
}

async function saveCurrent() {
  const db = await loadExtensionDb();
  const defaultStatus = Array.isArray(db.statuses) && db.statuses.length ? db.statuses[0] : "未整理";
  const link = normalizeLink({
    title: fields.title.value,
    url: fields.url.value,
    favicon: pageMeta.favicon || activeTab?.favIconUrl || "",
    categoryGroup: fields.categoryGroup.value || "未整理",
    category: fields.category.value || "未整理",
    tags: parseTags(fields.tags.value),
    description: fields.description.value || pageMeta.description,
    useCase: fields.useCase.value,
    markdownNote: fields.markdownNote.value,
    rating: 3,
    status: defaultStatus
  });
  if (!link.title || !isValidUrl(link.url)) return show("标题或 URL 无效。", true);
  const exists = db.links.some((item) => normalizeUrl(item.url).toLowerCase() === normalizeUrl(link.url).toLowerCase());
  if (exists) return show("这个网页已经收藏过。", true);
  ensureCategoryExists(db, link.categoryGroup, link.category);
  db.links.unshift(link);
  await saveExtensionDb(db);
  show("已保存。打开完整库即可看到。", false);
}

async function exportJson() {
  const db = await loadExtensionDb();
  db.lastBackupAt = now();
  await saveExtensionDb(db);
  await downloadJson(`personal-link-library-extension-${new Date().toISOString().slice(0, 10)}.json`, exportDbShape(db));
  show(`已导出 ${db.links.length} 条。`, false);
}

function clearForm() {
  fields.categoryGroup.value = "未整理";
  fields.category.value = "未整理";
  fields.tags.value = "";
  fields.description.value = "";
  fields.useCase.value = "";
  fields.markdownNote.value = "";
  show("表单已清空。", false);
}

function show(text, error) {
  fields.message.textContent = text;
  fields.message.style.color = error ? "#b42318" : "#0f766e";
}
