// 个人链接库：双击 index.html 即可使用。
// v2：树状收藏夹、单行折叠列表、批量编辑、Markdown 笔记、外观设置。

const STORAGE_KEY = "personalLinkLibrary.links.v2";
const LEGACY_STORAGE_KEY = "personalLinkLibrary.links.v1";
const TREE_KEY = "personalLinkLibrary.categoryTree.v2";
const SIDEBAR_KEY = "personalLinkLibrary.sidebarCollapsed.v2";
const SECTION_KEY = "personalLinkLibrary.sectionCollapsed.v2";
const EXPANDED_KEY = "personalLinkLibrary.expandedLinks.v2";
const APPEARANCE_KEY = "personalLinkLibrary.appearance.v2";
const SORT_KEY = "personalLinkLibrary.sort.v2";
const DB_NAME = "personalLinkLibraryFileHandleDb";
const DB_STORE = "settings";
const JSON_HANDLE_KEY = "jsonFileHandle";

const DEFAULT_STATUSES = ["未整理", "常用", "待研究", "已失效"];
const DEFAULT_TREE = [
  { id: "group-study", name: "study", expanded: true, children: ["AI工具", "学习资料", "论文资料", "GitHub仓库", "图片素材"].map((name) => ({ id: createId("cat"), name })) },
  { id: "group-tools", name: "tools", expanded: true, children: ["编程开发", "视频工具", "硬件电子"].map((name) => ({ id: createId("cat"), name })) },
  { id: "group-other", name: "其他收藏夹", expanded: true, children: ["待研究", "未整理", "其他"].map((name) => ({ id: createId("cat"), name })) }
];

const sampleLinks = [
  makeSample("OpenAI Docs", "https://platform.openai.com/docs", "study", "AI工具", ["AI", "API", "文档"], "OpenAI 官方开发文档，包含模型、接口、示例和最佳实践。", "需要接入 OpenAI API、查看参数或确认最新开发方式时使用。", 5, "常用", "## 使用提醒\n- 先看官方文档，再看第三方教程。\n- API 参数变化时以官方说明为准。"),
  makeSample("MDN Web Docs", "https://developer.mozilla.org/", "tools", "编程开发", ["HTML", "CSS", "JavaScript"], "浏览器端 Web 技术参考资料，适合查询 HTML、CSS、JavaScript 用法。", "写前端页面遇到语法、兼容性或 API 细节不确定时使用。", 5, "常用"),
  makeSample("arXiv", "https://arxiv.org/", "study", "论文资料", ["论文", "研究", "AI"], "开放论文预印本平台，可以查找 AI、物理、数学等方向论文。", "想跟踪新论文、找研究灵感或查某个算法出处时使用。", 4, "待研究"),
  makeSample("GitHub Trending", "https://github.com/trending", "study", "GitHub仓库", ["开源", "GitHub", "趋势"], "GitHub 热门项目列表，可以按语言查看近期受关注的仓库。", "想发现开源项目、学习项目结构或找工具库替代品时使用。", 4, "常用"),
  makeSample("Unsplash", "https://unsplash.com/", "study", "图片素材", ["图片", "素材", "设计"], "高质量摄影图片素材网站，可用于寻找页面和演示配图。", "需要为网页、PPT、文章找视觉素材或参考构图时使用。", 3, "未整理")
];

const defaultAppearance = { mode: "soft", accentColor: "#2563eb", backgroundImage: "", panelOpacity: "0.96", radius: "16" };

const state = {
  links: [],
  tree: [],
  editingId: null,
  sidebarCollapsed: localStorage.getItem(SIDEBAR_KEY) === "true",
  sectionCollapsed: readJson(SECTION_KEY, {}),
  expandedLinks: new Set(readJson(EXPANDED_KEY, [])),
  selectedIds: new Set(),
  jsonFileHandle: null,
  jsonFileName: "",
  jsonSyncAvailable: "showSaveFilePicker" in window,
  jsonSyncReady: false,
  appearance: { ...defaultAppearance, ...readJson(APPEARANCE_KEY, {}) },
  sort: localStorage.getItem(SORT_KEY) || "updated-desc",
  filters: { search: "", categoryGroup: "全部", category: "全部", status: "全部", tag: "全部" }
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  dashboard: $("#dashboard"), filterPanel: $("#filterPanel"), sidebarToggleBtn: $("#sidebarToggleBtn"),
  searchInput: $("#searchInput"), addLinkBtn: $("#addLinkBtn"), appearanceBtn: $("#appearanceBtn"), connectJsonBtn: $("#connectJsonBtn"), importBtn: $("#importBtn"), exportBtn: $("#exportBtn"), importFileInput: $("#importFileInput"),
  categoryTree: $("#categoryTree"), statusFilters: $("#statusFilters"), tagFilters: $("#tagFilters"), clearFiltersBtn: $("#clearFiltersBtn"), storageStatus: $("#storageStatus"), activeFilterText: $("#activeFilterText"), sortSelect: $("#sortSelect"), expandAllBtn: $("#expandAllBtn"), collapseAllBtn: $("#collapseAllBtn"), resultCount: $("#resultCount"),
  linkList: $("#linkList"), emptyState: $("#emptyState"), batchBar: $("#batchBar"), selectedCount: $("#selectedCount"), selectAllVisibleBtn: $("#selectAllVisibleBtn"), clearSelectionBtn: $("#clearSelectionBtn"), batchEditBtn: $("#batchEditBtn"), batchDeleteBtn: $("#batchDeleteBtn"),
  linkDialog: $("#linkDialog"), linkForm: $("#linkForm"), dialogTitle: $("#dialogTitle"), closeDialogBtn: $("#closeDialogBtn"), cancelFormBtn: $("#cancelFormBtn"), categoryGroupOptions: $("#categoryGroupOptions"), categoryOptions: $("#categoryOptions"), statusInput: $("#statusInput"), formError: $("#formError"), titleInput: $("#titleInput"), urlInput: $("#urlInput"), categoryGroupInput: $("#categoryGroupInput"), categoryInput: $("#categoryInput"), tagsInput: $("#tagsInput"), ratingInput: $("#ratingInput"), descriptionInput: $("#descriptionInput"), useCaseInput: $("#useCaseInput"), markdownNoteInput: $("#markdownNoteInput"),
  batchDialog: $("#batchDialog"), batchForm: $("#batchForm"), closeBatchDialogBtn: $("#closeBatchDialogBtn"), cancelBatchFormBtn: $("#cancelBatchFormBtn"), batchCategoryGroupInput: $("#batchCategoryGroupInput"), batchCategoryInput: $("#batchCategoryInput"), batchAddTagsInput: $("#batchAddTagsInput"), batchRemoveTagsInput: $("#batchRemoveTagsInput"), batchStatusInput: $("#batchStatusInput"), batchRatingInput: $("#batchRatingInput"),
  appearanceDialog: $("#appearanceDialog"), appearanceForm: $("#appearanceForm"), closeAppearanceDialogBtn: $("#closeAppearanceDialogBtn"), cancelAppearanceBtn: $("#cancelAppearanceBtn"), resetAppearanceBtn: $("#resetAppearanceBtn"), backgroundModeInput: $("#backgroundModeInput"), accentColorInput: $("#accentColorInput"), backgroundImageInput: $("#backgroundImageInput"), panelOpacityInput: $("#panelOpacityInput"), radiusInput: $("#radiusInput")
};

