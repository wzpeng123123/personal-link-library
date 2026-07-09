const qs = (selector) => document.querySelector(selector);
const state = {
  db: null,
  editingId: null,
  sidebarCollapsed: false,
  sectionCollapsed: {},
  expandedLinks: new Set(),
  selectedIds: new Set(),
  dragData: null,
  currentTheme: "soft",
  filters: { search: "", categoryGroup: "全部", category: "全部", status: "全部", tag: "全部" }
};

const el = {
  dashboard: qs("#dashboard"), searchInput: qs("#searchInput"), addLinkBtn: qs("#addLinkBtn"), exportBtn: qs("#exportBtn"), importBtn: qs("#importBtn"), importBookmarkBtn: qs("#importBookmarkBtn"), importFileInput: qs("#importFileInput"), bookmarkFileInput: qs("#bookmarkFileInput"), clearAllBtn: qs("#clearAllBtn"), sidebarToggleBtn: qs("#sidebarToggleBtn"), themeToggleBtn: qs("#themeToggleBtn"), filterPanel: qs("#filterPanel"),
  statsTotal: qs("#statsTotal"), statsInbox: qs("#statsInbox"), statsCommon: qs("#statsCommon"), statsResearch: qs("#statsResearch"), statsBroken: qs("#statsBroken"), statsBackup: qs("#statsBackup"),
  backupNotice: qs("#backupNotice"), backupTitle: qs("#backupTitle"), backupText: qs("#backupText"), backupNowBtn: qs("#backupNowBtn"), dismissBackupBtn: qs("#dismissBackupBtn"),
  categoryTree: qs("#categoryTree"), statusFilters: qs("#statusFilters"), tagFilters: qs("#tagFilters"), resultCount: qs("#resultCount"), activeFilterText: qs("#activeFilterText"), sortSelect: qs("#sortSelect"), viewModeSelect: qs("#viewModeSelect"), expandAllBtn: qs("#expandAllBtn"), collapseAllBtn: qs("#collapseAllBtn"), clearFiltersBtn: qs("#clearFiltersBtn"),
  batchBar: qs("#batchBar"), selectedCount: qs("#selectedCount"), selectAllVisibleBtn: qs("#selectAllVisibleBtn"), clearSelectionBtn: qs("#clearSelectionBtn"), batchEditBtn: qs("#batchEditBtn"), batchDeleteBtn: qs("#batchDeleteBtn"),
  linkList: qs("#linkList"), emptyState: qs("#emptyState"),
  linkDialog: qs("#linkDialog"), linkForm: qs("#linkForm"), dialogTitle: qs("#dialogTitle"), closeDialogBtn: qs("#closeDialogBtn"), cancelFormBtn: qs("#cancelFormBtn"), formError: qs("#formError"), titleInput: qs("#titleInput"), urlInput: qs("#urlInput"), faviconInput: qs("#faviconInput"), categoryGroupInput: qs("#categoryGroupInput"), categoryInput: qs("#categoryInput"), categoryGroupOptions: qs("#categoryGroupOptions"), categoryOptions: qs("#categoryOptions"), tagsInput: qs("#tagsInput"), ratingInput: qs("#ratingInput"), statusInput: qs("#statusInput"), descriptionInput: qs("#descriptionInput"), useCaseInput: qs("#useCaseInput"), markdownNoteInput: qs("#markdownNoteInput"),
  batchDialog: qs("#batchDialog"), batchForm: qs("#batchForm"), closeBatchDialogBtn: qs("#closeBatchDialogBtn"), cancelBatchFormBtn: qs("#cancelBatchFormBtn"), batchCategoryGroupInput: qs("#batchCategoryGroupInput"), batchCategoryInput: qs("#batchCategoryInput"), batchAddTagsInput: qs("#batchAddTagsInput"), batchRemoveTagsInput: qs("#batchRemoveTagsInput"), batchStatusInput: qs("#batchStatusInput"), batchRatingInput: qs("#batchRatingInput")
};

init();

async function init() {
  state.db = await loadExtensionDb();
  state.currentTheme = state.db.appearance?.mode === "dark" ? "dark" : "soft";
  applyTheme();
  el.sortSelect.value = state.db.sort || "updated-desc";
  if (el.viewModeSelect) el.viewModeSelect.value = state.db.viewMode || "standard";
  bindEvents();
  render();
}

