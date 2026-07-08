// 个人链接库：双击 index.html 即可使用。
// 默认保存到浏览器 localStorage；如果连接 JSON 文件，之后每次修改也会同步写入该 JSON。

const STORAGE_KEY = "personalLinkLibrary.links.v1";
const SIDEBAR_STATE_KEY = "personalLinkLibrary.sidebarCollapsed.v1";
const DB_NAME = "personalLinkLibraryFileHandleDb";
const DB_STORE = "settings";
const JSON_HANDLE_KEY = "jsonFileHandle";

const DEFAULT_CATEGORIES = [
  "AI工具",
  "编程开发",
  "学习资料",
  "论文资料",
  "图片素材",
  "视频工具",
  "硬件电子",
  "GitHub仓库",
  "待研究",
  "其他"
];

const DEFAULT_STATUSES = ["未整理", "常用", "待研究", "已失效"];

const sampleLinks = [
  {
    id: "sample-openai-docs",
    title: "OpenAI Docs",
    url: "https://platform.openai.com/docs",
    category: "AI工具",
    tags: ["AI", "API", "文档"],
    description: "OpenAI 官方开发文档，包含模型、接口、示例和最佳实践。",
    useCase: "需要接入 OpenAI API、查看参数或确认最新开发方式时使用。",
    rating: 5,
    status: "常用",
    createdAt: "2026-07-07T09:00:00.000Z",
    lastOpenedAt: "",
    updatedAt: "2026-07-07T09:00:00.000Z"
  },
  {
    id: "sample-mdn",
    title: "MDN Web Docs",
    url: "https://developer.mozilla.org/",
    category: "编程开发",
    tags: ["HTML", "CSS", "JavaScript"],
    description: "浏览器端 Web 技术参考资料，适合查询 HTML、CSS、JavaScript 用法。",
    useCase: "写前端页面遇到语法、兼容性或 API 细节不确定时使用。",
    rating: 5,
    status: "常用",
    createdAt: "2026-07-07T09:05:00.000Z",
    lastOpenedAt: "",
    updatedAt: "2026-07-07T09:05:00.000Z"
  },
  {
    id: "sample-arxiv",
    title: "arXiv",
    url: "https://arxiv.org/",
    category: "论文资料",
    tags: ["论文", "研究", "AI"],
    description: "开放论文预印本平台，可以查找 AI、物理、数学等方向论文。",
    useCase: "想跟踪新论文、找研究灵感或查某个算法出处时使用。",
    rating: 4,
    status: "待研究",
    createdAt: "2026-07-07T09:10:00.000Z",
    lastOpenedAt: "",
    updatedAt: "2026-07-07T09:10:00.000Z"
  },
  {
    id: "sample-github-trending",
    title: "GitHub Trending",
    url: "https://github.com/trending",
    category: "GitHub仓库",
    tags: ["开源", "GitHub", "趋势"],
    description: "GitHub 热门项目列表，可以按语言查看近期受关注的仓库。",
    useCase: "想发现开源项目、学习项目结构或找工具库替代品时使用。",
    rating: 4,
    status: "常用",
    createdAt: "2026-07-07T09:15:00.000Z",
    lastOpenedAt: "",
    updatedAt: "2026-07-07T09:15:00.000Z"
  },
  {
    id: "sample-unsplash",
    title: "Unsplash",
    url: "https://unsplash.com/",
    category: "图片素材",
    tags: ["图片", "素材", "设计"],
    description: "高质量摄影图片素材网站，可用于寻找页面和演示配图。",
    useCase: "需要为网页、PPT、文章找视觉素材或参考构图时使用。",
    rating: 3,
    status: "未整理",
    createdAt: "2026-07-07T09:20:00.000Z",
    lastOpenedAt: "",
    updatedAt: "2026-07-07T09:20:00.000Z"
  }
];

const state = {
  links: [],
  editingId: null,
  sidebarCollapsed: localStorage.getItem(SIDEBAR_STATE_KEY) === "true",
  jsonFileHandle: null,
  jsonFileName: "",
  jsonSyncAvailable: "showSaveFilePicker" in window,
  jsonSyncReady: false,
  filters: {
    search: "",
    category: "全部",
    status: "全部",
    tag: "全部"
  }
};

