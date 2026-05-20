const STORAGE_KEY = "DeltboState";
const SESSION_KEY = "DeltboSession";
const COLLECTIVES_KEY = "DeltboCollectives";
const CONTACTS_KEY = "DeltboContactRequests";
const THEME_KEY = "DeltboTheme";
const LEGACY_PREFIX = "kol" + "lex";
const LEGACY_STORAGE_KEY = `${LEGACY_PREFIX}State`;
const LEGACY_SESSION_KEY = `${LEGACY_PREFIX}Session`;
const LEGACY_COLLECTIVES_KEY = `${LEGACY_PREFIX}Collectives`;
const LEGACY_CONTACTS_KEY = `${LEGACY_PREFIX}ContactRequests`;
const BASE_PRICE_NOK = 99;
const MEMBER_PRICE_NOK = 19;
const PRICE_NOK = BASE_PRICE_NOK;
const SUPER_ADMIN = { username: "deltbo", password: "support99" };
const DEFAULT_MODULES = {
  expenses: true,
  cleaning: true,
  shopping: true,
  calendar: true,
  rules: true,
  inventory: true,
  contacts: true,
  conflict: true,
};
const MODULE_LABELS = {
  expenses: "Utlegg",
  cleaning: "Vask og oppgaver",
  shopping: "Handleliste",
  calendar: "Kalender",
  rules: "Husregler",
  inventory: "Felles ting",
  contacts: "Kontakter",
  conflict: "Saker",
};
const DEFAULT_NOTIFICATIONS = {
  shopping: false,
  expenses: true,
  cleaning: true,
  messages: true,
};
const ALWAYS_ON_NOTIFICATIONS = ["rent", "crisis", "conflict"];

const storageAdapter = {
  loadAppState: () => safeJson(localStorage.getItem(STORAGE_KEY)) ?? safeJson(localStorage.getItem(LEGACY_STORAGE_KEY)),
  saveAppState: (nextState) => localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState)),
  loadCollectives: () => safeJson(localStorage.getItem(COLLECTIVES_KEY)) ?? safeJson(localStorage.getItem(LEGACY_COLLECTIVES_KEY)),
  saveCollectives: (nextCollectives) => localStorage.setItem(COLLECTIVES_KEY, JSON.stringify(nextCollectives)),
  loadContactRequests: () => safeJson(localStorage.getItem(CONTACTS_KEY)) ?? safeJson(localStorage.getItem(LEGACY_CONTACTS_KEY)),
  saveContactRequests: (nextRequests) => localStorage.setItem(CONTACTS_KEY, JSON.stringify(nextRequests)),
  loadSession: () => safeJson(sessionStorage.getItem(SESSION_KEY)) ?? safeJson(sessionStorage.getItem(LEGACY_SESSION_KEY)),
  saveSession: (nextSession) => sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession)),
};

const demoData = {
  home: null,
  members: [{ id: uid(), name: "Deg", room: "Rom 1", role: "admin", joinedAt: isoNow() }],
  expenses: [
    { id: uid(), title: "Toalettpapir", amount: 81, paidBy: "Deg", settled: false, receipt: null, createdAt: isoNow() },
    { id: uid(), title: "Strømregning", amount: 420, paidBy: "Maria", settled: false, receipt: null, createdAt: isoNow() },
  ],
  cleaning: [
    { id: uid(), title: "Kjøkken", assignee: "Maria", dueDate: todayPlus(1), done: false },
    { id: uid(), title: "Bad", assignee: "Jonas", dueDate: todayPlus(3), done: false },
    { id: uid(), title: "Stue", assignee: "Deg", dueDate: todayPlus(5), done: false },
  ],
  shopping: [
    { id: uid(), item: "Melk", quantity: "2 stk", done: false, receipt: null },
    { id: uid(), item: "Kylling", quantity: "1 pakke", done: false, receipt: null },
    { id: uid(), item: "Toalettpapir", quantity: "12 ruller", done: false, receipt: null },
  ],
  messages: [
    { id: uid(), text: "Husk husmøte søndag kl. 18.", author: "Deltbo", createdAt: isoNow() },
  ],
  events: [
    { id: uid(), title: "Husmøte", date: todayPlus(4) },
    { id: uid(), title: "Søppel hentes", date: todayPlus(2) },
  ],
  rules: [
    { id: uid(), text: "Rydd kjøkkenet samme dag som du lager mat." },
    { id: uid(), text: "Gi beskjed i god tid hvis du har overnattingsbesøk." },
  ],
  inventory: [
    { id: uid(), name: "Støvsuger", owner: "Felles bod", status: "OK" },
    { id: uid(), name: "Router", owner: "Stue", status: "OK" },
  ],
  contacts: [
    { id: uid(), name: "Huseier", value: "huseier@example.no" },
    { id: uid(), name: "Legevakt", value: "116 117" },
  ],
  conflicts: [],
  modules: DEFAULT_MODULES,
  notificationSettings: DEFAULT_NOTIFICATIONS,
  notifications: [
    { id: uid(), type: "rent", priority: "important", title: "Husleie", text: "Viktige betalingsvarsler ligger alltid nederst i appen.", createdAt: isoNow(), read: false },
    { id: uid(), type: "crisis", priority: "critical", title: "Krise/brannalarm", text: "Kritiske varsler kan ikke skrus av.", createdAt: isoNow(), read: false },
  ],
  history: [],
};

let state = normalizeState(storageAdapter.loadAppState());
let session = storageAdapter.loadSession() ?? { role: null, memberName: null };
let toastTimer;
let demoTimer;
let demoSceneIndex = 0;
let createMode = "paid";
let activeTheme = "light";

const demoScenes = [
  ["Start kollektivet", "Én person setter opp rom, betaling og invite-link."],
  ["Få inn folk", "Beboerne lager egen bruker og får sin plass i oversikten."],
  ["Legg inn utlegg", "Kvitteringer, summer og hvem som la ut ligger på samme sted."],
  ["Dropp maset", "Vask, handleliste og beskjeder slipper å forsvinne i chatten."],
];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  applyTheme(activeTheme);
  bindUi();
  routeFromUrl();
  render();
  startDemoLoop();
});

function bindUi() {
  document.addEventListener("click", handleClick);
  $("createForm").addEventListener("submit", createHome);
  $("joinForm").addEventListener("submit", joinHome);
  $("loginForm").addEventListener("submit", login);
  $("superLoginForm").addEventListener("submit", superLogin);
  $("publicContactForm").addEventListener("submit", submitPublicContact);
  $("publicContactMessage").addEventListener("input", renderContactAiPreview);
  $("publicContactTopic").addEventListener("change", renderContactAiPreview);
  document.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
    input.addEventListener("change", renderPaymentFields);
  });
  $("firstMembers").addEventListener("input", renderCreatePrice);
  $("roomCount").addEventListener("input", renderCreatePrice);
  $("dashboardViewSelect")?.addEventListener("change", (event) => openTab(event.target.value));
  document.querySelectorAll(".file-input").forEach((input) => input.addEventListener("change", () => updateFileLabel(input)));
  $("settingsHomePhoto")?.addEventListener("change", () => {
    const file = $("settingsHomePhoto")?.files?.[0];
    if (file) renderImagePreview("settingsHomePhotoPreview", { dataUrl: URL.createObjectURL(file) }, "IMG");
  });
  $("memberForm").addEventListener("submit", addMember);
  $("expenseForm").addEventListener("submit", addExpense);
  $("cleanForm").addEventListener("submit", addCleaningTask);
  $("shopForm").addEventListener("submit", addShoppingItem);
  $("eventForm").addEventListener("submit", addEvent);
  $("ruleForm").addEventListener("submit", addRule);
  $("inventoryForm").addEventListener("submit", addInventory);
  $("contactForm").addEventListener("submit", addContact);
  $("conflictForm").addEventListener("submit", addConflict);
  $("settingsForm").addEventListener("submit", saveSettings);
  $("quickAddForm").addEventListener("submit", quickAdd);
  $("loginModal").addEventListener("click", closeModalFromBackdrop);
  $("quickAdd").addEventListener("click", closeModalFromBackdrop);
  renderPaymentFields();
}

