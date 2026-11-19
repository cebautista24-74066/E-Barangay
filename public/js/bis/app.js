const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

let currentUser = null;
let mode = "resident";
let page = "Dashboard";
let csrfToken = document.querySelector('meta[name="csrf-token"]').content;
let darkMode = store.get("bis_theme", "light") === "dark";
let pageData = {};
let drrmPickedLocation = null;
let drrmDrawing = null; // { latlngs: [], drawLayer: L.LayerGroup, polygon: L.Polygon }
let drrmDrawLayer = null;
let drrmCenterLocationReady = false;
let renderVersion = 0;

const requestStatuses = ["Pending", "Processing", "Ready for Pickup", "Claimed", "Expired", "Rejected"];
const feedbackStatuses = ["Open", "In Review", "Resolved", "Closed"];
const residentNav = [
  ["Dashboard", "home"],
  ["My Profile", "user"],
  ["E-Services", "services"],
  ["My Requests", "requests"],
  ["My Activity", "reports"],
  ["Notifications", "bell"],
  ["Complaints & Feedback", "feedback"],
  ["Announcements", "announcement"],
  ["Events", "events"]
];
const adminNav = [
  ["Dashboard", "home"],
  ["Manage Residents", "user"],
  ["Manage Requests", "requests"],
  ["E-Services", "services"],
  ["Announcements", "announcement"],
  ["Complaints & Feedback", "feedback"],
  ["Events", "events"],
  ["Reports", "reports"],
  ["Audit Logs", "reports"],
  ["DRRM Map", "map"]
];

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => element.classList.remove("show"), 3000);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function initials(name) {
  return String(name ?? "").split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join("").toUpperCase();
}

