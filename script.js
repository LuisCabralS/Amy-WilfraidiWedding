const data = window.WEDDING_DATA;
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;
const isMobileViewport = window.matchMedia(
  "(hover: none), (pointer: coarse)"
).matches;

const queryAll = (selector) => document.querySelectorAll(selector);
const RSVP_STATUS_LABELS = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  declined: "Declinada",
};

document.body.classList.toggle("is-mobile", isMobileViewport);

function fillText(selector, value) {
  queryAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function fillLink(selector, href, label) {
  queryAll(selector).forEach((node) => {
    node.href = href;
    if (label) {
      node.textContent = label;
    }
  });
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSideLabel(side) {
  if (side === "amy") {
    return "Invitacion de Amy";
  }

  if (side === "wilfraidi") {
    return "Invitacion de Wilfraidi";
  }

  return "Invitacion";
}

function formatGroupName(groupName) {
  return String(groupName || "")
    .split("·")[0]
    .trim();
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function initBackgroundAudio() {
  const audio = document.querySelector("[data-background-audio]");
  const source = data.music.backgroundAudioUrl;

  if (!audio || !source) {
    return;
  }

  audio.src = source;
  audio.volume = 0.9;

  const attemptPlayback = () => {
    const playPromise = audio.play();

    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          removeGestureFallback();
        })
        .catch(() => {
          addGestureFallback();
        });
    }
  };

  const gestureEvents = ["touchstart", "click", "keydown"];

  function removeGestureFallback() {
    gestureEvents.forEach((eventName) => {
      window.removeEventListener(eventName, attemptPlayback);
    });
  }

  function addGestureFallback() {
    gestureEvents.forEach((eventName) => {
      window.addEventListener(eventName, attemptPlayback, {
        once: true,
        passive: true,
      });
    });
  }

  attemptPlayback();
}

function createCountdownCard(label) {
  const card = document.createElement("div");
  card.className = "countdown-card";

  const value = document.createElement("span");
  value.className = "countdown-value";
  value.textContent = "00";

  const title = document.createElement("span");
  title.className = "countdown-label";
  title.textContent = label;

  card.append(value, title);

  return { card, value };
}

function initCountdown() {
  const countdownRoot = document.querySelector("[data-countdown]");
  const units = [
    { key: "days", label: "Dias", size: 86400000 },
    { key: "hours", label: "Horas", size: 3600000 },
    { key: "minutes", label: "Minutos", size: 60000 },
    { key: "seconds", label: "Segundos", size: 1000 },
  ];

  const countdownParts = units.map((unit) => {
    const part = createCountdownCard(unit.label);
    countdownRoot.append(part.card);
    return { ...unit, ...part };
  });

  const targetDate = new Date(data.event.isoDate);

  function render() {
    const now = new Date();
    const diff = Math.max(targetDate.getTime() - now.getTime(), 0);

    let remainder = diff;

    countdownParts.forEach((part) => {
      const amount = Math.floor(remainder / part.size);

      part.value.textContent = String(amount).padStart(2, "0");
      remainder %= part.size;
    });
  }

  render();
  window.setInterval(render, 1000);
}

function renderSchedule() {
  const scheduleRoot = document.querySelector("[data-schedule]");

  data.event.schedule.forEach((item) => {
    const wrapper = document.createElement("article");
    wrapper.className = "schedule-item";

    const time = document.createElement("span");
    time.className = "schedule-item-time";
    time.textContent = item.time;

    const title = document.createElement("strong");
    title.textContent = item.title;

    const description = document.createElement("p");
    description.textContent = item.description;

    wrapper.append(time, title, description);
    scheduleRoot.append(wrapper);
  });
}

