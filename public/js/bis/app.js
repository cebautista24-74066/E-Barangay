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

const requestStatuses = ["Pending", "Processing", "Approved", "Rejected", "Completed"];
const feedbackStatuses = ["Open", "In Review", "Resolved", "Closed"];
const residentNav = [
  ["Dashboard", "home"],
  ["My Profile", "user"],
  ["E-Services", "services"],
  ["My Requests", "requests"],
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
  const payload = Object.fromEntries(new FormData(form));
  if (form.id === "loginForm") payload.remember = Boolean(payload.remember);

  try {
    const { data } = await api(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
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
  $("#forgotPasswordForm").querySelector('[type="submit"]').disabled = !email;
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
  applyTheme();
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
    <span class="dashboard-module-meta"><strong>${escapeHtml(metric)}</strong><span>Open module →</span></span>
  </button>`;
}

function login(user) {
  currentUser = user;
  mode = user.role === "Administrator" ? "admin" : "resident";
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
    <div class="hero"><div><span class="eyebrow" style="color:#397bb9">BARANGAY HUMAYINGAN</span><h2>A safer, cleaner, stronger community.</h2><p>Access local information, selected barangay services, and request updates in one place.</p></div><div class="hero-badge"><b>✓ Community first</b>Transparent services. Better connections. One barangay.</div></div>
    ${stats}
    <section class="dashboard-module-section">
      <div class="dashboard-section-heading"><div><span class="eyebrow">YOUR WORKSPACE</span><h2>${mode === "admin" ? "Administration Modules" : "Resident Services"}</h2><p>${mode === "admin" ? "Choose a module to manage barangay information and service activity." : "Choose a service to submit requests, follow updates, and connect with your barangay."}</p></div></div>
      <div class="dashboard-module-grid">${modules}</div>
    </section>
    <div class="dashboard-columns">
      <section class="panel"><div class="panel-head"><h3>${mode === "admin" ? "Recent Service Requests" : "My Recent Requests"}</h3><a href="#" data-page="${mode === "admin" ? "Manage Requests" : "My Requests"}">View all →</a></div>
        <div class="table-wrap"><table><thead><tr>${requestColumns}</tr></thead><tbody>${recentRequests}</tbody></table></div>
        ${requests.length ? "" : emptyState("No requests yet", "Service requests will appear here once submitted.")}</section>
      <section class="panel"><div class="panel-head"><h3>Recent Announcements</h3><a href="#" data-page="Announcements">View all →</a></div><div class="announcement-list">${announcements.slice(0, 3).map(item => announcementMarkup(item)).join("") || emptyState("No announcements yet", "New barangay notices will appear here.")}</div></section>
    </div>`;
}

function profilePage() {
  return `${heading("My Profile", "Your account information.")}<section class="panel">
    <div class="profile-banner"><div><h3>${escapeHtml(currentUser.name)}</h3><p>${escapeHtml(currentUser.role)} · Barangay Humayingan</p></div><div class="profile-actions">${button("Edit Profile", "edit-profile", "secondary-btn sm")}${button("Change Password", "change-password", "secondary-btn sm")}${button("Account Settings", "account-settings", "secondary-btn sm")}</div></div>
    <div class="detail-list"><div class="key">Full Name</div><div class="value">${escapeHtml(currentUser.name)}</div><div class="key">Email Address</div><div class="value">${escapeHtml(currentUser.email)}</div><div class="key">Account Role</div><div class="value">${escapeHtml(currentUser.role)}</div></div>
  </section>`;
}

function servicesPage() {
  const services = pageData.services || [];
  const admin = mode === "admin";
  const cards = services.map(service => `<article class="service-card">
    <span class="stat-icon">${uiIcon("services")}</span><h3>${escapeHtml(service.name)}</h3><p>${escapeHtml(service.description)}</p>
    ${service.requirements ? `<p><b>Requirements</b><br>${escapeHtml(service.requirements).replace(/\n/g, "<br>")}</p>` : ""}
    ${service.instructions ? `<p><b>Procedure</b><br>${escapeHtml(service.instructions).replace(/\n/g, "<br>")}</p>` : ""}
    ${admin
      ? `<div class="table-actions">${button("Edit", "edit-service", "secondary-btn sm", `data-id="${service.id}"`)}${button(service.is_active ? "Deactivate" : "Activate", "toggle-service", "secondary-btn sm", `data-id="${service.id}" data-active="${service.is_active}"`)}${button("Delete", "delete-service", "danger-btn sm", `data-id="${service.id}"`)}</div>`
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
    <td>${button("Details", "request-details", "secondary-btn sm", `data-id="${request.id}"`)}</td>
  </tr>`).join("");
  const statusOptions = [`<option value="">All statuses</option>`, ...requestStatuses.map(status => `<option>${status}</option>`)].join("");
  return `${heading(admin ? "Manage Requests" : "My Requests", admin ? "Review submissions and record request status updates." : "Track the status and history of your requests.", admin ? "" : button("+ New Request", "new-request"))}
    <section class="panel"><div class="filters"><input id="requestSearch" placeholder="Search reference, resident, or service..."><select id="requestStatus">${statusOptions}</select></div>
    <div class="table-wrap"><table><thead><tr><th>Reference</th>${admin ? "<th>Resident</th>" : ""}<th>Service</th><th>Date Submitted</th><th>Status</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table></div>
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

function drrmPage() {
  const drrm = pageData.drrm || { households: [], evacuation_centers: [], summary: {} }; const summary = drrm.summary || {};
  const capacity = Number(summary.evacuation_capacity || 0); const occupied = Number(summary.evacuation_occupied || 0); const available = Math.max(0, capacity - occupied);
  const rows = drrm.households.map(item => `<tr data-drrm-row="household" data-id="${item.id}"><td>${escapeHtml(item.household_number)}</td><td>${escapeHtml(item.address)}</td><td>${escapeHtml(item.sitio || item.purok || '')}</td><td>${escapeHtml(item.location_type || 'House')}</td><td>${statusBadge(item.priority_level)}</td><td>${item.resident_count || item.members?.length || 0}</td><td><div class="table-actions">${button('Edit', 'edit-drrm-household', 'secondary-btn sm', `data-id="${item.id}"`)}${button('Delete', 'delete-drrm-household', 'danger-btn sm', `data-id="${item.id}"`)}</div></td></tr>`).join('');
  const centerRows = drrm.evacuation_centers.map(center => { const cap = Number(center.capacity || 0); const occ = Number(center.current_occupants || 0); const free = Math.max(0, cap - occ); return `<tr><td>${escapeHtml(center.name)}</td><td>${cap || 'N/A'}</td><td>${occ}</td><td>${cap ? free : 'N/A'}</td><td>${statusBadge(center.status || (free === 0 ? 'Full' : 'Open'))}</td><td><div class="table-actions">${button('Edit', 'edit-drrm-center', 'secondary-btn sm', `data-id="${center.id}"`)}${button('Delete', 'delete-drrm-center', 'danger-btn sm', `data-id="${center.id}"`)}</div></td></tr>`; }).join('');
  const drrmIcons = { households: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-6h6v6"/></svg>', priority: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 19H3L12 3Z"/><path d="M12 9v4M12 16h.01"/></svg>', vulnerable: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M10 8h3l1 4h-3l-1 4h5a4 4 0 1 1-1 2"/><path d="M10 8 8 12l-3 1"/><circle cx="15" cy="19" r="1.5"/></svg>', slots: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/><circle cx="12" cy="12" r="9"/></svg>' };
  return `${heading('DRRM Priority Map', 'Monitor vulnerable households and evacuation capacity from one map.', button('+ Add Household', 'new-household') + button('+ Add Center', 'new-drrm-center') + button('Refresh map', 'refresh'))}
    <div class="stats-grid drrm-summary">${stat('Total households', summary.total_households || 0, drrmIcons.households, 'blue')}${stat('Vulnerable residents', summary.total_vulnerable_residents || 0, drrmIcons.vulnerable, 'purple')}${stat('Available evacuation slots', available, drrmIcons.slots, 'green')}</div>
    <section class="panel drrm-map-panel"><div class="drrm-map-toolbar"><div class="drrm-mode-buttons"><button class="secondary-btn sm" data-action="drrm-view-mode">View Only</button><button class="secondary-btn sm" data-action="drrm-select-mode">Select Location</button></div><div class="drrm-map-actions"><button class="secondary-btn sm" data-action="drrm-locate">Locate me</button><button class="secondary-btn sm" data-action="drrm-fit">Zoom to markers</button><button class="secondary-btn sm" data-action="drrm-fullscreen">Fullscreen</button></div></div><div id="drrmMap" style="height:520px;border-radius:16px;overflow:hidden"></div></section>
    <section class="panel"><div class="filters drrm-filters"><input id="drrmSearch" placeholder="Search household, address, or sitio..."><select id="drrmPriority"><option value="">All priorities</option><option>Critical</option><option>High</option><option>Moderate</option><option>Low</option></select><select id="drrmLocationType"><option value="">All location types</option><option>House</option><option>School</option><option>Covered Court</option><option>Evacuation Center</option></select></div><div class="panel-head"><h3>Priority Households</h3></div><div class="table-wrap"><table><thead><tr><th>Household</th><th>Address</th><th>Sitio/Purok</th><th>Type</th><th>Priority</th><th>Residents</th><th>Actions</th></tr></thead><tbody>${rows || `<tr><td colspan="7">No DRRM household records yet.</td></tr>`}</tbody></table></div></section>
    <section class="panel"><div class="panel-head"><h3>Evacuation Capacity</h3><span class="muted">${summary.evacuation_centers || 0} active centers</span></div><div class="table-wrap"><table><thead><tr><th>Center</th><th>Capacity</th><th>Occupied</th><th>Available</th><th>Status</th><th>Actions</th></tr></thead><tbody>${centerRows || '<tr><td colspan="6">No evacuation centers.</td></tr>'}</tbody></table></div></section>`;
}

function drrmDistanceKm(a, b) { const rad = Math.PI / 180; const dLat = (b[0] - a[0]) * rad; const dLng = (b[1] - a[1]) * rad; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }

function renderDrrmMap() {
  const mapElement = $('#drrmMap'); if (!mapElement || typeof L === 'undefined') return; const drrm = pageData.drrm || {}; const households = drrm.households || []; const centers = drrm.evacuation_centers || [];
  const map = L.map(mapElement).setView([13.9965, 120.6732], 15); map.setMaxBounds([[13.975, 120.645], [14.020, 120.700]]); map.options.maxBoundsViscosity = .85; L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
  const householdLayer = L.layerGroup().addTo(map); const householdMarkers = []; const centerLayer = L.layerGroup().addTo(map); L.control.layers(null, { Households: householdLayer, 'Evacuation Centers': centerLayer }, { collapsed: false }).addTo(map);
  const legendControl = L.control({ position: 'bottomleft' });
  legendControl.onAdd = () => { const div = L.DomUtil.create('div', 'drrm-map-legend leaflet-control'); div.innerHTML = '<strong>Legend</strong><span><i class="legend-evacuation"><svg viewBox="0 0 24 24"><path d="M12 21s7-3.5 7-9V5l-7-3-7 3v7c0 5.5 7 9 7 9Z"/><path d="M12 8v5M9.5 10.5h5"/></svg></i> Evacuation Center</span><hr><strong>Household Priority</strong><span><i class="legend-dot critical"></i> Critical <i class="legend-dot high"></i> High <i class="legend-dot moderate"></i> Moderate <i class="legend-dot low"></i> Low</span>'; L.DomEvent.disableClickPropagation(div); return div; }; legendControl.addTo(map);
  let mode = 'view'; let drawPoints = [];
  const setMode = next => { mode = next; map.getContainer().classList.toggle('drrm-drawing', next !== 'view'); if (next === 'view') map.doubleClickZoom.enable(); else map.doubleClickZoom.disable(); toast(next === 'select-center' ? 'Click the map to place the evacuation center.' : next === 'select' ? 'Select Location mode enabled.' : 'View Only mode enabled.'); };
  window.drrmMapActions = { map, householdLayer, householdMarkers, centerLayer, setMode, fit: () => { const group = L.featureGroup([householdLayer, centerLayer]); if (group.getLayers().length) map.fitBounds(group.getBounds().pad(.1)); }, locate: () => navigator.geolocation?.getCurrentPosition(pos => map.setView([pos.coords.latitude, pos.coords.longitude], 17), () => toast('Location access was not available.')) };
  map.on('click', event => { if (mode === 'select-center') { drrmCenterLocationReady = true; drrmPickedLocation = { latitude: event.latlng.lat, longitude: event.latlng.lng }; setMode('view'); L.popup().setLatLng(event.latlng).setContent('<b>Evacuation center location selected</b><br>Click + Add Center again to continue.').openOn(map); toast(`Center location selected: ${event.latlng.lat.toFixed(6)}, ${event.latlng.lng.toFixed(6)}`); return; } if (mode === 'select') { drrmPickedLocation = { latitude: event.latlng.lat, longitude: event.latlng.lng }; setMode('view'); L.popup().setLatLng(event.latlng).setContent('<b>Selected location</b><br>Click Add Household to use this point.').openOn(map); return; } });
  const nearestCenter = h => centers.reduce((best, c) => { const dist = drrmDistanceKm([Number(h.latitude), Number(h.longitude)], [Number(c.latitude), Number(c.longitude)]); return !best || dist < best.distance ? { center: c, distance: dist } : best; }, null); const colors = { Critical: '#dc2626', High: '#ea580c', Moderate: '#ca8a04', Low: '#16a34a' };
  households.forEach(h => { const near = nearestCenter(h); const popup = `<b>${escapeHtml(h.household_number)}</b><br>Type: ${escapeHtml(h.location_type || 'House')}<br>${escapeHtml(h.address || '')}<br>Sitio/Purok: ${escapeHtml(h.sitio || h.purok || 'Not specified')}<br>Priority: ${escapeHtml(h.priority_level)}<hr>Residents: ${h.resident_count || 0}<br>Seniors: ${h.senior_count || 0} · PWD: ${h.pwd_count || 0}<br>Bedridden: ${h.bedridden_count || 0} · Pregnant: ${h.pregnant_count || 0}<br>Infants: ${h.infant_count || 0}<br>Medical/rescue notes: ${escapeHtml(h.notes || 'None')}${near ? `<br>Nearest center: ${escapeHtml(near.center.name)}<br>Distance: ${near.distance.toFixed(2)} km` : ''}<br><br>${button('Edit', 'edit-drrm-household', 'secondary-btn sm', `data-id="${h.id}"`)} ${button('Delete', 'delete-drrm-household', 'danger-btn sm', `data-id="${h.id}"`)}`; const marker = L.circleMarker([h.latitude, h.longitude], { radius: 8, color: colors[h.priority_level] || colors.Low, fillColor: colors[h.priority_level] || colors.Low, fillOpacity: .9 }).bindPopup(popup); marker.drrmData = h; marker.addTo(householdLayer); householdMarkers.push(marker); });
  centers.forEach(c => { const cap = Number(c.capacity || 0); const occ = Number(c.current_occupants || 0); const free = Math.max(0, cap - occ); const status = c.status || (free === 0 && cap ? 'Full' : 'Open'); L.marker([c.latitude, c.longitude]).bindPopup(`<b>${escapeHtml(c.name)}</b><br>${escapeHtml(c.address)}<br>Capacity: ${cap || 'Not set'}<br>Occupied: ${occ}<br>Available: ${cap ? free : 'Not set'}<br>Status: ${escapeHtml(status)}<br><br>${button('Edit', 'edit-drrm-center', 'secondary-btn sm', `data-id="${c.id}"`)} ${button('Delete', 'delete-drrm-center', 'danger-btn sm', `data-id="${c.id}"`)}`).addTo(centerLayer); });
  applyDrrmFilters();
}

function applyDrrmFilters() { const drrm = pageData.drrm || {}; const query = ($('#drrmSearch')?.value || '').toLowerCase(); const priority = $('#drrmPriority')?.value || ''; const locationType = $('#drrmLocationType')?.value || ''; $$('#pageContent tbody tr[data-drrm-row="household"]').forEach(row => { const item = (drrm.households || []).find(h => String(h.id) === row.dataset.id); const show = item && (!query || row.textContent.toLowerCase().includes(query)) && (!priority || item.priority_level === priority) && (!locationType || (item.location_type || 'House') === locationType); row.classList.toggle('hidden', !show); }); if (!window.drrmMapActions) return; window.drrmMapActions.householdMarkers.forEach(layer => { const item = layer.drrmData; const text = `${item.household_number} ${item.address || ''} ${item.sitio || item.purok || ''}`.toLowerCase(); const show = (!query || text.includes(query)) && (!priority || item.priority_level === priority) && (!locationType || (item.location_type || 'House') === locationType); if (show) window.drrmMapActions.householdLayer.addLayer(layer); else window.drrmMapActions.householdLayer.removeLayer(layer); }); }
function residentsPage() {
  const residents = pageData.residents || [];
  const rows = residents.map(resident => `<tr><td>${resident.id}</td><td>${escapeHtml(resident.name)}</td><td>${escapeHtml(resident.email)}</td><td>${resident.is_active ? statusBadge("Active") : statusBadge("Inactive")}</td><td><div class="table-actions">${button(resident.is_active ? "Deactivate" : "Activate", "toggle-resident", "secondary-btn sm", `data-id="${resident.id}" data-active="${resident.is_active}"`)}${button("Delete", "delete-resident", "danger-btn sm", `data-id="${resident.id}"`)}</div></td></tr>`).join("");
  return `${heading("Manage Residents", "Review database accounts and control resident access.", mode === "admin" ? button("+ Add Resident", "new-resident", "primary-btn sm") : "")}<section class="panel">
    <div class="filters"><input id="residentSearch" placeholder="Search by database ID, name, or email..."></div>
    <div class="table-wrap"><table class="residents-table"><thead><tr><th>ID</th><th>Full Name</th><th>Email</th><th>Account Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${residents.length ? "" : emptyState("No resident accounts", "Registered resident accounts will appear here.")}</section>`;
}

function feedbackPage() {
  const admin = mode === "admin";
  const feedback = pageData.feedback || [];
  const rows = feedback.map(item => `<tr>
    <td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.subject)}</td>
    ${admin ? `<td>${escapeHtml(item.resident?.name || "")}<br><small>${escapeHtml(item.resident?.email || "")}</small></td>` : ""}
    <td>${escapeHtml(new Date(item.created_at).toLocaleDateString())}</td><td>${statusBadge(item.status)}</td>
    <td>${button("View", "feedback-details", "secondary-btn sm", `data-id="${item.id}"`)}</td></tr>`).join("");
  return `${heading(admin ? "Complaints & Feedback" : "Complaints & Feedback", admin ? "Review resident concerns and update their handling status." : "Send a complaint, suggestion, or feedback to the Barangay Office.", admin ? "" : button("+ Send a Message", "new-feedback"))}
    <section class="panel"><div class="table-wrap"><table><thead><tr><th>Type</th><th>Subject</th>${admin ? "<th>Resident</th>" : ""}<th>Date</th><th>Status</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table></div>
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
  const bars = statuses.map(status => {
    const count = Number(statusCounts[status] || 0);
    const width = total ? Math.max(count / total * 100, count ? 4 : 0) : 0;
    return `<div class="report-status-row"><span>${statusBadge(status)}</span><div class="report-bar"><i style="width:${width}%"></i></div><b>${count}</b></div>`;
  }).join("");
  const services = (report.requests_by_service || []).map(item => `<tr><td>${escapeHtml(item.service)}</td><td>${Number(item.total)}</td></tr>`).join("");
  return `${heading("Reports", "Monitor service activity and export request records.", button("Export Requests CSV", "export-csv", "secondary-btn"))}
    <div class="reports-grid">${stat("Total Residents", report.total_residents || 0, uiIcon("user"))}${stat("Published Services", report.total_services || 0, uiIcon("services"), "purple")}${stat("Total Requests", total, uiIcon("requests"), "green")}</div>
    <div class="dashboard-columns"><section class="panel"><div class="panel-head"><h3>Requests by Status</h3></div><div class="report-status-list">${bars}</div></section>
    <section class="panel"><div class="panel-head"><h3>Requests by Service</h3></div><div class="table-wrap"><table><thead><tr><th>Service</th><th>Requests</th></tr></thead><tbody>${services || `<tr><td colspan="2">No request records.</td></tr>`}</tbody></table></div></section></div>`;
}