function uiIcon(name) {
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-6h6v6"/>',
    user: '<circle cx="12" cy="7" r="3"/><path d="M5 21a7 7 0 0 1 14 0"/>',
    requests: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    services: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    announcement: '<path d="m4 14 11-5v10L4 14Z"/><path d="M15 9h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-3M7 15v5"/>',
    feedback: '<path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/>',
    events: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 3.1a4 4 0 0 1 0 7.8M21 21v-2a4 4 0 0 0-3-3.9"/>',
    phone: '<path d="M5 4h3l2 5-2 1.5a13 13 0 0 0 5.5 5.5L15 14l5 2v3a1 1 0 0 1-1 1C10.7 20 4 13.3 4 5a1 1 0 0 1 1-1Z"/>',
    reports: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
    bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.5-1H6v-2.6h.5A1.7 1.7 0 0 0 8 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5H15v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3M21 4v16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 15.5A8 8 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>',
    empty: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>'
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.empty}</svg>`;
}
function statusClass(status) {
  return String(status ?? "").toLowerCase().replace(/\s+/g, "-");
}

function statusBadge(status) {
  return `<span class="status ${escapeHtml(statusClass(status))}">${escapeHtml(status)}</span>`;
}

function updateCsrfToken(token) {
  if (typeof token === "string" && token) {
    csrfToken = token;
    document.querySelector('meta[name="csrf-token"]').content = token;
  }
}

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  headers.set("Cache-Control", "no-cache");
  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    headers.set("X-CSRF-TOKEN", csrfToken);
  } else if (options.method && options.method !== "GET") {
    headers.set("X-CSRF-TOKEN", csrfToken);
  }
  const response = await fetch(url, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store"
    });
    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok) {
      if (response.status === 403 && result?.message?.includes("account is inactive")) {
        window.location.reload();
      }

      const firstError = Object.values(result?.errors || {}).flat()[0];
      throw new Error(firstError || result?.message || `Request failed (${response.status}).`);
    }

    return { data: result, response };
}

async function submitAuthForm(form, endpoint, feedbackSelector) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  $(feedbackSelector).textContent = "";
  const formData = new FormData(form);
  const payload = form.id === "registerForm" ? formData : Object.fromEntries(formData);
  if (form.id === "loginForm") payload.remember = Boolean(payload.remember);

  try {
    const { data } = await api(endpoint, {
      method: "POST",
      body: payload instanceof FormData ? payload : JSON.stringify(payload)
    });
    updateCsrfToken(data.csrf_token);
    form.reset();
    login(data.user);
    toast(data.message);
  } catch (error) {
    $(feedbackSelector).textContent = error instanceof TypeError
      ? "Could not connect to the server. Please try again."
      : error.message;
  } finally {
    button.disabled = false;
  }
}

function showLoginForm() {
  $("#loginForm").classList.remove("hidden");
  $("#registerForm").classList.add("hidden");
  $("#forgotPasswordForm").classList.add("hidden");
  $("#resetPasswordForm").classList.add("hidden");
  $("#loginFeedback").textContent = "";
  $("#registerFeedback").textContent = "";
  $("#forgotFeedback").textContent = "";
  $("#resetFeedback").textContent = "";
}

function showRegisterForm() {
  $("#loginForm").classList.add("hidden");
  $("#registerForm").classList.remove("hidden");
  $("#forgotPasswordForm").classList.add("hidden");
  $("#resetPasswordForm").classList.add("hidden");
  $("#loginFeedback").textContent = "";
  $("#registerFeedback").textContent = "";
  $("#forgotFeedback").textContent = "";
  $("#resetFeedback").textContent = "";
  $("#registerName").focus();
}

function showForgotPasswordForm() {
  $("#loginForm").classList.add("hidden");
  $("#registerForm").classList.add("hidden");
  $("#resetPasswordForm").classList.add("hidden");
  $("#forgotPasswordForm").classList.remove("hidden");
  const email = $("#loginName").value.trim();
  $("#forgotEmail").value = email;
  $("#forgotEmail").removeAttribute("readonly");
  $("#forgotPasswordForm").querySelector('[type="submit"]').disabled = false;
  $("#forgotFeedback").textContent = "";
  $("#forgotFeedback").classList.remove("success");
  $("#forgotEmail").focus();
}

function showResetPasswordForm(token, email) {
  $("#landingView").classList.add("hidden");
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
  $("#loginForm").classList.add("hidden");
  $("#registerForm").classList.add("hidden");
  $("#forgotPasswordForm").classList.add("hidden");
  $("#resetPasswordForm").classList.remove("hidden");
  $("#resetToken").value = token;
  $("#resetEmail").value = email;
  $("#resetFeedback").textContent = "";
  $("#resetEmail").focus();
}

function applyTheme() {
  document.body.classList.toggle("dark-mode", darkMode);
  document.querySelectorAll(".theme-toggle").forEach(button => {
    button.innerHTML = uiIcon(darkMode ? "sun" : "moon");
    button.setAttribute("aria-label", darkMode ? "Switch to light mode" : "Switch to dark mode");
    button.title = darkMode ? "Switch to light mode" : "Switch to dark mode";
  });
}

function toggleTheme() {
  darkMode = !darkMode;
  store.set("bis_theme", darkMode ? "dark" : "light");
  document.body.classList.remove("theme-switching");
  void document.body.offsetWidth;
  document.body.classList.add("theme-switching");
  applyTheme();
  window.clearTimeout(window.themeSwitchTimer);
  window.themeSwitchTimer = window.setTimeout(() => {
    document.body.classList.remove("theme-switching");
  }, 520);
}

async function restoreSession() {
  try {
    const { data } = await api("/auth/session");
    if (data.user) login(data.user);
  } catch (error) {
    console.error("Session restoration failed:", error);
    toast(error.message || "Could not verify the current session.");
  }
}

function updateUser() {
  const name = currentUser.name;
  $("#topName").textContent = name;
  $("#topRole").textContent = currentUser.role;
  $("#topAvatar").textContent = initials(name);

}

function renderNav() {
  const links = mode === "admin" ? adminNav : residentNav;
  $("#navMenu").innerHTML = links.map(([label, icon]) =>
    `<button class="nav-link ${page === label ? "active" : ""}" data-page="${escapeHtml(label)}"><span>${uiIcon(icon)}</span>${escapeHtml(label)}</button>`
  ).join("");
}

function heading(title, description, actions = "") {
  return `<div class="page-heading"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="heading-actions">${actions}</div></div>`;
}

function greetingTitle() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const nameParts = currentUser.name.trim().split(/\s+/);
  const firstName = nameParts[0].toLowerCase() === "barangay" && nameParts.length > 1
    ? nameParts[1]
    : nameParts[0];

  return `${greeting}, ${firstName}!`;
}

function button(label, action, className = "primary-btn sm", attributes = "") {
  return `<button class="${className}" data-action="${escapeHtml(action)}" ${attributes}>${label}</button>`;
}

function stat(label, value, icon, color = "") {
  return `<article class="stat-card"><div class="stat-top"><span class="stat-icon ${color}">${icon}</span></div><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></article>`;
}

function emptyState(title, message) {
  return `<div class="empty-state">${uiIcon("empty")}<h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div>`;
}

function moduleCard(title, description, icon, target, metric, tone = "") {
  return `<button class="dashboard-module ${tone}" data-page="${escapeHtml(target)}">
    <span class="dashboard-module-icon">${icon}</span>
    <span class="dashboard-module-copy"><b>${escapeHtml(title)}</b><small>${escapeHtml(description)}</small></span>
    <span class="dashboard-module-meta"><strong>${escapeHtml(metric)}</strong><span>Open</span></span>
  </button>`;
}

function login(user) {
  currentUser = user;
  mode = user.role === "Administrator" ? "admin" : "resident";
  removeAskBot();
  $("#loginView").classList.add("hidden");
  $("#landingView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  updateUser();
  renderNav();
  go("Dashboard");
  updateNotificationIndicator();
}

async function updateNotificationIndicator() {
  try {
    const { data } = await api("/api/notifications");
    const indicator = $("#notificationBtn i");
    indicator.hidden = data.unread_count === 0;
    $("#notificationBtn").title = data.unread_count
      ? `${data.unread_count} unread notification${data.unread_count === 1 ? "" : "s"}`
      : "Notifications";
  } catch (error) {
    console.error("Notification count could not be loaded:", error);
  }
}

function announcementMarkup(announcement, admin = false) {
  const date = announcement.published_at
    ? new Date(announcement.published_at).toLocaleDateString()
    : "Not scheduled";
  return `<article class="announcement-item">
    <div class="announcement-thumb">${uiIcon(announcement.category === "Community" ? "user" : announcement.category === "System" ? "settings" : "announcement")}</div>
    <div><b>${escapeHtml(announcement.title)}</b><small>${escapeHtml(announcement.body)}</small><small>${escapeHtml(date)} · ${escapeHtml(announcement.category)}${announcement.is_published ? "" : " · Draft"}</small></div>
    ${announcement.category === "Event" && (announcement.event_date || announcement.event_time) ? `<small class="event-schedule">${announcement.event_date ? escapeHtml(announcement.event_date) : ""}${announcement.event_date && announcement.event_time ? " · " : ""}${announcement.event_time ? escapeHtml(String(announcement.event_time).slice(0, 5)) : ""}</small>` : ""}\n    ${admin ? `<div class="table-actions">${button("Edit", "edit-announcement", "secondary-btn sm", `data-id="${announcement.id}"`)}${button("Delete", "delete-announcement", "secondary-btn sm", `data-id="${announcement.id}"`)}</div>` : ""}
    ${announcement.category === "Event" && !admin ? `<div class="table-actions">${button("View details", "event-details", "primary-btn sm", `data-id="${announcement.id}"`)}</div>` : ""}
  </article>`;
}

function dashboard() {
  const announcements = pageData.announcements || [];
  const requests = pageData.requests || [];
  const feedback = pageData.feedback || [];
  const services = pageData.services || [];
  const events = announcements.filter(item => item.category === "Event");
  const pendingRequests = requests.filter(request => ["Pending", "Processing"].includes(request.status)).length;
  const completedRequests = requests.filter(request => request.status === "Completed").length;
  const openFeedback = feedback.filter(item => ["Open", "In Review"].includes(item.status)).length;
  const residentCount = pageData.residents?.length ?? 0;
  const unreadNotifications = pageData.unreadNotifications || 0;
  const stats = mode === "admin"
    ? `<div class="stat-grid">${stat("Total Residents", residentCount, uiIcon("user"))}${stat("Pending Requests", requests.filter(item => item.status === "Pending").length, uiIcon("requests"), "orange")}${stat("Open Concerns", openFeedback, uiIcon("feedback"), "purple")}${stat("Active Services", services.filter(service => service.is_active).length, uiIcon("services"), "green")}</div>`
    : `<div class="stat-grid">${stat("My Pending Requests", pendingRequests, uiIcon("requests"))}${stat("Completed Requests", completedRequests, uiIcon("events"), "green")}${stat("My Open Concerns", openFeedback, uiIcon("feedback"), "purple")}${stat("Available Services", services.length, uiIcon("services"), "orange")}</div>`;

  const modules = mode === "admin"
    ? [
      moduleCard("Manage Residents", "Resident accounts and access", uiIcon("user"), "Manage Residents", residentCount, "blue"),
      moduleCard("Manage Requests", "Review and update submissions", uiIcon("requests"), "Manage Requests", requests.length, "green"),
      moduleCard("Manage E-Services", "Services, requirements, procedures", uiIcon("services"), "E-Services", services.length, "gold"),
      moduleCard("Announcements", "Publish barangay updates", uiIcon("announcement"), "Announcements", announcements.length, "purple"),
      moduleCard("Complaints & Feedback", "Review community concerns", uiIcon("feedback"), "Complaints & Feedback", openFeedback, "rose"),
      moduleCard("Reports", "Request activity and CSV export", uiIcon("reports"), "Reports", "View reports", "teal"),
      moduleCard("Audit Logs", "Review system activity", uiIcon("reports"), "Audit Logs", "View logs", "slate"),
      moduleCard("System Information", "Account and display settings", uiIcon("settings"), "Settings", "Settings", "slate")
    ].join("")
    : [
      moduleCard("E-Services", "View official requirements and apply", uiIcon("services"), "E-Services", services.length, "blue"),
      moduleCard("My Requests", "Track status and request history", uiIcon("requests"), "My Requests", pendingRequests ? `${pendingRequests} active` : requests.length, "green"),
      moduleCard("Notifications", "Read request status updates", uiIcon("bell"), "Notifications", unreadNotifications ? `${unreadNotifications} unread` : "All caught up", "gold"),
      moduleCard("Complaints & Feedback", "Send concerns or suggestions", uiIcon("feedback"), "Complaints & Feedback", openFeedback ? `${openFeedback} open` : "Send message", "rose"),
      moduleCard("Announcements", "Barangay news and public notices", uiIcon("announcement"), "Announcements", announcements.length, "purple"),
      moduleCard("Community Events", "Schedules and barangay activities", uiIcon("events"), "Events", events.length, "teal")
    ].join("");

  const recentRequests = requests.slice(0, 4).map(request => `<tr>
    <td>${escapeHtml(request.reference_code)}</td>
    ${mode === "admin" ? `<td>${escapeHtml(request.resident?.name || "")}</td>` : ""}
    <td>${escapeHtml(request.service?.name || "")}</td>
    <td>${statusBadge(request.status)}</td>
  </tr>`).join("");
  const requestColumns = mode === "admin"
    ? "<th>Reference</th><th>Resident</th><th>Service</th><th>Status</th>"
    : "<th>Reference</th><th>Service</th><th>Status</th>";

  return `${heading(greetingTitle(), "Here's what's happening in your barangay.")}
    <div class="hero"><div><span class="eyebrow" style="color:#397bb9">BARANGAY HUMAYINGAN</span><h2>A safer, cleaner, stronger community.</h2><p>Access local information, selected barangay services, and request updates in one place.</p></div><div class="hero-badge"><b>Community first</b>Transparent services. Better connections. One barangay.</div></div>
    ${stats}
    <section class="dashboard-module-section">
      <div class="dashboard-section-heading"><div><span class="eyebrow">YOUR WORKSPACE</span><h2>${mode === "admin" ? "Administration Modules" : "Resident Services"}</h2><p>${mode === "admin" ? "Choose a module to manage barangay information and service activity." : "Choose a service to submit requests, follow updates, and connect with your barangay."}</p></div></div>
      <div class="dashboard-module-grid">${modules}</div>
    </section>
    <div class="dashboard-columns">
      <section class="panel"><div class="panel-head"><h3>${mode === "admin" ? "Recent Service Requests" : "My Recent Requests"}</h3><a href="#" data-page="${mode === "admin" ? "Manage Requests" : "My Requests"}">View all</a></div>
        <div class="table-wrap"><table><thead><tr>${requestColumns}</tr></thead><tbody>${recentRequests}</tbody></table></div>
        ${requests.length ? "" : emptyState("No requests yet", "Service requests will appear here once submitted.")}</section>
      <section class="panel"><div class="panel-head"><h3>Recent Announcements</h3><a href="#" data-page="Announcements">View all</a></div><div class="announcement-list">${announcements.slice(0, 3).map(item => announcementMarkup(item)).join("") || emptyState("No announcements yet", "New barangay notices will appear here.")}</div></section>
    </div>`;
}

function profilePage() {
  return `${heading("My Profile", "Your account information.")}<section class="panel">
    <div class="profile-banner"><div><h3>${escapeHtml(currentUser.name)}</h3><p>${escapeHtml(currentUser.role)} · Barangay Humayingan</p></div><div class="profile-actions">${button("Edit Profile", "edit-profile", "secondary-btn sm")}${button("Change Password", "change-password", "secondary-btn sm")}${button("Account Settings", "account-settings", "secondary-btn sm")}</div></div>
    <div class="detail-list"><div class="key">Full Name</div><div class="value">${escapeHtml(currentUser.name)}</div><div class="key">Email Address</div><div class="value">${escapeHtml(currentUser.email)}</div><div class="key">Account Role</div><div class="value">${escapeHtml(currentUser.role)}</div></div>
  </section>`;
}

function servicesPage() {
  const services = (pageData.services || []).filter(service => service.is_active);
  const admin = mode === "admin";
  const cards = services.map(service => `<article class="service-card">
    <span class="stat-icon">${uiIcon("services")}</span><h3>${escapeHtml(service.name)}</h3><p>${escapeHtml(service.description)}</p>
    <p class="service-fee"><b>Service fee</b><br>${Number(service.service_fee || 0) === 0 ? "Free" : `₱${Number(service.service_fee).toFixed(2)}`}</p>
    ${service.requirements ? `<p><b>Requirements</b><br>${escapeHtml(service.requirements).replace(/\n/g, "<br>")}</p>` : ""}
    ${service.instructions ? `<p><b>Procedure</b><br>${escapeHtml(service.instructions).replace(/\n/g, "<br>")}</p>` : ""}
    ${admin
      ? `<div class="service-actions-menu"><button type="button" class="service-more-btn" data-action="toggle-service-menu" aria-label="More service actions">⋮</button><div class="service-actions-options hidden">${button("Edit", "edit-service", "service-action-option", `data-id="${service.id}"`)}${button(service.is_active ? "Deactivate" : "Activate", "toggle-service", "service-action-option", `data-id="${service.id}" data-active="${service.is_active}"`)}${button("Edit Template", "edit-template", "service-action-option", `data-id="${service.id}"`)}${button("Delete", "delete-service", "danger-btn service-action-option", `data-id="${service.id}"`)}</div></div>`
      : button("Request this service →", "request-service", "primary-btn sm", `data-id="${service.id}"`)}
  </article>`).join("");
  return `${heading(admin ? "Manage E-Services" : "E-Services", admin ? "Publish and maintain the barangay's official services and requirements." : "Review official service requirements and submit selected requests.", admin ? button("+ Add Service", "new-service") : "")}
    <div class="service-grid">${cards || emptyState("No services available", admin ? "Add an official barangay service to publish it." : "The barangay has not published any services yet.")}</div>`;
}

function requestsPage(admin = false) {
  const requests = pageData.requests || [];
  const rows = requests.map(request => `<tr>
    <td>${escapeHtml(request.reference_code)}</td>
    ${admin ? `<td>${escapeHtml(request.resident?.name || "")}<br><small>${escapeHtml(request.resident?.email || "")}</small></td>` : ""}
    <td>${escapeHtml(request.service?.name || "")}</td>
    <td>${escapeHtml(new Date(request.created_at).toLocaleDateString())}</td>
    <td>${statusBadge(request.status)}</td>
    <td>${request.pickup_deadline ? `<small>Claim before ${escapeHtml(new Date(request.pickup_deadline).toLocaleDateString())}</small><br>` : ""}<div class="table-actions">${button("Details", "request-details", "secondary-btn sm", `data-id="${request.id}"`)}${admin ? (request.archived_at ? button("Restore", "restore-request", "secondary-btn sm", `data-id="${request.id}"`) : button("Archive", "archive-request", "danger-btn sm", `data-id="${request.id}"`)) : ""}</div></td>
  </tr>`).join("");
  const statusOptions = [`<option value="">All statuses</option>`, ...requestStatuses.map(status => `<option>${status}</option>`)].join("");
  return `${heading(admin ? "Manage Requests" : "My Requests", admin ? "Review submissions and record request status updates." : "Track the status and history of your requests.", admin ? "" : button("+ New Request", "new-request"))}
    <section class="panel"><div class="filters"><input id="requestSearch" placeholder="Search reference, resident, or service..."><select id="requestStatus">${statusOptions}</select>${admin ? `<select id="requestArchive"><option value="active" ${pageData.requestArchive === "active" || !pageData.requestArchive ? "selected" : ""}>Active Requests</option><option value="archived" ${pageData.requestArchive === "archived" ? "selected" : ""}>Archived Requests</option><option value="all" ${pageData.requestArchive === "all" ? "selected" : ""}>All Requests</option></select>` : ""}</div>
    <div class="table-wrap"><table><thead><tr><th>Reference</th>${admin ? "<th>Resident</th>" : ""}<th>Service</th><th>Date Submitted</th><th>Status</th><th>Pickup / Details</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${requests.length ? "" : emptyState("No requests yet", "Submitted service requests and their status history will appear here.")}</section>`;
}

function announcementsPage() {
  const admin = mode === "admin";
  const announcements = pageData.announcements || [];
  return `${heading("Announcements", "Barangay news, activities, schedules, and public notices.", admin ? button("+ New Announcement", "new-announcement") : "")}
    <section class="panel"><div class="announcement-list">${announcements.map(item => announcementMarkup(item, admin)).join("") || emptyState("No announcements yet", "The barangay has not published any notices.")}</div></section>`;
}

function eventsPage() {
  const events = (pageData.announcements || []).filter(item => item.category === "Event");
  return `${heading("Events", "Barangay activities and upcoming community schedules.", mode === "admin" ? button("+ Add Event", "new-event", "primary-btn sm") : "")}
    <section class="panel"><div class="announcement-list">${events.map(item => announcementMarkup(item, mode === "admin")).join("") || emptyState("No upcoming events", "Published event announcements will appear here.")}</div></section>`;
}

function viewEventDetails(id) {
  const event = (pageData.announcements || []).find(item => String(item.id) === String(id) && item.category === "Event");
  if (!event) throw new Error("The selected event could not be found.");
  const date = event.event_date ? new Date(`${event.event_date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "Date to be announced";
  const time = event.event_time ? new Date(`1970-01-01T${String(event.event_time).slice(0, 5)}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Time to be announced";
  const detail = (label, value, icon) => `<div class="event-detail-item"><span class="event-detail-icon">${uiIcon(icon)}</span><div><small>${label}</small><b>${escapeHtml(value || "To be announced")}</b></div></div>`;
  const content = `<div class="event-detail-view"><div class="event-detail-meta"><span class="event-detail-kicker">${uiIcon("events")} COMMUNITY EVENT</span></div><div class="event-detail-grid">${detail("Date", date, "calendar")}${detail("Time", time, "clock")}${detail("Venue / Location", event.event_location, "pin")}${detail("Organizer", event.event_organizer, "users")}${detail("Contact", event.event_contact, "phone")}</div><div class="event-detail-description"><small>EVENT DETAILS</small><p>${escapeHtml(event.body).replace(/\n/g, "<br>")}</p></div></div>`;
  openReadOnlyModal(event.title, content);
}

function drrmPage() {
  const drrm = pageData.drrm || { households: [], evacuation_centers: [], summary: {} }; const summary = drrm.summary || {};
  const capacity = Number(summary.evacuation_capacity || 0); const occupied = Number(summary.evacuation_occupied || 0); const available = Math.max(0, capacity - occupied);
  const rows = drrm.households.map(item => `<tr data-drrm-row="household" data-id="${item.id}"><td>${escapeHtml(item.household_number)}</td><td>${escapeHtml(item.address)}</td><td>${escapeHtml(item.sitio || item.purok || '')}</td><td>${statusBadge(item.priority_level)}</td><td>${item.resident_count || item.members?.length || 0}</td><td><div class="table-actions">${button('Edit', 'edit-drrm-household', 'secondary-btn sm', `data-id="${item.id}"`)}${button('Delete', 'delete-drrm-household', 'danger-btn sm', `data-id="${item.id}"`)}</div></td></tr>`).join('');
  const centerRows = drrm.evacuation_centers.map(center => { const cap = Number(center.capacity || 0); const occ = Number(center.current_occupants || 0); const free = Math.max(0, cap - occ); const activeRecords = (center.occupancy_records || []).filter(r => r.status === 'Checked In'); return `<tr><td>${escapeHtml(center.name)}</td><td>${cap || 'N/A'}</td><td>${occ}</td><td>${cap ? free : 'N/A'}</td><td>${statusBadge(center.status || (free === 0 ? 'Full' : 'Open'))}</td><td><div class="table-actions">${button('Check in household', 'check-in-drrm-household', 'primary-btn sm', `data-id="${center.id}"`)}${activeRecords.length ? button('View occupants', 'view-drrm-occupants', 'secondary-btn sm', `data-id="${center.id}"`) : ''}${button('Edit', 'edit-drrm-center', 'secondary-btn sm', `data-id="${center.id}"`)}${button('Delete', 'delete-drrm-center', 'danger-btn sm', `data-id="${center.id}"`)}</div></td></tr>`; }).join('');
  const drrmIcons = { households: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-6h6v6"/></svg>', priority: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 19H3L12 3Z"/><path d="M12 9v4M12 16h.01"/></svg>', vulnerable: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M10 8h3l1 4h-3l-1 4h5a4 4 0 1 1-1 2"/><path d="M10 8 8 12l-3 1"/><circle cx="15" cy="19" r="1.5"/></svg>', slots: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/><circle cx="12" cy="12" r="9"/></svg>' };
  return `${heading('DRRM Priority Map', 'Monitor vulnerable households and evacuation capacity from one map.')}
    <div class="stats-grid drrm-summary">${stat('Total households', summary.total_households || 0, drrmIcons.households, 'blue')}${stat('Vulnerable residents', summary.total_vulnerable_residents || 0, drrmIcons.vulnerable, 'purple')}${stat('Available evacuation slots', available, drrmIcons.slots, 'green')}</div>
    <div class="drrm-action-bar">${button('+ Add Household', 'new-household')}${button('+ Add Center', 'new-drrm-center')}${button('Refresh map', 'refresh')}</div>
    <section class="panel drrm-map-panel"><div class="drrm-map-toolbar"><div class="drrm-mode-buttons"><button class="secondary-btn sm" data-action="drrm-view-mode">View Only</button><button class="secondary-btn sm" data-action="drrm-select-mode">Select Location</button></div><div class="drrm-map-actions"><button class="secondary-btn sm" data-action="drrm-fit">Zoom to markers</button><button class="secondary-btn sm" data-action="drrm-fullscreen">Fullscreen</button></div></div><div id="drrmMap" data-roads-url="${escapeHtml(window.eBarangayConfig?.roadsGeoJsonUrl || '')}" style="height:520px;border-radius:16px;overflow:hidden"></div></section>
    <section class="panel"><div class="filters drrm-filters"><input id="drrmSearch" placeholder="Search household, address, or sitio..."><select id="drrmPriority"><option value="">All priorities</option><option>Critical</option><option>High</option><option>Moderate</option><option>Low</option></select></div><div class="panel-head"><h3>Priority Households</h3></div><div class="table-wrap"><table><thead><tr><th>Household</th><th>Address</th><th>Sitio/Purok</th><th>Priority</th><th>Residents</th><th>Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="6">No DRRM household records yet.</td></tr>`}</tbody></table></div></section>
    <section class="panel"><div class="panel-head"><h3>Evacuation Capacity</h3><span class="muted">${summary.evacuation_centers || 0} active centers</span></div><div class="table-wrap"><table><thead><tr><th>Center</th><th>Capacity</th><th>Occupied</th><th>Available</th><th>Status</th><th>Actions</th></tr></thead><tbody>${centerRows || '<tr><td colspan="6">No evacuation centers.</td></tr>'}</tbody></table></div></section>`;
}

function drrmDistanceKm(a, b) { const rad = Math.PI / 180; const dLat = (b[0] - a[0]) * rad; const dLng = (b[1] - a[1]) * rad; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }

function renderDrrmMapLegacy() {
  const mapElement = $('#drrmMap'); if (!mapElement || typeof L === 'undefined') return; const drrm = pageData.drrm || {}; const households = drrm.households || []; const centers = drrm.evacuation_centers || [];
  const map = L.map(mapElement).setView([13.9965, 120.6732], 15); map.setMaxBounds([[13.975, 120.645], [14.020, 120.700]]); map.options.maxBoundsViscosity = .85; L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagery © Esri' });
  const streetLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' });
  const roadOverlay = L.layerGroup().addTo(map);
  const buildingOverlay = L.layerGroup().addTo(map);
  const householdLayer = L.layerGroup().addTo(map); const householdMarkers = []; const centerLayer = L.layerGroup().addTo(map); L.control.layers({ Satellite: satelliteLayer, Streets: streetLayer }, { Roads: roadOverlay, Buildings: buildingOverlay, Households: householdLayer, 'Evacuation Centers': centerLayer }, { collapsed: false }).addTo(map);
  const roadsUrl = mapElement.dataset.roadsUrl;
  const buildingsUrl = window.eBarangayConfig?.buildingsGeoJsonUrl;
  if (roadsUrl && window.jQuery) {
    window.jQuery.getJSON(roadsUrl)
      .done(data => {
        L.geoJSON(data, { style: { color: '#ffffff', weight: 3, opacity: 0.96, lineCap: 'round', lineJoin: 'round' }, attribution: '© Esri' }).addTo(roadOverlay);
      })
      .fail((jqXHR, textStatus, errorThrown) => console.error('Unable to load roads GeoJSON:', roadsUrl, textStatus, errorThrown));
  } else {
    console.error('Roads GeoJSON URL or jQuery is missing.');
  }
  if (buildingsUrl && window.jQuery) {
    window.jQuery.getJSON(buildingsUrl)
      .done(data => {
        const buildings = L.geoJSON(data, {
          filter: feature => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type),
          style: { color: '#334155', weight: 1, opacity: 0.9, fillColor: '#f8fafc', fillOpacity: 0.42 },
          onEachFeature: (feature, layer) => layer.on('click', event => {
            drrmPickedLocation = { latitude: event.latlng.lat, longitude: event.latlng.lng };
            L.popup().setLatLng(event.latlng).setContent('<b>Building selected</b><br><button class="primary-btn sm" data-action="new-household" data-building-add="true">Add Household</button>').openOn(map);
          })
        }).addTo(buildingOverlay);
        if (!buildings.getLayers().length) console.error('Buildings GeoJSON loaded but contains no Polygon or MultiPolygon features:', buildingsUrl);
      })
      .fail((jqXHR, textStatus, errorThrown) => console.error('Unable to load buildings GeoJSON:', buildingsUrl, textStatus, errorThrown));
  } else console.error('Buildings GeoJSON URL or jQuery is missing:', buildingsUrl);
  const legendControl = L.control({ position: 'bottomleft' });
  legendControl.onAdd = () => { const div = L.DomUtil.create('div', 'drrm-map-legend leaflet-control'); div.innerHTML = '<strong>Legend</strong><span><i class="legend-evacuation"><svg viewBox="0 0 24 24"><path d="M12 21s7-3.5 7-9V5l-7-3-7 3v7c0 5.5 7 9 7 9Z"/><path d="M12 8v5M9.5 10.5h5"/></svg></i> Evacuation Center</span><hr><strong>Household Priority</strong><span><i class="legend-dot critical"></i> Critical <i class="legend-dot high"></i> High <i class="legend-dot moderate"></i> Moderate <i class="legend-dot low"></i> Low</span>'; L.DomEvent.disableClickPropagation(div); return div; }; legendControl.addTo(map);
  const legendElement = map.getContainer().querySelector('.drrm-map-legend');
  if (legendElement) legendElement.innerHTML = '<strong>Legend</strong><strong>Household Risk</strong><span><i class="legend-dot critical"></i> Critical</span><span><i class="legend-dot high"></i> High</span><span><i class="legend-dot moderate"></i> Moderate</span><span><i class="legend-dot low"></i> Low</span><hr><span><i class="legend-dot evacuation"></i> Evacuation Center</span>';
  let mode = 'view'; let drawPoints = [];
  const setMode = next => { mode = next; map.getContainer().classList.toggle('drrm-drawing', next !== 'view'); if (next === 'view') map.doubleClickZoom.enable(); else map.doubleClickZoom.disable(); toast(next === 'select-center' ? 'Click the map to place the evacuation center.' : next === 'select' ? 'Select Location mode enabled.' : 'View Only mode enabled.'); };
  window.drrmMapActions = { map, householdLayer, householdMarkers, centerLayer, setMode, fit: () => { const group = L.featureGroup([householdLayer, centerLayer]); if (group.getLayers().length) map.fitBounds(group.getBounds().pad(.1)); }, locate: () => navigator.geolocation?.getCurrentPosition(pos => map.setView([pos.coords.latitude, pos.coords.longitude], 17), () => toast('Location access was not available.')) };
  map.on('click', event => { if (mode === 'select-center') { drrmCenterLocationReady = true; drrmPickedLocation = { latitude: event.latlng.lat, longitude: event.latlng.lng }; setMode('view'); L.popup().setLatLng(event.latlng).setContent('<b>Evacuation center location selected</b><br>Click + Add Center again to continue.').openOn(map); toast(`Center location selected: ${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`); return; } if (mode === 'select') { drrmPickedLocation = { latitude: event.latlng.lat, longitude: event.latlng.lng }; setMode('view'); L.popup().setLatLng(event.latlng).setContent('<b>Selected location</b><br>Click Add Household to use this point.').openOn(map); return; } });
  const nearestCenter = h => centers.reduce((best, c) => { const dist = drrmDistanceKm([Number(h.latitude), Number(h.longitude)], [Number(c.latitude), Number(c.longitude)]); return !best || dist < best.distance ? { center: c, distance: dist } : best; }, null); const colors = { Critical: '#dc2626', High: '#ea580c', Moderate: '#ca8a04', Low: '#16a34a' };
  map.on('zoomend', () => { const radius = Math.max(2, Math.min(5, (map.getZoom() - 11) * 0.7)); householdMarkers.forEach(marker => marker.setRadius(radius)); }); setTimeout(() => map.fire('zoomend'), 0);
  households.forEach(h => { const near = nearestCenter(h); const popup = `<b>${escapeHtml(h.household_number)}</b><br>${escapeHtml(h.address || '')}<br>Sitio/Purok: ${escapeHtml(h.sitio || h.purok || 'Not specified')}<br>Priority: ${escapeHtml(h.priority_level)}<hr>Residents: ${h.resident_count || 0}<br>Seniors: ${h.senior_count || 0} · PWD: ${h.pwd_count || 0}<br>Bedridden: ${h.bedridden_count || 0} · Pregnant: ${h.pregnant_count || 0}<br>Infants: ${h.infant_count || 0}<br>Medical/rescue notes: ${escapeHtml(h.notes || 'None')}${near ? `<br>Nearest center: ${escapeHtml(near.center.name)}<br>Distance: ${near.distance.toFixed(2)} km` : ''}<br><br>${button('Edit', 'edit-drrm-household', 'secondary-btn sm', `data-id="${h.id}"`)} ${button('Delete', 'delete-drrm-household', 'danger-btn sm', `data-id="${h.id}"`)}`; const marker = L.circleMarker([h.latitude, h.longitude], { radius: 8, color: colors[h.priority_level] || colors.Low, fillColor: colors[h.priority_level] || colors.Low, fillOpacity: .9 }).bindPopup(popup); marker.drrmData = h; marker.addTo(householdLayer); householdMarkers.push(marker); });
  centers.forEach(c => { const cap = Number(c.capacity || 0); const occ = Number(c.current_occupants || 0); const free = Math.max(0, cap - occ); const status = c.status || (free === 0 && cap ? 'Full' : 'Open'); L.marker([c.latitude, c.longitude]).bindPopup(`<b>${escapeHtml(c.name)}</b><br>${escapeHtml(c.address)}<br>Capacity: ${cap || 'Not set'}<br>Occupied: ${occ}<br>Available: ${cap ? free : 'Not set'}<br>Status: ${escapeHtml(status)}<br><br>${button('Edit', 'edit-drrm-center', 'secondary-btn sm', `data-id="${c.id}"`)} ${button('Delete', 'delete-drrm-center', 'danger-btn sm', `data-id="${c.id}"`)}`).addTo(centerLayer); });
  requestAnimationFrame(() => { map.invalidateSize(); const layers = [...centerLayer.getLayers()]; if (layers.length) { const group = L.featureGroup(layers); map.fitBounds(group.getBounds().pad(.15), { maxZoom: 16 }); } });
  applyDrrmFilters();
}