function renderGallery() {
  const galleryRoot = document.querySelector("[data-gallery]");
  const spans = ["tall", "wide", "square", "square", "wide", "tall"];

  data.gallery.forEach((image, index) => {
    const figure = document.createElement("button");
    figure.type = "button";
    figure.className = "gallery-card";
    figure.dataset.span = spans[index % spans.length];
    figure.dataset.motionFactor = String(1 + (index % 4) * 0.22);
    figure.dataset.motionDirection = index % 2 === 0 ? "1" : "-1";
    figure.dataset.full = image.src;
    figure.dataset.alt = image.alt;
    figure.setAttribute("aria-label", `Ver imagen ${index + 1} en grande`);

    const photo = document.createElement("img");
    photo.src = image.src;
    photo.alt = image.alt;
    photo.loading = "lazy";

    const caption = document.createElement("figcaption");
    caption.textContent = "";

    figure.append(photo, caption);
    galleryRoot.append(figure);
  });
}

function renderGifts() {
  const giftsRoot = document.querySelector("[data-gifts-accounts]");

  data.gifts.accounts.forEach((item) => {
    const card = document.createElement("article");
    card.className = "gift-card";

    const bank = document.createElement("strong");
    bank.textContent = item.bank;

    const holder = document.createElement("p");
    holder.textContent = item.holder;

    const account = document.createElement("code");
    account.textContent = item.account;

    card.append(bank, holder, account);
    giftsRoot.append(card);
  });
}

function initReveal() {
  const revealItems = queryAll(".reveal");

  if (prefersReducedMotion) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        } else {
          entry.target.classList.remove("is-visible");
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function initMotionSystem() {
  if (prefersReducedMotion) {
    return;
  }

  const parallaxItems = [...queryAll("[data-parallax]")];
  const floatingItems = [
    ...queryAll(
      ".hero-glass, .hero-note, .panel, .story-visual, .location-stack, .detail-card, .gift-card, .closing, .gallery-card"
    ),
  ];
  const rootStyle = document.documentElement.style;
  const visibleFloatingItems = new Set();
  const frameGap = isMobileViewport ? 1000 / 32 : 1000 / 60;
  const visibilityObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleFloatingItems.add(entry.target);
        } else {
          visibleFloatingItems.delete(entry.target);
        }
      });
    },
    {
      threshold: 0,
      rootMargin: "24% 0px 24% 0px",
    }
  );
  let rafId = 0;
  let lastFrameTime = 0;

  floatingItems.forEach((item) => visibilityObserver.observe(item));

  function getActiveFloatingItems() {
    if (visibleFloatingItems.size) {
      return [...visibleFloatingItems];
    }

    return floatingItems.slice(0, isMobileViewport ? 6 : floatingItems.length);
  }

  function update(now = 0) {
    if (now - lastFrameTime < frameGap) {
      rafId = window.requestAnimationFrame(update);
      return;
    }

    lastFrameTime = now;

    const scrollTop = window.scrollY;
    const viewportHeight = window.innerHeight;
    const maxScroll =
      document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const pageProgress = maxScroll > 0 ? scrollTop / maxScroll : 0;
    const time = now * 0.001;
    const ambientWave = Math.sin(time * 0.9);
    const mobileBoost = isMobileViewport ? 1.28 : 1;
    const activeFloatingItems = getActiveFloatingItems();

    parallaxItems.forEach((item) => {
      const factor = Number(item.dataset.parallax || 0.1);
      const drift = Math.sin(time * 0.7 + factor * 12) * 10 * mobileBoost;
      const scale = 1.06 + Math.sin(time * 0.45) * 0.018 * mobileBoost;
      item.style.transform = `translate3d(0, ${
        scrollTop * factor + drift
      }px, 0) scale(${scale})`;
    });

    rootStyle.setProperty(
      "--orb-shift-a",
      `${pageProgress * 90 + Math.sin(time * 0.65) * 18 * mobileBoost}px`
    );
    rootStyle.setProperty(
      "--orb-shift-b",
      `${pageProgress * -80 + Math.cos(time * 0.6) * 14 * mobileBoost}px`
    );
    rootStyle.setProperty(
      "--topbar-shift",
      `${Math.sin(scrollTop * 0.01 + time * 0.9) * 3.2 * mobileBoost}px`
    );

    activeFloatingItems.forEach((item, index) => {
      const rect = item.getBoundingClientRect();
      const centerOffset =
        (rect.top + rect.height / 2 - viewportHeight / 2) / viewportHeight;
      const clamped = Math.max(-1, Math.min(1, centerOffset));
      const direction =
        Number(item.dataset.motionDirection || (index % 2 === 0 ? 1 : -1)) || 1;
      const factor =
        Number(
          item.dataset.motionFactor || (item.classList.contains("gallery-card") ? 1.18 : 0.58)
        ) || 1;
      const visibility = Math.max(0, 1 - Math.abs(clamped) * 0.92);
      const wave = Math.sin(time * (1 + index * 0.04) + index * 0.75);
      const shift = (-clamped * 18 + wave * 8 * mobileBoost) * factor;
      const tilt = direction * (clamped * 2.6 + wave * 0.8 * mobileBoost) * factor;
      const scale = visibility * (item.classList.contains("gallery-card") ? 0.028 : 0.012);

      if (item.classList.contains("gallery-card")) {
        item.style.setProperty("--card-shift", "0px");
        item.style.setProperty("--card-rotate", "0deg");
        item.style.setProperty("--card-scale", "1");
        item.style.setProperty("--image-shift", "0px");
        item.style.setProperty("--image-scale", "1");
        return;
      }

      item.style.setProperty("--scroll-shift", `${shift * 0.42}px`);
      item.style.setProperty("--scroll-tilt", `${tilt * 0.22}deg`);
      item.style.setProperty(
        "--scroll-scale",
        (scale + (wave + 1) * 0.0014 * mobileBoost).toFixed(4)
      );
      item.style.setProperty("--scroll-blur", `${(1 - visibility) * 1.8}px`);
    });

    rafId = window.requestAnimationFrame(update);
  }

  function handleVisibility() {
    if (document.hidden) {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      return;
    }

    if (!rafId) {
      lastFrameTime = 0;
      rafId = window.requestAnimationFrame(update);
    }
  }

  rafId = window.requestAnimationFrame(update);
  window.addEventListener("resize", handleVisibility);
  window.addEventListener("orientationchange", handleVisibility);
  document.addEventListener("visibilitychange", handleVisibility);
}