function settingsPage() {
  const admins = mode === "admin" ? (pageData.admins || []) : [];
  const adminList = admins.map(admin => { const isSelf = admin.email === currentUser?.email; const actions = isSelf ? `<small class="admin-current-label">Current account</small>` : `<div class="admin-account-actions">${button(admin.is_active ? "Deactivate" : "Activate", "toggle-admin", "secondary-btn sm", `data-id="${admin.id}"`)}${button("Delete", "delete-admin", "danger-btn sm", `data-id="${admin.id}"`)}</div>`; return `<div class="admin-account-row"><div><b>${escapeHtml(admin.name)}</b><small>${escapeHtml(admin.email)}</small></div><div class="admin-account-meta">${statusBadge(admin.is_active ? "Active" : "Inactive")}${actions}</div></div>`; }).join("");
  const adminTools = mode === "admin" ? `<h3 style="margin-top:24px">Administrator access</h3><p class="muted" style="margin-top:8px">Create and review trusted administrator accounts. This section is available only to current administrators.</p><button class="secondary-btn" data-action="new-admin">+ Add Administrator</button><div class="admin-account-list">${adminList || `<p class="muted">No administrator accounts found.</p>`}</div>` : "";
  return `${heading("Settings", "Account and display preferences.")}<section class="panel"><h3>Display</h3><p class="muted" style="margin-top:8px">Your light or dark theme preference is saved in this browser.</p><button class="secondary-btn" data-action="toggle-theme">Switch theme</button>
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
      pageData.requests = (await api("/api/requests")).data.requests;
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
      if (mode === "admin") pageData.admins = (await api("/api/admin/users/admins")).data.admins;
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
  }
}

function renderContent() {
  switch (page) {
    case "Dashboard": return dashboard();
    case "My Profile": return profilePage();
    case "E-Services": return servicesPage();
    case "My Requests": return requestsPage(false);
    case "Manage Requests": return requestsPage(true);
    case "DRRM Map": return drrmPage();
    case "Settings": return settingsPage();
    case "Manage Residents": return residentsPage();
    case "Announcements": return announcementsPage();
    case "Events": return eventsPage();
    case "Complaints & Feedback": return feedbackPage();
    case "Notifications": return notificationsPage();
    case "Reports": return reportsPage();
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
  $("#currentCrumb").textContent = page === "Dashboard" ? "Home" : page;
  renderNav();

    $("#pageContent").innerHTML = loadingSkeleton();

  try {
    await loadPageData();
    $("#pageContent").innerHTML = renderContent();
    if (page === "DRRM Map") renderDrrmMap();
  } catch (error) {
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
    } else if (field.type === "file") {
      control = `<input class="form-control" name="${escapeHtml(field.name)}" type="file" accept="${escapeHtml(field.accept || "")}" ${field.multiple ? "multiple" : ""} ${required}>`;
    } else {
      control = `<input class="form-control" name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || "text")}" value="${value}" placeholder="${escapeHtml(field.placeholder || "")}" ${required} ${field.maxLength ? `maxlength="${field.maxLength}"` : ""}>`;
    }
    return `<div class="form-field ${field.full ? "full-width" : ""}" data-field-name="${escapeHtml(field.name)}"><label>${escapeHtml(field.label)}</label>${control}${field.help ? `<small>${escapeHtml(field.help)}</small>` : ""}</div>`;
  }).join("");

  layer.innerHTML = `<form class="modal-card" id="activeModal"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p><div class="form-grid">${fieldMarkup}</div><p class="auth-feedback" id="modalFeedback" role="alert"></p><div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">Cancel</button><button class="primary-btn sm" type="submit">${escapeHtml(submitText)}</button></div></form>`;
  layer.classList.remove("hidden");
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
}

