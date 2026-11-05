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

const requestStatuses = ["Pending", "Processing", "Approved", "Rejected", "Completed"];
const feedbackStatuses = ["Open", "In Review", "Resolved", "Closed"];
const residentNav = [
  ["Dashboard", "⌂"],
  ["My Profile", "♙"],
  ["E-Services", "▣"],
  ["My Requests", "▤"],
  ["Notifications", "♧"],
  ["Complaints & Feedback", "✉"],
  ["Announcements", "⚑"],
  ["Events", "▦"]
];
const adminNav = [
  ["Dashboard", "⌂"],
  ["Manage Residents", "♟"],
  ["Manage Requests", "▤"],
  ["E-Services", "▣"],
  ["Announcements", "⚑"],
  ["Complaints & Feedback", "✉"],
  ["Events", "▦"],
  ["Reports", "▥"]
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
  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    headers.set("X-CSRF-TOKEN", csrfToken);
  } else if (options.method && options.method !== "GET") {
    headers.set("X-CSRF-TOKEN", csrfToken);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin"
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
    button.textContent = darkMode ? "☀" : "☾";
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
    `<button class="nav-link ${page === label ? "active" : ""}" data-page="${escapeHtml(label)}"><span>${icon}</span>${escapeHtml(label)}</button>`
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
  return `<div class="empty-state"><span>▤</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div>`;
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
    <div class="announcement-thumb">${announcement.category === "Community" ? "♡" : announcement.category === "System" ? "⚙" : "⚑"}</div>
    <div><b>${escapeHtml(announcement.title)}</b><small>${escapeHtml(announcement.body)}</small><small>${escapeHtml(date)} · ${escapeHtml(announcement.category)}${announcement.is_published ? "" : " · Draft"}</small></div>
    ${admin ? `<div class="table-actions">${button("Edit", "edit-announcement", "secondary-btn sm", `data-id="${announcement.id}"`)}${button("Delete", "delete-announcement", "secondary-btn sm", `data-id="${announcement.id}"`)}</div>` : ""}
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
    ? `<div class="stat-grid">${stat("Total Residents", residentCount, "♟")}${stat("Pending Requests", requests.filter(item => item.status === "Pending").length, "◷", "orange")}${stat("Open Concerns", openFeedback, "✉", "purple")}${stat("Active Services", services.filter(service => service.is_active).length, "▣", "green")}</div>`
    : `<div class="stat-grid">${stat("My Pending Requests", pendingRequests, "◷")}${stat("Completed Requests", completedRequests, "✓", "green")}${stat("My Open Concerns", openFeedback, "✉", "purple")}${stat("Available Services", services.length, "▣", "orange")}</div>`;

  const modules = mode === "admin"
    ? [
      moduleCard("Manage Residents", "Resident accounts and access", "♟", "Manage Residents", residentCount, "blue"),
      moduleCard("Manage Requests", "Review and update submissions", "▤", "Manage Requests", requests.length, "green"),
      moduleCard("Manage E-Services", "Services, requirements, procedures", "▣", "E-Services", services.length, "gold"),
      moduleCard("Announcements", "Publish barangay updates", "⚑", "Announcements", announcements.length, "purple"),
      moduleCard("Complaints & Feedback", "Review community concerns", "✉", "Complaints & Feedback", openFeedback, "rose"),
      moduleCard("Reports", "Request activity and CSV export", "▥", "Reports", "View reports", "teal"),
      moduleCard("System Information", "Account and display settings", "⚙", "Settings", "Settings", "slate")
    ].join("")
    : [
      moduleCard("E-Services", "View official requirements and apply", "▣", "E-Services", services.length, "blue"),
      moduleCard("My Requests", "Track status and request history", "▤", "My Requests", pendingRequests ? `${pendingRequests} active` : requests.length, "green"),
      moduleCard("Notifications", "Read request status updates", "♧", "Notifications", unreadNotifications ? `${unreadNotifications} unread` : "All caught up", "gold"),
      moduleCard("Complaints & Feedback", "Send concerns or suggestions", "✉", "Complaints & Feedback", openFeedback ? `${openFeedback} open` : "Send message", "rose"),
      moduleCard("Announcements", "Barangay news and public notices", "⚑", "Announcements", announcements.length, "purple"),
      moduleCard("Community Events", "Schedules and barangay activities", "▦", "Events", events.length, "teal")
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
    <div class="hero"><div><span class="eyebrow" style="color:#397bb9">BARANGAY HUMAYINGAN</span><h2>A safer, cleaner, stronger community.</h2><p>Access local information, selected barangay services, and request updates in one place.</p></div><div class="hero-badge"><b>✦ Community first</b>Transparent services. Better connections. One barangay.</div></div>
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
    <div class="profile-banner"><div class="avatar large">${initials(currentUser.name)}</div><div><h3>${escapeHtml(currentUser.name)}</h3><p>${escapeHtml(currentUser.role)} · Barangay Humayingan</p></div></div>
    <div class="detail-list"><div class="key">Full Name</div><div class="value">${escapeHtml(currentUser.name)}</div><div class="key">Email Address</div><div class="value">${escapeHtml(currentUser.email)}</div><div class="key">Account Role</div><div class="value">${escapeHtml(currentUser.role)}</div></div>
    <p class="muted" style="margin-top:18px">For corrections to official resident details, please contact the Barangay Office.</p>
  </section>`;
}

function servicesPage() {
  const services = pageData.services || [];
  const admin = mode === "admin";
  const cards = services.map(service => `<article class="service-card">
    <span class="stat-icon">▣</span><h3>${escapeHtml(service.name)}</h3><p>${escapeHtml(service.description)}</p>
    ${service.requirements ? `<p><b>Requirements</b><br>${escapeHtml(service.requirements).replace(/\n/g, "<br>")}</p>` : ""}
    ${service.instructions ? `<p><b>Procedure</b><br>${escapeHtml(service.instructions).replace(/\n/g, "<br>")}</p>` : ""}
    ${admin
      ? `<div class="table-actions">${button("Edit", "edit-service", "secondary-btn sm", `data-id="${service.id}"`)}${button(service.is_active ? "Deactivate" : "Activate", "toggle-service", "secondary-btn sm", `data-id="${service.id}" data-active="${service.is_active}"`)}</div>`
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
  return `${heading("Events", "Barangay activities and upcoming community schedules.")}
    <section class="panel"><div class="announcement-list">${events.map(item => announcementMarkup(item, mode === "admin")).join("") || emptyState("No upcoming events", "Published event announcements will appear here.")}</div></section>`;
}

function residentsPage() {
  const residents = pageData.residents || [];
  const rows = residents.map(resident => `<tr><td>${resident.id}</td><td>${escapeHtml(resident.name)}</td><td>${escapeHtml(resident.email)}</td><td>${resident.is_active ? statusBadge("Active") : statusBadge("Inactive")}</td><td>${button(resident.is_active ? "Deactivate" : "Activate", "toggle-resident", "secondary-btn sm", `data-id="${resident.id}" data-active="${resident.is_active}"`)}</td></tr>`).join("");
  return `${heading("Manage Residents", "Review database accounts and control resident access.")}<section class="panel">
    <div class="filters"><input id="residentSearch" placeholder="Search by database ID, name, or email..."></div>
    <div class="table-wrap"><table><thead><tr><th>Database ID</th><th>Full Name</th><th>Email</th><th>Account Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>
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
      <div class="announcement-thumb">♧</div>
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
    <div class="reports-grid">${stat("Total Residents", report.total_residents || 0, "♟")}${stat("Published Services", report.total_services || 0, "▣", "purple")}${stat("Total Requests", total, "▤", "green")}</div>
    <div class="dashboard-columns"><section class="panel"><div class="panel-head"><h3>Requests by Status</h3></div><div class="report-status-list">${bars}</div></section>
    <section class="panel"><div class="panel-head"><h3>Requests by Service</h3></div><div class="table-wrap"><table><thead><tr><th>Service</th><th>Requests</th></tr></thead><tbody>${services || `<tr><td colspan="2">No request records.</td></tr>`}</tbody></table></div></section></div>`;
}

function settingsPage() {
  return `${heading("Settings", "Account and display preferences.")}<section class="panel"><h3>Display</h3><p class="muted" style="margin-top:8px">Your light or dark theme preference is saved in this browser.</p><button class="secondary-btn" data-action="toggle-theme">Switch theme</button>
    <h3 style="margin-top:24px">Email notifications</h3><p class="muted" style="margin-top:8px">Email delivery depends on the mail server settings configured by the system administrator.</p></section>`;
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

async function render() {
  $("#currentCrumb").textContent = page === "Dashboard" ? "Home" : page;
  renderNav();
  $("#pageContent").innerHTML = `<section class="panel"><p>Loading ${escapeHtml(page.toLowerCase())}...</p></section>`;
  try {
    await loadPageData();
    $("#pageContent").innerHTML = renderContent();
  } catch (error) {
    $("#pageContent").innerHTML = `<section class="panel"><div class="empty-state"><h3>Unable to load ${escapeHtml(page.toLowerCase())}</h3><p>${escapeHtml(error.message)}</p><button class="secondary-btn" data-action="retry">Try again</button></div></section>`;
  }
}

function go(next) {
  const allowed = (mode === "admin" ? adminNav : residentNav).some(([label]) => label === next);
  if (!allowed && !["Help", "Settings"].includes(next)) return;
  page = next;
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
    return `<div class="form-field ${field.full ? "full-width" : ""}"><label>${escapeHtml(field.label)}</label>${control}${field.help ? `<small>${escapeHtml(field.help)}</small>` : ""}</div>`;
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

function announcementFields(announcement = {}) {
  const categories = ["General", "Community", "System", "Event"];
  return [
    { name: "title", label: "Title", value: announcement.title, required: true, maxLength: 255, full: true },
    { name: "category", label: "Category", type: "select", value: announcement.category, options: categories.map(value => ({ value, label: value })) },
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
    return `<article class="announcement-item"><div class="announcement-thumb">♧</div><div><b>${escapeHtml(details.message || "System notification")}</b><small>${escapeHtml(new Date(notification.created_at).toLocaleString())}</small></div>${notification.read_at ? "" : button("Mark read", "mark-notification-read", "secondary-btn sm", `data-id="${notification.id}"`)}</article>`;
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
    case "new-request":
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
    case "toggle-service": {
      const service = pageData.services.find(item => String(item.id) === element.dataset.id);
      await api(`/api/services/${service.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: service.name,
          description: service.description,
          requirements: service.requirements || "",
          instructions: service.instructions || "",
          is_active: !service.is_active
        })
      });
      toast(service.is_active ? "Service deactivated." : "Service activated.");
      await render();
      break;
    }
    case "new-announcement":
      openModal("New Announcement", "Publish a verified barangay notice, event, or service update.", announcementFields(), "Publish", async formData => {
        await api("/api/announcements", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) });
        toast("Announcement published.");
        await render();
      });
      break;
    case "edit-announcement": {
      const announcement = pageData.announcements.find(item => String(item.id) === element.dataset.id);
      openModal("Edit Announcement", "Update the barangay notice.", announcementFields(announcement), "Save changes", async formData => {
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
    case "toggle-resident": {
      const resident = pageData.residents.find(item => String(item.id) === element.dataset.id);
      await api(`/api/residents/${resident.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !resident.is_active })
      });
      toast(resident.is_active ? "Resident access deactivated." : "Resident access activated.");
      await render();
      break;
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
    case "toggle-theme":
      toggleTheme();
      break;
    case "close-modal":
      $("#modalLayer").classList.add("hidden");
      break;
  }
}

function handleActionClick(element) {
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
$("#settingsBtn").addEventListener("click", () => go("Settings"));
$("#notificationBtn").addEventListener("click", () => {
  showNotifications().catch(error => toast(error.message || "Unable to load notifications."));
});
$("#userMenuBtn").addEventListener("click", () => go("My Profile"));
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