function initGalleryLightbox() {
  const galleryRoot = document.querySelector("[data-gallery]");
  const lightbox = document.querySelector(".lightbox");
  const lightboxImage = document.querySelector(".lightbox-image");
  const closeButton = document.querySelector(".lightbox-close");

  if (!galleryRoot || !lightbox || !lightboxImage || !closeButton) {
    return;
  }

  function openLightbox(src, alt) {
    lightboxImage.src = src;
    lightboxImage.alt = alt;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImage.src = "";
    lightboxImage.alt = "";
    document.body.style.overflow = "";
  }

  galleryRoot.addEventListener("click", (event) => {
    const card = event.target.closest(".gallery-card");

    if (!card) {
      return;
    }

    openLightbox(card.dataset.full, card.dataset.alt);
  });

  galleryRoot.addEventListener("keydown", (event) => {
    const card = event.target.closest(".gallery-card");

    if (!card) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openLightbox(card.dataset.full, card.dataset.alt);
    }
  });

  closeButton.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lightbox.hidden) {
      closeLightbox();
    }
  });
}

function createSupabaseClient() {
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
        "La confirmacion aun no esta configurada. Falta completar el archivo supabase-config.js con tu URL y tu anon key.",
    };
  }

  return {
    client: window.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          "x-client-info": "amy-wilfraidi-rsvp",
        },
      },
    }),
    errorMessage: "",
  };
}

