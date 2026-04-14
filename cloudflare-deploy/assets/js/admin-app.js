import { getCurrentSession, isAdminSession, logoutUser, renderSessionControls } from "./auth.js";

const DATA_URL = "./data/site-data.json";

const state = {
    originalData: null,
    industries: [],
    merchants: [],
    merchantFilter: "all",
    industrySearch: "",
    merchantSearch: ""
};

const els = {
    adminNotice: document.getElementById("adminNotice"),
    adminMetrics: document.getElementById("adminMetrics"),
    industryList: document.getElementById("industryList"),
    merchantList: document.getElementById("merchantList"),
    merchantIndustryFilter: document.getElementById("merchantIndustryFilter"),
    industrySearchInput: document.getElementById("industrySearchInput"),
    merchantSearchInput: document.getElementById("merchantSearchInput"),
    adminSessionControls: document.getElementById("adminSessionControls"),
    exportJsonBtn: document.getElementById("exportJsonBtn"),
    importJsonInput: document.getElementById("importJsonInput"),
    copyJsonBtn: document.getElementById("copyJsonBtn"),
    resetDataBtn: document.getElementById("resetDataBtn"),
    addIndustryBtn: document.getElementById("addIndustryBtn"),
    addMerchantBtn: document.getElementById("addMerchantBtn")
};

function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
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

