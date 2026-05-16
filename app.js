const STORAGE_KEY = "DeltboState";
const SESSION_KEY = "DeltboSession";
const COLLECTIVES_KEY = "DeltboCollectives";
const CONTACTS_KEY = "DeltboContactRequests";
const LEGACY_PREFIX = "kol" + "lex";
const LEGACY_STORAGE_KEY = `${LEGACY_PREFIX}State`;
const LEGACY_SESSION_KEY = `${LEGACY_PREFIX}Session`;
const LEGACY_COLLECTIVES_KEY = `${LEGACY_PREFIX}Collectives`;
const LEGACY_CONTACTS_KEY = `${LEGACY_PREFIX}ContactRequests`;
const PRICE_NOK = 99;
const SUPER_ADMIN = { username: "deltbo", password: "support99" };

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
  members: [{ id: uid(), name: "Deg", room: "Admin", role: "admin", joinedAt: isoNow() }],
  expenses: [
    { id: uid(), title: "Toalettpapir", amount: 81, paidBy: "Deg", settled: false, createdAt: isoNow() },
    { id: uid(), title: "Strømregning", amount: 420, paidBy: "Maria", settled: false, createdAt: isoNow() },
  ],
  cleaning: [
    { id: uid(), title: "Kjøkken", assignee: "Maria", dueDate: todayPlus(1), done: false },
    { id: uid(), title: "Bad", assignee: "Jonas", dueDate: todayPlus(3), done: false },
    { id: uid(), title: "Stue", assignee: "Deg", dueDate: todayPlus(5), done: false },
  ],
  shopping: [
    { id: uid(), item: "Melk", quantity: "2 stk", done: false },
    { id: uid(), item: "Kylling", quantity: "1 pakke", done: false },
    { id: uid(), item: "Toalettpapir", quantity: "12 ruller", done: false },
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
};

let state = normalizeState(storageAdapter.loadAppState());
let session = storageAdapter.loadSession() ?? { role: null, memberName: null };
let toastTimer;
let demoTimer;
let demoSceneIndex = 0;
let createMode = "paid";

const demoScenes = [
  ["Opprett kollektiv", "Admin velger betaling, lager kollektiv og får invitasjonslink."],
  ["Inviter beboere", "Maria og Jonas blir med via linken og ser samme dashboard."],
  ["Samkjør hverdagen", "Utgifter, rengjøring og handleliste oppdateres live for alle."],
  ["Rydd problemer", "Admin eller Deltbo support kan hjelpe når noe stopper opp."],
];

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
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
    "toggle-expense": () => updateById("expenses", id, (item) => ({ ...item, settled: !item.settled })),
    "delete-expense": () => removeById("expenses", id, "Utgift fjernet"),
    "done-clean": () => updateById("cleaning", id, (item) => ({ ...item, done: !item.done })),
    "delete-clean": () => removeById("cleaning", id, "Oppgave fjernet"),
    "toggle-shop": () => updateById("shopping", id, (item) => ({ ...item, done: !item.done })),
    "delete-shop": () => removeById("shopping", id, "Vare fjernet"),
    "delete-message": () => removeById("messages", id, "Beskjed fjernet"),
    "delete-event": () => removeById("events", id, "Hendelse fjernet"),
    "delete-rule": () => removeById("rules", id, "Regel fjernet"),
    "delete-inventory": () => removeById("inventory", id, "Inventar fjernet"),
    "delete-contact": () => removeById("contacts", id, "Kontakt fjernet"),
    "resolve-conflict": () => updateById("conflicts", id, (item) => ({ ...item, resolved: !item.resolved })),
    "delete-conflict": () => removeById("conflicts", id, "Sak fjernet"),
    "open-support": () => openCollectiveAsSupport(id),
    "clean-support": () => cleanCollectiveIssues(id),
    "delete-support": () => deleteCollective(id),
    "resolve-contact": () => resolveContactRequest(id),
    "delete-contact-request": () => deleteContactRequest(id),
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
    members,
    expenses: normalizeCollection(merged.expenses, (expense) => ({
      id: expense.id ?? uid(),
      title: expense.title ?? "Utgift",
      amount: Number(expense.amount ?? 0),
      paidBy: expense.paidBy ?? members[0]?.name ?? "Admin",
      settled: Boolean(expense.settled),
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
      ? { id: uid(), item, quantity: "", done: false }
      : { id: item.id ?? uid(), item: item.item ?? "Vare", quantity: item.quantity ?? "", done: Boolean(item.done) }),
    messages: normalizeCollection(merged.messages, (item) => ({ id: item.id ?? uid(), text: item.text ?? "", author: item.author ?? "Deltbo", createdAt: item.createdAt ?? isoNow() })),
    events: normalizeCollection(merged.events, (item) => ({ id: item.id ?? uid(), title: item.title ?? "Hendelse", date: item.date ?? todayPlus(7) })),
    rules: normalizeCollection(merged.rules, (item) => typeof item === "string" ? { id: uid(), text: item } : { id: item.id ?? uid(), text: item.text ?? "" }),
    inventory: normalizeCollection(merged.inventory, (item) => ({ id: item.id ?? uid(), name: item.name ?? "Ting", owner: item.owner ?? "", status: item.status ?? "OK" })),
    contacts: normalizeCollection(merged.contacts, (item) => ({ id: item.id ?? uid(), name: item.name ?? "Kontakt", value: item.value ?? "" })),
    conflicts: normalizeCollection(merged.conflicts, (item) => typeof item === "string"
      ? { id: uid(), text: item, resolved: false, createdAt: isoNow() }
      : { id: item.id ?? uid(), text: item.text ?? "", resolved: Boolean(item.resolved), createdAt: item.createdAt ?? isoNow() }),
  };
}