function bindEvents() {
  el.searchInput.addEventListener("input", () => { state.filters.search = el.searchInput.value.trim().toLowerCase(); render(); });
  el.addLinkBtn.addEventListener("click", () => openForm());
  el.exportBtn.addEventListener("click", exportDb);
  el.backupNowBtn.addEventListener("click", exportDb);
  el.dismissBackupBtn.addEventListener("click", dismissBackupReminder);
  el.importBtn.addEventListener("click", () => el.importFileInput.click());
  el.importBookmarkBtn.addEventListener("click", () => el.bookmarkFileInput.click());
  el.importFileInput.addEventListener("change", importDb);
  el.bookmarkFileInput.addEventListener("change", importBookmarkHtml);
  el.clearAllBtn.addEventListener("click", clearAllData);
  el.themeToggleBtn?.addEventListener("click", toggleTheme);
  el.sidebarToggleBtn.addEventListener("click", toggleSidebar);
  el.filterPanel.addEventListener("click", handleSidebarClick);
  el.categoryTree.addEventListener("dragstart", handleTreeDragStart);
  el.categoryTree.addEventListener("dragover", allowDrop);
  el.categoryTree.addEventListener("dragleave", clearDropHighlight);
  el.categoryTree.addEventListener("drop", handleTreeDrop);
  el.linkList.addEventListener("click", handleLinkClick);
  el.linkList.addEventListener("change", handleLinkChange);
  el.linkList.addEventListener("dragstart", handleLinkDragStart);
  el.linkList.addEventListener("dragover", allowDrop);
  el.linkList.addEventListener("dragleave", clearDropHighlight);
  el.linkList.addEventListener("drop", handleLinkDrop);
  document.addEventListener("click", closeOpenMenus);
  document.addEventListener("dragend", () => { state.dragData = null; clearDropHighlight(); });
  el.clearFiltersBtn.addEventListener("click", clearFilters);
  el.sortSelect.addEventListener("change", async () => { state.db.sort = el.sortSelect.value; await persist(); renderLinks(); });
  el.viewModeSelect?.addEventListener("change", async () => { state.db.viewMode = el.viewModeSelect.value; await persist(); renderLinks(); });
  el.expandAllBtn.addEventListener("click", () => { getFilteredLinks().forEach((link) => state.expandedLinks.add(link.id)); renderLinks(); });
  el.collapseAllBtn.addEventListener("click", () => { getFilteredLinks().forEach((link) => state.expandedLinks.delete(link.id)); renderLinks(); });
  el.selectAllVisibleBtn.addEventListener("click", () => { getFilteredLinks().forEach((link) => state.selectedIds.add(link.id)); render(); });
  el.clearSelectionBtn.addEventListener("click", () => { state.selectedIds.clear(); render(); });
  el.batchEditBtn.addEventListener("click", openBatchDialog);
  el.batchDeleteBtn.addEventListener("click", batchDelete);
  el.closeDialogBtn.addEventListener("click", closeForm);
  el.cancelFormBtn.addEventListener("click", closeForm);
  el.linkForm.addEventListener("submit", saveForm);
  el.closeBatchDialogBtn.addEventListener("click", closeBatchDialog);
  el.cancelBatchFormBtn.addEventListener("click", closeBatchDialog);
  el.batchForm.addEventListener("submit", applyBatchEdit);
}

async function persist() {
  syncFilterCollections();
  ensureTreeContainsLinks(state.db);
  state.db = await saveExtensionDb(state.db);
}

function render() {
  fillOptions();
  renderBackupNotice();
  renderStats();
  renderCategoryTree();
  renderFilterOptions();
  renderLinks();
  renderBatchBar();
  renderActiveFilterText();
  applySectionState();
}

function renderBackupNotice() {
  const backupDays = daysSince(state.db.lastBackupAt);
  const dismissedToday = state.db.backupDismissedAt && new Date(state.db.backupDismissedAt).toDateString() === new Date().toDateString();
  if (!state.db.links.length || dismissedToday || backupDays < BACKUP_REMIND_DAYS) {
    el.backupNotice.hidden = true;
    return;
  }
  el.backupNotice.hidden = false;
  el.backupTitle.textContent = state.db.lastBackupAt ? "建议导出备份" : "还没有备份过";
  el.backupText.textContent = state.db.lastBackupAt ? `距离上次备份已经 ${backupDays} 天。收藏数据越来越多时，建议导出 JSON 备份。` : "你已经开始积累收藏，建议先导出一次 JSON 备份。";
}

async function dismissBackupReminder() {
  state.db.backupDismissedAt = now();
  el.backupNotice.hidden = true;
  await persist();
  renderBackupNotice();
}

function renderStats() {
  const links = state.db.links || [];
  const inbox = links.filter((link) => link.categoryGroup === "收件箱" || link.category === "未整理").length;
  const common = links.filter((link) => link.status === "常用").length;
  const research = links.filter((link) => link.status === "待研究").length;
  const broken = links.filter((link) => link.status === "已失效").length;
  if (el.statsTotal) el.statsTotal.textContent = links.length;
  if (el.statsInbox) el.statsInbox.textContent = inbox;
  if (el.statsCommon) el.statsCommon.textContent = common;
  if (el.statsResearch) el.statsResearch.textContent = research;
  if (el.statsBroken) el.statsBroken.textContent = broken;
  if (el.statsBackup) el.statsBackup.textContent = backupShortText(state.db.lastBackupAt);
}

function backupShortText(value) {
  if (!value) return "无";
  const days = daysSince(value);
  if (days <= 0) return "今天";
  if (days === 1) return "1天前";
  return `${days}天前`;
}

async function toggleTheme() {
  state.currentTheme = state.currentTheme === "dark" ? "soft" : "dark";
  state.db.appearance = { ...(state.db.appearance || {}), mode: state.currentTheme };
  applyTheme();
  await persist();
}

function applyTheme() {
  document.body.dataset.bgMode = state.currentTheme === "dark" ? "dark" : "soft";
  if (el.themeToggleBtn) el.themeToggleBtn.textContent = state.currentTheme === "dark" ? "浅色模式" : "深色模式";
}