function splitCsv(value) {
    return String(value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function joinCsv(values) {
    return (Array.isArray(values) ? values : []).join(", ");
}

function setNotice(message, type = "info") {
    if (!message) {
        els.adminNotice.classList.add("hidden");
        els.adminNotice.textContent = "";
        els.adminNotice.style.borderColor = "";
        els.adminNotice.style.background = "";
        els.adminNotice.style.color = "";
        return;
    }

    els.adminNotice.classList.remove("hidden");
    els.adminNotice.textContent = message;

    if (type === "error") {
        els.adminNotice.style.borderColor = "rgba(196, 87, 69, 0.25)";
        els.adminNotice.style.background = "rgba(196, 87, 69, 0.1)";
        els.adminNotice.style.color = "#8c3024";
        return;
    }

    els.adminNotice.style.borderColor = "rgba(15, 95, 83, 0.14)";
    els.adminNotice.style.background = "rgba(15, 95, 83, 0.08)";
    els.adminNotice.style.color = "#0a473e";
}

function buildPayload() {
    return {
        version: 1,
        updatedAt: new Date().toISOString().slice(0, 10),
        industries: state.industries.map((industry) => ({
            id: industry.id.trim(),
            name_zh: industry.name_zh.trim(),
            name_en: industry.name_en.trim(),
            location_zh: industry.location_zh.trim(),
            location_en: industry.location_en.trim(),
            mainProducts: splitCsv(joinCsv(industry.mainProducts)),
            mainProducts_en: splitCsv(joinCsv(industry.mainProducts_en))
        })),
        merchants: state.merchants.map((merchant) => ({
            id: merchant.id.trim(),
            industryId: merchant.industryId.trim(),
            name: merchant.name.trim(),
            products: merchant.products.trim(),
            email: merchant.email.trim(),
            website: merchant.website.trim(),
            phone: merchant.phone.trim()
        }))
    };
}

function validateData() {
    const industryIds = new Set();

    for (const industry of state.industries) {
        if (!industry.id.trim() || !industry.name_en.trim() || !industry.name_zh.trim()) {
            return "Each industrial cluster needs an ID, English name, and Chinese name.";
        }
        if (industryIds.has(industry.id.trim())) {
            return `Duplicate cluster ID: ${industry.id.trim()}`;
        }
        industryIds.add(industry.id.trim());
    }

    const merchantIds = new Set();
    for (const merchant of state.merchants) {
        if (!merchant.id.trim() || !merchant.name.trim()) {
            return "Each merchant needs an ID and name.";
        }
        if (merchantIds.has(merchant.id.trim())) {
            return `Duplicate merchant ID: ${merchant.id.trim()}`;
        }
        if (merchant.industryId.trim() && !industryIds.has(merchant.industryId.trim())) {
            return `Merchant ${merchant.name.trim() || merchant.id.trim()} references a missing cluster ID: ${merchant.industryId.trim()}`;
        }
        merchantIds.add(merchant.id.trim());
    }

    return "";
}

function renderMetrics() {
    els.adminMetrics.innerHTML = [
        { value: state.industries.length, label: "Clusters" },
        { value: state.merchants.length, label: "Merchants" },
        { value: state.merchants.filter((merchant) => merchant.industryId.trim()).length, label: "Linked records" }
    ].map((item) => `
        <div class="metric-card">
            <strong>${item.value}</strong>
            <span>${escapeHtml(item.label)}</span>
        </div>
    `).join("");
}

function normalizeText(value) {
    return String(value ?? "").trim().toLowerCase();
}

function getIndustryLabel(industryId) {
    if (!industryId) {
        return "Unassigned";
    }
    const industry = state.industries.find((item) => item.id === industryId);
    if (!industry) {
        return industryId || "unlinked";
    }
    return `${industry.name_en || industry.id} (${industry.id})`;
}

function getVisibleIndustries() {
    const keyword = normalizeText(state.industrySearch);
    if (!keyword) {
        return state.industries;
    }

    return state.industries.filter((industry) => {
        const haystacks = [
            industry.id,
            industry.name_en,
            industry.name_zh,
            industry.location_en,
            industry.location_zh,
            ...(industry.mainProducts || []),
            ...(industry.mainProducts_en || [])
        ];
        return haystacks.some((value) => normalizeText(value).includes(keyword));
    });
}

function getVisibleMerchants() {
    const keyword = normalizeText(state.merchantSearch);
    const baseList = state.merchantFilter === "all"
        ? state.merchants
        : state.merchants.filter((merchant) => merchant.industryId === state.merchantFilter);

    if (!keyword) {
        return baseList;
    }

    return baseList.filter((merchant) => {
        const industry = state.industries.find((item) => item.id === merchant.industryId);
        const haystacks = [
            merchant.id,
            merchant.industryId,
            merchant.name,
            merchant.products,
            merchant.email,
            merchant.website,
            merchant.phone,
            industry?.id,
            industry?.name_en,
            industry?.name_zh
        ];
        return haystacks.some((value) => normalizeText(value).includes(keyword));
    });
}

function scrollToEditor(selector) {
    requestAnimationFrame(() => {
        document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
        document.querySelector(`${selector} input, ${selector} textarea, ${selector} select`)?.focus();
    });
}

function renderIndustryCards() {
    const visibleIndustries = getVisibleIndustries();

    if (!visibleIndustries.length) {
        els.industryList.innerHTML = state.industries.length
            ? "<div class=\"empty-state\">No clusters match the current search.</div>"
            : "<div class=\"empty-state\">No clusters yet. Click Add cluster to create your first record.</div>";
        return;
    }

    els.industryList.innerHTML = visibleIndustries.map((industry) => {
        const index = state.industries.indexOf(industry);
        return `
        <article class="editor-card" data-industry-index="${index}">
            <div class="editor-card-head">
                <h3>${escapeHtml(industry.name_en || `Cluster ${index + 1}`)}</h3>
                <span class="industry-pill">${escapeHtml(industry.id || "new-cluster")}</span>
            </div>
            <div class="field-grid two-col">
                <label>
                    Cluster ID
                    <input data-field="id" type="text" value="${escapeHtml(industry.id)}" placeholder="ind7">
                </label>
                <label>
                    English name
                    <input data-field="name_en" type="text" value="${escapeHtml(industry.name_en)}" placeholder="Ningbo Appliance Cluster">
                </label>
                <label>
                    Chinese name
                    <input data-field="name_zh" type="text" value="${escapeHtml(industry.name_zh)}" placeholder="宁波家电产业带">
                </label>
                <label>
                    English location
                    <input data-field="location_en" type="text" value="${escapeHtml(industry.location_en)}" placeholder="Ningbo, Zhejiang">
                </label>
                <label>
                    Chinese location
                    <input data-field="location_zh" type="text" value="${escapeHtml(industry.location_zh)}" placeholder="浙江省 · 宁波市">
                </label>
                <label>
                    Main products (EN, comma separated)
                    <input data-field="mainProducts_en" type="text" value="${escapeHtml(joinCsv(industry.mainProducts_en))}" placeholder="Small Appliance, Fan, Air Fryer">
                </label>
            </div>
            <div class="field-grid">
                <label>
                    Main products (ZH, comma separated)
                    <textarea data-field="mainProducts" placeholder="小家电, 风扇, 空气炸锅">${escapeHtml(joinCsv(industry.mainProducts))}</textarea>
                </label>
            </div>
            <div class="editor-actions">
                <button class="danger-btn" type="button" data-action="delete-industry">Delete cluster</button>
            </div>
        </article>
    `;
    }).join("");

    document.querySelectorAll("[data-industry-index]").forEach((card) => {
        const index = Number(card.getAttribute("data-industry-index"));
        card.querySelectorAll("input, textarea").forEach((field) => {
            field.addEventListener("input", (event) => {
                const input = event.currentTarget;
                const key = input.getAttribute("data-field");
                if (!key) return;

                if (key === "mainProducts" || key === "mainProducts_en") {
                    state.industries[index][key] = splitCsv(input.value);
                } else {
                    state.industries[index][key] = input.value;
                }

                renderMetrics();
            });
        });

        card.querySelector("[data-action='delete-industry']")?.addEventListener("click", () => {
            const industryId = state.industries[index].id;
            state.industries.splice(index, 1);
            state.merchants = state.merchants.filter((merchant) => merchant.industryId !== industryId);
            setNotice(`Deleted cluster ${industryId || `#${index + 1}`} and its linked merchants.`);
            renderAll();
        });
    });
}

function renderMerchantFilter() {
    const options = [
        "<option value=\"all\">All clusters</option>",
        ...state.industries.map((industry) => `<option value="${escapeHtml(industry.id)}">${escapeHtml(industry.name_en || industry.id)}</option>`)
    ];

    els.merchantIndustryFilter.innerHTML = options.join("");
    const hasCurrentFilter = state.merchantFilter === "all" || state.industries.some((industry) => industry.id === state.merchantFilter);
    if (!hasCurrentFilter) {
        state.merchantFilter = "all";
    }
    els.merchantIndustryFilter.value = state.merchantFilter;
}

function renderMerchantCards() {
    const visibleMerchants = getVisibleMerchants();

    if (!visibleMerchants.length) {
        els.merchantList.innerHTML = state.merchants.length
            ? "<div class=\"empty-state\">No merchants match the current filter or search.</div>"
            : "<div class=\"empty-state\">No merchants yet. Click Add merchant to create your first record.</div>";
        return;
    }

    els.merchantList.innerHTML = visibleMerchants.map((merchant) => {
        const index = state.merchants.findIndex((item) => item.id === merchant.id);
        const industry = state.industries.find((item) => item.id === merchant.industryId);

        return `
            <article class="editor-card" data-merchant-index="${index}">
                <div class="editor-card-head">
                    <h3>${escapeHtml(merchant.name || `Merchant ${index + 1}`)}</h3>
                    <span class="industry-pill">${escapeHtml(getIndustryLabel(merchant.industryId))}</span>
                </div>
                <div class="field-grid two-col">
                    <label>
                        Merchant ID
                        <input data-field="id" type="text" value="${escapeHtml(merchant.id)}" placeholder="m17">
                    </label>
                    <label>
                        Merchant name
                        <input data-field="name" type="text" value="${escapeHtml(merchant.name)}" placeholder="New Supplier Ltd.">
                    </label>
                    <label>
                        Cluster ID
                        <input data-field="industryId" type="text" value="${escapeHtml(merchant.industryId)}" placeholder="Optional, e.g. ind7">
                    </label>
                    <label>
                        Linked cluster name
                        <select data-field="industryIdSelect">
                            <option value="">No cluster</option>
                            ${state.industries.map((item) => `
                                <option value="${escapeHtml(item.id)}" ${item.id === merchant.industryId ? "selected" : ""}>
                                    ${escapeHtml(item.name_en || item.id)} (${escapeHtml(item.id)})
                                </option>
                            `).join("")}
                        </select>
                    </label>
                    <label>
                        Email
                        <input data-field="email" type="email" value="${escapeHtml(merchant.email)}" placeholder="sales@example.com">
                    </label>
                    <label>
                        Website
                        <input data-field="website" type="text" value="${escapeHtml(merchant.website)}" placeholder="www.example.com">
                    </label>
                    <label>
                        Phone
                        <input data-field="phone" type="text" value="${escapeHtml(merchant.phone)}" placeholder="+86 123 4567 8910">
                    </label>
                </div>
                <div class="field-grid">
                    <label>
                        Products
                        <textarea data-field="products" placeholder="List products, keywords, and categories">${escapeHtml(merchant.products)}</textarea>
                    </label>
                </div>
                <div class="editor-actions">
                    <button class="danger-btn" type="button" data-action="delete-merchant">Delete merchant</button>
                </div>
            </article>
        `;
    }).join("");

    document.querySelectorAll("[data-merchant-index]").forEach((card) => {
        const index = Number(card.getAttribute("data-merchant-index"));
        card.querySelectorAll("input, textarea, select").forEach((field) => {
            const syncField = (event) => {
                const input = event.currentTarget;
                const key = input.getAttribute("data-field");
                if (!key) return;

                if (key === "industryIdSelect") {
                    state.merchants[index].industryId = input.value;
                    const clusterIdInput = card.querySelector('[data-field="industryId"]');
                    if (clusterIdInput) {
                        clusterIdInput.value = input.value;
                    }
                } else {
                    state.merchants[index][key] = input.value;
                    if (key === "industryId") {
                        const clusterSelect = card.querySelector('[data-field="industryIdSelect"]');
                        if (clusterSelect) {
                            clusterSelect.value = input.value;
                        }
                    }
                }

                const pill = card.querySelector(".industry-pill");
                if (pill) {
                    pill.textContent = getIndustryLabel(state.merchants[index].industryId);
                }
                renderMetrics();
            };

            field.addEventListener("input", syncField);
            field.addEventListener("change", syncField);
        });

        card.querySelector("[data-action='delete-merchant']")?.addEventListener("click", () => {
            const merchantName = state.merchants[index].name || state.merchants[index].id || `#${index + 1}`;
            state.merchants.splice(index, 1);
            setNotice(`Deleted merchant ${merchantName}.`);
            renderAll();
        });
    });
}

function renderAll() {
    renderMetrics();
    renderMerchantFilter();
    renderIndustryCards();
    renderMerchantCards();
}

function addIndustry() {
    state.industrySearch = "";
    els.industrySearchInput.value = "";
    state.industries.unshift({
        id: `ind${state.industries.length + 1}`,
        name_zh: "",
        name_en: "",
        location_zh: "",
        location_en: "",
        mainProducts: [],
        mainProducts_en: []
    });
    renderAll();
    setNotice("Added a new empty cluster card. Fill it in before exporting.");
    scrollToEditor('[data-industry-index="0"]');
}

function addMerchant() {
    state.merchantFilter = "all";
    state.merchantSearch = "";
    els.merchantIndustryFilter.value = "all";
    els.merchantSearchInput.value = "";
    state.merchants.unshift({
        id: `m${state.merchants.length + 1}`,
        industryId: "",
        name: "",
        products: "",
        email: "",
        website: "",
        phone: ""
    });
    renderAll();
    setNotice("Added a new merchant card. Fill it in before exporting.");
    scrollToEditor('[data-merchant-index="0"]');
}

function exportJson() {
    const validationError = validateData();
    if (validationError) {
        setNotice(validationError, "error");
        return;
    }

    const payload = buildPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "site-data.json";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Exported site-data.json. Replace /data/site-data.json with the downloaded file before uploading to Cloudflare.");
}

async function copyJson() {
    const validationError = validateData();
    if (validationError) {
        setNotice(validationError, "error");
        return;
    }

    try {
        await navigator.clipboard.writeText(JSON.stringify(buildPayload(), null, 2));
        setNotice("Copied the latest JSON to your clipboard.");
    } catch (error) {
        console.error(error);
        setNotice("Clipboard copy failed in this browser. Use Export JSON instead.", "error");
    }
}

function resetData() {
    if (!state.originalData) return;
    const fresh = cloneData(state.originalData);
    state.industries = fresh.industries;
    state.merchants = fresh.merchants;
    state.merchantFilter = "all";
    state.industrySearch = "";
    state.merchantSearch = "";
    els.industrySearchInput.value = "";
    els.merchantSearchInput.value = "";
    renderAll();
    setNotice("Reset the editor to the bundled data file.");
}

function importJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const payload = JSON.parse(String(reader.result));
            state.industries = Array.isArray(payload.industries) ? payload.industries : [];
            state.merchants = Array.isArray(payload.merchants) ? payload.merchants : [];
            state.merchantFilter = "all";
            state.industrySearch = "";
            state.merchantSearch = "";
            els.industrySearchInput.value = "";
            els.merchantSearchInput.value = "";

            const validationError = validateData();
            if (validationError) {
                throw new Error(validationError);
            }

            renderAll();
            setNotice("Imported JSON successfully.");
        } catch (error) {
            console.error(error);
            setNotice(`Import failed: ${error.message}`, "error");
        }
    };
    reader.readAsText(file);
}