function openReadOnlyModal(title, content) {
  const layer = $("#modalLayer");
  layer.innerHTML = `<div class="modal-card"><h2>${escapeHtml(title)}</h2>${content}<div class="modal-actions"><button class="secondary-btn" data-action="close-modal">Close</button></div></div>`;
  layer.classList.remove("hidden");
}

function serviceFields(service = {}) {
  return [
    { name: "name", label: "Service name", value: service.name, required: true, maxLength: 255, full: true },
    { name: "description", label: "Description", type: "textarea", value: service.description, required: true, full: true },
    { name: "requirements", label: "Requirements", type: "textarea", value: service.requirements, placeholder: "List each official requirement on a separate line.", full: true },
    { name: "instructions", label: "Procedure / instructions", type: "textarea", value: service.instructions, full: true },
    { name: "is_active", label: "Publication status", type: "select", value: service.is_active ? "1" : "0", options: [{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }] }
  ];
}

function announcementFields(announcement = {}, eventOnly = false) {
  const categories = eventOnly ? ["Event"] : ["General", "Community", "System", "Event"];
  return [
    { name: "title", label: "Title", value: announcement.title, required: true, maxLength: 255, full: true },
    ...(eventOnly ? [{ name: "event_date", label: "Event date", type: "date", value: announcement.event_date || "", required: true }, { name: "event_time", label: "Event time", type: "time", value: announcement.event_time || "", required: true }] : []),
    ...(eventOnly ? [] : [{ name: "category", label: "Category", type: "select", value: announcement.category, options: categories.map(value => ({ value, label: value })) }]),
    { name: "is_published", label: "Visibility", type: "select", value: announcement.is_published === false ? "0" : "1", options: [{ value: "1", label: "Published" }, { value: "0", label: "Draft" }] },
    { name: "body", label: "Details, requirements, or schedule", type: "textarea", value: announcement.body, required: true, full: true }
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
}

async function viewRequest(id) {
  const request = pageData.requests.find(item => String(item.id) === String(id));
  if (!request) throw new Error("The selected request could not be found.");
  const history = (request.status_history || []).map(item => `<li><b>${escapeHtml(item.to_status)}</b> · ${escapeHtml(new Date(item.created_at).toLocaleString())}<br><small>${escapeHtml(item.changed_by?.name || "Resident")}${item.note ? ` — ${escapeHtml(item.note)}` : ""}</small></li>`).join("");
  const files = (request.files || []).map(file => `<li><a href="/api/request-files/${file.id}" target="_blank" rel="noopener">${escapeHtml(file.original_name)}</a> (${Math.ceil(file.size / 1024)} KB)</li>`).join("");
  const adminControls = mode === "admin" ? `<form id="requestStatusForm" class="form-grid" data-id="${request.id}">
    <div class="form-field"><label>Update status</label><select class="form-control" name="status" required>${requestStatuses.map(status => `<option ${status === request.status ? "selected" : ""}>${status}</option>`).join("")}</select></div>
    <div class="form-field full-width"><label>Staff note</label><textarea class="form-control" name="admin_note" maxlength="2000">${escapeHtml(request.admin_note || "")}</textarea></div>
    <div class="form-field full-width"><button class="primary-btn sm" type="submit">Save status</button></div><p class="auth-feedback" id="requestStatusFeedback" role="alert"></p>
  </form>` : request.admin_note ? `<p><b>Barangay note:</b> ${escapeHtml(request.admin_note)}</p>` : "";
  openReadOnlyModal(request.reference_code, `<p><b>Service:</b> ${escapeHtml(request.service?.name || "")}</p><p><b>Status:</b> ${statusBadge(request.status)}</p><p><b>Purpose:</b><br>${escapeHtml(request.purpose)}</p><h3>Submitted documents</h3><ul>${files || "<li>No files attached</li>"}</ul><h3>Status history</h3><ol>${history || "<li>No status history</li>"}</ol>${adminControls}`);
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
    case "drrm-select-mode": window.drrmMapActions?.setMode('select'); break;
    case "drrm-locate": window.drrmMapActions?.locate(); break;
    case "drrm-fit": window.drrmMapActions?.fit(); break;
    case "drrm-fullscreen": { const el = $('#drrmMap'); if (!document.fullscreenElement) el?.requestFullscreen?.(); else document.exitFullscreen?.(); break; }
    case "new-drrm-center":
      if (!drrmCenterLocationReady) { window.drrmMapActions?.setMode('select-center'); return; }
      openModal('Add Evacuation Center', 'Add a center and track its capacity.', [{ name: 'name', label: 'Center name', required: true }, { name: 'address', label: 'Address', required: true }, { name: 'latitude', label: 'Latitude', type: 'number', required: true, value: drrmPickedLocation?.latitude?.toFixed(6) || '13.9965' }, { name: 'longitude', label: 'Longitude', type: 'number', required: true, value: drrmPickedLocation?.longitude?.toFixed(6) || '120.6732' }, { name: 'capacity', label: 'Capacity', type: 'number' }, { name: 'current_occupants', label: 'Current occupants', type: 'number', value: '0' }, { name: 'status', label: 'Status', type: 'select', options: [{ value: 'Open', label: 'Open' }, { value: 'Full', label: 'Full' }, { value: 'Temporarily Closed', label: 'Temporarily Closed' }] }], 'Save center', async formData => { await api('/api/admin/drrm/evacuation-centers', { method: 'POST', body: JSON.stringify(Object.fromEntries(formData)) }); toast('Evacuation center added.'); drrmCenterLocationReady = false; await render(); });
      break;
    case "edit-drrm-household": { const h = (pageData.drrm.households || []).find(item => String(item.id) === element.dataset.id); if (!h) return; openModal('Edit Household', 'Update location and vulnerability counts.', [{ name: 'address', label: 'Address', required: true, value: h.address }, { name: 'sitio', label: 'Sitio', value: h.sitio || h.purok || '' }, { name: 'landmark', label: 'Landmark', value: h.landmark || '' }, { name: 'latitude', label: 'Latitude', type: 'number', required: true, value: h.latitude }, { name: 'longitude', label: 'Longitude', type: 'number', required: true, value: h.longitude }, { name: 'resident_count', label: 'Residents', type: 'number', required: true, value: h.resident_count || 0 }, { name: 'senior_count', label: 'Seniors', type: 'number', value: h.senior_count || 0 }, { name: 'pwd_count', label: 'PWD', type: 'number', value: h.pwd_count || 0 }, { name: 'bedridden_count', label: 'Bedridden', type: 'number', value: h.bedridden_count || 0 }, { name: 'pregnant_count', label: 'Pregnant', type: 'number', value: h.pregnant_count || 0 }, { name: 'infant_count', label: 'Infants', type: 'number', value: h.infant_count || 0 }, { name: 'notes', label: 'Medical/rescue notes', type: 'textarea', full: true, value: h.notes || '' }], 'Save changes', async formData => { await api(`/api/admin/drrm/households/${h.id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(formData)) }); toast('Household updated.'); await render(); }); break; }
    case "edit-drrm-center": { const c = (pageData.drrm.evacuation_centers || []).find(item => String(item.id) === element.dataset.id); if (!c) return; openModal('Edit Evacuation Center', 'Update capacity and operating status.', [{ name: 'name', label: 'Center name', required: true, value: c.name }, { name: 'address', label: 'Address', required: true, value: c.address }, { name: 'latitude', label: 'Latitude', type: 'number', required: true, value: c.latitude }, { name: 'longitude', label: 'Longitude', type: 'number', required: true, value: c.longitude }, { name: 'capacity', label: 'Capacity', type: 'number', value: c.capacity || 0 }, { name: 'current_occupants', label: 'Current occupants', type: 'number', value: c.current_occupants || 0 }, { name: 'status', label: 'Status', type: 'select', value: c.status || 'Open', options: [{ value: 'Open', label: 'Open' }, { value: 'Full', label: 'Full' }, { value: 'Temporarily Closed', label: 'Temporarily Closed' }] }], 'Save changes', async formData => { await api(`/api/admin/drrm/evacuation-centers/${c.id}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(formData)) }); toast('Evacuation center updated.'); await render(); }); break; }
    case "delete-drrm-household": { if (!confirm('Permanently delete this household? This cannot be undone.')) return; await api(`/api/admin/drrm/households/${element.dataset.id}`, { method: 'DELETE' }); toast('Household deleted.'); await render(); break; } case "delete-drrm-center": { if (!confirm('Permanently delete this evacuation center? This cannot be undone.')) return; await api(`/api/admin/drrm/evacuation-centers/${element.dataset.id}`, { method: 'DELETE' }); toast('Evacuation center deleted.'); await render(); break; }    case "new-household":
      openModal("Add DRRM Household", "Add a household location and its highest-priority vulnerability information.", [
        { name: "household_number", label: "Reference number", placeholder: "HH-001", required: true },
        { name: "location_type", label: "Location type", type: "select", options: [{ value: "House", label: "House" }, { value: "Evacuation Center", label: "Evacuation Center" }, { value: "School", label: "School" }, { value: "Covered Court", label: "Covered Court" }] },
{ name: "address", label: "House / landmark address", placeholder: "e.g. near Humayingan Elementary School", help: "Required: use a house number, street, or nearby landmark.", required: true, full: true },
        { name: "sitio", label: "Sitio" },
        { name: "latitude", label: "Latitude", type: "number", value: drrmPickedLocation?.latitude?.toFixed(6) || "13.9965", required: true },
        { name: "longitude", label: "Longitude", type: "number", value: drrmPickedLocation?.longitude?.toFixed(6) || "120.6732", required: true },
        { name: "resident_count", label: "Total people in household", type: "number", value: "1", required: true },
        { name: "senior_count", label: "Senior citizens", type: "number", value: "0" },
        { name: "pwd_count", label: "PWDs", type: "number", value: "0" },
        { name: "bedridden_count", label: "Bedridden residents", type: "number", value: "0" },
        { name: "pregnant_count", label: "Pregnant residents", type: "number", value: "0" },
        { name: "infant_count", label: "Infants", type: "number", value: "0" },
        { name: "transport_assistance_count", label: "Needs transport assistance", type: "number", value: "0" },
        { name: "medical_needs", label: "Medical/rescue notes", type: "textarea", full: true }
      ], "Save household", async formData => {
        const data = Object.fromEntries(formData);
        const counts = data.location_type === "House" ? { resident_count: Number(data.resident_count || 0), senior_count: Number(data.senior_count || 0), pwd_count: Number(data.pwd_count || 0), bedridden_count: Number(data.bedridden_count || 0), pregnant_count: Number(data.pregnant_count || 0), infant_count: Number(data.infant_count || 0), transport_assistance_count: Number(data.transport_assistance_count || 0) } : { resident_count: 0, senior_count: 0, pwd_count: 0, bedridden_count: 0, pregnant_count: 0, infant_count: 0, transport_assistance_count: 0 };
        const payload = { household_number: data.household_number, location_type: data.location_type, address: data.address, sitio: data.sitio, latitude: Number(data.latitude), longitude: Number(data.longitude), ...counts, members: [] };
        await api("/api/admin/drrm/households", { method: "POST", body: JSON.stringify(payload) });
        toast("DRRM household added.");
        await render();
      });
      $("#activeModal [name=location_type]").addEventListener("change", event => {
        const isHouse = event.target.value === "House";
        ["resident_count", "senior_count", "pwd_count", "bedridden_count", "pregnant_count", "infant_count", "transport_assistance_count", "medical_needs"].forEach(name => {
          const field = $("#activeModal [data-field-name=" + name + "]");
          if (field) field.classList.toggle("hidden", !isHouse);
        });
      });
      break;    case "new-request":
      await createRequest();
      break;
    case "request-service":
      await createRequest(element.dataset.id);
      break;
    case "request-details":
      await viewRequest(element.dataset.id);
      break;
    case "new-feedback":
      await createFeedback();
      break;
    case "feedback-details":
      await viewFeedback(element.dataset.id);
      break;
    case "new-service":
      openModal("Add Barangay Service", "Only publish services and requirements confirmed by barangay personnel.", serviceFields({ is_active: true }), "Save service", async formData => {
        await api("/api/services", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) });
        toast("Service published.");
        await render();
      });
      break;
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
      if (!service || !confirm(`Permanently delete "${service.name}"? This cannot be undone.`)) return;
      await api(`/api/services/${service.id}`, { method: "DELETE" });
      toast("Service deleted.");
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
    }    case "export-csv":
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
      break;
  }
}