function applyDrrmFilters() { const drrm = pageData.drrm || {}; const query = ($('#drrmSearch')?.value || '').toLowerCase(); const priority = $('#drrmPriority')?.value || ''; $$('#pageContent tbody tr[data-drrm-row="household"]').forEach(row => { const item = (drrm.households || []).find(h => String(h.id) === row.dataset.id); const show = item && (!query || row.textContent.toLowerCase().includes(query)) && (!priority || item.priority_level === priority); row.classList.toggle('hidden', !show); }); if (!window.drrmMapActions) return; window.drrmMapActions.householdMarkers.forEach(layer => { const item = layer.drrmData; const text = `${item.household_number} ${item.address || ''} ${item.sitio || item.purok || ''}`.toLowerCase(); const show = (!query || text.includes(query)) && (!priority || item.priority_level === priority); if (show) window.drrmMapActions.householdLayer.addLayer(layer); else window.drrmMapActions.householdLayer.removeLayer(layer); }); }
function residentsPage() {
  const residents = pageData.residents || [];
  const rows = residents.map(resident => "<tr><td>" + resident.id + "</td><td>" + escapeHtml(resident.name) + "</td><td>" + escapeHtml(resident.email) + "</td><td>" + statusBadge(resident.verification_status === "pending" ? "Pending Verification" : resident.is_active ? "Active" : "Inactive") + "</td><td><div class='table-actions'>" + (resident.verification_status === "pending" ? button("View Proof", "view-resident-proof", "secondary-btn sm", "data-id='" + resident.id + "'") + button("Approve", "approve-resident", "primary-btn sm", "data-id='" + resident.id + "'") + button("Reject", "reject-resident", "danger-btn sm", "data-id='" + resident.id + "'") : button(resident.is_active ? "Deactivate" : "Activate", "toggle-resident", "secondary-btn sm", "data-id='" + resident.id + "' data-active='" + resident.is_active + "'") + button("Delete", "delete-resident", "danger-btn sm", "data-id='" + resident.id + "'")) + "</div></td></tr>").join("");
  return `${heading("Manage Residents", "Review database accounts and control resident access.", mode === "admin" ? button("+ Add Resident", "new-resident", "primary-btn sm") : "")}<section class="panel">
    <div class="filters"><input id="residentSearch" placeholder="Search by database ID, name, or email..."></div>
    <div class="table-wrap"><table class="residents-table"><thead><tr><th>ID</th><th>Full Name</th><th>Email</th><th>Account Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${residents.length ? "" : emptyState("No resident accounts", "Registered resident accounts will appear here.")}</section>`;
}

function feedbackPage() {
  const admin = mode === "admin";
  const feedback = pageData.feedback || [];
  const rows = feedback.map(item => `<tr>
    <td><div class="feedback-subject"><b>${escapeHtml(item.type)}</b><span>${escapeHtml(item.subject)}</span>${admin ? `<small>${escapeHtml(item.resident?.name || "")}</small>` : ""}</div></td>
    <td>${escapeHtml(new Date(item.created_at).toLocaleDateString())}</td><td>${statusBadge(item.status)}</td>
    <td>${button("View", "feedback-details", "secondary-btn sm", `data-id="${item.id}"`)}</td></tr>`).join("");
  return `${heading("Complaints & Feedback", admin ? "Review resident concerns and update their handling status." : "Send a complaint, suggestion, or feedback to the Barangay Office.", admin ? "" : button("+ Send a Message", "new-feedback"))}
    <section class="panel feedback-panel"><div class="table-wrap"><table class="feedback-table"><thead><tr><th>Subject</th><th>Date</th><th>Status</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${feedback.length ? "" : emptyState("No messages yet", "Submitted complaints, suggestions, and feedback will appear here.")}</section>`;
}
function notificationsPage() {
  const notifications = pageData.notifications || [];
  const rows = notifications.map(notification => {
    const details = notification.data || {};
    return `<article class="announcement-item ${notification.read_at ? "" : "notification-unread"}">
      <div class="announcement-thumb">${uiIcon("bell")}</div>
      <div><b>${escapeHtml(details.message || "Barangay system notification")}</b><small>${escapeHtml(new Date(notification.created_at).toLocaleString())}</small>
      ${details.reference_code ? `<small>Reference: ${escapeHtml(details.reference_code)}</small>` : ""}</div>
      ${notification.read_at ? statusBadge("Read") : button("Mark as read", "mark-notification-read", "secondary-btn sm", `data-id="${notification.id}"`)}
    </article>`;
  }).join("");
  return `${heading("Notifications", "Updates about your service requests and barangay transactions.")}
    <section class="panel"><div class="announcement-list">${rows || emptyState("You're all caught up", "Request updates and other notifications will appear here.")}</div></section>`;
}

function reportsPage() {
  const report = pageData.report || {};
  const statusCounts = report.requests_by_status || {};
  const statuses = [...new Set([...requestStatuses, ...Object.keys(statusCounts)])];
  const total = Number(report.total_requests || 0);
  const statusDescriptions = { Pending: "Awaiting review", Processing: "Being processed", "Ready for Pickup": "Available to claim", Claimed: "Successfully claimed", Expired: "Pickup window passed", Rejected: "Request not approved" };
  const statusCards = statuses.map(status => {
    const count = Number(statusCounts[status] || 0);
    return `<article class="report-status-card report-${statusClass(status)}"><div class="report-status-card-top"><span class="report-status-dot"></span>${statusBadge(status)}</div><strong>${count}</strong><small>${escapeHtml(statusDescriptions[status] || "Request records")}</small></article>`;
  }).join("");
  const services = (report.requests_by_service || []).map(item => `<tr><td>${escapeHtml(item.service)}</td><td>${Number(item.total)}</td></tr>`).join("");
  const attention = [
    ["Ready for Pickup", Number(statusCounts["Ready for Pickup"] || 0), "Residents can claim these requests."],
    ["Expiring Soon", Number(report.expiring_soon || 0), "Pickup deadlines are approaching."],
    ["Rejected", Number(statusCounts.Rejected || 0), "Review rejected requests and notes."]
  ];
  return `${heading("Reports", "Monitor service activity and export request records.", button("Export Requests CSV", "export-csv", "secondary-btn"))}
    <div class="reports-grid">${stat("Total Residents", report.total_residents || 0, uiIcon("user"))}${stat("Published Services", report.total_services || 0, uiIcon("services"), "purple")}${stat("Total Requests", total, uiIcon("requests"), "green")}</div>
    <div class="dashboard-columns reports-panels"><section class="panel report-panel"><div class="panel-head"><div><h3>Request status overview</h3><p class="muted">Track every request from submission to pickup.</p></div></div><div class="report-status-grid">${statusCards}</div><div class="request-flow"><span>Pending</span><i>→</i><span>Processing</span><i>→</i><span>Ready for Pickup</span><i>→</i><span>Claimed</span></div></section>
    <section class="panel report-panel"><div class="panel-head"><div><h3>Requests by service</h3><p class="muted">Compare demand across published services.</p></div></div><div class="table-wrap report-table-wrap"><table class="report-table"><thead><tr><th>Service</th><th>Requests</th></tr></thead><tbody>${services || `<tr><td colspan="2"><div class="report-empty">No request records yet.</div></td></tr>`}</tbody></table></div></section></div>`;
}

function auditLogsPage() { const data = pageData.auditLogs || { logs: { data: [] } }; const rows = (data.logs.data || []).map(log => `<tr><td>${escapeHtml(log.user?.name || "System")}</td><td>${escapeHtml(log.action)}</td><td>${escapeHtml(log.module)}</td><td>${escapeHtml(log.description || "")}</td><td>${escapeHtml(new Date(log.created_at).toLocaleString())}</td><td>${statusBadge(log.status)}</td></tr>`).join(""); return `${heading(mode === "admin" ? "Audit Logs" : "My Activity", mode === "admin" ? "Review system activity." : "Review your account activity.", mode === "admin" ? button("Print / Save PDF", "export-audit-pdf", "secondary-btn") : "")}<section class="panel"><form id="auditLogFilters" class="filters"><input type="date" name="from" value="${escapeHtml(pageData.auditFilters?.from || "")}"><input type="date" name="to" value="${escapeHtml(pageData.auditFilters?.to || "")}"><button type="submit" class="primary-btn sm">Apply Filter</button><button type="button" class="secondary-btn sm" data-action="clear-audit-filters">Clear</button></form><div class="table-wrap"><table><thead><tr><th>User</th><th>Action</th><th>Module</th><th>Description</th><th>Date/Time</th><th>Status</th></tr></thead><tbody>${rows || `<tr><td colspan="6">No audit records found.</td></tr>`}</tbody></table></div></section>`; }

function settingsPage() {
  const admins = mode === "admin" ? (pageData.admins || []) : [];
  const adminList = admins.map(admin => { const isSelf = admin.email === currentUser?.email; const actions = isSelf ? `<small class="admin-current-label">Current account</small>` : `<div class="admin-account-actions">${button(admin.is_active ? "Deactivate" : "Activate", "toggle-admin", "secondary-btn sm", `data-id="${admin.id}"`)}${button("Delete", "delete-admin", "danger-btn sm", `data-id="${admin.id}"`)}</div>`; return `<div class="admin-account-row"><div><b>${escapeHtml(admin.name)}</b><small>${escapeHtml(admin.email)}</small></div><div class="admin-account-meta">${statusBadge(admin.is_active ? "Active" : "Inactive")}${actions}</div></div>`; }).join("");
  const adminTools = mode === "admin" ? `<h3 style="margin-top:24px">Administrator access</h3><p class="muted" style="margin-top:8px">Create and review trusted administrator accounts. This section is available only to current administrators.</p><button class="secondary-btn" data-action="new-admin">+ Add Administrator</button><div class="admin-account-list">${adminList || `<p class="muted">No administrator accounts found.</p>`}</div>` : "";
  const pickup = Number(pageData.pickup_window_days || 3);
  const officeHours = pageData.office_hours || "";
  const officeSchedule = Object.fromEntries(officeHours.split(/\r?\n/).map(line => { const match = line.match(/^([^:]+):\s*(.*)$/); return match ? [match[1], match[2]] : null; }).filter(Boolean));
  const officeGroups = [{ label: "Monday–Friday", days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] }, { label: "Saturday", days: ["Saturday"] }, { label: "Sunday", days: ["Sunday"] }];
  const officeRows = officeGroups.map(group => { const value = officeSchedule[group.days.find(day => officeSchedule[day])] || ""; const closed = value.toLowerCase() === "closed"; const times = value.match(/(\d{2}:\d{2}).*?(\d{2}:\d{2})/); const key = group.days.join(","); return `<div class="office-hours-row"><b>${group.label}</b><label><input type="checkbox" data-office-closed="${key}" ${closed ? "checked" : ""}> Closed</label><input class="form-control" type="time" data-office-start="${key}" value="${times?.[1] || ""}" aria-label="${group.label} opening time"><span>to</span><input class="form-control" type="time" data-office-end="${key}" value="${times?.[2] || ""}" aria-label="${group.label} closing time"></div>`; }).join("");
  const pickupSettings = mode === "admin" ? `<h3 style="margin-top:24px">Barangay information</h3><form id="pickupWindowForm" class="form-grid"><div class="form-field"><label>Pickup window (days)</label><input class="form-control" type="number" name="pickup_window_days" min="1" max="30" value="${pickup}" required></div><div class="form-field full"><label>Office hours</label><div class="office-hours-picker">${officeRows}</div><input type="hidden" name="office_hours" id="officeHoursValue"></div><div class="form-field"><label>Phone number</label><input class="form-control" type="tel" name="contact_phone" value="${escapeHtml(pageData.contact_phone || "")}" placeholder="e.g. 0917 123 4567"></div><div class="form-field"><label>Email address</label><input class="form-control" type="email" name="contact_email" value="${escapeHtml(pageData.contact_email || "")}" placeholder="e.g. barangay@example.com"></div><div class="form-field"><button class="primary-btn sm" type="submit">Save barangay information</button></div><p class="auth-feedback" id="pickupWindowFeedback" role="alert"></p></form>` : "";
  return `${heading("Settings", "Account and display preferences.")}<section class="panel"><h3>Display</h3><p class="muted" style="margin-top:8px">Your light or dark theme preference is saved in this browser.</p><button class="secondary-btn" data-action="toggle-theme">Switch theme</button>${pickupSettings}
    ${adminTools}</section>`;
}

function helpPage() {
  return `${heading("Help & Support", "Send questions to the Barangay Office using Complaints & Feedback.")}<section class="panel"><p>For help with an online service request, submit a message in <b>Complaints & Feedback</b> or visit the Barangay Office in person.</p><button class="primary-btn sm" data-page="Complaints & Feedback">Send a message →</button></section>`;
}