init();

async function init() {
  state.links = loadLinks();
  state.tree = loadTree();
  ensureTreeContainsLinks();
  persistLocalState();
  await restoreJsonFileHandle();
  bindEvents();
  applySidebarState();
  applySectionState();
  applyAppearance();
  elements.sortSelect.value = state.sort;
  render();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", () => { state.filters.search = elements.searchInput.value.trim().toLowerCase(); render(); });
  elements.addLinkBtn.addEventListener("click", () => openForm());
  elements.appearanceBtn.addEventListener("click", openAppearanceDialog);
  elements.connectJsonBtn.addEventListener("click", connectJsonFile);
  elements.exportBtn.addEventListener("click", exportDatabase);
  elements.importBtn.addEventListener("click", () => elements.importFileInput.click());
  elements.importFileInput.addEventListener("change", importDatabase);
  elements.sidebarToggleBtn.addEventListener("click", toggleSidebar);
  elements.filterPanel.addEventListener("click", handleSidebarClick);
  elements.linkList.addEventListener("click", handleLinkClick);
  elements.linkList.addEventListener("change", handleLinkChange);
  document.addEventListener("click", closeOpenMenus);
  elements.clearFiltersBtn.addEventListener("click", clearFilters);
  elements.sortSelect.addEventListener("change", () => { state.sort = elements.sortSelect.value; localStorage.setItem(SORT_KEY, state.sort); renderLinks(); });
  elements.expandAllBtn.addEventListener("click", expandAllVisible);
  elements.collapseAllBtn.addEventListener("click", collapseAllVisible);
  elements.selectAllVisibleBtn.addEventListener("click", selectAllVisible);
  elements.clearSelectionBtn.addEventListener("click", clearSelection);
  elements.batchEditBtn.addEventListener("click", openBatchDialog);
  elements.batchDeleteBtn.addEventListener("click", batchDelete);
  elements.closeDialogBtn.addEventListener("click", closeForm);
  elements.cancelFormBtn.addEventListener("click", closeForm);
  elements.linkForm.addEventListener("submit", saveForm);
  elements.closeBatchDialogBtn.addEventListener("click", closeBatchDialog);
  elements.cancelBatchFormBtn.addEventListener("click", closeBatchDialog);
  elements.batchForm.addEventListener("submit", applyBatchEdit);
  elements.closeAppearanceDialogBtn.addEventListener("click", closeAppearanceDialog);
  elements.cancelAppearanceBtn.addEventListener("click", closeAppearanceDialog);
  elements.resetAppearanceBtn.addEventListener("click", resetAppearance);
  elements.appearanceForm.addEventListener("submit", saveAppearanceForm);
}

function loadLinks() {
  const text = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!text) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleLinks, null, 2));
    return sampleLinks.map(normalizeLink);
  }
  try {
    const parsed = JSON.parse(text);
    const raw = Array.isArray(parsed) ? parsed : parsed.links;
    return Array.isArray(raw) ? raw.map(normalizeLink) : sampleLinks.map(normalizeLink);
  } catch (error) {
    console.error("读取本地数据失败：", error);
    return sampleLinks.map(normalizeLink);
  }
}

function loadTree() {
  const stored = readJson(TREE_KEY, null);
  const tree = Array.isArray(stored) && stored.length ? stored : clone(DEFAULT_TREE);
  return tree.map(normalizeGroup).filter(Boolean);
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

function persistLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.links, null, 2));
  localStorage.setItem(TREE_KEY, JSON.stringify(state.tree, null, 2));
  localStorage.setItem(EXPANDED_KEY, JSON.stringify([...state.expandedLinks]));
}

async function saveAll() {
  persistLocalState();
  if (state.jsonFileHandle && state.jsonSyncReady) await writeJsonFile();
  renderStorageStatus();
}

function buildExport() {
  return { version: 2, exportedAt: new Date().toISOString(), categoryTree: state.tree, links: state.links };
}

