(function initAdminRsvp() {
  const STATUS_LABELS = Object.freeze({
    pending: "Pendiente",
    confirmed: "Confirmada",
    declined: "No asistira",
  });
  const STATUS_ORDER = Object.freeze({
    pending: 0,
    confirmed: 1,
    declined: 2,
  });
  const AUTO_REFRESH_MS = 45000;

  const refs = {
    authView: document.querySelector("[data-auth-view]"),
    loginForm: document.querySelector("[data-login-form]"),
    loginSubmit: document.querySelector("[data-login-submit]"),
    authFeedback: document.querySelector("[data-auth-feedback]"),
    dashboardView: document.querySelector("[data-dashboard-view]"),
    dashboardFeedback: document.querySelector("[data-dashboard-feedback]"),
    adminEmail: document.querySelector("[data-admin-email]"),
    refreshButton: document.querySelector("[data-refresh-dashboard]"),
    signOutButton: document.querySelector("[data-sign-out]"),
    summaryTotalGroups: document.querySelector("[data-summary-total-groups]"),
    summaryConfirmed: document.querySelector("[data-summary-confirmed]"),
    summaryPending: document.querySelector("[data-summary-pending]"),
    summaryDeclined: document.querySelector("[data-summary-declined]"),
    summarySeats: document.querySelector("[data-summary-seats]"),
    summaryTotalGuests: document.querySelector("[data-summary-total-guests]"),
    searchInput: document.querySelector("[data-filter-search]"),
    sideFilters: [...document.querySelectorAll("[data-filter-side]")],
    statusFilters: [...document.querySelectorAll("[data-filter-status]")],
    filterCount: document.querySelector("[data-filter-count]"),
    lastUpdated: document.querySelector("[data-last-updated]"),
    groupList: document.querySelector("[data-group-list]"),
    detailCard: document.querySelector("[data-detail-card]"),
    detailEmpty: document.querySelector("[data-detail-empty]"),
    detailContent: document.querySelector("[data-detail-content]"),
    detailGroupName: document.querySelector("[data-detail-group-name]"),
    detailMeta: document.querySelector("[data-detail-meta]"),
    detailStatus: document.querySelector("[data-detail-status]"),
    detailMaxCompanions: document.querySelector("[data-detail-max-companions]"),
    detailCompanionsCount: document.querySelector("[data-detail-companions-count]"),
    detailConfirmedAt: document.querySelector("[data-detail-confirmed-at]"),
    detailMembers: document.querySelector("[data-detail-members]"),
    detailMessage: document.querySelector("[data-detail-message]"),
    recentList: document.querySelector("[data-recent-list]"),
  };

  const hasMissingRefs = Object.values(refs).some((value) => {
    if (Array.isArray(value)) {
      return !value.length;
    }

    return !value;
  });

  if (hasMissingRefs) {
    return;
  }

  const supabaseState = createAdminSupabaseClient();
  const state = {
    client: supabaseState.client,
    configError: supabaseState.errorMessage,
    groups: [],
    filteredGroups: [],
    recentResponses: [],
    selectedGroupKey: "",
    filters: {
      search: "",
      side: "all",
      status: "all",
    },
    isAuthenticating: false,
    isLoadingDashboard: false,
    refreshTimer: 0,
    currentUserId: "",
  };

  if (!state.client) {
    showAuthView(state.configError, "error");
    return;
  }

  function repairMojibake(value) {
    const source = String(value || "");

    if (!/[\u00c2\u00c3]/.test(source) || typeof TextDecoder !== "function") {
      return source;
    }

    try {
      const bytes = Uint8Array.from(
        Array.from(source, (character) => character.charCodeAt(0) & 255)
      );
      const repaired = new TextDecoder("utf-8").decode(bytes);
      return repaired || source;
    } catch (error) {
      return source;
    }
  }

  function cleanText(value) {
    return repairMojibake(value).replace(/\s+/g, " ").trim();
  }

  function normalizeText(value) {
    return cleanText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function createAdminSupabaseClient() {
    const config = window.SUPABASE_CONFIG || {};
    const url = String(config.url || "").trim();
    const anonKey = String(config.anonKey || "").trim();

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      return {
        client: null,
        errorMessage:
          "No pudimos cargar Supabase en este momento. Recarga la pagina e intentalo de nuevo.",
      };
    }

    if (!url || !anonKey || url.includes("YOUR_") || anonKey.includes("YOUR_")) {
      return {
        client: null,
        errorMessage:
          "El panel admin aun no esta configurado. Completa supabase-config.js con tu URL y tu anon key.",
      };
    }

    return {
      client: window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        global: {
          headers: {
            "x-client-info": "amy-wilfraidi-admin-rsvp",
          },
        },
      }),
      errorMessage: "",
    };
  }

  function setFeedback(node, message, tone) {
    node.textContent = message || "";

    if (message) {
      node.dataset.tone = tone || "info";
    } else {
      delete node.dataset.tone;
    }
  }

  function showAuthView(message, tone) {
    refs.authView.hidden = false;
    refs.dashboardView.hidden = true;
    refs.loginForm.reset();
    stopAutoRefresh();
    clearDashboardState();
    setFeedback(refs.authFeedback, message || "", tone || "info");
    setFeedback(refs.dashboardFeedback, "", "info");
  }

  function showDashboardView() {
    refs.authView.hidden = true;
    refs.dashboardView.hidden = false;
    setFeedback(refs.authFeedback, "", "info");
  }

  function setButtonLoading(button, isLoading, idleLabel, loadingLabel) {
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingLabel : idleLabel;
  }

  function formatDateTime(value) {
    if (!value) {
      return "Sin respuesta";
    }

    try {
      return new Intl.DateTimeFormat("es-DO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch (error) {
      return cleanText(value);
    }
  }

  function formatSideLabel(side) {
    if (side === "amy") {
      return "Amy";
    }

    if (side === "wilfraidi") {
      return "Wilfraidi";
    }

    return "Invitacion";
  }

  function getStatusLabel(status) {
    return STATUS_LABELS[status] || STATUS_LABELS.pending;
  }

  function getGroupKey(side, groupName) {
    return [side, normalizeText(groupName)].join("::");
  }

  function parseGroupName(groupName) {
    const source = cleanText(groupName);
    const parts = source
      .split(/\u00c2?\u00b7/)
      .map((part) => cleanText(part))
      .filter(Boolean);

    return {
      familyName: parts[0] || source || "Grupo",
      anchorName: parts[1] || "",
      raw: source,
    };
  }

  function statusValue(status) {
    return STATUS_ORDER[status] ?? 99;
  }

  function formatGroupMeta(group) {
    const bits = [
      formatSideLabel(group.side),
      `${group.members.length} invitado(s)`,
    ];

    if (group.anchorName) {
      bits.push(`Titular: ${group.anchorName}`);
    }

    return bits.join(" / ");
  }

  function createStatusChip(status) {
    const chip = document.createElement("span");
    chip.className = "admin-status-chip";
    chip.dataset.status = status;
    chip.textContent = getStatusLabel(status);
    return chip;
  }

  function createMiniChip(text) {
    const chip = document.createElement("span");
    chip.className = "admin-mini-chip";
    chip.textContent = text;
    return chip;
  }

  function setActiveChip(buttons, selectedValue, attributeName) {
    buttons.forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset[attributeName] === selectedValue
      );
    });
  }

  function clearDashboardState() {
    state.groups = [];
    state.filteredGroups = [];
    state.recentResponses = [];
    state.selectedGroupKey = "";
    state.currentUserId = "";
    refs.adminEmail.textContent = "";
    refs.searchInput.value = "";
    state.filters.search = "";
    state.filters.side = "all";
    state.filters.status = "all";
    setActiveChip(refs.sideFilters, "all", "filterSide");
    setActiveChip(refs.statusFilters, "all", "filterStatus");
    renderSummary([]);
    renderGroupList([]);
    renderRecentResponses([]);
    renderEmptyDetail();
    refs.lastUpdated.textContent = "";
  }

  function renderSummary(groups) {
    const summary = groups.reduce(
      (totals, group) => {
        totals.totalGroups += 1;
        totals.totalGuests += group.members.length;

        if (group.status === "confirmed") {
          totals.confirmed += 1;
          totals.seats += Number(group.companionsCount || 0);
        } else if (group.status === "declined") {
          totals.declined += 1;
        } else {
          totals.pending += 1;
        }

        return totals;
      },
      {
        totalGroups: 0,
        confirmed: 0,
        pending: 0,
        declined: 0,
        seats: 0,
        totalGuests: 0,
      }
    );

    refs.summaryTotalGroups.textContent = String(summary.totalGroups);
    refs.summaryConfirmed.textContent = String(summary.confirmed);
    refs.summaryPending.textContent = String(summary.pending);
    refs.summaryDeclined.textContent = String(summary.declined);
    refs.summarySeats.textContent = String(summary.seats);
    refs.summaryTotalGuests.textContent = String(summary.totalGuests);
  }

  function renderEmptyDetail() {
    refs.detailEmpty.hidden = false;
    refs.detailContent.hidden = true;
  }

  function renderDetail(group) {
    if (!group) {
      renderEmptyDetail();
      return;
    }

    refs.detailEmpty.hidden = true;
    refs.detailContent.hidden = false;
    refs.detailGroupName.textContent = group.familyName;
    refs.detailMeta.textContent = formatGroupMeta(group);
    refs.detailStatus.dataset.status = group.status;
    refs.detailStatus.textContent = getStatusLabel(group.status);
    refs.detailMaxCompanions.textContent = String(group.maxCompanions);
    refs.detailCompanionsCount.textContent = String(
      group.status === "confirmed" ? Number(group.companionsCount || 0) : 0
    );
    refs.detailConfirmedAt.textContent = formatDateTime(
      group.latestResponse?.createdAt || group.confirmedAt
    );

    refs.detailMembers.innerHTML = "";
    group.members.forEach((member) => {
      const item = document.createElement("li");
      item.textContent = member;
      refs.detailMembers.append(item);
    });

    if (group.latestResponse?.message) {
      refs.detailMessage.textContent = group.latestResponse.message;
    } else if (group.status === "pending") {
      refs.detailMessage.textContent =
        "Esta invitacion aun no ha registrado una respuesta.";
    } else if (group.status === "declined") {
      refs.detailMessage.textContent =
        "La invitacion fue marcada como no asistira y no dejo mensaje adicional.";
    } else {
      refs.detailMessage.textContent =
        "La invitacion fue confirmada sin mensaje adicional.";
    }
  }

  function renderGroupList(groups) {
    refs.groupList.innerHTML = "";

    if (!groups.length) {
      const empty = document.createElement("div");
      empty.className = "admin-empty-state";
      empty.textContent =
        "No encontramos invitaciones con esos filtros. Prueba con otro nombre, lado o estado.";
      refs.groupList.append(empty);
      refs.filterCount.textContent = "0 invitaciones";
      return;
    }

    refs.filterCount.textContent =
      groups.length === 1 ? "1 invitacion" : `${groups.length} invitaciones`;

    groups.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-group-card";
      button.dataset.groupKey = group.key;

      if (group.key === state.selectedGroupKey) {
        button.classList.add("is-selected");
      }

      const head = document.createElement("div");
      head.className = "admin-group-card-head";

      const textWrap = document.createElement("div");
      const title = document.createElement("h4");
      title.textContent = group.familyName;

      const copy = document.createElement("p");
      copy.className = "admin-group-card-copy";
      copy.textContent = group.anchorName
        ? `Titular: ${group.anchorName}`
        : `${group.members.length} invitado(s)`;

      const meta = document.createElement("p");
      meta.textContent = `${formatSideLabel(group.side)} / ${group.members.length} invitado(s)`;

      textWrap.append(title, copy, meta);
      head.append(textWrap, createStatusChip(group.status));

      const chipRow = document.createElement("div");
      chipRow.className = "admin-group-card-meta";
      chipRow.append(createMiniChip(`Cupo ${group.maxCompanions}`));

      if (group.status === "confirmed") {
        chipRow.append(
          createMiniChip(`Confirmados ${Number(group.companionsCount || 0)}`)
        );
      } else if (group.status === "declined") {
        chipRow.append(createMiniChip("No asistiran"));
      } else {
        chipRow.append(createMiniChip("Sin respuesta"));
      }

      if (group.latestResponse?.createdAt || group.confirmedAt) {
        chipRow.append(
          createMiniChip(
            `Ultima respuesta ${formatDateTime(
              group.latestResponse?.createdAt || group.confirmedAt
            )}`
          )
        );
      }

      button.append(head, chipRow);
      refs.groupList.append(button);
    });
  }

  function renderRecentResponses(responses) {
    refs.recentList.innerHTML = "";

    if (!responses.length) {
      const empty = document.createElement("div");
      empty.className = "admin-empty-state";
      empty.textContent =
        "Todavia no hay respuestas registradas. En cuanto alguien confirme, aparecera aqui.";
      refs.recentList.append(empty);
      return;
    }

    responses.slice(0, 14).forEach((response) => {
      const item = document.createElement("article");
      item.className = "admin-recent-item";

      const head = document.createElement("div");
      head.className = "admin-recent-item-head";

      const name = document.createElement("strong");
      name.textContent = response.fullName;

      head.append(name, createStatusChip(response.status));

      const meta = document.createElement("p");
      meta.textContent = [
        response.familyName,
        `Lado ${formatSideLabel(response.side)}`,
        formatDateTime(response.createdAt),
      ].join(" / ");

      const summary = document.createElement("p");
      summary.textContent =
        response.status === "confirmed"
          ? `${response.companionsCount} persona(s) confirmada(s).`
          : "Marcado como no asistira.";

      item.append(head, meta, summary);

      if (response.message) {
        const message = document.createElement("p");
        message.textContent = response.message;
        item.append(message);
      }

      refs.recentList.append(item);
    });
  }

  function buildDashboardData(guestRows, responseRows) {
    const groupsMap = new Map();
    const guestById = new Map();

    guestRows.forEach((guest) => {
      const groupParts = parseGroupName(guest.group_name);
      const guestName = cleanText(guest.full_name);
      const key = getGroupKey(guest.side, guest.group_name);
      const confirmedAt = guest.confirmed_at || null;
      const companionsCount = Number(guest.companions_count || 0);

      guestById.set(guest.id, {
        ...guest,
        groupKey: key,
        groupParts,
        fullName: guestName,
      });

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          side: guest.side,
          groupName: cleanText(guest.group_name),
          familyName: groupParts.familyName,
          anchorName: groupParts.anchorName,
          members: [],
          searchIndex: normalizeText(
            `${groupParts.familyName} ${groupParts.anchorName}`
          ),
          maxCompanions: Number(guest.max_companions || 1),
          status: guest.status || "pending",
          attending: guest.attending,
          companionsCount,
          confirmedAt,
          latestResponse: null,
        });
      }

      const group = groupsMap.get(key);
      group.members.push(guestName);
      group.searchIndex = normalizeText(
        `${group.searchIndex} ${guestName} ${guest.side}`
      );
      group.maxCompanions = Math.max(
        group.maxCompanions,
        Number(guest.max_companions || 1)
      );

      const currentStamp = group.confirmedAt
        ? new Date(group.confirmedAt).getTime()
        : 0;
      const nextStamp = confirmedAt ? new Date(confirmedAt).getTime() : 0;

      if (
        statusValue(guest.status) >= statusValue(group.status) &&
        nextStamp >= currentStamp
      ) {
        group.status = guest.status || "pending";
        group.attending = guest.attending;
        group.companionsCount = companionsCount;
        group.confirmedAt = confirmedAt;
      }
    });

    const recentResponses = (responseRows || [])
      .map((response) => {
        const guest = guestById.get(response.guest_id);

        if (!guest) {
          return null;
        }

        const normalizedResponse = {
          id: response.id,
          guestId: response.guest_id,
          side: guest.side,
          groupKey: guest.groupKey,
          familyName: guest.groupParts.familyName,
          anchorName: guest.groupParts.anchorName,
          fullName: cleanText(response.full_name),
          status: response.attending ? "confirmed" : "declined",
          companionsCount: Number(response.companions_count || 0),
          message: cleanText(response.message),
          createdAt: response.created_at,
        };

        const group = groupsMap.get(guest.groupKey);

        if (
          group &&
          (!group.latestResponse ||
            new Date(normalizedResponse.createdAt).getTime() >
              new Date(group.latestResponse.createdAt).getTime())
        ) {
          group.latestResponse = normalizedResponse;
          group.status = normalizedResponse.status;
          group.attending = response.attending;
          group.companionsCount = normalizedResponse.companionsCount;
          group.confirmedAt = normalizedResponse.createdAt;
        }

        return normalizedResponse;
      })
      .filter(Boolean)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );

    const groups = [...groupsMap.values()]
      .map((group) => ({
        ...group,
        members: [...group.members].sort((left, right) =>
          left.localeCompare(right, "es", { sensitivity: "base" })
        ),
      }))
      .sort((left, right) => {
        const statusDiff = statusValue(left.status) - statusValue(right.status);

        if (statusDiff !== 0) {
          return statusDiff;
        }

        const sideDiff = formatSideLabel(left.side).localeCompare(
          formatSideLabel(right.side),
          "es",
          { sensitivity: "base" }
        );

        if (sideDiff !== 0) {
          return sideDiff;
        }

        return left.familyName.localeCompare(right.familyName, "es", {
          sensitivity: "base",
        });
      });

    return {
      groups,
      recentResponses,
    };
  }

  function applyFilters() {
    const search = normalizeText(state.filters.search);

    state.filteredGroups = state.groups.filter((group) => {
      const searchMatch =
        !search || normalizeText(group.searchIndex).includes(search);
      const sideMatch =
        state.filters.side === "all" || group.side === state.filters.side;
      const statusMatch =
        state.filters.status === "all" || group.status === state.filters.status;

      return searchMatch && sideMatch && statusMatch;
    });

    renderGroupList(state.filteredGroups);

    const selectedGroup = state.groups.find(
      (group) => group.key === state.selectedGroupKey
    );

    renderDetail(selectedGroup || null);
  }

  async function loadDashboard(options) {
    const settings = {
      silent: false,
      successMessage: "",
      ...options,
    };

    if (state.isLoadingDashboard) {
      return;
    }

    state.isLoadingDashboard = true;
    setButtonLoading(
      refs.refreshButton,
      true,
      "Actualizar",
      "Actualizando..."
    );

    if (!settings.silent) {
      setFeedback(
        refs.dashboardFeedback,
        "Consultando invitados y respuestas...",
        "loading"
      );
    }

    try {
      const [guestResult, responseResult] = await Promise.all([
        state.client
          .from("guests")
          .select(
            "id, side, group_name, full_name, max_companions, status, attending, companions_count, confirmed_at, created_at"
          )
          .order("side", { ascending: true })
          .order("group_name", { ascending: true })
          .order("full_name", { ascending: true }),
        state.client
          .from("rsvp_responses")
          .select(
            "id, guest_id, full_name, attending, companions_count, message, created_at"
          )
          .order("created_at", { ascending: false }),
      ]);

      if (guestResult.error) {
        throw guestResult.error;
      }

      if (responseResult.error) {
        throw responseResult.error;
      }

      const dashboardData = buildDashboardData(
        guestResult.data || [],
        responseResult.data || []
      );

      state.groups = dashboardData.groups;
      state.recentResponses = dashboardData.recentResponses;

      if (
        state.selectedGroupKey &&
        !state.groups.some((group) => group.key === state.selectedGroupKey)
      ) {
        state.selectedGroupKey = "";
      }

      renderSummary(state.groups);
      renderRecentResponses(state.recentResponses);
      applyFilters();
      refs.lastUpdated.textContent = `Actualizado ${formatDateTime(new Date())}`;

      if (settings.successMessage) {
        setFeedback(refs.dashboardFeedback, settings.successMessage, "success");
      } else if (!settings.silent) {
        setFeedback(
          refs.dashboardFeedback,
          "Panel actualizado correctamente.",
          "success"
        );
      }
    } catch (error) {
      const message =
        "No pudimos cargar el panel admin ahora mismo. Revisa tu sesion o vuelve a intentar.";
      setFeedback(refs.dashboardFeedback, message, "error");
    } finally {
      state.isLoadingDashboard = false;
      setButtonLoading(
        refs.refreshButton,
        false,
        "Actualizar",
        "Actualizando..."
      );
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    state.refreshTimer = window.setInterval(() => {
      if (document.hidden || refs.dashboardView.hidden) {
        return;
      }

      loadDashboard({ silent: true });
    }, AUTO_REFRESH_MS);
  }

  function stopAutoRefresh() {
    if (!state.refreshTimer) {
      return;
    }

    window.clearInterval(state.refreshTimer);
    state.refreshTimer = 0;
  }

  async function signOutAdmin() {
    stopAutoRefresh();
    await state.client.auth.signOut();
    showAuthView(
      "La sesion se cerro correctamente. Puedes volver a entrar cuando quieras.",
      "success"
    );
  }

  async function activateDashboard(user, successMessage) {
    if (!user || state.isAuthenticating) {
      return;
    }

    state.isAuthenticating = true;

    try {
      setFeedback(refs.authFeedback, "Verificando permisos...", "loading");

      const { data: isAdmin, error } = await state.client.rpc("is_rsvp_admin");

      if (error) {
        throw error;
      }

      if (!isAdmin) {
        await state.client.auth.signOut();
        showAuthView(
          "Esta cuenta no tiene permiso para ver el panel privado de RSVP.",
          "error"
        );
        return;
      }

      state.currentUserId = user.id;
      refs.adminEmail.textContent = cleanText(user.email || "Cuenta autenticada");
      showDashboardView();
      await loadDashboard({
        silent: false,
        successMessage:
          successMessage || "Acceso concedido. Ya puedes revisar las confirmaciones.",
      });
      startAutoRefresh();
    } catch (error) {
      showAuthView(
        "No pudimos validar esta cuenta como administradora. Intenta de nuevo.",
        "error"
      );
    } finally {
      state.isAuthenticating = false;
      setButtonLoading(
        refs.loginSubmit,
        false,
        "Entrar al panel",
        "Entrando..."
      );
    }
  }

  async function bootstrapSession() {
    setFeedback(refs.authFeedback, "Verificando acceso al panel...", "loading");

    try {
      const {
        data: { user },
        error,
      } = await state.client.auth.getUser();

      if (error) {
        throw error;
      }

      if (!user) {
        showAuthView(
          "Inicia sesion con tu usuario de Supabase para abrir el panel admin.",
          "info"
        );
        return;
      }

      await activateDashboard(user, "Sesion restaurada. Panel actualizado.");
    } catch (error) {
      showAuthView(
        "No pudimos restaurar la sesion. Inicia sesion otra vez para continuar.",
        "error"
      );
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    if (state.isAuthenticating) {
      return;
    }

    const formData = new FormData(refs.loginForm);
    const email = cleanText(formData.get("email"));
    const password = String(formData.get("password") || "").trim();

    if (!email || !password) {
      setFeedback(
        refs.authFeedback,
        "Completa tu correo y tu contrasena para entrar al panel.",
        "error"
      );
      return;
    }

    setButtonLoading(refs.loginSubmit, true, "Entrar al panel", "Entrando...");
    setFeedback(refs.authFeedback, "Abriendo sesion segura...", "loading");

    try {
      const { data, error } = await state.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data?.user) {
        throw error || new Error("LOGIN_FAILED");
      }

      await activateDashboard(
        data.user,
        "Acceso concedido. El panel ya esta listo para revisar respuestas."
      );
    } catch (error) {
      setButtonLoading(refs.loginSubmit, false, "Entrar al panel", "Entrando...");
      setFeedback(
        refs.authFeedback,
        "No pudimos iniciar sesion. Revisa correo, contrasena o permisos de admin.",
        "error"
      );
    }
  }

  refs.loginForm.addEventListener("submit", handleLoginSubmit);
  refs.refreshButton.addEventListener("click", () => {
    loadDashboard({
      silent: false,
      successMessage: "Panel actualizado con la informacion mas reciente.",
    });
  });
  refs.signOutButton.addEventListener("click", signOutAdmin);

  refs.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value || "";
    applyFilters();
  });

  refs.sideFilters.forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.side = button.dataset.filterSide || "all";
      setActiveChip(refs.sideFilters, state.filters.side, "filterSide");
      applyFilters();
    });
  });

  refs.statusFilters.forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.status = button.dataset.filterStatus || "all";
      setActiveChip(refs.statusFilters, state.filters.status, "filterStatus");
      applyFilters();
    });
  });

  refs.groupList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-group-key]");

    if (!button) {
      return;
    }

    state.selectedGroupKey = button.dataset.groupKey || "";
    renderGroupList(state.filteredGroups);
    renderDetail(
      state.groups.find((group) => group.key === state.selectedGroupKey) || null
    );
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !refs.dashboardView.hidden) {
      loadDashboard({ silent: true });
    }
  });

  state.client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      showAuthView(
        "La sesion se cerro correctamente. Puedes volver a entrar cuando quieras.",
        "success"
      );
      return;
    }

    if (
      (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") &&
      session?.user &&
      session.user.id !== state.currentUserId &&
      !refs.dashboardView.hidden
    ) {
      activateDashboard(session.user, "");
    }
  });

  bootstrapSession();
})();