function initRsvp() {
  const modal = document.querySelector("[data-rsvp-modal]");
  const openButtons = queryAll("[data-open-rsvp]");
  const closeButtons = queryAll("[data-rsvp-close]");
  const resetSearchButton = document.querySelector("[data-rsvp-reset-search]");
  const searchInput = document.querySelector("[data-rsvp-query]");
  const feedback = document.querySelector("[data-rsvp-feedback]");
  const resultsRoot = document.querySelector("[data-rsvp-results]");
  const selectionRoot = document.querySelector("[data-rsvp-selection]");
  const selectedName = document.querySelector("[data-rsvp-selected-name]");
  const selectedMeta = document.querySelector("[data-rsvp-selected-meta]");
  const invitationCopy = document.querySelector("[data-rsvp-invitation-copy]");
  const membersRoot = document.querySelector("[data-rsvp-members]");
  const existingState = document.querySelector("[data-rsvp-existing-state]");
  const statusChip = document.querySelector("[data-rsvp-status-chip]");
  const form = document.querySelector("[data-rsvp-form]");
  const attendingOptions = queryAll("[data-rsvp-attending]");
  const countWrap = document.querySelector("[data-rsvp-count-wrap]");
  const countSelect = document.querySelector("[data-rsvp-count]");
  const countHelp = document.querySelector("[data-rsvp-count-help]");
  const messageInput = document.querySelector("[data-rsvp-message]");
  const submitButton = document.querySelector("[data-rsvp-submit]");
  const successBox = document.querySelector("[data-rsvp-success]");
  const successCopy = document.querySelector("[data-rsvp-success-copy]");

  if (
    !modal ||
    !openButtons.length ||
    !resetSearchButton ||
    !searchInput ||
    !feedback ||
    !resultsRoot ||
    !selectionRoot ||
    !selectedName ||
    !selectedMeta ||
    !invitationCopy ||
    !membersRoot ||
    !existingState ||
    !statusChip ||
    !form ||
    !countWrap ||
    !countSelect ||
    !countHelp ||
    !messageInput ||
    !submitButton ||
    !successBox ||
    !successCopy
  ) {
    return;
  }

  const supabaseState = createSupabaseClient();
  const state = {
    client: supabaseState.client,
    configError: supabaseState.errorMessage,
    searchTimer: 0,
    searchToken: 0,
    results: [],
    selectedId: "",
    invitation: null,
    closeTimer: 0,
    isSaving: false,
  };

  function setFeedback(message, tone = "info") {
    feedback.textContent = message || "";
    feedback.dataset.tone = tone;
  }

  function resetSuccessState() {
    successBox.hidden = true;
    successCopy.textContent = "";
  }

  function setSelectionMode(isSelectionMode) {
    modal.classList.toggle("is-selection-mode", isSelectionMode);
  }

  function clearResults() {
    resultsRoot.innerHTML = "";
  }

  function clearSelection() {
    state.selectedId = "";
    state.invitation = null;
    selectionRoot.hidden = true;
    setSelectionMode(false);
    existingState.hidden = true;
    existingState.textContent = "";
    membersRoot.innerHTML = "";
    resetSuccessState();
    form.reset();
  }

  function openModal() {
    clearTimeout(state.closeTimer);
    modal.hidden = false;
    requestAnimationFrame(() => {
      modal.classList.add("is-open");
    });
    document.body.style.overflow = "hidden";
    searchInput.focus({ preventScroll: true });
    clearSelection();
    clearResults();
    searchInput.value = "";

    if (state.client) {
      setFeedback(
        "Escribe al menos dos letras de tu nombre o apellido para buscar tu invitacion.",
        "info"
      );
    } else {
      setFeedback(state.configError, "error");
    }
  }

  function closeModal() {
    modal.classList.remove("is-open");
    state.closeTimer = window.setTimeout(() => {
      modal.hidden = true;
    }, 220);
    document.body.style.overflow = "";
  }

  function renderStatusChip(status, attending) {
    const resolvedStatus =
      status || (attending === true ? "confirmed" : attending === false ? "declined" : "pending");

    statusChip.dataset.status = resolvedStatus;
    statusChip.textContent = RSVP_STATUS_LABELS[resolvedStatus] || RSVP_STATUS_LABELS.pending;
  }

  function renderResults(items) {
    clearResults();

    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rsvp-result";
      button.dataset.guestId = item.id;

      if (item.id === state.selectedId) {
        button.classList.add("is-selected");
      }

      const head = document.createElement("div");
      head.className = "rsvp-result-head";

      const textWrap = document.createElement("div");
      const name = document.createElement("p");
      name.className = "rsvp-result-name";
      name.textContent = item.full_name;

      const meta = document.createElement("p");
      meta.className = "rsvp-result-meta";
      meta.textContent = `${formatSideLabel(item.side)} · ${formatGroupName(item.group_name)}`;

      textWrap.append(name, meta);

      const chip = document.createElement("span");
      chip.className = "rsvp-status-chip";
      const resolvedStatus =
        item.status ||
        (item.attending === true ? "confirmed" : item.attending === false ? "declined" : "pending");
      chip.dataset.status = resolvedStatus;
      chip.textContent = RSVP_STATUS_LABELS[resolvedStatus] || RSVP_STATUS_LABELS.pending;

      head.append(textWrap, chip);
      button.append(head);
      resultsRoot.append(button);
    });
  }

  async function searchGuests(rawValue) {
    const normalizedQuery = normalizeName(rawValue);
    state.searchToken += 1;
    const currentToken = state.searchToken;
    clearSelection();

    if (!state.client) {
      clearResults();
      setFeedback(state.configError, "error");
      return;
    }

    if (normalizedQuery.length < 2) {
      clearResults();
      setFeedback(
        "Escribe al menos dos letras de tu nombre o apellido para comenzar la busqueda.",
        "info"
      );
      return;
    }

    setFeedback("Buscando tu invitacion...", "loading");

    const { data: matches, error } = await state.client.rpc("search_guest_matches", {
      search_term: normalizedQuery,
    });

    if (currentToken !== state.searchToken) {
      return;
    }

    if (error) {
      clearResults();
      setFeedback(
        "No pudimos consultar el listado ahora mismo. Intenta de nuevo en unos segundos.",
        "error"
      );
      return;
    }

    state.results = matches || [];

    if (!state.results.length) {
      clearResults();
      setFeedback(
        "No encontramos coincidencias exactas. Prueba con otro apellido o con menos palabras.",
        "info"
      );
      return;
    }

    renderResults(state.results);
    setFeedback("Selecciona tu nombre o tu grupo para continuar.", "success");
  }

  function setInvitationFormEnabled(enabled) {
    [...form.elements].forEach((field) => {
      field.disabled = !enabled;
    });
    submitButton.disabled = !enabled || state.isSaving;
  }

  function updateCountVisibility() {
    if (!state.invitation) {
      countWrap.hidden = true;
      return;
    }

    const attendingChoice = form.querySelector('input[name="attending"]:checked');
    const isAttending = attendingChoice && attendingChoice.value === "yes";
    const maxSeats = Number(state.invitation.max_companions || 1);

    countWrap.hidden = !isAttending || maxSeats <= 1;
    countHelp.textContent = `Tu invitacion permite confirmar hasta ${maxSeats} persona(s).`;

    if (!isAttending) {
      countSelect.value = "0";
    } else if (maxSeats === 1) {
      countSelect.value = "1";
    } else if (!countSelect.value) {
      countSelect.value = String(Math.min(state.invitation.group_members.length || 1, maxSeats));
    }
  }

  function renderInvitation(invitation) {
    state.invitation = invitation;
    selectionRoot.hidden = false;
    setSelectionMode(true);
    selectedName.textContent = invitation.selected_name;
    selectedMeta.textContent = `${formatSideLabel(invitation.side)} · ${formatGroupName(
      invitation.group_name
    )}`;
    invitationCopy.textContent = `Esta invitacion permite confirmar hasta ${invitation.max_companions} persona(s).`;

    membersRoot.innerHTML = "";
    invitation.group_members.forEach((member) => {
      const item = document.createElement("li");
      item.textContent = member;
      membersRoot.append(item);
    });

    renderStatusChip(invitation.status, invitation.attending);
    resetSuccessState();

    if (invitation.status && invitation.status !== "pending") {
      existingState.hidden = false;
      existingState.textContent =
        invitation.attending === true
          ? `Ya registramos esta invitacion como confirmada el ${formatDateTime(
              invitation.confirmed_at
            )}. Cantidad confirmada: ${invitation.companions_count} persona(s).`
          : `Ya registramos que esta invitacion no podra acompanarnos. Fecha de respuesta: ${formatDateTime(
              invitation.confirmed_at
            )}.`;
      setInvitationFormEnabled(false);
      updateCountVisibility();
      return;
    }

    existingState.hidden = true;
    existingState.textContent = "";
    form.reset();

    const defaultCount = Math.min(
      invitation.group_members.length || 1,
      Number(invitation.max_companions || 1)
    );

    countSelect.innerHTML = "";
    for (let value = 1; value <= Number(invitation.max_companions || 1); value += 1) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = `${value} persona(s)`;
      countSelect.append(option);
    }

    const yesOption = form.querySelector('input[name="attending"][value="yes"]');
    if (yesOption) {
      yesOption.checked = true;
    }

    countSelect.value = String(defaultCount || 1);
    setInvitationFormEnabled(true);
    updateCountVisibility();
  }

  async function fetchInvitation(guestId) {
    if (!state.client) {
      return;
    }

    state.selectedId = guestId;
    renderResults(state.results);
    setFeedback("Cargando detalles de tu invitacion...", "loading");

    const { data: responseRows, error } = await state.client.rpc("get_guest_invitation", {
      p_guest_id: guestId,
    });

    if (error || !responseRows || !responseRows.length) {
      clearSelection();
      setFeedback(
        "No pudimos leer los detalles de esa invitacion. Vuelve a intentarlo.",
        "error"
      );
      return;
    }

    const invitation = responseRows[0];

    renderInvitation({
      ...invitation,
      group_members: invitation.group_members || [],
    });

    if (invitation.status === "pending") {
      setFeedback(
        "Revisa tu invitacion y registra tu respuesta cuando quieras.",
        "success"
      );
    } else {
      setFeedback(
        "Esta invitacion ya tiene una respuesta registrada y no se volvera a duplicar.",
        "info"
      );
    }
  }

  async function submitRsvp(event) {
    event.preventDefault();

    if (!state.client || !state.invitation || state.isSaving) {
      return;
    }

    const attendingChoice = form.querySelector('input[name="attending"]:checked');

    if (!attendingChoice) {
      setFeedback("Elige si asistiras o no antes de guardar tu respuesta.", "error");
      return;
    }

    const attending = attendingChoice.value === "yes";
    const maxSeats = Number(state.invitation.max_companions || 1);
    const companionsCount = attending
      ? Math.max(1, Math.min(Number(countSelect.value || 1), maxSeats))
      : 0;
    const message = messageInput.value.trim();

    state.isSaving = true;
    submitButton.disabled = true;
    submitButton.textContent = "Guardando...";
    setFeedback("Guardando tu confirmacion...", "loading");

    const { data: result, error } = await state.client.rpc("submit_rsvp", {
      p_guest_id: state.invitation.guest_id,
      p_attending: attending,
      p_companions_count: companionsCount,
      p_message: message,
    });

    state.isSaving = false;
    submitButton.disabled = false;
    submitButton.textContent = "Guardar confirmacion";

    if (error) {
      setFeedback(
        "No pudimos guardar tu respuesta. Intenta de nuevo en unos segundos.",
        "error"
      );
      return;
    }

    if (!result || result.ok === false) {
      setFeedback(
        result?.message ||
          "No pudimos completar la confirmacion porque la invitacion ya fue procesada.",
        result?.code === "ALREADY_CONFIRMED" ? "info" : "error"
      );

      if (result?.code === "ALREADY_CONFIRMED") {
        await fetchInvitation(state.invitation.guest_id);
      }
      return;
    }

    state.results = state.results.map((item) =>
      item.id === state.invitation.guest_id
        ? {
            ...item,
            status: result.status,
            attending: result.attending,
            companions_count: result.companions_count,
            confirmed_at: result.confirmed_at,
          }
        : item
    );

    renderResults(state.results);
    renderInvitation({
      ...state.invitation,
      status: result.status,
      attending: result.attending,
      companions_count: result.companions_count,
      confirmed_at: result.confirmed_at,
    });

    successBox.hidden = false;
    successCopy.textContent = result.message;
    setFeedback("Tu respuesta fue guardada correctamente.", "success");
  }

  openButtons.forEach((button) => button.addEventListener("click", openModal));
  closeButtons.forEach((button) => button.addEventListener("click", closeModal));
  resetSearchButton.addEventListener("click", () => {
    clearSelection();
    setFeedback(
      "Escribe de nuevo el nombre y apellido para buscar otra invitacion.",
      "info"
    );
    searchInput.focus({ preventScroll: true });
  });

  searchInput.addEventListener("input", () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => {
      searchGuests(searchInput.value);
    }, 260);
  });

  resultsRoot.addEventListener("click", (event) => {
    const target = event.target.closest(".rsvp-result");

    if (!target) {
      return;
    }

    fetchInvitation(target.dataset.guestId);
  });

  attendingOptions.forEach((option) => {
    option.addEventListener("change", updateCountVisibility);
  });

  form.addEventListener("submit", submitRsvp);

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });
}