function renderCategoryTree() {
  const allActive = state.filters.categoryGroup === "全部" && state.filters.category === "全部";
  const groups = state.db.categoryTree.map((group, groupIndex) => {
    const groupCount = state.db.links.filter((link) => link.categoryGroup === group.name).length;
    const groupActive = state.filters.categoryGroup === group.name && state.filters.category === "全部";
    const children = group.children.map((child, childIndex) => {
      const count = state.db.links.filter((link) => link.categoryGroup === group.name && link.category === child.name).length;
      const active = state.filters.categoryGroup === group.name && state.filters.category === child.name;
      return `<div class="tree-node child-node${active ? " active" : ""}" draggable="true" data-drag-kind="child" data-group-id="${escapeAttribute(group.id)}" data-child-id="${escapeAttribute(child.id)}"><button class="node-main" type="button" data-action="filter-child" data-group="${escapeAttribute(group.name)}" data-category="${escapeAttribute(child.name)}"><span class="node-icon">└</span><span class="node-name">${escapeHtml(child.name)}</span><span class="node-count">${count}</span></button><button class="node-more" type="button" data-action="toggle-node-menu">⋮</button><div class="node-menu"><button type="button" data-action="rename-child">编辑信息</button><button type="button" data-action="move-child-up" ${childIndex === 0 ? "disabled" : ""}>上移</button><button type="button" data-action="move-child-down" ${childIndex === group.children.length - 1 ? "disabled" : ""}>下移</button><button type="button" data-action="delete-child" class="danger-menu">删除</button></div></div>`;
    }).join("");
    return `<div class="tree-group${groupActive ? " active" : ""}" data-group-id="${escapeAttribute(group.id)}"><div class="tree-node group-node" draggable="true" data-drag-kind="group" data-group-id="${escapeAttribute(group.id)}"><button class="group-caret" type="button" data-action="toggle-group">${group.expanded ? "▾" : "▸"}</button><button class="node-main" type="button" data-action="filter-group" data-group="${escapeAttribute(group.name)}"><span class="folder-icon">☆</span><span class="node-name">${escapeHtml(group.name)}</span><span class="node-count">${groupCount}</span></button><button class="node-more" type="button" data-action="toggle-node-menu">⋮</button><div class="node-menu"><button type="button" data-action="add-child">新建小分类</button><button type="button" data-action="rename-group">编辑信息</button><button type="button" data-action="move-group-up" ${groupIndex === 0 ? "disabled" : ""}>上移</button><button type="button" data-action="move-group-down" ${groupIndex === state.db.categoryTree.length - 1 ? "disabled" : ""}>下移</button><button type="button" data-action="delete-group" class="danger-menu">删除</button></div></div><div class="tree-children" ${group.expanded ? "" : "hidden"}>${children}</div></div>`;
  }).join("");
  el.categoryTree.innerHTML = `<button class="filter-chip all-chip${allActive ? " active" : ""}" type="button" data-action="filter-all-categories"><span>全部收藏</span><span class="chip-count">${state.db.links.length}</span></button>${groups}`;
}

function renderFilterOptions() {
  const statuses = ["全部", ...getStatuses()];
  const tags = ["全部", ...getAllTags()];
  el.statusFilters.innerHTML = statuses.map((status) => editableChip("status", status, status === "全部" ? state.db.links.length : state.db.links.filter((link) => link.status === status).length)).join("");
  el.tagFilters.innerHTML = tags.map((tag) => editableChip("tag", tag, tag === "全部" ? state.db.links.length : state.db.links.filter((link) => link.tags.includes(tag)).length, "tag-chip")).join("");
}
function editableChip(type, value, count, cls = "filter-chip") {
  if (value === "全部") return `<button class="${cls}${state.filters[type] === value ? " active" : ""}" type="button" data-action="filter-${type}" data-value="${escapeAttribute(value)}"><span>${escapeHtml(value)}</span><span class="chip-count">${count}</span></button>`;
  const renameAction = type === "status" ? "rename-status" : "rename-tag";
  const deleteAction = type === "status" ? "delete-status" : "delete-tag";
  const deleteText = type === "status" ? "删除状态" : "删除标签";
  return `<div class="${cls} editable-chip${state.filters[type] === value ? " active" : ""}" data-type="${type}" data-value="${escapeAttribute(value)}"><button class="filter-main" type="button" data-action="filter-${type}" data-value="${escapeAttribute(value)}"><span>${escapeHtml(value)}</span><span class="chip-count">${count}</span></button><div class="chip-actions"><button class="chip-edit" type="button" data-action="${renameAction}" title="重命名">改</button><button class="chip-delete" type="button" data-action="${deleteAction}" title="删除">删</button></div></div>`;
}
function getStatuses() {
  const base = Array.isArray(state.db.statuses) && state.db.statuses.length ? state.db.statuses : DEFAULT_STATUSES;
  return unique([...base.map(clean).filter(Boolean), ...state.db.links.map((link) => clean(link.status)).filter(Boolean)]);
}
function getAllTags() {
  return unique([...(Array.isArray(state.db.tags) ? state.db.tags.map(clean).filter(Boolean) : []), ...state.db.links.flatMap((link) => link.tags || [])]);
}
function syncFilterCollections() {
  const baseStatuses = Array.isArray(state.db.statuses) && state.db.statuses.length ? state.db.statuses : DEFAULT_STATUSES;
  state.db.statuses = unique([...baseStatuses.map(clean).filter(Boolean), ...state.db.links.map((link) => clean(link.status)).filter(Boolean)]);
  state.db.tags = unique([...(Array.isArray(state.db.tags) ? state.db.tags.map(clean).filter(Boolean) : []), ...state.db.links.flatMap((link) => link.tags || [])]);
}

function renderLinks() {
  const links = getFilteredLinks();
  const viewMode = state.db.viewMode || "standard";
  if (el.viewModeSelect) el.viewModeSelect.value = viewMode;
  el.linkList.className = `link-list view-${viewMode}`;
  el.resultCount.textContent = links.length;
  el.emptyState.hidden = links.length > 0;
  el.linkList.innerHTML = links.map(rowHtml).join("");
}

