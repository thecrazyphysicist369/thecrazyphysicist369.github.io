(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const reveals = document.querySelectorAll(".reveal");
  if (reduceMotion) {
    reveals.forEach((el) => el.classList.add("visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    reveals.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 6) * 70}ms`;
      observer.observe(el);
    });
  }

  initBookDeck();
})();

async function initBookDeck() {
  const widget = document.getElementById("books-widget");
  const fallback = document.getElementById("books-fallback");
  const deckEl = document.getElementById("book-deck");
  if (!widget || !deckEl || !fallback) return;

  let data;
  try {
    const res = await fetch("./books.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    fallback.textContent = "Couldn’t load the bookshelf right now.";
    console.warn(err);
    return;
  }

  const currently = Array.isArray(data.currentlyReading) ? data.currentlyReading : [];
  const read = Array.isArray(data.read) ? data.read : [];
  const books = [
    ...currently.map((b) => ({ ...b, _status: "Currently reading" })),
    ...read.map((b) => ({ ...b, _status: "Read" })),
  ];

  if (!books.length) {
    fallback.textContent = "No books found yet.";
    return;
  }

  fallback.hidden = true;
  widget.hidden = false;

  const updated = document.getElementById("books-updated");
  if (updated && data.updatedAt) {
    const d = new Date(data.updatedAt);
    updated.textContent = Number.isNaN(d.getTime())
      ? ""
      : `Synced ${d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`;
  }

  const titleEl = document.getElementById("book-title");
  const authorEl = document.getElementById("book-author");
  const ratingEl = document.getElementById("book-rating");
  const statusEl = document.getElementById("book-status");
  const linkEl = document.getElementById("book-link");
  const shelfLabel = document.getElementById("deck-shelf-label");
  const indexEl = document.getElementById("deck-index");
  const totalEl = document.getElementById("deck-total");
  const prevBtn = document.getElementById("deck-prev");
  const nextBtn = document.getElementById("deck-next");

  let index = 0;
  let animating = false;
  const STACK = 4;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  totalEl.textContent = String(books.length);

  function stars(n) {
    const rating = Math.max(0, Math.min(5, Number(n) || 0));
    if (!rating) return "";
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  function updateDetail(book) {
    statusEl.textContent = book._status;
    titleEl.textContent = book.title || "Untitled";
    authorEl.textContent = book.author ? `by ${book.author}` : "";
    ratingEl.textContent = stars(book.rating);
    linkEl.href = book.link || data.profile || "#";
    shelfLabel.textContent = book.shelf === "currently-reading" ? "Now reading" : "Read";
    indexEl.textContent = String(index + 1);
  }

  function stackStyle(depth) {
    const y = depth * 10;
    const x = depth * 6;
    const scale = 1 - depth * 0.045;
    const rot = depth * -2.5;
    return {
      transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`,
      opacity: String(1 - depth * 0.18),
      zIndex: String(40 - depth),
      filter: depth ? `brightness(${1 - depth * 0.08})` : "none",
    };
  }

  function renderStack({ enteringFrom } = {}) {
    deckEl.innerHTML = "";
    for (let depth = STACK - 1; depth >= 0; depth -= 1) {
      const book = books[(index + depth) % books.length];
      const card = document.createElement("article");
      card.className = "deck-card";
      card.setAttribute("role", "option");
      card.setAttribute("aria-selected", depth === 0 ? "true" : "false");
      card.dataset.depth = String(depth);

      if (book.cover) {
        const img = document.createElement("img");
        img.src = book.cover;
        img.alt = `${book.title || "Book"} cover`;
        img.loading = depth === 0 ? "eager" : "lazy";
        img.decoding = "async";
        img.referrerPolicy = "no-referrer";
        img.addEventListener("error", () => {
          img.remove();
          const fb = document.createElement("div");
          fb.className = "card-fallback";
          fb.textContent = book.title || "Book";
          card.appendChild(fb);
        });
        card.appendChild(img);
      } else {
        const fb = document.createElement("div");
        fb.className = "card-fallback";
        fb.textContent = book.title || "Book";
        card.appendChild(fb);
      }

      const style = stackStyle(depth);
      Object.assign(card.style, style);

      if (enteringFrom === "prev" && depth === 0 && !reduceMotion) {
        card.classList.add("is-enter");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => card.classList.remove("is-enter"));
        });
      }

      deckEl.appendChild(card);
    }
    updateDetail(books[index]);
  }

  function go(delta) {
    if (animating || books.length < 2) return;
    animating = true;
    const nextIndex = (index + delta + books.length) % books.length;

    if (reduceMotion) {
      index = nextIndex;
      renderStack();
      animating = false;
      return;
    }

    if (delta > 0) {
      const top = deckEl.querySelector('.deck-card[data-depth="0"]');
      if (top) top.classList.add("is-exit");
      window.setTimeout(() => {
        index = nextIndex;
        renderStack();
        animating = false;
      }, 420);
    } else {
      index = nextIndex;
      renderStack({ enteringFrom: "prev" });
      window.setTimeout(() => {
        animating = false;
      }, 450);
    }
  }

  renderStack();

  deckEl.addEventListener("click", () => go(1));
  nextBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    go(1);
  });
  prevBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    go(-1);
  });

  deckEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  });
}
