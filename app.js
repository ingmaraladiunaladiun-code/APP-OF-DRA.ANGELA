/* ==================== 1. CONFIGURACIÓN Y ALMACENAMIENTO ==================== */
const STORAGE_KEYS = {
  USERS: "cjar_users_v4",
  SESSION: "cjar_session_v4",
  DOCS: "cjar_docs_v4",
  DOC_TYPES: "cjar_doc_types_v4",
  CASHFLOW: "cjar_cashflow_v4",
  EXPEDIENTES: "cjar_expedientes_v4",
  AUDIENCIAS: "cjar_audiencias_v4",
  RESIDENCIALES: "cjar_residenciales_v4",
  RES_SERVICES: "cjar_res_services_v2",
  GEN_SERVICES: "cjar_gen_services_v2",
  RES_CREDS: "cjar_res_creds_v2",
  WEBHOOK: "cjar_reminder_webhook_v4",
  OWNERS: "cjar_owners_list_v3",
  OWNER_COMMISSIONS: "cjar_owner_commissions_v1",
  OWNER_TENANTS: "cjar_owner_tenants_v3",
  OWNER_EXPENSES: "cjar_owner_expenses_v3",
  OWNER_STATEMENTS: "cjar_owner_statements_v3"
};

const ADMIN_USER = "A727401***";
const ADMIN_PASS = "A-727401/+*";

const DEFAULT_USERS = [
  { username: ADMIN_USER, password: ADMIN_PASS, role: "admin", active: true, passChangedAt: "-" },
  { username: "carla", password: "123", role: "user", active: true, passChangedAt: "-" },
  { username: "anyelina", password: "123", role: "user", active: true, passChangedAt: "-" }
];

const DEFAULT_DOC_TYPES = [
  "Determinación de heredero",
  "Pagaré notarial",
  "Declaración jurada de terreno",
  "Contrato de alquiler",
  "Acto de venta"
];

const MONTHS_LIST = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

const OWNER_COLOR_PALETTE = [
  { bg: "#dbeafe", text: "#1e3a8a", border: "#3b82f6" },
  { bg: "#fae8ff", text: "#701a75", border: "#d946ef" },
  { bg: "#ffedd5", text: "#7c2d12", border: "#f97316" },
  { bg: "#ccfbf1", text: "#134e4a", border: "#14b8a6" },
  { bg: "#fef9c3", text: "#713f12", border: "#eab308" },
  { bg: "#e0e7ff", text: "#312e81", border: "#6366f1" },
  { bg: "#fce7f3", text: "#831843", border: "#ec4899" },
  { bg: "#e2e8f0", text: "#0f172a", border: "#64748b" }
];

const RESIDENTIALS = [
  "Residencial Jennifer I",
  "Residencial Anper",
  "Residencial Monserrat 1",
  "Residencial Monserrat 2",
  "Residencial Las Palmas 3"
];

const CARLA_RESIDENTIAL = "Residencial Las Palmas 3";
const ANYELINA_RESIDENTIALS = RESIDENTIALS.filter((r) => r !== CARLA_RESIDENTIAL);

const DEFAULT_RES_CREDS = {
  "Residencial Jennifer I": { username: "jennifer1", password: "123", changedAt: "-" },
  "Residencial Anper": { username: "anper", password: "123", changedAt: "-" },
  "Residencial Monserrat 1": { username: "monserrat1", password: "123", changedAt: "-" },
  "Residencial Monserrat 2": { username: "monserrat2", password: "123", changedAt: "-" },
  "Residencial Las Palmas 3": { username: "palmas3", password: "123", changedAt: "-" }
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function ensureRequiredUsers(list) {
  const arr = Array.isArray(list) ? [...list] : [];
  const hasAdmin = arr.some((u) => u.role === "admin" || u.username === ADMIN_USER);
  if (!hasAdmin) {
    arr.unshift({ username: ADMIN_USER, password: ADMIN_PASS, role: "admin", active: true, passChangedAt: "-" });
  }
  DEFAULT_USERS.forEach((def) => {
    if (def.role !== "admin" && !arr.some((u) => u.username.toLowerCase() === def.username.toLowerCase())) {
      arr.push({ ...def });
    }
  });
  return arr;
}

/* ==================== 2. INDEXEDDB PARA ARCHIVOS Y COMPROBANTES ==================== */
const PDF_DB_NAME = "CJAR_PDF_STORAGE";
const PDF_STORE_NAME = "expediente_pdfs";

function openPdfDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PDF_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PDF_STORE_NAME)) {
        db.createObjectStore(PDF_STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePdfBlob(id, fileName, blob) {
  const db = await openPdfDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_STORE_NAME, "readwrite");
    tx.objectStore(PDF_STORE_NAME).put({ id, fileName, blob });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPdfBlob(id) {
  const db = await openPdfDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PDF_STORE_NAME, "readonly");
    const req = tx.objectStore(PDF_STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deletePdfBlob(id) {
  const db = await openPdfDB();
  return new Promise((resolve) => {
    const tx = db.transaction(PDF_STORE_NAME, "readwrite");
    tx.objectStore(PDF_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
  });
}

/* ==================== 3. ESTADO GLOBAL ==================== */
let users = ensureRequiredUsers(loadJSON(STORAGE_KEYS.USERS, DEFAULT_USERS));
saveJSON(STORAGE_KEYS.USERS, users);

let docs = loadJSON(STORAGE_KEYS.DOCS, []);
let docTypes = loadJSON(STORAGE_KEYS.DOC_TYPES, DEFAULT_DOC_TYPES);
let cashflow = loadJSON(STORAGE_KEYS.CASHFLOW, []);
let expedientes = loadJSON(STORAGE_KEYS.EXPEDIENTES, []);
let audiencias = loadJSON(STORAGE_KEYS.AUDIENCIAS, []);
let residencialesData = loadJSON(STORAGE_KEYS.RESIDENCIALES, {});
let resServicesData = loadJSON(STORAGE_KEYS.RES_SERVICES, {});
let generalServicesData = loadJSON(STORAGE_KEYS.GEN_SERVICES, []);
let resCredentials = { ...DEFAULT_RES_CREDS, ...loadJSON(STORAGE_KEYS.RES_CREDS, {}) };
let reminderWebhookUrl = localStorage.getItem(STORAGE_KEYS.WEBHOOK) || "";
let currentUser = loadJSON(STORAGE_KEYS.SESSION, null);

let ownersList = loadJSON(STORAGE_KEYS.OWNERS, []);
if (!Array.isArray(ownersList)) ownersList = [];

let ownerCommissionsData = loadJSON(STORAGE_KEYS.OWNER_COMMISSIONS, {});
let ownerTenantsData = loadJSON(STORAGE_KEYS.OWNER_TENANTS, {});
let ownerExpensesData = loadJSON(STORAGE_KEYS.OWNER_EXPENSES, {});
let ownerStatementsHistory = loadJSON(STORAGE_KEYS.OWNER_STATEMENTS, {});

let adminLoginMode = false;
let activeResidential = RESIDENTIALS[0];
let activeOwner = ownersList[0] || "";
let activeOwnerPeriod = "";
let serviceInventorySource = "RESIDENTIAL";
let pendingPdfFile = null;
let pendingServiceFile = null;
let pendingGeneralServiceFile = null;
let currentPdfObjectUrl = null;

let searchDocsTerm = "";
let searchFlowTerm = "";
let searchExpTerm = "";
let searchAudTerm = "";
let searchResTerm = "";
let searchInqTerm = "";

const $ = (id) => document.getElementById(id);

function formatMoney(num) {
  const n = Number(num) || 0;
  return "RD$ " + n.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTodayISO() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now - tzOffset).toISOString().split("T")[0];
}

function getCurrentMonthName() {
  const monthIdx = new Date().getMonth();
  return MONTHS_LIST[monthIdx] || MONTHS_LIST[0];
}

function getNowFormatted() {
  const d = new Date();
  return d.toLocaleString("es-DO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getTomorrowISO() {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now - tzOffset).toISOString().split("T")[0];
}

function populateMonthSelects() {
  const curMonth = getCurrentMonthName();
  const optionsHtml = MONTHS_LIST.map((m) => `<option value="${m}">${m}</option>`).join("");
  document.querySelectorAll("select.month-select").forEach((sel) => {
    const prevVal = sel.value;
    sel.innerHTML = optionsHtml;
    if (prevVal && MONTHS_LIST.includes(prevVal)) {
      sel.value = prevVal;
    } else if (sel.id !== "inq-period-select") {
      sel.value = curMonth;
    }
  });
}

function populateCommissionSelect() {
  const sel = $("inq-owner-commission-select");
  if (!sel) return;
  let html = `<option value="0">0% (Sin %)</option>`;
  for (let pct = 1; pct <= 20; pct++) {
    html += `<option value="${pct}">${pct}%</option>`;
  }
  sel.innerHTML = html;
}

function setDefaultDates() {
  const today = getTodayISO();
  const curMonth = getCurrentMonthName();
  if ($("fecha") && !$("fecha").value) $("fecha").value = today;
  if ($("flow-date") && !$("flow-date").value) $("flow-date").value = today;
  if ($("aud-fecha") && !$("aud-fecha").value) $("aud-fecha").value = today;
  if ($("res-fecha") && !$("res-fecha").value) $("res-fecha").value = today;
  if ($("srv-fecha-pago") && !$("srv-fecha-pago").value) $("srv-fecha-pago").value = today;
  if ($("srv-fecha-limite") && !$("srv-fecha-limite").value) $("srv-fecha-limite").value = today;
  if ($("gen-srv-fecha-pago") && !$("gen-srv-fecha-pago").value) $("gen-srv-fecha-pago").value = today;
  if ($("gen-srv-fecha-limite") && !$("gen-srv-fecha-limite").value) $("gen-srv-fecha-limite").value = today;
  if ($("inq-pay-date") && !$("inq-pay-date").value) $("inq-pay-date").value = today;
  if ($("exp-owner-date") && !$("exp-owner-date").value) $("exp-owner-date").value = today;

  if ($("inq-month") && !$("inq-month").value) $("inq-month").value = curMonth;
  if ($("exp-owner-month") && !$("exp-owner-month").value) $("exp-owner-month").value = curMonth;
  if ($("res-mes") && !$("res-mes").value) $("res-mes").value = curMonth;
  if ($("srv-mes") && !$("srv-mes").value) $("srv-mes").value = curMonth;
  if ($("gen-srv-mes") && !$("gen-srv-mes").value) $("gen-srv-mes").value = curMonth;
  if ($("flow-month") && !$("flow-month").value) $("flow-month").value = curMonth;
}

function getOwnerColorTheme(ownerName) {
  if (!ownerName) return { bg: "#e2e8f0", text: "#0f172a", border: "#64748b" };
  const idx = ownersList.indexOf(ownerName);
  const paletteIdx = idx >= 0
    ? idx % OWNER_COLOR_PALETTE.length
    : Math.abs(Array.from(ownerName).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % OWNER_COLOR_PALETTE.length;
  return OWNER_COLOR_PALETTE[paletteIdx];
}

function renderOwnerBadgeHtml(ownerName) {
  const theme = getOwnerColorTheme(ownerName);
  return `<span class="owner-color-tag" style="background-color:${theme.bg};color:${theme.text};border-color:${theme.border};">${ownerName || "-"}</span>`;
}

function canUserAccessResidential(username, resName) {
  if (!username) return false;
  const u = username.toLowerCase();
  if (u === "carla") {
    return resName === CARLA_RESIDENTIAL;
  }
  if (u === "anyelina") {
    return ANYELINA_RESIDENTIALS.includes(resName);
  }
  return true;
}

function applyUserPermissionsUI() {
  if (!currentUser) return;
  const isAdmin = currentUser.role === "admin";
  const uLower = (currentUser.username || "").toLowerCase();

  $("user-badge").textContent = `${currentUser.username} (${isAdmin ? "Administrador" : "Usuario"})`;

  if (uLower === "carla") {
    $("role-notice").textContent = "Usuario carla: acceso exclusivo a Residencial Las Palmas 3.";
  } else if (uLower === "anyelina") {
    $("role-notice").textContent = "Usuario anyelina: acceso a Jennifer I, Anper, Monserrat 1 y Monserrat 2 (sin acceso a Las Palmas 3).";
  } else if (isAdmin) {
    $("role-notice").textContent = "Acceso total: gestión de usuarios, contraseñas y eliminación de registros.";
  } else {
    $("role-notice").textContent = "Acceso de usuario: use el botón Crear / Cambiar Contraseña cuando desee.";
  }

  $("btn-view-users").hidden = !isAdmin;
  $("btn-open-user-modal").hidden = !isAdmin;
  $("btn-change-pass").hidden = !isAdmin;
  $("btn-user-set-own-pass").hidden = isAdmin;
  $("btn-admin-res-db").hidden = !isAdmin;
  if ($("btn-delete-doc-form")) $("btn-delete-doc-form").hidden = !isAdmin;

  document.querySelectorAll(".btn-res-gate").forEach((btn) => {
    const resName = btn.dataset.res;
    btn.hidden = !canUserAccessResidential(currentUser.username, resName);
  });

  if (uLower === "carla" && activeResidential !== CARLA_RESIDENTIAL) {
    activeResidential = CARLA_RESIDENTIAL;
  } else if (uLower === "anyelina" && activeResidential === CARLA_RESIDENTIAL) {
    activeResidential = ANYELINA_RESIDENTIALS[0];
  }
}

/* ==================== 4. SEGURIDAD, LOGIN Y ROLES ==================== */
document.querySelectorAll(".toggle-visibility-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = $(btn.dataset.target);
    if (!input) return;
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    btn.textContent = isPassword ? "Ocultar" : "Mostrar";
  });
});

$("btn-admin-login-mode").addEventListener("click", () => {
  adminLoginMode = !adminLoginMode;
  $("admin-mode-hint").hidden = !adminLoginMode;
  if (adminLoginMode) {
    $("username").type = "text";
    $("username").focus();
  }
});

$("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = $("username").value.trim();
  const p = $("password").value;
  $("login-error").hidden = true;

  const found = users.find((acc) => acc.username === u && acc.password === p);
  if (!found || !found.active) {
    $("login-error").textContent = found && !found.active
      ? "Este usuario está deshabilitado. Contacte al administrador."
      : "Usuario o contraseña incorrectos.";
    $("login-error").hidden = false;
    return;
  }

  if (adminLoginMode && found.role !== "admin") {
    $("login-error").textContent = "Esta cuenta no tiene permisos de administrador.";
    $("login-error").hidden = false;
    return;
  }

  currentUser = { username: found.username, role: found.role };
  if ($("remember").checked) {
    saveJSON(STORAGE_KEYS.SESSION, currentUser);
  }
  enterDashboard();
});

function enterDashboard() {
  $("login-view").hidden = true;
  $("dashboard-view").hidden = false;
  if ($("reminder-webhook-url")) $("reminder-webhook-url").value = reminderWebhookUrl;

  applyUserPermissionsUI();
  populateMonthSelects();
  populateCommissionSelect();
  setDefaultDates();
  renderDocTypes();
  renderDocs();
  renderExpedientes();
  renderAudiencias();
  renderResidential();
  renderServicePayments();
  renderGeneralServicePayments();
  renderCashflow();
  renderOwnersModule();

  runBackgroundReminderCheck();
}

$("btn-user-set-own-pass").addEventListener("click", () => {
  $("own-new-password").value = "";
  $("own-pass-msg").hidden = true;
  $("own-pass-modal").hidden = false;
});

$("btn-close-own-pass").addEventListener("click", () => {
  $("own-pass-modal").hidden = true;
});

$("own-pass-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const nextPass = $("own-new-password").value;
  if (!nextPass || !currentUser) return;

  const acc = users.find((u) => u.username === currentUser.username);
  if (acc) {
    const changedAt = getNowFormatted();
    acc.password = nextPass;
    acc.passChangedAt = changedAt;
    saveJSON(STORAGE_KEYS.USERS, users);
    $("own-pass-msg").textContent = `Contraseña actualizada el ${changedAt}. El administrador puede verla en su base de datos.`;
    $("own-pass-msg").hidden = false;
  }
});