function rowHtml(link) {
  const expanded = state.expandedLinks.has(link.id);
  const selected = state.selectedIds.has(link.id);
  const tags = link.tags.length ? link.tags.map((tag) => `<span class="pill">#${escapeHtml(tag)}</span>`).join("") : `<span class="pill muted-pill">无标签</span>`;
  return `<article class="link-row${expanded ? " expanded" : ""}${selected ? " selected" : ""}" draggable="true" data-drag-kind="link" data-id="${escapeAttribute(link.id)}"><div class="link-row-summary"><label class="select-box"><input type="checkbox" data-action="select-link" data-id="${escapeAttribute(link.id)}" ${selected ? "checked" : ""}></label><button class="expand-btn" type="button" data-action="toggle-link" data-id="${escapeAttribute(link.id)}">${expanded ? "▾" : "▸"}</button><div class="favicon-dot">${renderFavicon(link)}</div><div class="row-main-text"><div class="row-title-line"><h2 class="row-title">${escapeHtml(link.title)}</h2><span class="rating">${"★".repeat(link.rating)}${"☆".repeat(5 - link.rating)}</span></div><a class="row-url" href="${escapeAttribute(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.url)}</a><p class="row-brief">${escapeHtml(link.description)}</p></div><div class="row-meta"><span class="pill">${escapeHtml(link.categoryGroup)}</span><span class="pill">${escapeHtml(link.category)}</span><span class="pill ${getStatusClass(link.status)}">${escapeHtml(link.status)}</span><span class="date-mini">最近：${formatDate(link.lastOpenedAt)}</span></div><div class="row-actions"><button class="primary-btn small-btn" type="button" data-action="open" data-id="${escapeAttribute(link.id)}">打开</button><button class="ghost-btn small-btn copy-btn" type="button" data-action="copy-md" data-id="${escapeAttribute(link.id)}">复制 Markdown</button><button class="ghost-btn small-btn" type="button" data-action="edit" data-id="${escapeAttribute(link.id)}">编辑</button><button class="ghost-btn danger-btn small-btn" type="button" data-action="delete" data-id="${escapeAttribute(link.id)}">删除</button></div></div><div class="link-row-detail" ${expanded ? "" : "hidden"}><div class="detail-grid"><section class="focus-box"><h3>这个网站是干什么的</h3><p>${escapeHtml(link.description)}</p></section><section class="focus-box"><h3>以后什么时候用</h3><p>${escapeHtml(link.useCase)}</p></section></div><div class="tag-row">${tags}</div><section class="focus-box markdown-box"><h3>Markdown 笔记</h3><div class="markdown-body">${link.markdownNote ? renderMarkdown(link.markdownNote) : "暂无 Markdown 笔记。"}</div></section><div class="date-row"><span>添加：${formatDate(link.createdAt)}</span><span>更新：${formatDate(link.updatedAt)}</span><span>最近打开：${formatDate(link.lastOpenedAt)}</span></div></div></article>`;
}

function getFilteredLinks() {
  return state.db.links.filter((link) => {
    const text = [link.title, link.url, link.categoryGroup, link.category, link.status, link.description, link.useCase, link.markdownNote, link.tags.join(" ")].join(" ").toLowerCase();
    return (!state.filters.search || text.includes(state.filters.search)) && (state.filters.categoryGroup === "全部" || link.categoryGroup === state.filters.categoryGroup) && (state.filters.category === "全部" || link.category === state.filters.category) && (state.filters.status === "全部" || link.status === state.filters.status) && (state.filters.tag === "全部" || link.tags.includes(state.filters.tag));
  }).sort(compareLinks);
}
function compareLinks(a, b) { const sort = state.db.sort || "updated-desc"; if (sort === "manual") return 0; if (sort === "created-desc") return toTime(b.createdAt) - toTime(a.createdAt); if (sort === "opened-desc") return toTime(b.lastOpenedAt) - toTime(a.lastOpenedAt); if (sort === "rating-desc") return b.rating - a.rating || toTime(b.updatedAt) - toTime(a.updatedAt); if (sort === "title-asc") return a.title.localeCompare(b.title, "zh-CN"); return toTime(b.updatedAt || b.createdAt) - toTime(a.updatedAt || a.createdAt); }