function handleClick(event) {
  const tabButton = event.target.closest("[data-tab]");
  if (tabButton) {
    openTab(tabButton.dataset.tab, tabButton);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const actions = {
    "show-create": showCreate,
    "show-owner-create": showOwnerCreate,
    "go-landing": goLanding,
    "create-back": handleCreateBack,
    "open-login": openLogin,
    "close-login": closeLogin,
    "open-super-login": openSuperLogin,
    "close-super-login": closeSuperLogin,
    "open-dashboard": () => openDashboard("admin"),
    "copy-invite": copyInvite,
    "toggle-theme": toggleTheme,
    "scroll-features": () => $("features").scrollIntoView({ behavior: "smooth" }),
    "scroll-demo": () => $("demo").scrollIntoView({ behavior: "smooth" }),
    "toggle-demo": toggleDemo,
    "restart-demo": restartDemo,
    "show-quick-add": () => openModal("quickAdd"),
    "close-quick-add": () => closeModal("quickAdd"),
    "add-message": addMessage,
    "refresh-superadmin": () => {
      renderSuperadmin();
      showToast("Listen er oppdatert");
    },
    logout,
  };

  if (actions[action]) {
    actions[action]();
    return;
  }

  const id = actionButton.dataset.id;
  const itemActions = {
    "toggle-expense": () => toggleExpense(id),
    "delete-expense": () => deleteExpense(id),
    "done-clean": () => updateById("cleaning", id, (item) => ({ ...item, done: !item.done })),
    "delete-clean": () => removeById("cleaning", id, "Oppgave fjernet"),
    "toggle-shop": () => updateById("shopping", id, (item) => ({ ...item, done: !item.done })),
    "delete-shop": () => removeById("shopping", id, "Vare fjernet"),
    "delete-message": () => removeById("messages", id, "Beskjed fjernet"),
    "download-message-calendar": () => downloadMessageCalendar(id),
    "delete-event": () => removeById("events", id, "Hendelse fjernet"),
    "delete-rule": () => removeById("rules", id, "Regel fjernet"),
    "delete-inventory": () => removeById("inventory", id, "Ting fjernet"),
    "delete-contact": () => removeById("contacts", id, "Kontakt fjernet"),
    "resolve-conflict": () => updateById("conflicts", id, (item) => ({ ...item, resolved: !item.resolved })),
    "delete-conflict": () => removeById("conflicts", id, "Sak fjernet"),
    "copy-member-invite": () => copyMemberInvite(id),
    "open-support": () => openCollectiveAsSupport(id),
    "clean-support": () => cleanCollectiveIssues(id),
    "delete-support": () => deleteCollective(id),
    "resolve-contact": () => resolveContactRequest(id),
    "delete-contact-request": () => deleteContactRequest(id),
    "read-notification": () => markNotificationRead(id),
    "clear-notifications": () => clearReadNotifications(),
  };

  itemActions[action]?.();
}

function closeModalFromBackdrop(event) {
  if (event.target.classList.contains("modal")) {
    event.target.classList.remove("open");
  }
}

function routeFromUrl() {
  const inviteToken = new URLSearchParams(window.location.search).get("invite");

  if (inviteToken) {
    if (session.role && state.home?.inviteToken === inviteToken) {
      openDashboard(session.role);
      return;
    }

    showJoin(inviteToken);
    return;
  }

  if (session.role === "superadmin") {
    openSuperadmin();
    return;
  }

  if (session.role && state.home) {
    openDashboard(session.role);
  }
}

function normalizeState(savedState) {
  const base = structuredCloneSafe(demoData);
  const merged = { ...base, ...(savedState ?? {}) };
  const members = normalizeMembers(merged.members);

  return {
    ...merged,
    home: normalizeHome(merged.home),
    members,
    expenses: normalizeCollection(merged.expenses, (expense) => ({
      id: expense.id ?? uid(),
      title: expense.title ?? "Utlegg",
      amount: Number(expense.amount ?? 0),
      paidBy: expense.paidBy ?? members[0]?.name ?? "Admin",
      createdBy: expense.createdBy ?? expense.paidBy ?? members[0]?.name ?? "Admin",
      settled: Boolean(expense.settled),
      settledAt: expense.settledAt ?? "",
      settledBy: expense.settledBy ?? "",
      receipt: normalizeReceipt(expense.receipt),
      createdAt: expense.createdAt ?? isoNow(),
    })),
    cleaning: normalizeCollection(merged.cleaning, (task) => typeof task === "string"
      ? stringCleaningTask(task, members)
      : {
          id: task.id ?? uid(),
          title: task.title ?? "Oppgave",
          assignee: task.assignee ?? members[0]?.name ?? "Ikke tildelt",
          dueDate: task.dueDate ?? todayPlus(7),
          done: Boolean(task.done),
        }),
    shopping: normalizeCollection(merged.shopping, (item) => typeof item === "string"
      ? { id: uid(), item, quantity: "", done: false, receipt: null }
      : { id: item.id ?? uid(), item: item.item ?? "Vare", quantity: item.quantity ?? "", done: Boolean(item.done), receipt: normalizeReceipt(item.receipt) }),
    messages: normalizeCollection(merged.messages, (item) => ({
      id: item.id ?? uid(),
      text: item.text ?? "",
      author: item.author ?? "Deltbo",
      remindAt: item.remindAt ?? "",
      createdAt: item.createdAt ?? isoNow(),
    })),
    events: normalizeCollection(merged.events, (item) => ({ id: item.id ?? uid(), title: item.title ?? "Hendelse", date: item.date ?? todayPlus(7) })),
    rules: normalizeCollection(merged.rules, (item) => typeof item === "string" ? { id: uid(), text: item } : { id: item.id ?? uid(), text: item.text ?? "" }),
    inventory: normalizeCollection(merged.inventory, (item) => ({ id: item.id ?? uid(), name: item.name ?? "Ting", owner: item.owner ?? "", status: item.status ?? "OK" })),
    contacts: normalizeCollection(merged.contacts, (item) => ({ id: item.id ?? uid(), name: item.name ?? "Kontakt", value: item.value ?? "" })),
    conflicts: normalizeCollection(merged.conflicts, (item) => typeof item === "string"
      ? { id: uid(), text: item, resolved: false, createdAt: isoNow() }
      : { id: item.id ?? uid(), text: item.text ?? "", resolved: Boolean(item.resolved), createdAt: item.createdAt ?? isoNow() }),
    modules: normalizeModules(merged.modules),
    notificationSettings: normalizeNotificationSettings(merged.notificationSettings),
    notifications: normalizeCollection(merged.notifications, (item) => ({
      id: item.id ?? uid(),
      type: item.type === "crisis" && item.title === "Ny sak" ? "conflict" : item.type ?? "messages",
      priority: item.priority ?? "normal",
      title: item.title ?? "Varsel",
      text: item.type === "crisis" && item.title === "Ny sak" ? "Noen har tatt opp noe anonymt i kollektivet." : item.text ?? "",
      createdAt: item.createdAt ?? isoNow(),
      read: Boolean(item.read),
    })),
    history: normalizeCollection(merged.history, (item) => ({
      id: item.id ?? uid(),
      expenseId: item.expenseId ?? "",
      title: item.title ?? "Oppgjor",
      amount: Number(item.amount ?? 0),
      paidBy: item.paidBy ?? "",
      openedBy: item.openedBy ?? item.createdBy ?? "",
      closedBy: item.closedBy ?? "",
      closedAt: item.closedAt ?? item.createdAt ?? isoNow(),
      receiptName: item.receiptName ?? "",
    })),
  };
}

function normalizeHome(home) {
  if (!home) return null;
  return {
    ...home,
    photo: normalizeMedia(home.photo),
  };
}

function normalizeModules(modules) {
  return { ...DEFAULT_MODULES, ...(modules ?? {}) };
}

function normalizeNotificationSettings(settings) {
  return { ...DEFAULT_NOTIFICATIONS, ...(settings ?? {}) };
}

function normalizeMembers(members) {
  const list = normalizeCollection(members, (member) => typeof member === "string"
    ? { id: uid(), name: member, nickname: "", room: "", role: "member", username: "", password: "", joinedAt: isoNow() }
    : {
        id: member.id ?? uid(),
        name: member.name ?? "Beboer",
        nickname: member.nickname ?? "",
        room: member.room ?? "",
        role: member.role ?? "member",
        username: member.username ?? "",
        password: member.password ?? "",
        joinedAt: member.joinedAt ?? isoNow(),
      });

  return list.length ? list : structuredCloneSafe(demoData.members);
}

function normalizeCollection(value, mapItem) {
  return Array.isArray(value) ? value.map(mapItem).filter(Boolean) : [];
}

function normalizeReceipt(receipt) {
  return normalizeMedia(receipt, "Kvittering");
}

function normalizeMedia(media, fallbackName = "Fil") {
  if (!media?.dataUrl) return null;
  return {
    name: media.name || fallbackName,
    type: media.type || "application/octet-stream",
    dataUrl: media.dataUrl,
    addedAt: media.addedAt || isoNow(),
  };
}

function stringCleaningTask(task, members) {
  const [title, assignee] = task.split(" - ");
  return {
    id: uid(),
    title: title || "Oppgave",
    assignee: assignee || members[0]?.name || "Ikke tildelt",
    dueDate: todayPlus(7),
    done: false,
  };
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeJson(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function uid() {
  const random = globalThis.crypto?.randomUUID?.();
  return random ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isoNow() {
  return new Date().toISOString();
}

function todayPlus(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function saveState(message) {
  syncHomePricing();
  storageAdapter.saveAppState(state);
  saveCurrentCollectiveToRegistry();
  render();
  if (message) showToast(message);
}

function syncHomePricing() {
  if (!state.home || state.home.plan === "support_created") return;

  const memberCount = Math.max(state.members.length, 1);
  const amountNok = calculateMonthlyPrice(memberCount);
  state.home.priceNok = amountNok;
  state.home.basePriceNok = BASE_PRICE_NOK;
  state.home.memberPriceNok = MEMBER_PRICE_NOK;
  state.home.billableMembers = memberCount;
  state.home.billing = {
    ...(state.home.billing ?? {}),
    amountNok,
    basePriceNok: BASE_PRICE_NOK,
    memberPriceNok: MEMBER_PRICE_NOK,
    memberCount,
  };
}

function saveSession(nextSession) {
  session = nextSession;
  storageAdapter.saveSession(session);
}

function view(id) {
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo(0, 0);
}

function goLanding() {
  view("landing");
}

function handleCreateBack() {
  if (createMode === "support" && session.role === "superadmin") {
    openSuperadmin();
    return;
  }

  goLanding();
}

function showCreate() {
  createMode = "paid";
  renderCreateMode();
  $("createError").textContent = "";
  view("create");
}

function showOwnerCreate() {
  createMode = "support";
  renderCreateMode();
  $("createError").textContent = "";
  view("create");
}

function showJoin(inviteToken) {
  hydrateStateFromInvite(inviteToken);

  const isValidInvite = Boolean(state.home && state.home.inviteToken === inviteToken);
  const invitedName = getInviteNameFromUrl();
  $("joinIntro").textContent = isValidInvite
    ? `Du er invitert til ${state.home.name}. Skriv fornavnet ditt for å åpne dashboardet.`
    : "Denne invitasjonslinken er ugyldig eller finnes ikke på denne enheten.";
  if (invitedName) {
    $("memberName").value = invitedName;
    $("memberUsername").value = firstName(invitedName);
  }
  $("joinForm").querySelector("button").disabled = !isValidInvite;
  view("join");
}

function openDashboard(role = session.role) {
  if (!state.home) {
    showCreate();
    return;
  }

  const nextRole = role === "member" ? "member" : role === "support" ? "support" : "admin";
  saveSession({ ...session, role: nextRole });
  view("dashboard");
  render();
}

function openSuperadmin() {
  saveSession({ role: "superadmin", memberName: "Deltbo admin" });
  view("superadmin");
  renderSuperadmin();
}

function openModal(id) {
  $(id).classList.add("open");
}

function closeModal(id) {
  $(id).classList.remove("open");
}

function openLogin() {
  $("loginError").textContent = "";
  openModal("loginModal");
}

function openSuperLogin() {
  $("superLoginError").textContent = "";
  openModal("superLoginModal");
}

function closeSuperLogin() {
  closeModal("superLoginModal");
}

function closeLogin() {
  closeModal("loginModal");
}

function createHome(event) {
  event.preventDefault();

  const name = value("homeName");
  const address = value("homeAddress");
  const roomCount = Number(value("roomCount") || 1);
  const rentAmount = Number(value("rentAmount") || 0);
  const adminUser = value("adminUser");
  const adminPass = $("adminPass").value;
  const firstMembers = splitNames(value("firstMembers"));
  const isSupportCreate = createMode === "support" && session.role === "superadmin";
  const monthlyPrice = calculateMonthlyPrice(firstMembers.length + 1);
  const billing = isSupportCreate ? createSupportBilling() : collectBilling(monthlyPrice);

  if (!name || !adminUser || adminPass.length < 4) {
    $("createError").textContent = "Fyll inn navn på kollektivet, brukernavn og et passord på minst 4 tegn.";
    return;
  }

  if (roomCount < 1) {
    $("createError").textContent = "Dere må ha minst ett rom.";
    return;
  }

  if (firstMembers.length > Math.max(roomCount - 1, 0)) {
    $("createError").textContent = `${roomCount} rom betyr maks ${roomCount} personer totalt. Du bruker rom 1, så legg inn maks ${Math.max(roomCount - 1, 0)} andre.`;
    return;
  }

  if (!isSupportCreate) {
    const billingError = validateBilling(billing);
    if (billingError) {
      $("createError").textContent = billingError;
      return;
    }
  }

  const inviteToken = createInviteToken(name);
  const adminMember = { id: uid(), name: adminUser, nickname: "", room: "Rom 1", role: "admin", joinedAt: isoNow() };
  const members = [
    adminMember,
    ...firstMembers.map((memberName, index) => ({
      id: uid(),
      name: memberName,
      nickname: "",
      room: `Rom ${index + 2}`,
      role: "member",
      joinedAt: isoNow(),
    })),
  ];

  state = normalizeState({
    home: {
      id: uid(),
      name,
      address,
      roomCount,
      rentAmount,
      adminUser,
      adminPass,
      inviteToken,
      inviteUrl: "",
      priceNok: isSupportCreate ? 0 : monthlyPrice,
      basePriceNok: isSupportCreate ? 0 : BASE_PRICE_NOK,
      memberPriceNok: isSupportCreate ? 0 : MEMBER_PRICE_NOK,
      billableMembers: members.length,
      plan: isSupportCreate ? "support_created" : "monthly",
      billing,
      createdAt: isoNow(),
      createdBy: isSupportCreate ? "Deltbo admin" : "customer",
    },
    members,
    expenses: [],
    cleaning: [],
    shopping: [],
    messages: [],
    events: [],
    rules: [],
    inventory: [],
    contacts: [],
    conflicts: [],
    modules: DEFAULT_MODULES,
    notificationSettings: DEFAULT_NOTIFICATIONS,
    notifications: [],
    history: [],
  });
  state.home.inviteUrl = createInviteUrl(inviteToken);

  saveSession(isSupportCreate
    ? { role: "superadmin", memberName: "Deltbo admin" }
    : { role: "admin", memberName: adminUser });
  saveState("Kollektiv opprettet");
  $("inviteLink").value = state.home.inviteUrl;
  $("createdBox").classList.add("open");
  $("createError").textContent = isSupportCreate
    ? "Kollektivet er opprettet av Deltbo admin. Du kan gå tilbake til adminpanelet når du er ferdig."
    : "";
}

function superLogin(event) {
  event.preventDefault();

  const isValid = value("superUser").toLowerCase() === SUPER_ADMIN.username && $("superPass").value === SUPER_ADMIN.password;
  if (!isValid) {
    $("superLoginError").textContent = "Feil Deltbo admin-bruker eller passord.";
    return;
  }

  closeSuperLogin();
  openSuperadmin();
  showToast("Logget inn som Deltbo admin");
}

function collectBilling(amountNok = calculateMonthlyPrice(plannedMemberCount())) {
  const method = document.querySelector('input[name="paymentMethod"]:checked')?.value ?? "vipps";
  const billing = {
    method,
    status: "paid_before_create",
    amountNok,
    basePriceNok: BASE_PRICE_NOK,
    memberPriceNok: MEMBER_PRICE_NOK,
    memberCount: plannedMemberCount(),
    interval: "monthly",
    email: value("billingEmail"),
    phone: value("paymentPhone"),
    createdAt: isoNow(),
  };

  if (method === "card") {
    billing.card = {
      last4: digitsOnly(value("cardNumber")).slice(-4),
      expiry: value("cardExpiry"),
      brand: "Visa/Mastercard",
    };
  }

  billing.confirmed = $("paymentConfirmed")?.checked ?? false;
  return billing;
}

function createSupportBilling() {
  return {
    method: "support",
    status: "created_by_deltbo_admin",
    amountNok: 0,
    interval: "internal",
    email: "",
    phone: "",
    confirmed: true,
    createdAt: isoNow(),
  };
}

function validateBilling(billing) {
  if (!billing.confirmed) {
    return "Bekreft at betaling er godkjent før du oppretter kollektivet.";
  }

  if (!billing.email || !billing.email.includes("@")) {
    return "Legg inn en gyldig e-post for kvittering.";
  }

  if ((billing.method === "vipps" || billing.method === "apple_pay") && digitsOnly(billing.phone).length < 8) {
    return "Legg inn telefonnummer for valgt betalingsmetode.";
  }

  if (billing.method === "card") {
    if (digitsOnly(value("cardNumber")).length < 12) return "Legg inn et gyldig kortnummer.";
    if (!/^\d{2}\/\d{2}$/.test(value("cardExpiry"))) return "Legg inn utløpsdato som MM/ÅÅ.";
  }

  return "";
}

function renderPaymentFields() {
  const method = document.querySelector('input[name="paymentMethod"]:checked')?.value ?? "vipps";
  document.querySelectorAll("[data-payment-field]").forEach((field) => {
    const type = field.dataset.paymentField;
    const shouldShow = type === "email" || type === "card" && method === "card" || type === "phone" && method !== "card";
    field.classList.toggle("hidden", !shouldShow);
  });
}

function renderCreateMode() {
  const isSupportCreate = createMode === "support" && session.role === "superadmin";

  $("createPricePill").textContent = isSupportCreate ? "Deltbo admin" : priceLabel(plannedMemberCount());
  $("createTitle").textContent = isSupportCreate ? "Opprett kollektiv som support" : "Start kollektiv";
  $("createIntro").textContent = isSupportCreate
    ? "Du oppretter et kollektiv fra Deltbo-adminpanelet. Admin bruker fortsatt rom 1."
    : "Du blir admin, tar ett rom og inviterer resten med link.";
  $("paymentPanel").classList.toggle("hidden", isSupportCreate);
  $("createSubmit").textContent = isSupportCreate ? "Opprett fra support" : "Start kollektivet";
  $("createBackButton").textContent = isSupportCreate ? "Til adminpanel" : "Tilbake";
  renderCreatePrice();
}

function renderCreatePrice() {
  const memberCount = plannedMemberCount();
  const label = priceLabel(memberCount);
  if ($("createPricePill") && createMode !== "support") $("createPricePill").textContent = label;
  document.querySelectorAll("[data-price-label]").forEach((element) => {
    element.textContent = label;
  });
  document.querySelectorAll("[data-member-count-label]").forEach((element) => {
    element.textContent = String(memberCount);
  });
}

function plannedMemberCount() {
  return Math.max(splitNames(value("firstMembers")).length + 1, 1);
}

function calculateMonthlyPrice(memberCount) {
  return BASE_PRICE_NOK + MEMBER_PRICE_NOK * Math.max(Number(memberCount) || 1, 1);
}

function priceLabel(memberCount) {
  return `${calculateMonthlyPrice(memberCount)} kr/mnd`;
}

function startDemoLoop() {
  renderDemoScene();
  clearInterval(demoTimer);
  demoTimer = setInterval(() => {
    demoSceneIndex = (demoSceneIndex + 1) % demoScenes.length;
    renderDemoScene();
  }, 3000);
}

function renderDemoScene() {
  if (!$("demoSceneTitle")) return;

  const [title, text] = demoScenes[demoSceneIndex];
  $("demoSceneTitle").textContent = title;
  $("demoSceneText").textContent = text;
}

function toggleDemo() {
  const player = $("demoPlayer");
  const isPaused = player.classList.toggle("paused");
  $("demoToggle").textContent = isPaused ? "Spill demo" : "Pause demo";

  if (isPaused) {
    clearInterval(demoTimer);
  } else {
    startDemoLoop();
  }
}

function restartDemo() {
  demoSceneIndex = 0;
  $("demoPlayer").classList.remove("paused");
  $("demoToggle").textContent = "Pause demo";
  startDemoLoop();
  const progress = $("demoProgress");
  progress.style.animation = "none";
  progress.offsetHeight;
  progress.style.animation = "";
}

function createInviteToken(name) {
  const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return `${slug || "kollektiv"}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInviteUrl(inviteToken, memberName = "") {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("invite", inviteToken);
  const payload = createInvitePayload(memberName);
  if (memberName) url.searchParams.set("member", memberName);
  if (payload) url.searchParams.set("data", payload);
  return url.toString();
}

function createInvitePayload(memberName = "") {
  if (!state.home) return "";

  const payload = {
    home: {
      id: state.home.id,
      name: state.home.name,
      address: state.home.address,
      roomCount: state.home.roomCount,
      rentAmount: state.home.rentAmount,
      inviteToken: state.home.inviteToken,
      adminUser: state.home.adminUser || "Admin",
    },
    members: state.members.map((member) => ({
      name: member.name,
      nickname: member.nickname,
      room: member.room,
      role: member.role,
    })),
    memberName,
  };

  return encodeInvitePayload(payload);
}

function encodeInvitePayload(payload) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  } catch {
    return "";
  }
}

function decodeInvitePayload(valueToDecode) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(valueToDecode))));
  } catch {
    return null;
  }
}

function hydrateStateFromInvite(inviteToken) {
  if (state.home?.inviteToken === inviteToken) return;

  const payload = decodeInvitePayload(new URLSearchParams(window.location.search).get("data") || "");
  if (!payload?.home || payload.home.inviteToken !== inviteToken) return;
  const inviteMembers = Array.isArray(payload.members) && payload.members.length
    ? payload.members
    : [{ id: uid(), name: payload.home.adminUser || "Admin", room: "Rom 1", role: "admin", joinedAt: isoNow() }];
  const invitePrice = calculateMonthlyPrice(inviteMembers.length);

  state = normalizeState({
    ...demoData,
    home: {
      id: payload.home.id || uid(),
      name: payload.home.name || "Kollektiv",
      address: payload.home.address || "",
      roomCount: Number(payload.home.roomCount || 1),
      rentAmount: Number(payload.home.rentAmount || 0),
      adminUser: payload.home.adminUser || "Admin",
      adminPass: "",
      inviteToken,
      inviteUrl: window.location.href,
      priceNok: invitePrice,
      basePriceNok: BASE_PRICE_NOK,
      memberPriceNok: MEMBER_PRICE_NOK,
      billableMembers: inviteMembers.length,
      plan: "member_invite",
      billing: { method: "member_invite", status: "member_access", amountNok: invitePrice },
      createdAt: isoNow(),
      createdBy: "invite",
    },
    members: inviteMembers,
  });
  storageAdapter.saveAppState(state);
}

function joinHome(event) {
  event.preventDefault();

  if (!state.home) {
    $("joinError").textContent = "Kollektivet finnes ikke lokalt enda.";
    return;
  }

  const memberName = value("memberName");
  const nickname = value("memberNickname");
  const room = value("memberRoom");
  const username = value("memberUsername").toLowerCase();
  const password = $("memberPassword").value;
  if (!memberName) {
    $("joinError").textContent = "Skriv inn navnet ditt for å bli med.";
    return;
  }

  if (!username || password.length < 4) {
    $("joinError").textContent = "Lag brukernavn og passord på minst 4 tegn.";
    return;
  }

  const invitedNameFromUrl = getInviteNameFromUrl();
  if (invitedNameFromUrl && firstName(invitedNameFromUrl) !== firstName(memberName)) {
    $("joinError").textContent = `Denne linken er laget for ${invitedNameFromUrl}. Skriv inn det fornavnet for å komme inn.`;
    return;
  }

  const invitedMember = findMemberByFirstName(memberName);
  if (isUsernameTaken(username, invitedMember?.id)) {
    $("joinError").textContent = "Brukernavnet er allerede i bruk i dette kollektivet.";
    return;
  }

  if (!invitedMember && state.members.some((member) => member.role !== "admin")) {
    $("joinError").textContent = "Du må skrive samme fornavn som admin inviterte.";
    return;
  }

  const result = invitedMember
    ? upsertMember(invitedMember.name, room || invitedMember.room)
    : upsertMember(memberName, room);
  if (!result.ok) {
    $("joinError").textContent = result.message;
    return;
  }

  const accountName = invitedMember?.name || memberName;
  setMemberCredentials(accountName, username, password);
  updateMemberNickname(accountName, nickname);
  saveSession({ role: "member", memberName: accountName, username });
  saveState("Bruker lagret. Velkommen inn");
  openDashboard("member");
}

function login(event) {
  event.preventDefault();

  if (value("loginUser").toLowerCase() === SUPER_ADMIN.username && $("loginPass").value === SUPER_ADMIN.password) {
    closeLogin();
    openSuperadmin();
    showToast("Logget inn som Deltbo admin");
    return;
  }

  if (!state.home) {
    $("loginError").textContent = "Ingen kollektiv er opprettet enda.";
    return;
  }

  const isValidAdmin = value("loginUser") === state.home.adminUser && $("loginPass").value === state.home.adminPass;
  if (isValidAdmin) {
    saveSession({ role: "admin", memberName: state.home.adminUser, username: state.home.adminUser });
    closeLogin();
    openDashboard("admin");
    showToast("Logget inn som admin");
    return;
  }

  const member = state.members.find((item) => item.username?.toLowerCase() === value("loginUser").toLowerCase() && item.password === $("loginPass").value);
  if (!member) {
    $("loginError").textContent = "Feil brukernavn eller passord.";
    return;
  }

  saveSession({ role: "member", memberName: member.name, username: member.username });
  closeLogin();
  openDashboard("member");
  showToast("Logget inn som medlem");
}

function logout() {
  saveSession({ role: null, memberName: null });
  goLanding();
  showToast("Du er logget ut");
}

async function copyInvite() {
  if (!state.home?.inviteUrl) {
    showToast("Opprett et kollektiv først");
    return;
  }

  try {
    state.home.inviteUrl = createInviteUrl(state.home.inviteToken);
    saveCurrentCollectiveToRegistry();
    await navigator.clipboard?.writeText(state.home.inviteUrl);
    showToast("Invitasjonslink kopiert");
  } catch {
    $("inviteLink").value = state.home.inviteUrl;
    $("inviteLink").select();
    showToast("Kopier linken fra feltet");
  }
}

async function copyMemberInvite(id) {
  const member = state.members.find((item) => item.id === id);
  if (!member || member.role === "admin") return;

  const inviteUrl = createInviteUrl(state.home.inviteToken, member.name);
  try {
    await navigator.clipboard?.writeText(inviteUrl);
    showToast(`Invitasjon til ${member.name} er kopiert`);
  } catch {
    $("inviteLink").value = inviteUrl;
    $("inviteLink").select();
    showToast("Kopier invitasjonen fra feltet");
  }
}

function submitPublicContact(event) {
  event.preventDefault();

  const name = value("publicContactName");
  const email = value("publicContactEmail");
  const topic = value("publicContactTopic");
  const message = value("publicContactMessage");

  if (!name || !email.includes("@") || message.length < 8) {
    showToast("Fyll inn navn, gyldig e-post og en kort melding");
    return;
  }

  const ai = analyzeContactRequest(topic, message);
  const requests = getContactRequests();
  requests.unshift({
    id: uid(),
    name,
    email,
    topic,
    message,
    ai,
    status: "open",
    createdAt: isoNow(),
  });
  storageAdapter.saveContactRequests(requests);

  clearFields("publicContactName", "publicContactEmail", "publicContactMessage");
  $("contactAiPreview").classList.add("hidden");
  renderSuperadmin();
  showToast("Meldingen er sendt til Deltbo admin");
}

function renderContactAiPreview() {
  const message = value("publicContactMessage");
  const box = $("contactAiPreview");
  if (message.length < 8) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  const ai = analyzeContactRequest(value("publicContactTopic"), message);
  box.classList.remove("hidden");
  box.innerHTML = `<b>KI-forslag</b><span>${escapeHtml(ai.summary)}</span><small>Kategori: ${escapeHtml(ai.category)} • Prioritet: ${escapeHtml(ai.priority)}</small>`;
}

function analyzeContactRequest(topic, message) {
  const text = `${topic} ${message}`.toLowerCase();
  let category = "Support";
  let priority = "Normal";

  if (text.includes("betalt") || text.includes("betaling") || text.includes("kort") || text.includes("vipps")) category = "Betaling";
  if (text.includes("logg") || text.includes("passord") || text.includes("tilgang") || text.includes("invitasjon")) category = "Tilgang";
  if (text.includes("feil") || text.includes("bug") || text.includes("virker ikke") || text.includes("problem")) category = "Feil";
  if (text.includes("ønske") || text.includes("funksjon") || text.includes("kan dere")) category = "Funksjonsønske";
  if (text.includes("haster") || text.includes("kritisk") || text.includes("låst") || text.includes("kommer ikke inn")) priority = "Høy";

  const summary = message.length > 110 ? `${message.slice(0, 110).trim()}...` : message;
  return { category, priority, summary };
}

function getContactRequests() {
  return storageAdapter.loadContactRequests() ?? [];
}

function saveContactRequests(requests) {
  storageAdapter.saveContactRequests(requests);
  renderSuperadmin();
}

function resolveContactRequest(id) {
  const requests = getContactRequests().map((request) => request.id === id ? { ...request, status: "resolved" } : request);
  saveContactRequests(requests);
  showToast("Henvendelsen er markert som løst");
}

function deleteContactRequest(id) {
  const requests = getContactRequests().filter((request) => request.id !== id);
  saveContactRequests(requests);
  showToast("Henvendelsen er slettet");
}

function addMember(event) {
  event.preventDefault();
  const name = value("memberManualName");
  if (!name) return;

  const result = upsertMember(name, value("memberManualRoom"), value("memberManualNickname"));
  if (!result.ok) {
    showToast(result.message);
    return;
  }

  clearFields("memberManualName", "memberManualNickname", "memberManualRoom");
  saveState("Beboer lagt til");
}

function upsertMember(name, room = "", nickname = "") {
  const existing = state.members.find((member) => member.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.nickname = nickname || existing.nickname || "";
    existing.room = room || existing.room;
    existing.joinedAt = existing.joinedAt || isoNow();
    return { ok: true };
  }

  const capacity = Number(state.home?.roomCount || state.members.length + 1);
  if (state.members.length >= capacity) {
    return { ok: false, message: `Kollektivet har ${capacity} rom totalt. Fjern et medlem eller øk antall rom først.` };
  }

  state.members.push({ id: uid(), name, nickname, room: room || nextRoomLabel(), role: "member", joinedAt: isoNow() });
  return { ok: true };
}

function setMemberCredentials(name, username, password) {
  const member = state.members.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!member) return;

  member.username = username;
  member.password = password;
  member.accountCreatedAt = member.accountCreatedAt || isoNow();
}

function updateMemberNickname(name, nickname) {
  const member = state.members.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!member || !nickname) return;

  member.nickname = nickname;
}

function isUsernameTaken(username, allowedMemberId = "") {
  const normalized = username.toLowerCase();
  return state.members.some((member) => member.username?.toLowerCase() === normalized && member.id !== allowedMemberId)
    || state.home?.adminUser?.toLowerCase() === normalized
    || SUPER_ADMIN.username === normalized;
}

function findMemberByFirstName(name) {
  const target = firstName(name);
  return state.members.find((member) => member.role !== "admin" && firstName(member.name) === target);
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0].toLowerCase();
}

function nextRoomLabel() {
  const used = new Set(state.members.map((member) => roomNumber(member.room)).filter(Boolean));
  const capacity = Number(state.home?.roomCount || state.members.length + 1);
  for (let number = 1; number <= capacity; number += 1) {
    if (!used.has(number)) return `Rom ${number}`;
  }
  return "";
}

function roomNumber(room) {
  const match = String(room || "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function addExpense(event) {
  event.preventDefault();
  const title = value("expenseTitle");
  const amount = Number(value("expenseAmount"));
  if (!title || amount <= 0) return;
  const receipt = await receiptFromFileInput("expenseReceipt");

  state.expenses.unshift({
    id: uid(),
    title,
    amount,
    paidBy: value("expensePaidBy") || currentUserName(),
    createdBy: currentUserName(),
    settled: false,
    receipt,
    createdAt: isoNow(),
  });
  addNotification("expenses", isImportantExpense(title) ? "important" : "normal", "Nytt utlegg", `${currentUserName()} la inn ${title} på ${amount} kr.`);
  clearFields("expenseTitle", "expenseAmount", "expenseReceipt");
  saveState("Utlegg lagt til");
}

function addCleaningTask(event) {
  event.preventDefault();
  const title = value("cleanTitle");
  if (!title) return;

  state.cleaning.push({
    id: uid(),
    title,
    assignee: value("cleanAssignee") || currentUserName(),
    dueDate: value("cleanDue") || todayPlus(7),
    done: false,
  });
  addNotification("cleaning", "normal", "Ny oppgave", `${title} er lagt til i rengjøring/oppgaver.`);
  clearFields("cleanTitle", "cleanDue");
  saveState("Oppgave lagt til");
}

async function addShoppingItem(event) {
  event.preventDefault();
  const item = value("shopItem");
  if (!item) return;
  const receipt = await receiptFromFileInput("shopReceipt");

  state.shopping.push({ id: uid(), item, quantity: value("shopQuantity"), done: false, receipt });
  addNotification("shopping", "low", "Handleliste", `${item} er lagt til på handlelisten.`);
  clearFields("shopItem", "shopQuantity", "shopReceipt");
  saveState("Lagt på handlelista");
}

function receiptFromFileInput(id) {
  return mediaFromFileInput(id, {
    fallbackName: "Kvittering",
    maxSize: 900_000,
    tooLargeMessage: "Kvitteringen er for stor. Bruk et mindre bilde eller PDF under 900 KB.",
    readErrorMessage: "Kunne ikke lese kvitteringen",
  });
}

function mediaFromFileInput(id, options = {}) {
  const file = $(id)?.files?.[0];
  if (!file) return Promise.resolve(null);

  const maxSize = options.maxSize ?? 1_200_000;
  if (file.size > maxSize) {
    showToast(options.tooLargeMessage ?? "Filen er for stor. Bruk et bilde under 1,2 MB.");
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name || options.fallbackName || "Fil",
      type: file.type,
      dataUrl: reader.result,
      addedAt: isoNow(),
    });
    reader.onerror = () => {
      showToast(options.readErrorMessage ?? "Kunne ikke lese filen");
      resolve(null);
    };
    reader.readAsDataURL(file);
  });
}

function addMessage() {
  const text = value("messageText");
  if (!text) return;

  state.messages.unshift({ id: uid(), text, author: currentDisplayName(), remindAt: value("messageReminder"), createdAt: isoNow() });
  addNotification("messages", "normal", "Ny beskjed", text);
  clearFields("messageText", "messageReminder");
  saveState("Beskjed sendt");
}

function addEvent(event) {
  event.preventDefault();
  const title = value("eventTitle");
  if (!title) return;

  state.events.push({ id: uid(), title, date: value("eventDate") || todayPlus(7) });
  addNotification(isImportantExpense(title) ? "rent" : "messages", isImportantExpense(title) ? "important" : "normal", "Kalender", `${title} er lagt til i kalenderen.`);
  clearFields("eventTitle", "eventDate");
  saveState("Hendelse lagt til");
}

function downloadMessageCalendar(id) {
  const message = state.messages.find((item) => item.id === id);
  if (!message) return;

  const start = message.remindAt ? new Date(message.remindAt) : defaultMessageReminderDate(message.createdAt);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Deltbo//Important Message//NO",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${message.id}@deltbo.local`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(message.text)}`,
    "END:VALARM",
    `SUMMARY:${icsEscape(`Deltbo: ${message.text.slice(0, 52)}`)}`,
    `DESCRIPTION:${icsEscape(`${message.text}\\n\\nFra ${message.author || "Deltbo"}.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${slugify(message.text || "deltbo-beskjed")}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  showToast("Kalenderfil laget");
}

function defaultMessageReminderDate(createdAt) {
  const date = new Date(createdAt || Date.now());
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function icsDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsEscape(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function addRule(event) {
  event.preventDefault();
  const text = value("ruleText");
  if (!text) return;

  state.rules.push({ id: uid(), text });
  clearFields("ruleText");
  saveState("Regel lagt til");
}

function addInventory(event) {
  event.preventDefault();
  const name = value("inventoryName");
  if (!name) return;

  state.inventory.push({ id: uid(), name, owner: value("inventoryOwner"), status: "OK" });
  clearFields("inventoryName", "inventoryOwner");
  saveState("Ting lagt til");
}

function addContact(event) {
  event.preventDefault();
  const name = value("contactName");
  if (!name) return;

  state.contacts.push({ id: uid(), name, value: value("contactValue") });
  clearFields("contactName", "contactValue");
  saveState("Kontakt lagt til");
}

function addConflict(event) {
  event.preventDefault();
  const text = value("conflictText");
  if (!text) return;

  state.conflicts.unshift({ id: uid(), text, resolved: false, createdAt: isoNow() });
  addNotification("conflict", "important", "Ny sak", "Noen har tatt opp noe anonymt i kollektivet.");
  clearFields("conflictText");
  saveState("Anonym sak sendt");
}

async function saveSettings(event) {
  event.preventDefault();

  const currentMember = getCurrentMember();
  if (currentMember) currentMember.nickname = value("settingsNickname");
  if (session.role !== "admin" && session.role !== "support") {
    saveState("Kallenavn lagret");
    return;
  }

  const uploadedPhoto = await mediaFromFileInput("settingsHomePhoto", {
    fallbackName: "Kollektivbilde",
    maxSize: 1_200_000,
    tooLargeMessage: "Bildet er for stort. Bruk et bilde under 1,2 MB.",
    readErrorMessage: "Kunne ikke lese bildet",
  });
  state.home = {
    ...state.home,
    name: value("settingsName"),
    address: value("settingsAddress"),
    rentAmount: Number(value("settingsRent") || 0),
    roomCount: Number(value("settingsRooms") || 1),
    photo: uploadedPhoto || state.home.photo || null,
  };
  state.modules = readModuleSettings();
  state.notificationSettings = readNotificationSettings();
  if (uploadedPhoto) clearFields("settingsHomePhoto");
  saveState("Innstillinger lagret");
}

function quickAdd(event) {
  event.preventDefault();
  const type = value("quickType");
  const text = value("quickText");
  if (!text) return;

  if (type === "shopping") {
    state.shopping.push({ id: uid(), item: text, quantity: "", done: false, receipt: null });
    addNotification("shopping", "low", "Handleliste", `${text} er lagt til på handlelisten.`);
  }
  if (type === "message") {
    state.messages.unshift({ id: uid(), text, author: currentUserName(), createdAt: isoNow() });
    addNotification("messages", "normal", "Ny beskjed", text);
  }
  if (type === "expense") {
    const amount = Number(value("quickAmount") || 0);
    if (amount <= 0) {
      showToast("Legg inn beløp for utlegget");
      return;
    }
    state.expenses.unshift({ id: uid(), title: text, amount, paidBy: currentUserName(), createdBy: currentUserName(), settled: false, receipt: null, createdAt: isoNow() });
    addNotification("expenses", isImportantExpense(text) ? "important" : "normal", "Nytt utlegg", `${currentUserName()} la inn ${text} på ${amount} kr.`);
  }
  if (type === "task") {
    state.cleaning.push({ id: uid(), title: text, assignee: currentUserName(), dueDate: todayPlus(7), done: false });
    addNotification("cleaning", "normal", "Ny oppgave", `${text} er lagt til i rengjøring/oppgaver.`);
  }

  clearFields("quickText", "quickAmount");
  closeModal("quickAdd");
  saveState("Lagt til");
}

function updateById(collection, id, update) {
  state[collection] = state[collection].map((item) => item.id === id ? update(item) : item);
  saveState("Oppdatert");
}

function toggleExpense(id) {
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense) return;

  if (expense.createdBy !== currentUserName()) {
    showToast(`Kun ${expense.createdBy} kan ${expense.settled ? "åpne" : "lukke"} dette beløpet`);
    return;
  }

  const closedAt = expense.settled ? "" : archiveExpense(expense);

  updateById("expenses", id, (item) => ({
    ...item,
    settled: !item.settled,
    settledAt: item.settled ? "" : closedAt,
    settledBy: item.settled ? "" : currentUserName(),
  }));
}

function deleteExpense(id) {
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense) return;

  if (expense.createdBy !== currentUserName()) {
    showToast(`Kun ${expense.createdBy} kan slette dette beløpet`);
    return;
  }

  removeById("expenses", id, "Utlegg fjernet");
}

function archiveExpense(expense) {
  const closedAt = isoNow();
  state.history.unshift({
    id: uid(),
    expenseId: expense.id,
    title: expense.title,
    amount: Number(expense.amount || 0),
    paidBy: expense.paidBy,
    openedBy: expense.createdBy,
    closedBy: currentUserName(),
    closedAt,
    receiptName: expense.receipt?.name ?? "",
  });
  addNotification("expenses", "important", "Oppgjør lukket", `${expense.title} ble lukket av ${currentUserName()} og ligger i historikken.`);
  return closedAt;
}

function markNotificationRead(id) {
  state.notifications = state.notifications.map((item) => item.id === id ? { ...item, read: true } : item);
  saveState("Varsel markert som lest");
}

function clearReadNotifications() {
  state.notifications = state.notifications.filter((item) => !item.read || ALWAYS_ON_NOTIFICATIONS.includes(item.type));
  saveState("Leste varsler ryddet");
}

function removeById(collection, id, message) {
  state[collection] = state[collection].filter((item) => item.id !== id);
  saveState(message);
}

function addNotification(type, priority, title, text) {
  const required = ALWAYS_ON_NOTIFICATIONS.includes(type) || priority === "critical";
  if (!required && !state.notificationSettings?.[type]) return;

  state.notifications.unshift({
    id: uid(),
    type,
    priority,
    title,
    text,
    createdAt: isoNow(),
    read: false,
  });
  state.notifications = state.notifications.slice(0, 60);
}

function isImportantExpense(text) {
  return /husleie|leie|strøm|strom|krise|brann|alarm|depositum/i.test(text);
}

function readModuleSettings() {
  return Object.fromEntries(Object.keys(DEFAULT_MODULES).map((moduleName) => {
    const input = document.querySelector(`[data-module-setting="${moduleName}"]`);
    return [moduleName, input ? input.checked : true];
  }));
}

function readNotificationSettings() {
  return Object.fromEntries(Object.keys(DEFAULT_NOTIFICATIONS).map((type) => {
    const input = document.querySelector(`[data-notification-setting="${type}"]`);
    return [type, input ? input.checked : DEFAULT_NOTIFICATIONS[type]];
  }));
}

function getCollectives() {
  const collectives = storageAdapter.loadCollectives() ?? {};
  if (state.home?.id) {
    collectives[state.home.id] = structuredCloneSafe(state);
    storageAdapter.saveCollectives(collectives);
  }
  return collectives;
}

function saveCurrentCollectiveToRegistry() {
  if (!state.home?.id) return;

  const collectives = storageAdapter.loadCollectives() ?? {};
  collectives[state.home.id] = structuredCloneSafe(state);
  storageAdapter.saveCollectives(collectives);
}

function openCollectiveAsSupport(id) {
  const collective = getCollectives()[id];
  if (!collective) {
    showToast("Fant ikke kollektivet");
    return;
  }

  state = normalizeState(collective);
  storageAdapter.saveAppState(state);
  saveSession({ role: "support", memberName: "Deltbo admin", supportCollectiveId: id });
  openDashboard("support");
  showToast(`Åpnet ${state.home.name} som support`);
}

function cleanCollectiveIssues(id) {
  const collectives = getCollectives();
  const collective = collectives[id];
  if (!collective) {
    showToast("Fant ikke kollektivet");
    return;
  }

  const cleaned = normalizeState(collective);
  cleaned.expenses.filter((item) => !item.settled).forEach((expense) => {
    cleaned.history.unshift({
      id: uid(),
      expenseId: expense.id,
      title: expense.title,
      amount: Number(expense.amount || 0),
      paidBy: expense.paidBy,
      openedBy: expense.createdBy,
      closedBy: "Deltbo support",
      closedAt: isoNow(),
      receiptName: expense.receipt?.name ?? "",
    });
  });
  cleaned.conflicts = cleaned.conflicts.map((item) => ({ ...item, resolved: true }));
  cleaned.shopping = cleaned.shopping.filter((item) => !item.done);
  cleaned.cleaning = cleaned.cleaning.filter((item) => !item.done);
  cleaned.expenses = cleaned.expenses.map((item) => ({ ...item, settled: true, settledAt: item.settledAt || isoNow(), settledBy: item.settledBy || "Deltbo support" }));
  collectives[id] = cleaned;
  storageAdapter.saveCollectives(collectives);

  if (state.home?.id === id) {
    state = cleaned;
    storageAdapter.saveAppState(state);
    render();
  }

  renderSuperadmin();
  showToast("Kollektivet er ryddet");
}

function deleteCollective(id) {
  const collectives = getCollectives();
  const name = collectives[id]?.home?.name ?? "kollektiv";
  delete collectives[id];
  storageAdapter.saveCollectives(collectives);

  if (state.home?.id === id) {
    state = normalizeState(null);
    storageAdapter.saveAppState(state);
  }

  renderSuperadmin();
  showToast(`${name} er slettet fra demo-registeret`);
}

function render() {
  renderShell();
  renderStats();
  renderSelects();
  renderHome();
  renderMembers();
  renderExpenses();
  renderCleaning();
  renderShopping();
  renderMessages();
  renderEvents();
  renderRules();
  renderInventory();
  renderContacts();
  renderConflicts();
  renderHistory();
  renderSettings();
  renderNotificationCenter();
  if ($("superCollectiveList")) renderSuperadmin();
}

function renderShell() {
  if (!state.home) return;

  const currentMember = getCurrentMember();
  const isSupportView = session.role === "support";
  const profileName = isSupportView ? "Deltbo support" : memberDisplayName(currentMember) || currentUserName();
  const profileRoom = isSupportView ? "Supportvisning" : currentMember?.room || "Kollektiv";
  $("dashName").textContent = state.home.name;
  $("sideName").textContent = state.home.name;
  $("inviteLink").value = state.home.inviteUrl;
  $("profileInitials").textContent = initials(profileName);
  $("profileName").textContent = profileName;
  $("profileRoom").textContent = profileRoom;
  $("accountRole").textContent = session.role === "member"
    ? `Medlem: ${session.memberName}`
    : session.role === "support"
      ? "Deltbo support"
      : "Admin-konto";
  $("dashRole").textContent = session.role === "member"
    ? "Medlemsvisning"
    : session.role === "support"
      ? "Supportvisning"
      : `Admin • ${state.home.priceNok ?? calculateMonthlyPrice(state.members.length)} kr/mnd`;
  $("inviteButton").classList.toggle("hidden", session.role !== "admin" && session.role !== "support");
  $("settingsForm").querySelector("button").disabled = false;
  updateThemeToggle();
  renderModuleVisibility();
}

function toggleTheme() {
  applyTheme(activeTheme === "dark" ? "light" : "dark");
  showToast(activeTheme === "dark" ? "Mørk modus aktivert" : "Lys modus aktivert");
}

function applyTheme(theme) {
  activeTheme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = activeTheme;
  localStorage.setItem(THEME_KEY, activeTheme);
  updateThemeToggle();
}

function updateThemeToggle() {
  if (!$("themeToggle")) return;

  $("themeToggle").textContent = activeTheme === "dark" ? "Lys modus" : "Mørk modus";
}

function renderStats() {
  const total = state.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const receiptCount = [...state.expenses, ...state.shopping].filter((item) => item.receipt).length;
  const nextTask = state.cleaning.find((task) => !task.done);
  const memberCount = Math.max(state.members.length, 1);

  $("totalExpenses").textContent = `${total} kr`;
  $("yourShare").textContent = `${Math.round(total / memberCount)} kr`;
  $("nextClean").textContent = nextTask ? nextTask.title : "Ingen";
  $("receiptCount").textContent = String(receiptCount);
}

function renderSelects() {
  const options = state.members.map((member) => `<option value="${escapeHtml(member.name)}">${escapeHtml(member.name)}</option>`).join("");
  $("expensePaidBy").innerHTML = options;
  $("cleanAssignee").innerHTML = options;
}

function renderHome() {
  const rent = Number(state.home?.rentAmount || 0);
  const rentShare = rent ? `${Math.round(rent / Math.max(state.members.length, 1))} kr per person` : "Ikke satt opp";
  const nextEvent = [...state.events].sort((a, b) => a.date.localeCompare(b.date))[0];
  const openCases = state.conflicts.filter((item) => !item.resolved).length;
  const rooms = Number(state.home?.roomCount || state.members.length);
  const openShopping = state.shopping.filter((item) => !item.done).length;
  const items = [
    homePhotoCard(),
    rowInfo("Rom", `${state.members.length} av ${rooms} rom er fylt`),
    rowInfo("Leie", rentShare),
    state.modules.shopping ? rowInfo("Handleliste", `${openShopping} varer mangler`) : "",
    state.modules.calendar ? rowInfo("Neste kalenderpunkt", nextEvent ? `${nextEvent.title} • ${formatDate(nextEvent.date)}` : "Ingen hendelser") : "",
    state.modules.conflict ? rowInfo("Åpne saker", `${openCases} saker`) : "",
  ].filter(Boolean);
  $("todayList").innerHTML = items.join("");
}

function renderMembers() {
  $("memberList").innerHTML = state.members.map((member) => memberCard(member)).join("");
}

function renderExpenses() {
  $("expenseList").innerHTML = emptyOrRows(state.expenses, (expense) => row({
    title: `${expense.title} • ${expense.amount} kr`,
    meta: `Betalt av ${expense.paidBy} • åpnet av ${expense.createdBy} • ${expense.settled ? "lukket" : "venter"} • ${expense.receipt ? `kvittering: ${expense.receipt.name}` : "ingen kvittering"}`,
    actions: `${receiptLink(expense.receipt)}${expense.createdBy === currentUserName() ? `${button("toggle-expense", expense.id, expense.settled ? "Åpne igjen" : "Lukk beløp", "secondary")}${button("delete-expense", expense.id, "Slett", "danger")}` : badge(`Lukkes av ${expense.createdBy}`)}`,
  }), "Ingen utlegg enda.");
}

function renderCleaning() {
  const sorted = [...state.cleaning].sort((a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate));
  $("cleanList").innerHTML = emptyOrRows(sorted, (task) => row({
    title: task.title,
    meta: `${task.assignee} • frist ${formatDate(task.dueDate)} • ${task.done ? "ferdig" : "aktiv"}`,
    actions: `${button("done-clean", task.id, task.done ? "Angre" : "Ferdig", "secondary")}${button("delete-clean", task.id, "Slett", "danger")}`,
  }), "Ingen oppgaver enda.");
}

function renderShopping() {
  $("shopList").innerHTML = emptyOrRows(state.shopping, (item) => row({
    title: item.item,
    meta: `${item.quantity || "Ingen mengde"} • ${item.done ? "kjøpt" : "mangler"} • ${item.receipt ? `kvittering: ${item.receipt.name}` : "ingen kvittering"}`,
    actions: `${receiptLink(item.receipt)}${button("toggle-shop", item.id, item.done ? "Angre" : "Kjøpt", "secondary")}${button("delete-shop", item.id, "Slett", "danger")}`,
  }), "Handlelisten er tom.");
}

function renderMessages() {
  $("messageList").innerHTML = emptyOrRows(state.messages, (message) => row({
    title: message.text,
    meta: `${message.author} • ${formatDateTime(message.createdAt)}${message.remindAt ? ` • kalender: ${formatDateTime(message.remindAt)}` : ""}`,
    actions: `${button("download-message-calendar", message.id, "Legg i kalender", "secondary")}${button("delete-message", message.id, "Slett", "danger")}`,
  }), "Ingen beskjeder enda.");
}

function renderEvents() {
  const sorted = [...state.events].sort((a, b) => a.date.localeCompare(b.date));
  $("eventList").innerHTML = emptyOrRows(sorted, (event) => {
    const date = new Date(`${event.date}T12:00:00`);
    const day = new Intl.DateTimeFormat("no-NO", { day: "2-digit" }).format(date);
    const month = new Intl.DateTimeFormat("no-NO", { month: "short" }).format(date);
    return row({
      title: `${day}. ${month} • ${event.title}`,
      meta: daysUntil(event.date),
      actions: button("delete-event", event.id, "Slett", "danger"),
    }).replace('class="row"', 'class="row calendar-row"');
  }, "Ingen hendelser enda.");
}

function renderRules() {
  $("ruleList").innerHTML = emptyOrRows(state.rules, (rule) => row({
    title: rule.text,
    meta: "Husregel",
    actions: button("delete-rule", rule.id, "Slett", "danger"),
  }), "Ingen husregler enda.");
}

function renderInventory() {
  $("inventoryList").innerHTML = emptyOrRows(state.inventory, (item) => row({
    title: item.name,
    meta: `${item.owner || "Felles"} • ${item.status}`,
    actions: button("delete-inventory", item.id, "Slett", "danger"),
  }), "Ingen felles ting registrert.");
}

function renderContacts() {
  $("contactList").innerHTML = emptyOrRows(state.contacts, (contact) => row({
    title: contact.name,
    meta: contact.value || "Mangler kontaktinfo",
    actions: button("delete-contact", contact.id, "Slett", "danger"),
  }), "Ingen kontakter registrert.");
}

function renderConflicts() {
  $("conflictList").innerHTML = emptyOrRows(state.conflicts, (conflict) => row({
    title: conflict.text,
    meta: `${conflict.resolved ? "løst" : "åpen"} • anonym • ${formatDateTime(conflict.createdAt)}`,
    actions: `${button("resolve-conflict", conflict.id, conflict.resolved ? "Åpne" : "Løst", "secondary")}${button("delete-conflict", conflict.id, "Slett", "danger")}`,
  }), "Ingen saker enda.");
}

function renderHistory() {
  if (!$("historyList")) return;

  const archivedExpenseIds = new Set(state.history.map((item) => item.expenseId).filter(Boolean));
  const settledFallback = state.expenses
    .filter((expense) => expense.settled && !archivedExpenseIds.has(expense.id))
    .map((expense) => ({
      id: `settled-${expense.id}`,
      expenseId: expense.id,
      title: expense.title,
      amount: Number(expense.amount || 0),
      paidBy: expense.paidBy,
      openedBy: expense.createdBy,
      closedBy: expense.settledBy || expense.createdBy,
      closedAt: expense.settledAt || expense.createdAt,
      receiptName: expense.receipt?.name ?? "",
    }));
  const sorted = [...state.history, ...settledFallback].sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
  $("historyList").innerHTML = emptyOrRows(sorted, (item) => row({
    title: `${item.title} • ${item.amount} kr`,
    meta: `Betalt av ${item.paidBy || "ukjent"} • åpnet av ${item.openedBy || "ukjent"} • lukket av ${item.closedBy || "ukjent"} • ${formatDateTime(item.closedAt)}${item.receiptName ? ` • kvittering: ${item.receiptName}` : ""}`,
    actions: badge("Arkivert"),
  }).replace('class="row"', 'class="row history-row"'), "Ingen gamle oppgjør enda. Når et beløp lukkes, blir det lagret her.");
}

function renderSettings() {
  if (!state.home) return;

  $("settingsName").value = state.home.name ?? "";
  $("settingsAddress").value = state.home.address ?? "";
  $("settingsRent").value = state.home.rentAmount ?? "";
  $("settingsRooms").value = state.home.roomCount ?? "";
  $("settingsNickname").value = getCurrentMember()?.nickname ?? "";
  $("settingsHomePhotoName").textContent = state.home.photo?.name ?? "Bilde gjør dashboardet mer personlig";
  renderImagePreview("settingsHomePhotoPreview", state.home.photo, "IMG");
  document.querySelectorAll("[data-module-setting]").forEach((input) => {
    input.checked = state.modules?.[input.dataset.moduleSetting] !== false;
  });
  document.querySelectorAll("[data-notification-setting]").forEach((input) => {
    input.checked = state.notificationSettings?.[input.dataset.notificationSetting] !== false;
  });
}

function renderNotificationCenter() {
  if (!$("notificationList")) return;

  const visible = [...state.notifications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);
  const unread = state.notifications.filter((item) => !item.read).length;
  $("notificationCount").textContent = `${unread} nye`;
  $("notificationList").innerHTML = emptyOrRows(visible, (item) => row({
    title: `${notificationPriorityLabel(item.priority)} ${item.title}`,
    meta: `${notificationTypeLabel(item.type)} • ${formatDateTime(item.createdAt)} • ${item.read ? "lest" : item.text}`,
    actions: item.read ? badge("Lest") : button("read-notification", item.id, "Lest", "secondary"),
  }).replace('class="row"', `class="row notification-row ${item.read ? "is-read" : ""} priority-${escapeHtml(item.priority)}"`), "Ingen varsler enda.");
}

function renderModuleVisibility() {
  Object.keys(DEFAULT_MODULES).forEach((moduleName) => {
    const enabled = state.modules?.[moduleName] !== false;
    document.querySelectorAll(`[data-tab="${moduleName}"]`).forEach((buttonElement) => buttonElement.classList.toggle("hidden", !enabled));
    const option = $(`dashboardViewSelect`)?.querySelector(`option[value="${moduleName}"]`);
    if (option) {
      option.hidden = !enabled;
      option.disabled = !enabled;
    }
    $(`tab-${moduleName}`)?.classList.toggle("module-disabled", !enabled);
  });

  const activeTab = $("dashboardViewSelect")?.value;
  if (activeTab && state.modules?.[activeTab] === false) {
    openTab("home");
  }
}

function notificationPriorityLabel(priority) {
  return {
    critical: "Kritisk:",
    important: "Viktig:",
    normal: "Info:",
    low: "Lav:",
  }[priority] ?? "Info:";
}

function notificationTypeLabel(type) {
  return {
    shopping: "Handleliste",
    expenses: "Utlegg",
    cleaning: "Vask og oppgaver",
    messages: "Beskjeder",
    rent: "Husleie",
    conflict: "Sak",
    crisis: "Krise",
  }[type] ?? "Varsel";
}

function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  const diff = Math.round((target - today) / 86_400_000);
  if (diff < 0) return `${Math.abs(diff)} dager siden`;
  if (diff === 0) return "I dag";
  if (diff === 1) return "I morgen";
  return `Om ${diff} dager`;
}

function renderSuperadmin() {
  if (!$("superCollectiveList")) return;

  const collectives = Object.values(getCollectives()).map(normalizeState);
  const contactRequests = getContactRequests();
  const openContactRequests = contactRequests.filter((request) => request.status !== "resolved");
  const totals = collectives.reduce((summary, collective) => {
    summary.members += collective.members.length;
    summary.openCases += collective.conflicts.filter((item) => !item.resolved).length;
    summary.mrr += Number(collective.home?.priceNok ?? calculateMonthlyPrice(collective.members.length));
    return summary;
  }, { members: 0, openCases: 0, mrr: 0 });

  $("superTotalHomes").textContent = String(collectives.length);
  $("superTotalMembers").textContent = String(totals.members);
  $("superOpenCases").textContent = String(totals.openCases + openContactRequests.length);
  $("superMrr").textContent = `${totals.mrr} kr`;

  $("superCollectiveList").innerHTML = collectives.length
    ? collectives.map((collective) => {
        const home = collective.home;
        const method = home?.billing?.method ? paymentLabel(home.billing.method) : "Ingen betaling";
        const openCases = collective.conflicts.filter((item) => !item.resolved).length;
        return row({
          title: home?.name ?? "Ukjent kollektiv",
          meta: `${collective.members.length} beboere • ${openCases} åpne saker • ${method} • ${home?.address || "Ingen adresse"}`,
          actions: `${button("open-support", home.id, "Åpne", "secondary")}${button("clean-support", home.id, "Rydd", "secondary")}${button("delete-support", home.id, "Slett", "danger")}`,
        }).replace('class="row"', 'class="row support-row"');
      }).join("")
    : '<p class="muted">Ingen kollektiv er opprettet på denne enheten enda.</p>';

  $("superContactList").innerHTML = contactRequests.length
    ? contactRequests.map((request) => row({
        title: `${request.name} • ${request.ai?.category ?? "Support"}`,
        meta: `${request.email} • ${request.ai?.priority ?? "Normal"} prioritet • ${request.status === "resolved" ? "løst" : "åpen"} • ${formatDateTime(request.createdAt)} — ${request.ai?.summary ?? request.message}`,
        actions: `${request.status === "resolved" ? "" : button("resolve-contact", request.id, "Løst", "secondary")}${button("delete-contact-request", request.id, "Slett", "danger")}`,
      })).join("")
    : '<p class="muted">Ingen henvendelser fra kontaktskjemaet enda.</p>';
}

function paymentLabel(method) {
  return {
    support: "Deltbo admin",
    vipps: "Vipps",
    apple_pay: "Apple Pay",
    card: "Visa/Mastercard",
  }[method] ?? method;
}

function openTab(name) {
  if (state.modules?.[name] === false) {
    showToast(`${MODULE_LABELS[name]} er skrudd av i innstillingene`);
    return;
  }

  const tab = $(`tab-${name}`);
  if (!tab) return;

  document.querySelectorAll(".tabview").forEach((tabView) => tabView.classList.add("hidden"));
  tab.classList.remove("hidden");
  if ($("dashboardViewSelect")) $("dashboardViewSelect").value = name;
}

function value(id) {
  return ($(id)?.value ?? "").trim();
}

function getInviteNameFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("member") || decodeInvitePayload(params.get("data") || "")?.memberName || "";
}

function digitsOnly(valueToClean) {
  return String(valueToClean).replace(/\D/g, "");
}

function slugify(valueToSlug) {
  return String(valueToSlug)
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "deltbo";
}

function clearFields(...ids) {
  ids.forEach((id) => {
    const field = $(id);
    if (!field) return;

    field.value = "";
    if (field.dataset?.fileName) updateFileLabel(field);
  });
}

function splitNames(valueToSplit) {
  return valueToSplit.split(",").map((item) => item.trim()).filter(Boolean);
}

function currentUserName() {
  return session.memberName || state.home?.adminUser || state.members[0]?.name || "Deltbo";
}

function currentDisplayName() {
  return memberDisplayName(getCurrentMember()) || currentUserName();
}

function memberDisplayName(member) {
  return member?.nickname || member?.name || "";
}

function getCurrentMember() {
  if (session.role === "support") return null;

  const username = session.memberName || state.home?.adminUser || "";
  const normalized = username.toLowerCase();
  return state.members.find((member) => member.name.toLowerCase() === normalized || member.username?.toLowerCase() === normalized)
    || state.members.find((member) => member.role === "admin")
    || null;
}

function initials(name) {
  return String(name || "Deltbo")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "DB";
}

function updateFileLabel(input) {
  const label = $(input.dataset.fileName);
  if (!label) return;

  label.textContent = input.files?.[0]?.name || "Bilde eller PDF, valgfritt";
}

function emptyOrRows(collection, mapItem, emptyText) {
  return collection.length ? collection.map(mapItem).join("") : `<p class="muted">${emptyText}</p>`;
}

function homePhotoCard() {
  if (!state.home?.photo?.dataUrl) return "";

  return `
    <div class="home-photo-card">
      <img src="${escapeHtml(state.home.photo.dataUrl)}" alt="${escapeHtml(state.home.name)}" />
      <div>
        <span class="muted">Kollektivbilde</span>
        <strong>${escapeHtml(state.home.name)}</strong>
      </div>
    </div>
  `;
}

function memberCard(member) {
  const isCurrent = member.name === currentUserName() || member.username === currentUserName();
  const displayName = memberDisplayName(member);
  const nicknameMeta = member.nickname ? ` • ${member.name}` : "";
  const status = member.role === "admin"
    ? "Admin"
    : member.username
      ? "Konto opprettet"
      : "Venter på konto";
  const actions = member.role === "admin"
    ? badge("Admin")
    : button("copy-member-invite", member.id, "Kopier invitasjon", "secondary");

  return `
    <div class="row member-card ${isCurrent ? "is-current" : ""}">
      <span class="member-avatar">${escapeHtml(initials(displayName))}</span>
      <div class="row-main">
        <span class="row-title">${escapeHtml(displayName)}</span>
        <span class="row-meta">${escapeHtml(`${status}${nicknameMeta}${member.room ? ` • ${member.room}` : ""}${isCurrent ? " • deg" : ""}`)}</span>
      </div>
      <div class="row-actions">${actions}</div>
    </div>
  `;
}

function renderImagePreview(id, media, fallback) {
  const preview = $(id);
  if (!preview) return;

  preview.innerHTML = "";
  preview.style.backgroundImage = "";
  if (media?.dataUrl) {
    preview.style.backgroundImage = `url("${media.dataUrl}")`;
    preview.textContent = "";
    preview.classList.add("has-image");
    return;
  }

  preview.classList.remove("has-image");
  preview.textContent = fallback;
}

function row({ title, meta, actions = "" }) {
  return `<div class="row"><div class="row-main"><span class="row-title">${escapeHtml(title)}</span><span class="row-meta">${escapeHtml(meta)}</span></div><div class="row-actions">${actions}</div></div>`;
}

function rowInfo(title, meta) {
  return row({ title, meta });
}

function button(action, id, label, variant = "secondary") {
  return `<button class="btn ${variant}" data-action="${action}" data-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
}

function receiptLink(receipt) {
  if (!receipt?.dataUrl) return "";
  return `<a class="btn secondary receipt-btn" href="${escapeHtml(receipt.dataUrl)}" target="_blank" rel="noopener">${escapeHtml(receipt.name || "Kvittering")}</a>`;
}

function badge(label) {
  return `<span class="badge">${escapeHtml(label)}</span>`;
}

function formatDate(date) {
  if (!date) return "Ingen dato";
  return new Intl.DateTimeFormat("no-NO", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("no-NO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("open");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("open"), 2400);
}

function escapeHtml(valueToEscape) {
  return String(valueToEscape).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

window.DeltboTest = {
  getState: () => structuredCloneSafe(state),
  normalizeState,
  createInviteToken,
  createInviteUrl,
  PRICE_NOK,
  BASE_PRICE_NOK,
  MEMBER_PRICE_NOK,
  calculateMonthlyPrice,
};