$("btn-logout").addEventListener("click", () => {
  currentUser = null;
  localStorage.removeItem(STORAGE_KEYS.SESSION);
  $("login-form").reset();
  $("dashboard-view").hidden = true;
  $("login-view").hidden = false;
  switchModule("protocols");
});

/* ==================== 5. NAVEGACIÓN ENTRE MÓDULOS ==================== */
function switchModule(target) {
  $("protocols-section").hidden = target !== "protocols";
  $("expedientes-section").hidden = target !== "expedientes";
  $("audiencias-section").hidden = target !== "audiencias";
  $("inquilinos-section").hidden = target !== "inquilinos";
  $("servicios-general-section").hidden = target !== "servicios-general";
  $("residenciales-section").hidden = target !== "residenciales";
  $("cashflow-section").hidden = target !== "cashflow";

  if (target === "residenciales") {
    $("main-law-title").textContent = activeResidential;
  } else if (target === "servicios-general") {
    $("main-law-title").textContent = "PAGO DE SERVICIOS — CENTRO JURÍDICO DRA. ANGELA ROJAS Y ASOCIADOS";
  } else if (target === "inquilinos") {
    $("main-law-title").textContent = activeOwner
      ? `CONTROL DE INQUILINOS — ${activeOwner}`
      : "CONTROL DE INQUILINOS POR PROPIETARIO";
  } else {
    $("main-law-title").textContent = "CENTRO JURÍDICO DRA. ANGELA ROJAS Y ASOCIADOS";
  }

  const navMap = {
    protocols: "btn-nav-protocols",
    expedientes: "btn-nav-expedientes",
    audiencias: "btn-nav-audiencias",
    inquilinos: "btn-nav-inquilinos",
    "servicios-general": "btn-nav-servicios-general"
  };

  Object.values(navMap).forEach((btnId) => {
    const el = $(btnId);
    if (el) el.classList.remove("active-nav");
  });

  if (navMap[target] && $(navMap[target])) {
    $(navMap[target]).classList.add("active-nav");
  }
}

$("btn-nav-protocols").addEventListener("click", () => switchModule("protocols"));

$("btn-nav-expedientes").addEventListener("click", () => {
  switchModule("expedientes");
  renderExpedientes();
});

$("btn-nav-audiencias").addEventListener("click", () => {
  switchModule("audiencias");
  renderAudiencias();
});

$("btn-nav-inquilinos").addEventListener("click", () => {
  switchModule("inquilinos");
  populateMonthSelects();
  populateCommissionSelect();
  setDefaultDates();
  renderOwnersModule();
});

$("btn-nav-servicios-general").addEventListener("click", () => {
  switchModule("servicios-general");
  populateMonthSelects();
  setDefaultDates();
  syncGeneralServiceLabels();
  renderGeneralServicePayments();
});

document.querySelectorAll(".btn-back-protocols").forEach((btn) => {
  btn.addEventListener("click", () => switchModule("protocols"));
});

$("btn-back-to-protocols").addEventListener("click", () => switchModule("protocols"));

document.querySelectorAll(".btn-minimize").forEach((btn) => {
  btn.addEventListener("click", () => {
    const box = $(btn.dataset.target);
    if (!box) return;
    box.classList.toggle("minimized");
    btn.textContent = box.classList.contains("minimized") ? "Restaurar" : "Minimizar";
  });
});

document.querySelectorAll(".btn-expand").forEach((btn) => {
  btn.addEventListener("click", () => {
    const box = $(btn.dataset.target);
    if (!box) return;
    box.classList.toggle("expanded");
    btn.textContent = box.classList.contains("expanded") ? "Reducir" : "Ampliar";
  });
});

/* ==================== 6. MÓDULO PROTOCOLOS ==================== */
function renderDocTypes() {
  const container = $("doc-types-buttons");
  container.innerHTML = "";
  docTypes.forEach((typeName) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-ui btn-outline btn-sm";
    b.textContent = typeName;
    b.addEventListener("click", () => {
      $("descripcion").value = typeName;
      $("descripcion").focus();
    });
    container.appendChild(b);
  });
}

$("btn-add-doc-type").addEventListener("click", () => {
  $("new-doc-type-name").value = "";
  $("doc-type-modal").hidden = false;
});
$("btn-close-type-modal").addEventListener("click", () => { $("doc-type-modal").hidden = true; });

$("doc-type-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const val = $("new-doc-type-name").value.trim();
  if (!val) return;
  if (!docTypes.includes(val)) {
    docTypes.push(val);
    saveJSON(STORAGE_KEYS.DOC_TYPES, docTypes);
    renderDocTypes();
  }
  $("descripcion").value = val;
  $("doc-type-modal").hidden = true;
});

$("doc-form").addEventListener("submit", (e) => {
  e.preventDefault();
  docs.unshift({
    id: Date.now().toString(),
    protocolo: $("protocolo").value.trim(),
    folio: $("folio").value.trim(),
    cliente: $("cliente").value.trim(),
    descripcion: $("descripcion").value.trim(),
    fecha: $("fecha").value,
    isNew: true
  });
  saveJSON(STORAGE_KEYS.DOCS, docs);
  renderDocs();
  $("doc-form").reset();
  setDefaultDates();
});

$("btn-delete-doc-form").addEventListener("click", () => {
  if (!currentUser || currentUser.role !== "admin") {
    alert("Solo el administrador puede eliminar documentos registrados.");
    return;
  }

  const editingId = $("doc-id").value;
  const protoVal = $("protocolo").value.trim().toLowerCase();
  const folioVal = $("folio").value.trim().toLowerCase();
  const clientVal = $("cliente").value.trim().toLowerCase();

  let targetIdx = -1;
  if (editingId) {
    targetIdx = docs.findIndex((d) => d.id === editingId);
  } else if (protoVal || folioVal || clientVal) {
    targetIdx = docs.findIndex((d) =>
      (protoVal && (d.protocolo || "").toLowerCase() === protoVal) ||
      (folioVal && (d.folio || "").toLowerCase() === folioVal) ||
      (clientVal && (d.cliente || "").toLowerCase() === clientVal)
    );
  } else if (docs.length > 0) {
    targetIdx = 0;
  }

  if (targetIdx === -1) {
    alert("No se encontró ningún documento coincidente para eliminar.");
    return;
  }

  const targetDoc = docs[targetIdx];
  const ok = confirm(`¿Desea eliminar el documento del protocolo "${targetDoc.protocolo}" (${targetDoc.cliente})?`);
  if (!ok) return;

  docs.splice(targetIdx, 1);
  saveJSON(STORAGE_KEYS.DOCS, docs);
  resetDocForm();
  renderDocs();
});

$("btn-update").addEventListener("click", () => {
  const id = $("doc-id").value;
  const idx = docs.findIndex((d) => d.id === id);
  if (idx === -1) return;
  docs[idx] = {
    ...docs[idx],
    protocolo: $("protocolo").value.trim(),
    folio: $("folio").value.trim(),
    cliente: $("cliente").value.trim(),
    descripcion: $("descripcion").value.trim(),
    fecha: $("fecha").value
  };
  saveJSON(STORAGE_KEYS.DOCS, docs);
  renderDocs();
  resetDocForm();
});

$("btn-cancel-edit").addEventListener("click", resetDocForm);

function resetDocForm() {
  $("doc-form").reset();
  $("doc-id").value = "";
  $("form-title").textContent = "Registrar Nuevo Documento";
  $("btn-add").hidden = false;
  $("btn-update").hidden = true;
  $("btn-cancel-edit").hidden = true;
  setDefaultDates();
}

$("btn-search-docs").addEventListener("click", () => {
  searchDocsTerm = $("search-docs-input").value.trim().toLowerCase();
  renderDocs();
});

$("btn-clear-docs").addEventListener("click", () => {
  $("search-docs-input").value = "";
  searchDocsTerm = "";
  renderDocs();
});

function renderDocs() {
  const tbody = $("docs-tbody");
  tbody.innerHTML = "";
  const isAdmin = currentUser && currentUser.role === "admin";

  const filtered = docs.filter((d) => {
    if (!searchDocsTerm) return true;
    return [d.protocolo, d.folio, d.cliente, d.descripcion, d.fecha]
      .some((val) => (val || "").toLowerCase().includes(searchDocsTerm));
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7">No se encontraron documentos registrados.</td></tr>`;
    return;
  }

  filtered.forEach((d, i) => {
    const tr = document.createElement("tr");
    if (d.isNew) tr.classList.add("newly-added-row");
    tr.innerHTML = `
      <td>${i + 1}${d.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
      <td>${d.protocolo}</td>
      <td>${d.folio}</td>
      <td>${d.cliente}</td>
      <td>${d.descripcion}</td>
      <td>${d.fecha}</td>
      <td class="no-print">
        <button type="button" class="btn-ui btn-warning btn-sm" data-edit-doc="${d.id}">Editar</button>
        ${isAdmin ? `<button type="button" class="btn-ui btn-danger btn-sm" data-del-doc="${d.id}">Borrar</button>` : ""}
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit-doc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = docs.find((x) => x.id === btn.dataset.editDoc);
      if (!target) return;
      $("doc-id").value = target.id;
      $("protocolo").value = target.protocolo;
      $("folio").value = target.folio;
      $("cliente").value = target.cliente;
      $("descripcion").value = target.descripcion;
      $("fecha").value = target.fecha;
      $("form-title").textContent = "Editando Documento";
      $("btn-add").hidden = true;
      $("btn-update").hidden = false;
      $("btn-cancel-edit").hidden = false;
    });
  });

  tbody.querySelectorAll("[data-del-doc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentUser.role !== "admin") return;
      docs = docs.filter((x) => x.id !== btn.dataset.delDoc);
      saveJSON(STORAGE_KEYS.DOCS, docs);
      renderDocs();
    });
  });
}

$("btn-inventory").addEventListener("click", () => {
  const counts = {};
  docs.forEach((d) => {
    const key = d.descripcion || "Sin especificar";
    counts[key] = (counts[key] || 0) + 1;
  });
  const entries = Object.entries(counts);
  $("inventory-total-summary").textContent = `Total de documentos registrados: ${docs.length} (${entries.length} categorías)`;
  const tbody = $("inventory-tbody");
  tbody.innerHTML = "";
  entries.forEach(([desc, qty], idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${idx + 1}</td><td>${desc}</td><td>${qty}</td>`;
    tbody.appendChild(tr);
  });
  $("inventory-modal").hidden = false;
});
$("btn-close-inventory").addEventListener("click", () => { $("inventory-modal").hidden = true; });
$("btn-print-inventory").addEventListener("click", () => window.print());
$("btn-print-docs").addEventListener("click", () => window.print());

/* ==================== 7. MÓDULO: ARCHIVO DE EXPEDIENTE ==================== */
function syncExpedienteArchiveState() {
  const isArchived = $("exp-archivado").value === "SI";
  $("exp-holder").disabled = isArchived;
  $("exp-out-date").disabled = isArchived;
  if (isArchived) {
    $("exp-holder").value = "";
    $("exp-out-date").value = "";
  } else if (!$("exp-out-date").value) {
    $("exp-out-date").value = getTodayISO();
  }
}

$("exp-archivado").addEventListener("change", syncExpedienteArchiveState);

$("exp-pdf-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file && file.type === "application/pdf") {
    pendingPdfFile = file;
    $("exp-pdf-selected-name").textContent = file.name;
  } else {
    pendingPdfFile = null;
    $("exp-pdf-selected-name").textContent = "Sin PDF";
  }
});