function handleSidebarClick(event) {
  const button = event.target.closest("button");
  if (!button) return;
  const action = button.dataset.action;
  if (!action) return;
  if (action === "toggle-node-menu" || action === "toggle-filter-menu") event.stopPropagation();
  if (action === "toggle-section") return toggleSection(button.dataset.section);
  if (action === "add-group") return addGroup();
  if (action === "add-status") return addStatus();
  if (action === "add-tag") return addTag();
  if (action === "filter-all-categories") return filterAllCategories();
  if (action === "filter-group") return filterGroup(button.dataset.group);
  if (action === "filter-child") return filterChild(button.dataset.group, button.dataset.category);
  if (action === "filter-status" || action === "filter-tag") return filterSimple(button, action.replace("filter-", ""));
  if (action === "toggle-group") return toggleGroup(button.closest(".tree-group")?.dataset.groupId);
  if (action === "toggle-node-menu") return toggleNodeMenu(button);
  if (action === "toggle-filter-menu") return toggleFilterMenu(button);
  const editableChip = button.closest(".editable-chip");
  if (action === "rename-status") return renameStatus(editableChip?.dataset.value);
  if (action === "delete-status") return deleteStatus(editableChip?.dataset.value);
  if (action === "rename-tag") return renameTag(editableChip?.dataset.value);
  if (action === "delete-tag") return deleteTag(editableChip?.dataset.value);
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
function handleLinkClick(event) { const button = event.target.closest("button"); if (!button) return; const { action, id } = button.dataset; if (action === "toggle-link") return toggleLink(id); if (action === "open") return openLink(id); if (action === "copy-md") return copyMarkdownCard(id, button); if (action === "edit") return openForm(id); if (action === "delete") return deleteLink(id); }
function handleLinkChange(event) { const input = event.target.closest("input[data-action='select-link']"); if (!input) return; input.checked ? state.selectedIds.add(input.dataset.id) : state.selectedIds.delete(input.dataset.id); input.closest(".link-row")?.classList.toggle("selected", input.checked); renderBatchBar(); }

function handleTreeDragStart(event) {
  const node = event.target.closest("[draggable='true'][data-drag-kind]");
  if (!node || event.target.closest("button, input, textarea, select, a")) return;
  state.dragData = { kind: node.dataset.dragKind, groupId: node.dataset.groupId, childId: node.dataset.childId, linkId: node.dataset.id };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify(state.dragData));
}
function handleLinkDragStart(event) {
  const row = event.target.closest(".link-row");
  if (!row || event.target.closest("button, input, textarea, select, a")) return;
  state.dragData = { kind: "link", linkId: row.dataset.id };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify(state.dragData));
}
function allowDrop(event) {
  if (!state.dragData) return;
  const target = event.target.closest(".tree-node, .link-row");
  if (!target) return;
  event.preventDefault();
  clearDropHighlight();
  target.classList.add("drop-target");
}
function clearDropHighlight() { document.querySelectorAll(".drop-target").forEach((item) => item.classList.remove("drop-target")); }
async function handleTreeDrop(event) {
  if (!state.dragData) return;
  const targetNode = event.target.closest(".tree-node");
  if (!targetNode) return;
  event.preventDefault();
  const targetKind = targetNode.dataset.dragKind;
  const targetGroupId = targetNode.dataset.groupId || targetNode.closest(".tree-group")?.dataset.groupId;
  const targetChildId = targetNode.dataset.childId;
  if (state.dragData.kind === "group" && targetKind === "group") await reorderGroupByDrop(state.dragData.groupId, targetGroupId);
  if (state.dragData.kind === "child") await moveChildByDrop(state.dragData.groupId, state.dragData.childId, targetGroupId, targetChildId);
  if (state.dragData.kind === "link") await moveLinkToCategory(state.dragData.linkId, targetGroupId, targetChildId);
  state.dragData = null;
  clearDropHighlight();
  render();
}
async function handleLinkDrop(event) {
  if (!state.dragData || state.dragData.kind !== "link") return;
  const target = event.target.closest(".link-row");
  if (!target) return;
  event.preventDefault();
  const sourceId = state.dragData.linkId;
  const targetId = target.dataset.id;
  if (sourceId && targetId && sourceId !== targetId) {
    reorderLinks(sourceId, targetId);
    state.db.sort = "manual";
    el.sortSelect.value = "manual";
    await persist();
    render();
  }
  state.dragData = null;
  clearDropHighlight();
}
async function reorderGroupByDrop(sourceId, targetId) { if (!sourceId || !targetId || sourceId === targetId) return; reorderArrayById(state.db.categoryTree, sourceId, targetId); await persist(); }
async function moveChildByDrop(sourceGroupId, sourceChildId, targetGroupId, targetChildId) {
  const sourceGroup = findGroup(sourceGroupId); const targetGroup = findGroup(targetGroupId); if (!sourceGroup || !targetGroup || !sourceChildId) return;
  const index = sourceGroup.children.findIndex((item) => item.id === sourceChildId); if (index < 0) return;
  const [child] = sourceGroup.children.splice(index, 1);
  if (targetChildId) {
    const targetIndex = Math.max(0, targetGroup.children.findIndex((item) => item.id === targetChildId));
    targetGroup.children.splice(targetIndex, 0, child);
  } else {
    targetGroup.children.push(child);
  }
  await persist();
}
async function moveLinkToCategory(linkId, targetGroupId, targetChildId) {
  const group = findGroup(targetGroupId); if (!group) return;
  const child = targetChildId ? group.children.find((item) => item.id === targetChildId) : (group.children.find((item) => item.name === "未整理") || group.children[0] || { name: "未整理" });
  ensureCategoryExists(state.db, group.name, child.name);
  state.db.links.forEach((link) => { if (link.id === linkId) { link.categoryGroup = group.name; link.category = child.name; link.updatedAt = now(); } });
  await persist();
}
function reorderArrayById(array, sourceId, targetId) { const from = array.findIndex((item) => item.id === sourceId); const to = array.findIndex((item) => item.id === targetId); if (from < 0 || to < 0 || from === to) return; const [item] = array.splice(from, 1); array.splice(to, 0, item); }
function reorderLinks(sourceId, targetId) { reorderArrayById(state.db.links, sourceId, targetId); }

function filterSimple(button, key) { state.filters[key] = button.dataset.value; render(); }
function filterAllCategories() { state.filters.categoryGroup = "全部"; state.filters.category = "全部"; render(); }
function filterGroup(group) { state.filters.categoryGroup = group; state.filters.category = "全部"; render(); }
function filterChild(group, category) { state.filters.categoryGroup = group; state.filters.category = category; render(); }
function clearFilters() { state.filters = { search: "", categoryGroup: "全部", category: "全部", status: "全部", tag: "全部" }; el.searchInput.value = ""; render(); }
function toggleSection(section) { state.sectionCollapsed[section] = !state.sectionCollapsed[section]; applySectionState(); }
function applySectionState() { document.querySelectorAll(".filter-section").forEach((section) => { const collapsed = Boolean(state.sectionCollapsed[section.dataset.section]); section.classList.toggle("section-collapsed", collapsed); const caret = section.querySelector(".section-caret"); if (caret) caret.textContent = collapsed ? "▸" : "▾"; }); }
function toggleSidebar() { state.sidebarCollapsed = !state.sidebarCollapsed; el.dashboard.classList.toggle("sidebar-collapsed", state.sidebarCollapsed); const icon = el.sidebarToggleBtn.querySelector(".toggle-icon"); const text = el.sidebarToggleBtn.querySelector(".toggle-text"); icon.textContent = state.sidebarCollapsed ? "☰" : "‹"; text.textContent = state.sidebarCollapsed ? "筛选" : "收起"; el.sidebarToggleBtn.title = state.sidebarCollapsed ? "展开筛选栏" : "收起筛选栏"; }
function toggleGroup(groupId) { const group = findGroup(groupId); if (!group) return; group.expanded = !group.expanded; persist().then(render); }
function toggleNodeMenu(button) { const node = button.closest(".tree-node"); const open = node?.classList.contains("menu-open"); closeOpenMenus(); if (node && !open) node.classList.add("menu-open"); }
function toggleFilterMenu(button) { const node = button.closest(".editable-chip"); const open = node?.classList.contains("menu-open"); closeOpenMenus(); if (node && !open) node.classList.add("menu-open"); }
function closeOpenMenus(event) { if (event && event.target.closest(".node-menu, .node-more")) return; document.querySelectorAll(".tree-node.menu-open, .editable-chip.menu-open").forEach((node) => node.classList.remove("menu-open")); }

