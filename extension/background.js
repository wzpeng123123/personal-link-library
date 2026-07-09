importScripts("shared-storage.js");

const MENU_SAVE_PAGE = "pll-save-page";
const MENU_SAVE_LINK = "pll-save-link";
const MENU_OPEN_LIBRARY = "pll-open-library";

chrome.runtime.onInstalled.addListener(() => {
  rebuildContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  rebuildContextMenus();
});

function rebuildContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_SAVE_PAGE,
      title: "保存当前页面到个人链接库",
      contexts: ["page"]
    });
    chrome.contextMenus.create({
      id: MENU_SAVE_LINK,
      title: "保存这个链接到个人链接库",
      contexts: ["link"]
    });
    chrome.contextMenus.create({
      id: MENU_OPEN_LIBRARY,
      title: "打开个人链接库完整库",
      contexts: ["page", "link"]
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  handleContextClick(info, tab);
});

async function handleContextClick(info, tab) {
  if (info.menuItemId === MENU_OPEN_LIBRARY) {
    chrome.tabs.create({ url: chrome.runtime.getURL("library.html") });
    return;
  }

  if (info.menuItemId === MENU_SAVE_PAGE) {
    await saveToLibrary({
      title: tab?.title || tab?.url || "未命名页面",
      url: tab?.url || "",
      favicon: tab?.favIconUrl || "",
      description: "通过右键菜单保存的当前页面。",
      tags: ["右键收藏", "当前页面"]
    });
    return;
  }

  if (info.menuItemId === MENU_SAVE_LINK) {
    await saveToLibrary({
      title: info.selectionText || info.linkUrl || "未命名链接",
      url: info.linkUrl || "",
      favicon: "",
      description: `通过右键菜单从「${tab?.title || "当前页面"}」保存的链接。`,
      tags: ["右键收藏", "链接"]
    });
  }
}

async function saveToLibrary(raw) {
  try {
    const db = await loadExtensionDb();
    const defaultStatus = Array.isArray(db.statuses) && db.statuses.length ? db.statuses[0] : "未整理";
    const link = normalizeLink({
      title: raw.title,
      url: raw.url,
      favicon: raw.favicon,
      categoryGroup: "收件箱",
      category: "未整理",
      tags: raw.tags,
      description: raw.description,
      useCase: "先保存，之后在完整库中整理分类、标签和笔记。",
      markdownNote: "",
      rating: 3,
      status: defaultStatus
    });

    if (!link.title || !isValidUrl(link.url)) {
      showBadge("失败", "#b42318");
      return;
    }

    const duplicated = db.links.some((item) => normalizeUrl(item.url).toLowerCase() === normalizeUrl(link.url).toLowerCase());
    if (duplicated) {
      showBadge("重复", "#f79009");
      return;
    }

    ensureCategoryExists(db, link.categoryGroup, link.category);
    db.links.unshift(link);
    await saveExtensionDb(db);
    showBadge("已存", "#12b76a");
  } catch (error) {
    console.warn("右键收藏失败：", error);
    showBadge("失败", "#b42318");
  }
}

function showBadge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 1800);
}