$("expediente-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = Date.now().toString();
  const isArchived = $("exp-archivado").value === "SI";
  let pdfName = "";

  if (pendingPdfFile) {
    pdfName = pendingPdfFile.name;
    await savePdfBlob(id, pdfName, pendingPdfFile);
  }

  expedientes.unshift({
    id,
    cliente: $("exp-cliente").value.trim(),
    numero: $("exp-numero").value.trim(),
    descripcion: $("exp-descripcion").value.trim(),
    archivado: isArchived ? "SÍ" : "NO",
    holder: isArchived ? "" : $("exp-holder").value.trim(),
    outDate: isArchived ? "" : $("exp-out-date").value,
    pdfName,
    isNew: true
  });

  saveJSON(STORAGE_KEYS.EXPEDIENTES, expedientes);
  resetExpedienteForm();
  renderExpedientes();
});

$("btn-update-exp").addEventListener("click", async () => {
  const id = $("exp-id").value;
  const idx = expedientes.findIndex((x) => x.id === id);
  if (idx === -1) return;

  const isArchived = $("exp-archivado").value === "SI";
  let pdfName = expedientes[idx].pdfName || "";

  if (pendingPdfFile) {
    pdfName = pendingPdfFile.name;
    await savePdfBlob(id, pdfName, pendingPdfFile);
  }

  expedientes[idx] = {
    ...expedientes[idx],
    cliente: $("exp-cliente").value.trim(),
    numero: $("exp-numero").value.trim(),
    descripcion: $("exp-descripcion").value.trim(),
    archivado: isArchived ? "SÍ" : "NO",
    holder: isArchived ? "" : $("exp-holder").value.trim(),
    outDate: isArchived ? "" : $("exp-out-date").value,
    pdfName
  };

  saveJSON(STORAGE_KEYS.EXPEDIENTES, expedientes);
  resetExpedienteForm();
  renderExpedientes();
});

$("btn-cancel-exp").addEventListener("click", resetExpedienteForm);

function resetExpedienteForm() {
  $("expediente-form").reset();
  $("exp-id").value = "";
  pendingPdfFile = null;
  $("exp-pdf-selected-name").textContent = "Sin PDF";
  $("btn-add-exp").hidden = false;
  $("btn-update-exp").hidden = true;
  $("btn-cancel-exp").hidden = true;
  syncExpedienteArchiveState();
}

$("btn-search-exp").addEventListener("click", () => {
  searchExpTerm = $("search-exp-input").value.trim().toLowerCase();
  renderExpedientes();
});

$("btn-clear-exp").addEventListener("click", () => {
  $("search-exp-input").value = "";
  searchExpTerm = "";
  renderExpedientes();
});

$("btn-print-expedientes").addEventListener("click", () => window.print());

function renderExpedientes() {
  const tbody = $("expedientes-tbody");
  tbody.innerHTML = "";
  const isAdmin = currentUser && currentUser.role === "admin";

  const filtered = expedientes.filter((exp) => {
    if (!searchExpTerm) return true;
    return [exp.cliente, exp.numero, exp.descripcion, exp.archivado, exp.holder, exp.outDate, exp.pdfName]
      .some((val) => (val || "").toLowerCase().includes(searchExpTerm));
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9">No hay expedientes registrados.</td></tr>`;
    return;
  }

  filtered.forEach((exp, i) => {
    const tr = document.createElement("tr");
    if (exp.isNew) tr.classList.add("newly-added-row");
    const pdfCell = exp.pdfName
      ? `<div><strong>${exp.pdfName}</strong></div>
         <div class="crud-actions" style="margin-top:4px;">
           <button type="button" class="btn-ui btn-primary btn-sm" data-view-pdf="${exp.id}">Abrir PDF</button>
           <button type="button" class="btn-ui btn-success btn-sm" data-dl-pdf="${exp.id}">Descargar</button>
         </div>`
      : "Sin documento";

    tr.innerHTML = `
      <td>${i + 1}${exp.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
      <td>${exp.cliente}</td>
      <td>${exp.numero}</td>
      <td>${exp.descripcion}</td>
      <td><span class="status-pill ${exp.archivado === "SÍ" ? "pill-upcoming" : "pill-tomorrow"}">${exp.archivado}</span></td>
      <td>${exp.holder || "-"}</td>
      <td>${exp.outDate || "-"}</td>
      <td>${pdfCell}</td>
      <td class="no-print">
        <button type="button" class="btn-ui btn-warning btn-sm" data-edit-exp="${exp.id}">Editar</button>
        ${isAdmin ? `<button type="button" class="btn-ui btn-danger btn-sm" data-del-exp="${exp.id}">Borrar</button>` : ""}
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-view-pdf]").forEach((btn) => {
    btn.addEventListener("click", () => openAttachmentViewer(btn.dataset.viewPdf));
  });

  tbody.querySelectorAll("[data-dl-pdf]").forEach((btn) => {
    btn.addEventListener("click", () => downloadAttachment(btn.dataset.dlPdf));
  });

  tbody.querySelectorAll("[data-edit-exp]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = expedientes.find((x) => x.id === btn.dataset.editExp);
      if (!target) return;
      $("exp-id").value = target.id;
      $("exp-cliente").value = target.cliente;
      $("exp-numero").value = target.numero;
      $("exp-descripcion").value = target.descripcion;
      $("exp-archivado").value = target.archivado === "SÍ" ? "SI" : "NO";
      syncExpedienteArchiveState();
      $("exp-holder").value = target.holder || "";
      $("exp-out-date").value = target.outDate || "";
      $("exp-pdf-selected-name").textContent = target.pdfName || "Sin PDF";
      $("btn-add-exp").hidden = true;
      $("btn-update-exp").hidden = false;
      $("btn-cancel-exp").hidden = false;
    });
  });

  tbody.querySelectorAll("[data-del-exp]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (currentUser.role !== "admin") return;
      const id = btn.dataset.delExp;
      expedientes = expedientes.filter((x) => x.id !== id);
      saveJSON(STORAGE_KEYS.EXPEDIENTES, expedientes);
      await deletePdfBlob(id);
      renderExpedientes();
    });
  });
}

async function openAttachmentViewer(recordId) {
  const record = await getPdfBlob(recordId);
  if (!record || !record.blob) return;
  if (currentPdfObjectUrl) URL.revokeObjectURL(currentPdfObjectUrl);
  currentPdfObjectUrl = URL.createObjectURL(record.blob);

  const isImage = record.blob.type && record.blob.type.startsWith("image/");
  $("pdf-viewer-title").textContent = record.fileName;
  $("btn-download-pdf-modal").href = currentPdfObjectUrl;
  $("btn-download-pdf-modal").download = record.fileName;

  if (isImage) {
    $("img-viewer-box").src = currentPdfObjectUrl;
    $("img-viewer-box").hidden = false;
    $("pdf-viewer-frame").hidden = true;
    $("pdf-viewer-frame").src = "";
  } else {
    $("img-viewer-box").hidden = true;
    $("img-viewer-box").src = "";
    $("pdf-viewer-frame").hidden = false;
    $("pdf-viewer-frame").src = currentPdfObjectUrl;
  }

  $("pdf-viewer-modal").hidden = false;
}

async function downloadAttachment(recordId) {
  const record = await getPdfBlob(recordId);
  if (!record || !record.blob) return;
  const url = URL.createObjectURL(record.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = record.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("btn-close-pdf-viewer").addEventListener("click", () => {
  $("pdf-viewer-modal").hidden = true;
  $("pdf-viewer-frame").src = "";
  $("img-viewer-box").src = "";
});

/* ==================== 8. MÓDULO: AUDIENCIAS Y RECORDATORIOS ==================== */
function buildReminderMessage(aud) {
  return `📢 RECORDATORIO DE AUDIENCIA
Estimado/a cliente:
Le recordamos que tiene una audiencia programada con los siguientes datos:
- Cliente: ${aud.cliente}.
- Demandado: ${aud.demandado}.
- Tipo de audiencia: ${aud.tipo}.
- Fecha: ${aud.fecha}.
- Hora: ${aud.hora}.
- Lugar: ${aud.lugar}.
Agradecemos su puntual asistencia.
Atentamente,
Administración.`;
}

function classifyHearingDate(fechaStr) {
  const today = getTodayISO();
  const tomorrow = getTomorrowISO();
  if (fechaStr === tomorrow) return { code: "MAÑANA", label: "Mañana", pill: "pill-tomorrow" };
  if (fechaStr >= today) return { code: "PROXIMA", label: "Próxima", pill: "pill-upcoming" };
  return { code: "PASADA", label: "Pasada", pill: "pill-past" };
}

$("audiencia-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const newAud = {
    id: Date.now().toString(),
    cliente: $("aud-cliente").value.trim(),
    demandado: $("aud-demandado").value.trim(),
    tipo: $("aud-tipo").value.trim(),
    fecha: $("aud-fecha").value,
    hora: $("aud-hora").value,
    lugar: $("aud-lugar").value.trim(),
    contacto: $("aud-contacto").value.trim(),
    canalAuto: $("aud-canal-auto").value,
    reminderStatus: "Pendiente",
    autoSentDate: "",
    isNew: true
  };

  audiencias.push(newAud);
  saveJSON(STORAGE_KEYS.AUDIENCIAS, audiencias);
  syncHearingToWebhook(newAud);
  resetAudienciaForm();
  renderAudiencias();
  runBackgroundReminderCheck();
});

$("btn-update-aud").addEventListener("click", () => {
  const id = $("aud-id").value;
  const idx = audiencias.findIndex((a) => a.id === id);
  if (idx === -1) return;

  audiencias[idx] = {
    ...audiencias[idx],
    cliente: $("aud-cliente").value.trim(),
    demandado: $("aud-demandado").value.trim(),
    tipo: $("aud-tipo").value.trim(),
    fecha: $("aud-fecha").value,
    hora: $("aud-hora").value,
    lugar: $("aud-lugar").value.trim(),
    contacto: $("aud-contacto").value.trim(),
    canalAuto: $("aud-canal-auto").value
  };

  saveJSON(STORAGE_KEYS.AUDIENCIAS, audiencias);
  syncHearingToWebhook(audiencias[idx]);
  resetAudienciaForm();
  renderAudiencias();
  runBackgroundReminderCheck();
});

$("btn-cancel-aud").addEventListener("click", resetAudienciaForm);

function resetAudienciaForm() {
  $("audiencia-form").reset();
  $("aud-id").value = "";
  $("btn-add-aud").hidden = false;
  $("btn-update-aud").hidden = true;
  $("btn-cancel-aud").hidden = true;
  setDefaultDates();
}

$("btn-search-aud").addEventListener("click", () => {
  searchAudTerm = $("search-aud-input").value.trim().toLowerCase();
  renderAudiencias();
});

$("btn-clear-aud").addEventListener("click", () => {
  $("search-aud-input").value = "";
  searchAudTerm = "";
  renderAudiencias();
});

$("btn-print-audiencias").addEventListener("click", () => window.print());

function renderAudiencias() {
  const tbody = $("audiencias-tbody");
  tbody.innerHTML = "";
  const isAdmin = currentUser && currentUser.role === "admin";

  const sorted = [...audiencias].sort((a, b) => {
    const dtA = `${a.fecha || ""}T${a.hora || "00:00"}`;
    const dtB = `${b.fecha || ""}T${b.hora || "00:00"}`;
    return dtA.localeCompare(dtB);
  });

  let countTomorrow = 0;
  let countUpcoming = 0;
  let countPast = 0;

  sorted.forEach((a) => {
    const st = classifyHearingDate(a.fecha);
    if (st.code === "MAÑANA") countTomorrow++;
    else if (st.code === "PROXIMA") countUpcoming++;
    else countPast++;
  });

  $("count-aud-tomorrow").textContent = countTomorrow;
  $("count-aud-upcoming").textContent = countUpcoming;
  $("count-aud-past").textContent = countPast;

  const filtered = sorted.filter((a) => {
    if (!searchAudTerm) return true;
    return [a.cliente, a.demandado, a.tipo, a.fecha, a.hora, a.lugar, a.reminderStatus]
      .some((val) => (val || "").toLowerCase().includes(searchAudTerm));
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="10">No hay audiencias registradas.</td></tr>`;
    return;
  }

  filtered.forEach((a, i) => {
    const timeStatus = classifyHearingDate(a.fecha);
    const isSent = (a.reminderStatus || "").startsWith("Enviado");
    const tr = document.createElement("tr");
    if (a.isNew) tr.classList.add("newly-added-row");
    tr.innerHTML = `
      <td>${i + 1}${a.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
      <td><span class="status-pill ${timeStatus.pill}">${timeStatus.label}</span></td>
      <td>${a.cliente}</td>
      <td>${a.demandado}</td>
      <td>${a.tipo}</td>
      <td>${a.fecha}</td>
      <td>${a.hora}</td>
      <td>${a.lugar}</td>
      <td><span class="status-pill ${isSent ? "pill-sent" : "pill-pending"}">${a.reminderStatus || "Pendiente"}</span></td>
      <td class="no-print">
        <div class="crud-actions" style="margin-top:0;">
          <button type="button" class="btn-ui btn-primary btn-sm" data-remind-aud="${a.id}">Enviar Recordatorio</button>
          <button type="button" class="btn-ui btn-outline btn-sm" data-detail-aud="${a.id}">Detalles</button>
          <button type="button" class="btn-ui btn-warning btn-sm" data-edit-aud="${a.id}">Editar</button>
          ${isAdmin ? `<button type="button" class="btn-ui btn-danger btn-sm" data-del-aud="${a.id}">Borrar</button>` : ""}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-detail-aud]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = audiencias.find((x) => x.id === btn.dataset.detailAud);
      if (!a) return;
      $("hearing-detail-body").innerHTML = `
        <p><strong>Cliente:</strong> ${a.cliente}</p>
        <p><strong>Demandado:</strong> ${a.demandado}</p>
        <p><strong>Tipo de Audiencia:</strong> ${a.tipo}</p>
        <p><strong>Fecha:</strong> ${a.fecha}</p>
        <p><strong>Hora Exacta:</strong> ${a.hora}</p>
        <p><strong>Tribunal o Lugar:</strong> ${a.lugar}</p>
        <p><strong>Contacto Registrado:</strong> ${a.contacto || "No registrado"}</p>
        <p><strong>Canal Automático:</strong> ${a.canalAuto || "WhatsApp"}</p>
        <p><strong>Estado de Notificación:</strong> ${a.reminderStatus || "Pendiente"}</p>
      `;
      $("hearing-detail-modal").hidden = false;
    });
  });

  tbody.querySelectorAll("[data-remind-aud]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = audiencias.find((x) => x.id === btn.dataset.remindAud);
      if (!a) return;
      $("rem-aud-id").value = a.id;
      $("rem-channel").value = a.canalAuto || "WhatsApp";
      $("rem-contact").value = a.contacto || "";
      $("rem-message-preview").value = buildReminderMessage(a);
      $("rem-status-feedback").hidden = true;
      $("reminder-modal").hidden = false;
    });
  });

  tbody.querySelectorAll("[data-edit-aud]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = audiencias.find((x) => x.id === btn.dataset.editAud);
      if (!a) return;
      $("aud-id").value = a.id;
      $("aud-cliente").value = a.cliente;
      $("aud-demandado").value = a.demandado;
      $("aud-tipo").value = a.tipo;
      $("aud-fecha").value = a.fecha;
      $("aud-hora").value = a.hora;
      $("aud-lugar").value = a.lugar;
      $("aud-contacto").value = a.contacto || "";
      $("aud-canal-auto").value = a.canalAuto || "WhatsApp";
      $("btn-add-aud").hidden = true;
      $("btn-update-aud").hidden = false;
      $("btn-cancel-aud").hidden = false;
    });
  });

  tbody.querySelectorAll("[data-del-aud]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentUser.role !== "admin") return;
      audiencias = audiencias.filter((x) => x.id !== btn.dataset.delAud);
      saveJSON(STORAGE_KEYS.AUDIENCIAS, audiencias);
      renderAudiencias();
    });
  });
}

$("btn-close-hearing-detail").addEventListener("click", () => { $("hearing-detail-modal").hidden = true; });
$("btn-close-reminder-modal").addEventListener("click", () => { $("reminder-modal").hidden = true; });

$("btn-copy-reminder").addEventListener("click", async () => {
  const text = $("rem-message-preview").value;
  try {
    await navigator.clipboard.writeText(text);
    $("rem-status-feedback").textContent = "Mensaje copiado al portapapeles listo para pegar.";
    $("rem-status-feedback").hidden = false;
  } catch {
    $("rem-message-preview").select();
    document.execCommand("copy");
    $("rem-status-feedback").textContent = "Mensaje seleccionado y copiado.";
    $("rem-status-feedback").hidden = false;
  }
});

$("btn-send-reminder-now").addEventListener("click", () => {
  const id = $("rem-aud-id").value;
  const idx = audiencias.findIndex((x) => x.id === id);
  if (idx === -1) return;

  const channel = $("rem-channel").value;
  const contact = $("rem-contact").value.trim();
  const msg = $("rem-message-preview").value;
  const encodedMsg = encodeURIComponent(msg);
  const cleanPhone = contact.replace(/\D/g, "");

  audiencias[idx].contacto = contact;
  audiencias[idx].canalAuto = channel;

  if (channel === "WhatsApp") {
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone.length === 10 ? "1" + cleanPhone : cleanPhone}?text=${encodedMsg}`
      : `https://wa.me/?text=${encodedMsg}`;
    window.open(waUrl, "_blank");
    markHearingReminderSent(idx, `Enviado (${channel})`);
  } else if (channel === "Correo electrónico") {
    const subject = encodeURIComponent(`Recordatorio de Audiencia - ${audiencias[idx].cliente}`);
    window.open(`mailto:${encodeURIComponent(contact)}?subject=${subject}&body=${encodedMsg}`, "_blank");
    markHearingReminderSent(idx, `Enviado (${channel})`);
  } else if (channel === "SMS") {
    window.open(`sms:${cleanPhone}?body=${encodedMsg}`, "_blank");
    markHearingReminderSent(idx, `Enviado (${channel})`);
  } else if (channel === "Telegram") {
    window.open(`https://t.me/share/url?url=${encodeURIComponent("Centro Jurídico Dra. Angela Rojas")}&text=${encodedMsg}`, "_blank");
    markHearingReminderSent(idx, `Enviado (${channel})`);
  } else {
    navigator.clipboard?.writeText(msg);
    $("rem-status-feedback").textContent = `El canal ${channel} requiere pegado manual: el mensaje ya fue copiado al portapapeles. Péguelo en el chat del cliente y pulse "Marcar como Enviado".`;
    $("rem-status-feedback").hidden = false;
    saveJSON(STORAGE_KEYS.AUDIENCIAS, audiencias);
  }
});

$("btn-mark-reminder-sent").addEventListener("click", () => {
  const id = $("rem-aud-id").value;
  const idx = audiencias.findIndex((x) => x.id === id);
  if (idx === -1) return;
  markHearingReminderSent(idx, `Enviado (${$("rem-channel").value})`);
});

function markHearingReminderSent(idx, statusText) {
  audiencias[idx].reminderStatus = statusText;
  audiencias[idx].autoSentDate = getTodayISO();
  saveJSON(STORAGE_KEYS.AUDIENCIAS, audiencias);
  $("rem-status-feedback").textContent = `Estado actualizado: ${statusText}.`;
  $("rem-status-feedback").hidden = false;
  renderAudiencias();
}

$("btn-save-webhook").addEventListener("click", () => {
  reminderWebhookUrl = $("reminder-webhook-url").value.trim();
  localStorage.setItem(STORAGE_KEYS.WEBHOOK, reminderWebhookUrl);
  alert("Endpoint de servicio en segundo plano guardado correctamente.");
});

function syncHearingToWebhook(aud) {
  if (!reminderWebhookUrl) return;
  const sendDate = new Date(aud.fecha + "T08:00:00");
  sendDate.setDate(sendDate.getDate() - 1);

  fetch(reminderWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "schedule_hearing_reminder",
      hearing: aud,
      scheduledFor: sendDate.toISOString(),
      message: buildReminderMessage(aud)
    })
  }).catch(() => {});
}