function normalizeMembers(members) {
  const list = normalizeCollection(members, (member) => typeof member === "string"
    ? { id: uid(), name: member, room: "", role: "member", joinedAt: isoNow() }
    : { id: member.id ?? uid(), name: member.name ?? "Beboer", room: member.room ?? "", role: member.role ?? "member", joinedAt: member.joinedAt ?? isoNow() });

  return list.length ? list : structuredCloneSafe(demoData.members);
}

function normalizeCollection(value, mapItem) {
  return Array.isArray(value) ? value.map(mapItem).filter(Boolean) : [];
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
  storageAdapter.saveAppState(state);
  saveCurrentCollectiveToRegistry();
  render();
  if (message) showToast(message);
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
  if (createMode === "owner_free" && session.role === "superadmin") {
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
  createMode = "owner_free";
  renderCreateMode();
  $("createError").textContent = "";
  view("create");
}

function showJoin(inviteToken) {
  const isValidInvite = Boolean(state.home && state.home.inviteToken === inviteToken);
  $("joinIntro").textContent = isValidInvite
    ? `Du er invitert til ${state.home.name}.`
    : "Denne invitasjonslinken er ugyldig eller finnes ikke på denne enheten.";
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
  const isOwnerFree = createMode === "owner_free" && session.role === "superadmin";
  const billing = isOwnerFree ? createOwnerFreeBilling() : collectBilling();

  if (!name || !adminUser || adminPass.length < 4) {
    $("createError").textContent = "Fyll inn kollektivnavn, brukernavn og passord på minst 4 tegn.";
    return;
  }

  if (!isOwnerFree) {
    const billingError = validateBilling(billing);
    if (billingError) {
      $("createError").textContent = billingError;
      return;
    }
  }

  const inviteToken = createInviteToken(name);
  const adminMember = { id: uid(), name: adminUser, room: "Admin", role: "admin", joinedAt: isoNow() };
  const members = [
    adminMember,
    ...firstMembers.map((memberName, index) => ({
      id: uid(),
      name: memberName,
      room: `Rom ${index + 1}`,
      role: "member",
      joinedAt: isoNow(),
    })),
  ];

  state = normalizeState({
    ...demoData,
    home: {
      id: uid(),
      name,
      address,
      roomCount,
      rentAmount,
      adminUser,
      adminPass,
      inviteToken,
      inviteUrl: createInviteUrl(inviteToken),
      priceNok: isOwnerFree ? 0 : PRICE_NOK,
      plan: isOwnerFree ? "owner_free" : "monthly",
      billing,
      createdAt: isoNow(),
      createdBy: isOwnerFree ? "superadmin" : "customer",
    },
    members,
  });

  saveSession(isOwnerFree
    ? { role: "superadmin", memberName: "Deltbo admin" }
    : { role: "admin", memberName: adminUser });
  saveState("Kollektiv opprettet");
  $("inviteLink").value = state.home.inviteUrl;
  $("createdBox").classList.add("open");
  $("createError").textContent = isOwnerFree
    ? "Gratis kollektiv opprettet av eier. Ingen betalingsmetode ble lagret."
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

function collectBilling() {
  const method = document.querySelector('input[name="paymentMethod"]:checked')?.value ?? "vipps";
  const billing = {
    method,
    status: "authorized_demo",
    amountNok: PRICE_NOK,
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

  return billing;
}

function createOwnerFreeBilling() {
  return {
    method: "owner_free",
    status: "free_owner_created",
    amountNok: 0,
    interval: "lifetime",
    email: "",
    phone: "",
    createdBy: "Deltbo admin",
    createdAt: isoNow(),
  };
}

function validateBilling(billing) {
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
    const shouldShow = type === "email" || type === "card" && method === "card" || type === "phone" && method !== "card" && method !== "invoice";
    field.classList.toggle("hidden", !shouldShow);
  });
}

function renderCreateMode() {
  const isOwnerFree = createMode === "owner_free";
  $("createPricePill").textContent = isOwnerFree ? "Gratis eier-opprettelse" : "99 kr/mnd";
  $("createTitle").textContent = isOwnerFree ? "Opprett gratis kollektiv" : "Opprett kollektiv";
  $("createIntro").textContent = isOwnerFree
    ? "Eier kan opprette et kollektiv uten betaling for support, test eller kampanje."
    : "Du blir admin. Medlemmer kommer inn via invitasjonslink.";
  $("paymentPanel").classList.toggle("hidden", isOwnerFree);
  $("createSubmit").textContent = isOwnerFree ? "Opprett gratis kollektiv" : "Betal og opprett kollektiv";
  $("createBackButton").textContent = isOwnerFree ? "Til adminpanel" : "Tilbake";
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

function createInviteUrl(inviteToken) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("invite", inviteToken);
  return url.toString();
}

function joinHome(event) {
  event.preventDefault();

  if (!state.home) {
    $("joinError").textContent = "Kollektivet finnes ikke lokalt enda.";
    return;
  }

  const memberName = value("memberName");
  const room = value("memberRoom");
  if (!memberName) {
    $("joinError").textContent = "Skriv inn navnet ditt for å bli med.";
    return;
  }

  upsertMember(memberName, room);
  saveSession({ role: "member", memberName });
  saveState("Velkommen inn");
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
  if (!isValidAdmin) {
    $("loginError").textContent = "Feil brukernavn eller passord.";
    return;
  }

  saveSession({ role: "admin", memberName: state.home.adminUser });
  closeLogin();
  openDashboard("admin");
  showToast("Logget inn som admin");
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
    await navigator.clipboard?.writeText(state.home.inviteUrl);
    showToast("Invitasjonslink kopiert");
  } catch {
    $("inviteLink").value = state.home.inviteUrl;
    $("inviteLink").select();
    showToast("Kopier linken fra feltet");
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

  upsertMember(name, value("memberManualRoom"));
  clearFields("memberManualName", "memberManualRoom");
  saveState("Beboer lagt til");
}

function upsertMember(name, room = "") {
  const existing = state.members.find((member) => member.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.room = room || existing.room;
    return;
  }

  state.members.push({ id: uid(), name, room, role: "member", joinedAt: isoNow() });
}

function addExpense(event) {
  event.preventDefault();
  const title = value("expenseTitle");
  const amount = Number(value("expenseAmount"));
  if (!title || amount <= 0) return;

  state.expenses.unshift({
    id: uid(),
    title,
    amount,
    paidBy: value("expensePaidBy") || currentUserName(),
    settled: false,
    createdAt: isoNow(),
  });
  clearFields("expenseTitle", "expenseAmount");
  saveState("Utgift lagt til");
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
  clearFields("cleanTitle", "cleanDue");
  saveState("Oppgave lagt til");
}

function addShoppingItem(event) {
  event.preventDefault();
  const item = value("shopItem");
  if (!item) return;

  state.shopping.push({ id: uid(), item, quantity: value("shopQuantity"), done: false });
  clearFields("shopItem", "shopQuantity");
  saveState("Vare lagt til");
}

function addMessage() {
  const text = value("messageText");
  if (!text) return;

  state.messages.unshift({ id: uid(), text, author: currentUserName(), createdAt: isoNow() });
  clearFields("messageText");
  saveState("Beskjed sendt");
}

function addEvent(event) {
  event.preventDefault();
  const title = value("eventTitle");
  if (!title) return;

  state.events.push({ id: uid(), title, date: value("eventDate") || todayPlus(7) });
  clearFields("eventTitle", "eventDate");
  saveState("Hendelse lagt til");
}

function addRule(event) {
  event.preventDefault();
  const text = value("ruleText");
  if (!text) return;

  state.rules.push({ id: uid(), text });
  clearFields("ruleText");
  saveState("Husregel lagt til");
}

function addInventory(event) {
  event.preventDefault();
  const name = value("inventoryName");
  if (!name) return;

  state.inventory.push({ id: uid(), name, owner: value("inventoryOwner"), status: "OK" });
  clearFields("inventoryName", "inventoryOwner");
  saveState("Inventar lagt til");
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
  clearFields("conflictText");
  saveState("Anonym sak sendt");
}

function saveSettings(event) {
  event.preventDefault();
  if (session.role !== "admin" && session.role !== "support") {
    showToast("Kun admin eller support kan endre innstillinger");
    return;
  }

  state.home = {
    ...state.home,
    name: value("settingsName"),
    address: value("settingsAddress"),
    rentAmount: Number(value("settingsRent") || 0),
    roomCount: Number(value("settingsRooms") || 1),
  };
  saveState("Innstillinger lagret");
}

function quickAdd(event) {
  event.preventDefault();
  const type = value("quickType");
  const text = value("quickText");
  if (!text) return;

  if (type === "shopping") state.shopping.push({ id: uid(), item: text, quantity: "", done: false });
  if (type === "message") state.messages.unshift({ id: uid(), text, author: currentUserName(), createdAt: isoNow() });
  if (type === "expense") state.expenses.unshift({ id: uid(), title: text, amount: Number(value("quickAmount") || 0), paidBy: currentUserName(), settled: false, createdAt: isoNow() });
  if (type === "task") state.cleaning.push({ id: uid(), title: text, assignee: currentUserName(), dueDate: todayPlus(7), done: false });

  clearFields("quickText", "quickAmount");
  closeModal("quickAdd");
  saveState("Lagt til");
}

function updateById(collection, id, update) {
  state[collection] = state[collection].map((item) => item.id === id ? update(item) : item);
  saveState("Oppdatert");
}

function removeById(collection, id, message) {
  state[collection] = state[collection].filter((item) => item.id !== id);
  saveState(message);
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
  cleaned.conflicts = cleaned.conflicts.map((item) => ({ ...item, resolved: true }));
  cleaned.shopping = cleaned.shopping.filter((item) => !item.done);
  cleaned.cleaning = cleaned.cleaning.filter((item) => !item.done);
  cleaned.expenses = cleaned.expenses.map((item) => ({ ...item, settled: true }));
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
  renderSettings();
  if ($("superCollectiveList")) renderSuperadmin();
}

function renderShell() {
  if (!state.home) return;

  $("dashName").textContent = state.home.name;
  $("sideName").textContent = state.home.name;
  $("inviteLink").value = state.home.inviteUrl;
  $("accountRole").textContent = session.role === "member"
    ? `Medlem: ${session.memberName}`
    : session.role === "support"
      ? "Deltbo support"
      : "Admin-konto";
  $("dashRole").textContent = session.role === "member"
    ? "Medlemsvisning"
    : session.role === "support"
      ? "Supportvisning"
      : `Admin • ${PRICE_NOK} kr/mnd`;
  $("inviteButton").classList.toggle("hidden", session.role !== "admin" && session.role !== "support");
  $("settingsForm").querySelector("button").disabled = session.role !== "admin" && session.role !== "support";
}

function renderStats() {
  const total = state.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const openShopping = state.shopping.filter((item) => !item.done).length;
  const nextTask = state.cleaning.find((task) => !task.done);
  const memberCount = Math.max(state.members.length, 1);

  $("totalExpenses").textContent = `${total} kr`;
  $("yourShare").textContent = `${Math.round(total / memberCount)} kr`;
  $("nextClean").textContent = nextTask ? nextTask.title : "Ingen";
  $("shoppingCount").textContent = `${openShopping} varer`;
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
  const items = [
    rowInfo("Beboere", `${state.members.length} registrert`),
    rowInfo("Leie", rentShare),
    rowInfo("Neste kalenderpunkt", nextEvent ? `${nextEvent.title} • ${formatDate(nextEvent.date)}` : "Ingen hendelser"),
    rowInfo("Åpne saker", `${openCases} saker`),
  ];
  $("todayList").innerHTML = items.join("");
}

function renderMembers() {
  $("memberList").innerHTML = state.members.map((member) => row({
    title: member.name,
    meta: `${member.role === "admin" ? "Admin" : "Medlem"}${member.room ? ` • ${member.room}` : ""}`,
    actions: member.role === "admin" ? badge("Admin") : "",
  })).join("");
}

function renderExpenses() {
  $("expenseList").innerHTML = emptyOrRows(state.expenses, (expense) => row({
    title: `${expense.title} • ${expense.amount} kr`,
    meta: `Betalt av ${expense.paidBy} • ${expense.settled ? "gjort opp" : "venter"}`,
    actions: `${button("toggle-expense", expense.id, expense.settled ? "Åpne" : "Gjør opp", "secondary")}${button("delete-expense", expense.id, "Slett", "danger")}`,
  }), "Ingen utgifter enda.");
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
    meta: `${item.quantity || "Ingen mengde"} • ${item.done ? "kjopt" : "mangler"}`,
    actions: `${button("toggle-shop", item.id, item.done ? "Angre" : "Kjopt", "secondary")}${button("delete-shop", item.id, "Slett", "danger")}`,
  }), "Handlelisten er tom.");
}