const elements = {
  dashboard: document.querySelector("#dashboard"),
  sidebarToggleBtn: document.querySelector("#sidebarToggleBtn"),
  searchInput: document.querySelector("#searchInput"),
  addLinkBtn: document.querySelector("#addLinkBtn"),
  connectJsonBtn: document.querySelector("#connectJsonBtn"),
  importBtn: document.querySelector("#importBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importFileInput: document.querySelector("#importFileInput"),
  categoryFilters: document.querySelector("#categoryFilters"),
  statusFilters: document.querySelector("#statusFilters"),
  tagFilters: document.querySelector("#tagFilters"),
  clearFiltersBtn: document.querySelector("#clearFiltersBtn"),
  storageStatus: document.querySelector("#storageStatus"),
  resultCount: document.querySelector("#resultCount"),
  linkList: document.querySelector("#linkList"),
  emptyState: document.querySelector("#emptyState"),
  linkDialog: document.querySelector("#linkDialog"),
  linkForm: document.querySelector("#linkForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
  cancelFormBtn: document.querySelector("#cancelFormBtn"),
  categoryOptions: document.querySelector("#categoryOptions"),
  statusInput: document.querySelector("#statusInput"),
  formError: document.querySelector("#formError"),
  titleInput: document.querySelector("#titleInput"),
  urlInput: document.querySelector("#urlInput"),
  categoryInput: document.querySelector("#categoryInput"),
  tagsInput: document.querySelector("#tagsInput"),
  ratingInput: document.querySelector("#ratingInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  useCaseInput: document.querySelector("#useCaseInput")
};

init();

async function init() {
  state.links = loadLinks();
  await restoreJsonFileHandle();
  fillStaticFormOptions();
  bindEvents();
  applySidebarState();
  render();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", () => {
    state.filters.search = elements.searchInput.value.trim().toLowerCase();
    render();
  });

  elements.addLinkBtn.addEventListener("click", () => openForm());
  elements.connectJsonBtn.addEventListener("click", connectJsonFile);
  elements.exportBtn.addEventListener("click", exportLinks);
  elements.importBtn.addEventListener("click", () => elements.importFileInput.click());
  elements.importFileInput.addEventListener("change", importLinks);
  elements.sidebarToggleBtn.addEventListener("click", toggleSidebar);

  elements.clearFiltersBtn.addEventListener("click", () => {
    state.filters = { search: "", category: "全部", status: "全部", tag: "全部" };
    elements.searchInput.value = "";
    render();
  });

  elements.closeDialogBtn.addEventListener("click", closeForm);
  elements.cancelFormBtn.addEventListener("click", closeForm);
  elements.linkForm.addEventListener("submit", saveForm);
}

function loadLinks() {
  const storedText = localStorage.getItem(STORAGE_KEY);

  if (!storedText) {
    saveLinks(sampleLinks);
    return sampleLinks.map(normalizeLink);
  }

  try {
    const parsed = JSON.parse(storedText);
    return Array.isArray(parsed) ? parsed.map(normalizeLink) : sampleLinks.map(normalizeLink);
  } catch (error) {
    console.error("读取本地数据失败：", error);
    return sampleLinks.map(normalizeLink);
  }
}

async function saveLinks(links = state.links) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links, null, 2));

  if (state.jsonFileHandle && state.jsonSyncReady) {
    await writeJsonFile();
  }

  renderStorageStatus();
}

async function connectJsonFile() {
  if (!state.jsonSyncAvailable) {
    window.alert("当前浏览器不支持直接同步写入 JSON 文件。请使用导出 JSON 作为备份。");
    return;
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: "links-data.json",
      types: [
        {
          description: "JSON 文件",
          accept: { "application/json": [".json"] }
        }
      ]
    });

    state.jsonFileHandle = handle;
    state.jsonFileName = handle.name || "links-data.json";
    state.jsonSyncReady = true;
    await saveFileHandle(handle);
    await writeJsonFile();
    renderStorageStatus();
    window.alert(`已连接 ${state.jsonFileName}。之后添加、编辑、删除链接都会自动同步到这个 JSON 文件。`);
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("连接 JSON 文件失败：", error);
      window.alert("连接 JSON 文件失败，请改用导出 JSON 备份。");
    }
  }
}