function runBackgroundReminderCheck() {
  const tomorrow = getTomorrowISO();
  const today = getTodayISO();
  const tomorrowHearings = audiencias.filter((a) => a.fecha === tomorrow);

  if (tomorrowHearings.length > 0) {
    $("tomorrow-hearing-text").textContent =
      `Aviso: Tiene ${tomorrowHearings.length} audiencia(s) programada(s) para mañana (${tomorrow}).`;
    $("tomorrow-hearing-banner").hidden = false;
  } else {
    $("tomorrow-hearing-banner").hidden = true;
  }

  let changed = false;
  tomorrowHearings.forEach((aud) => {
    if (aud.autoSentDate === today || (aud.reminderStatus || "").startsWith("Enviado")) return;

    if (reminderWebhookUrl) {
      syncHearingToWebhook(aud);
      aud.reminderStatus = `Enviado Auto (${aud.canalAuto || "WhatsApp"})`;
      aud.autoSentDate = today;
      changed = true;
    } else {
      aud.reminderStatus = `Programado Mañana (${aud.canalAuto || "WhatsApp"})`;
      changed = true;
    }
  });

  if (changed) {
    saveJSON(STORAGE_KEYS.AUDIENCIAS, audiencias);
    if (!$("audiencias-section").hidden) renderAudiencias();
  }
}

$("btn-run-auto-reminders").addEventListener("click", () => {
  runBackgroundReminderCheck();
  renderAudiencias();
});

$("btn-go-tomorrow-hearings").addEventListener("click", () => {
  switchModule("audiencias");
  renderAudiencias();
});

$("btn-dismiss-tomorrow-banner").addEventListener("click", () => {
  $("tomorrow-hearing-banner").hidden = true;
});

setInterval(runBackgroundReminderCheck, 5 * 60 * 1000);

/* ==================== 8B. MÓDULO: CONTROL DE INQUILINOS POR PROPIETARIO ==================== */
function ensureOwnerBucket(ownerName) {
  if (!ownerName) return;
  if (!ownersList.includes(ownerName)) {
    ownersList.push(ownerName);
    saveJSON(STORAGE_KEYS.OWNERS, ownersList);
  }
  if (typeof ownerCommissionsData[ownerName] !== "number") {
    ownerCommissionsData[ownerName] = Number(ownerCommissionsData[ownerName]) || 0;
    saveJSON(STORAGE_KEYS.OWNER_COMMISSIONS, ownerCommissionsData);
  }
  if (!Array.isArray(ownerTenantsData[ownerName])) {
    ownerTenantsData[ownerName] = [];
  }
  if (!Array.isArray(ownerExpensesData[ownerName])) {
    ownerExpensesData[ownerName] = [];
  }
  if (!ownerStatementsHistory[ownerName] || typeof ownerStatementsHistory[ownerName] !== "object") {
    ownerStatementsHistory[ownerName] = {};
  }
}

function getOwnerCommissionRate(ownerName) {
  if (!ownerName) return 0;
  const val = Number(ownerCommissionsData[ownerName]);
  if (Number.isNaN(val) || val < 0) return 0;
  return Math.min(20, Math.floor(val));
}

function getOwnerAvailableMonths(ownerName) {
  const set = new Set(MONTHS_LIST);
  if (ownerName) {
    ensureOwnerBucket(ownerName);
    (ownerTenantsData[ownerName] || []).forEach((r) => { if (r.month && MONTHS_LIST.includes(r.month)) set.add(r.month); });
    (ownerExpensesData[ownerName] || []).forEach((g) => { if (g.month && MONTHS_LIST.includes(g.month)) set.add(g.month); });
    Object.keys(ownerStatementsHistory[ownerName] || {}).forEach((m) => { if (m && MONTHS_LIST.includes(m)) set.add(m); });
  }
  return MONTHS_LIST.filter((m) => set.has(m));
}

function populateOwnerSelects() {
  const mainSel = $("inq-owner-select");
  const formSel = $("inq-form-owner");
  const expSel = $("exp-owner-select");
  const delBtn = $("btn-delete-owner");
  const commSel = $("inq-owner-commission-select");
  if (!mainSel || !formSel || !expSel) return;

  if (!ownersList.length) {
    activeOwner = "";
    const emptyOpt = `<option value="">-- Agregue un propietario --</option>`;
    mainSel.innerHTML = emptyOpt;
    formSel.innerHTML = emptyOpt;
    expSel.innerHTML = emptyOpt;
    mainSel.disabled = true;
    formSel.disabled = true;
    expSel.disabled = true;
    if (delBtn) delBtn.disabled = true;
    if (commSel) {
      commSel.value = "0";
      commSel.disabled = true;
    }
    return;
  }

  if (!activeOwner || !ownersList.includes(activeOwner)) {
    activeOwner = ownersList[0];
  }
  ensureOwnerBucket(activeOwner);

  mainSel.disabled = false;
  formSel.disabled = false;
  expSel.disabled = false;
  if (delBtn) delBtn.disabled = false;
  if (commSel) {
    commSel.disabled = false;
    commSel.value = String(getOwnerCommissionRate(activeOwner));
  }

  const optionsHtml = ownersList.map((name) => `<option value="${name}">${name}</option>`).join("");
  mainSel.innerHTML = optionsHtml;
  formSel.innerHTML = optionsHtml;
  expSel.innerHTML = optionsHtml;

  mainSel.value = activeOwner;
  formSel.value = activeOwner;
  expSel.value = activeOwner;
}

function populateOwnerPeriodSelect() {
  const periodSel = $("inq-period-select");
  if (!periodSel) return;
  const months = getOwnerAvailableMonths(activeOwner);
  if (!activeOwnerPeriod || !months.includes(activeOwnerPeriod)) {
    activeOwnerPeriod = getCurrentMonthName();
  }
  periodSel.innerHTML = months.map((m) => `<option value="${m}">${m}</option>`).join("");
  periodSel.value = activeOwnerPeriod;
}

function computeOwnerMonthlyStatement(ownerName, monthStr) {
  const targetMonth = monthStr || getCurrentMonthName();
  if (!ownerName) {
    return {
      owner: "",
      month: targetMonth,
      commissionRate: 0,
      totalAlquileres: 0,
      commissionAmount: 0,
      totalPendientes: 0,
      totalGastos: 0,
      balanceFinal: 0,
      paidTenants: [],
      pendingTenants: [],
      generatedAt: getNowFormatted()
    };
  }

  ensureOwnerBucket(ownerName);
  const commissionRate = getOwnerCommissionRate(ownerName);
  const tenants = (ownerTenantsData[ownerName] || []).filter((t) => t.month === targetMonth);
  const expenses = (ownerExpensesData[ownerName] || []).filter((e) => e.month === targetMonth);

  const totalAlquileres = tenants.reduce((sum, t) => sum + (Number(t.paid) || 0), 0);
  const commissionAmount = totalAlquileres * (commissionRate / 100);
  const totalPendientes = tenants.reduce((sum, t) => sum + (Number(t.pending) || 0), 0);
  const totalGastos = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const balanceFinal = totalAlquileres - commissionAmount - totalGastos;

  const paidTenants = tenants.filter((t) => (Number(t.paid) || 0) > 0);
  const pendingTenants = tenants.filter((t) => (Number(t.pending) || 0) > 0);

  return {
    owner: ownerName,
    month: targetMonth,
    commissionRate,
    totalAlquileres,
    commissionAmount,
    totalPendientes,
    totalGastos,
    balanceFinal,
    paidTenants,
    pendingTenants,
    generatedAt: getNowFormatted()
  };
}

function persistOwnerMonthlySnapshot(ownerName, monthStr) {
  if (!ownerName) return null;
  const stmt = computeOwnerMonthlyStatement(ownerName, monthStr);
  ensureOwnerBucket(ownerName);
  ownerStatementsHistory[ownerName][stmt.month] = stmt;
  saveJSON(STORAGE_KEYS.OWNER_STATEMENTS, ownerStatementsHistory);
  return stmt;
}

