<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <title>E-Barangay Humayingan | Digital Governance and Public Service Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/bis/style.css?v={{ filemtime(public_path('css/bis/style.css')) }}" />
  <link rel="stylesheet" href="/css/bis/requirements.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</head>
<body>
  <div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>
  <main id="landingView" class="public-landing">
    <header class="public-nav">
      <a class="public-brand" href="#home" aria-label="E-Barangay home">
        <span class="public-brand-mark">E</span>
        <span><strong>E-Barangay</strong><small>Humayingan</small></span>
      </a>
      <nav class="public-nav-links" aria-label="Main navigation">
        <a href="#about">About E-Barangay</a>
        <a href="#services">Service Features</a>
        <a href="#how-it-works">How It Works</a>
      </nav>
      <div class="public-nav-actions">
        <button class="theme-toggle" id="themeToggleLanding" type="button" aria-label="Switch to dark mode" title="Switch to dark mode">☼</button>
        <button class="primary-btn public-login-trigger" type="button">Log in <span>→</span></button>
      </div>
    </header>

    <section id="home" class="public-hero">
      <div class="hero-glass-orb hero-orb-one"></div>
      <div class="hero-glass-orb hero-orb-two"></div>
      <div class="public-hero-content">
        <span class="public-eyebrow"><i></i> DIGITAL GOVERNANCE &amp; PUBLIC SERVICE PORTAL</span>
        <h1>E-Barangay<br><em>Humayingan</em></h1>
        <p>View barangay announcements, check published service requirements and procedures, submit service requests, and follow their progress online.</p>
        <div class="public-hero-actions">
          <button class="primary-btn public-login-trigger" type="button">Resident Login <span>→</span></button>
          <a href="#services" class="hero-explore-link">Explore system features <span>↓</span></a>
        </div>
        <div class="hero-trust-note"><span>✓</span> Service information published for Barangay Humayingan residents</div>
      </div>
      <aside class="hero-info-card">
        <span class="hero-card-icon">✦</span>
        <span class="hero-card-label">BARANGAY SERVICES &amp; REQUESTS</span>
        <h2>Know what to prepare and track your request.</h2>
        <p>Review published service requirements and procedures, then follow your request status in one portal.</p>
        <a href="#how-it-works">See how it works <span>→</span></a>
      </aside>
      <div class="hero-bottom-label"><span></span> E-BARANGAY HUMAYINGAN</div>
    </section>

    <section id="about" class="public-about">
      <div class="section-intro">
        <span class="public-eyebrow dark-eyebrow"><i></i> ABOUT E-BARANGAY HUMAYINGAN</span>
        <h2>A more accessible way to connect with barangay services.</h2>
        <p>E-Barangay Humayingan is a proposed digital portal where residents can find announcements, service requirements, and procedures, then submit and track selected requests online. It also gives barangay personnel a centralized dashboard to manage services, announcements, and records.</p>
      </div>
      <div id="services" class="public-service-grid">
        <article class="public-service-card">
          <span class="service-icon service-icon-gold" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="m12 2 2 2.2 2.9-.5.8 2.8 2.7 1.2-1 2.8 1.4 2.5-2.3 1.8-.1 3-3-.1-1.6 2.5-2.8-1-2.5 1.5-1.8-2.3-3 .1.1-3-2.5-1.6 1-2.8L2 10.6l2.3-1.8-.1-3 3 .1L8.8 3.4l2.8 1L12 2Z" fill="currentColor"/><circle cx="12" cy="12" r="3" fill="white"/></svg>
          </span>
          <span class="service-index">01 / CERTIFICATES</span>
          <h3>Barangay Clearances</h3><p>Issuance of barangay clearance, certificate of indigency, or certificate of residency for residents' official transactions.</p>
          <a class="public-login-trigger-link" href="#login">Access services <span>→</span></a>
        </article>
        <article class="public-service-card">
          <span class="service-icon service-icon-green" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M3 9.5h18l-1.5-5h-15L3 9.5Z" fill="currentColor"/><path d="M4.5 10v9.5h15V10M3 9.5c0 1.4 1 2.5 2.3 2.5S7.5 10.9 7.5 9.5c0 1.4 1 2.5 2.3 2.5s2.2-1.1 2.2-2.5c0 1.4 1 2.5 2.3 2.5s2.2-1.1 2.2-2.5c0 1.4 1 2.5 2.3 2.5s2.2-1.1 2.2-2.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 19.5v-5h6v5" stroke="currentColor" stroke-width="1.7"/></svg>
          </span>
          <span class="service-index">02 / BUSINESS</span>
          <h3>Business Permits</h3><p>Application and renewal of barangay business permits for local establishments and entrepreneurs.</p>
          <a class="public-login-trigger-link" href="#login">Access services <span>→</span></a>
        </article>
        <article class="public-service-card">
          <span class="service-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M6 3.5h12a2 2 0 0 1 2 2v14a1 1 0 0 1-1.5.9l-2-1.1H6a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-1.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8h8M8 11.5h8M8 15h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
          </span>
          <span class="service-index">03 / RECORDS</span>
          <h3>Blotters</h3><p>Recording of incidents, complaints, or community disputes reported to the barangay for documentation and resolution.</p>
          <a class="public-login-trigger-link" href="#login">Access services <span>→</span></a>
        </article>
        <article class="public-service-card">
          <span class="service-icon service-icon-gold" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1.2" fill="currentColor"/></svg>
          </span>
          <span class="service-index">04 / CONCERNS</span>
          <h3>Complaints</h3><p>Formal filing of grievances or issues by residents for mediation and barangay action.</p>
          <a class="public-login-trigger-link" href="#login">Access services <span>→</span></a>
        </article>
        <article class="public-service-card">
          <span class="service-icon service-icon-green" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5.5" width="16" height="16" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 3v5M16 3v5M4 10h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m9 15 2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span class="service-index">05 / SPECIAL EVENTS</span>
          <h3>Special Permits</h3><p>Application for special event or activity permits within the barangay (e.g., public gatherings, fiestas, or road closures).</p>
          <a class="public-login-trigger-link" href="#login">Access services <span>→</span></a>
        </article>
      </div>
    </section>

    <section id="how-it-works" class="public-how">
      <div class="how-glass-panel">
        <div class="how-heading"><span class="public-eyebrow dark-eyebrow"><i></i> HOW THE RESIDENT PORTAL WORKS</span><h2>From service information to request updates.</h2></div>
        <div class="how-steps">
          <article><span>01</span><div><h3>Review service information</h3><p>Check barangay announcements and the published service requirements and procedures.</p></div></article>
          <article><span>02</span><div><h3>Submit a service request</h3><p>Select an available service and provide the requested information and documents, when applicable.</p></div></article>
          <article><span>03</span><div><h3>Follow request progress</h3><p>Review your request status and history, and check notifications for updates.</p></div></article>
        </div>
      </div>
    </section>

    <section id="community" class="public-cta">
      <div><span class="public-eyebrow"><i></i> E-BARANGAY HUMAYINGAN</span><h2>Find service information and follow your request online.</h2><p>Sign in to access resident services. Available services, requirements, and procedures are published by the barangay.</p></div>
      <button class="primary-btn public-login-trigger" type="button">Resident Login <span>→</span></button>
    </section>

    <footer class="public-footer">
      <a class="public-brand" href="#home"><span class="public-brand-mark">E</span><span><strong>E-Barangay Humayingan</strong><small>Digital Governance and Public Service Portal</small></span></a>
      <span>© <span id="landingYear"></span> Barangay Humayingan · Resident services and request information</span>
    </footer>
  </main>

  <section id="loginView" class="public-login-screen hidden">
    <div class="login-glass-backdrop"></div>
    <button class="theme-toggle login-theme-toggle" id="themeToggleLogin" type="button" aria-label="Switch to dark mode" title="Switch to dark mode">☼</button>
    <div class="login-brand-panel">
      <div class="public-login-brand">
        <span class="public-brand-mark"><img src="/images/barangay-seal.png" alt="Barangay Humayingan seal"></span>
        <span><strong>E-Barangay</strong><small>Humayingan</small></span>
      </div>
      <div class="login-welcome-panel">
        <span class="login-welcome-eyebrow">BARANGAY HUMAYINGAN</span>
        <h1>Public service, closer to home.</h1>
        <p>Access barangay services, announcements, and updates in one convenient place.</p>
        <div class="login-benefits"><span>•</span><span>✦ Community</span><span>✓ Easier services</span></div>
      </div>
    </div>
    <form id="loginForm" class="glass login-card showcase-login-card">
      <h2>Welcome to E-Barangay</h2><p class="muted">Log in to access Barangay Humayingan resident services.</p>
      <label for="loginName">Email Address</label>
      <div class="input-wrap"><span class="input-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4"></circle><path d="M4.5 20a7.5 7.5 0 0 1 15 0"></path></svg></span><input id="loginName" name="email" type="email" placeholder="Enter your email address" autocomplete="email" required></div>
      <label for="loginPassword">Password</label>
      <div class="input-wrap"><span class="input-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path><circle cx="12" cy="15.5" r="1"></circle><path d="M12 16.5V18"></path></svg></span><input id="loginPassword" name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required><button class="password-toggle" type="button" aria-label="Show password" aria-pressed="false"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg></button></div>
      <div class="remember-row"><label class="check"><input type="checkbox" name="remember" value="1"> Remember me</label><a href="#" id="forgotLink">Forgot password?</a></div>
      <button class="primary-btn full" type="submit">Login <span>→</span></button>
      <p id="loginFeedback" class="auth-feedback" role="alert" aria-live="polite"></p>
      <p class="signup-line showcase-signup">Don't have an account? <a href="#" id="registerLink">Create an account</a></p>
      <button id="backToLanding" class="back-to-landing" type="button">← Back to home</button>
    </form>
    <form id="registerForm" class="glass login-card showcase-login-card hidden">
      <h2>Create your account</h2><p class="muted">Register as a Barangay Humayingan resident.</p>
      <label for="registerName">Full Name</label>
      <div class="input-wrap"><span class="input-icon" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"/><path d="M5 21a7 7 0 0 1 14 0"/></svg></span><input id="registerName" name="name" autocomplete="name" placeholder="Enter your full name" maxlength="255" required></div>
      <label for="registerEmail">Email Address</label>
      <div class="input-wrap"><span class="input-icon" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></span><input id="registerEmail" name="email" type="email" autocomplete="email" placeholder="Enter your email address" maxlength="255" required></div>
      <label for="registerPassword">Password</label>
      <div class="input-wrap"><span class="input-icon" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><input id="registerPassword" name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" minlength="8" required></div>
      <label for="registerPasswordConfirmation">Confirm Password</label>
      <div class="input-wrap"><span class="input-icon" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><input id="registerPasswordConfirmation" name="password_confirmation" type="password" autocomplete="new-password" placeholder="Enter your password again" minlength="8" required></div>
      <button class="primary-btn full" type="submit">Create Account <span>→</span></button>
      <p id="registerFeedback" class="auth-feedback" role="alert" aria-live="polite"></p>
      <p class="signup-line showcase-signup">Already registered? <a href="#" id="loginAgainLink">Log in</a></p>
      <button class="back-to-landing auth-back-home" type="button">← Back to home</button>
    </form>
    <form id="forgotPasswordForm" class="glass login-card showcase-login-card hidden">
      <h2>Forgot password?</h2><p class="muted">We'll use the same email address you entered on the login screen. To use your account's registered email, go back and enter it there first.</p>
      <label for="forgotEmail">Email Address</label>
      <div class="input-wrap"><span>•</span><input id="forgotEmail" name="email" type="email" autocomplete="email" placeholder="Return to login and enter your account email" maxlength="255" readonly required></div>
      <button class="primary-btn full" type="submit" disabled>Send Reset Link <span>→</span></button>
      <p id="forgotFeedback" class="auth-feedback" role="status" aria-live="polite"></p>
      <p class="signup-line showcase-signup"><a href="#" id="forgotLoginLink">← Back to log in</a></p>
    </form>
    <form id="resetPasswordForm" class="glass login-card showcase-login-card hidden">
      <h2>Set a new password</h2><p class="muted">Choose a new password with at least 8 characters.</p>
      <input id="resetToken" name="token" type="hidden">
      <label for="resetEmail">Email Address</label>
      <div class="input-wrap"><span>•</span><input id="resetEmail" name="email" type="email" autocomplete="email" placeholder="Enter your email address" maxlength="255" required></div>
      <label for="newPassword">New Password</label>
      <div class="input-wrap"><span class="input-icon" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><input id="newPassword" name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" minlength="8" required></div>
      <label for="newPasswordConfirmation">Confirm New Password</label>
      <div class="input-wrap"><span class="input-icon" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><input id="newPasswordConfirmation" name="password_confirmation" type="password" autocomplete="new-password" placeholder="Enter your new password again" minlength="8" required></div>
      <button class="primary-btn full" type="submit">Reset Password <span>→</span></button>
      <p id="resetFeedback" class="auth-feedback" role="alert" aria-live="polite"></p>
      <p class="signup-line showcase-signup"><a href="#" id="resetLoginLink">← Back to log in</a></p>
    </form>
    <footer class="login-screen-footer">© <span id="loginYear"></span> Barangay Humayingan · E-Barangay Portal</footer>
  </section>

  <div id="appView" class="app-shell hidden">
    <div id="mobileNavOverlay" class="mobile-nav-overlay hidden"></div>
    <aside class="sidebar glass-dark">
      <a class="brand compact" href="#" data-page="Dashboard"><div class="brand-mark small has-logo"><img src="/images/barangay-seal.png" alt="Barangay Humayingan logo"></div><div><strong>E-Barangay</strong><small>Humayingan</small></div></a>
      <nav id="navMenu"></nav>
      <div class="sidebar-bottom"><div class="help-box"><span>✦</span><b>Need help?</b><small>Contact the Barangay Office for assistance.</small><button data-page="Help">Contact us →</button></div><button class="nav-link" id="settingsBtn"><span class="nav-icon"><svg class="ui-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 15a2 2 0 0 0 .4 2.2l.1.1-1.8 1.8-.1-.1A2 2 0 0 0 15 19a2 2 0 0 0-1.8 1.7V21h-2.5v-.3A2 2 0 0 0 9 19a2 2 0 0 0-2.3 0l-.1.1-1.8-1.8.1-.1A2 2 0 0 0 5 15a2 2 0 0 0-1.7-1.8H3v-2.5h.3A2 2 0 0 0 5 9a2 2 0 0 0-.1-2.3l-.1-.1 1.8-1.8.1.1A2 2 0 0 0 9 5a2 2 0 0 0 1.8-1.7V3h2.5v.3A2 2 0 0 0 15 5a2 2 0 0 0 2.3 0l.1-.1 1.8 1.8-.1.1A2 2 0 0 0 19 9a2 2 0 0 0 1.7 1.8h.3v2.5h-.3A2 2 0 0 0 19 15Z"/></svg></span> Settings</button><button class="nav-link" id="logoutBtn"><span class="nav-icon"><svg class="ui-icon" viewBox="0 0 24 24"><path d="M10 17l5-5-5-5M15 12H3M21 4v16"/></svg></span> Log out</button></div>
    </aside>
    <main class="main-area">
      <header class="topbar glass">
        <div class="mobile-brand"><button id="mobileMenuBtn" class="mobile-menu-btn" type="button" aria-label="Open navigation" aria-expanded="false"><span></span><span></span><span></span></button><div class="brand-mark small has-logo"><img src="/images/barangay-seal.png" alt="Barangay Humayingan logo"></div><b>E-Barangay</b></div>
        <div class="breadcrumb"><span>Workspace</span><span class="crumb-sep">/</span><b id="currentCrumb">Dashboard</b></div>
        <div class="top-actions"><button class="theme-toggle" id="themeToggleApp" type="button" aria-label="Switch to dark mode" title="Switch to dark mode">☼</button><button class="icon-btn" id="notificationBtn" title="Notifications" aria-label="Notifications"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg><i hidden></i></button><div class="top-user"><div class="avatar tiny" id="topAvatar">B</div><div><b id="topName">Account</b><small id="topRole">User</small></div><div id="profileMenu" class="profile-menu hidden"><button data-action="edit-profile">Edit Profile</button><button data-action="change-password">Change Password</button><button data-action="account-settings">Account Settings</button><button data-action="profile-logout">Log out</button></div></div></div>
      </header>
      <div id="pageContent" class="page-content"></div>
      <footer>© <span id="year"></span> Barangay Humayingan · E-Barangay Portal <span>Built for better community service</span></footer>
    </main>
  </div>
  <div id="toast" class="toast"></div>
  <div id="modalLayer" class="modal-layer hidden"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="/js/bis/app.js?v={{ filemtime(public_path('js/bis/app.js')) }}"></script>
</body>
</html>