async function addGroup() { const name = clean(prompt("输入新大类名称：")); if (!name) return; if (state.db.categoryTree.some((group) => group.name === name)) return alert("这个大类已经存在。"); state.db.categoryTree.push({ id: createId("group"), name, expanded: true, children: [] }); await persist(); render(); }
async function addChild(groupId) { const group = findGroup(groupId); if (!group) return; const name = clean(prompt(`在「${group.name}」下面新建小分类：`)); if (!name) return; if (group.children.some((child) => child.name === name)) return alert("这个小分类已经存在。"); group.children.push({ id: createId("cat"), name }); group.expanded = true; await persist(); render(); }
async function renameGroup(groupId) { const group = findGroup(groupId); if (!group) return; const name = clean(prompt("修改大类名称：", group.name)); if (!name || name === group.name) return; const old = group.name; group.name = name; state.db.links.forEach((link) => { if (link.categoryGroup === old) { link.categoryGroup = name; link.updatedAt = now(); } }); if (state.filters.categoryGroup === old) state.filters.categoryGroup = name; await persist(); render(); }
async function renameChild(groupId, childId) { const group = findGroup(groupId); const child = group?.children.find((item) => item.id === childId); if (!group || !child) return; const name = clean(prompt("修改小分类名称：", child.name)); if (!name || name === child.name) return; const old = child.name; child.name = name; state.db.links.forEach((link) => { if (link.categoryGroup === group.name && link.category === old) { link.category = name; link.updatedAt = now(); } }); await persist(); render(); }
async function deleteGroup(groupId) { const group = findGroup(groupId); if (!group) return; if (!confirm(`删除大类「${group.name}」？其中链接会移动到「未整理 / 未整理」。`)) return; state.db.categoryTree = state.db.categoryTree.filter((item) => item.id !== groupId); state.db.links.forEach((link) => { if (link.categoryGroup === group.name) { link.categoryGroup = "未整理"; link.category = "未整理"; link.updatedAt = now(); } }); await persist(); filterAllCategories(); }
async function deleteChild(groupId, childId) { const group = findGroup(groupId); const child = group?.children.find((item) => item.id === childId); if (!group || !child) return; if (!confirm(`删除小分类「${child.name}」？其中链接会移动到本大类「未整理」。`)) return; group.children = group.children.filter((item) => item.id !== childId); state.db.links.forEach((link) => { if (link.categoryGroup === group.name && link.category === child.name) { link.category = "未整理"; link.updatedAt = now(); } }); await persist(); render(); }
async function moveGroup(groupId, direction) { const index = state.db.categoryTree.findIndex((group) => group.id === groupId); const next = index + direction; if (index < 0 || next < 0 || next >= state.db.categoryTree.length) return; [state.db.categoryTree[index], state.db.categoryTree[next]] = [state.db.categoryTree[next], state.db.categoryTree[index]]; await persist(); render(); }
async function moveChild(groupId, childId, direction) { const group = findGroup(groupId); if (!group) return; const index = group.children.findIndex((child) => child.id === childId); const next = index + direction; if (index < 0 || next < 0 || next >= group.children.length) return; [group.children[index], group.children[next]] = [group.children[next], group.children[index]]; await persist(); render(); }

async function addStatus() { const name = clean(prompt("输入新状态名称：")); if (!name) return; if (getStatuses().includes(name)) return alert("这个状态已经存在。"); state.db.statuses = [...getStatuses(), name]; await persist(); render(); }
async function renameStatus(oldName) { if (!oldName) return; const name = clean(prompt("修改状态名称：", oldName)); if (!name || name === oldName) return; if (getStatuses().includes(name)) return alert("这个状态已经存在。"); state.db.statuses = getStatuses().map((status) => status === oldName ? name : status); state.db.links.forEach((link) => { if (link.status === oldName) { link.status = name; link.updatedAt = now(); } }); if (state.filters.status === oldName) state.filters.status = name; await persist(); render(); }
async function deleteStatus(name) { if (!name) return; const statuses = getStatuses(); if (statuses.length <= 1) return alert("至少需要保留一个状态。"); const fallback = statuses.find((status) => status !== name) || "未整理"; if (!confirm(`删除状态「${name}」？使用这个状态的链接会改成「${fallback}」。`)) return; state.db.statuses = statuses.filter((status) => status !== name); state.db.links.forEach((link) => { if (link.status === name) { link.status = fallback; link.updatedAt = now(); } }); if (state.filters.status === name) state.filters.status = "全部"; await persist(); render(); }
async function addTag() { const name = clean(prompt("输入新标签名称：")); if (!name) return; if (getAllTags().includes(name)) return alert("这个标签已经存在。"); state.db.tags = [...getAllTags(), name]; await persist(); render(); }
async function renameTag(oldName) { if (!oldName) return; const name = clean(prompt("修改标签名称：", oldName)); if (!name || name === oldName) return; if (getAllTags().includes(name)) return alert("这个标签已经存在。"); state.db.tags = getAllTags().map((tag) => tag === oldName ? name : tag); state.db.links.forEach((link) => { if (link.tags.includes(oldName)) { link.tags = unique(link.tags.map((tag) => tag === oldName ? name : tag)); link.updatedAt = now(); } }); if (state.filters.tag === oldName) state.filters.tag = name; await persist(); render(); }
async function deleteTag(name) { if (!name) return; if (!confirm(`删除标签「${name}」？所有链接里的这个标签都会被移除。`)) return; state.db.tags = getAllTags().filter((tag) => tag !== name); state.db.links.forEach((link) => { if (link.tags.includes(name)) { link.tags = link.tags.filter((tag) => tag !== name); link.updatedAt = now(); } }); if (state.filters.tag === name) state.filters.tag = "全部"; await persist(); render(); }