function applyActiveOwnerBannerTheme() {
  const banner = $("inq-active-owner-banner");
  const titleEl = $("inq-active-owner-title");
  if (!banner || !titleEl) return;

  if (!activeOwner) {
    titleEl.textContent = "Sin propietario registrado";
    banner.style.borderLeftColor = "#64748b";
    banner.style.borderBottomColor = "#64748b";
    return;
  }

  const theme = getOwnerColorTheme(activeOwner);
  const rate = getOwnerCommissionRate(activeOwner);
  titleEl.innerHTML = `${activeOwner} <span style="font-size:15px;font-weight:700;padding:3px 10px;border-radius:999px;background:${theme.bg};color:${theme.text};margin-left:8px;">Período: ${activeOwnerPeriod}</span> <span style="font-size:14px;font-weight:800;padding:3px 10px;border-radius:999px;background:#ede9fe;color:#5b21b6;margin-left:6px;">${rate}%</span>`;
  banner.style.borderLeftColor = theme.border;
  banner.style.borderBottomColor = theme.border;
}

function renderOwnersModule() {
  populateOwnerSelects();
  populateOwnerPeriodSelect();
  applyActiveOwnerBannerTheme();

  $("inq-owner-header").textContent = activeOwner
    ? `Control de Inquilinos por Propietario — ${activeOwner}`
    : "Control de Inquilinos por Propietario";

  if (!$("inquilinos-section").hidden) {
    $("main-law-title").textContent = activeOwner
      ? `CONTROL DE INQUILINOS — ${activeOwner}`
      : "CONTROL DE INQUILINOS POR PROPIETARIO";
  }

  const stmt = computeOwnerMonthlyStatement(activeOwner, activeOwnerPeriod);
  $("inq-total-alquileres").textContent = formatMoney(stmt.totalAlquileres);
  $("inq-commission-label").textContent = `Cobrado (${stmt.commissionRate}%)`;
  $("inq-total-comision").textContent = formatMoney(stmt.commissionAmount);
  $("inq-total-pendientes").textContent = formatMoney(stmt.totalPendientes);
  $("inq-total-gastos").textContent = formatMoney(stmt.totalGastos);
  $("inq-total-balance").textContent = formatMoney(stmt.balanceFinal);

  const isAdmin = currentUser && currentUser.role === "admin";
  const allOwnerTenants = activeOwner ? (ownerTenantsData[activeOwner] || []) : [];
  const filteredTenants = allOwnerTenants.filter((t) => {
    if (!searchInqTerm) return true;
    const statusLabel = (Number(t.pending) || 0) > 0 ? "pendiente debe" : "pagado al dia";
    return [t.owner, t.tenantName, t.property, t.month, t.payDate, statusLabel]
      .some((val) => (val || "").toLowerCase().includes(searchInqTerm));
  });

  const inqTbody = $("inquilinos-tbody");
  inqTbody.innerHTML = "";
  if (!activeOwner) {
    inqTbody.innerHTML = `<tr><td colspan="11">Agregue un propietario para comenzar a registrar inquilinos.</td></tr>`;
  } else if (!filteredTenants.length) {
    inqTbody.innerHTML = `<tr><td colspan="11">No hay inquilinos o pagos registrados para ${activeOwner}.</td></tr>`;
  } else {
    filteredTenants.forEach((t, idx) => {
      const pendingVal = Number(t.pending) || 0;
      const statusHtml = pendingVal > 0
        ? `<span class="status-pill pill-debt">Pendiente ${formatMoney(pendingVal)}</span>`
        : `<span class="status-pill pill-upcoming">Pagado / Al día</span>`;

      const tr = document.createElement("tr");
      if (t.isNew) tr.classList.add("newly-added-row");
      tr.innerHTML = `
        <td>${idx + 1}${t.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
        <td>${renderOwnerBadgeHtml(t.owner)}</td>
        <td>${t.tenantName}</td>
        <td>${t.property}</td>
        <td>${t.month}</td>
        <td>${formatMoney(t.rent)}</td>
        <td><strong>${formatMoney(t.paid)}</strong></td>
        <td>${pendingVal > 0 ? formatMoney(pendingVal) : formatMoney(0)}</td>
        <td>${statusHtml}</td>
        <td>${t.payDate}</td>
        <td class="no-print">
          <button type="button" class="btn-ui btn-warning btn-sm" data-edit-inq="${t.id}">Editar</button>
          ${isAdmin ? `<button type="button" class="btn-ui btn-danger btn-sm" data-del-inq="${t.id}">Borrar</button>` : ""}
        </td>
      `;
      inqTbody.appendChild(tr);
    });
  }

  inqTbody.querySelectorAll("[data-edit-inq]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = allOwnerTenants.find((x) => x.id === btn.dataset.editInq);
      if (!target) return;
      $("inq-record-id").value = target.id;
      $("inq-form-owner").value = target.owner || activeOwner;
      $("inq-tenant-name").value = target.tenantName;
      $("inq-property").value = target.property;
      $("inq-month").value = MONTHS_LIST.includes(target.month) ? target.month : getCurrentMonthName();
      $("inq-rent").value = target.rent;
      $("inq-paid").value = target.paid;
      $("inq-pay-date").value = target.payDate;
      $("inq-contact").value = target.contact || "";
      $("btn-save-inq").hidden = true;
      $("btn-update-inq").hidden = false;
      $("btn-cancel-inq").hidden = false;
    });
  });

  inqTbody.querySelectorAll("[data-del-inq]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentUser.role !== "admin") return;
      ownerTenantsData[activeOwner] = allOwnerTenants.filter((x) => x.id !== btn.dataset.delInq);
      saveJSON(STORAGE_KEYS.OWNER_TENANTS, ownerTenantsData);
      renderOwnersModule();
    });
  });

  const allOwnerExpenses = activeOwner ? (ownerExpensesData[activeOwner] || []) : [];
  const expTbody = $("owner-expenses-tbody");
  expTbody.innerHTML = "";
  if (!activeOwner) {
    expTbody.innerHTML = `<tr><td colspan="8">Agregue un propietario para registrar gastos.</td></tr>`;
  } else if (!allOwnerExpenses.length) {
    expTbody.innerHTML = `<tr><td colspan="8">No hay gastos o salidas registradas para ${activeOwner}.</td></tr>`;
  } else {
    allOwnerExpenses.forEach((e, idx) => {
      const tr = document.createElement("tr");
      if (e.isNew) tr.classList.add("newly-added-row");
      tr.innerHTML = `
        <td>${idx + 1}${e.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
        <td>${renderOwnerBadgeHtml(e.owner)}</td>
        <td>${e.property || "-"}</td>
        <td>${e.month}</td>
        <td>${e.reason}</td>
        <td><strong>${formatMoney(e.amount)}</strong></td>
        <td>${e.date}</td>
        <td class="no-print">
          ${isAdmin ? `<button type="button" class="btn-ui btn-danger btn-sm" data-del-own-exp="${e.id}">Borrar</button>` : "-"}
        </td>
      `;
      expTbody.appendChild(tr);
    });
  }

  expTbody.querySelectorAll("[data-del-own-exp]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentUser.role !== "admin") return;
      ownerExpensesData[activeOwner] = allOwnerExpenses.filter((x) => x.id !== btn.dataset.delOwnExp);
      saveJSON(STORAGE_KEYS.OWNER_EXPENSES, ownerExpensesData);
      renderOwnersModule();
    });
  });

  $("owner-statement-title").textContent = activeOwner
    ? `Estado de Cuenta — ${activeOwner} (${activeOwnerPeriod})`
    : "Estado de Cuenta";
  $("stmt-total-ingresos").textContent = formatMoney(stmt.totalAlquileres);
  $("stmt-commission-label").textContent = `Cobrado (${stmt.commissionRate}%)`;
  $("stmt-total-comision").textContent = formatMoney(stmt.commissionAmount);
  $("stmt-total-gastos").textContent = formatMoney(stmt.totalGastos);
  $("stmt-total-pendientes").textContent = formatMoney(stmt.totalPendientes);
  $("stmt-balance-final").textContent = formatMoney(stmt.balanceFinal);

  const paidListEl = $("stmt-paid-list");
  paidListEl.innerHTML = stmt.paidTenants.length
    ? stmt.paidTenants.map((t) => `<li>${renderOwnerBadgeHtml(t.owner)} <strong>${t.tenantName}</strong> (${t.property}) — Pagó: <strong>${formatMoney(t.paid)}</strong></li>`).join("")
    : `<li>Sin pagos registrados en este mes.</li>`;

  const pendingListEl = $("stmt-pending-list");
  pendingListEl.innerHTML = stmt.pendingTenants.length
    ? stmt.pendingTenants.map((t) => `<li>${renderOwnerBadgeHtml(t.owner)} <strong>${t.tenantName}</strong> (${t.property}) — Pendiente: <strong>${formatMoney(t.pending)}</strong></li>`).join("")
    : `<li>Sin pagos pendientes en este mes.</li>`;

  const historyMap = activeOwner ? (ownerStatementsHistory[activeOwner] || {}) : {};
  const historyMonths = MONTHS_LIST.filter((m) => Boolean(historyMap[m])).reverse();
  const histTbody = $("owner-statement-history-tbody");
  histTbody.innerHTML = "";

  if (!historyMonths.length) {
    histTbody.innerHTML = `<tr><td colspan="10">Aún no se ha guardado un corte mensual en el historial${activeOwner ? ` para ${activeOwner}` : ""}. Pulse "Generar Estado Mensual" para guardar este mes.</td></tr>`;
  } else {
    historyMonths.forEach((mKey, idx) => {
      const h = historyMap[mKey];
      const rate = typeof h.commissionRate === "number" ? h.commissionRate : getOwnerCommissionRate(activeOwner);
      const commAmt = typeof h.commissionAmount === "number" ? h.commissionAmount : ((Number(h.totalAlquileres) || 0) * (rate / 100));
      const tr = document.createElement("tr");
      if (h.isNew) tr.classList.add("newly-added-row");
      tr.innerHTML = `
        <td>${idx + 1}${h.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
        <td><strong>${h.month}</strong></td>
        <td>${formatMoney(h.totalAlquileres)}</td>
        <td><strong>${rate}%</strong></td>
        <td>${formatMoney(commAmt)}</td>
        <td>${formatMoney(h.totalPendientes)}</td>
        <td>${formatMoney(h.totalGastos)}</td>
        <td><strong>${formatMoney(h.balanceFinal)}</strong></td>
        <td>${h.generatedAt || "-"}</td>
        <td class="no-print">
          <button type="button" class="btn-ui btn-primary btn-sm" data-view-stmt-month="${h.month}">Ver Mes</button>
        </td>
      `;
      histTbody.appendChild(tr);
    });
  }

  histTbody.querySelectorAll("[data-view-stmt-month]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeOwnerPeriod = btn.dataset.viewStmtMonth;
      renderOwnersModule();
    });
  });

  const invByProperty = {};
  allOwnerTenants.forEach((t) => {
    const propKey = t.property || "Inmueble sin especificar";
    invByProperty[propKey] = {
      owner: t.owner,
      property: propKey,
      tenantName: t.tenantName,
      contact: t.contact || "-",
      rent: Number(t.rent) || 0,
      lastMonth: t.month,
      pending: Number(t.pending) || 0,
      isNew: Boolean(t.isNew)
    };
  });

  const invRows = Object.values(invByProperty);
  const invTbody = $("owner-inventory-tbody");
  invTbody.innerHTML = "";
  if (!invRows.length) {
    invTbody.innerHTML = `<tr><td colspan="7">No hay inmuebles o inquilinos registrados en el inventario${activeOwner ? ` de ${activeOwner}` : ""}.</td></tr>`;
  } else {
    invRows.forEach((row, idx) => {
      const stBadge = row.pending > 0
        ? `<span class="status-pill pill-debt">Pendiente ${formatMoney(row.pending)}</span>`
        : `<span class="status-pill pill-upcoming">Al día</span>`;
      const tr = document.createElement("tr");
      if (row.isNew) tr.classList.add("newly-added-row");
      tr.innerHTML = `
        <td>${idx + 1}${row.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
        <td><strong>${row.property}</strong> ${renderOwnerBadgeHtml(row.owner)}</td>
        <td>${row.tenantName}</td>
        <td>${row.contact}</td>
        <td>${formatMoney(row.rent)}</td>
        <td>${row.lastMonth}</td>
        <td>${stBadge}</td>
      `;
      invTbody.appendChild(tr);
    });
  }
}

$("btn-add-owner").addEventListener("click", () => {
  const name = $("inq-new-owner-name").value.trim();
  if (!name) return;
  ensureOwnerBucket(name);
  activeOwner = name;
  activeOwnerPeriod = getCurrentMonthName();
  $("inq-new-owner-name").value = "";
  renderOwnersModule();
});

$("inq-owner-commission-select").addEventListener("change", (e) => {
  if (!activeOwner) return;
  ensureOwnerBucket(activeOwner);
  const rate = Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0));
  ownerCommissionsData[activeOwner] = rate;
  saveJSON(STORAGE_KEYS.OWNER_COMMISSIONS, ownerCommissionsData);
  renderOwnersModule();
});

$("btn-delete-owner").addEventListener("click", () => {
  if (!activeOwner) return;
  const targetOwner = activeOwner;
  const confirmDel = confirm(`¿Seguro que desea eliminar al propietario "${targetOwner}" y todos sus registros de inquilinos, gastos e historial?`);
  if (!confirmDel) return;

  ownersList = ownersList.filter((o) => o !== targetOwner);
  delete ownerCommissionsData[targetOwner];
  delete ownerTenantsData[targetOwner];
  delete ownerExpensesData[targetOwner];
  delete ownerStatementsHistory[targetOwner];

  saveJSON(STORAGE_KEYS.OWNERS, ownersList);
  saveJSON(STORAGE_KEYS.OWNER_COMMISSIONS, ownerCommissionsData);
  saveJSON(STORAGE_KEYS.OWNER_TENANTS, ownerTenantsData);
  saveJSON(STORAGE_KEYS.OWNER_EXPENSES, ownerExpensesData);
  saveJSON(STORAGE_KEYS.OWNER_STATEMENTS, ownerStatementsHistory);

  activeOwner = ownersList[0] || "";
  activeOwnerPeriod = getCurrentMonthName();
  resetInquilinoForm();
  renderOwnersModule();
});