async function loadPageData() {
  switch (page) {
    case "Dashboard": {
      const endpoints = mode === "admin"
        ? ["/api/announcements", "/api/services", "/api/requests", "/api/feedback", "/api/residents", "/api/notifications"]
        : ["/api/announcements", "/api/services", "/api/requests", "/api/feedback", "/api/notifications"];
      const results = await Promise.all(endpoints.map(endpoint => api(endpoint)));
      pageData = {
        announcements: results[0].data.announcements,
        services: results[1].data.services,
        requests: results[2].data.requests,
        feedback: results[3].data.feedback,
        unreadNotifications: results[mode === "admin" ? 5 : 4].data.unread_count
      };
      if (mode === "admin") pageData.residents = results[4].data.residents;
      return;
    }
    case "E-Services":
      pageData.services = (await api("/api/services")).data.services;
      return;
    case "My Requests":
    case "Manage Requests":
      pageData.requests = (await api(`/api/requests${mode === "admin" ? `?archive=${pageData.requestArchive || "active"}` : ""}`)).data.requests;
      return;
    case "Announcements":
      pageData.announcements = (await api("/api/announcements")).data.announcements;
      return;
    case "Events":
      pageData.announcements = (await api("/api/announcements")).data.announcements;
      return;
    case "DRRM Map":
      pageData.drrm = (await api("/api/admin/drrm")).data;
      return;
    case "Settings":
      if (mode === "admin") { const [admins, settings] = await Promise.all([api("/api/admin/users/admins"), api("/api/admin/settings")]); pageData.admins = admins.data.admins; pageData.pickup_window_days = settings.data.pickup_window_days; pageData.office_hours = settings.data.office_hours || ""; pageData.contact_phone = settings.data.contact_phone || ""; pageData.contact_email = settings.data.contact_email || ""; }
      return;
    case "Manage Residents":
      pageData.residents = (await api("/api/residents")).data.residents;
      return;
    case "Complaints & Feedback":
      pageData.feedback = (await api("/api/feedback")).data.feedback;
      return;
    case "Notifications":
      pageData.notifications = (await api("/api/notifications")).data.notifications;
      return;
    case "Reports":
      pageData.report = (await api("/api/admin/reports")).data;
      return;
    case "Audit Logs":
      pageData.auditLogs = (await api("/api/admin/audit-logs")).data;
      return;
  }
}

function renderContent() {
  switch (page) {
    case "Dashboard": return dashboard();
    case "My Profile": return profilePage();
    case "E-Services": return servicesPage();
    case "My Requests": return requestsPage(false);
    case "My Activity": return auditLogsPage();
    case "Manage Requests": return requestsPage(true);
    case "DRRM Map": return drrmPage();
    case "Settings": return settingsPage();
    case "Manage Residents": return residentsPage();
    case "Announcements": return announcementsPage();
    case "Events": return eventsPage();
    case "Complaints & Feedback": return feedbackPage();
    case "Notifications": return notificationsPage();
    case "Reports": return reportsPage();
    case "Audit Logs": return auditLogsPage();
    case "Help": return helpPage();
    case "Settings": return settingsPage();
    default: return dashboard();
  }
}

function loadingSkeleton() {
  return `<div class="loading-skeleton" aria-label="Loading content" role="status">
    <div class="skeleton-heading"><div><span class="skeleton-line skeleton-title"></span><span class="skeleton-line skeleton-subtitle"></span></div><span class="skeleton-button"></span></div>
    <div class="skeleton-stats"><span></span><span></span><span></span></div>
    <section class="panel skeleton-panel"><span class="skeleton-line skeleton-panel-title"></span><span class="skeleton-map"></span></section>
  </div>`;
}
async function render() {
  const currentRender = ++renderVersion;
  $("#currentCrumb").textContent = page === "Dashboard" ? "Home" : page;
  renderNav();

    $("#pageContent").innerHTML = loadingSkeleton();

  try {
    await loadPageData();
    if (currentRender !== renderVersion) return;
    $("#pageContent").innerHTML = renderContent();
    if (page === "DRRM Map") renderDrrmMap();
  } catch (error) {
    if (currentRender !== renderVersion) return;
    $("#pageContent").innerHTML = `<section class="panel"><div class="empty-state"><h3>Unable to load ${escapeHtml(page.toLowerCase())}</h3><p>${escapeHtml(error.message)}</p><button class="secondary-btn" data-action="retry">Try again</button></div></section>`;
  }
}

function closeMobileNav() {
  document.body.classList.remove("mobile-nav-open");
  $("#mobileNavOverlay")?.classList.add("hidden");
  $("#mobileMenuBtn")?.setAttribute("aria-expanded", "false");
}

function toggleMobileNav() {
  const open = !document.body.classList.contains("mobile-nav-open");
  document.body.classList.toggle("mobile-nav-open", open);
  $("#mobileNavOverlay")?.classList.toggle("hidden", !open);
  $("#mobileMenuBtn")?.setAttribute("aria-expanded", String(open));
}
function go(next) {
  const allowed = (mode === "admin" ? adminNav : residentNav).some(([label]) => label === next);
  if (!allowed && !["Help", "Settings"].includes(next)) return;
  if (next === "Manage Requests") pageData.requestArchive = "active";
  page = next;
  closeMobileNav();
  void render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openModal(title, subtitle, fields, submitText, onSubmit) {
  const layer = $("#modalLayer");
  const fieldMarkup = fields.map(field => {
    const required = field.required ? "required" : "";
    const value = escapeHtml(field.value ?? "");
    let control;
    if (field.type === "select") {
      control = `<select class="form-control" name="${escapeHtml(field.name)}" ${required}>${field.options.map(option => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(field.value ?? field.options[0]?.value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select>`;
    } else if (field.type === "textarea") {
      control = `<textarea class="form-control" name="${escapeHtml(field.name)}" placeholder="${escapeHtml(field.placeholder || "")}" ${required}>${value}</textarea>`;
    } else if (field.type === "dynamic-list") {
      const items = String(field.value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
      control = `<div class="dynamic-list" data-list-name="${escapeHtml(field.name)}"><input type="hidden" name="${escapeHtml(field.name)}" value="${escapeHtml(items.join("\n"))}"><div class="dynamic-list-items">${items.map(item => `<div class="dynamic-list-row"><input class="form-control dynamic-list-input" type="text" value="${escapeHtml(item)}" placeholder="${escapeHtml(field.placeholder || "")}"><button type="button" class="danger-btn sm dynamic-list-remove">Remove</button></div>`).join("")}</div><button type="button" class="secondary-btn sm dynamic-list-add">+ Add ${field.name === "requirements" ? "requirement" : "step"}</button></div>`;
    } else if (field.type === "file") {
      control = `<input class="form-control" name="${escapeHtml(field.name)}" type="file" accept="${escapeHtml(field.accept || "")}" ${field.multiple ? "multiple" : ""} ${required}>`;
    } else {
      control = `<input class="form-control" name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || "text")}" value="${value}" placeholder="${escapeHtml(field.placeholder || "")}" ${required} ${field.maxLength ? `maxlength="${field.maxLength}"` : ""} ${field.min !== undefined ? `min="${escapeHtml(field.min)}"` : ""} ${field.step !== undefined ? `step="${escapeHtml(field.step)}"` : ""}>`;
    }
    return `<div class="form-field ${field.full ? "full-width" : ""}" data-field-name="${escapeHtml(field.name)}"><label>${escapeHtml(field.label)}</label>${control}${field.help ? `<small>${escapeHtml(field.help)}</small>` : ""}</div>`;
  }).join("");

  layer.innerHTML = `<form class="modal-card" id="activeModal"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p><div class="form-grid">${fieldMarkup}</div><p class="auth-feedback" id="modalFeedback" role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">Cancel</button><button class="primary-btn sm" type="submit">${escapeHtml(submitText)}</button></div></form>`;
  layer.classList.remove("hidden");
  document.querySelector("#appView .topbar")?.classList.add("hidden");
  $("#activeModal").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    $("#modalFeedback").textContent = "";
    try {
      await onSubmit(new FormData(form));
      layer.classList.add("hidden");
    } catch (error) {
      $("#modalFeedback").textContent = error.message || "Unable to save. Please try again.";
    } finally {
      submit.disabled = false;
    }
  });
  layer.querySelectorAll(".dynamic-list").forEach(list => {
    const items = list.querySelector(".dynamic-list-items");
    const hidden = list.querySelector('input[type="hidden"]');
    const sync = () => { hidden.value = [...items.querySelectorAll(".dynamic-list-input")].map(input => input.value.trim()).filter(Boolean).join("\n"); };
    list.querySelector(".dynamic-list-add").addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "dynamic-list-row";
      row.innerHTML = `<input class="form-control dynamic-list-input" type="text" placeholder="Enter item"><button type="button" class="danger-btn sm dynamic-list-remove">Remove</button>`;
      items.appendChild(row); row.querySelector(".dynamic-list-input").focus();
    });
    list.addEventListener("input", sync);
    list.addEventListener("click", event => { if (event.target.closest(".dynamic-list-remove")) { event.target.closest(".dynamic-list-row").remove(); sync(); } });
  });
}

function openImagePreview(url, alt = "Uploaded document") {
  document.querySelector("#imagePreviewLayer")?.remove();
  const layer = document.createElement("div");
  layer.id = "imagePreviewLayer";
  layer.className = "image-preview-layer";
  layer.innerHTML = `<button type="button" class="image-preview-close" aria-label="Close image preview">×</button><img src="${url}" alt="${escapeHtml(alt)}">`;
  layer.addEventListener("click", event => { if (event.target === layer || event.target.closest(".image-preview-close")) layer.remove(); });
  document.body.appendChild(layer);
}

function openReadOnlyModal(title, content) {
  const layer = $("#modalLayer");
  layer.innerHTML = `<div class="modal-card"><h2>${escapeHtml(title)}</h2>${content}<div class="modal-actions"><button class="secondary-btn" data-action="close-modal">Close</button></div></div>`;
  layer.classList.remove("hidden");
  document.querySelector("#appView .topbar")?.classList.add("hidden");
}

function confirmAction(title, message, confirmLabel = "Confirm") {
  return new Promise(resolve => {
    const layer = $("#modalLayer");
    layer.innerHTML = `<div class="modal-card confirmation-modal"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><div class="modal-actions"><button type="button" class="secondary-btn" data-confirm-cancel>Cancel</button><button type="button" class="danger-btn" data-confirm-accept>${escapeHtml(confirmLabel)}</button></div></div>`;
    layer.classList.remove("hidden");
    document.querySelector("#appView .topbar")?.classList.add("hidden");
    const finish = value => { layer.classList.add("hidden"); document.querySelector("#appView .topbar")?.classList.remove("hidden"); resolve(value); };
    layer.querySelector("[data-confirm-cancel]").addEventListener("click", () => finish(false), { once: true });
    layer.querySelector("[data-confirm-accept]").addEventListener("click", () => finish(true), { once: true });
  });
}

function serviceFields(service = {}) {
  return [
    { name: "name", label: "Service name", value: service.name, required: true, maxLength: 255, full: true },
    { name: "description", label: "Short description", type: "textarea", value: service.description, required: true, full: true },
    { name: "service_fee", label: "Service fee", type: "number", value: service.service_fee ?? 0, min: "0", step: "0.01", placeholder: "0.00", help: "Enter 0 if the service is free." },
    { name: "requirements", label: "Requirements", type: "dynamic-list", value: service.requirements, placeholder: "e.g. Valid ID", full: true },
    { name: "instructions", label: "Procedure", type: "dynamic-list", value: service.instructions, placeholder: "e.g. Submit requirements", full: true },
    { name: "is_active", label: "Publication status", type: "select", value: service.is_active ? "1" : "0", options: [{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }] }
  ];
}

function announcementFields(announcement = {}, eventOnly = false) {
  const categories = eventOnly ? ["Event"] : ["General", "Community", "System", "Event"];
  return [
    { name: "title", label: "Title", value: announcement.title, required: true, maxLength: 255, full: true },
    ...(eventOnly ? [{ name: "event_date", label: "Event date", type: "date", value: announcement.event_date || "", required: true }, { name: "event_time", label: "Event time", type: "time", value: announcement.event_time || "", required: true }, { name: "event_location", label: "Venue / location", value: announcement.event_location || "", required: true }, { name: "event_organizer", label: "Organizer", value: announcement.event_organizer || "" }, { name: "event_contact", label: "Contact details", value: announcement.event_contact || "", help: "Phone number, email, or office contact." }] : []),
    ...(eventOnly ? [] : [{ name: "category", label: "Category", type: "select", value: announcement.category, options: categories.map(value => ({ value, label: value })) }]),
    { name: "is_published", label: "Visibility", type: "select", value: announcement.is_published === false ? "0" : "1", options: [{ value: "1", label: "Published" }, { value: "0", label: "Draft" }] },
    { name: "body", label: eventOnly ? "Event details / schedule" : "Details, requirements, or schedule", type: "textarea", value: announcement.body, placeholder: eventOnly ? "Describe what residents should know: activities, requirements, reminders, and what to bring." : "Add the important details residents need to know.", required: true, full: true }
  ];
}