async function writeJsonFile() {
  try {
    const permission = await verifyFilePermission(state.jsonFileHandle, true);
    if (!permission) {
      state.jsonSyncReady = false;
      return;
    }

    const writable = await state.jsonFileHandle.createWritable();
    await writable.write(JSON.stringify(state.links, null, 2));
    await writable.close();
    state.jsonSyncReady = true;
  } catch (error) {
    state.jsonSyncReady = false;
    console.warn("JSON 文件同步失败，浏览器本地数据仍已保存：", error);
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
  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }
  if (requestWrite && (await handle.requestPermission(options)) === "granted") {
    return true;
  }
  return false;
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
    const transaction = db.transaction(DB_STORE, "readwrite");
    transaction.objectStore(DB_STORE).put(handle, JSON_HANDLE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function readFileHandle() {
  try {
    const db = await openSettingsDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, "readonly");
      const request = transaction.objectStore(DB_STORE).get(JSON_HANDLE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

function render() {
  renderStorageStatus();
  renderFilterOptions();
  renderCards();
}

function renderStorageStatus() {
  if (!elements.storageStatus) return;

  if (state.jsonFileHandle && state.jsonSyncReady) {
    elements.storageStatus.textContent = `浏览器保存 + JSON 同步：${state.jsonFileName}`;
    elements.storageStatus.classList.remove("local-only");
    return;
  }

  if (state.jsonFileHandle && !state.jsonSyncReady) {
    elements.storageStatus.textContent = "浏览器自动保存，JSON 需重新授权";
    elements.storageStatus.classList.add("local-only");
    return;
  }

  elements.storageStatus.textContent = "浏览器自动保存";
  elements.storageStatus.classList.add("local-only");
}

function renderFilterOptions() {
  const categories = ["全部", ...unique([...DEFAULT_CATEGORIES, ...state.links.map((link) => link.category)])];
  const statuses = ["全部", ...DEFAULT_STATUSES];
  const tags = ["全部", ...unique(state.links.flatMap((link) => link.tags))];

  elements.categoryFilters.innerHTML = categories.map((category) => {
    const count = category === "全部" ? state.links.length : countBy("category", category);
    return createFilterButton("category", category, count);
  }).join("");

  elements.statusFilters.innerHTML = statuses.map((status) => {
    const count = status === "全部" ? state.links.length : countBy("status", status);
    return createFilterButton("status", status, count);
  }).join("");

  elements.tagFilters.innerHTML = tags.map((tag) => {
    const count = tag === "全部" ? state.links.length : state.links.filter((link) => link.tags.includes(tag)).length;
    return createFilterButton("tag", tag, count, "tag-chip");
  }).join("");

  elements.categoryFilters.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.category = button.dataset.value;
      render();
    });
  });

  elements.statusFilters.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.status = button.dataset.value;
      render();
    });
  });

  elements.tagFilters.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.tag = button.dataset.value;
      render();
    });
  });
}

function createFilterButton(type, value, count, className = "filter-chip") {
  const isActive = state.filters[type] === value;
  return `
    <button class="${className}${isActive ? " active" : ""}" type="button" data-value="${escapeAttribute(value)}">
      <span>${escapeHtml(value)}</span>
      <span class="chip-count">${count}</span>
    </button>
  `;
}

function renderCards() {
  const links = getFilteredLinks();

  elements.resultCount.textContent = links.length;
  elements.emptyState.hidden = links.length > 0;
  elements.linkList.innerHTML = links.map(createCardHtml).join("");

  elements.linkList.querySelectorAll("[data-action='open']").forEach((button) => {
    button.addEventListener("click", () => openLink(button.dataset.id));
  });

  elements.linkList.querySelectorAll("[data-action='edit']").forEach((button) => {
    button.addEventListener("click", () => openForm(button.dataset.id));
  });

  elements.linkList.querySelectorAll("[data-action='delete']").forEach((button) => {
    button.addEventListener("click", () => deleteLink(button.dataset.id));
  });
}