$("inq-owner-select").addEventListener("change", (e) => {
  activeOwner = e.target.value;
  activeOwnerPeriod = getCurrentMonthName();
  resetInquilinoForm();
  renderOwnersModule();
});

$("inq-period-select").addEventListener("change", (e) => {
  activeOwnerPeriod = e.target.value;
  renderOwnersModule();
});

$("btn-generate-monthly-statement").addEventListener("click", () => {
  if (!activeOwner) return;
  const stmt = persistOwnerMonthlySnapshot(activeOwner, activeOwnerPeriod);
  if (stmt && ownerStatementsHistory[activeOwner]?.[stmt.month]) {
    ownerStatementsHistory[activeOwner][stmt.month].isNew = true;
    saveJSON(STORAGE_KEYS.OWNER_STATEMENTS, ownerStatementsHistory);
  }
  renderOwnersModule();
  alert(`Estado de cuenta de ${activeOwnerPeriod} guardado en el historial de ${activeOwner}. Los meses anteriores se conservan intactos.`);
});

$("inquilino-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const targetOwner = $("inq-form-owner").value || activeOwner;
  if (!targetOwner) {
    alert("Primero agregue un propietario.");
    return;
  }
  ensureOwnerBucket(targetOwner);

  const rent = Number($("inq-rent").value) || 0;
  const paid = Number($("inq-paid").value) || 0;
  const pending = Math.max(0, rent - paid);
  const monthVal = $("inq-month").value || getCurrentMonthName();

  const record = {
    id: "inq_" + Date.now().toString(),
    owner: targetOwner,
    tenantName: $("inq-tenant-name").value.trim(),
    property: $("inq-property").value.trim(),
    month: monthVal,
    rent,
    paid,
    pending,
    payDate: $("inq-pay-date").value || getTodayISO(),
    contact: $("inq-contact").value.trim(),
    isNew: true
  };

  ownerTenantsData[targetOwner].unshift(record);
  saveJSON(STORAGE_KEYS.OWNER_TENANTS, ownerTenantsData);

  activeOwner = targetOwner;
  activeOwnerPeriod = monthVal;
  resetInquilinoForm();
  renderOwnersModule();
});

$("btn-update-inq").addEventListener("click", () => {
  const id = $("inq-record-id").value;
  const currentList = ownerTenantsData[activeOwner] || [];
  const idx = currentList.findIndex((x) => x.id === id);
  if (idx === -1) return;

  const targetOwner = $("inq-form-owner").value || activeOwner;
  ensureOwnerBucket(targetOwner);

  const rent = Number($("inq-rent").value) || 0;
  const paid = Number($("inq-paid").value) || 0;
  const pending = Math.max(0, rent - paid);
  const monthVal = $("inq-month").value || getCurrentMonthName();

  const updated = {
    ...currentList[idx],
    owner: targetOwner,
    tenantName: $("inq-tenant-name").value.trim(),
    property: $("inq-property").value.trim(),
    month: monthVal,
    rent,
    paid,
    pending,
    payDate: $("inq-pay-date").value || getTodayISO(),
    contact: $("inq-contact").value.trim()
  };

  ownerTenantsData[activeOwner] = currentList.filter((x) => x.id !== id);
  ownerTenantsData[targetOwner].unshift(updated);
  saveJSON(STORAGE_KEYS.OWNER_TENANTS, ownerTenantsData);

  activeOwner = targetOwner;
  activeOwnerPeriod = monthVal;
  resetInquilinoForm();
  renderOwnersModule();
});

$("btn-cancel-inq").addEventListener("click", resetInquilinoForm);

function resetInquilinoForm() {
  $("inquilino-form").reset();
  $("inq-record-id").value = "";
  $("btn-save-inq").hidden = false;
  $("btn-update-inq").hidden = true;
  $("btn-cancel-inq").hidden = true;
  populateMonthSelects();
  setDefaultDates();
  populateOwnerSelects();
}

$("owner-expense-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const targetOwner = $("exp-owner-select").value || activeOwner;
  if (!targetOwner) {
    alert("Primero agregue un propietario.");
    return;
  }
  ensureOwnerBucket(targetOwner);
  const monthVal = $("exp-owner-month").value || getCurrentMonthName();

  ownerExpensesData[targetOwner].unshift({
    id: "oexp_" + Date.now().toString(),
    owner: targetOwner,
    property: $("exp-owner-property").value.trim(),
    month: monthVal,
    reason: $("exp-owner-reason").value.trim(),
    amount: Number($("exp-owner-amount").value) || 0,
    date: $("exp-owner-date").value || getTodayISO(),
    isNew: true
  });

  saveJSON(STORAGE_KEYS.OWNER_EXPENSES, ownerExpensesData);
  activeOwner = targetOwner;
  activeOwnerPeriod = monthVal;
  $("owner-expense-form").reset();
  populateMonthSelects();
  setDefaultDates();
  populateOwnerSelects();
  renderOwnersModule();
});

$("btn-search-inq").addEventListener("click", () => {
  searchInqTerm = $("search-inq-input").value.trim().toLowerCase();
  renderOwnersModule();
});

$("btn-clear-inq").addEventListener("click", () => {
  $("search-inq-input").value = "";
  searchInqTerm = "";
  renderOwnersModule();
});

$("btn-print-owner-statement").addEventListener("click", () => {
  if (activeOwner) persistOwnerMonthlySnapshot(activeOwner, activeOwnerPeriod);
  renderOwnersModule();
  window.print();
});

$("btn-print-owner-inventory").addEventListener("click", () => {
  renderOwnersModule();
  window.print();
});

/* ==================== 9. ADMINISTRACIÓN DE RESIDENCIALES, SERVICIOS Y CREDENCIALES ==================== */
document.querySelectorAll(".btn-res-gate").forEach((btn) => {
  btn.addEventListener("click", () => {
    const resName = btn.dataset.res;
    if (!resName) return;
    if (!canUserAccessResidential(currentUser?.username, resName)) {
      alert("No tiene permiso para acceder a este residencial.");
      return;
    }
    $("res-auth-target").value = resName;
    $("res-auth-title").textContent = `Acceso — ${resName}`;
    $("res-auth-hint").textContent = `Ingrese el usuario y la contraseña de ${resName}.`;
    $("res-auth-error").hidden = true;
    $("res-auth-form").reset();
    $("res-auth-target").value = resName;
    $("res-auth-modal").hidden = false;
  });
});

$("btn-close-res-auth").addEventListener("click", () => { $("res-auth-modal").hidden = true; });

$("res-auth-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = $("res-auth-user").value.trim();
  const p = $("res-auth-pass").value;
  const resName = $("res-auth-target").value || RESIDENTIALS[0];

  if (!canUserAccessResidential(currentUser?.username, resName) || !canUserAccessResidential(u, resName)) {
    $("res-auth-error").textContent = "Este usuario no tiene acceso a este residencial.";
    $("res-auth-error").hidden = false;
    return;
  }

  const resCred = resCredentials[resName] || DEFAULT_RES_CREDS[resName];
  const isAdminMatch = users.some((x) => x.username === u && x.password === p && x.role === "admin" && x.active);
  const isResMatch = resCred && resCred.username === u && resCred.password === p;
  const isActiveUserMatch = currentUser && currentUser.username === u &&
    users.some((x) => x.username === u && x.password === p && x.active);

  if (!isAdminMatch && !isResMatch && !isActiveUserMatch) {
    $("res-auth-error").textContent = "Usuario o contraseña incorrectos.";
    $("res-auth-error").hidden = false;
    return;
  }

  activateResidential(resName);
  $("res-auth-modal").hidden = true;
});

$("btn-open-res-creds").addEventListener("click", () => {
  const currentCred = resCredentials[activeResidential] || DEFAULT_RES_CREDS[activeResidential] || { username: "", password: "" };
  $("res-creds-title").textContent = `Usuario y Contraseña — ${activeResidential}`;
  $("res-cred-username").value = currentCred.username;
  $("res-cred-password").value = currentCred.password;
  $("res-creds-msg").hidden = true;
  $("res-creds-modal").hidden = false;
});

$("btn-close-res-creds").addEventListener("click", () => { $("res-creds-modal").hidden = true; });

$("res-creds-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const nextUser = $("res-cred-username").value.trim();
  const nextPass = $("res-cred-password").value;
  if (!nextUser || !nextPass) return;

  const changedAt = getNowFormatted();
  resCredentials[activeResidential] = {
    username: nextUser,
    password: nextPass,
    changedAt
  };
  saveJSON(STORAGE_KEYS.RES_CREDS, resCredentials);
  renderResidentialCredsDB();

  $("res-creds-msg").textContent = `Credenciales guardadas el ${changedAt} para ${activeResidential}. El administrador puede verlas en su base de datos.`;
  $("res-creds-msg").hidden = false;
});

$("btn-admin-res-db").addEventListener("click", () => {
  if (!currentUser || currentUser.role !== "admin") return;
  renderUsersModal();
  $("users-list-modal").hidden = false;
});

function setResidentialSubView(subView) {
  const isServices = subView === "SERVICES";
  $("res-maintenance-panel").hidden = isServices;
  $("res-services-panel").hidden = !isServices;
  $("btn-toggle-res-subview").textContent = isServices ? "Volver a Mantenimiento" : "Pagar Servicios";
}

$("btn-toggle-res-subview").addEventListener("click", () => {
  const currentlyServices = !$("res-services-panel").hidden;
  setResidentialSubView(currentlyServices ? "MAINTENANCE" : "SERVICES");
});

$("btn-back-res-maintenance").addEventListener("click", () => {
  setResidentialSubView("MAINTENANCE");
});

function syncServiceLabels() {
  const srv = $("srv-type").value;
  if (srv === "Luz") {
    $("srv-nic").placeholder = "Número de NIC o Contrato";
  } else {
    $("srv-nic").placeholder = "Número de Contrato / Referencia";
  }
}

$("srv-type").addEventListener("change", syncServiceLabels);

$("srv-comprobante-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    pendingServiceFile = file;
    $("srv-file-selected-name").textContent = file.name;
  } else {
    pendingServiceFile = null;
    $("srv-file-selected-name").textContent = "Opcional";
  }
});

function getActiveResServices() {
  if (!Array.isArray(resServicesData[activeResidential])) {
    resServicesData[activeResidential] = [];
  }
  return resServicesData[activeResidential];
}

$("service-payment-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const list = getActiveResServices();
  const id = "srv_" + Date.now().toString();
  let fileName = "";

  if (pendingServiceFile) {
    fileName = pendingServiceFile.name;
    await savePdfBlob(id, fileName, pendingServiceFile);
  }

  list.unshift({
    id,
    servicio: $("srv-type").value,
    nic: $("srv-nic").value.trim(),
    cliente: $("srv-cliente").value.trim(),
    mes: $("srv-mes").value,
    fechaPago: $("srv-fecha-pago").value,
    fechaLimite: $("srv-fecha-limite").value,
    monto: Number($("srv-monto").value) || 0,
    fileName,
    isNew: true
  });

  saveJSON(STORAGE_KEYS.RES_SERVICES, resServicesData);
  $("service-payment-form").reset();
  pendingServiceFile = null;
  $("srv-file-selected-name").textContent = "Opcional";
  populateMonthSelects();
  setDefaultDates();
  syncServiceLabels();
  renderServicePayments();
});

$("btn-clear-srv-pay").addEventListener("click", () => {
  $("service-payment-form").reset();
  pendingServiceFile = null;
  $("srv-file-selected-name").textContent = "Opcional";
  populateMonthSelects();
  setDefaultDates();
  syncServiceLabels();
});

function renderServicePayments() {
  const list = getActiveResServices();
  const tbody = $("service-payments-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const isAdmin = currentUser && currentUser.role === "admin";

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="10">No hay pagos de servicios registrados en ${activeResidential}.</td></tr>`;
    return;
  }

  list.forEach((item, idx) => {
    const tr = document.createElement("tr");
    if (item.isNew) tr.classList.add("newly-added-row");
    const compCell = item.fileName
      ? `<div><strong>${item.fileName}</strong></div>
         <div class="crud-actions" style="margin-top:4px;">
           <button type="button" class="btn-ui btn-primary btn-sm" data-view-srv-file="${item.id}">Ver</button>
           <button type="button" class="btn-ui btn-success btn-sm" data-dl-srv-file="${item.id}">Descargar</button>
         </div>`
      : "Sin adjunto";

    tr.innerHTML = `
      <td>${idx + 1}${item.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
      <td><strong>${item.servicio}</strong></td>
      <td>${item.nic || "-"}</td>
      <td>${item.cliente}</td>
      <td>${item.mes}</td>
      <td>${item.fechaPago}</td>
      <td>${item.fechaLimite}</td>
      <td><strong>${formatMoney(item.monto)}</strong></td>
      <td>${compCell}</td>
      <td class="no-print">
        ${isAdmin ? `<button type="button" class="btn-ui btn-danger btn-sm" data-del-srv="${item.id}">Borrar</button>` : "-"}
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-view-srv-file]").forEach((btn) => {
    btn.addEventListener("click", () => openAttachmentViewer(btn.dataset.viewSrvFile));
  });

  tbody.querySelectorAll("[data-dl-srv-file]").forEach((btn) => {
    btn.addEventListener("click", () => downloadAttachment(btn.dataset.dlSrvFile));
  });

  tbody.querySelectorAll("[data-del-srv]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (currentUser.role !== "admin") return;
      const id = btn.dataset.delSrv;
      resServicesData[activeResidential] = list.filter((x) => x.id !== id);
      saveJSON(STORAGE_KEYS.RES_SERVICES, resServicesData);
      await deletePdfBlob(id);
      renderServicePayments();
    });
  });
}

