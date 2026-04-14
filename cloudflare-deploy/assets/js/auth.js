const USERS_KEY = "cnsourcer_users";
const SESSION_KEY = "cnsourcer_session";
const ADMIN_USERNAME = "admin";
const ADMIN_HASH = "1cfc783c0ce1fb526e81035cde3021fd75f17007db6afd7115fd6cddbcde2c55";

function normalizeUsername(username) {
    return String(username || "").trim().toLowerCase();
}

function readJson(key, fallback) {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        console.error(error);
        return fallback;
    }
}

function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
}

export async function hashPassword(password) {
    const bytes = new TextEncoder().encode(password);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
        .map((item) => item.toString(16).padStart(2, "0"))
        .join("");
}

export function getStoredUsers() {
    return readJson(USERS_KEY, []);
}

export function getCurrentSession() {
    return readJson(SESSION_KEY, null);
}

export function isAdminSession(session = getCurrentSession()) {
    return Boolean(session && normalizeUsername(session.username) === ADMIN_USERNAME && session.role === "admin");
}

function emitAuthChange() {
    window.dispatchEvent(new CustomEvent("authchange", { detail: getCurrentSession() }));
}

function saveSession(session) {
    writeJson(SESSION_KEY, session);
    emitAuthChange();
}

export async function loginUser({ username, password }) {
    const normalized = normalizeUsername(username);
    if (!normalized || !password) {
        throw new Error("Username and password are required.");
    }

    const passwordHash = await hashPassword(password);
    if (normalized === ADMIN_USERNAME) {
        if (passwordHash !== ADMIN_HASH) {
            throw new Error("Incorrect admin password.");
        }

        const session = { username: ADMIN_USERNAME, role: "admin" };
        saveSession(session);
        return session;
    }

    const account = getStoredUsers().find((user) => normalizeUsername(user.username) === normalized);
    if (!account || account.passwordHash !== passwordHash) {
        throw new Error("Incorrect username or password.");
    }

    const session = { username: account.username, role: "member", email: account.email || "" };
    saveSession(session);
    return session;
}

export async function registerUser({ username, email, password }) {
    const normalized = normalizeUsername(username);
    if (!normalized || !password) {
        throw new Error("Username and password are required.");
    }
    if (normalized === ADMIN_USERNAME) {
        throw new Error("The admin username is reserved.");
    }

    const users = getStoredUsers();
    if (users.some((user) => normalizeUsername(user.username) === normalized)) {
        throw new Error("This username is already registered.");
    }

    const newUser = {
        username: String(username).trim(),
        email: String(email || "").trim(),
        passwordHash: await hashPassword(password)
    };

    users.push(newUser);
    writeJson(USERS_KEY, users);

    const session = { username: newUser.username, role: "member", email: newUser.email };
    saveSession(session);
    return session;
}

export function logoutUser() {
    window.localStorage.removeItem(SESSION_KEY);
    emitAuthChange();
}

export function renderSessionControls(container, options = {}) {
    if (!container) return;

    const session = getCurrentSession();
    const adminHref = options.adminHref || "./admin.html";
    const labels = {
        authTrigger: "Login / Register",
        admin: "Admin",
        logout: "Logout",
        ...(options.labels || {})
    };

    if (!session) {
        container.innerHTML = `
            <button class="auth-trigger" id="${options.triggerId || "authTriggerBtn"}" type="button">
                <i class="fas fa-user"></i>
                ${labels.authTrigger}
            </button>
        `;
        return;
    }

    const adminAction = isAdminSession(session)
        ? `<a class="ghost-link" href="${adminHref}">${labels.admin}</a>`
        : "";

    container.innerHTML = `
        <div class="account-actions">
            <span class="account-chip"><i class="fas fa-user-check"></i>${session.username}</span>
            ${adminAction}
            <button class="auth-trigger" id="${options.logoutId || "logoutBtn"}" type="button">${labels.logout}</button>
        </div>
    `;
}
