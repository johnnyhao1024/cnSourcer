import { getCurrentSession, isAdminSession, logoutUser, refreshSession, renderSessionControls } from "./auth.js";

const DATA_URL = "./data/site-data.json";
const API_URLS = {
    siteData: "./api/site-data",
    industries: "./api/admin/industries",
    merchants: "./api/admin/merchants"
};

const state = {
    backendEnabled: false,
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
    addMerchantBtn: document.getElementById("addMerchantBtn"),
    backendModeBadge: document.getElementById("backendModeBadge"),
    scrollQuickPublishBtn: document.getElementById("scrollQuickPublishBtn"),
    scrollMerchantManagerBtn: document.getElementById("scrollMerchantManagerBtn"),
    quickPublishSection: document.getElementById("quickPublishSection"),
    quickIndustryForm: document.getElementById("quickIndustryForm"),
    quickIndustryId: document.getElementById("quickIndustryId"),
    quickIndustryNameEn: document.getElementById("quickIndustryNameEn"),
    quickIndustryNameZh: document.getElementById("quickIndustryNameZh"),
    quickIndustryLocationEn: document.getElementById("quickIndustryLocationEn"),
    quickIndustryLocationZh: document.getElementById("quickIndustryLocationZh"),
    quickIndustryProductsEn: document.getElementById("quickIndustryProductsEn"),
    quickIndustryProductsZh: document.getElementById("quickIndustryProductsZh"),
    quickMerchantForm: document.getElementById("quickMerchantForm"),
    quickMerchantId: document.getElementById("quickMerchantId"),
    quickMerchantName: document.getElementById("quickMerchantName"),
    quickMerchantIndustryId: document.getElementById("quickMerchantIndustryId"),
    quickMerchantIndustrySelect: document.getElementById("quickMerchantIndustrySelect"),
    quickMerchantEmail: document.getElementById("quickMerchantEmail"),
    quickMerchantWebsite: document.getElementById("quickMerchantWebsite"),
    quickMerchantPhone: document.getElementById("quickMerchantPhone"),
    quickMerchantProducts: document.getElementById("quickMerchantProducts")
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

function normalizeText(value) {
    return String(value ?? "").trim().toLowerCase();
}

function toEditableIndustry(industry) {
    return {
        _originalId: String(industry.id || "").trim(),
        id: String(industry.id || "").trim(),
        name_zh: String(industry.name_zh || "").trim(),
        name_en: String(industry.name_en || "").trim(),
        location_zh: String(industry.location_zh || "").trim(),
        location_en: String(industry.location_en || "").trim(),
        mainProducts: Array.isArray(industry.mainProducts) ? industry.mainProducts : splitCsv(industry.mainProducts),
        mainProducts_en: Array.isArray(industry.mainProducts_en) ? industry.mainProducts_en : splitCsv(industry.mainProducts_en)
    };
}

function toEditableMerchant(merchant) {
    return {
        _originalId: String(merchant.id || "").trim(),
        id: String(merchant.id || "").trim(),
        industryId: String(merchant.industryId || "").trim(),
        name: String(merchant.name || "").trim(),
        products: String(merchant.products || "").trim(),
        email: String(merchant.email || "").trim(),
        website: String(merchant.website || "").trim(),
        phone: String(merchant.phone || "").trim()
    };
}

function syncStateFromPayload(payload) {
    state.originalData = {
        version: payload.version || 1,
        updatedAt: payload.updatedAt || new Date().toISOString().slice(0, 10),
        industries: cloneData(payload.industries || []),
        merchants: cloneData(payload.merchants || [])
    };
    state.industries = (payload.industries || []).map(toEditableIndustry);
    state.merchants = (payload.merchants || []).map(toEditableMerchant);
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

function setModeBadge() {
    els.backendModeBadge.textContent = state.backendEnabled
        ? "Backend mode active: changes publish instantly"
        : "Fallback mode: edits stay local until you export JSON";
    els.backendModeBadge.classList.toggle("live", state.backendEnabled);
    document.querySelectorAll(".fallback-tool").forEach((node) => {
        node.classList.toggle("hidden", state.backendEnabled);
    });
}

async function requestJson(url, init = {}) {
    try {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...init,
            headers: {
                "content-type": "application/json",
                ...(init.headers || {})
            }
        });

        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        return { response, data };
    } catch (error) {
        return { response: null, data: null, error };
    }
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

function scrollToTarget(target) {
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildQuickIndustryPayload() {
    return {
        id: els.quickIndustryId.value.trim(),
        name_en: els.quickIndustryNameEn.value.trim(),
        name_zh: els.quickIndustryNameZh.value.trim(),
        location_en: els.quickIndustryLocationEn.value.trim(),
        location_zh: els.quickIndustryLocationZh.value.trim(),
        mainProducts_en: splitCsv(els.quickIndustryProductsEn.value),
        mainProducts: splitCsv(els.quickIndustryProductsZh.value)
    };
}

function buildQuickMerchantPayload() {
    return {
        id: els.quickMerchantId.value.trim(),
        name: els.quickMerchantName.value.trim(),
        industryId: els.quickMerchantIndustryId.value.trim(),
        products: els.quickMerchantProducts.value.trim(),
        email: els.quickMerchantEmail.value.trim(),
        website: els.quickMerchantWebsite.value.trim(),
        phone: els.quickMerchantPhone.value.trim()
    };
}

function resetQuickIndustryForm() {
    els.quickIndustryForm.reset();
}

function resetQuickMerchantForm() {
    els.quickMerchantForm.reset();
    els.quickMerchantIndustrySelect.value = "";
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

function renderQuickMerchantOptions() {
    els.quickMerchantIndustrySelect.innerHTML = [
        "<option value=\"\">No cluster</option>",
        ...state.industries.map((industry) => `
            <option value="${escapeHtml(industry.id)}">${escapeHtml(industry.name_en || industry.id)} (${escapeHtml(industry.id)})</option>
        `)
    ].join("");
}

function renderIndustryCards() {
    const visibleIndustries = getVisibleIndustries();

    if (!visibleIndustries.length) {
        els.industryList.innerHTML = state.industries.length
            ? "<div class=\"empty-state\">No clusters match the current search.</div>"
            : "<div class=\"empty-state\">No clusters yet. Use Quick publish to create your first record.</div>";
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
                    <input data-field="id" type="text" value="${escapeHtml(industry.id)}" placeholder="ind35">
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
                <button class="secondary-btn" type="button" data-action="save-industry">Save cluster</button>
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

                card.querySelector(".industry-pill").textContent = state.industries[index].id || "new-cluster";
                card.querySelector("h3").textContent = state.industries[index].name_en || `Cluster ${index + 1}`;
                renderMetrics();
                renderMerchantFilter();
                renderQuickMerchantOptions();
            });
        });

        card.querySelector("[data-action='save-industry']")?.addEventListener("click", async () => {
            await saveIndustry(index);
        });

        card.querySelector("[data-action='delete-industry']")?.addEventListener("click", async () => {
            await deleteIndustry(index);
        });
    });
}

