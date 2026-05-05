const STORAGE_KEY = "karolMartinsAgenda.v1";
const STATUS = ["Agendado", "Concluído", "Cancelado", "Não compareceu"];

const defaultState = {
  session: null,
  settings: {
    startTime: "09:00",
    endTime: "19:00",
    interval: 30,
    workingDays: [1, 2, 3, 4, 5, 6],
    receptionCanCancel: true
  },
  users: [
    {
      id: crypto.randomUUID(),
      name: "Administrador",
      email: "admin@karolmartins.local",
      passwordHash: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
      role: "admin",
      active: true
    },
    {
      id: crypto.randomUUID(),
      name: "Recepção",
      email: "recepcao@karolmartins.local",
      passwordHash: "2b2f7d1f89222d7211f2befb172fa7267c44ef66f9e074a7902dc39ce7c829a2",
      role: "reception",
      active: true
    }
  ],
  services: [
    {
      id: crypto.randomUUID(),
      name: "Design de sobrancelhas",
      duration: 60,
      description: "Mapeamento, design e finalização personalizada.",
      price: "80,00",
      photo: "assets/KarolMartinsLogo2.png",
      active: true
    },
    {
      id: crypto.randomUUID(),
      name: "Micropigmentação",
      duration: 180,
      description: "Procedimento completo com preparação e finalização.",
      price: "450,00",
      photo: "assets/KarolMartinsLogo2.png",
      active: true
    },
    {
      id: crypto.randomUUID(),
      name: "Manutenção",
      duration: 90,
      description: "Atendimento de revisão e ajuste.",
      price: "150,00",
      photo: "assets/KarolMartinsLogo2.png",
      active: true
    }
  ],
  appointments: []
};

let state = loadState();
let pendingConflictBooking = null;
let selectedTime = null;
let supabaseClient = null;
let cloudReady = false;
let hydratingCloud = false;
let cloudSaveTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);
  const loaded = { ...structuredClone(defaultState), ...JSON.parse(saved) };
  loaded.users = loaded.users.map((user) => {
    if (!user.password || user.passwordHash) return user;
    return { ...user, passwordHash: user.password, password: undefined };
  });
  return loaded;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueCloudSave();
}

function getSupabaseConfig() {
  return window.KMS_SUPABASE_CONFIG || {};
}

function initSupabase() {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey || !window.supabase?.createClient) return false;
  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  cloudReady = true;
  return true;
}

async function hydrateFromCloud() {
  if (!cloudReady) return;
  hydratingCloud = true;
  try {
    const { data, error } = await supabaseClient
      .from("app_state")
      .select("content")
      .eq("id", 1)
      .single();

    if (error) throw error;
    if (data?.content && Object.keys(data.content).length) {
      state = { ...structuredClone(defaultState), ...data.content };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
      toast("Agenda sincronizada com Supabase.");
    } else {
      await saveStateToCloud();
      toast("Supabase conectado.");
    }
  } catch (error) {
    toast(`Supabase não sincronizou: ${error.message}`);
  } finally {
    hydratingCloud = false;
  }
}

function queueCloudSave() {
  if (!cloudReady || hydratingCloud) return;
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(saveStateToCloud, 450);
}

async function saveStateToCloud() {
  if (!cloudReady) return;
  const { error } = await supabaseClient
    .from("app_state")
    .upsert({
      id: 1,
      content: state,
      updated_at: new Date().toISOString()
    });
  if (error) toast(`Erro ao salvar no Supabase: ${error.message}`);
}

function minutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function timeFromMinutes(total) {
  const hour = Math.floor(total / 60).toString().padStart(2, "0");
  const minute = (total % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

function addMinutes(time, amount) {
  return timeFromMinutes(minutes(time) + amount);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function hashPassword(password) {
  if (!crypto.subtle) return sha256Fallback(password);
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sha256Fallback(input) {
  const rightRotate = (value, amount) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const words = [];
  const ascii = unescape(encodeURIComponent(input));
  let hash = sha256Fallback.hash;
  let k = sha256Fallback.k;
  let primeCounter = k.length;

  if (!hash.length) {
    let candidate = 2;
    while (primeCounter < 64) {
      let isPrime = true;
      for (let divisor = 2; divisor * divisor <= candidate; divisor += 1) {
        if (candidate % divisor === 0) {
          isPrime = false;
          break;
        }
      }
      if (isPrime) {
        if (primeCounter < 8) hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        primeCounter += 1;
      }
      candidate += 1;
    }
  }
  hash = hash.slice(0);

  const bitLength = ascii.length * 8;
  for (let i = 0; i < ascii.length; i += 1) words[i >> 2] |= ascii.charCodeAt(i) << ((3 - i) % 4) * 8;
  words[bitLength >> 5] |= 0x80 << (24 - bitLength % 32);
  words[((bitLength + 64 >> 9) << 4) + 15] = bitLength;

  for (let block = 0; block < words.length; block += 16) {
    const oldHash = hash.slice(0);
    const schedule = words.slice(block, block + 16);

    for (let i = 0; i < 64; i += 1) {
      const w15 = schedule[i - 15];
      const w2 = schedule[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ (~e & hash[6]))
        + k[i]
        + (schedule[i] = i < 16 ? schedule[i] : (
          schedule[i - 16]
          + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
          + schedule[i - 7]
          + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
        ) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (let i = 0; i < 8; i += 1) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  return hash.map((value) => (value + maxWord).toString(16).slice(-8)).join("");
}

sha256Fallback.hash = [];
sha256Fallback.k = [];

function serviceById(id) {
  return state.services.find((service) => service.id === id);
}

function visibleAppointments(date) {
  return state.appointments
    .filter((appointment) => appointment.date === date && appointment.status !== "Cancelado")
    .sort((a, b) => minutes(a.start) - minutes(b.start));
}

function hasDirectOverlap(date, start, end) {
  const startMin = minutes(start);
  const endMin = minutes(end);
  return visibleAppointments(date).some((appointment) => {
    const appointmentStart = minutes(appointment.start);
    const appointmentEnd = minutes(appointment.end);
    return startMin < appointmentEnd && endMin > appointmentStart;
  });
}

function conflictsFor(date, start, duration) {
  const startMin = minutes(start);
  const endMin = startMin + duration;
  return visibleAppointments(date).filter((appointment) => {
    const appointmentStart = minutes(appointment.start);
    return appointmentStart > startMin && appointmentStart < endMin;
  });
}

function isStartOccupied(date, start) {
  const startMin = minutes(start);
  return visibleAppointments(date).some((appointment) => {
    const appointmentStart = minutes(appointment.start);
    const appointmentEnd = minutes(appointment.end);
    return startMin >= appointmentStart && startMin < appointmentEnd;
  });
}

function getSlots(date, service) {
  const slots = [];
  const start = minutes(state.settings.startTime);
  const end = minutes(state.settings.endTime);
  const day = new Date(`${date}T12:00:00`).getDay();

  if (!state.settings.workingDays.includes(day)) return slots;

  for (let current = start; current < end; current += state.settings.interval) {
    const time = timeFromMinutes(current);
    if (isStartOccupied(date, time)) continue;

    const finish = current + service.duration;
    const conflicts = conflictsFor(date, time, service.duration);
    const status = finish <= end && conflicts.length === 0 ? "ok" : "warn";
    slots.push({ time, end: timeFromMinutes(finish), status, conflicts });
  }
  return slots;
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => element.classList.remove("show"), 3200);
}

function setView(view) {
  const needsAuth = ["dashboard", "appointments", "services", "users", "settings"].includes(view);
  const adminOnly = ["services", "users", "settings"].includes(view);

  if (needsAuth && !state.session) {
    $("#loginDialog").showModal();
    return;
  }
  if (adminOnly && state.session?.role !== "admin") {
    toast("Seu perfil não tem acesso a esta área.");
    return;
  }

  $$(".view").forEach((section) => section.classList.remove("active-view"));
  $(`#${view}View`).classList.add("active-view");
  $$(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  renderAll();
}

function hydrateShell() {
  document.body.classList.toggle("is-authenticated", Boolean(state.session));
  document.body.classList.toggle("is-admin", state.session?.role === "admin");
  $("#sessionInfo").textContent = state.session
    ? `${state.session.name} | ${state.session.role === "admin" ? "Administrador" : "Recepcionista"}`
    : "Área pública";
  $("#loginToggle").textContent = state.session ? "Sair" : "Entrar";
}

function renderServiceSelect() {
  const select = $("#serviceSelect");
  const activeServices = state.services.filter((service) => service.active);
  select.innerHTML = activeServices
    .map((service) => `<option value="${escapeHTML(service.id)}">${escapeHTML(service.name)} | ${service.duration} min</option>`)
    .join("");
  if (!select.value && activeServices[0]) select.value = activeServices[0].id;
  renderServicePreview();
}

function renderServicePreview() {
  const service = serviceById($("#serviceSelect").value);
  $("#servicePreview").innerHTML = service
    ? `<img src="${escapeHTML(service.photo)}" alt="${escapeHTML(service.name)}">
       <div><h3>${escapeHTML(service.name)}</h3><p>${service.duration} min ${service.price ? "| R$ " + escapeHTML(service.price) : ""}</p><p>${escapeHTML(service.description || "")}</p></div>`
    : `<div class="empty-state">Nenhum serviço ativo cadastrado.</div>`;
  renderSlots();
}

function renderSlots() {
  const date = $("#bookingDate").value;
  const service = serviceById($("#serviceSelect").value);
  const grid = $("#timeGrid");
  renderSelectedSlot();
  if (!date || !service) {
    grid.innerHTML = `<div class="empty-state">Selecione data e procedimento.</div>`;
    return;
  }

  const slots = getSlots(date, service);
  if (!slots.length) {
    grid.innerHTML = `<div class="empty-state">Não há horários disponíveis para esta data.</div>`;
    return;
  }

  grid.innerHTML = slots
    .map((slot) => `
      <button class="time-button ${slot.status}" data-time="${slot.time}" type="button">
        <span>${slot.time}</span>
        <small>${slot.status === "ok" ? "até " + slot.end : "ver aviso"}</small>
      </button>
    `)
    .join("");
  $$(".time-button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.time === selectedTime);
  });
}

function renderSelectedSlot() {
  const button = $("#confirmBooking");
  const info = $("#selectedSlotInfo");
  const service = serviceById($("#serviceSelect").value);
  button.disabled = !selectedTime;
  info.textContent = selectedTime && service
    ? `Selecionado: ${selectedTime} até ${addMinutes(selectedTime, service.duration)}`
    : "Nenhum horário selecionado";
}

function clearBookingForm() {
  $("#bookingForm").reset();
  $("#bookingDate").value = todayISO();
  selectedTime = null;
  renderServiceSelect();
  renderSelectedSlot();
  renderSlots();
}

function getBookingPayload(time) {
  const service = serviceById($("#serviceSelect").value);
  return {
    id: crypto.randomUUID(),
    clientName: $("#clientName").value.trim(),
    phone: $("#clientPhone").value.trim(),
    serviceId: service.id,
    date: $("#bookingDate").value,
    start: time,
    end: addMinutes(time, service.duration),
    notes: $("#bookingNotes").value.trim(),
    status: "Agendado",
    createdAt: new Date().toISOString()
  };
}

function validateBookingForm() {
  const form = $("#bookingForm");
  if (!form.reportValidity()) return false;
  if (!serviceById($("#serviceSelect").value)) {
    toast("Cadastre ou ative um serviço antes de agendar.");
    return false;
  }
  return true;
}

function book(time, allowConflict = false) {
  if (!validateBookingForm()) return;
  const service = serviceById($("#serviceSelect").value);
  const date = $("#bookingDate").value;
  const payload = getBookingPayload(time);

  if (!allowConflict && hasDirectOverlap(date, payload.start, payload.end)) {
    toast("Este horário já está ocupado e não pode ser escolhido.");
    return;
  }

  const conflicts = conflictsFor(date, time, service.duration);
  const finishAfterClosing = minutes(payload.end) > minutes(state.settings.endTime);
  if (!allowConflict && (conflicts.length || finishAfterClosing)) {
    pendingConflictBooking = payload;
    const times = conflicts.map((item) => item.start);
    const text = times.length
      ? `Há procedimentos marcados às ${times.join(", ")}.`
      : `O procedimento ultrapassa o horário de término (${state.settings.endTime}).`;
    $("#conflictMessage").textContent = `O procedimento a ser agendado requer um intervalo maior. ${text} Deseja prosseguir mesmo assim?`;
    $("#conflictDialog").showModal();
    return;
  }

  state.appointments.push(payload);
  saveState();
  clearBookingForm();
  renderAll();
  toast(`Agendamento confirmado para ${payload.start}.`);
}

function renderDashboard() {
  const today = todayISO();
  const todayAppointments = visibleAppointments(today);
  const upcoming = state.appointments.filter((item) => item.status === "Agendado" && item.date >= today);
  const cards = [
    ["Agenda do dia", todayAppointments.length],
    ["Próximos atendimentos", upcoming.length],
    ["Serviços ativos", state.services.filter((service) => service.active).length],
    ["Usuários ativos", state.users.filter((user) => user.active).length]
  ];
  $("#dashboardCards").innerHTML = cards
    .map(([label, value]) => `<div class="panel stat-card"><span>${label}</span><strong>${value}</strong></div>`)
    .join("");
  $("#todayList").innerHTML = todayAppointments.length
    ? todayAppointments.map(renderAppointmentItem).join("")
    : `<div class="empty-state">Nenhum atendimento para hoje.</div>`;
}

function renderAppointmentItem(appointment) {
  const service = serviceById(appointment.serviceId);
  return `<div class="item-card">
    <strong>${escapeHTML(appointment.start)} - ${escapeHTML(appointment.end)} | ${escapeHTML(appointment.clientName)}</strong>
    <span>${escapeHTML(service?.name || "Serviço removido")} | ${escapeHTML(appointment.phone)}</span>
    <span>${escapeHTML(appointment.status)}</span>
  </div>`;
}

function renderAppointments() {
  const query = $("#appointmentSearch").value.toLowerCase();
  const filter = $("#appointmentStatusFilter").value;
  const rows = state.appointments
    .slice()
    .sort((a, b) => `${b.date} ${b.start}`.localeCompare(`${a.date} ${a.start}`))
    .filter((appointment) => {
      const service = serviceById(appointment.serviceId);
      const haystack = `${appointment.clientName} ${appointment.phone} ${service?.name || ""}`.toLowerCase();
      return (!filter || appointment.status === filter) && haystack.includes(query);
    });

  $("#appointmentsTable").innerHTML = rows.length
    ? rows.map((appointment) => {
      const service = serviceById(appointment.serviceId);
      const canCancel = state.session?.role === "admin" || state.settings.receptionCanCancel;
      return `<tr>
        <td>${escapeHTML(appointment.clientName)}</td>
        <td>${escapeHTML(appointment.phone)}</td>
        <td>${escapeHTML(service?.name || "Serviço removido")}</td>
        <td>${escapeHTML(appointment.date)}</td>
        <td>${escapeHTML(appointment.start)}</td>
        <td>${escapeHTML(appointment.end)}</td>
        <td>
          <select class="status-select" data-appointment-status="${escapeHTML(appointment.id)}" ${canCancel ? "" : "disabled"}>
            ${STATUS.map((status) => `<option ${status === appointment.status ? "selected" : ""}>${escapeHTML(status)}</option>`).join("")}
          </select>
        </td>
        <td>${escapeHTML(appointment.notes || "")}</td>
      </tr>`;
    }).join("")
    : `<tr><td colspan="8">Nenhum agendamento encontrado.</td></tr>`;
}

function renderServices() {
  $("#servicesList").innerHTML = state.services.map((service) => `
    <article class="item-card">
      <img src="${escapeHTML(service.photo)}" alt="${escapeHTML(service.name)}">
      <h3>${escapeHTML(service.name)}</h3>
      <span>${service.duration} min ${service.price ? "| R$ " + escapeHTML(service.price) : ""}</span>
      <p>${escapeHTML(service.description || "Sem descrição.")}</p>
      <strong>${service.active ? "Ativo" : "Inativo"}</strong>
      <div class="item-actions">
        <button class="secondary-button" data-edit-service="${escapeHTML(service.id)}" type="button">Editar</button>
        <button class="ghost-button" data-toggle-service="${escapeHTML(service.id)}" type="button">${service.active ? "Inativar" : "Ativar"}</button>
      </div>
    </article>
  `).join("");
}

function renderUsers() {
  $("#usersList").innerHTML = state.users.map((user) => `
    <article class="item-card">
      <h3>${escapeHTML(user.name)}</h3>
      <span>${escapeHTML(user.email)}</span>
      <strong>${user.role === "admin" ? "Administrador" : "Recepcionista"} | ${user.active ? "Ativo" : "Inativo"}</strong>
      <div class="item-actions">
        <button class="secondary-button" data-edit-user="${escapeHTML(user.id)}" type="button">Editar</button>
        <button class="ghost-button" data-toggle-user="${escapeHTML(user.id)}" type="button">${user.active ? "Inativar" : "Ativar"}</button>
      </div>
    </article>
  `).join("");
}

function renderSettings() {
  $("#startTime").value = state.settings.startTime;
  $("#endTime").value = state.settings.endTime;
  $("#slotInterval").value = state.settings.interval;
  $("#receptionCanCancel").checked = state.settings.receptionCanCancel;
  $$("input[name='workingDays']").forEach((input) => {
    input.checked = state.settings.workingDays.includes(Number(input.value));
  });
}

function renderAll() {
  hydrateShell();
  renderServiceSelect();
  renderDashboard();
  renderAppointments();
  renderServices();
  renderUsers();
  renderSettings();
}

function clearServiceForm() {
  $("#serviceId").value = "";
  $("#serviceForm").reset();
  $("#serviceActive").checked = true;
}

function clearUserForm() {
  $("#userId").value = "";
  $("#userForm").reset();
  $("#userActive").checked = true;
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function bindEvents() {
  $$(".nav-link").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$("[data-view-jump]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewJump)));
  $("#loginToggle").addEventListener("click", () => {
    if (state.session) {
      state.session = null;
      saveState();
      setView("schedule");
      toast("Sessão encerrada.");
    } else {
      $("#loginDialog").showModal();
    }
  });
  $$("[data-close-modal]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));

  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#loginEmail").value.trim().toLowerCase();
    const password = $("#loginPassword").value;
    const passwordHash = await hashPassword($("#loginPassword").value);
    const user = state.users.find((item) => (
      item.email.toLowerCase() === email
      && (item.passwordHash === passwordHash || item.password === password)
      && item.active
    ));
    if (!user) {
      toast("Email ou senha inválidos.");
      return;
    }
    if (user.password) {
      user.passwordHash = passwordHash;
      delete user.password;
    }
    state.session = { id: user.id, name: user.name, role: user.role };
    saveState();
    $("#loginDialog").close();
    setView("dashboard");
    toast("Login realizado.");
  });

  $("#bookingDate").addEventListener("change", () => {
    selectedTime = null;
    renderSlots();
  });
  $("#serviceSelect").addEventListener("change", () => {
    selectedTime = null;
    renderServicePreview();
  });
  $("#timeGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-time]");
    if (!button) return;
    selectedTime = button.dataset.time;
    $$(".time-button").forEach((item) => item.classList.toggle("selected", item === button));
    renderSelectedSlot();
  });
  $("#confirmBooking").addEventListener("click", () => {
    if (selectedTime) book(selectedTime);
  });
  $("#conflictBack").addEventListener("click", () => $("#conflictDialog").close());
  $("#conflictProceed").addEventListener("click", () => {
    if (pendingConflictBooking) {
      state.appointments.push(pendingConflictBooking);
      saveState();
      const confirmedStart = pendingConflictBooking.start;
      pendingConflictBooking = null;
      $("#conflictDialog").close();
      clearBookingForm();
      renderAll();
      toast(`Agendamento confirmado para ${confirmedStart} com override.`);
    }
  });

  $("#appointmentSearch").addEventListener("input", renderAppointments);
  $("#appointmentStatusFilter").addEventListener("change", renderAppointments);
  $("#appointmentsTable").addEventListener("change", (event) => {
    const id = event.target.dataset.appointmentStatus;
    if (!id) return;
    const appointment = state.appointments.find((item) => item.id === id);
    appointment.status = event.target.value;
    saveState();
    renderAll();
  });

  $("#serviceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = $("#serviceId").value || crypto.randomUUID();
    const existing = state.services.find((service) => service.id === id);
    const file = $("#servicePhoto").files[0];
    const photo = file ? await fileToDataURL(file) : existing?.photo || "assets/KarolMartinsLogo2.png";
    const payload = {
      id,
      name: $("#serviceName").value.trim(),
      duration: Number($("#serviceDuration").value),
      price: $("#servicePrice").value.trim(),
      photo,
      description: $("#serviceDescription").value.trim(),
      active: $("#serviceActive").checked
    };
    state.services = existing ? state.services.map((service) => service.id === id ? payload : service) : [...state.services, payload];
    saveState();
    clearServiceForm();
    renderAll();
    toast("Serviço salvo.");
  });
  $("#clearServiceForm").addEventListener("click", clearServiceForm);
  $("#servicesList").addEventListener("click", (event) => {
    const editId = event.target.dataset.editService;
    const toggleId = event.target.dataset.toggleService;
    if (editId) {
      const service = serviceById(editId);
      $("#serviceId").value = service.id;
      $("#serviceName").value = service.name;
      $("#serviceDuration").value = service.duration;
      $("#servicePrice").value = service.price || "";
      $("#serviceDescription").value = service.description || "";
      $("#serviceActive").checked = service.active;
    }
    if (toggleId) {
      const service = serviceById(toggleId);
      service.active = !service.active;
      saveState();
      renderAll();
    }
  });

  $("#userForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = $("#userId").value || crypto.randomUUID();
    const existing = state.users.find((user) => user.id === id);
    const passwordHash = $("#userPassword").value ? await hashPassword($("#userPassword").value) : existing?.passwordHash;
    if (!passwordHash) {
      toast("Defina uma senha para o novo usuário.");
      return;
    }
    const payload = {
      id,
      name: $("#userName").value.trim(),
      email: $("#userEmail").value.trim(),
      passwordHash,
      role: $("#userRole").value,
      active: $("#userActive").checked
    };
    state.users = existing ? state.users.map((user) => user.id === id ? payload : user) : [...state.users, payload];
    saveState();
    clearUserForm();
    renderAll();
    toast("Usuário salvo.");
  });
  $("#clearUserForm").addEventListener("click", clearUserForm);
  $("#usersList").addEventListener("click", (event) => {
    const editId = event.target.dataset.editUser;
    const toggleId = event.target.dataset.toggleUser;
    if (editId) {
      const user = state.users.find((item) => item.id === editId);
      $("#userId").value = user.id;
      $("#userName").value = user.name;
      $("#userEmail").value = user.email;
      $("#userPassword").value = "";
      $("#userRole").value = user.role;
      $("#userActive").checked = user.active;
    }
    if (toggleId) {
      const user = state.users.find((item) => item.id === toggleId);
      user.active = !user.active;
      saveState();
      renderAll();
    }
  });

  $("#settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.settings = {
      startTime: $("#startTime").value,
      endTime: $("#endTime").value,
      interval: Number($("#slotInterval").value),
      workingDays: $$("input[name='workingDays']:checked").map((input) => Number(input.value)),
      receptionCanCancel: $("#receptionCanCancel").checked
    };
    saveState();
    renderAll();
    toast("Configurações salvas.");
  });
}

function init() {
  $("#bookingDate").value = todayISO();
  bindEvents();
  renderAll();
  if (initSupabase()) {
    hydrateFromCloud();
  } else {
    toast("Modo local: configure o Supabase para sincronizar entre dispositivos.");
  }
}

init();
