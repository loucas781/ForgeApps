const devLoginForm = document.querySelector("[data-dev-login-form]");
const devSendForm = document.querySelector("[data-dev-send-form]");
const devAuthState = document.querySelector("[data-dev-auth-state]");
const devSendState = document.querySelector("[data-dev-send-state]");
const devSessionSummary = document.querySelector("[data-dev-session-summary]");
const devLogoutButton = document.querySelector("[data-dev-logout]");

let activeBaseUrl = "";
let activeDeveloperEmail = "";

const ensureNoTrailingSlash = (value) => value.replace(/\/+$/, "");

const setAuthState = (text, isError) => {
  if (!devAuthState) return;
  devAuthState.textContent = text;
  devAuthState.classList.toggle("status-error", Boolean(isError));
  devAuthState.classList.toggle("status-ok", !isError);
};

const setSendState = (text, isError) => {
  if (!devSendState) return;
  devSendState.textContent = text;
  devSendState.classList.toggle("status-error", Boolean(isError));
  devSendState.classList.toggle("status-ok", !isError);
};

const renderSession = () => {
  if (!devSessionSummary) return;

  if (!activeBaseUrl || !activeDeveloperEmail) {
    devSessionSummary.textContent = "No active session.";
    setAuthState("Not signed in.", false);
    setSendState("Waiting for login.", false);
    return;
  }

  devSessionSummary.textContent = `Signed in as ${activeDeveloperEmail} against ${activeBaseUrl}`;
  setAuthState("Signed in.", false);
  setSendState("Ready to send push.", false);
};

const postJSON = async (url, payload, headers = {}) => {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(payload)
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {}

  return { response, data };
};

if (devLoginForm) {
  devLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(devLoginForm);
    const baseUrl = ensureNoTrailingSlash(String(form.get("baseUrl") || "").trim());
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    if (!baseUrl || !email || !password) {
      setAuthState("Base URL, email, and password are required.", true);
      return;
    }

    setAuthState("Signing in...", false);

    try {
      const { response, data } = await postJSON(`${baseUrl}/api/developer/session/login`, { email, password });
      if (!response.ok) {
        setAuthState("Login failed. Check credentials and API URL.", true);
        return;
      }

      activeBaseUrl = baseUrl;
      activeDeveloperEmail = data?.developer?.email || email;
      renderSession();
    } catch (error) {
      setAuthState("Login request failed. Check network/CORS/API route.", true);
    }
  });
}

if (devSendForm) {
  devSendForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!activeBaseUrl) {
      setSendState("Sign in first.", true);
      return;
    }

    const form = new FormData(devSendForm);
    const userID = String(form.get("userId") || "").trim();
    const title = String(form.get("title") || "").trim();
    const body = String(form.get("body") || "").trim();

    if (!userID || !title || !body) {
      setSendState("User ID, title, and body are required.", true);
      return;
    }

    setSendState("Sending push...", false);

    try {
      const { response } = await postJSON(
        `${activeBaseUrl}/api/developer/session/push/send`,
        { userID, title, body }
      );

      if (!response.ok) {
        setSendState(`Push failed (${response.status}).`, true);
        return;
      }

      setSendState("Push queued successfully.", false);
      devSendForm.reset();
    } catch (error) {
      setSendState("Push request failed. Check network/CORS/API route.", true);
    }
  });
}

if (devLogoutButton) {
  devLogoutButton.addEventListener("click", () => {
    const currentBaseURL = activeBaseUrl;
    activeBaseUrl = "";
    activeDeveloperEmail = "";
    if (!currentBaseURL) {
      renderSession();
      return;
    }

    postJSON(`${currentBaseURL}/api/developer/session/logout`, {})
      .finally(() => {
        renderSession();
      });
  });
}

renderSession();