/* ==================== 9B. SERVICIOS GENERALES (PARA TODOS) ==================== */
function syncGeneralServiceLabels() {
  const srv = $("gen-srv-type").value;
  if (srv === "Luz") {
    $("gen-srv-nic").placeholder = "Número de NIC o Contrato";
  } else {
    $("gen-srv-nic").placeholder = "Número de Contrato / Referencia";
  }
}

$("gen-srv-type").addEventListener("change", syncGeneralServiceLabels);

$("gen-srv-comprobante-file").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    pendingGeneralServiceFile = file;
    $("gen-srv-file-selected-name").textContent = file.name;
  } else {
    pendingGeneralServiceFile = null;
    $("gen-srv-file-selected-name").textContent = "Opcional";
  }
});

$("general-service-payment-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = "gensrv_" + Date.now().toString();
  let fileName = "";

  if (pendingGeneralServiceFile) {
    fileName = pendingGeneralServiceFile.name;
    await savePdfBlob(id, fileName, pendingGeneralServiceFile);
  }

  generalServicesData.unshift({
    id,
    servicio: $("gen-srv-type").value,
    nic: $("gen-srv-nic").value.trim(),
    cliente: $("gen-srv-cliente").value.trim(),
    mes: $("gen-srv-mes").value,
    fechaPago: $("gen-srv-fecha-pago").value,
    fechaLimite: $("gen-srv-fecha-limite").value,
    monto: Number($("gen-srv-monto").value) || 0,
    fileName,
    isNew: true
  });

  saveJSON(STORAGE_KEYS.GEN_SERVICES, generalServicesData);
  $("general-service-payment-form").reset();
  pendingGeneralServiceFile = null;
  $("gen-srv-file-selected-name").textContent = "Opcional";
  populateMonthSelects();
  setDefaultDates();
  syncGeneralServiceLabels();
  renderGeneralServicePayments();
});

$("btn-clear-gen-srv-pay").addEventListener("click", () => {
  $("general-service-payment-form").reset();
  pendingGeneralServiceFile = null;
  $("gen-srv-file-selected-name").textContent = "Opcional";
  populateMonthSelects();
  setDefaultDates();
  syncGeneralServiceLabels();
});