function openForm(id = null) { const link = id ? state.db.links.find((item) => item.id === id) : null; state.editingId = id; el.dialogTitle.textContent = link ? "编辑链接" : "添加链接"; el.linkForm.reset(); fillOptions(); if (link) { el.titleInput.value = link.title; el.urlInput.value = link.url; el.faviconInput.value = link.favicon || ""; el.categoryGroupInput.value = link.categoryGroup; el.categoryInput.value = link.category; el.tagsInput.value = link.tags.join(", "); el.ratingInput.value = String(link.rating); el.statusInput.value = link.status; el.descriptionInput.value = link.description; el.useCaseInput.value = link.useCase; el.markdownNoteInput.value = link.markdownNote; } else { el.categoryGroupInput.value = state.filters.categoryGroup !== "全部" ? state.filters.categoryGroup : "未整理"; el.categoryInput.value = state.filters.category !== "全部" ? state.filters.category : "未整理"; el.ratingInput.value = "3"; el.statusInput.value = getStatuses()[0] || "未整理"; } el.formError.textContent = ""; el.linkDialog.showModal(); }
function closeForm() { state.editingId = null; el.linkDialog.close(); }
async function saveForm(event) { event.preventDefault(); const data = readForm(); const err = validate(data); if (err) { el.formError.textContent = err; return; } const url = normalizeUrl(data.url); const duplicate = state.db.links.find((link) => normalizeUrl(link.url).toLowerCase() === url.toLowerCase() && link.id !== state.editingId); if (duplicate) { el.formError.textContent = "这个 URL 已经存在。"; return; } const existing = state.editingId ? state.db.links.find((link) => link.id === state.editingId) : null; const next = normalizeLink({ ...data, url, id: existing?.id || createId("link"), createdAt: existing?.createdAt || now(), lastOpenedAt: existing?.lastOpenedAt || "", updatedAt: now() }); state.db.links = existing ? state.db.links.map((link) => link.id === existing.id ? next : link) : [next, ...state.db.links]; ensureCategoryExists(state.db, next.categoryGroup, next.category); await persist(); closeForm(); render(); }
function readForm() { return { title: el.titleInput.value, url: el.urlInput.value, favicon: el.faviconInput.value, categoryGroup: el.categoryGroupInput.value, category: el.categoryInput.value, tags: parseTags(el.tagsInput.value), rating: el.ratingInput.value, status: el.statusInput.value, description: el.descriptionInput.value, useCase: el.useCaseInput.value, markdownNote: el.markdownNoteInput.value }; }
function validate(link) { if (!clean(link.title)) return "标题不能为空。"; if (!isValidUrl(link.url)) return "URL 无效。"; if (!clean(link.categoryGroup)) return "大类不能为空。"; if (!clean(link.category)) return "小分类不能为空。"; return ""; }
async function openLink(id) { const link = state.db.links.find((item) => item.id === id); if (!link) return; link.lastOpenedAt = now(); link.updatedAt = link.lastOpenedAt; await persist(); render(); window.open(link.url, "_blank", "noopener,noreferrer"); }
async function deleteLink(id) { const link = state.db.links.find((item) => item.id === id); if (!link || !confirm(`确定删除「${link.title}」？`)) return; state.db.links = state.db.links.filter((item) => item.id !== id); state.selectedIds.delete(id); state.expandedLinks.delete(id); await persist(); render(); }
function toggleLink(id) { state.expandedLinks.has(id) ? state.expandedLinks.delete(id) : state.expandedLinks.add(id); renderLinks(); }

async function copyMarkdownCard(id, button) {
  const link = state.db.links.find((item) => item.id === id);
  if (!link) return;
  const text = buildMarkdownCard(link);
  try {
    await navigator.clipboard.writeText(text);
    flashButton(button, "已复制");
  } catch {
    const box = document.createElement("textarea");
    box.value = text;
    document.body.appendChild(box);
    box.select();
    document.execCommand("copy");
    box.remove();
    flashButton(button, "已复制");
  }
}

function buildMarkdownCard(link) {
  const tags = link.tags?.length ? link.tags.map((tag) => `#${tag}`).join(" ") : "无";
  const note = clean(link.markdownNote) ? `

笔记：
${clean(link.markdownNote)}` : "";
  return `[${link.title}](${link.url})

简介：${link.description}

用途：${link.useCase}

分类：${link.categoryGroup} / ${link.category}
标签：${tags}
状态：${link.status}${note}`;
}

function flashButton(button, text) {
  if (!button) return;
  const old = button.textContent;
  button.textContent = text;
  button.disabled = true;
  setTimeout(() => { button.textContent = old; button.disabled = false; }, 1200);
}

function renderBatchBar() { el.batchBar.hidden = state.selectedIds.size === 0; el.selectedCount.textContent = state.selectedIds.size; }
function openBatchDialog() { if (!state.selectedIds.size) return; el.batchForm.reset(); fillOptions(); el.batchDialog.showModal(); }
function closeBatchDialog() { el.batchDialog.close(); }
async function applyBatchEdit(event) { event.preventDefault(); const selected = new Set(state.selectedIds); const group = clean(el.batchCategoryGroupInput.value); const category = clean(el.batchCategoryInput.value); const addTags = parseTags(el.batchAddTagsInput.value); const removeTags = parseTags(el.batchRemoveTagsInput.value); const status = el.batchStatusInput.value; const rating = el.batchRatingInput.value; state.db.links = state.db.links.map((link) => { if (!selected.has(link.id)) return link; const next = { ...link, updatedAt: now() }; if (group) next.categoryGroup = group; if (category) next.category = category; if (addTags.length) next.tags = unique([...next.tags, ...addTags]); if (removeTags.length) next.tags = next.tags.filter((tag) => !removeTags.includes(tag)); if (status) next.status = status; if (rating) next.rating = clampRating(rating); return next; }); await persist(); closeBatchDialog(); render(); }
async function batchDelete() { if (!state.selectedIds.size || !confirm(`确定批量删除 ${state.selectedIds.size} 条收藏？`)) return; const selected = new Set(state.selectedIds); state.db.links = state.db.links.filter((link) => !selected.has(link.id)); state.selectedIds.clear(); await persist(); render(); }

