import { loginUser, logoutUser, refreshSession, registerUser, renderSessionControls } from "./auth.js";

const DATA_URL = "./data/site-data.json";
const API_DATA_URL = "./api/site-data";

const i18n = {
    en: {
        tagline: "Industrial Cluster Navigator",
        heroTitle: "Find China's Best Industrial Clusters & Suppliers",
        heroDesc: "Search by product name to discover matching manufacturing hubs and verified B2B partners. Furniture, electronics, textiles, daily goods, direct from source.",
        searchLabel: "Search products",
        searchPlaceholder: "Search product... e.g. LED light, phone case, sofa",
        helperText: "Supports English and Chinese keyword matching.",
        searchBtn: "Search",
        listCount: "Industrial clusters",
        matchCount: "Matching suppliers",
        available: "available",
        found: "found",
        viewSuppliers: "View suppliers",
        mainProducts: "Main products",
        backToAll: "Back to all clusters",
        openCluster: "Open cluster detail",
        showMore: "View more clusters",
        showLess: "Show fewer clusters",
        authRequired: "Admin login is required to access the management dashboard.",
        authLogin: "Login",
        authRegister: "Register",
        authLoginRegister: "Login / Register",
        authLogout: "Logout",
        adminEntry: "Admin",
        authTitle: "Login or create an account",
        authLoginSuccess: "Login successful.",
        authRegisterSuccess: "Registration successful.",
        unassignedCluster: "Independent supplier",
        noResultsTitle: "No matching suppliers found",
        noResultsText: "Try another keyword such as LED light, sofa, toy, ceramic cup, or mattress.",
        footerText: "Leading industrial clusters across China | Fuzzy search supported | Direct supplier contacts for global sourcing",
        siteError: "Unable to load data. Please make sure every file was uploaded together.",
        metricClusters: "Clusters",
        metricMerchants: "Suppliers",
        metricLangs: "Languages",
        suppliers: "suppliers"
    },
    zh: {
        tagline: "产业带导航专家",
        heroTitle: "找到中国优质产业带与源头供应商",
        heroDesc: "输入商品名称，快速定位对应产业带和真实商家信息。家具、电子、纺织、小商品，精准匹配源头工厂。",
        searchLabel: "搜索商品",
        searchPlaceholder: "搜索商品，例如：LED灯、手机壳、沙发",
        helperText: "支持中文和英文关键词匹配。",
        searchBtn: "搜索",
        listCount: "全国产业带",
        matchCount: "匹配供应商",
        available: "个",
        found: "家",
        viewSuppliers: "查看供应商",
        mainProducts: "主营商品",
        backToAll: "返回全部产业带",
        openCluster: "查看产业带详情",
        showMore: "查看更多产业带",
        showLess: "收起产业带",
        authRequired: "访问管理后台前，请先以管理员身份登录。",
        authLogin: "登录",
        authRegister: "注册",
        authLoginRegister: "登录 / 注册",
        authLogout: "退出登录",
        adminEntry: "管理后台",
        authTitle: "登录或创建账号",
        authLoginSuccess: "登录成功。",
        authRegisterSuccess: "注册成功。",
        unassignedCluster: "未归类商家",
        noResultsTitle: "没有找到匹配供应商",
        noResultsText: "试试其他关键词，例如 LED灯、沙发、玩具、陶瓷杯 或 床垫。",
        footerText: "覆盖中国核心产业带集群 | 支持中英文模糊搜索 | 直连源头商家",
        siteError: "数据加载失败，请确认所有文件已一起上传。",
        metricClusters: "产业带",
        metricMerchants: "商家",
        metricLangs: "语言",
        suppliers: "家供应商"
    }
};

const state = {
    currentLang: "en",
    currentMode: "list",
    currentSearchKeyword: "",
    detailIndustryId: "",
    showAllIndustries: false,
    industries: [],
    merchants: []
};

