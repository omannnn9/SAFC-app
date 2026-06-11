const $ = (id) => document.getElementById(id);

let googleClientId = "";
let currentSource = "welcomect";
let currentUser = "";
let canUsePrivateAdmin = false;

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
  });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.error) || data || `Request failed ${res.status}`);
  return data;
}

function showLoginHelp(msg) {
  $("login-help").textContent = msg;
}

function setPrivateControlsEnabled(enabled) {
  canUsePrivateAdmin = enabled;
  document.querySelectorAll("[data-source]").forEach((button) => {
    button.disabled = !enabled;
    button.title = enabled ? "" : "Detailed signup lists need private admin login.";
  });
  const pickWinner = $("pick-winner");
  if (pickWinner) pickWinner.disabled = !enabled;
  const createAdmin = $("create-admin");
  if (createAdmin) createAdmin.disabled = !enabled;
}

window.handleCredentialResponse = async (resp) => {
  try {
    const data = await api("/api/admin/google-login", {
      method: "POST",
      body: JSON.stringify({ credential: resp.credential }),
    });
    currentUser = data.username || "";
    canUsePrivateAdmin = true;
    showLoginHelp(`Signed in as ${currentUser}.`);
    await refresh();
  } catch (err) {
    showLoginHelp(
      `${err.message} Use a different Google account and choose your @southafricafc.com email.`,
    );
    try {
      google.accounts.id.disableAutoSelect();
    } catch (e) {}
  }
};

function renderGoogleButton() {
  if (!window.google || !google.accounts || !googleClientId) return;
  google.accounts.id.initialize({
    client_id: googleClientId,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: false,
    use_fedcm_for_prompt: false,
  });
  const holder = document.querySelector(".g_id_signin");
  if (holder) {
    holder.innerHTML = "";
    google.accounts.id.renderButton(holder, {
      type: "standard",
      size: "large",
      theme: "filled_black",
      text: "signin_with",
      shape: "pill",
    });
  }
}

async function initGoogle() {
  const cfg = await api("/api/watchparty/config?source=main");
  googleClientId = cfg.google_client_id || "";
  const chooser = `https://accounts.google.com/AccountChooser?continue=${encodeURIComponent(location.href)}`;
  $("account-chooser-link").href = chooser;

  if (!googleClientId) {
    document.querySelector(".g_id_signin")?.classList.add("hidden");
    $("choose-account").disabled = true;
    $("account-chooser-link").classList.add("hidden");
    showLoginHelp(
      "Read-only signup totals are available below. Private Google admin login is not configured yet, so detailed supporter lists and winner tools are disabled.",
    );
    setPrivateControlsEnabled(false);
    return;
  }

  showLoginHelp(
    "Use your authorized @southafricafc.com Google account. If your personal account is rejected, choose a different Google account.",
  );
  let tries = 0;
  const wait = setInterval(() => {
    tries++;
    if (window.google && google.accounts) {
      clearInterval(wait);
      renderGoogleButton();
    } else if (tries > 40) {
      clearInterval(wait);
      showLoginHelp("Google sign-in script did not load. Refresh and try again.");
    }
  }, 100);
}

async function refresh() {
  try {
    await loadSummary();

    if (!googleClientId) return;

    try {
      const session = await api("/api/session");
      currentUser = session.username || "";
      canUsePrivateAdmin = Boolean(session.authenticated);
      $("session").classList.toggle("hidden", !session.authenticated);
      $("session").textContent = session.authenticated
        ? `Signed in as ${session.username}`
        : "Not signed in";
      $("login-box").classList.toggle("hidden", session.authenticated);
      $("super-admin").classList.toggle("hidden", session.username !== "kj@southafricafc.com");
      setPrivateControlsEnabled(session.authenticated);
      if (session.authenticated) await loadList(currentSource);
    } catch (err) {
      setPrivateControlsEnabled(false);
      showLoginHelp("Read-only totals loaded. Private admin session routes are not available yet.");
    }
  } catch (e) {
    showLoginHelp(e.message || String(e));
  }
}

async function loadSummary() {
  const data = await api("/api/watchparty/admin/summary");
  $("summary").innerHTML = "";
  data.items.forEach((item) => {
    const b = document.createElement("button");
    b.className = item.source_key === "welcomect" ? "primary" : "secondary";
    b.type = "button";
    b.textContent = `${item.label}: ${item.signups} sign-ups • ${item.winners} winner(s)`;
    b.onclick = () => {
      if (canUsePrivateAdmin) loadList(item.source_key);
    };
    $("summary").appendChild(b);
  });
}

async function loadList(source) {
  if (!canUsePrivateAdmin) {
    $("list-title").textContent = "Detailed signup list unavailable in read-only mode";
    $("signup-list").innerHTML =
      '<tr><td colspan="6">Use the totals above for now. Private admin login must be configured before supporter details can be shown here.</td></tr>';
    return;
  }

  currentSource = source;
  const data = await api(`/api/watchparty/admin/signups?source=${encodeURIComponent(source)}`);
  $("list-title").textContent = `${data.label} sign-ups (${data.items.length})`;
  $("signup-list").innerHTML =
    data.items
      .map(
        (i) =>
          `<tr><td>${i.full_name}</td><td>${i.email}</td><td>${i.mobile}</td><td>${i.payment_reference}</td><td>${i.membership_status}</td><td>${i.created_at}</td></tr>`,
      )
      .join("") || '<tr><td colspan="6">No sign-ups yet.</td></tr>';
}

document.querySelectorAll("[data-source]").forEach((b) => {
  b.onclick = () => loadList(b.dataset.source);
});

$("choose-account").onclick = () => {
  if (!googleClientId) {
    showLoginHelp("Google admin login is not configured yet. Read-only totals are available.");
    return;
  }
  try {
    google.accounts.id.disableAutoSelect();
    google.accounts.id.prompt();
    showLoginHelp(
      "Choose your @southafricafc.com Google account. If the browser reuses the wrong account, use the account chooser link.",
    );
  } catch (e) {
    showLoginHelp(
      "Open the Google account chooser link, switch account, then return and sign in again.",
    );
  }
};

$("pick-winner").onclick = async () => {
  if (!canUsePrivateAdmin) return loadList(currentSource);
  try {
    const data = await api("/api/watchparty/admin/random-winner", {
      method: "POST",
      body: JSON.stringify({ source_key: currentSource, prize_label: $("prize-label").value }),
    });
    const w = data.winner;
    $("winner").classList.remove("hidden");
    $("winner").textContent =
      `Winner: ${w.full_name} • ${w.email} • ${w.mobile} • ${w.payment_reference}. Email tracker: ${data.email_sent ? "sent" : "not sent"}${data.email_error ? " — " + data.email_error : ""}`;
    await loadSummary();
  } catch (err) {
    alert(err.message);
  }
};

$("create-admin").onclick = async () => {
  if (!canUsePrivateAdmin) return;
  try {
    const email = $("new-admin").value.trim();
    const data = await api("/api/watchparty/admin/create-admin", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    alert(`Authorized ${data.email}`);
  } catch (err) {
    alert(err.message);
  }
};

$("logout").onclick = async () => {
  try {
    if (googleClientId) google.accounts.id.disableAutoSelect();
  } catch (e) {}
  try {
    await api("/api/admin/logout", { method: "POST", body: "{}" });
  } catch (e) {}
  location.reload();
};

initGoogle().then(refresh);