function renderGeneralServicePayments() {
  const tbody = $("general-service-payments-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const isAdmin = currentUser && currentUser.role === "admin";

  if (!generalServicesData.length) {
    tbody.innerHTML = `<tr><td colspan="10">No hay pagos de servicios registrados en la sección general.</td></tr>`;
    return;
  }

  generalServicesData.forEach((item, idx) => {
    const tr = document.createElement("tr");
    if (item.isNew) tr.classList.add("newly-added-row");
    const compCell = item.fileName
      ? `<div><strong>${item.fileName}</strong></div>
         <div class="crud-actions" style="margin-top:4px;">
           <button type="button" class="btn-ui btn-primary btn-sm" data-view-gensrv-file="${item.id}">Ver</button>
           <button type="button" class="btn-ui btn-success btn-sm" data-dl-gensrv-file="${item.id}">Descargar</button>
         </div>`
      : "Sin adjunto";

    tr.innerHTML = `
      <td>${idx + 1}${item.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
      <td><strong>${item.servicio}</strong></td>
      <td>${item.nic || "-"}</td>
      <td>${item.cliente}</td>
      <td>${item.mes}</td>
      <td>${item.fechaPago}</td>
      <td>${item.fechaLimite}</td>
      <td><strong>${formatMoney(item.monto)}</strong></td>
      <td>${compCell}</td>
      <td class="no-print">
        ${isAdmin ? `<button type="button" class="btn-ui btn-danger btn-sm" data-del-gensrv="${item.id}">Borrar</button>` : "-"}
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-view-gensrv-file]").forEach((btn) => {
    btn.addEventListener("click", () => openAttachmentViewer(btn.dataset.viewGensrvFile));
  });

  tbody.querySelectorAll("[data-dl-gensrv-file]").forEach((btn) => {
    btn.addEventListener("click", () => downloadAttachment(btn.dataset.dlGensrvFile));
  });

  tbody.querySelectorAll("[data-del-gensrv]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (currentUser.role !== "admin") return;
      const id = btn.dataset.delGensrv;
      generalServicesData = generalServicesData.filter((x) => x.id !== id);
      saveJSON(STORAGE_KEYS.GEN_SERVICES, generalServicesData);
      await deletePdfBlob(id);
      renderGeneralServicePayments();
    });
  });
}

function openServiceInventoryModal(source = "RESIDENTIAL") {
  serviceInventorySource = source;
  const isGeneral = source === "GENERAL";
  const list = isGeneral ? generalServicesData : getActiveResServices();
  const titleLabel = isGeneral ? "Servicios (Todos)" : activeResidential;
  const totalMonto = list.reduce((acc, x) => acc + (Number(x.monto) || 0), 0);

  $("service-inventory-title").textContent = `Inventario de Pagos Realizados — ${titleLabel}`;
  $("service-inventory-summary").textContent =
    `Total de pagos registrados: ${list.length} | Monto total pagado: ${formatMoney(totalMonto)}`;

  const tbody = $("service-inventory-tbody");
  tbody.innerHTML = "";

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9">No hay pagos registrados.</td></tr>`;
  } else {
    list.forEach((item, idx) => {
      const tr = document.createElement("tr");
      if (item.isNew) tr.classList.add("newly-added-row");
      tr.innerHTML = `
        <td>${idx + 1}${item.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
        <td>${item.servicio}</td>
        <td>${item.nic || "-"}</td>
        <td>${item.cliente}</td>
        <td>${item.mes}</td>
        <td>${item.fechaPago}</td>
        <td>${item.fechaLimite}</td>
        <td><strong>${formatMoney(item.monto)}</strong></td>
        <td>${item.fileName || "Sin adjunto"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  $("service-inventory-modal").hidden = false;
}

$("btn-open-service-inventory").addEventListener("click", () => openServiceInventoryModal("RESIDENTIAL"));
$("btn-open-general-service-inventory").addEventListener("click", () => openServiceInventoryModal("GENERAL"));
$("btn-close-service-inventory").addEventListener("click", () => { $("service-inventory-modal").hidden = true; });
$("btn-print-service-inventory").addEventListener("click", () => window.print());
$("btn-print-general-services").addEventListener("click", () => {
  openServiceInventoryModal("GENERAL");
  setTimeout(() => window.print(), 150);
});
$("btn-print-service-inventory-inline").addEventListener("click", () => {
  openServiceInventoryModal("RESIDENTIAL");
  setTimeout(() => window.print(), 150);
});

function setResidentialMode(mode) {
  const isIngreso = mode === "INGRESO";
  $("btn-res-mode-ingreso").classList.toggle("active-mode-btn", isIngreso);
  $("btn-res-mode-egreso").classList.toggle("active-mode-btn", !isIngreso);

  if (isIngreso) {
    $("res-category").value = "MANTENIMIENTO";
    $("res-concepto").value = "Cuota de Mantenimiento";
  } else {
    $("res-category").value = "SERVICIO";
    if ($("res-concepto").value === "Cuota de Mantenimiento") {
      $("res-concepto").value = "Luz";
    }
  }
}

$("btn-res-mode-ingreso").addEventListener("click", () => setResidentialMode("INGRESO"));
$("btn-res-mode-egreso").addEventListener("click", () => setResidentialMode("EGRESO"));

$("res-category").addEventListener("change", () => {
  const val = $("res-category").value;
  const isIngreso = val === "MANTENIMIENTO" || val === "INGRESO_EXTRA";
  $("btn-res-mode-ingreso").classList.toggle("active-mode-btn", isIngreso);
  $("btn-res-mode-egreso").classList.toggle("active-mode-btn", !isIngreso);
});

function activateResidential(resName) {
  if (!canUserAccessResidential(currentUser?.username, resName)) {
    alert("No tiene permiso para acceder a este residencial.");
    return;
  }
  activeResidential = resName;
  $("res-module-header").textContent = `Mantenimiento — ${activeResidential}`;
  $("active-residential-title").textContent = activeResidential;
  resetResidentialForm();
  setResidentialMode("INGRESO");
  setResidentialSubView("MAINTENANCE");
  syncServiceLabels();
  switchModule("residenciales");
  renderResidential();
  renderServicePayments();
}

function getActiveResRecords() {
  if (!Array.isArray(residencialesData[activeResidential])) {
    residencialesData[activeResidential] = [];
  }
  return residencialesData[activeResidential];
}

$("residencial-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const list = getActiveResRecords();
  const category = $("res-category").value;
  const cuota = Number($("res-cuota").value) || 0;
  const pagado = Number($("res-pagado").value) || 0;
  const isIncome = category === "MANTENIMIENTO" || category === "INGRESO_EXTRA";
  const deuda = isIncome && cuota > 0 ? Math.max(0, cuota - pagado) : 0;

  list.unshift({
    id: Date.now().toString(),
    category,
    apto: $("res-apto").value.trim(),
    cliente: $("res-cliente").value.trim(),
    concepto: $("res-concepto").value,
    mes: $("res-mes").value,
    cuota,
    pagado,
    deuda,
    fecha: $("res-fecha").value,
    isNew: true
  });

  saveJSON(STORAGE_KEYS.RESIDENCIALES, residencialesData);
  resetResidentialForm();
  setResidentialMode("INGRESO");
  renderResidential();
});

$("btn-update-res").addEventListener("click", () => {
  const id = $("res-record-id").value;
  const list = getActiveResRecords();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return;

  const category = $("res-category").value;
  const cuota = Number($("res-cuota").value) || 0;
  const pagado = Number($("res-pagado").value) || 0;
  const isIncome = category === "MANTENIMIENTO" || category === "INGRESO_EXTRA";
  const deuda = isIncome && cuota > 0 ? Math.max(0, cuota - pagado) : 0;

  list[idx] = {
    ...list[idx],
    category,
    apto: $("res-apto").value.trim(),
    cliente: $("res-cliente").value.trim(),
    concepto: $("res-concepto").value,
    mes: $("res-mes").value,
    cuota,
    pagado,
    deuda,
    fecha: $("res-fecha").value
  };

  saveJSON(STORAGE_KEYS.RESIDENCIALES, residencialesData);
  resetResidentialForm();
  setResidentialMode("INGRESO");
  renderResidential();
});

$("btn-cancel-res").addEventListener("click", () => {
  resetResidentialForm();
  setResidentialMode("INGRESO");
});

function resetResidentialForm() {
  $("residencial-form").reset();
  $("res-record-id").value = "";
  $("btn-add-res").hidden = false;
  $("btn-update-res").hidden = true;
  $("btn-cancel-res").hidden = true;
  populateMonthSelects();
  setDefaultDates();
}

$("btn-search-res").addEventListener("click", () => {
  searchResTerm = $("search-res-input").value.trim().toLowerCase();
  renderResidential();
});

$("btn-clear-res").addEventListener("click", () => {
  $("search-res-input").value = "";
  searchResTerm = "";
  renderResidential();
});

$("btn-print-residencial").addEventListener("click", () => window.print());

function renderResidential() {
  const list = getActiveResRecords();
  const tbody = $("residencial-tbody");
  tbody.innerHTML = "";
  const isAdmin = currentUser && currentUser.role === "admin";

  let totalIngresos = 0;
  let totalGastos = 0;
  let totalDeudas = 0;

  list.forEach((item) => {
    const isIncome = item.category === "MANTENIMIENTO" || item.category === "INGRESO_EXTRA";
    if (isIncome) {
      totalIngresos += Number(item.pagado) || 0;
      totalDeudas += Number(item.deuda) || 0;
    } else {
      totalGastos += Number(item.pagado) || 0;
    }
  });

  $("res-total-ingresos").textContent = formatMoney(totalIngresos);
  $("res-total-gastos").textContent = formatMoney(totalGastos);
  $("res-total-deudas").textContent = formatMoney(totalDeudas);
  $("res-total-balance").textContent = formatMoney(totalIngresos - totalGastos);

  const filtered = list.filter((item) => {
    if (!searchResTerm) return true;
    const debtText = item.deuda > 0 ? `debe pendiente ${item.deuda}` : "al dia pagado";
    return [item.category, item.apto, item.cliente, item.concepto, item.mes, item.fecha, debtText]
      .some((val) => (val || "").toLowerCase().includes(searchResTerm));
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="12">No hay movimientos registrados en ${activeResidential}.</td></tr>`;
    return;
  }

  const catNames = {
    MANTENIMIENTO: "Cobro Mantenimiento",
    INGRESO_EXTRA: "Ingreso Extra",
    SERVICIO: "Servicio Básico",
    GASTO: "Gasto General"
  };

  filtered.forEach((item, i) => {
    const isIncome = item.category === "MANTENIMIENTO" || item.category === "INGRESO_EXTRA";
    const statusHtml = isIncome
      ? (item.deuda > 0
          ? `<span class="status-pill pill-debt">Debe ${formatMoney(item.deuda)}</span>`
          : `<span class="status-pill pill-upcoming">Al día</span>`)
      : `<span class="status-pill pill-sent">Pagado</span>`;

    const tr = document.createElement("tr");
    if (item.isNew) tr.classList.add("newly-added-row");
    tr.innerHTML = `
      <td>${i + 1}${item.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
      <td>${catNames[item.category] || item.category}</td>
      <td>${item.apto || "-"}</td>
      <td>${item.cliente || "-"}</td>
      <td>${item.concepto}</td>
      <td>${item.mes}</td>
      <td>${item.cuota ? formatMoney(item.cuota) : "-"}</td>
      <td><strong>${formatMoney(item.pagado)}</strong></td>
      <td>${item.deuda ? formatMoney(item.deuda) : "-"}</td>
      <td>${statusHtml}</td>
      <td>${item.fecha}</td>
      <td class="no-print">
        <button type="button" class="btn-ui btn-warning btn-sm" data-edit-res="${item.id}">Editar</button>
        ${isAdmin ? `<button type="button" class="btn-ui btn-danger btn-sm" data-del-res="${item.id}">Borrar</button>` : ""}
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit-res]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = list.find((x) => x.id === btn.dataset.editRes);
      if (!target) return;
      $("res-record-id").value = target.id;
      $("res-category").value = target.category;
      $("res-apto").value = target.apto || "";
      $("res-cliente").value = target.cliente || "";
      $("res-concepto").value = target.concepto;
      $("res-mes").value = MONTHS_LIST.includes(target.mes) ? target.mes : getCurrentMonthName();
      $("res-cuota").value = target.cuota || "";
      $("res-pagado").value = target.pagado;
      $("res-fecha").value = target.fecha;
      $("btn-add-res").hidden = true;
      $("btn-update-res").hidden = false;
      $("btn-cancel-res").hidden = false;
    });
  });

  tbody.querySelectorAll("[data-del-res]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentUser.role !== "admin") return;
      residencialesData[activeResidential] = list.filter((x) => x.id !== btn.dataset.delRes);
      saveJSON(STORAGE_KEYS.RESIDENCIALES, residencialesData);
      renderResidential();
    });
  });
}

/* ==================== 10. MÓDULO ENTRADA Y SALIDA DE DINERO ==================== */
$("btn-open-cashflow-gate").addEventListener("click", () => {
  $("cf-auth-error").hidden = true;
  $("cashflow-auth-form").reset();
  $("cashflow-auth-modal").hidden = false;
});
$("btn-close-cf-auth").addEventListener("click", () => { $("cashflow-auth-modal").hidden = true; });

$("cashflow-auth-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const u = $("cf-auth-user").value.trim();
  const p = $("cf-auth-pass").value;
  const match = users.find((x) => x.username === u && x.password === p && x.active);
  if (!match) {
    $("cf-auth-error").hidden = false;
    return;
  }
  $("cashflow-auth-modal").hidden = true;
  switchModule("cashflow");
  populateMonthSelects();
  setDefaultDates();
  syncFlowFields();
  renderCashflow();
});

function syncFlowFields() {
  const isExit = $("flow-type").value === "SALIDA";
  const useBank = $("flow-channel").value === "BANCO";

  $("flow-reason").disabled = !isExit;
  document.querySelectorAll(".entry-only-field").forEach((el) => { el.disabled = isExit; });

  $("th-flow-bank").hidden = !useBank;
  $("td-flow-bank").hidden = !useBank;
  $("th-flow-receiver").hidden = useBank;
  $("td-flow-receiver").hidden = useBank;
}

$("flow-type").addEventListener("change", syncFlowFields);
$("flow-channel").addEventListener("change", syncFlowFields);

$("cashflow-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const type = $("flow-type").value;
  const channel = $("flow-channel").value;
  const monthly = Number($("flow-monthly-amount").value) || 0;
  const abono = Number($("flow-abono").value) || 0;
  const amount = Number($("flow-amount").value) || 0;
  const pending = type === "ENTRADA" && monthly > 0
    ? Math.max(0, monthly - (abono > 0 ? abono : amount))
    : 0;

  const tenantVal = $("flow-tenant").value.trim();
  const monthVal = $("flow-month").value || getCurrentMonthName();
  const ownerVal = $("flow-owner").value.trim();
  const dateVal = $("flow-date").value;

  cashflow.unshift({
    id: Date.now().toString(),
    type,
    channel,
    bankOrReceiver: channel === "BANCO" ? ($("flow-bank").value || "Banco") : ($("flow-receiver").value.trim() || "Oficina"),
    reason: $("flow-reason").value.trim(),
    tenant: tenantVal,
    month: monthVal,
    owner: ownerVal,
    monthly,
    abono,
    amount,
    pending,
    date: dateVal,
    isNew: true
  });

  saveJSON(STORAGE_KEYS.CASHFLOW, cashflow);

  if (type === "ENTRADA" && ownerVal && tenantVal) {
    ensureOwnerBucket(ownerVal);
    const normalizedMonth = MONTHS_LIST.includes(monthVal) ? monthVal : getCurrentMonthName();
    ownerTenantsData[ownerVal].unshift({
      id: "inq_cf_" + Date.now().toString(),
      owner: ownerVal,
      tenantName: tenantVal,
      property: "Inmueble (Entrada Caja)",
      month: normalizedMonth,
      rent: monthly > 0 ? monthly : amount,
      paid: abono > 0 ? abono : amount,
      pending,
      payDate: dateVal || getTodayISO(),
      contact: "",
      isNew: true
    });
    saveJSON(STORAGE_KEYS.OWNER_TENANTS, ownerTenantsData);
    renderOwnersModule();
  }

  renderCashflow();
  $("cashflow-form").reset();
  populateMonthSelects();
  setDefaultDates();
  syncFlowFields();
});

$("btn-search-flow").addEventListener("click", () => {
  searchFlowTerm = $("search-flow-input").value.trim().toLowerCase();
  renderCashflow();
});

$("btn-clear-flow").addEventListener("click", () => {
  $("search-flow-input").value = "";
  searchFlowTerm = "";
  renderCashflow();
});

$("btn-print-cashflow").addEventListener("click", () => window.print());

function renderCashflow() {
  let totalIn = 0;
  let totalOut = 0;
  const tbody = $("cashflow-tbody");
  tbody.innerHTML = "";
  const isAdmin = currentUser && currentUser.role === "admin";

  cashflow.forEach((m) => {
    if (m.type === "ENTRADA") totalIn += Number(m.amount) || 0;
    else totalOut += Number(m.amount) || 0;
  });

  $("total-entradas").textContent = formatMoney(totalIn);
  $("total-salidas").textContent = formatMoney(totalOut);
  $("total-balance").textContent = formatMoney(totalIn - totalOut);

  const filtered = cashflow.filter((m) => {
    if (!searchFlowTerm) return true;
    return [m.type, m.channel, m.bankOrReceiver, m.reason, m.tenant, m.month, m.owner, m.date]
      .some((val) => (val || "").toLowerCase().includes(searchFlowTerm));
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="14">No se encontraron movimientos registrados.</td></tr>`;
    return;
  }

  filtered.forEach((m, idx) => {
    const tr = document.createElement("tr");
    if (m.isNew) tr.classList.add("newly-added-row");
    const ownerDisplay = m.owner ? renderOwnerBadgeHtml(m.owner) : "-";
    tr.innerHTML = `
      <td>${idx + 1}${m.isNew ? `<span class="new-badge">NUEVO</span>` : ""}</td>
      <td>${m.type}</td>
      <td>${m.channel} / ${m.bankOrReceiver}</td>
      <td>${m.channel === "OFICINA" ? m.bankOrReceiver : "-"}</td>
      <td>${m.reason || "-"}</td>
      <td>${m.tenant || "-"}</td>
      <td>${m.month || "-"}</td>
      <td>${ownerDisplay}</td>
      <td>${m.monthly ? formatMoney(m.monthly) : "-"}</td>
      <td>${m.abono ? formatMoney(m.abono) : "-"}</td>
      <td><strong>${formatMoney(m.amount)}</strong></td>
      <td>${m.pending ? formatMoney(m.pending) : "-"}</td>
      <td>${m.date}</td>
      <td class="no-print">
        <button type="button" class="btn-ui btn-warning btn-sm" data-edit-flow="${m.id}">Editar</button>
        ${isAdmin ? `<button type="button" class="btn-ui btn-danger btn-sm" data-del-flow="${m.id}">Borrar</button>` : ""}
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-edit-flow]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = cashflow.find((x) => x.id === btn.dataset.editFlow);
      if (!item) return;
      populateMonthSelects();
      $("edit-flow-id").value = item.id;
      $("edit-flow-name").value = item.tenant || "";
      $("edit-flow-month").value = MONTHS_LIST.includes(item.month) ? item.month : getCurrentMonthName();
      $("edit-flow-reason").value = item.reason || "";
      $("edit-flow-amount").value = item.amount;
      $("edit-flow-abono").value = item.abono || "";
      $("edit-flow-modal").hidden = false;
    });
  });

  tbody.querySelectorAll("[data-del-flow]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (currentUser.role !== "admin") return;
      cashflow = cashflow.filter((x) => x.id !== btn.dataset.delFlow);
      saveJSON(STORAGE_KEYS.CASHFLOW, cashflow);
      renderCashflow();
    });
  });
}

$("btn-close-edit-flow").addEventListener("click", () => { $("edit-flow-modal").hidden = true; });

$("edit-flow-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("edit-flow-id").value;
  const idx = cashflow.findIndex((x) => x.id === id);
  if (idx === -1) return;

  const amount = Number($("edit-flow-amount").value) || 0;
  const abono = Number($("edit-flow-abono").value) || 0;
  const monthly = cashflow[idx].monthly || 0;
  const pending = cashflow[idx].type === "ENTRADA" && monthly > 0
    ? Math.max(0, monthly - (abono > 0 ? abono : amount))
    : 0;

  cashflow[idx] = {
    ...cashflow[idx],
    tenant: $("edit-flow-name").value.trim(),
    month: $("edit-flow-month").value || getCurrentMonthName(),
    reason: $("edit-flow-reason").value.trim(),
    amount,
    abono,
    pending
  };

  saveJSON(STORAGE_KEYS.CASHFLOW, cashflow);
  $("edit-flow-modal").hidden = true;
  renderCashflow();
});

/* ==================== 11. ADMINISTRACIÓN DE USUARIOS Y CONTRASEÑAS ==================== */
$("btn-open-user-modal").addEventListener("click", () => {
  $("user-modal-error").hidden = true;
  $("new-user-form").reset();
  $("user-modal").hidden = false;
});
$("btn-close-user-modal").addEventListener("click", () => { $("user-modal").hidden = true; });

$("new-user-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const username = $("new-username").value.trim();
  const password = $("new-user-pass").value;
  if (!username || !password || users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    $("user-modal-error").hidden = false;
    return;
  }
  users.push({ username, password, role: "user", active: true, passChangedAt: "-" });
  saveJSON(STORAGE_KEYS.USERS, users);
  $("user-modal").hidden = true;
  renderUsersModal();
});

$("btn-view-users").addEventListener("click", () => {
  renderUsersModal();
  $("users-list-modal").hidden = false;
});
$("btn-close-users-list").addEventListener("click", () => { $("users-list-modal").hidden = true; });

function renderResidentialCredsDB() {
  const dbBody = $("res-creds-db-tbody");
  if (!dbBody) return;
  dbBody.innerHTML = "";

  RESIDENTIALS.forEach((resName) => {
    const cred = resCredentials[resName] || DEFAULT_RES_CREDS[resName] || { username: "-", password: "-", changedAt: "-" };
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${resName}</strong></td>
      <td>${cred.username}</td>
      <td><strong>${cred.password}</strong></td>
      <td>${cred.changedAt || "-"}</td>
    `;
    dbBody.appendChild(tr);
  });
}

function renderUsersModal() {
  const tbody = $("users-tbody");
  tbody.innerHTML = "";
  users.forEach((u) => {
    const tr = document.createElement("tr");
    const canToggle = u.role !== "admin";
    tr.innerHTML = `
      <td>${u.username}</td>
      <td><strong>${u.password}</strong></td>
      <td>${u.passChangedAt || "-"}</td>
      <td>${u.role === "admin" ? "Administrador" : "Usuario"}</td>
      <td>${u.active ? "Activo" : "Deshabilitado"}</td>
      <td>
        ${canToggle
          ? `<button type="button" class="btn-ui ${u.active ? "btn-danger" : "btn-success"} btn-sm" data-toggle-user="${u.username}">${u.active ? "Deshabilitar" : "Habilitar"}</button>`
          : "Protegido"}
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-toggle-user]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = users.find((x) => x.username === btn.dataset.toggleUser);
      if (!target || target.role === "admin") return;
      target.active = !target.active;
      saveJSON(STORAGE_KEYS.USERS, users);
      renderUsersModal();
    });
  });

  renderResidentialCredsDB();
}

$("btn-change-pass").addEventListener("click", () => {
  $("pass-form").reset();
  $("pass-modal").hidden = false;
});
$("btn-close-modal").addEventListener("click", () => { $("pass-modal").hidden = true; });

$("pass-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const adminAcc = users.find((u) => u.role === "admin" || u.username === currentUser?.username);
  if (adminAcc) {
    adminAcc.password = $("new-password").value;
    adminAcc.passChangedAt = getNowFormatted();
    saveJSON(STORAGE_KEYS.USERS, users);
  }
  $("pass-modal").hidden = true;
});

$("forgot-link").addEventListener("click", () => {
  $("recover-form").reset();
  $("recover-new-pass-group").hidden = true;
  $("recover-msg").hidden = true;
  $("recover-modal").hidden = false;
});
$("btn-close-recover").addEventListener("click", () => { $("recover-modal").hidden = true; });

$("recover-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const targetUser = $("recover-username").value.trim();
  const found = users.find((u) => u.username === targetUser);
  const msgEl = $("recover-msg");
  msgEl.hidden = false;

  if (!found) {
    msgEl.textContent = "Usuario no encontrado.";
    return;
  }
  if (found.role !== "admin") {
    msgEl.textContent = "Solo la cuenta de Administrador puede restablecer contraseñas desde aquí.";
    return;
  }
  if ($("recover-new-pass-group").hidden) {
    $("recover-new-pass-group").hidden = false;
    $("recover-new-pass").required = true;
    msgEl.textContent = "Ingrese la nueva contraseña para el administrador y pulse nuevamente.";
    return;
  }
  const nextPass = $("recover-new-pass").value;
  if (!nextPass) return;
  found.password = nextPass;
  found.passChangedAt = getNowFormatted();
  saveJSON(STORAGE_KEYS.USERS, users);
  msgEl.textContent = "Contraseña de administrador actualizada correctamente.";
});

/* ==================== 12. INICIALIZACIÓN ==================== */
populateMonthSelects();
populateCommissionSelect();

if (currentUser) {
  enterDashboard();
} else {
  setDefaultDates();
  syncExpedienteArchiveState();
  syncServiceLabels();
  syncGeneralServiceLabels();
}