function populateContent() {
  document.title = `${data.couple.namesShort} | Glass Romance`;

  fillText("[data-hero-eyebrow]", data.hero.eyebrow);
  fillText("[data-couple-names]", data.couple.namesShort);
  fillText("[data-hero-quote]", data.hero.welcome);
  fillText("[data-hero-intro]", data.hero.intro);
  fillText("[data-hero-date]", data.hero.dateLong);
  fillText("[data-event-mode]", data.event.mode);
  fillText("[data-event-time]", data.event.timeLabel);
  fillText("[data-event-venue]", data.event.venue);
  fillText("[data-event-note]", data.event.note);
  fillText("[data-story-title]", data.story.title);
  fillText("[data-story-body]", data.story.body);
  fillText("[data-location-title]", data.location.title);
  fillText("[data-location-body]", data.location.body);
  fillText("[data-dress-code]", data.event.dressCode);
  fillText("[data-gifts-title]", data.gifts.title);
  fillText("[data-gifts-intro]", data.gifts.intro);
  fillText("[data-closing-title]", data.closing.title);
  fillText("[data-closing-body]", data.closing.body);
  fillText("[data-closing-signoff]", data.closing.signoff);

  document.querySelector(
    "[data-hero-image]"
  ).style.backgroundImage = `url("${data.visuals.variant01Hero}")`;
  document.querySelector("[data-story-image]").src = data.visuals.variant01Story;

  fillLink("[data-maps-button]", data.event.mapsUrl);
  fillLink("[data-save-date-button]", data.music.saveTheDateFile);
}

populateContent();
renderSchedule();
renderGallery();
renderGifts();
initCountdown();
initReveal();
initMotionSystem();
initBackgroundAudio();
initGalleryLightbox();
initRsvp();