const els = {
    searchInput: document.getElementById("searchInput"),
    searchBtn: document.getElementById("searchBtn"),
    clearSearchBtn: document.getElementById("clearSearchBtn"),
    mainContent: document.getElementById("mainContent"),
    statsBar: document.getElementById("statsBar"),
    footerText: document.getElementById("footerText"),
    heroTitle: document.getElementById("heroTitle"),
    heroDesc: document.getElementById("heroDesc"),
    taglineText: document.getElementById("taglineText"),
    searchLabel: document.getElementById("searchLabel"),
    helperText: document.getElementById("helperText"),
    statusNotice: document.getElementById("statusNotice"),
    authControls: document.getElementById("authControls"),
    authModal: document.getElementById("authModal"),
    authCloseBtn: document.getElementById("authCloseBtn"),
    authForm: document.getElementById("authForm"),
    authUsername: document.getElementById("authUsername"),
    authEmailField: document.getElementById("authEmailField"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    authMessage: document.getElementById("authMessage"),
    authSubmitBtn: document.getElementById("authSubmitBtn"),
    authTitle: document.getElementById("authTitle"),
    loginTabBtn: document.getElementById("loginTabBtn"),
    registerTabBtn: document.getElementById("registerTabBtn"),
    qrModal: document.getElementById("qrModal"),
    qrCloseBtn: document.getElementById("qrCloseBtn"),
    wechatTriggerBtn: document.getElementById("wechatTriggerBtn")
};

let authMode = "login";

function t(key) {
    return i18n[state.currentLang][key] || i18n.en[key] || key;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => {
        if (char === "&") return "&amp;";
        if (char === "<") return "&lt;";
        if (char === ">") return "&gt;";
        if (char === "\"") return "&quot;";
        return char;
    });
}