async function loadData() {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Failed to load ${DATA_URL}`);
    }
    return response.json();
}

function bindEvents() {
    els.addIndustryBtn.addEventListener("click", addIndustry);
    els.addMerchantBtn.addEventListener("click", addMerchant);
    els.exportJsonBtn.addEventListener("click", exportJson);
    els.copyJsonBtn.addEventListener("click", copyJson);
    els.resetDataBtn.addEventListener("click", resetData);
    els.merchantIndustryFilter.addEventListener("change", (event) => {
        state.merchantFilter = event.target.value;
        renderMerchantCards();
    });
    els.industrySearchInput.addEventListener("input", (event) => {
        state.industrySearch = event.target.value;
        renderIndustryCards();
    });
    els.merchantSearchInput.addEventListener("input", (event) => {
        state.merchantSearch = event.target.value;
        renderMerchantCards();
    });
    els.importJsonInput.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        importJson(file);
        event.target.value = "";
    });
}

function guardAdminAccess() {
    const session = getCurrentSession();
    if (isAdminSession(session)) {
        return true;
    }

    const redirectUrl = new URL("./index.html", window.location.href);
    redirectUrl.searchParams.set("auth", "admin-required");
    window.location.replace(redirectUrl.toString());
    return false;
}

function renderAdminSessionControls() {
    renderSessionControls(els.adminSessionControls, { logoutId: "adminLogoutBtn", adminHref: "./admin.html" });
    document.getElementById("adminLogoutBtn")?.addEventListener("click", () => {
        logoutUser();
        const redirectUrl = new URL("./index.html", window.location.href);
        window.location.replace(redirectUrl.toString());
    });
}

async function init() {
    if (!guardAdminAccess()) {
        return;
    }

    bindEvents();
    renderAdminSessionControls();

    try {
        const payload = await loadData();
        state.originalData = cloneData(payload);
        state.industries = cloneData(payload.industries || []);
        state.merchants = cloneData(payload.merchants || []);
        renderAll();
        setNotice("Loaded bundled data. You can edit now and export a new site-data.json when finished.");
    } catch (error) {
        console.error(error);
        setNotice("Unable to load the bundled JSON file. Upload all files together and refresh.", "error");
    }
}

init();