async function exportDb() { state.db.lastBackupAt = now(); await persist(); await downloadJson(`personal-link-library-${new Date().toISOString().slice(0,10)}.json`, exportDbShape(state.db)); renderBackupNotice(); }
function importDb(event) { const file = event.target.files[0]; el.importFileInput.value = ""; if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { const imported = JSON.parse(reader.result); const links = Array.isArray(imported) ? imported : imported.links; if (!Array.isArray(links)) return alert("JSON 必须是链接数组，或包含 links 数组。"); if (Array.isArray(imported.categoryTree)) state.db.categoryTree = mergeCategoryTrees(state.db.categoryTree, imported.categoryTree.map(normalizeGroup).filter(Boolean)); if (Array.isArray(imported.statuses)) state.db.statuses = unique([...getStatuses(), ...imported.statuses.map(clean).filter(Boolean)]); if (Array.isArray(imported.tags)) state.db.tags = unique([...getAllTags(), ...imported.tags.map(clean).filter(Boolean)]); const before = state.db.links.length; state.db.links = mergeLinks(state.db.links, links.map(normalizeLink)); await persist(); render(); alert(`导入完成：新增 ${state.db.links.length - before} 条。`); } catch { alert("导入失败：JSON 格式错误。"); } }; reader.readAsText(file, "UTF-8"); }
function importBookmarkHtml(event) { const file = event.target.files[0]; el.bookmarkFileInput.value = ""; if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { const parsed = parseBookmarkHtml(reader.result); if (!parsed.length) return alert("没有在这个 HTML 文件里找到浏览器书签。请确认是从 Chrome/Edge 书签管理器导出的 HTML。"); const before = state.db.links.length; state.db.links = mergeLinks(state.db.links, parsed); ensureTreeContainsLinks(state.db); await persist(); render(); alert(`书签导入完成：新增 ${state.db.links.length - before} 条，重复 URL 已跳过。`); } catch (error) { console.error(error); alert("书签 HTML 导入失败。请确认文件格式。"); } }; reader.readAsText(file, "UTF-8"); }
function parseBookmarkHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const links = [];
  const root = doc.querySelector("dl") || doc.body;
  walkBookmarkNode(root, []);
  return links;

  function walkBookmarkNode(node, path) {
    Array.from(node.children || []).forEach((child, index, siblings) => {
      if (child.tagName === "DT") {
        const direct = Array.from(child.children || []);
        const h3 = direct.find((item) => item.tagName === "H3");
        const a = direct.find((item) => item.tagName === "A");
        if (a) links.push(bookmarkAnchorToLink(a, path));
        if (h3) {
          const directNested = direct.find((item) => item.tagName === "DL");
          const siblingNested = siblings[index + 1]?.tagName === "DL" ? siblings[index + 1] : null;
          const nested = directNested || siblingNested;
          if (nested) walkBookmarkNode(nested, [...path, clean(h3.textContent)]);
        } else {
          const nested = direct.find((item) => item.tagName === "DL");
          if (nested) walkBookmarkNode(nested, path);
        }
      } else if (child.tagName === "DL") {
        walkBookmarkNode(child, path);
      }
    });
  }
}
function bookmarkAnchorToLink(anchor, path) {
  const folderPath = path.filter(Boolean);
  const group = folderPath[0] || "浏览器书签";
  const category = folderPath.length > 1 ? folderPath.slice(1).join(" / ") : (folderPath[0] || "未整理");
  const addDate = Number(anchor.getAttribute("ADD_DATE") || anchor.getAttribute("add_date") || "");
  const createdAt = addDate ? new Date(addDate * 1000).toISOString() : now();
  const icon = anchor.getAttribute("ICON") || anchor.getAttribute("icon") || "";
  return normalizeLink({ title: clean(anchor.textContent) || anchor.href, url: anchor.getAttribute("href"), favicon: safeFavicon(icon), categoryGroup: group, category, tags: ["书签导入"], description: "从浏览器书签 HTML 导入。", useCase: "需要重新访问这个收藏网页时使用。", createdAt, updatedAt: createdAt, rating: 3, status: "未整理" });
}
async function clearAllData() { if (!confirm("确定清空扩展版所有收藏数据？这个操作不能撤销。\n\n建议先点“导出备份 JSON”。")) return; state.db.links = []; state.db.categoryTree = clone(DEFAULT_TREE); state.selectedIds.clear(); state.expandedLinks.clear(); await persist(); clearFilters(); }

function fillOptions() { const groups = unique(state.db.categoryTree.map((group) => group.name)); const categories = unique(state.db.categoryTree.flatMap((group) => group.children.map((child) => child.name))); const statuses = getStatuses(); el.categoryGroupOptions.innerHTML = groups.map((name) => `<option value="${escapeAttribute(name)}"></option>`).join(""); el.categoryOptions.innerHTML = categories.map((name) => `<option value="${escapeAttribute(name)}"></option>`).join(""); el.statusInput.innerHTML = statuses.map((status) => `<option value="${escapeAttribute(status)}">${escapeHtml(status)}</option>`).join(""); el.batchStatusInput.innerHTML = `<option value="">不修改</option>` + statuses.map((status) => `<option value="${escapeAttribute(status)}">${escapeHtml(status)}</option>`).join(""); }
function hasActiveFilters() { return state.filters.search || state.filters.categoryGroup !== "全部" || state.filters.category !== "全部" || state.filters.status !== "全部" || state.filters.tag !== "全部"; }
function renderActiveFilterText() { const parts = []; if (state.filters.categoryGroup !== "全部") parts.push(state.filters.categoryGroup); if (state.filters.category !== "全部") parts.push(state.filters.category); if (state.filters.status !== "全部") parts.push(state.filters.status); if (state.filters.tag !== "全部") parts.push(`#${state.filters.tag}`); if (state.filters.search) parts.push(`搜索：${state.filters.search}`); el.activeFilterText.textContent = parts.length ? parts.join(" / ") : "全部数据"; if (el.clearFiltersBtn) el.clearFiltersBtn.hidden = !hasActiveFilters(); }
function findGroup(groupId) { return state.db.categoryTree.find((group) => group.id === groupId); }