function splitList(value) {
    if (Array.isArray(value)) return value;
    return String(value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function getIndustryName(industry) {
    return state.currentLang === "zh" ? industry.name_zh : industry.name_en;
}

function getIndustryLocation(industry) {
    return state.currentLang === "zh" ? industry.location_zh : industry.location_en;
}

function normalizeKeyword(keyword) {
    return keyword.trim().toLowerCase();
}

function highlightText(text, keyword) {
    if (!keyword.trim()) return escapeHtml(text);
    const safeText = escapeHtml(text);
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return safeText.replace(regex, "<span class=\"highlight\">$1</span>");
}

function setNotice(message, type = "info") {
    if (!message) {
        els.statusNotice.classList.add("hidden");
        els.statusNotice.textContent = "";
        return;
    }

    els.statusNotice.classList.remove("hidden");
    els.statusNotice.textContent = message;
    els.statusNotice.style.borderColor = type === "error" ? "rgba(196, 87, 69, 0.25)" : "";
    els.statusNotice.style.background = type === "error" ? "rgba(196, 87, 69, 0.1)" : "";
    els.statusNotice.style.color = type === "error" ? "#8c3024" : "";
}

function setAuthMessage(message, type = "info") {
    if (!message) {
        els.authMessage.classList.add("hidden");
        els.authMessage.classList.remove("error");
        els.authMessage.textContent = "";
        return;
    }

    els.authMessage.classList.remove("hidden");
    els.authMessage.classList.toggle("error", type === "error");
    els.authMessage.textContent = message;
}

function openAuthModal(mode = "login") {
    authMode = mode;
    syncAuthUi();
    setAuthMessage("");
    els.authModal.classList.remove("hidden");
    els.authModal.setAttribute("aria-hidden", "false");
    els.authUsername.focus();
}

function closeAuthModal() {
    els.authModal.classList.add("hidden");
    els.authModal.setAttribute("aria-hidden", "true");
    els.authForm.reset();
    setAuthMessage("");
}

function syncAuthUi() {
    const isRegister = authMode === "register";
    els.loginTabBtn.classList.toggle("active", !isRegister);
    els.registerTabBtn.classList.toggle("active", isRegister);
    els.authEmailField.classList.toggle("hidden", !isRegister);
    els.authEmail.toggleAttribute("required", isRegister);
    els.authTitle.textContent = t("authTitle");
    els.authSubmitBtn.textContent = isRegister ? t("authRegister") : t("authLogin");
    els.authPassword.autocomplete = isRegister ? "new-password" : "current-password";
}

function renderAuthControls() {
    renderSessionControls(els.authControls, {
        triggerId: "authTriggerBtn",
        logoutId: "siteLogoutBtn",
        adminHref: "./admin.html",
        labels: {
            authTrigger: t("authLoginRegister"),
            logout: t("authLogout"),
            admin: t("adminEntry")
        }
    });

    document.getElementById("authTriggerBtn")?.addEventListener("click", () => {
        openAuthModal("login");
    });

    document.getElementById("siteLogoutBtn")?.addEventListener("click", async () => {
        await logoutUser();
        setNotice("");
        renderAuthControls();
    });
}

function renderToolbar(label, extraActionHtml = "") {
    els.statsBar.innerHTML = `
        <div class="result-pill">${escapeHtml(label)}</div>
        <div class="toolbar-actions">${extraActionHtml}</div>
    `;
}

function openQrModal() {
    els.qrModal.classList.remove("hidden");
    els.qrModal.setAttribute("aria-hidden", "false");
}

function closeQrModal() {
    els.qrModal.classList.add("hidden");
    els.qrModal.setAttribute("aria-hidden", "true");
}

function getShuffledIndustries() {
    const seed = 20260414;
    const list = [...state.industries];
    let randomState = seed;

    function nextRandom() {
        randomState = (randomState * 1664525 + 1013904223) % 4294967296;
        return randomState / 4294967296;
    }

    for (let index = list.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(nextRandom() * (index + 1));
        [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
    }

    return list;
}

function renderIndustryList() {
    const shuffledIndustries = getShuffledIndustries();
    const visibleIndustries = state.showAllIndustries ? shuffledIndustries : shuffledIndustries.slice(0, 12);
    const summary = state.currentLang === "zh"
        ? `${t("listCount")} ${countSuffix(state.industries.length, t("available"))}`
        : `${t("listCount")} ${state.industries.length} ${t("available")}`;
    renderToolbar(summary);

    els.mainContent.innerHTML = `
        <div class="industries-grid">
            ${visibleIndustries.map((industry) => {
                const products = state.currentLang === "zh" ? industry.mainProducts : industry.mainProducts_en;
                return `
                    <article class="industry-card" data-industry-id="${escapeHtml(industry.id)}">
                        <p class="industry-location"><i class="fas fa-location-dot"></i>${escapeHtml(getIndustryLocation(industry))}</p>
                        <h2 class="industry-name">${escapeHtml(getIndustryName(industry))}</h2>
                        <div class="tag-row">
                            ${products.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
                        </div>
                        <div class="card-footer">
                            <button class="link-btn" type="button">${escapeHtml(t("viewSuppliers"))}</button>
                        </div>
                    </article>
                `;
            }).join("")}
        </div>
        ${state.industries.length > 12 ? `
            <div class="more-wrap">
                <button class="primary-btn more-btn" id="toggleIndustriesBtn" type="button">
                    ${escapeHtml(state.showAllIndustries ? t("showLess") : t("showMore"))}
                </button>
            </div>
        ` : ""}
    `;

    document.querySelectorAll("[data-industry-id]").forEach((card) => {
        card.addEventListener("click", () => {
            const industryId = card.getAttribute("data-industry-id");
            if (!industryId) return;
            state.currentMode = "detail";
            state.detailIndustryId = industryId;
            state.currentSearchKeyword = "";
            els.searchInput.value = "";
            syncUrl();
            render();
        });
    });

    document.getElementById("toggleIndustriesBtn")?.addEventListener("click", () => {
        state.showAllIndustries = !state.showAllIndustries;
        renderIndustryList();
    });
}

function countSuffix(value, suffix) {
    return `${value}${suffix}`;
}

function findIndustry(industryId) {
    return state.industries.find((industry) => industry.id === industryId);
}

function filterMerchants(keyword) {
    const normalized = normalizeKeyword(keyword);
    if (!normalized) return [];
    return state.merchants.filter((merchant) => {
        const industry = findIndustry(merchant.industryId);
        const haystacks = [
            merchant.name,
            merchant.products,
            merchant.email,
            merchant.website,
            merchant.phone,
            industry?.name_en,
            industry?.name_zh,
            ...(industry?.mainProducts || []),
            ...(industry?.mainProducts_en || [])
        ];
        return haystacks.some((value) => String(value ?? "").toLowerCase().includes(normalized));
    });
}

function renderMerchantCards(merchants, keyword = "") {
    if (!merchants.length) {
        renderToolbar(`${t("matchCount")} 0`, `<button class="link-btn" type="button" id="backToAllBtn">${escapeHtml(t("backToAll"))}</button>`);
        els.mainContent.innerHTML = `
            <div class="no-results">
                <h2>${escapeHtml(t("noResultsTitle"))}</h2>
                <p>${escapeHtml(t("noResultsText"))}</p>
            </div>
        `;
        document.getElementById("backToAllBtn")?.addEventListener("click", resetToList);
        return;
    }

    renderToolbar(
        state.currentLang === "zh"
            ? `${t("matchCount")} ${merchants.length}${t("found")}`
            : `${t("matchCount")} ${merchants.length} ${t("found")}`,
        `<button class="link-btn" type="button" id="backToAllBtn">${escapeHtml(t("backToAll"))}</button>`
    );

    els.mainContent.innerHTML = `
        <div class="merchants-grid">
            ${merchants.map((merchant) => {
                const industry = findIndustry(merchant.industryId);
                const websiteHref = merchant.website.startsWith("http") ? merchant.website : `https://${merchant.website}`;
                const contactItems = [
                    merchant.email ? `<a href="mailto:${escapeHtml(merchant.email)}"><i class="fas fa-envelope"></i>${escapeHtml(merchant.email)}</a>` : "",
                    merchant.website ? `<a href="${escapeHtml(websiteHref)}" target="_blank" rel="noopener"><i class="fas fa-globe"></i>${escapeHtml(merchant.website)}</a>` : "",
                    merchant.phone ? `<span><i class="fas fa-phone"></i>${escapeHtml(merchant.phone)}</span>` : ""
                ].filter(Boolean).join("");
                return `
                    <article class="merchant-card">
                        <div class="industry-pill">${escapeHtml(industry ? getIndustryName(industry) : (merchant.industryId || t("unassignedCluster")))}</div>
                        <h2 class="merchant-name">${escapeHtml(merchant.name)}</h2>
                        <p class="merchant-products"><strong>${escapeHtml(t("mainProducts"))}:</strong> ${highlightText(merchant.products, keyword)}</p>
                        <div class="contact-list">${contactItems}</div>
                    </article>
                `;
            }).join("")}
        </div>
    `;

    document.getElementById("backToAllBtn")?.addEventListener("click", resetToList);
}

function renderIndustryDetail(industryId) {
    const industry = findIndustry(industryId);
    if (!industry) {
        resetToList();
        return;
    }

    const merchants = state.merchants.filter((merchant) => merchant.industryId === industryId);
    const products = state.currentLang === "zh" ? industry.mainProducts : industry.mainProducts_en;

    renderToolbar(
        `${getIndustryName(industry)} | ${state.currentLang === "zh" ? `${merchants.length}${t("suppliers")}` : `${merchants.length} ${t("suppliers")}`}`,
        `<button class="link-btn" type="button" id="backToAllBtn">${escapeHtml(t("backToAll"))}</button>`
    );

    els.mainContent.innerHTML = `
        <div class="detail-shell">
            <div class="detail-head">
                <div>
                    <p class="industry-location"><i class="fas fa-location-dot"></i>${escapeHtml(getIndustryLocation(industry))}</p>
                    <h2 class="industry-name">${escapeHtml(getIndustryName(industry))}</h2>
                </div>
                <div class="tag-row">
                    ${products.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
                </div>
            </div>
            <div class="merchants-grid">
                ${merchants.map((merchant) => {
                    const websiteHref = merchant.website.startsWith("http") ? merchant.website : `https://${merchant.website}`;
                    const contactItems = [
                        merchant.email ? `<a href="mailto:${escapeHtml(merchant.email)}"><i class="fas fa-envelope"></i>${escapeHtml(merchant.email)}</a>` : "",
                        merchant.website ? `<a href="${escapeHtml(websiteHref)}" target="_blank" rel="noopener"><i class="fas fa-globe"></i>${escapeHtml(merchant.website)}</a>` : "",
                        merchant.phone ? `<span><i class="fas fa-phone"></i>${escapeHtml(merchant.phone)}</span>` : ""
                    ].filter(Boolean).join("");
                    return `
                        <article class="merchant-card">
                            <h3 class="merchant-name">${escapeHtml(merchant.name)}</h3>
                            <p class="merchant-products"><strong>${escapeHtml(t("mainProducts"))}:</strong> ${escapeHtml(merchant.products)}</p>
                            <div class="contact-list">${contactItems}</div>
                        </article>
                    `;
                }).join("")}
            </div>
        </div>
    `;

    document.getElementById("backToAllBtn")?.addEventListener("click", resetToList);
}

function resetToList() {
    state.currentMode = "list";
    state.detailIndustryId = "";
    state.currentSearchKeyword = "";
    state.showAllIndustries = false;
    els.searchInput.value = "";
    syncUrl();
    render();
}

function syncStaticCopy() {
    els.taglineText.textContent = t("tagline");
    els.heroTitle.textContent = t("heroTitle");
    els.heroDesc.textContent = t("heroDesc");
    els.searchLabel.textContent = t("searchLabel");
    els.searchInput.placeholder = t("searchPlaceholder");
    els.helperText.textContent = t("helperText");
    els.searchBtn.textContent = t("searchBtn");
    els.footerText.textContent = t("footerText");
    els.loginTabBtn.textContent = t("authLogin");
    els.registerTabBtn.textContent = t("authRegister");
    syncAuthUi();
    document.title = state.currentLang === "zh"
        ? "CNsourcer.com | 中国产业带与供应商导航"
        : "CNsourcer.com | China Sourcing & Industrial Clusters";

    document.querySelectorAll(".lang-btn").forEach((button) => {
        button.classList.toggle("active", button.dataset.lang === state.currentLang);
    });

    renderAuthControls();
}

function performSearch() {
    const keyword = els.searchInput.value.trim();
    state.currentSearchKeyword = keyword;

    if (!keyword) {
        resetToList();
        return;
    }

    state.currentMode = "search";
    state.detailIndustryId = "";
    syncUrl();
    render();
}

function syncUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", state.currentLang);

    if (state.currentMode === "detail" && state.detailIndustryId) {
        url.searchParams.set("industry", state.detailIndustryId);
    } else {
        url.searchParams.delete("industry");
    }

    if (state.currentMode === "search" && state.currentSearchKeyword) {
        url.searchParams.set("q", state.currentSearchKeyword);
    } else {
        url.searchParams.delete("q");
    }

    window.history.replaceState({}, "", url);
}

function readUrlState() {
    const url = new URL(window.location.href);
    const lang = url.searchParams.get("lang");
    const industry = url.searchParams.get("industry");
    const keyword = url.searchParams.get("q");

    state.currentLang = lang === "zh" ? "zh" : "en";
    state.detailIndustryId = industry && findIndustry(industry) ? industry : "";
    state.currentSearchKeyword = keyword ? keyword.trim() : "";

    if (state.detailIndustryId) {
        state.currentMode = "detail";
    } else if (state.currentSearchKeyword) {
        state.currentMode = "search";
    } else {
        state.currentMode = "list";
    }
}

function render() {
    syncStaticCopy();
    setNotice("");

    if (state.currentMode === "detail" && state.detailIndustryId) {
        renderIndustryDetail(state.detailIndustryId);
        return;
    }

    if (state.currentMode === "search") {
        renderMerchantCards(filterMerchants(state.currentSearchKeyword), state.currentSearchKeyword);
        return;
    }

    renderIndustryList();
}

function bindEvents() {
    els.searchBtn.addEventListener("click", performSearch);
    els.clearSearchBtn.addEventListener("click", resetToList);
    els.searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            performSearch();
        }
    });

    document.querySelectorAll(".lang-btn").forEach((button) => {
        button.addEventListener("click", () => {
            if (!button.dataset.lang) return;
            state.currentLang = button.dataset.lang === "zh" ? "zh" : "en";
            syncUrl();
            render();
        });
    });

    els.authCloseBtn.addEventListener("click", closeAuthModal);
    els.authModal.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.dataset.authClose === "true") {
            closeAuthModal();
        }
    });

    els.qrCloseBtn.addEventListener("click", closeQrModal);
    els.qrModal.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.dataset.qrClose === "true") {
            closeQrModal();
        }
    });
    els.wechatTriggerBtn.addEventListener("click", openQrModal);

    els.loginTabBtn.addEventListener("click", () => {
        authMode = "login";
        syncAuthUi();
        setAuthMessage("");
    });

    els.registerTabBtn.addEventListener("click", () => {
        authMode = "register";
        syncAuthUi();
        setAuthMessage("");
    });

    els.authForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setAuthMessage("");

        const username = els.authUsername.value.trim();
        const email = els.authEmail.value.trim();
        const password = els.authPassword.value;

        try {
            if (authMode === "register") {
                await registerUser({ username, email, password });
                setNotice(t("authRegisterSuccess"));
            } else {
                await loginUser({ username, password });
                setNotice(t("authLoginSuccess"));
            }

            closeAuthModal();
            renderAuthControls();
        } catch (error) {
            console.error(error);
            setAuthMessage(error.message || "Authentication failed.", "error");
        }
    });

    window.addEventListener("authchange", () => {
        renderAuthControls();
    });
}

async function loadData() {
    let payload = null;

    try {
        const apiResponse = await fetch(API_DATA_URL, { cache: "no-store" });
        if (apiResponse.ok) {
            payload = await apiResponse.json();
        }
    } catch (error) {
        payload = null;
    }

    if (!payload) {
        const response = await fetch(DATA_URL, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Failed to load ${DATA_URL}`);
        }
        payload = await response.json();
    }

    state.industries = Array.isArray(payload.industries) ? payload.industries : [];
    state.merchants = Array.isArray(payload.merchants) ? payload.merchants : [];
}

async function init() {
    bindEvents();

    try {
        await refreshSession();
        await loadData();
        readUrlState();
        els.searchInput.value = state.currentSearchKeyword;
        renderAuthControls();
        render();
        const url = new URL(window.location.href);
        if (url.searchParams.get("auth") === "admin-required") {
            setNotice(t("authRequired"), "error");
            url.searchParams.delete("auth");
            window.history.replaceState({}, "", url);
        }
    } catch (error) {
        console.error(error);
        setNotice(t("siteError"), "error");
        syncStaticCopy();
        renderAuthControls();
    }
}

init();
