const data = window.WEDDING_DATA;
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const queryAll = (selector) => document.querySelectorAll(selector);

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
      const amount =
        part.key === "seconds"
          ? Math.floor(remainder / part.size)
          : Math.floor(remainder / part.size);

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
      ".hero-glass, .hero-note, .panel, .gallery-panel, .story-visual, .location-stack, .detail-card, .gift-card, .closing, .gallery-card"
    ),
  ];
  const rootStyle = document.documentElement.style;
  let ticking = false;

  function update() {
    const scrollTop = window.scrollY;
    const viewportHeight = window.innerHeight;
    const maxScroll =
      document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const pageProgress = maxScroll > 0 ? scrollTop / maxScroll : 0;

    parallaxItems.forEach((item) => {
      const factor = Number(item.dataset.parallax || 0.1);
      item.style.transform = `translate3d(0, ${scrollTop * factor}px, 0) scale(1.06)`;
    });

    rootStyle.setProperty("--orb-shift-a", `${pageProgress * 90}px`);
    rootStyle.setProperty("--orb-shift-b", `${pageProgress * -80}px`);
    rootStyle.setProperty("--topbar-shift", `${Math.sin(scrollTop * 0.01) * 2.5}px`);

    floatingItems.forEach((item, index) => {
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
      const shift = -clamped * 18 * factor;
      const tilt = direction * clamped * 2.6 * factor;
      const scale = visibility * (item.classList.contains("gallery-card") ? 0.028 : 0.012);

      if (item.classList.contains("gallery-card")) {
        item.style.setProperty("--card-shift", `${shift}px`);
        item.style.setProperty("--card-rotate", `${tilt}deg`);
        item.style.setProperty("--card-scale", `${1 + scale}`);
        item.style.setProperty("--image-shift", `${-shift * 0.7}px`);
        item.style.setProperty("--image-scale", `${1.08 + visibility * 0.04}`);
        return;
      }

      item.style.setProperty("--scroll-shift", `${shift * 0.42}px`);
      item.style.setProperty("--scroll-tilt", `${tilt * 0.22}deg`);
      item.style.setProperty("--scroll-scale", scale.toFixed(4));
      item.style.setProperty("--scroll-blur", `${(1 - visibility) * 1.8}px`);
    });

    ticking = false;
  }

  function requestUpdate() {
    if (ticking) {
      return;
    }

    ticking = true;
    window.requestAnimationFrame(update);
  }

  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
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

  galleryRoot.addEventListener("dblclick", (event) => {
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

  document.querySelector("[data-hero-image]").style.backgroundImage = `url("${data.visuals.variant01Hero}")`;
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
