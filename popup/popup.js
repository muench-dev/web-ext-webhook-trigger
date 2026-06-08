console.log('=== POPUP.JS LOADING ===');

const STATUS_VARIANTS = ["success", "error", "info", "hidden"];

document.addEventListener("DOMContentLoaded", async () => {
  console.log('=== DOMContentLoaded FIRED ===');
  // Get elements first
  const statusMessageEl = document.getElementById("status-message");
  
  // Jobposting UI elements
  const jobpostingSection = document.getElementById("jobposting-section");
  const jobpostingHeader = jobpostingSection?.querySelector(".jobposting-header");
  const statusLed = document.getElementById("jobposting-status-led");
  const statusText = document.getElementById("jobposting-status-text");

  // Ensure browserAPI is available
  console.log('Getting browserAPI...');
  const browserAPI = window.getBrowserAPI();
  console.log('browserAPI:', browserAPI);
  if (!browserAPI) {
    console.error('browserAPI is not available');
    return;
  }

  console.log('DOMContentLoaded - Popup initialized');

  replaceI18nPlaceholders();

  // Debug: Check if elements exist
  console.debug('Jobposting elements found:', {
    section: jobpostingSection,
    led: statusLed,
    text: statusText
  });
  const jobpostingCurrent = document.getElementById("jobposting-current");
  const jobpostingCurrentKid = document.getElementById("jobposting-current-kid");
  const setActiveBtn = document.getElementById("set-active-jobposting-btn");
  const jobpostingActive = document.getElementById("jobposting-active");
  const jobpostingActiveKid = document.getElementById("jobposting-active-kid");
  const clearActiveBtn = document.getElementById("clear-active-jobposting-btn");
  const portalAutomationSection = document.getElementById("portal-automation-section");
  const portalAutomationLed = document.getElementById("portal-automation-led");
  const portalAutomationSetup = document.getElementById("portal-automation-setup");
  const portalAutomationStatus = document.getElementById("portal-automation-status");
  const portalAutomationWebhook = document.getElementById("portal-automation-webhook");
  const portalAutomationTitle = document.getElementById("portal-automation-title");
  const automationStatusBadge = document.getElementById("automation-status-badge");
  const automationCandidateName = document.getElementById("automation-candidate-name");
  const automationProgressBar = document.getElementById("automation-progress-bar");
  const automationProgressText = document.getElementById("automation-progress-text");
  const automationStats = document.getElementById("automation-stats");
  const automationErrorAlert = document.getElementById("automation-error-alert");
  const automationErrorText = document.getElementById("automation-error-text");
  const startPortalAutomationBtn = document.getElementById("start-portal-automation-btn");
  const automationContinueBtn = document.getElementById("automation-continue-btn");
  const automationRetryBtn = document.getElementById("automation-retry-btn");
  const automationResetBtn = document.getElementById("automation-reset-btn");
  const automationStopBtn = document.getElementById("automation-stop-btn");

  let currentTabKid = null;
  let currentTabUrl = null;
  let activeJobpostingUrl = null;
  let portalAutomationRefreshTimer = null;
  let currentPortal = null;

  // Update jobposting UI based on current state. The popup only shows
  // jobposting details when there is a current or pinned jobposting;
  // the toolbar badge carries the no-jobposting "X" state.
  const updateJobpostingUI = (active, current) => {
    if (!jobpostingSection) {
      console.debug('Jobposting section element not found');
      return;
    }

    console.debug('updateJobpostingUI called:', { active, current });

    jobpostingSection.classList.remove("hidden");

    const status = current?.status || 'none';
    currentTabKid = current?.kid || null;
    currentTabUrl = current?.url || null;
    activeJobpostingUrl = active?.url || null;
    const hasCurrentJobposting = Boolean(currentTabKid);
    const hasActiveJobposting = Boolean(active?.kid);
    const showCurrentTabStatus = status === 'mismatch' || hasCurrentJobposting;

    if (!showCurrentTabStatus && !hasActiveJobposting) {
      jobpostingSection.classList.add("hidden");
      jobpostingHeader?.classList.add("hidden");
      if (statusText) statusText.textContent = "";
      jobpostingCurrent?.classList.add('hidden');
      jobpostingActive?.classList.add('hidden');
      return;
    }

    jobpostingSection.classList.remove("hidden");
    if (jobpostingHeader) {
      jobpostingHeader.classList.toggle("hidden", !showCurrentTabStatus);
    }

    if (showCurrentTabStatus) {
      statusLed.className = 'status-led';
      let messageKey;
      let fallbackText;
      if (status === 'mismatch') {
        statusLed.classList.add('red');
        messageKey = 'popupCurrentTabDifferentJobposting';
        fallbackText = 'Anderes Jobposting in diesem Tab';
      } else {
        statusLed.classList.add('green');
        messageKey = 'popupCurrentTabJobposting';
        fallbackText = 'Jobposting in diesem Tab';
      }

      let statusTextValue = fallbackText;
      try {
        if (browserAPI?.i18n?.getMessage) {
          const message = browserAPI.i18n.getMessage(messageKey);
          if (message) statusTextValue = message;
        }
      } catch (e) {
        console.debug('i18n error:', e);
      }

      statusText.textContent = statusTextValue;
    } else {
      statusLed.className = 'status-led';
      statusLed.classList.add('gray');
      statusText.textContent = '';
    }

    // Show current tab jobposting if on jobposting page
    console.debug('currentTabKid:', currentTabKid);
    if (currentTabKid) {
      console.debug('Showing jobposting-current section');
      jobpostingCurrent.classList.remove('hidden');
      jobpostingCurrentKid.textContent = currentTabKid;
      jobpostingCurrentKid.onclick = () => {
        if (currentTabUrl) {
          chrome.tabs.create({ url: currentTabUrl });
          window.close();
        }
      };
    } else {
      console.debug('Hiding jobposting-current section');
      jobpostingCurrent.classList.add('hidden');
    }

    // Show active jobposting info — independent of current tab.
    if (active?.kid) {
      jobpostingActive.classList.remove('hidden');
      jobpostingActiveKid.textContent = active.kid;
      jobpostingActiveKid.onclick = () => {
        if (activeJobpostingUrl) {
          chrome.tabs.create({ url: activeJobpostingUrl });
          window.close();
        }
      };
    } else {
      jobpostingActive.classList.add('hidden');
    }
  };

  // Initialize jobposting section.
  //
  // Delegates to the shared `computeCurrentJobpostingState` helper
  // (loaded via popup.html before this script) so the regex /
  // storage / status logic is not duplicated between popup.js and
  // background.js.
  const initJobpostingSection = async () => {
    try {
      if (typeof computeCurrentJobpostingState !== 'function' || !browserAPI) {
        console.debug('jobposting helper or browserAPI unavailable');
        jobpostingSection?.classList.remove('hidden');
        updateJobpostingUI(null, null);
        return;
      }

      const state = await computeCurrentJobpostingState(browserAPI);
      console.debug('Jobposting state:', state);
      updateJobpostingUI(state.active, state.current);
    } catch (error) {
      console.error('Failed to initialize jobposting section:', error);
      jobpostingSection?.classList.remove('hidden');
      updateJobpostingUI(null, null);
    }
  };

  const sendAutomationMessage = async (message) => {
    const response = await browserAPI.runtime.sendMessage(message);
    if (!response || response.success === false) {
      throw new Error(response?.error || "Automation command failed.");
    }
    return response;
  };

  const setAutomationLed = (status) => {
    if (!portalAutomationLed) return;
    portalAutomationLed.className = "status-led";
    if (status === "awaiting_user" || status === "complete") {
      portalAutomationLed.classList.add("green");
    } else if (status === "preparing" || status === "running") {
      portalAutomationLed.classList.add("gray");
    } else if (status === "stopped") {
      portalAutomationLed.classList.add("red");
    } else {
      portalAutomationLed.classList.add("gray");
    }
  };

  const getPortalLabel = (portal) => {
    if (portal === "linkedin") return "LinkedIn";
    if (portal === "xing") return "XING";
    return "Portal";
  };

  const populateAutomationWebhooks = async () => {
    if (!portalAutomationWebhook) return;
    const { webhooks = [] } = await browserAPI.storage.sync.get("webhooks");
    const previousValue = portalAutomationWebhook.value;
    portalAutomationWebhook.textContent = "";

    webhooks.forEach((webhook) => {
      const option = document.createElement("option");
      option.value = webhook.id;
      option.textContent = `${webhook.emoji ? `${webhook.emoji} ` : ""}${webhook.label}`;
      portalAutomationWebhook.appendChild(option);
    });

    if (previousValue && webhooks.some((webhook) => webhook.id === previousValue)) {
      portalAutomationWebhook.value = previousValue;
    }

    startPortalAutomationBtn.disabled = webhooks.length === 0;
    if (webhooks.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No webhooks configured";
      portalAutomationWebhook.appendChild(option);
    }
  };

  const renderAutomationStatus = (portal, run) => {
    if (!portalAutomationSection) return;
    currentPortal = portal || run?.portal || currentPortal;
    const shouldShow = portal === "xing" || portal === "linkedin" || Boolean(run);
    portalAutomationSection.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) return;

    const portalLabel = getPortalLabel(portal || currentPortal || run?.portal);
    if (portalAutomationTitle) {
      portalAutomationTitle.textContent = `${portalLabel} automation`;
    }
    if (startPortalAutomationBtn) {
      startPortalAutomationBtn.textContent = `Start ${portalLabel} automation`;
    }

    const status = run?.status || "idle";
    setAutomationLed(status);

    const runActive = Boolean(run && ["running", "preparing", "awaiting_user", "failed"].includes(run.status));
    portalAutomationSetup?.classList.toggle("hidden", runActive);
    portalAutomationStatus?.classList.toggle("hidden", !run);

    if (!run) {
      return;
    }

    const candidateName = run.currentCandidate?.name || run.message || "No current candidate";
    const total = run.total || run.candidates?.length || 0;
    const currentPosition = run.status === "complete"
      ? total
      : Math.min((run.currentIndex || 0) + 1, total);
    const progressPercent = total > 0 ? (currentPosition / total) * 100 : 0;

    const statusLabels = {
      preparing: "PREPARING",
      awaiting_user: "WAITING",
      running: "RUNNING",
      complete: "DONE",
      stopped: "STOPPED",
      failed: "FAILED",
    };
    const badgeText = statusLabels[run.status] || run.status.toUpperCase();

    if (automationStatusBadge) {
      automationStatusBadge.textContent = badgeText;
      automationStatusBadge.className = `automation-status-badge ${run.status}`;
    }

    if (automationCandidateName) {
      automationCandidateName.textContent = candidateName;
    }

    if (automationProgressBar) {
      automationProgressBar.style.width = `${progressPercent}%`;
    }
    if (automationProgressText) {
      automationProgressText.textContent = `${currentPosition} / ${total}`;
    }

    if (automationStats) {
      const sentEl = automationStats.querySelector(".stat.sent");
      const failedEl = automationStats.querySelector(".stat.failed");
      if (sentEl) sentEl.textContent = `Sent: ${run.successCount || 0}`;
      if (failedEl) failedEl.textContent = `Failed: ${run.failureCount || 0}`;
    }

    const lastFailure = Array.isArray(run.failures) && run.failures.length > 0
      ? run.failures[run.failures.length - 1]
      : null;
    if (automationErrorAlert) {
      automationErrorAlert.classList.toggle("hidden", !lastFailure);
      if (lastFailure && automationErrorText) {
        automationErrorText.textContent = lastFailure.error;
      }
    }

    const awaitingUser = run.status === "awaiting_user";
    const failed = run.status === "failed";
    if (automationContinueBtn) automationContinueBtn.disabled = !awaitingUser;
    if (automationRetryBtn) automationRetryBtn.disabled = !failed;
    if (automationResetBtn) automationResetBtn.disabled = !run;
    if (automationStopBtn) automationStopBtn.disabled = !runActive;
  };

  const refreshAutomationStatus = async () => {
    try {
      const response = await sendAutomationMessage({ type: "GET_PORTAL_AUTOMATION_STATUS" });
      currentPortal = response.portal || currentPortal;
      await populateAutomationWebhooks();
      renderAutomationStatus(response.portal, response.run);
    } catch (error) {
      console.error("Failed to refresh automation status:", error);
      portalAutomationSection?.classList.add("hidden");
    }
  };

  const runAutomationCommand = async (message) => {
    try {
      const response = await sendAutomationMessage(message);
      renderAutomationStatus(response.portal || currentPortal || "xing", response.run);
      await refreshAutomationStatus();
    } catch (error) {
      console.error("Automation command failed:", error);
      setStatus("error", error.message);
    }
  };

  if (startPortalAutomationBtn) {
    startPortalAutomationBtn.addEventListener("click", async () => {
      await runAutomationCommand({
        type: "START_PORTAL_AUTOMATION",
        portal: currentPortal || "xing",
        webhookId: portalAutomationWebhook?.value || "",
      });
    });
  }

  automationContinueBtn?.addEventListener("click", async () => {
    await runAutomationCommand({ type: "COMPLETE_CURRENT_AUTOMATION_CANDIDATE" });
  });

  automationRetryBtn?.addEventListener("click", async () => {
    await runAutomationCommand({ type: "RETRY_CURRENT_AUTOMATION_CANDIDATE" });
  });

  automationResetBtn?.addEventListener("click", async () => {
    await runAutomationCommand({ type: "RESET_PORTAL_AUTOMATION" });
  });

  automationStopBtn?.addEventListener("click", async () => {
    await runAutomationCommand({ type: "STOP_PORTAL_AUTOMATION" });
  });

  // Handle set active jobposting
  if (setActiveBtn) {
    setActiveBtn.addEventListener('click', async () => {
      if (!currentTabKid) return;

      try {
        const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) return;

        // Store active jobposting directly in storage
        await browserAPI.storage.local.set({
          'active_jobposting': {
            kid: currentTabKid,
            url: tabs[0].url,
            setAt: new Date().toISOString()
          }
        });

        // Refresh UI
        await initJobpostingSection();

        const successMsg = browserAPI.i18n.getMessage('popupJobpostingSetSuccess') || 'Jobposting gesetzt';
        setStatus('success', successMsg);
      } catch (error) {
        console.error('Failed to set active jobposting:', error);
        const errorMsg = browserAPI.i18n.getMessage('popupJobpostingSetError') || 'Fehler beim Setzen';
        setStatus('error', errorMsg);
      }
    });
  }

  // Handle clear active jobposting
  if (clearActiveBtn) {
    clearActiveBtn.addEventListener('click', async () => {
      try {
        // Remove active jobposting directly from storage
        await browserAPI.storage.local.remove('active_jobposting');
        await initJobpostingSection();

        const successMsg = browserAPI.i18n.getMessage('popupJobpostingCleared') || 'Zurückgesetzt';
        setStatus('success', successMsg);
      } catch (error) {
        console.error('Failed to clear active jobposting:', error);
      }
    });
  }

  const setStatus = (variant, message) => {
    if (!statusMessageEl) return;
    STATUS_VARIANTS.forEach(v => statusMessageEl.classList.remove(v));
    const text = message || "";
    statusMessageEl.textContent = text;
    if (!text) {
      statusMessageEl.classList.add("hidden");
      return;
    }
    const effectiveVariant = STATUS_VARIANTS.includes(variant) ? variant : "info";
    statusMessageEl.classList.add(effectiveVariant);
  };

  
  const applyThemePreference = async () => {
    try {
      const themeResult = await browserAPI.storage.sync.get("theme");
      const theme = themeResult && themeResult.theme ? themeResult.theme : "system";
      const root = document.documentElement;
      if (theme === "light" || theme === "dark") {
        root.setAttribute("data-theme", theme);
      } else {
        root.removeAttribute("data-theme");
      }
    } catch (error) {
      console.warn("Failed to load theme preference", error);
    }
  };

  
  
  document.getElementById("open-options").addEventListener("click", (event) => {
    event.preventDefault();
    browserAPI.runtime.openOptionsPage();
  });

  await applyThemePreference();

  // Debug: Check if LED is visible before initialization
  console.debug('Pre-init LED check:', {
    led: statusLed,
    ledVisible: statusLed ? window.getComputedStyle(statusLed).display : 'N/A',
    ledOpacity: statusLed ? window.getComputedStyle(statusLed).opacity : 'N/A',
    ledBackground: statusLed ? window.getComputedStyle(statusLed).backgroundColor : 'N/A'
  });

  console.log('About to call initJobpostingSection...');
  await initJobpostingSection();
  await refreshAutomationStatus();
  portalAutomationRefreshTimer = setInterval(refreshAutomationStatus, 1500);
  window.addEventListener("beforeunload", () => {
    if (portalAutomationRefreshTimer) {
      clearInterval(portalAutomationRefreshTimer);
    }
  });
  console.log('initJobpostingSection done');
});