function renderMerchantCards() {
    const visibleMerchants = getVisibleMerchants();

    if (!visibleMerchants.length) {
        els.merchantList.innerHTML = state.merchants.length
            ? "<div class=\"empty-state\">No merchants match the current filter or search.</div>"
            : "<div class=\"empty-state\">No merchants yet. Use Quick publish to create your first record.</div>";
        return;
    }

    els.merchantList.innerHTML = visibleMerchants.map((merchant) => {
        const index = state.merchants.findIndex((item) => item.id === merchant.id);
        return `
            <article class="editor-card" data-merchant-index="${index}">
                <div class="editor-card-head">
                    <h3>${escapeHtml(merchant.name || `Merchant ${index + 1}`)}</h3>
                    <span class="industry-pill">${escapeHtml(getIndustryLabel(merchant.industryId))}</span>
                </div>
                <div class="field-grid two-col">
                    <label>
                        Merchant ID
                        <input data-field="id" type="text" value="${escapeHtml(merchant.id)}" placeholder="m69">
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
                    <button class="secondary-btn" type="button" data-action="save-merchant">Save merchant</button>
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
                card.querySelector("h3").textContent = state.merchants[index].name || `Merchant ${index + 1}`;
                renderMetrics();
            };

            field.addEventListener("input", syncField);
            field.addEventListener("change", syncField);
        });

        card.querySelector("[data-action='save-merchant']")?.addEventListener("click", async () => {
            await saveMerchant(index);
        });

        card.querySelector("[data-action='delete-merchant']")?.addEventListener("click", async () => {
            await deleteMerchant(index);
        });
    });
}

function renderAll() {
    setModeBadge();
    renderMetrics();
    renderMerchantFilter();
    renderQuickMerchantOptions();
    renderIndustryCards();
    renderMerchantCards();
}

async function reloadFromResponseData(data) {
    if (data?.industries && data?.merchants) {
        syncStateFromPayload(data);
    } else {
        await loadData();
    }
    renderAll();
}

async function saveIndustry(index) {
    const validationError = validateData();
    if (validationError) {
        setNotice(validationError, "error");
        return;
    }

    const industry = state.industries[index];
    if (!industry) return;

    if (!state.backendEnabled) {
        setNotice("Local draft updated. Export site-data.json when you are ready to upload.", "info");
        return;
    }

    const url = `${API_URLS.industries}/${encodeURIComponent(industry._originalId || industry.id)}`;
    const { response, data } = await requestJson(url, {
        method: "PUT",
        body: JSON.stringify({
            id: industry.id,
            name_en: industry.name_en,
            name_zh: industry.name_zh,
            location_en: industry.location_en,
            location_zh: industry.location_zh,
            mainProducts_en: industry.mainProducts_en,
            mainProducts: industry.mainProducts
        })
    });

    if (!response?.ok) {
        setNotice(data?.error || "Unable to save this cluster.", "error");
        return;
    }

    await reloadFromResponseData(data);
    setNotice(`Published cluster ${industry.id} successfully.`);
}

async function deleteIndustry(index) {
    const industry = state.industries[index];
    if (!industry) return;

    if (!state.backendEnabled) {
        const industryId = industry.id;
        state.industries.splice(index, 1);
        state.merchants = state.merchants.filter((merchant) => merchant.industryId !== industryId);
        renderAll();
        setNotice(`Deleted cluster ${industryId || `#${index + 1}`} and its linked merchants.`);
        return;
    }

    const { response, data } = await requestJson(`${API_URLS.industries}/${encodeURIComponent(industry._originalId || industry.id)}`, {
        method: "DELETE"
    });
    if (!response?.ok) {
        setNotice(data?.error || "Unable to delete this cluster.", "error");
        return;
    }

    await reloadFromResponseData(data);
    setNotice(`Deleted cluster ${industry.id}.`);
}

async function saveMerchant(index) {
    const validationError = validateData();
    if (validationError) {
        setNotice(validationError, "error");
        return;
    }

    const merchant = state.merchants[index];
    if (!merchant) return;

    if (!state.backendEnabled) {
        setNotice("Local draft updated. Export site-data.json when you are ready to upload.", "info");
        return;
    }

    const { response, data } = await requestJson(`${API_URLS.merchants}/${encodeURIComponent(merchant._originalId || merchant.id)}`, {
        method: "PUT",
        body: JSON.stringify({
            id: merchant.id,
            industryId: merchant.industryId,
            name: merchant.name,
            products: merchant.products,
            email: merchant.email,
            website: merchant.website,
            phone: merchant.phone
        })
    });

    if (!response?.ok) {
        setNotice(data?.error || "Unable to save this merchant.", "error");
        return;
    }

    await reloadFromResponseData(data);
    setNotice(`Published merchant ${merchant.name || merchant.id} successfully.`);
}

async function deleteMerchant(index) {
    const merchant = state.merchants[index];
    if (!merchant) return;

    if (!state.backendEnabled) {
        const merchantName = merchant.name || merchant.id || `#${index + 1}`;
        state.merchants.splice(index, 1);
        renderAll();
        setNotice(`Deleted merchant ${merchantName}.`);
        return;
    }

    const { response, data } = await requestJson(`${API_URLS.merchants}/${encodeURIComponent(merchant._originalId || merchant.id)}`, {
        method: "DELETE"
    });
    if (!response?.ok) {
        setNotice(data?.error || "Unable to delete this merchant.", "error");
        return;
    }

    await reloadFromResponseData(data);
    setNotice(`Deleted merchant ${merchant.name || merchant.id}.`);
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
    syncStateFromPayload(state.originalData);
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
            syncStateFromPayload({
                version: payload.version || 1,
                updatedAt: payload.updatedAt || new Date().toISOString().slice(0, 10),
                industries: Array.isArray(payload.industries) ? payload.industries : [],
                merchants: Array.isArray(payload.merchants) ? payload.merchants : []
            });
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

async function createIndustry() {
    const draft = toEditableIndustry(buildQuickIndustryPayload());
    if (!draft.id || !draft.name_en || !draft.name_zh) {
        setNotice("Each industrial cluster needs an ID, English name, and Chinese name.", "error");
        return;
    }

    if (!state.backendEnabled) {
        state.industries.unshift(draft);
        const validationError = validateData();
        if (validationError) {
            state.industries.shift();
            setNotice(validationError, "error");
            return;
        }
        renderAll();
        resetQuickIndustryForm();
        setNotice(`Added local draft cluster ${draft.id}. Export JSON when ready.`);
        return;
    }

    const { response, data } = await requestJson(API_URLS.industries, {
        method: "POST",
        body: JSON.stringify(draft)
    });

    if (!response?.ok) {
        setNotice(data?.error || "Unable to publish this cluster.", "error");
        return;
    }

    await reloadFromResponseData(data);
    resetQuickIndustryForm();
    setNotice(`Published cluster ${draft.id} successfully.`);
}

async function createMerchant() {
    const draft = toEditableMerchant(buildQuickMerchantPayload());
    if (!draft.id || !draft.name) {
        setNotice("Each merchant needs an ID and name.", "error");
        return;
    }

    if (!state.backendEnabled) {
        state.merchants.unshift(draft);
        const validationError = validateData();
        if (validationError) {
            state.merchants.shift();
            setNotice(validationError, "error");
            return;
        }
        renderAll();
        resetQuickMerchantForm();
        setNotice(`Added local draft merchant ${draft.name || draft.id}. Export JSON when ready.`);
        return;
    }

    const { response, data } = await requestJson(API_URLS.merchants, {
        method: "POST",
        body: JSON.stringify(draft)
    });

    if (!response?.ok) {
        setNotice(data?.error || "Unable to publish this merchant.", "error");
        return;
    }

    await reloadFromResponseData(data);
    resetQuickMerchantForm();
    setNotice(`Published merchant ${draft.name || draft.id} successfully.`);
}

async function loadData() {
    const apiResult = await requestJson(API_URLS.siteData, {
        method: "GET",
        cache: "no-store",
        headers: {}
    });

    if (apiResult.response?.ok && apiResult.data?.industries && apiResult.data?.merchants) {
        state.backendEnabled = true;
        syncStateFromPayload(apiResult.data);
        return;
    }

    state.backendEnabled = false;
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Failed to load ${DATA_URL}`);
    }
    syncStateFromPayload(await response.json());
}

function bindEvents() {
    els.scrollQuickPublishBtn.addEventListener("click", () => {
        scrollToTarget(els.quickPublishSection);
        els.quickMerchantId.focus();
    });

    els.scrollMerchantManagerBtn.addEventListener("click", () => {
        scrollToTarget(document.getElementById("merchantList"));
    });

    els.addIndustryBtn.addEventListener("click", () => {
        scrollToTarget(els.quickPublishSection);
        els.quickIndustryId.focus();
    });

    els.addMerchantBtn.addEventListener("click", () => {
        scrollToTarget(els.quickPublishSection);
        els.quickMerchantId.focus();
    });

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

    els.quickMerchantIndustrySelect.addEventListener("change", (event) => {
        els.quickMerchantIndustryId.value = event.target.value;
    });
    els.quickMerchantIndustryId.addEventListener("input", (event) => {
        els.quickMerchantIndustrySelect.value = event.target.value;
    });

    els.quickIndustryForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await createIndustry();
    });

    els.quickMerchantForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await createMerchant();
    });
}

async function guardAdminAccess() {
    const session = await refreshSession();
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
    document.getElementById("adminLogoutBtn")?.addEventListener("click", async () => {
        await logoutUser();
        const redirectUrl = new URL("./index.html", window.location.href);
        window.location.replace(redirectUrl.toString());
    });
}

async function init() {
    if (!await guardAdminAccess()) {
        return;
    }

    bindEvents();
    renderAdminSessionControls();

    try {
        await loadData();
        renderAll();
        setNotice(state.backendEnabled
            ? "Connected to Cloudflare backend. New records will go live as soon as you publish them."
            : "Backend API not available here. You can still edit locally and export JSON as a fallback.");
    } catch (error) {
        console.error(error);
        setNotice("Unable to load admin data.", "error");
    }
}

init();