async function createRequest(serviceId = null) {
  const services = pageData.services || (await api("/api/services")).data.services;
  const available = services.filter(service => service.is_active);
  if (!available.length) throw new Error("The barangay has not published any services for online requests yet.");

  openModal("Request a Barangay Service", "Review the service requirements before submitting. Files are optional and limited to 10 MB each.", [
    { name: "service_id", label: "Service", type: "select", value: serviceId ?? available[0].id, options: available.map(service => ({ value: service.id, label: service.name })) },
    { name: "purpose", label: "Purpose of request", type: "textarea", placeholder: "Explain why you need this service.", required: true, full: true },
    { name: "documents[]", label: "Supporting documents", type: "file", accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx", multiple: true, help: "Up to 5 files: PDF, JPG, PNG, DOC, or DOCX." }
  ], "Submit request", async formData => {
    const { data } = await api("/api/requests", { method: "POST", body: formData });
    toast(`Request submitted. Reference: ${data.request.reference_code}`);
    go("My Requests");
  });
  const serviceSelect = document.querySelector('#activeModal [name="service_id"]');
  if (serviceSelect) {
    const info = document.createElement("div");
    info.className = "request-service-info";
    serviceSelect.closest(".form-field")?.after(info);
    const updateInfo = () => {
      const service = available.find(item => String(item.id) === String(serviceSelect.value));
      if (!service) { info.innerHTML = ""; return; }
      const requirements = String(service.requirements || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
      const procedure = String(service.instructions || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
      info.innerHTML = `<div class="request-service-summary"><div><span>Service fee</span><b>${Number(service.service_fee || 0) === 0 ? "Free" : `₱${Number(service.service_fee).toFixed(2)}`}</b></div><div><span>About this service</span><p>${escapeHtml(service.description || "")}</p></div>${requirements.length ? `<div><span>Requirements</span><ul>${requirements.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}${procedure.length ? `<div><span>Procedure</span><ol>${procedure.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol></div>` : ""}</div>`;
    };
    serviceSelect.addEventListener("change", updateInfo);
    updateInfo();
  }
  const fileInput = document.querySelector('#activeModal input[name="documents[]"]');
  if (fileInput) {
    const fileList = document.createElement("div");
    fileList.className = "request-upload-list";
    fileInput.after(fileList);
    const renderFiles = () => {
      fileList.innerHTML = [...fileInput.files].map((file, index) => {
        const image = file.type.startsWith("image/");
        const preview = image ? `<img src="${URL.createObjectURL(file)}" alt="" class="request-upload-thumb">` : `<span class="request-upload-file-icon">FILE</span>`;
        return `<div class="request-upload-item">${preview}<span class="request-upload-name">${escapeHtml(file.name)}<small>${(file.size / 1024 / 1024).toFixed(2)} MB</small></span><button type="button" class="request-upload-remove" data-file-index="${index}" aria-label="Remove ${escapeHtml(file.name)}">×</button></div>`;
      }).join("");
      fileList.querySelectorAll(".request-upload-thumb").forEach(image => image.addEventListener("click", () => openImagePreview(image.src, image.alt || "Uploaded document")));
    };
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 5) { toast("You can upload up to 5 files."); const transfer = new DataTransfer(); [...fileInput.files].slice(0, 5).forEach(file => transfer.items.add(file)); fileInput.files = transfer.files; }
      renderFiles();
    });
    fileList.addEventListener("click", event => {
      const remove = event.target.closest(".request-upload-remove");
      if (!remove) return;
      const transfer = new DataTransfer();
      [...fileInput.files].forEach((file, index) => { if (index !== Number(remove.dataset.fileIndex)) transfer.items.add(file); });
      fileInput.files = transfer.files;
      renderFiles();
    });
  }
}

function requestDocumentMarkup(request) {
  const date = new Date().toLocaleDateString();
  return `<div class="download-document"><div class="download-document-header"><div class="download-seal">BH</div><div><div class="download-eyebrow">BARANGAY HUMAYINGAN</div><h1>Official Service Request</h1><p>Approved barangay service document</p></div></div><div class="download-document-body"><div class="download-row"><span>Reference No.</span><b>${escapeHtml(request.reference_code)}</b></div><div class="download-row"><span>Resident</span><b>${escapeHtml(request.resident?.name || currentUser.name)}</b></div><div class="download-row"><span>Service</span><b>${escapeHtml(request.service?.name || "")}</b></div><div class="download-row"><span>Purpose</span><b>${escapeHtml(request.purpose || "")}</b></div><div class="download-row"><span>Approved date</span><b>${date}</b></div></div><div class="download-document-footer">This document was issued through the E-Barangay system.</div></div>`;
}

async function downloadRequestDocument(request, format) {
  const markup = requestDocumentMarkup(request);
  if (format === "png") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial;padding:70px;background:#fff;color:#15365f;height:100%;box-sizing:border-box">${markup}</div></foreignObject></svg>`;
    const image = new Image();
    image.onload = () => { const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 850; canvas.getContext("2d").drawImage(image, 0, 0); const link = document.createElement("a"); link.download = `${request.reference_code}.png`; link.href = canvas.toDataURL("image/png"); link.click(); };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return;
  }
  const printWindow = window.open("", "barangayPdfPreview", "width=900,height=700");
  if (!printWindow) throw new Error("Please allow pop-ups to save the PDF.");
  printWindow.document.write(`<html><head><title>${escapeHtml(request.reference_code)}</title><style>body{margin:0;background:#eef5fb;font-family:Arial;color:#15365f}.download-document{width:760px;margin:40px auto;padding:42px;background:#fff;border:1px solid #c9dcec;box-shadow:0 10px 30px #17365f20}.download-document-header{display:flex;gap:18px;align-items:center;border-bottom:3px solid #1674ed;padding-bottom:22px}.download-seal{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:#1674ed;color:#fff;font-weight:800;font-size:22px}.download-eyebrow{font-size:12px;letter-spacing:2px;font-weight:800;color:#1674ed}.download-document h1{margin:5px 0;font-size:28px}.download-document p{margin:0;color:#6f88a8}.download-document-body{margin:32px 0}.download-row{display:flex;gap:20px;padding:15px 0;border-bottom:1px solid #dce8f2}.download-row span{width:150px;color:#6f88a8}.download-row b{flex:1}.download-document-footer{margin-top:45px;padding-top:18px;border-top:1px solid #dce8f2;color:#6f88a8;font-size:12px}@page{size:A4;margin:14mm}@media print{body{background:#fff}.download-document{margin:0;border:0;box-shadow:none;width:auto}}</style></head><body>${markup}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}

async function viewRequest(id) {
  const request = pageData.requests.find(item => String(item.id) === String(id));
  if (!request) throw new Error("The selected request could not be found.");
  const history = (request.status_history || []).map(item => `<li><b>${escapeHtml(item.to_status)}</b> · ${escapeHtml(new Date(item.created_at).toLocaleString())}<br><small>${escapeHtml(item.changed_by?.name || "Resident")}${item.note ? ` — ${escapeHtml(item.note)}` : ""}</small></li>`).join("");
  const files = (request.files || []).map(file => { const isImage = /^image\/(jpeg|png|jpg|gif|webp)$/i.test(file.mime_type || ""); return `<li class="request-file">${isImage && file.preview_url ? `<img class="request-file-preview" src="${file.preview_url}" alt="${escapeHtml(file.original_name)}" loading="lazy">` : `<span class="request-file-icon">DOC</span>`}<span class="request-file-name">${escapeHtml(file.original_name)} <small>(${Math.ceil(file.size / 1024)} KB)</small></span></li>`; }).join("");
  const pickupInfo = request.ready_for_pickup_at ? `<p><b>Pickup available:</b> ${escapeHtml(new Date(request.ready_for_pickup_at).toLocaleDateString())}${request.pickup_deadline ? ` to ${escapeHtml(new Date(request.pickup_deadline).toLocaleDateString())}` : ""}</p>` : "";
  const transitionOptions = ({ Pending: ["Pending", "Processing", "Rejected"], Processing: ["Processing", "Ready for Pickup", "Rejected"], "Ready for Pickup": ["Ready for Pickup", "Claimed"], Claimed: ["Claimed"], Expired: ["Expired"], Rejected: ["Rejected"] }[request.status] || [request.status]).map(status => `<option ${status === request.status ? "selected" : ""}>${status}</option>`).join("");
  const adminControls = mode === "admin" ? `<form id="requestStatusForm" class="form-grid" data-id="${request.id}">
    <div class="form-field"><label>Update status</label><select class="form-control" name="status" required>${transitionOptions}</select></div>
    <div class="form-field full-width"><label>Staff note</label><textarea class="form-control" name="admin_note" maxlength="2000">${escapeHtml(request.admin_note || "")}</textarea></div>
    <div class="form-field full-width"><button class="primary-btn sm" type="submit">Save status</button></div><p class="auth-feedback" id="requestStatusFeedback" role="alert"></p>
  </form>` : request.admin_note ? `<p><b>Barangay note:</b> ${escapeHtml(request.admin_note)}</p>` : "";
  const residentClaimControl = mode !== "admin" && request.status === "Ready for Pickup" ? `<div class="request-claim-actions"><p>Your request is ready to be picked up.</p>${button("Mark as Claimed", "claim-request", "primary-btn sm", `data-id="${request.id}"`)}</div>` : "";
  const archiveInfo = request.archived_at ? `<p><b>Archived:</b> ${escapeHtml(new Date(request.archived_at).toLocaleString())}${request.archived_by?.name ? ` by ${escapeHtml(request.archived_by.name)}` : ""}${request.archive_reason ? `<br><b>Reason:</b> ${escapeHtml(request.archive_reason)}` : ""}</p>` : "";
  openReadOnlyModal(request.reference_code, `<p><b>Service:</b> ${escapeHtml(request.service?.name || "")}</p><p><b>Status:</b> ${statusBadge(request.status)}</p>${pickupInfo}${residentClaimControl}${archiveInfo}<p><b>Purpose:</b><br>${escapeHtml(request.purpose)}</p><h3>Submitted documents</h3><ul>${files || "<li>No files attached</li>"}</ul><h3>Status history</h3><ol>${history || "<li>No status history</li>"}</ol>${adminControls}`);
}

async function createFeedback() {
  openModal("Send a Complaint, Suggestion, or Feedback", "Messages are visible only to you and authorized barangay personnel.", [
    { name: "type", label: "Message type", type: "select", options: ["Complaint", "Suggestion", "Feedback"].map(value => ({ value, label: value })) },
    { name: "subject", label: "Subject", required: true, maxLength: 255, full: true },
    { name: "message", label: "Message", type: "textarea", required: true, full: true }
  ], "Send message", async formData => {
    await api("/api/feedback", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) });
    toast("Your message was sent to the Barangay Office.");
    go("Complaints & Feedback");
  });
}

async function viewFeedback(id) {
  const item = pageData.feedback.find(feedback => String(feedback.id) === String(id));
  if (!item) throw new Error("The selected message could not be found.");
  const admin = mode === "admin";
  const body = `<p><b>Type:</b> ${escapeHtml(item.type)}</p><p><b>From:</b> ${escapeHtml(item.resident?.name || currentUser.name)}</p><p><b>Subject:</b> ${escapeHtml(item.subject)}</p><p><b>Message:</b><br>${escapeHtml(item.message)}</p>${item.admin_note ? `<p><b>Staff note:</b><br>${escapeHtml(item.admin_note)}</p>` : ""}${admin ? `<form id="feedbackStatusForm" class="form-grid" data-id="${item.id}"><div class="form-field"><label>Status</label><select class="form-control" name="status">${feedbackStatuses.map(status => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></div><div class="form-field full-width"><label>Staff note</label><textarea class="form-control" name="admin_note" maxlength="2000">${escapeHtml(item.admin_note || "")}</textarea></div><div class="form-field full-width"><button class="primary-btn sm" type="submit">Update message</button></div><p class="auth-feedback" id="feedbackStatusFeedback" role="alert"></p></form>` : ""}`;
  openReadOnlyModal(item.subject, body);
}

async function showNotifications() {
  const { data } = await api("/api/notifications");
  const items = data.notifications.map(notification => {
    const details = notification.data || {};
    return `<article class="announcement-item"><div class="announcement-thumb">${uiIcon("bell")}</div><div><b>${escapeHtml(details.message || "System notification")}</b><small>${escapeHtml(new Date(notification.created_at).toLocaleString())}</small></div>${notification.read_at ? "" : button("Mark read", "mark-notification-read", "secondary-btn sm", `data-id="${notification.id}"`)}</article>`;
  }).join("");
  openReadOnlyModal("Notifications", items || emptyState("No notifications", "Request updates will appear here."));
  $("#modalLayer").dataset.unreadCount = String(data.unread_count);
}

async function exportRequests() {
  const response = await fetch("/api/admin/reports/requests.csv", {
    credentials: "same-origin",
    headers: { "X-CSRF-TOKEN": csrfToken }
  });
  if (!response.ok) throw new Error(`Could not export the report (${response.status}).`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "barangay-service-requests.csv";
  link.click();
  URL.revokeObjectURL(url);
  toast("Request report downloaded.");
}

async function action(name, element) {
  switch (name) {
    case "drrm-view-mode": window.drrmMapActions?.setMode('view'); break;
    case "drrm-select-mode": drrmPickedLocation = null; window.drrmMapActions?.setMode('select'); break;
    case "drrm-locate": window.drrmMapActions?.locate(); break;
    case "drrm-fit": window.drrmMapActions?.fit(); break;
    case "drrm-fullscreen": { const el = $('#drrmMap'); if (!document.fullscreenElement) el?.requestFullscreen?.(); else document.exitFullscreen?.(); break; }
    case "new-drrm-center":
      if (!drrmCenterLocationReady) { window.drrmMapActions?.setMode('select-center'); return; }
      openModal('Add Evacuation Center', 'Add a center and track its capacity.', [{ name: 'name', label: 'Center name', required: true }, { name: 'address', label: 'Address', required: true }, { name: 'latitude', label: 'Latitude', type: 'number', required: true, value: drrmPickedLocation?.latitude?.toFixed(6) || '13.9965' }, { name: 'longitude', label: 'Longitude', type: 'number', required: true, value: drrmPickedLocation?.longitude?.toFixed(6) || '120.6732' }, { name: 'capacity', label: 'Capacity', type: 'number' }, { name: 'current_occupants', label: 'Current occupants', type: 'number', value: '0' }, { name: 'status', label: 'Status', type: 'select', options: [{ value: 'Open', label: 'Open' }, { value: 'Full', label: 'Full' }, { value: 'Temporarily Closed', label: 'Temporarily Closed' }] }], 'Save center', async formData => { await api('/api/admin/drrm/evacuation-centers', { method: 'POST', body: JSON.stringify(Object.fromEntries(formData)) }); toast('Evacuation center added.'); drrmCenterLocationReady = false; await render(); });
      break;
    case "check-in-drrm-household": { const center = (pageData.drrm.evacuation_centers || []).find(c => String(c.id) === element.dataset.id); const households = pageData.drrm.households || []; if (!center) return; openModal('Check in household', `Available capacity: ${center.available_capacity ?? 'Not set'}`, [{ name: 'household_id', label: 'Household', type: 'select', required: true, options: households.map(h => ({ value: h.id, label: `${h.household_number} — ${h.resident_count} residents` })) }, { name: 'member_count', label: 'Members checking in', type: 'number', required: true, value: '1' }, { name: 'male_count', label: 'Male count', type: 'number', value: '0' }, { name: 'female_count', label: 'Female count', type: 'number', value: '0' }, { name: 'senior_count', label: 'Senior count', type: 'number', value: '0' }, { name: 'pwd_count', label: 'PWD count', type: 'number', value: '0' }, { name: 'special_needs_count', label: 'Other special-needs count', type: 'number', value: '0' }, { name: 'notes', label: 'Notes', type: 'textarea' }], 'Check in', async formData => { await api(`/api/admin/drrm/evacuation-centers/${center.id}/check-in`, { method: 'POST', body: JSON.stringify(Object.fromEntries(formData)) }); toast('Household checked in.'); await render(); }); break; }
    case "view-drrm-occupants": { const center = (pageData.drrm.evacuation_centers || []).find(c => String(c.id) === element.dataset.id); if (!center) return; const rows = (center.occupancy_records || []).filter(r => r.status === 'Checked In').map(r => `<tr><td>${escapeHtml(r.household?.household_number || '')}</td><td>${r.member_count}</td><td>${r.male_count}/${r.female_count}</td><td>${r.senior_count}/${r.pwd_count}/${r.special_needs_count}</td><td>${button('Check out', 'check-out-drrm-household', 'danger-btn sm', `data-id="${r.id}"`)}</td></tr>`).join(''); openModal(`Occupants — ${escapeHtml(center.name)}`, `<div class="table-wrap"><table><thead><tr><th>Household</th><th>Members</th><th>M/F</th><th>Senior/PWD/Special</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5">No active occupants.</td></tr>'}</tbody></table></div>`, [], 'Close', async () => {}); break; }
    case "check-out-drrm-household": { if (!confirm('Check out this household?')) return; await api(`/api/admin/drrm/evacuation-records/${element.dataset.id}/check-out`, { method: 'POST' }); toast('Household checked out.'); await render(); break; }
    case "delete-drrm-household": { const household = (pageData.drrm.households || []).find(item => String(item.id) === String(element.dataset.id)); if (!household || !confirm(`Delete household ${household.household_number}?`)) return; await api(`/api/admin/drrm/households/${household.id}`, { method: 'DELETE' }); toast('Household deleted.'); await render(); break; }
    case "delete-drrm-center": { const center = (pageData.drrm.evacuation_centers || []).find(item => String(item.id) === String(element.dataset.id)); if (!center || !confirm(`Delete evacuation center ${center.name}?`)) return; await api(`/api/admin/drrm/evacuation-centers/${center.id}`, { method: 'DELETE' }); toast('Evacuation center deleted.'); await render(); break; }
      break;
    case "edit-drrm-household": { const h = (pageData.drrm.households || []).find(item => String(item.id) === element.dataset.id); if (!h) return; openModal('Edit Household', 'Update location and vulnerability counts.', [{ name: 'address', label: 'Address', required: true, value: h.address }, { name: 'sitio', label: 'Sitio', value: h.sitio || h.purok || '' }, { name: 'landmark', label: 'Landmark', value: h.landmark || '' }, { name: 'latitude', label: 'Latitude', type: 'number', required: true, value: h.latitude }, { name: 'longitude', label: 'Longitude', type: 'number', required: true, value: h.longitude }, { name: 'resident_count', label: 'Residents', type: 'number', required: true, value: h.resident_count || 0 }, { name: 'senior_count', label: 'Seniors', type: 'number', value: h.senior_count || 0 }, { name: 'pwd_count', label: 'PWD', type: 'number', value: h.pwd_count || 0 }, { name: 'bedridden_count', label: 'Bedridden', type: 'number', value: h.bedridden_count || 0 }, { name: 'pregnant_count', label: 'Pregnant', type: 'number', value: h.pregnant_count || 0 }, { name: 'infant_count', label: 'Infants', type: 'number', value: h.infant_count || 0 }, { name: 'notes', label: 'Medical/rescue notes', type: 'textarea', full: true, value: h.notes || '' }], 'Save changes', async formData => { await api(`/api/admin/drrm/households/${h.id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(formData)) }); toast('Household updated.'); await render(); }); break; }
    case "edit-drrm-center": { const c = (pageData.drrm.evacuation_centers || []).find(item => String(item.id) === element.dataset.id); if (!c) return; openModal('Edit Evacuation Center', 'Update capacity and operating status.', [{ name: 'name', label: 'Center name', required: true, value: c.name }, { name: 'address', label: 'Address', required: true, value: c.address }, { name: 'latitude', label: 'Latitude', type: 'number', required: true, value: c.latitude }, { name: 'longitude', label: 'Longitude', type: 'number', required: true, value: c.longitude }, { name: 'capacity', label: 'Capacity', type: 'number', value: c.capacity || 0 }, { name: 'current_occupants', label: 'Current occupants', type: 'number', value: c.current_occupants || 0 }, { name: 'status', label: 'Status', type: 'select', value: c.status || 'Open', options: [{ value: 'Open', label: 'Open' }, { value: 'Full', label: 'Full' }, { value: 'Temporarily Closed', label: 'Temporarily Closed' }] }], 'Save changes', async formData => { await api(`/api/admin/drrm/evacuation-centers/${c.id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(formData)) }); toast('Evacuation center updated.'); await render(); }); break; }
function openDrrmHouseholdModal() {
  const layer = $("#modalLayer");
  const reference = `HH-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  layer.innerHTML = `<form class="modal-card drrm-household-modal" id="drrmHouseholdForm">
    <div class="drrm-form-header"><div><span class="eyebrow">DRRM HOUSEHOLD RECORD</span><h2>Add Household</h2><p>Record location details and the household's priority vulnerabilities.</p></div><span class="drrm-step-count" data-step-count>Step 1 of 2</span></div>
    <div class="drrm-stepper"><span class="active" data-step-indicator="1">1. Location details</span><span data-step-indicator="2">2. Vulnerability and household details</span></div>
    <section class="drrm-form-step active" data-step="1"><div class="form-grid">
      <div class="form-field full-width"><label>Reference number</label><input class="form-control" name="household_number" value="${reference}" readonly><small>Automatically generated by the system.</small></div>
      <div class="form-field full-width"><label>House Number / Address / Landmark <b>*</b></label><input class="form-control" name="address" placeholder="e.g. 9999 or near Humayingan Elementary School" required><small class="field-error" data-error="address"></small></div>
      <div class="form-field"><label>Sitio / Purok</label><input class="form-control" name="sitio" placeholder="e.g. Sitio 1"></div>
      <div class="form-field coordinate-field"><label>Latitude (°) <b>*</b></label><input class="form-control" name="latitude" type="number" step="any" min="-90" max="90" value="${drrmPickedLocation?.latitude?.toFixed(6) || ""}" readonly required><small class="field-error" data-error="latitude"></small></div>
      <div class="form-field coordinate-field"><label>Longitude (°) <b>*</b></label><input class="form-control" name="longitude" type="number" step="any" min="-180" max="180" value="${drrmPickedLocation?.longitude?.toFixed(6) || ""}" readonly required><small class="field-error" data-error="longitude"></small></div>
      <div class="form-field full-width"><button type="button" class="secondary-btn location-button" data-use-location>Use my current location</button><small>Allow browser location access to fill the coordinates automatically.</small></div>
    </div></section>
    <section class="drrm-form-step" data-step="2"><div class="form-grid"><div class="form-field full-width"><label>Number of household members <b>*</b></label><input class="form-control" name="resident_count" type="number" min="0" value="1" required><small class="field-error" data-error="resident_count"></small></div></div><div class="vulnerability-card"><h3>Vulnerability information</h3><p>Enter the number of household members in each category.</p><div class="form-grid"><div class="form-field"><label>Senior citizens</label><input class="form-control" name="senior_count" type="number" min="0" value="0"></div><div class="form-field"><label>Persons with Disabilities (PWD)</label><input class="form-control" name="pwd_count" type="number" min="0" value="0"></div><div class="form-field"><label>Bedridden residents</label><input class="form-control" name="bedridden_count" type="number" min="0" value="0"></div><div class="form-field"><label>Pregnant residents</label><input class="form-control" name="pregnant_count" type="number" min="0" value="0"></div><div class="form-field"><label>Infants</label><input class="form-control" name="infant_count" type="number" min="0" value="0"></div><div class="form-field"><label>Needs transportation assistance</label><input class="form-control" name="transport_assistance_count" type="number" min="0" value="0"></div></div></div><div class="form-field full-width"><label>Medical / rescue notes</label><textarea class="form-control" name="notes" placeholder="e.g. bedridden resident, oxygen needs, emergency contact, access restrictions"></textarea></div></section>
    <p class="auth-feedback" id="drrmHouseholdFeedback" role="alert"></p><div class="modal-actions drrm-sticky-actions"><button type="button" class="secondary-btn" data-action="close-modal">Cancel</button><button type="button" class="secondary-btn" data-step-back hidden>Back</button><button type="button" class="primary-btn sm" data-step-next>Next</button><button type="submit" class="primary-btn sm" data-step-save hidden>Save Household</button></div>
  </form>`;
  layer.classList.remove("hidden"); document.querySelector("#appView .topbar")?.classList.add("hidden");
  const form = $("#drrmHouseholdForm"); let step = 1; const steps = $$('[data-step]', form); const renderStep = () => { steps.forEach(item => item.classList.toggle("active", Number(item.dataset.step) === step)); $$('[data-step-indicator]', form).forEach(item => item.classList.toggle("active", Number(item.dataset.stepIndicator) === step)); $("[data-step-count]", form).textContent = `Step ${step} of 2`; $("[data-step-back]", form).hidden = step === 1; $("[data-step-next]", form).hidden = step === 2; $("[data-step-save]", form).hidden = step !== 2; };
  const validate = () => { let valid = true; $$('[data-error]', form).forEach(error => error.textContent = ""); const fields = step === 1 ? ["address", "latitude", "longitude"] : ["resident_count"]; fields.forEach(name => { const field = form.elements[name]; if (!field.checkValidity()) { valid = false; const error = form.querySelector(`[data-error="${name}"]`); if (error) error.textContent = field.validity.valueMissing ? "This field is required." : "Enter a valid value."; } }); return valid; };
  $("[data-step-next]", form).addEventListener("click", () => { if (validate()) { step = 2; renderStep(); } }); $("[data-step-back]", form).addEventListener("click", () => { step = 1; renderStep(); });
  $("[data-use-location]", form).addEventListener("click", event => { if (!navigator.geolocation) { $("#drrmHouseholdFeedback").textContent = "Location access is not supported by this browser."; return; } event.currentTarget.disabled = true; navigator.geolocation.getCurrentPosition(position => { form.elements.latitude.value = position.coords.latitude.toFixed(6); form.elements.longitude.value = position.coords.longitude.toFixed(6); event.currentTarget.disabled = false; }, () => { $("#drrmHouseholdFeedback").textContent = "Unable to get your location. Please allow location access or enter the coordinates manually."; event.currentTarget.disabled = false; }); });
  form.addEventListener("submit", async event => { event.preventDefault(); if (!validate()) return; const data = Object.fromEntries(new FormData(form)); const payload = { household_number: data.household_number, address: data.address, sitio: data.sitio, latitude: Number(data.latitude), longitude: Number(data.longitude), resident_count: Number(data.resident_count), senior_count: Number(data.senior_count || 0), pwd_count: Number(data.pwd_count || 0), bedridden_count: Number(data.bedridden_count || 0), pregnant_count: Number(data.pregnant_count || 0), infant_count: Number(data.infant_count || 0), transport_assistance_count: Number(data.transport_assistance_count || 0), notes: data.notes || "", members: [] }; const button = $("[data-step-save]", form); button.disabled = true; try { await api("/api/admin/drrm/households", { method: "POST", body: JSON.stringify(payload) }); layer.classList.add("hidden"); toast("DRRM household added."); await render(); } catch (error) { $("#drrmHouseholdFeedback").textContent = error.message || "Unable to save household."; } finally { button.disabled = false; } }); renderStep();
}
    case "new-household":
      if (!drrmPickedLocation) { window.drrmMapActions?.setMode('select'); toast('Click the map first to select the household location.'); return; }
      openDrrmHouseholdModal();
      break;
      break;    case "new-request":
      await createRequest();
      break;
    case "request-service":
      await createRequest(element.dataset.id);
      break;
    case "toggle-service-menu": { const menu = element.closest(".service-actions-menu")?.querySelector(".service-actions-options"); document.querySelectorAll(".service-actions-options").forEach(item => { if (item !== menu) item.classList.add("hidden"); }); menu?.classList.toggle("hidden"); break; }
    case "toggle-download-menu": { const menu = element.closest(".download-menu")?.querySelector(".download-menu-options"); document.querySelectorAll(".download-menu-options").forEach(item => { if (item !== menu) item.classList.add("hidden"); }); menu?.classList.toggle("hidden"); break; }
    case "download-request": { const request = pageData.requests.find(item => String(item.id) === String(element.dataset.id)); if (!request || request.status !== "Approved") return; const format = element.closest(".request-download-cell")?.querySelector(".download-format")?.value || element.dataset.format || "pdf"; await downloadRequestDocument(request, format); break; }
    case "request-details":
      await viewRequest(element.dataset.id);
      break;
    case "claim-request": {
      const request = pageData.requests.find(item => String(item.id) === String(element.dataset.id));
      if (!request || !(await confirmAction("Mark request as claimed", "Confirm that this request has been received.", "Mark as Claimed"))) return;
      await api(`/api/requests/${request.id}/claim`, { method: "PATCH", body: JSON.stringify({}) });
      toast("Request marked as claimed.");
      $("#modalLayer").classList.add("hidden");
      await render();
      break;
    }
    case "archive-request": {
      const request = pageData.requests.find(item => String(item.id) === String(element.dataset.id));
      if (!request || !(await confirmAction("Archive request", `Archive ${request.reference_code}? You can restore it later.`, "Archive"))) return;
      const reason = "Archived by administrator";
      await api(`/api/requests/${request.id}/archive`, { method: "PATCH", body: JSON.stringify({ reason }) });
      toast("Request archived."); await render(); break;
    }
    case "restore-request": {
      const request = pageData.requests.find(item => String(item.id) === String(element.dataset.id));
      if (!request || !(await confirmAction("Restore request", `Restore ${request.reference_code} to the active list?`, "Restore"))) return;
      await api(`/api/requests/${request.id}/restore`, { method: "PATCH", body: JSON.stringify({}) });
      pageData.requestArchive = "active";
      toast("Request restored and returned to Active Requests."); await render(); break;
    }
    case "new-feedback":
      await createFeedback();
      break;
    case "feedback-details":
      await viewFeedback(element.dataset.id);
      break;
    case "event-details":
      viewEventDetails(element.dataset.id);
      break;
    case "new-service":
      openModal("Add Barangay Service", "Only publish services and requirements confirmed by barangay personnel.", serviceFields({ is_active: true }), "Save service", async formData => {
        await api("/api/services", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) });
        toast("Service published.");
        await render();
      });
      break;
function defaultTemplateLayout() {
  return [
    { type: "logo", x: 8, y: 7 },
    { type: "lian_logo", x: 82, y: 7 },
    { type: "text", text: "BARANGAY HUMAYINGAN", x: 28, y: 8 },
    { type: "text", text: "OFFICIAL DOCUMENT", x: 28, y: 15 },
    { type: "resident_name", x: 10, y: 32 },
    { type: "service_name", x: 10, y: 42 },
    { type: "reference_code", x: 10, y: 52 },
    { type: "approved_date", x: 10, y: 62 },
    { type: "purpose", x: 10, y: 72 },
    { type: "signature", x: 63, y: 82 }
  ];
}

function templateBlockLabel(block) {
  return ({ logo: "Barangay Logo", lian_logo: "Lian Logo", text: block.text || "Text", resident_name: "Resident name", service_name: "Service name", reference_code: "Reference number", approved_date: "Approved date", purpose: "Purpose", signature: "Signature", qr: "QR verification" })[block.type] || block.type;
}

function templateBlockPreview(block, service) {
  const samples = { resident_name: "Juan Dela Cruz", service_name: service.name, reference_code: "BRG-20261110-MI97G4SU", approved_date: "November 10, 2026", purpose: "For official transaction", signature: "Punong Barangay" };
  if (block.type === "logo") return `<img src="/images/barangay-seal.png" alt="Barangay seal">`;
  if (block.type === "lian_logo") return `<img src="/images/Lian-logo.jpg" alt="Lian logo">`;
  if (block.type === "text") return block.text || "Sample text";
  if (block.type === "purpose") return "Purpose: For official transaction";
  return samples[block.type] || templateBlockLabel(block);
}

function openTemplateEditor(service) {
  const layer = $("#modalLayer");
  let layout = JSON.parse(JSON.stringify(service.template_layout || defaultTemplateLayout()));
  const color = service.template_primary_color || "#1674ed";
  layer.innerHTML = `<div class="template-editor-card"><div class="template-editor-head"><div><h2>Edit Template</h2><p>${escapeHtml(service.name)} · drag blocks into the document canvas</p></div><button type="button" class="secondary-btn" data-template-close>Close</button></div><div class="template-editor-toolbar"><input class="form-control" name="template_title" value="${escapeHtml(service.template_title || `${service.name} Certificate`)}" placeholder="Document title"><input class="form-control" name="template_primary_color" type="color" value="${color}"><div class="template-palette"><button type="button" draggable="true" data-add-block="text">+ Text</button><button type="button" draggable="true" data-add-block="resident_name">+ Resident</button><button type="button" draggable="true" data-add-block="service_name">+ Service</button><button type="button" draggable="true" data-add-block="signature">+ Signature</button><button type="button" draggable="true" data-add-block="qr">+ QR</button><button type="button" draggable="true" data-add-block="lian_logo">+ Lian Logo</button></div></div><div class="template-editor-workspace"><div class="template-palette-help">Drag or click a block to add it. Double-click text blocks to edit.</div><div class="template-canvas" style="--template-color:${color}"></div></div><div class="template-editor-actions"><button type="button" class="secondary-btn" data-template-close>Cancel</button><button type="button" class="primary-btn sm" data-template-save>Save Template</button></div></div>`;
  layer.classList.remove("hidden");
  document.querySelector("#appView .topbar")?.classList.add("hidden");
  const canvas = layer.querySelector(".template-canvas");
  const render = () => { canvas.innerHTML = layout.map((block, index) => `<div class="template-block template-block-${block.type}" draggable="true" data-index="${index}" style="left:${block.x ?? 10}%;top:${block.y ?? 10}%">${templateBlockPreview(block, service)}</div>`).join(""); };
  const close = () => { layer.classList.add("hidden"); document.querySelector("#appView .topbar")?.classList.remove("hidden"); };
  layer.querySelectorAll("[data-template-close]").forEach(button => button.addEventListener("click", close));
  layer.querySelectorAll("[data-add-block]").forEach(button => button.addEventListener("click", () => { layout.push({ type: button.dataset.addBlock, x: 10, y: 25 + layout.length * 6, text: button.dataset.addBlock === "text" ? "New text" : undefined }); render(); }));
  canvas.addEventListener("dblclick", event => { const block = event.target.closest(".template-block"); if (!block) return; const item = layout[Number(block.dataset.index)]; if (item.type === "text") { const text = prompt("Edit text", item.text || ""); if (text !== null) { item.text = text; render(); } } });
  canvas.addEventListener("dragstart", event => { const block = event.target.closest(".template-block"); if (block) event.dataTransfer.setData("text/plain", block.dataset.index); });
  layer.querySelectorAll("[data-add-block]").forEach(button => button.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", "new:" + button.dataset.addBlock)));
  canvas.addEventListener("dragover", event => event.preventDefault());
  canvas.addEventListener("drop", event => { event.preventDefault(); const payload = event.dataTransfer.getData("text/plain"); const rect = canvas.getBoundingClientRect(); const x = Math.max(0, Math.min(90, ((event.clientX - rect.left) / rect.width) * 100)); const y = Math.max(0, Math.min(92, ((event.clientY - rect.top) / rect.height) * 100)); if (payload.startsWith("new:")) { const type = payload.slice(4); layout.push({ type, x, y, text: type === "text" ? "New text" : undefined }); } else { const index = Number(payload); if (layout[index]) { layout[index].x = x; layout[index].y = y; } } render(); });
  layer.querySelector("[data-template-save]").addEventListener("click", async () => { const payload = { template_title: layer.querySelector("[name=template_title]").value, template_body: service.template_body || "This certifies that {{resident_name}} requested {{service_name}} under reference {{reference_code}}.", template_footer: service.template_footer || "Issued through the E-Barangay system.", template_signature_name: service.template_signature_name || "", template_signature_position: service.template_signature_position || "Punong Barangay", template_primary_color: layer.querySelector("[name=template_primary_color]").value, template_layout: layout }; try { const { data } = await api(`/api/services/${service.id}/template`, { method: "PATCH", body: JSON.stringify(payload) }); const index = pageData.services.findIndex(item => String(item.id) === String(service.id)); if (index >= 0) pageData.services[index] = data.service; close(); toast("Document template saved."); await render(); } catch (error) { toast(error.message || "Unable to save template."); } });
  render();
}

    case "edit-template": { const service = pageData.services.find(item => String(item.id) === element.dataset.id); if (service) openTemplateEditor(service); break; }
    case "edit-service": {
      const service = pageData.services.find(item => String(item.id) === element.dataset.id);
      openModal("Edit Barangay Service", "Update the official service information.", serviceFields(service), "Save changes", async formData => {
        await api(`/api/services/${service.id}`, { method: "PUT", body: JSON.stringify(Object.fromEntries(formData)) });
        toast("Service updated.");
        await render();
      });
      break;
    }
    case "delete-service": {
      const service = pageData.services.find(item => String(item.id) === element.dataset.id);
      if (!service || !confirm(`Archive "${service.name}"? It will be removed from the resident service list, but existing requests and history will be preserved.`)) return;
      await api(`/api/services/${service.id}`, { method: "DELETE" });
      toast("Service archived. Existing requests were preserved.");
      await render();
      break;
    }    case "toggle-service": {
      const service = pageData.services.find(item => String(item.id) === element.dataset.id);
      await api(`/api/services/${service.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !service.is_active })
      });
      toast(service.is_active ? "Service deactivated." : "Service activated.");
      await render();
      break;
    }
    case "new-event":
      openModal("Add Event", "Create a barangay event or community schedule.", announcementFields({ category: "Event" }, true), "Publish event", async formData => {
        const payload = Object.fromEntries(formData);
        payload.category = "Event";
        await api("/api/announcements", { method: "POST", body: JSON.stringify(payload) });
        toast("Event published.");
        await render();
      });
      break;    case "new-announcement":
      openModal("New Announcement", "Publish a verified barangay notice, event, or service update.", announcementFields(), "Publish", async formData => {
        await api("/api/announcements", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) });
        toast("Announcement published.");
        await render();
      });
      break;
    case "edit-announcement": {
      const announcement = pageData.announcements.find(item => String(item.id) === element.dataset.id);
      openModal("Edit Announcement", "Update the barangay notice.", announcementFields(announcement, announcement.category === "Event"), "Save changes", async formData => {
        await api(`/api/announcements/${announcement.id}`, { method: "PUT", body: JSON.stringify(Object.fromEntries(formData)) });
        toast("Announcement updated.");
        await render();
      });
      break;
    }
    case "delete-announcement": {
      const announcement = pageData.announcements.find(item => String(item.id) === element.dataset.id);
      if (!confirm(`Delete the announcement "${announcement.title}"?`)) return;
      await api(`/api/announcements/${announcement.id}`, { method: "DELETE" });
      toast("Announcement deleted.");
      await render();
      break;
    }
    case "new-resident":
      openModal("Add Resident", "Create a resident account for the barangay portal.", [
        { name: "name", label: "Full name", required: true },
        { name: "email", label: "Email address", type: "email", required: true },
        { name: "password", label: "Temporary password", type: "password", required: true, help: "At least 8 characters." },
        { name: "password_confirmation", label: "Confirm password", type: "password", required: true }
      ], "Create resident", async formData => {
        await api("/api/residents", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) });
        toast("Resident account created.");
        await render();
      });
      break;    case "toggle-resident": {
      const resident = pageData.residents.find(item => String(item.id) === element.dataset.id);
      await api(`/api/residents/${resident.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !resident.is_active })
      });
      toast(resident.is_active ? "Resident access deactivated." : "Resident access activated.");
      await render();
      break;
    }
    case "delete-resident": {
      const resident = pageData.residents.find(item => String(item.id) === element.dataset.id);
      if (!resident || !confirm(`Delete the resident account for "${resident.name}"? This cannot be undone.`)) return;
      await api(`/api/residents/${resident.id}`, { method: "DELETE" });
      toast("Resident account deleted.");
      await render();
      break;
    }
    case "view-resident-proof":
      window.open("/api/residents/" + element.dataset.id + "/verification-proof", "_blank", "noopener");
      break;
    case "approve-resident": {
      const resident = pageData.residents.find(item => String(item.id) === element.dataset.id);
      if (!resident) return;
      openModal(
        "Approve resident application?",
        "Approve the application of " + resident.name + "? This will activate the account and allow access to barangay services.",
        [],
        "Approve account",
        async () => {
          await api("/api/residents/" + resident.id + "/verification", {
            method: "PATCH",
            body: JSON.stringify({ action: "approve" })
          });
          toast("Resident application approved.");
          await render();
        }
      );
      break;
    }
    case "reject-resident": {
      const reason = prompt("Reason for rejecting this application:");
      if (!reason?.trim()) return;
      await api("/api/residents/" + element.dataset.id + "/verification", { method: "PATCH", body: JSON.stringify({ action: "reject", rejection_reason: reason.trim() }) });
      toast("Resident application rejected.");
      await render();
      break;
    }
    case "clear-audit-filters":
      pageData.auditFilters = {};
      pageData.auditLogs = (await api("/api/admin/audit-logs")).data;
      $("#pageContent").innerHTML = auditLogsPage();
      break;
    case "export-audit-pdf": {
      const printWindow = window.open("", "_blank");
      if (!printWindow) { toast("Please allow pop-ups to save the PDF."); break; }
      printWindow.document.write(`<html><head><title>Audit Logs</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px}</style></head><body><h1>Barangay System Audit Logs</h1>${$("#pageContent .table-wrap")?.innerHTML || ""}</body></html>`);
      printWindow.document.close(); printWindow.print(); break;
    }
    case "export-csv":
      await exportRequests();
      break;
    case "mark-notification-read":
      await api(`/api/notifications/${element.dataset.id}/read`, { method: "PATCH", body: JSON.stringify({}) });
      await updateNotificationIndicator();
      await showNotifications();
      break;
    case "retry":
      await render();
      break;
    case "new-admin":
      openModal("Add Administrator", "Create a new administrator account for trusted barangay staff.", [
        { name: "name", label: "Full name", required: true },
        { name: "email", label: "Email address", type: "email", required: true },
        { name: "password", label: "Password", type: "password", required: true, help: "At least 8 characters." },
        { name: "password_confirmation", label: "Confirm password", type: "password", required: true }
      ], "Create administrator", async formData => {
        await api("/api/admin/users/admin", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) });
        toast("Administrator account created.");
        await render();
      });
      break;    case "toggle-admin": {
      const admin = (pageData.admins || []).find(item => String(item.id) === element.dataset.id);
      if (!admin) return;
      await api(`/api/admin/users/admins/${admin.id}/status`, { method: "PATCH", body: JSON.stringify({ is_active: !admin.is_active }) });
      toast(admin.is_active ? "Administrator deactivated." : "Administrator activated.");
      await render();
      break;
    }
    case "delete-admin": {
      const admin = (pageData.admins || []).find(item => String(item.id) === element.dataset.id);
      if (!admin || !confirm(`Permanently delete administrator "${admin.name}"? This cannot be undone.`)) return;
      await api(`/api/admin/users/admins/${admin.id}`, { method: "DELETE" });
      toast("Administrator deleted.");
      await render();
      break;
    }    case "edit-profile":
      openModal("Edit Profile", "Update your name and email address.", [{ name: "name", label: "Full name", required: true, value: currentUser.name }, { name: "email", label: "Email address", type: "email", required: true, value: currentUser.email }], "Save changes", async formData => {
        const { data } = await api("/api/profile", { method: "PATCH", body: JSON.stringify(Object.fromEntries(formData)) });
        currentUser = { ...currentUser, ...data.user };
        updateUser();
        toast("Profile updated.");
        await render();
      });
      break;
    case "change-password":
      openModal("Change Password", "Use a strong password with at least 8 characters.", [{ name: "current_password", label: "Current password", type: "password", required: true }, { name: "password", label: "New password", type: "password", required: true }, { name: "password_confirmation", label: "Confirm new password", type: "password", required: true }], "Change password", async formData => {
        await api("/api/profile/password", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) });
        toast("Password changed successfully.");
      });
      break;
    case "account-settings":
      go("Settings");
      break;
    case "profile-logout":
      $("#logoutBtn").click();
      break;
    case "toggle-theme":
      toggleTheme();
      break;
    case "close-modal":
      $("#modalLayer").classList.add("hidden");
      document.querySelector("#appView .topbar")?.classList.remove("hidden");
      break;
  }
}

function handleActionClick(element) {
  $("#profileMenu")?.classList.add("hidden");
  action(element.dataset.action, element).catch(error => toast(error.message || "The action could not be completed."));
}

const askBotPrompts = [
  "How do I create an account?", "What services are available?", "How do I submit a request?",
  "What documents do I need?", "How do I track my request?", "What are the office hours?",
  "Are there any new announcements?", "How do I reset my password?", "How long does approval take?",
  "Where can I get a Barangay Clearance?", "How do I contact the Barangay Office?",
  "What should I do if my request is rejected?", "How do I submit a complaint?",
  "What community events are coming up?", "Is there a fee for this service?",
  "How do I update my profile?", "What does Ready for Pickup mean?",
  "Can I check my request status online?"
];

function renderAskBotSuggestions(exclude = "") {
  const container = document.querySelector("#askbotSuggestions");
  if (!container) return;
  const choices = askBotPrompts.filter(prompt => prompt !== exclude).sort(() => Math.random() - 0.5).slice(0, 2);
  container.innerHTML = choices.map(prompt => `<button class="askbot-suggestion" type="button">${escapeHtml(prompt)}</button>`).join("");
  container.querySelectorAll(".askbot-suggestion").forEach(button => {
    button.addEventListener("click", () => {
      container.innerHTML = "";
      sendAskBotMessage(button.textContent);
    });
  });
}

function openAskBot() {
  let popup = document.querySelector("#askbotPopup");
  if (!popup) {
    popup = document.createElement("section");
    popup.id = "askbotPopup";
    popup.className = "askbot-popup";
    popup.innerHTML = `<div class="askbot-head"><div class="askbot-avatar">✦</div><div><strong>Ask BarangayBot</strong><small>Barangay services assistant</small></div><button class="askbot-close" type="button" aria-label="Close chat">×</button></div><div class="askbot-body"><div class="askbot-messages" id="askbotMessages"><div class="askbot-message">Hi! I’m BarangayBot. How can I help you today?</div></div><div class="askbot-suggestions"><button class="askbot-suggestion" type="button">Barangay clearance requirements</button><button class="askbot-suggestion" type="button">How do I track my request?</button></div><form class="askbot-form" id="askbotForm"><input id="askbotInput" placeholder="Type your question..." autocomplete="off"><button type="submit">Send</button></form></div>`;
    document.body.appendChild(popup);
    popup.querySelector(".askbot-close").addEventListener("click", closeAskBot);
    popup.querySelector(".askbot-suggestions").id = "askbotSuggestions";
    popup.querySelector("#askbotForm").addEventListener("submit", event => { event.preventDefault(); sendAskBotMessage(popup.querySelector("#askbotInput").value); });
  }
  renderAskBotSuggestions();
  popup.classList.add("is-open");
  document.querySelector("#askbotLauncher")?.classList.add("is-hidden");
  popup.querySelector("#askbotInput")?.focus();
}

function formatAskBotReply(reply) {
  let formatted = String(reply || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(^|\n)\s*\*\s+/g, "$1• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (/:\s*-\s*/.test(formatted)) {
    formatted = formatted.replace(/:\s*-\s*/, ":\n• ").replace(/\s+-\s+/g, "\n• ");
  }
  return formatted;
}

function closeAskBot() {
  document.querySelector("#askbotPopup")?.classList.remove("is-open");
  document.querySelector("#askbotLauncher")?.classList.remove("is-hidden");
}

async function sendAskBotMessage(message) {
  const text = String(message || "").trim();
  if (!text) return;
  const messages = document.querySelector("#askbotMessages");
  const history = [...messages.querySelectorAll(".askbot-message")].map(node => ({ role: node.classList.contains("user") ? "user" : "model", text: node.textContent })).slice(-10);
  messages.insertAdjacentHTML("beforeend", `<div class="askbot-message user">${escapeHtml(text)}</div><div class="askbot-message" data-typing>Thinking...</div>`);
  document.querySelector("#askbotInput").value = "";
  messages.scrollTop = messages.scrollHeight;
  try {
    const { data } = await api("/api/askbot", { method: "POST", body: JSON.stringify({ message: text, history }) });
    messages.querySelector("[data-typing]")?.replaceWith(Object.assign(document.createElement("div"), { className: "askbot-message", textContent: formatAskBotReply(data.reply) }));
    renderAskBotSuggestions(text);
  } catch (error) {
    messages.querySelector("[data-typing]")?.replaceWith(Object.assign(document.createElement("div"), { className: "askbot-message", textContent: error.message || "I’m unable to answer right now. Please contact the Barangay Office." }));
  }
  messages.scrollTop = messages.scrollHeight;
}

function initAskBot() {
  if (document.querySelector("#askbotLauncher")) return;
  // Keep the BarangayBot branding visible, but disable the AI chat for residents.
  const launcher = document.createElement("div");
  launcher.id = "askbotLauncher";
  launcher.className = "askbot-launcher";
  launcher.setAttribute("aria-label", "Ask BarangayBot");
  launcher.addEventListener("click", openAskBot);
  launcher.textContent = "✦ Ask BarangayBot";
  document.body.appendChild(launcher);
}

function removeAskBot() {
  document.querySelector("#askbotLauncher")?.remove();
  document.querySelector("#askbotPopup")?.remove();
}

async function loadLandingContact() {
  const phone = document.querySelector("#landingContactPhone");
  const email = document.querySelector("#landingContactEmail");
  if (!phone || !email) return;
  try {
    const response = await fetch("/api/public/contact", { headers: { Accept: "application/json" } });
    if (!response.ok) return;
    const contact = await response.json();
    if (contact.phone) phone.querySelector("small").textContent = contact.phone;
    if (contact.email) email.querySelector("small").textContent = contact.email;
  } catch (_) {}
}

applyTheme();
if (!$("#landingView")?.classList.contains("hidden")) initAskBot();
loadLandingContact();
$$(".theme-toggle").forEach(button => button.addEventListener("click", toggleTheme));
$("#loginForm").addEventListener("submit", event => {
  event.preventDefault();
  submitAuthForm(event.currentTarget, "/auth/login", "#loginFeedback");
});
$("#registerForm").addEventListener("submit", event => {
  event.preventDefault();
  submitAuthForm(event.currentTarget, "/auth/register", "#registerFeedback");
});
$("#forgotPasswordForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  $("#forgotFeedback").textContent = "";

  try {
    const { data } = await api("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    $("#forgotFeedback").textContent = data.message;
    $("#forgotFeedback").classList.add("success");
  } catch (error) {
    $("#forgotFeedback").textContent = error instanceof TypeError
      ? "Could not connect to the server. Please try again."
      : error.message;
    $("#forgotFeedback").classList.remove("success");
  } finally {
    button.disabled = false;
  }
});
$("#resetPasswordForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  $("#resetFeedback").textContent = "";

  try {
    const { data } = await api("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    updateCsrfToken(data.csrf_token);
    const email = $("#resetEmail").value;
    form.reset();
    window.history.replaceState({}, "", "/");
    showLoginForm();
    $("#loginName").value = email;
    $("#loginFeedback").textContent = data.message;
    $("#loginName").focus();
  } catch (error) {
    $("#resetFeedback").textContent = error instanceof TypeError
      ? "Could not connect to the server. Please try again."
      : error.message;
  } finally {
    button.disabled = false;
  }
});
$$(".public-login-trigger, .public-login-trigger-link").forEach(control => control.addEventListener("click", event => {
  event.preventDefault();
  removeAskBot();
  $("#landingView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
  $("#loginName").focus({ preventScroll: true });
  window.scrollTo(0, 0);
}));
$(".password-toggle").addEventListener("click", event => {
  const input = $("#loginPassword");
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  event.currentTarget.setAttribute("aria-pressed", String(visible));
  event.currentTarget.setAttribute("aria-label", visible ? "Hide password" : "Show password");
});
$("#backToLanding").addEventListener("click", () => {
  $("#loginView").classList.add("hidden");
  $("#landingView").classList.remove("hidden");
  initAskBot();
  window.scrollTo(0, 0);
});
$("#registerLink").addEventListener("click", event => {
  event.preventDefault();
  showRegisterForm();
});
$("#loginAgainLink").addEventListener("click", event => {
  event.preventDefault();
  showLoginForm();
});
$("#forgotLoginLink").addEventListener("click", event => {
  event.preventDefault();
  showLoginForm();
  $("#loginName").focus();
});
$("#resetLoginLink").addEventListener("click", event => {
  event.preventDefault();
  window.history.replaceState({}, "", "/");
  showLoginForm();
});
$(".auth-back-home").addEventListener("click", () => {
  $("#loginView").classList.add("hidden");
  $("#landingView").classList.remove("hidden");
  initAskBot();
  window.scrollTo(0, 0);
  showLoginForm();
});
$("#mobileMenuBtn")?.addEventListener("click", event => { event.stopPropagation(); toggleMobileNav(); });
$("#mobileNavOverlay")?.addEventListener("click", closeMobileNav);
document.addEventListener("keydown", event => { if (event.key === "Escape") closeMobileNav(); });
$("#navMenu").addEventListener("click", event => {
  const link = event.target.closest("[data-page]");
  if (link) go(link.dataset.page);
});
document.addEventListener("click", event => {
  const fileLink = event.target.closest(".request-file-link");
  if (fileLink && fileLink.querySelector("img")) {
    event.preventDefault();
    const image = fileLink.querySelector("img");
    openImagePreview(image.src, image.alt);
    return;
  }

  const pageLink = event.target.closest("[data-page]");
  if (pageLink) {
    event.preventDefault();
    go(pageLink.dataset.page);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    event.preventDefault();
    handleActionClick(actionButton);
  }
});
$("#logoutBtn").addEventListener("click", async () => {
  if (!(await confirmAction("Log out", "Are you sure you want to end your current session?", "Log out"))) return;
  closeMobileNav();
  try {
    const { data } = await api("/auth/logout", { method: "POST", body: JSON.stringify({}) });
    updateCsrfToken(data.csrf_token);
    currentUser = null;
    $("#appView").classList.add("hidden");
    $("#landingView").classList.remove("hidden");
    $("#loginView").classList.add("hidden");
    initAskBot();
    $("#loginName").value = "";
    $("#loginPassword").value = "";
    showLoginForm();
    toast(data.message);
  } catch (error) {
    toast(error.message || "Unable to log out.");
  }
});
$("#settingsBtn").addEventListener("click", () => { closeMobileNav(); go("Settings"); });
$("#notificationBtn").addEventListener("click", () => {
  showNotifications().catch(error => toast(error.message || "Unable to load notifications."));
});
$(".top-user").addEventListener("click", event => {
  if (event.target.closest(".profile-menu")) return;
  event.stopPropagation();
  $("#profileMenu")?.classList.toggle("hidden");
});
document.addEventListener("click", event => {
  if (!event.target.closest(".top-user")) $("#profileMenu")?.classList.add("hidden");
});
$("#forgotLink").addEventListener("click", event => {
  event.preventDefault();
  showForgotPasswordForm();
});
$("#pageContent").addEventListener("input", event => {
  if (event.target.id === "requestArchive") {
    pageData.requestArchive = event.target.value;
    render().catch(error => toast(error.message || "Unable to load archived requests."));
    return;
  }
  if (event.target.id === "requestSearch" || event.target.id === "requestStatus") {
    const query = ($("#requestSearch")?.value || "").toLowerCase();
    const status = $("#requestStatus")?.value || "";
    $$("#pageContent tbody tr").forEach(row => {
      const visible = row.textContent.toLowerCase().includes(query)
        && (!status || row.textContent.includes(status));
      row.classList.toggle("hidden", !visible);
    });
  }
  if (["drrmSearch", "drrmPriority"].includes(event.target.id)) applyDrrmFilters();
  if (event.target.id === "residentSearch") {
    const query = event.target.value.toLowerCase();
    $$("#pageContent tbody tr").forEach(row => row.classList.toggle("hidden", !row.textContent.toLowerCase().includes(query)));
  }
});
$("#pageContent").addEventListener("change", event => {
  if (event.target.id === "requestArchive") {
    pageData.requestArchive = event.target.value;
    render().catch(error => toast(error.message || "Unable to load archived requests."));
  }
});
$("#pageContent").addEventListener("submit", async event => {
  const form = event.target;
  if (form.id === "pickupWindowForm") {
    event.preventDefault();
    const feedback = $("#pickupWindowFeedback");
    const officeHours = [...form.querySelectorAll("[data-office-start]")].flatMap(start => {
      const days = start.dataset.officeStart.split(",");
      const end = form.querySelector(`[data-office-end="${start.dataset.officeStart}"]`);
      const closed = form.querySelector(`[data-office-closed="${start.dataset.officeStart}"]`)?.checked;
      const schedule = closed ? "Closed" : (start.value && end?.value ? `${start.value}–${end.value}` : "");
      return schedule ? days.map(day => `${day}: ${schedule}`) : [];
    }).join("\n");
    form.querySelector("#officeHoursValue").value = officeHours;
    try { await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(form))) }); toast("Barangay information saved."); await render(); }
    catch (error) { feedback.textContent = error.message || "Unable to save pickup window."; }
    return;
  }
  if (form.id !== "auditLogFilters") return;
  event.preventDefault();
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    pageData.auditFilters = Object.fromEntries(new FormData(form));
    pageData.auditLogs = (await api("/api/admin/audit-logs?" + new URLSearchParams(pageData.auditFilters))).data;
    $("#pageContent").innerHTML = auditLogsPage();
  } catch (error) {
    toast(error.message || "Unable to filter audit logs.");
  } finally {
    $("#pageContent button[type=submit]")?.removeAttribute("disabled");
  }
});$("#modalLayer").addEventListener("submit", async event => {
  if (event.target.id === "requestStatusForm") {
    event.preventDefault();
    const form = event.target;
    const feedback = $("#requestStatusFeedback");
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const payload = Object.fromEntries(new FormData(form));
      const { data } = await api(`/api/requests/${form.dataset.id}/status`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      toast(data.message);
      $("#modalLayer").classList.add("hidden");
      document.querySelector("#appView .topbar")?.classList.remove("hidden");
      await render();
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  }
  if (event.target.id === "feedbackStatusForm") {
    event.preventDefault();
    const form = event.target;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const { data } = await api(`/api/feedback/${form.dataset.id}`, {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      toast("Message status updated.");
      $("#modalLayer").classList.add("hidden");
      document.querySelector("#appView .topbar")?.classList.remove("hidden");
      await render();
    } catch (error) {
      $("#feedbackStatusFeedback").textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  }
});
$("#year").textContent = new Date().getFullYear();
$("#landingYear").textContent = new Date().getFullYear();
$("#loginYear").textContent = new Date().getFullYear();
const resetPath = window.location.pathname.match(/^\/password\/reset\/([^/]+)$/);
if (resetPath) {
  showResetPasswordForm(decodeURIComponent(resetPath[1]), new URLSearchParams(window.location.search).get("email") || "");
} else {
  restoreSession();
}

// MapLibre implementation for the DRRM map. It intentionally keeps the existing
// window.drrmMapActions contract so the current toolbar and forms continue to work.
function renderDrrmMap() {
  const mapElement = $('#drrmMap');
  if (!mapElement) return;
  if (typeof maplibregl === 'undefined') { renderDrrmMapLegacy(); return; }
  const drrm = pageData.drrm || {};
  const households = drrm.households || [];
  const centers = drrm.evacuation_centers || [];
  const toFeature = (item, kind) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [Number(item.longitude), Number(item.latitude)] }, properties: { ...item, kind } });
  const householdData = { type: 'FeatureCollection', features: households.filter(h => h.latitude != null && h.longitude != null).map(h => toFeature(h, 'household')) };
  const centerData = { type: 'FeatureCollection', features: centers.filter(c => c.latitude != null && c.longitude != null).map(c => toFeature(c, 'center')) };
  const pointInRing = (point, ring) => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]; const intersects = ((yi > point[1]) !== (yj > point[1])) && point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi; if (intersects) inside = !inside; } return inside; };
  const pointInGeometry = (point, geometry) => geometry?.type === 'Polygon' ? pointInRing(point, geometry.coordinates[0]) : geometry?.type === 'MultiPolygon' ? geometry.coordinates.some(polygon => pointInRing(point, polygon[0])) : false;
  const geometryCenter = geometry => { const ring = geometry?.type === 'Polygon' ? geometry.coordinates[0] : geometry?.type === 'MultiPolygon' ? geometry.coordinates[0]?.[0] : []; if (!ring?.length) return null; const sum = ring.reduce((total, point) => [total[0] + Number(point[0]), total[1] + Number(point[1])], [0, 0]); return [sum[0] / ring.length, sum[1] / ring.length]; };
  const buildingRisk = feature => { const levels = { Critical: 4, High: 3, Moderate: 2, Low: 1 }; const normalized = value => { const key = String(value || '').trim().toLowerCase(); return Object.keys(levels).find(level => level.toLowerCase() === key) || 'None'; }; let matches = households.filter(h => pointInGeometry([Number(h.longitude), Number(h.latitude)], feature.geometry)); if (!matches.length) { const center = geometryCenter(feature.geometry); matches = households.filter(h => center && Math.hypot(Number(h.longitude) - center[0], Number(h.latitude) - center[1]) < 0.00035); } return matches.reduce((risk, h) => { const level = normalized(h.priority_level); return (levels[level] || 0) > (levels[risk] || 0) ? level : risk; }, 'None'); };
  const roadsUrl = mapElement.dataset.roadsUrl;
  const buildingsUrl = window.eBarangayConfig?.buildingsGeoJsonUrl;
  const mapTilerKey = window.eBarangayConfig?.mapTilerKey;
  const osmStyle = { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors', maxzoom: 19 } }, layers: [{ id: 'osm', type: 'raster', source: 'osm' }] };
  const satelliteStyle = { version: 8, sources: { satellite: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Esri' } }, layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }] };
  const mapStyle = satelliteStyle;
  let map;
  try { map = new maplibregl.Map({ container: mapElement, style: mapStyle, center: [120.6732, 13.9965], zoom: 14.5, attributionControl: true }); } catch (error) { console.warn('MapLibre initialization failed; using Leaflet fallback.', error); renderDrrmMapLegacy(); return; }
  map.on('error', event => { if (event?.error) console.warn('DRRM MapLibre error:', event.error); });
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.addControl(new maplibregl.FullscreenControl(), 'top-right');
  let mode = 'view';
  const householdMarkers = [];
  const centerMarkers = [];
  const setMode = next => { mode = next; map.getCanvas().style.cursor = next === 'view' ? '' : 'crosshair'; toast(next === 'select-center' ? 'Click the map to place the evacuation center.' : next === 'select' ? 'Select Location mode enabled.' : 'View Only mode enabled.'); };
  const popup = (html, coordinates) => new maplibregl.Popup({ offset: 12, maxWidth: '320px' }).setLngLat(coordinates).setHTML(html).addTo(map);
  const householdPopup = h => `<b>${escapeHtml(h.household_number)}</b><br>${escapeHtml(h.address || '')}<br>Sitio/Purok: ${escapeHtml(h.sitio || h.purok || 'Not specified')}<br>Priority: ${escapeHtml(h.priority_level || 'Not set')}<hr>Residents: ${h.resident_count || 0}<br>Seniors: ${h.senior_count || 0} · PWD: ${h.pwd_count || 0}<br>Bedridden: ${h.bedridden_count || 0} · Pregnant: ${h.pregnant_count || 0}<br>Infants: ${h.infant_count || 0}`;
  const centerPopup = c => { const cap = Number(c.capacity || 0); const occ = Number(c.current_occupants || 0); return `<b>${escapeHtml(c.name)}</b><br>${escapeHtml(c.address || '')}<hr>Capacity: ${cap || 'Not set'}<br>Occupied: ${occ}<br>Available: ${cap ? Math.max(0, cap - occ) : 'Not set'}<br>Status: ${escapeHtml(c.status || (cap && cap <= occ ? 'Full' : 'Open'))}`; };
  const enhanceRoadVisibility = () => {
    // MapTiler's Streets style already contains the road network as vector
    // layers. Render the road network in black so it matches the DRRM map
    // reference and stays legible over satellite/street imagery.
    const styleLayers = map.getStyle()?.layers || [];
    styleLayers.forEach(layer => {
      const layerId = String(layer.id || '').toLowerCase();
      const sourceLayer = String(layer['source-layer'] || '').toLowerCase();
      const roadText = `${layerId} ${sourceLayer}`;
      const isRoad = layer.type === 'line' && (
        /(^|[-_])(road|street|highway|path|track|service|motorway|trunk|primary|secondary|tertiary|minor)([-_]|$)/.test(roadText)
        || roadText.includes('transportation')
        || roadText.includes('road-')
      );
      if (!isRoad || layer.type !== 'line') return;
      try {
        const isPath = roadText.includes('path') || roadText.includes('track');
        const isMajor = /highway|motorway|trunk|primary|major/.test(roadText);
        map.setPaintProperty(layer.id, 'line-opacity', isPath ? 0.9 : 0.96);
        map.setPaintProperty(layer.id, 'line-color', '#ffffff');
        if (isPath) {
          map.setPaintProperty(layer.id, 'line-width', ['interpolate', ['linear'], ['zoom'], 12, 0.9, 16, 2.4]);
        } else if (isMajor) {
          map.setPaintProperty(layer.id, 'line-width', ['interpolate', ['linear'], ['zoom'], 10, 1.6, 16, 4.2]);
        } else {
          map.setPaintProperty(layer.id, 'line-width', ['interpolate', ['linear'], ['zoom'], 12, 1.1, 16, 2.8]);
        }
      } catch (error) { console.debug('Unable to tune road layer', layer.id, error); }
    });
  };
  const addMarkers = () => { households.forEach(h => { if (h.latitude == null || h.longitude == null) return; const el = document.createElement('button'); el.type = 'button'; el.className = `drrm-map-marker priority-${String(h.priority_level || 'low').toLowerCase()}`; el.title = h.household_number || 'Household'; el.addEventListener('click', event => { event.stopPropagation(); popup(householdPopup(h), [Number(h.longitude), Number(h.latitude)]); }); householdMarkers.push(new maplibregl.Marker({ element: el }).setLngLat([Number(h.longitude), Number(h.latitude)]).addTo(map)); }); centers.forEach(c => { if (c.latitude == null || c.longitude == null) return; const el = document.createElement('button'); el.type = 'button'; el.className = 'drrm-map-marker evacuation'; el.title = c.name || 'Evacuation center'; el.addEventListener('click', event => { event.stopPropagation(); popup(centerPopup(c), [Number(c.longitude), Number(c.latitude)]); }); centerMarkers.push(new maplibregl.Marker({ element: el }).setLngLat([Number(c.longitude), Number(c.latitude)]).addTo(map)); }); };
  const fit = () => { const points = [...householdData.features, ...centerData.features]; if (!points.length) return; const bounds = points.reduce((b, f) => b.extend(f.geometry.coordinates), new maplibregl.LngLatBounds(points[0].geometry.coordinates, points[0].geometry.coordinates)); map.fitBounds(bounds, { padding: 80, maxZoom: 16 }); };
  const householdLayer = { addLayer: marker => marker.addTo(map), removeLayer: marker => marker.remove() };
  window.drrmMapActions = { map, householdLayer, householdMarkers, centerLayer: { addLayer: marker => marker.addTo(map), removeLayer: marker => marker.remove() }, centerMarkers, setMode, fit, locate: () => navigator.geolocation?.getCurrentPosition(pos => map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17 }), () => toast('Location access was not available.')) };
  map.on('click', event => { if (mode === 'select-center') { drrmCenterLocationReady = true; drrmPickedLocation = { latitude: event.lngLat.lat, longitude: event.lngLat.lng }; setMode('view'); popup('<b>Evacuation center location selected</b><br>Click + Add Center again to continue.', [event.lngLat.lng, event.lngLat.lat]); return; } if (mode === 'select') { drrmPickedLocation = { latitude: event.lngLat.lat, longitude: event.lngLat.lng }; setMode('view'); popup('<b>Selected location</b><br>Click Add Household to use this point.', [event.lngLat.lng, event.lngLat.lat]); } });
  map.on('load', async () => {
    enhanceRoadVisibility();
    if (roadsUrl) {
      try {
        const roads = await fetch(roadsUrl).then(response => {
          if (!response.ok) throw new Error(`Roads request failed: ${response.status}`);
          return response.json();
        });
        map.addSource('drrm-roads', { type: 'geojson', data: roads });
        const roadWidth = ['interpolate', ['linear'], ['zoom'], 10, 1.5, 14, 3, 18, 5];
        map.addLayer({ id: 'drrm-roads-white', type: 'line', source: 'drrm-roads', paint: {
          'line-color': '#ffffff', 'line-opacity': 0.96,
          'line-width': roadWidth
        } });
      } catch (error) { console.warn('Unable to load DRRM roads GeoJSON:', error); }
    }
    if (buildingsUrl) {
      try {
        const buildings = await fetch(buildingsUrl).then(response => {
          if (!response.ok) throw new Error(`Buildings request failed: ${response.status}`);
          return response.json();
        });
        const riskBuildings = { ...buildings, features: (buildings.features || []).map(feature => ({ ...feature, properties: { ...(feature.properties || {}), risk_level: buildingRisk(feature) } })) };
        map.addSource('drrm-buildings', { type: 'geojson', data: riskBuildings });
        map.addLayer({ id: 'drrm-buildings-fill', type: 'fill', source: 'drrm-buildings', paint: {
          'fill-color': ['match', ['get', 'risk_level'], 'Critical', '#dc2626', 'High', '#ea580c', 'Moderate', '#eab308', 'Low', '#16a34a', '#cbd5e1'],
          'fill-opacity': ['match', ['get', 'risk_level'], 'None', 0.12, 0.72]
        } });
        map.addLayer({ id: 'drrm-buildings-outline', type: 'line', source: 'drrm-buildings', paint: {
          'line-color': '#f59e0b', 'line-opacity': 0.9, 'line-width': 1
        } });
        map.on('click', 'drrm-buildings-fill', event => {
          drrmPickedLocation = { latitude: event.lngLat.lat, longitude: event.lngLat.lng };
          popup('<b>Building selected</b><br><button class="primary-btn sm" data-action="new-household" data-building-add="true">Add Household</button>', [event.lngLat.lng, event.lngLat.lat]);
        });
        map.on('mouseenter', 'drrm-buildings-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'drrm-buildings-fill', () => { if (mode === 'view') map.getCanvas().style.cursor = ''; });
      } catch (error) { console.warn('Unable to load DRRM buildings GeoJSON:', error); }
    }
    map.addSource('households', { type: 'geojson', data: householdData }); map.addSource('evacuation-centers', { type: 'geojson', data: centerData }); map.addLayer({ id: 'center-points', type: 'circle', source: 'evacuation-centers', paint: { 'circle-radius': 9, 'circle-color': '#1674ed', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } }); requestAnimationFrame(() => { map.resize(); fit(); });
  });
}