async function connectJsonFile() {
  if (!state.jsonSyncAvailable) return alert("当前浏览器不支持直接同步写入 JSON 文件。请使用导出 JSON 作为备份。");
  try {
    const useExisting = "showOpenFilePicker" in window && confirm("是否连接一个已有的 links-data.json 并先合并里面的数据？\n\n确定：选择已有 JSON 并合并。\n取消：新建或覆盖一个 JSON 文件。");
    let handle;
    if (useExisting) {
      [handle] = await window.showOpenFilePicker({ multiple: false, types: [{ description: "JSON 文件", accept: { "application/json": [".json"] } }] });
      await mergeFromFileHandle(handle);
    } else {
      handle = await window.showSaveFilePicker({ suggestedName: "links-data.json", types: [{ description: "JSON 文件", accept: { "application/json": [".json"] } }] });
    }
    state.jsonFileHandle = handle;
    state.jsonFileName = handle.name || "links-data.json";
    state.jsonSyncReady = true;
    await saveFileHandle(handle);
    await saveAll();
    render();
    alert(`已连接 ${state.jsonFileName}。之后修改会自动同步到这个 JSON 文件。`);
  } catch (error) {
    if (error.name !== "AbortError") alert("连接 JSON 文件失败，请改用导出 JSON 备份。");
  }
}

async function mergeFromFileHandle(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return;
  const imported = JSON.parse(text);
  const importedLinks = Array.isArray(imported) ? imported : imported.links;
  if (Array.isArray(imported.categoryTree)) state.tree = mergeCategoryTrees(state.tree, imported.categoryTree.map(normalizeGroup).filter(Boolean));
  if (Array.isArray(importedLinks)) mergeLinks(importedLinks.map(normalizeLink));
  ensureTreeContainsLinks();
}

function mergeLinks(incomingLinks) {
  const urls = new Set(state.links.map((link) => normalizeUrl(link.url).toLowerCase()));
  const fresh = incomingLinks.filter((link) => {
    const url = normalizeUrl(link.url).toLowerCase();
    if (!url || urls.has(url)) return false;
    urls.add(url);
    return true;
  });
  state.links = [...fresh, ...state.links];
}

function mergeCategoryTrees(baseTree, incomingTree) {
  const merged = clone(baseTree);
  incomingTree.forEach((incomingGroup) => {
    let group = merged.find((item) => item.name === incomingGroup.name);
    if (!group) return merged.push(incomingGroup);
    incomingGroup.children.forEach((child) => {
      if (!group.children.some((item) => item.name === child.name)) group.children.push(child);
    });
  });
  return merged;
}

async function writeJsonFile() {
  try {
    if (!(await verifyFilePermission(state.jsonFileHandle, true))) { state.jsonSyncReady = false; return; }
    const writable = await state.jsonFileHandle.createWritable();
    await writable.write(JSON.stringify(buildExport(), null, 2));
    await writable.close();
    state.jsonSyncReady = true;
  } catch (error) {
    state.jsonSyncReady = false;
    console.warn("JSON 文件同步失败：", error);
  }
}

async function restoreJsonFileHandle() {
  if (!state.jsonSyncAvailable) return;
  const handle = await readFileHandle();
  if (!handle) return;
  state.jsonFileHandle = handle;
  state.jsonFileName = handle.name || "links-data.json";
  state.jsonSyncReady = await verifyFilePermission(handle, false);
}

async function verifyFilePermission(handle, requestWrite) {
  const options = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") return true;
  return Boolean(requestWrite && (await handle.requestPermission(options)) === "granted");
}

function openSettingsDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFileHandle(handle) {
  const db = await openSettingsDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(handle, JSON_HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readFileHandle() {
  try {
    const db = await openSettingsDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const request = tx.objectStore(DB_STORE).get(JSON_HANDLE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch { return null; }
}

function render() {
  fillFormOptions();
  renderStorageStatus();
  renderCategoryTree();
  renderFilterOptions();
  renderLinks();
  renderBatchBar();
  renderActiveFilterText();
  applySectionState();
}

function renderStorageStatus() {
  if (state.jsonFileHandle && state.jsonSyncReady) {
    elements.storageStatus.textContent = `浏览器保存 + JSON 同步：${state.jsonFileName}`;
    elements.storageStatus.classList.remove("local-only");
  } else if (state.jsonFileHandle && !state.jsonSyncReady) {
    elements.storageStatus.textContent = "浏览器自动保存，JSON 需重新授权";
    elements.storageStatus.classList.add("local-only");
  } else {
    elements.storageStatus.textContent = "浏览器自动保存";
    elements.storageStatus.classList.add("local-only");
  }
}

function renderCategoryTree() {
  const allActive = state.filters.categoryGroup === "全部" && state.filters.category === "全部";
  const groups = state.tree.map((group, groupIndex) => {
    const groupCount = state.links.filter((link) => link.categoryGroup === group.name).length;
    const groupActive = state.filters.categoryGroup === group.name && state.filters.category === "全部";
    const children = group.children.map((child, childIndex) => {
      const count = state.links.filter((link) => link.categoryGroup === group.name && link.category === child.name).length;
      const active = state.filters.categoryGroup === group.name && state.filters.category === child.name;
      return `
        <div class="tree-node child-node${active ? " active" : ""}" data-group-id="${escapeAttribute(group.id)}" data-child-id="${escapeAttribute(child.id)}">
          <button class="node-main" type="button" data-action="filter-child" data-group="${escapeAttribute(group.name)}" data-category="${escapeAttribute(child.name)}"><span class="node-icon">└</span><span class="node-name">${escapeHtml(child.name)}</span><span class="node-count">${count}</span></button>
          <button class="node-more" type="button" data-action="toggle-node-menu">⋮</button>
          <div class="node-menu"><button type="button" data-action="rename-child">编辑信息</button><button type="button" data-action="move-child-up" ${childIndex === 0 ? "disabled" : ""}>上移</button><button type="button" data-action="move-child-down" ${childIndex === group.children.length - 1 ? "disabled" : ""}>下移</button><button type="button" data-action="delete-child" class="danger-menu">删除</button></div>
        </div>`;
    }).join("");
    return `
      <div class="tree-group${groupActive ? " active" : ""}" data-group-id="${escapeAttribute(group.id)}">
        <div class="tree-node group-node">
          <button class="group-caret" type="button" data-action="toggle-group">${group.expanded ? "▾" : "▸"}</button>
          <button class="node-main" type="button" data-action="filter-group" data-group="${escapeAttribute(group.name)}"><span class="folder-icon">☆</span><span class="node-name">${escapeHtml(group.name)}</span><span class="node-count">${groupCount}</span></button>
          <button class="node-more" type="button" data-action="toggle-node-menu">⋮</button>
          <div class="node-menu"><button type="button" data-action="add-child">新建小分类</button><button type="button" data-action="rename-group">编辑信息</button><button type="button" data-action="move-group-up" ${groupIndex === 0 ? "disabled" : ""}>上移</button><button type="button" data-action="move-group-down" ${groupIndex === state.tree.length - 1 ? "disabled" : ""}>下移</button><button type="button" data-action="delete-group" class="danger-menu">删除</button></div>
        </div>
        <div class="tree-children" ${group.expanded ? "" : "hidden"}>${children}</div>
      </div>`;
  }).join("");
  elements.categoryTree.innerHTML = `<button class="filter-chip all-chip${allActive ? " active" : ""}" type="button" data-action="filter-all-categories"><span>全部收藏</span><span class="chip-count">${state.links.length}</span></button>${groups}`;
}

function renderFilterOptions() {
  const statuses = ["全部", ...DEFAULT_STATUSES];
  const tags = ["全部", ...unique(state.links.flatMap((link) => link.tags))];
  elements.statusFilters.innerHTML = statuses.map((status) => createFilterButton("status", status, status === "全部" ? state.links.length : countBy("status", status))).join("");
  elements.tagFilters.innerHTML = tags.map((tag) => createFilterButton("tag", tag, tag === "全部" ? state.links.length : state.links.filter((link) => link.tags.includes(tag)).length, "tag-chip")).join("");
}

function createFilterButton(type, value, count, className = "filter-chip") {
  return `<button class="${className}${state.filters[type] === value ? " active" : ""}" type="button" data-action="filter-${type}" data-value="${escapeAttribute(value)}"><span>${escapeHtml(value)}</span><span class="chip-count">${count}</span></button>`;
}

function renderLinks() {
  const links = getFilteredLinks();
  elements.sortSelect.value = state.sort;
  elements.resultCount.textContent = links.length;
  elements.emptyState.hidden = links.length > 0;
  elements.linkList.innerHTML = links.map(createLinkRowHtml).join("");
}

function createLinkRowHtml(link) {
  const expanded = state.expandedLinks.has(link.id);
  const selected = state.selectedIds.has(link.id);
  const tagsHtml = link.tags.length ? link.tags.map((tag) => `<span class="pill">#${escapeHtml(tag)}</span>`).join("") : `<span class="pill muted-pill">无标签</span>`;
  const noteHtml = link.markdownNote ? renderMarkdown(link.markdownNote) : `<p class="muted-text">暂无 Markdown 笔记。</p>`;
  return `
    <article class="link-row${expanded ? " expanded" : ""}${selected ? " selected" : ""}" data-id="${escapeAttribute(link.id)}">
      <div class="link-row-summary">
        <label class="select-box"><input type="checkbox" data-action="select-link" data-id="${escapeAttribute(link.id)}" ${selected ? "checked" : ""}></label>
        <button class="expand-btn" type="button" data-action="toggle-link" data-id="${escapeAttribute(link.id)}">${expanded ? "▾" : "▸"}</button>
        <div class="favicon-dot">${escapeHtml(getInitial(link.title))}</div>
        <div class="row-main-text"><div class="row-title-line"><h2 class="row-title">${escapeHtml(link.title)}</h2><span class="rating">${"★".repeat(link.rating)}${"☆".repeat(5 - link.rating)}</span></div><a class="row-url" href="${escapeAttribute(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.url)}</a><p class="row-brief">${escapeHtml(link.description || "暂无简介")}</p></div>
        <div class="row-meta"><span class="pill">${escapeHtml(link.categoryGroup)}</span><span class="pill">${escapeHtml(link.category)}</span><span class="pill ${getStatusClass(link.status)}">${escapeHtml(link.status)}</span><span class="date-mini">最近：${formatDate(link.lastOpenedAt)}</span></div>
        <div class="row-actions"><button class="primary-btn small-btn" type="button" data-action="open" data-id="${escapeAttribute(link.id)}">打开</button><button class="ghost-btn small-btn" type="button" data-action="edit" data-id="${escapeAttribute(link.id)}">编辑</button><button class="ghost-btn danger-btn small-btn" type="button" data-action="delete" data-id="${escapeAttribute(link.id)}">删除</button></div>
      </div>
      <div class="link-row-detail" ${expanded ? "" : "hidden"}>
        <div class="detail-grid"><section class="focus-box"><h3>这个网站是干什么的</h3><p>${escapeHtml(link.description)}</p></section><section class="focus-box"><h3>以后什么时候用</h3><p>${escapeHtml(link.useCase)}</p></section></div>
        <div class="tag-row">${tagsHtml}</div>
        <section class="focus-box markdown-box"><h3>Markdown 笔记</h3><div class="markdown-body">${noteHtml}</div></section>
        <div class="date-row"><span>添加：${formatDate(link.createdAt)}</span><span>更新：${formatDate(link.updatedAt)}</span><span>最近打开：${formatDate(link.lastOpenedAt)}</span></div>
      </div>
    </article>`;
}

function getFilteredLinks() {
  return state.links.filter((link) => {
    const text = [link.title, link.url, link.categoryGroup, link.category, link.status, link.description, link.useCase, link.markdownNote, link.tags.join(" ")].join(" ").toLowerCase();
    return (!state.filters.search || text.includes(state.filters.search))
      && (state.filters.categoryGroup === "全部" || link.categoryGroup === state.filters.categoryGroup)
      && (state.filters.category === "全部" || link.category === state.filters.category)
      && (state.filters.status === "全部" || link.status === state.filters.status)
      && (state.filters.tag === "全部" || link.tags.includes(state.filters.tag));
  }).sort(compareLinks);
}

function compareLinks(a, b) {
  if (state.sort === "created-desc") return toTime(b.createdAt) - toTime(a.createdAt);
  if (state.sort === "opened-desc") return toTime(b.lastOpenedAt) - toTime(a.lastOpenedAt);
  if (state.sort === "rating-desc") return b.rating - a.rating || toTime(b.updatedAt) - toTime(a.updatedAt);
  if (state.sort === "title-asc") return a.title.localeCompare(b.title, "zh-CN");
  return toTime(b.updatedAt || b.createdAt) - toTime(a.updatedAt || a.createdAt);
}

function toTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function handleSidebarClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  if (!action) return;
  event.stopPropagation();
  if (action === "toggle-section") return toggleSection(button.dataset.section);
  if (action === "add-group") return addGroup();
  if (action === "filter-all-categories") return filterAllCategories();
  if (action === "filter-group") return filterGroup(button.dataset.group);
  if (action === "filter-child") return filterChild(button.dataset.group, button.dataset.category);
  if (action === "filter-status" || action === "filter-tag") return filterSimple(button, action.replace("filter-", ""));
  if (action === "toggle-group") return toggleGroup(button.closest(".tree-group")?.dataset.groupId);
  if (action === "toggle-node-menu") return toggleNodeMenu(button);
  const groupElement = button.closest(".tree-group");
  const childElement = button.closest(".child-node");
  const groupId = groupElement?.dataset.groupId;
  const childId = childElement?.dataset.childId;
  if (action === "add-child") return addChild(groupId);
  if (action === "rename-group") return renameGroup(groupId);
  if (action === "delete-group") return deleteGroup(groupId);
  if (action === "move-group-up") return moveGroup(groupId, -1);
  if (action === "move-group-down") return moveGroup(groupId, 1);
  if (action === "rename-child") return renameChild(groupId, childId);
  if (action === "delete-child") return deleteChild(groupId, childId);
  if (action === "move-child-up") return moveChild(groupId, childId, -1);
  if (action === "move-child-down") return moveChild(groupId, childId, 1);
}

function handleLinkClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "toggle-link") return toggleLink(id);
  if (action === "open") return openLink(id);
  if (action === "edit") return openForm(id);
  if (action === "delete") return deleteLink(id);
}

function handleLinkChange(event) {
  const input = event.target.closest("input[data-action='select-link']");
  if (!input) return;
  input.checked ? state.selectedIds.add(input.dataset.id) : state.selectedIds.delete(input.dataset.id);
  input.closest(".link-row")?.classList.toggle("selected", input.checked);
  renderBatchBar();
}

function filterSimple(button, key) { state.filters[key] = button.dataset.value; render(); }
function filterAllCategories() { state.filters.categoryGroup = "全部"; state.filters.category = "全部"; render(); }
function filterGroup(group) { state.filters.categoryGroup = group; state.filters.category = "全部"; render(); }
function filterChild(group, category) { state.filters.categoryGroup = group; state.filters.category = category; render(); }
function clearFilters() { state.filters = { search: "", categoryGroup: "全部", category: "全部", status: "全部", tag: "全部" }; elements.searchInput.value = ""; render(); }
function toggleSection(section) { state.sectionCollapsed[section] = !state.sectionCollapsed[section]; localStorage.setItem(SECTION_KEY, JSON.stringify(state.sectionCollapsed)); applySectionState(); }
function applySectionState() { document.querySelectorAll(".filter-section").forEach((el) => { const collapsed = Boolean(state.sectionCollapsed[el.dataset.section]); el.classList.toggle("section-collapsed", collapsed); const caret = el.querySelector(".section-caret"); if (caret) caret.textContent = collapsed ? "▸" : "▾"; }); }
function toggleGroup(groupId) { const group = findGroup(groupId); if (!group) return; group.expanded = !group.expanded; saveAll(); render(); }
function toggleNodeMenu(button) { const node = button.closest(".tree-node"); const open = node?.classList.contains("menu-open"); closeOpenMenus(); if (node && !open) node.classList.add("menu-open"); }
function closeOpenMenus(event) { if (event && event.target.closest(".node-menu, .node-more")) return; document.querySelectorAll(".tree-node.menu-open").forEach((node) => node.classList.remove("menu-open")); }

async function addGroup() {
  const name = clean(prompt("输入新大类名称，例如 study、tools、物理："));
  if (!name) return;
  if (state.tree.some((group) => group.name === name)) return alert("这个大类已经存在。");
  state.tree.push({ id: createId("group"), name, expanded: true, children: [] });
  await saveAll(); render();
}
async function addChild(groupId) {
  const group = findGroup(groupId);
  if (!group) return;
  const name = clean(prompt(`在「${group.name}」下面新建小分类：`));
  if (!name) return;
  if (group.children.some((child) => child.name === name)) return alert("这个小分类已经存在。");
  group.children.push({ id: createId("cat"), name });
  group.expanded = true;
  await saveAll(); render();
}
async function renameGroup(groupId) {
  const group = findGroup(groupId); if (!group) return;
  const name = clean(prompt("修改大类名称：", group.name));
  if (!name || name === group.name) return;
  if (state.tree.some((item) => item.name === name)) return alert("这个大类已经存在。");
  const oldName = group.name; group.name = name;
  state.links = state.links.map((link) => link.categoryGroup === oldName ? { ...link, categoryGroup: name, updatedAt: now() } : link);
  if (state.filters.categoryGroup === oldName) state.filters.categoryGroup = name;
  await saveAll(); render();
}
async function renameChild(groupId, childId) {
  const group = findGroup(groupId); const child = group?.children.find((item) => item.id === childId); if (!group || !child) return;
  const name = clean(prompt("修改小分类名称：", child.name));
  if (!name || name === child.name) return;
  if (group.children.some((item) => item.name === name)) return alert("这个小分类已经存在。");
  const oldName = child.name; child.name = name;
  state.links = state.links.map((link) => link.categoryGroup === group.name && link.category === oldName ? { ...link, category: name, updatedAt: now() } : link);
  if (state.filters.categoryGroup === group.name && state.filters.category === oldName) state.filters.category = name;
  await saveAll(); render();
}
async function deleteGroup(groupId) {
  const group = findGroup(groupId); if (!group) return;
  const affected = state.links.filter((link) => link.categoryGroup === group.name).length;
  if (!confirm(`确定删除大类「${group.name}」吗？其中 ${affected} 条链接会移动到「其他收藏夹 / 未整理」。`)) return;
  state.tree = state.tree.filter((item) => item.id !== groupId);
  ensureCategoryExists("其他收藏夹", "未整理");
  state.links = state.links.map((link) => link.categoryGroup === group.name ? { ...link, categoryGroup: "其他收藏夹", category: "未整理", updatedAt: now() } : link);
  filterAllCategories(); await saveAll(); render();
}
async function deleteChild(groupId, childId) {
  const group = findGroup(groupId); const child = group?.children.find((item) => item.id === childId); if (!group || !child) return;
  const affected = state.links.filter((link) => link.categoryGroup === group.name && link.category === child.name).length;
  if (!confirm(`确定删除小分类「${child.name}」吗？其中 ${affected} 条链接会移动到本大类的「未整理」。`)) return;
  group.children = group.children.filter((item) => item.id !== childId);
  if (!group.children.some((item) => item.name === "未整理")) group.children.push({ id: createId("cat"), name: "未整理" });
  state.links = state.links.map((link) => link.categoryGroup === group.name && link.category === child.name ? { ...link, category: "未整理", updatedAt: now() } : link);
  if (state.filters.category === child.name) state.filters.category = "全部";
  await saveAll(); render();
}
async function moveGroup(groupId, direction) { const index = state.tree.findIndex((group) => group.id === groupId); if (index < 0) return; const next = index + direction; if (next < 0 || next >= state.tree.length) return; [state.tree[index], state.tree[next]] = [state.tree[next], state.tree[index]]; await saveAll(); render(); }
async function moveChild(groupId, childId, direction) { const group = findGroup(groupId); if (!group) return; const index = group.children.findIndex((child) => child.id === childId); if (index < 0) return; const next = index + direction; if (next < 0 || next >= group.children.length) return; [group.children[index], group.children[next]] = [group.children[next], group.children[index]]; await saveAll(); render(); }

function openForm(id = null) {
  const link = id ? state.links.find((item) => item.id === id) : null;
  state.editingId = id;
  elements.dialogTitle.textContent = link ? "编辑链接" : "添加链接";
  elements.formError.textContent = "";
  elements.linkForm.reset(); fillFormOptions();
  if (link) {
    elements.titleInput.value = link.title; elements.urlInput.value = link.url; elements.categoryGroupInput.value = link.categoryGroup; elements.categoryInput.value = link.category; elements.tagsInput.value = link.tags.join(", "); elements.ratingInput.value = String(link.rating); elements.statusInput.value = link.status; elements.descriptionInput.value = link.description; elements.useCaseInput.value = link.useCase; elements.markdownNoteInput.value = link.markdownNote;
  } else {
    elements.categoryGroupInput.value = state.filters.categoryGroup !== "全部" ? state.filters.categoryGroup : "其他收藏夹";
    elements.categoryInput.value = state.filters.category !== "全部" ? state.filters.category : "未整理";
    elements.ratingInput.value = "3"; elements.statusInput.value = "未整理";
  }
  elements.linkDialog.showModal();
}
function closeForm() { state.editingId = null; elements.formError.textContent = ""; elements.linkDialog.close(); }
async function saveForm(event) {
  event.preventDefault();
  const formData = readForm();
  const error = validateLink(formData);
  if (error) { elements.formError.textContent = error; return; }
  const existing = state.editingId ? state.links.find((link) => link.id === state.editingId) : null;
  const url = normalizeUrl(formData.url);
  const duplicate = state.links.find((link) => normalizeUrl(link.url).toLowerCase() === url.toLowerCase() && link.id !== state.editingId);
  if (duplicate) { elements.formError.textContent = "这个 URL 已经存在，请不要重复添加。"; return; }
  ensureCategoryExists(formData.categoryGroup, formData.category);
  const next = { id: existing?.id || createId("link"), title: formData.title, url, categoryGroup: formData.categoryGroup, category: formData.category, tags: parseTags(formData.tags), description: formData.description, useCase: formData.useCase, markdownNote: formData.markdownNote, rating: Number(formData.rating), status: formData.status, createdAt: existing?.createdAt || now(), lastOpenedAt: existing?.lastOpenedAt || "", updatedAt: now() };
  state.links = existing ? state.links.map((link) => link.id === existing.id ? next : link) : [next, ...state.links];
  await saveAll(); closeForm(); render();
}
function readForm() { return { title: elements.titleInput.value.trim(), url: elements.urlInput.value.trim(), categoryGroup: clean(elements.categoryGroupInput.value) || "其他收藏夹", category: clean(elements.categoryInput.value) || "未整理", tags: elements.tagsInput.value.trim(), rating: elements.ratingInput.value, status: elements.statusInput.value, description: elements.descriptionInput.value.trim(), useCase: elements.useCaseInput.value.trim(), markdownNote: elements.markdownNoteInput.value.trim() }; }
function validateLink(link) { if (!link.title) return "标题不能为空。"; if (!link.url) return "URL 不能为空。"; if (!isValidUrl(link.url)) return "请输入合法 URL，例如 https://example.com。"; if (!link.categoryGroup) return "大类不能为空。"; if (!link.category) return "小分类不能为空。"; if (!link.description) return "简介不能为空。"; if (!link.useCase) return "使用场景不能为空。"; return ""; }
async function openLink(id) { const link = state.links.find((item) => item.id === id); if (!link) return; link.lastOpenedAt = now(); link.updatedAt = link.lastOpenedAt; await saveAll(); render(); window.open(link.url, "_blank", "noopener,noreferrer"); }
async function deleteLink(id) { const link = state.links.find((item) => item.id === id); if (!link) return; if (!confirm(`确定要删除「${link.title}」吗？这个操作不能撤销。`)) return; state.links = state.links.filter((item) => item.id !== id); state.selectedIds.delete(id); state.expandedLinks.delete(id); await saveAll(); render(); }
function toggleLink(id) { if (!id) return; state.expandedLinks.has(id) ? state.expandedLinks.delete(id) : state.expandedLinks.add(id); localStorage.setItem(EXPANDED_KEY, JSON.stringify([...state.expandedLinks])); renderLinks(); }
function expandAllVisible() { getFilteredLinks().forEach((link) => state.expandedLinks.add(link.id)); localStorage.setItem(EXPANDED_KEY, JSON.stringify([...state.expandedLinks])); renderLinks(); }
function collapseAllVisible() { getFilteredLinks().forEach((link) => state.expandedLinks.delete(link.id)); localStorage.setItem(EXPANDED_KEY, JSON.stringify([...state.expandedLinks])); renderLinks(); }
function selectAllVisible() { getFilteredLinks().forEach((link) => state.selectedIds.add(link.id)); render(); }
function clearSelection() { state.selectedIds.clear(); render(); }
function renderBatchBar() { elements.batchBar.hidden = state.selectedIds.size === 0; elements.selectedCount.textContent = state.selectedIds.size; }
function openBatchDialog() { if (!state.selectedIds.size) return; elements.batchForm.reset(); fillFormOptions(); elements.batchDialog.showModal(); }
function closeBatchDialog() { elements.batchDialog.close(); }
async function applyBatchEdit(event) {
  event.preventDefault();
  const selected = new Set(state.selectedIds);
  const group = clean(elements.batchCategoryGroupInput.value);
  const category = clean(elements.batchCategoryInput.value);
  const addTags = parseTags(elements.batchAddTagsInput.value);
  const removeTags = parseTags(elements.batchRemoveTagsInput.value);
  const status = elements.batchStatusInput.value;
  const rating = elements.batchRatingInput.value;
  state.links = state.links.map((link) => {
    if (!selected.has(link.id)) return link;
    const next = { ...link, updatedAt: now() };
    if (group) next.categoryGroup = group;
    if (category) next.category = category;
    if (addTags.length) next.tags = unique([...next.tags, ...addTags]);
    if (removeTags.length) next.tags = next.tags.filter((tag) => !removeTags.includes(tag));
    if (status) next.status = status;
    if (rating) next.rating = clampRating(rating);
    return next;
  });
  ensureTreeContainsLinks();
  await saveAll(); closeBatchDialog(); render();
}
async function batchDelete() {
  const count = state.selectedIds.size;
  if (!count) return;
  if (!confirm(`确定批量删除 ${count} 条收藏吗？这个操作不能撤销。`)) return;
  const selected = new Set(state.selectedIds);
  state.links = state.links.filter((link) => !selected.has(link.id));
  state.selectedIds.clear(); selected.forEach((id) => state.expandedLinks.delete(id));
  await saveAll(); render();
}
function exportDatabase() {
  const blob = new Blob([JSON.stringify(buildExport(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `personal-link-library-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click(); URL.revokeObjectURL(url);
}
function importDatabase(event) {
  const file = event.target.files[0];
  elements.importFileInput.value = "";
  if (!file) return;
  if (!confirm("导入会把 JSON 中的新链接合并到当前数据中，已有相同 URL 的链接会跳过。继续吗？")) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      const importedLinks = Array.isArray(imported) ? imported : imported.links;
      if (!Array.isArray(importedLinks)) return alert("导入失败：JSON 必须是链接数组，或包含 links 数组。");
      if (Array.isArray(imported.categoryTree)) state.tree = mergeCategoryTrees(state.tree, imported.categoryTree.map(normalizeGroup).filter(Boolean));
      const normalized = importedLinks.map(normalizeLink).filter((link) => link.title && isValidUrl(link.url) && link.description && link.useCase);
      const beforeCount = state.links.length;
      mergeLinks(normalized);
      const addedCount = state.links.length - beforeCount;
      ensureTreeContainsLinks(); await saveAll(); render();
      alert(`导入完成：新增 ${addedCount} 条链接，重复或无效数据已跳过。`);
    } catch { alert("导入失败：请确认文件是合法 JSON。"); }
  };
  reader.readAsText(file, "UTF-8");
}
function openAppearanceDialog() { elements.backgroundModeInput.value = state.appearance.mode; elements.accentColorInput.value = state.appearance.accentColor; elements.backgroundImageInput.value = state.appearance.backgroundImage; elements.panelOpacityInput.value = state.appearance.panelOpacity; elements.radiusInput.value = state.appearance.radius; elements.appearanceDialog.showModal(); }
function closeAppearanceDialog() { elements.appearanceDialog.close(); }
function saveAppearanceForm(event) { event.preventDefault(); state.appearance = { mode: elements.backgroundModeInput.value, accentColor: elements.accentColorInput.value, backgroundImage: elements.backgroundImageInput.value.trim(), panelOpacity: elements.panelOpacityInput.value, radius: elements.radiusInput.value }; localStorage.setItem(APPEARANCE_KEY, JSON.stringify(state.appearance)); applyAppearance(); closeAppearanceDialog(); }
function resetAppearance() { state.appearance = { ...defaultAppearance }; localStorage.setItem(APPEARANCE_KEY, JSON.stringify(state.appearance)); applyAppearance(); openAppearanceDialog(); }
function applyAppearance() { const root = document.documentElement; root.style.setProperty("--brand", state.appearance.accentColor); root.style.setProperty("--panel-alpha", state.appearance.panelOpacity); root.style.setProperty("--radius", `${state.appearance.radius}px`); document.body.dataset.bgMode = state.appearance.mode; if (state.appearance.mode === "image" && state.appearance.backgroundImage) { const safeBg = state.appearance.backgroundImage.replaceAll(String.fromCharCode(34), "%22"); root.style.setProperty("--custom-bg-image", `url("${safeBg}")`); } else root.style.removeProperty("--custom-bg-image"); }
function renderActiveFilterText() { const parts = []; if (state.filters.categoryGroup !== "全部") parts.push(state.filters.categoryGroup); if (state.filters.category !== "全部") parts.push(state.filters.category); if (state.filters.status !== "全部") parts.push(state.filters.status); if (state.filters.tag !== "全部") parts.push(`#${state.filters.tag}`); if (state.filters.search) parts.push(`搜索：${state.filters.search}`); elements.activeFilterText.textContent = parts.length ? parts.join(" / ") : "全部数据"; }
function fillFormOptions() { const groups = unique(state.tree.map((group) => group.name)); const categories = unique(state.tree.flatMap((group) => group.children.map((child) => child.name))); elements.categoryGroupOptions.innerHTML = groups.map((name) => `<option value="${escapeAttribute(name)}"></option>`).join(""); elements.categoryOptions.innerHTML = categories.map((name) => `<option value="${escapeAttribute(name)}"></option>`).join(""); elements.statusInput.innerHTML = DEFAULT_STATUSES.map((status) => `<option value="${escapeAttribute(status)}">${escapeHtml(status)}</option>`).join(""); elements.batchStatusInput.innerHTML = `<option value="">不修改</option>` + DEFAULT_STATUSES.map((status) => `<option value="${escapeAttribute(status)}">${escapeHtml(status)}</option>`).join(""); }
function normalizeLink(link) { const group = clean(link.categoryGroup || guessGroupByCategory(link.category) || "其他收藏夹"); const category = clean(link.category || "未整理"); return { id: String(link.id || createId("link")), title: clean(link.title), url: normalizeUrl(clean(link.url)), categoryGroup: group, category, tags: Array.isArray(link.tags) ? unique(link.tags.map(clean).filter(Boolean)) : parseTags(link.tags || ""), description: clean(link.description), useCase: clean(link.useCase), markdownNote: clean(link.markdownNote), rating: clampRating(link.rating), status: DEFAULT_STATUSES.includes(link.status) ? link.status : "未整理", createdAt: link.createdAt || now(), lastOpenedAt: link.lastOpenedAt || "", updatedAt: link.updatedAt || link.lastOpenedAt || link.createdAt || now() }; }
function ensureTreeContainsLinks() { state.links.forEach((link) => ensureCategoryExists(link.categoryGroup, link.category)); }
function ensureCategoryExists(groupName, categoryName) { const groupClean = clean(groupName) || "其他收藏夹"; const categoryClean = clean(categoryName) || "未整理"; let group = state.tree.find((item) => item.name === groupClean); if (!group) { group = { id: createId("group"), name: groupClean, expanded: true, children: [] }; state.tree.push(group); } if (!group.children.some((child) => child.name === categoryClean)) group.children.push({ id: createId("cat"), name: categoryClean }); }
function guessGroupByCategory(category) { const found = DEFAULT_TREE.find((group) => group.children.some((child) => child.name === category)); return found?.name || "其他收藏夹"; }
function findGroup(groupId) { return state.tree.find((group) => group.id === groupId); }
function countBy(field, value) { return state.links.filter((link) => link[field] === value).length; }
function parseTags(text) { return unique(String(text || "").split(/[，,]/).map(clean).filter(Boolean)); }
function normalizeUrl(url) { const text = String(url || "").trim(); if (!text) return ""; return /^https?:\/\//i.test(text) ? text : `https://${text}`; }
function isValidUrl(url) { try { const parsed = new URL(normalizeUrl(url)); return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname); } catch { return false; } }
function clampRating(value) { const rating = Number(value); return Number.isNaN(rating) ? 3 : Math.min(5, Math.max(1, rating)); }
function toggleSidebar() { state.sidebarCollapsed = !state.sidebarCollapsed; localStorage.setItem(SIDEBAR_KEY, String(state.sidebarCollapsed)); applySidebarState(); }
function applySidebarState() { elements.dashboard.classList.toggle("sidebar-collapsed", state.sidebarCollapsed); elements.sidebarToggleBtn.setAttribute("aria-expanded", String(!state.sidebarCollapsed)); elements.sidebarToggleBtn.title = state.sidebarCollapsed ? "展开侧栏" : "收起侧栏"; elements.sidebarToggleBtn.querySelector(".toggle-icon").textContent = state.sidebarCollapsed ? "☰" : "‹"; elements.sidebarToggleBtn.querySelector(".toggle-text").textContent = state.sidebarCollapsed ? "" : "收起"; }
function renderMarkdown(markdown) { let html = escapeHtml(markdown); html = html.replace(/^### (.*)$/gm, "<h4>$1</h4>").replace(/^## (.*)$/gm, "<h3>$1</h3>").replace(/^# (.*)$/gm, "<h2>$1</h2>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>').replace(/^- (.*)$/gm, "<li>$1</li>").replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>").replace(/\n/g, "<br>"); return html; }
function formatDate(value) { if (!value) return "从未"; const date = new Date(value); if (Number.isNaN(date.getTime())) return "未知"; return date.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function getStatusClass(status) { if (status === "常用") return "status-common"; if (status === "待研究") return "status-research"; if (status === "已失效") return "status-broken"; return ""; }
function getInitial(text) { return clean(text).slice(0, 1).toUpperCase() || "L"; }
function makeSample(title, url, categoryGroup, category, tags, description, useCase, rating, status, markdownNote = "") { return { id: `sample-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, title, url, categoryGroup, category, tags, description, useCase, markdownNote, rating, status, createdAt: "2026-07-07T09:00:00.000Z", lastOpenedAt: "", updatedAt: "2026-07-07T09:00:00.000Z" }; }
function createId(prefix = "id") { if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`; return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function unique(items) { return [...new Set(items.filter(Boolean))]; }
function clean(value) { return String(value || "").trim(); }
function now() { return new Date().toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readJson(key, fallback) { try { const text = localStorage.getItem(key); return text ? JSON.parse(text) : fallback; } catch { return fallback; } }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escapeAttribute(value) { return escapeHtml(value); }