function handleActionClick(element) {
  $("#profileMenu")?.classList.add("hidden");
  action(element.dataset.action, element).catch(error => toast(error.message || "The action could not be completed."));
}

applyTheme();
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
  closeMobileNav();
  try {
    const { data } = await api("/auth/logout", { method: "POST", body: JSON.stringify({}) });
    updateCsrfToken(data.csrf_token);
    currentUser = null;
    $("#appView").classList.add("hidden");
    $("#landingView").classList.remove("hidden");
    $("#loginView").classList.add("hidden");
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
  if (event.target.id === "requestSearch" || event.target.id === "requestStatus") {
    const query = ($("#requestSearch")?.value || "").toLowerCase();
    const status = $("#requestStatus")?.value || "";
    $$("#pageContent tbody tr").forEach(row => {
      const visible = row.textContent.toLowerCase().includes(query)
        && (!status || row.textContent.includes(status));
      row.classList.toggle("hidden", !visible);
    });
  }
  if (["drrmSearch", "drrmPriority", "drrmLocationType"].includes(event.target.id)) applyDrrmFilters();
  if (event.target.id === "residentSearch") {
    const query = event.target.value.toLowerCase();
    $$("#pageContent tbody tr").forEach(row => row.classList.toggle("hidden", !row.textContent.toLowerCase().includes(query)));
  }
});
$("#modalLayer").addEventListener("submit", async event => {
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