function getFilteredLinks() {
  return state.links
    .filter((link) => {
      const searchText = [
        link.title,
        link.url,
        link.category,
        link.status,
        link.description,
        link.useCase,
        link.tags.join(" ")
      ].join(" ").toLowerCase();

      const matchesSearch = !state.filters.search || searchText.includes(state.filters.search);
      const matchesCategory = state.filters.category === "全部" || link.category === state.filters.category;
      const matchesStatus = state.filters.status === "全部" || link.status === state.filters.status;
      const matchesTag = state.filters.tag === "全部" || link.tags.includes(state.filters.tag);

      return matchesSearch && matchesCategory && matchesStatus && matchesTag;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function createCardHtml(link) {
  const tagsHtml = link.tags.length
    ? link.tags.map((tag) => `<span class="pill">#${escapeHtml(tag)}</span>`).join("")
    : `<span class="pill">无标签</span>`;

  return `
    <article class="link-card">
      <div class="card-header">
        <div class="card-title-row">
          <h2 class="card-title">${escapeHtml(link.title)}</h2>
          <span class="rating" aria-label="${link.rating} 星">${"★".repeat(link.rating)}${"☆".repeat(5 - link.rating)}</span>
        </div>
        <a class="card-url" href="${escapeAttribute(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.url)}</a>
      </div>

      <div class="meta-row">
        <span class="pill">${escapeHtml(link.category)}</span>
        <span class="pill ${getStatusClass(link.status)}">${escapeHtml(link.status)}</span>
      </div>

      <div class="tag-row">${tagsHtml}</div>

      <section class="focus-box">
        <h3>这个网站是干什么的</h3>
        <p>${escapeHtml(link.description)}</p>
      </section>

      <section class="focus-box">
        <h3>以后什么时候用</h3>
        <p>${escapeHtml(link.useCase)}</p>
      </section>

      <div class="date-row">
        <span>添加：${formatDate(link.createdAt)}</span>
        <span>最近打开：${formatDate(link.lastOpenedAt)}</span>
      </div>

      <div class="card-actions">
        <button class="primary-btn" type="button" data-action="open" data-id="${escapeAttribute(link.id)}">打开</button>
        <button class="ghost-btn" type="button" data-action="edit" data-id="${escapeAttribute(link.id)}">编辑</button>
        <button class="ghost-btn danger-btn" type="button" data-action="delete" data-id="${escapeAttribute(link.id)}">删除</button>
      </div>
    </article>
  `;
}

function openForm(id = null) {
  const link = id ? state.links.find((item) => item.id === id) : null;

  state.editingId = id;
  elements.dialogTitle.textContent = link ? "编辑链接" : "添加链接";
  elements.formError.textContent = "";
  elements.linkForm.reset();
  fillStaticFormOptions();

  if (link) {
    elements.titleInput.value = link.title;
    elements.urlInput.value = link.url;
    elements.categoryInput.value = link.category;
    elements.tagsInput.value = link.tags.join(", ");
    elements.ratingInput.value = String(link.rating);
    elements.statusInput.value = link.status;
    elements.descriptionInput.value = link.description;
    elements.useCaseInput.value = link.useCase;
  } else {
    elements.categoryInput.value = "其他";
    elements.ratingInput.value = "3";
    elements.statusInput.value = "未整理";
  }

  elements.linkDialog.showModal();
}

function closeForm() {
  state.editingId = null;
  elements.formError.textContent = "";
  elements.linkDialog.close();
}

async function saveForm(event) {
  event.preventDefault();

  const formData = readForm();
  const error = validateLink(formData);

  if (error) {
    elements.formError.textContent = error;
    return;
  }

  const existingLink = state.editingId
    ? state.links.find((link) => link.id === state.editingId)
    : null;

  const normalizedUrl = normalizeUrl(formData.url);
  const duplicate = state.links.find((link) => {
    return normalizeUrl(link.url).toLowerCase() === normalizedUrl.toLowerCase()
      && link.id !== state.editingId;
  });

  if (duplicate) {
    elements.formError.textContent = "这个 URL 已经存在，请不要重复添加。";
    return;
  }

  const nextLink = {
    id: existingLink?.id || createId(),
    title: formData.title,
    url: normalizedUrl,
    category: formData.category,
    tags: parseTags(formData.tags),
    description: formData.description,
    useCase: formData.useCase,
    rating: Number(formData.rating),
    status: formData.status,
    createdAt: existingLink?.createdAt || new Date().toISOString(),
    lastOpenedAt: existingLink?.lastOpenedAt || "",
    updatedAt: new Date().toISOString()
  };

  if (existingLink) {
    state.links = state.links.map((link) => link.id === existingLink.id ? nextLink : link);
  } else {
    state.links = [nextLink, ...state.links];
  }

  await saveLinks();
  closeForm();
  render();
}

function readForm() {
  return {
    title: elements.titleInput.value.trim(),
    url: elements.urlInput.value.trim(),
    category: elements.categoryInput.value.trim() || "其他",
    tags: elements.tagsInput.value.trim(),
    rating: elements.ratingInput.value,
    status: elements.statusInput.value,
    description: elements.descriptionInput.value.trim(),
    useCase: elements.useCaseInput.value.trim()
  };
}

function validateLink(link) {
  if (!link.title) return "标题不能为空。";
  if (!link.url) return "URL 不能为空。";
  if (!isValidUrl(link.url)) return "请输入合法 URL，例如 https://example.com。";
  if (!link.description) return "简介不能为空。";
  if (!link.useCase) return "使用场景不能为空。";
  return "";
}

async function openLink(id) {
  const link = state.links.find((item) => item.id === id);
  if (!link) return;

  link.lastOpenedAt = new Date().toISOString();
  link.updatedAt = link.lastOpenedAt;
  await saveLinks();
  render();
  window.open(link.url, "_blank", "noopener,noreferrer");
}

async function deleteLink(id) {
  const link = state.links.find((item) => item.id === id);
  if (!link) return;

  const confirmed = window.confirm(`确定要删除「${link.title}」吗？这个操作不能撤销。`);
  if (!confirmed) return;

  state.links = state.links.filter((item) => item.id !== id);
  await saveLinks();
  render();
}

function exportLinks() {
  const data = JSON.stringify(state.links, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `personal-link-library-backup-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importLinks(event) {
  const file = event.target.files[0];
  elements.importFileInput.value = "";

  if (!file) return;

  const confirmed = window.confirm("导入会把 JSON 中的新链接合并到当前数据中，已有相同 URL 的链接会跳过。继续吗？");
  if (!confirmed) return;

  const reader = new FileReader();

  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      const importedLinks = Array.isArray(imported) ? imported : imported.links;

      if (!Array.isArray(importedLinks)) {
        window.alert("导入失败：JSON 必须是链接数组，或包含 links 数组。");
        return;
      }

      const existingUrls = new Set(state.links.map((link) => normalizeUrl(link.url).toLowerCase()));
      const normalizedImported = importedLinks
        .map(normalizeLink)
        .filter((link) => link.title && isValidUrl(link.url) && link.description && link.useCase)
        .filter((link) => {
          const url = normalizeUrl(link.url).toLowerCase();
          if (existingUrls.has(url)) return false;
          existingUrls.add(url);
          return true;
        });

      state.links = [...normalizedImported, ...state.links];
      await saveLinks();
      render();
      window.alert(`导入完成：新增 ${normalizedImported.length} 条链接，重复或无效数据已跳过。`);
    } catch (error) {
      console.error("导入 JSON 失败：", error);
      window.alert("导入失败：请确认文件是合法 JSON。");
    }
  };

  reader.readAsText(file, "UTF-8");
}

function fillStaticFormOptions() {
  const categories = unique([...DEFAULT_CATEGORIES, ...state.links.map((link) => link.category)]);

  elements.categoryOptions.innerHTML = categories
    .map((category) => `<option value="${escapeAttribute(category)}"></option>`)
    .join("");

  elements.statusInput.innerHTML = DEFAULT_STATUSES
    .map((status) => `<option value="${escapeAttribute(status)}">${escapeHtml(status)}</option>`)
    .join("");
}

function normalizeLink(link) {
  return {
    id: String(link.id || createId()),
    title: String(link.title || "").trim(),
    url: normalizeUrl(String(link.url || "").trim()),
    category: String(link.category || "其他").trim() || "其他",
    tags: Array.isArray(link.tags) ? link.tags.map(String).map((tag) => tag.trim()).filter(Boolean) : parseTags(link.tags || ""),
    description: String(link.description || "").trim(),
    useCase: String(link.useCase || "").trim(),
    rating: clampRating(link.rating),
    status: DEFAULT_STATUSES.includes(link.status) ? link.status : "未整理",
    createdAt: link.createdAt || new Date().toISOString(),
    lastOpenedAt: link.lastOpenedAt || "",
    updatedAt: link.updatedAt || link.lastOpenedAt || link.createdAt || new Date().toISOString()
  };
}

function parseTags(text) {
  return unique(String(text)
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean));
}

function normalizeUrl(url) {
  const trimmedUrl = String(url || "").trim();
  if (!trimmedUrl) return "";

  const hasProtocol = /^https?:\/\//i.test(trimmedUrl);
  return hasProtocol ? trimmedUrl : `https://${trimmedUrl}`;
}

function isValidUrl(url) {
  try {
    const parsed = new URL(normalizeUrl(url));
    return ["http:", "https:"].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function clampRating(value) {
  const rating = Number(value);
  if (Number.isNaN(rating)) return 3;
  return Math.min(5, Math.max(1, rating));
}

function countBy(field, value) {
  return state.links.filter((link) => link[field] === value).length;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `link-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(value) {
  if (!value) return "从未";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStatusClass(status) {
  if (status === "常用") return "status-common";
  if (status === "待研究") return "status-research";
  if (status === "已失效") return "status-broken";
  return "";
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  localStorage.setItem(SIDEBAR_STATE_KEY, String(state.sidebarCollapsed));
  applySidebarState();
}

function applySidebarState() {
  elements.dashboard.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  elements.sidebarToggleBtn.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
  elements.sidebarToggleBtn.title = state.sidebarCollapsed ? "展开筛选" : "收起筛选";
  elements.sidebarToggleBtn.querySelector(".toggle-icon").textContent = state.sidebarCollapsed ? "›" : "‹";
  elements.sidebarToggleBtn.querySelector(".toggle-text").textContent = state.sidebarCollapsed ? "展开" : "收起";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