function renderMessages() {
  $("messageList").innerHTML = emptyOrRows(state.messages, (message) => row({
    title: message.text,
    meta: `${message.author} • ${formatDateTime(message.createdAt)}`,
    actions: button("delete-message", message.id, "Slett", "danger"),
  }), "Ingen beskjeder enda.");
}

function renderEvents() {
  const sorted = [...state.events].sort((a, b) => a.date.localeCompare(b.date));
  $("eventList").innerHTML = emptyOrRows(sorted, (event) => row({
    title: event.title,
    meta: formatDate(event.date),
    actions: button("delete-event", event.id, "Slett", "danger"),
  }), "Ingen hendelser enda.");
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

function renderSettings() {
  if (!state.home) return;

  $("settingsName").value = state.home.name ?? "";
  $("settingsAddress").value = state.home.address ?? "";
  $("settingsRent").value = state.home.rentAmount ?? "";
  $("settingsRooms").value = state.home.roomCount ?? "";
}

function renderSuperadmin() {
  if (!$("superCollectiveList")) return;

  const collectives = Object.values(getCollectives()).map(normalizeState);
  const contactRequests = getContactRequests();
  const openContactRequests = contactRequests.filter((request) => request.status !== "resolved");
  const totals = collectives.reduce((summary, collective) => {
    summary.members += collective.members.length;
    summary.openCases += collective.conflicts.filter((item) => !item.resolved).length;
    summary.mrr += Number(collective.home?.priceNok ?? PRICE_NOK);
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
    owner_free: "Gratis fra eier",
    vipps: "Vipps",
    apple_pay: "Apple Pay",
    card: "Visa/Mastercard",
    invoice: "Faktura",
  }[method] ?? method;
}

function openTab(name, button) {
  document.querySelectorAll(".tabview").forEach((tabView) => tabView.classList.add("hidden"));
  $(`tab-${name}`).classList.remove("hidden");
  document.querySelectorAll(".menu button").forEach((menuButton) => menuButton.classList.remove("active"));
  button.classList.add("active");
}

function value(id) {
  return ($(id)?.value ?? "").trim();
}

function digitsOnly(valueToClean) {
  return String(valueToClean).replace(/\D/g, "");
}

function clearFields(...ids) {
  ids.forEach((id) => {
    if ($(id)) $(id).value = "";
  });
}

function splitNames(valueToSplit) {
  return valueToSplit.split(",").map((item) => item.trim()).filter(Boolean);
}

function currentUserName() {
  return session.memberName || state.home?.adminUser || state.members[0]?.name || "Deltbo";
}

function emptyOrRows(collection, mapItem, emptyText) {
  return collection.length ? collection.map(mapItem).join("") : `<p class="muted">${emptyText}</p>`;
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
};


