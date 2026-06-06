const formatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const animateStat = (node) => {
  const target = Number(node.dataset.count);
  const duration = 1100;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);

    node.textContent = target === 0 ? "0%" : formatter.format(value);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
};

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.target.dataset.animated) return;
      entry.target.dataset.animated = "true";
      animateStat(entry.target);
    });
  },
  { threshold: 0.6 }
);

document.querySelectorAll(".stat").forEach((stat) => observer.observe(stat));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  },
  { rootMargin: "0px 0px -10% 0px", threshold: 0.16 }
);

document.querySelectorAll(".gallery__item").forEach((item, index) => {
  item.style.transitionDelay = `${Math.min(index * 55, 440)}ms`;
  revealObserver.observe(item);
});

document
  .querySelectorAll(
    ".section__intro, .card, .steps li, .vault__panel, .scroll-band"
  )
  .forEach((el, index) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${Math.min((index % 4) * 90, 270)}ms`;
    revealObserver.observe(el);
  });

/* =====================================================================
 *  $BABYDOGEUS LIVE TRACKER
 *  When you get the contract address, paste it into TOKEN_ADDRESS below.
 *  Everything else (chart, copy button, live price) activates automatically.
 * ===================================================================== */
const TOKEN_ADDRESS = ""; // <-- PASTE THE $BABYDOGEUS CONTRACT ADDRESS HERE
const TOKEN_CHAIN = "ethereum"; // change if you launch on another chain
const REFRESH_MS = 30000;

const isValidCa = (a) => /^0x[a-fA-F0-9]{40}$/.test(a);

const fmtPrice = (n) => {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1)
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  // keep ~4 significant digits for sub-dollar meme prices
  return `$${n.toPrecision(4).replace(/\.?0+$/, "")}`;
};

const fmtCompactUsd = (n) => {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `$${new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n)}`;
};

const fmtChange = (n) => {
  if (!Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
};

const setText = (selector, value) => {
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = value;
  });
};

const setChange = (value, isDown) => {
  document.querySelectorAll(".js-change").forEach((el) => {
    el.textContent = value;
    el.classList.toggle("is-down", isDown);
  });
};

const setupContract = () => {
  const valueEl = document.getElementById("contract-address");
  const copyBtn = document.getElementById("copy-contract");
  if (!valueEl || !copyBtn) return;

  if (!isValidCa(TOKEN_ADDRESS)) {
    valueEl.textContent = valueEl.dataset.empty || "Coming soon";
    copyBtn.disabled = true;
    return;
  }

  valueEl.textContent = TOKEN_ADDRESS;
  copyBtn.disabled = false;

  const label = copyBtn.querySelector(".contract__copy-label");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(TOKEN_ADDRESS);
    } catch (err) {
      const range = document.createRange();
      range.selectNodeContents(valueEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("copy");
      sel.removeAllRanges();
    }
    copyBtn.classList.add("is-copied");
    if (label) label.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.classList.remove("is-copied");
      if (label) label.textContent = "Copy";
    }, 1600);
  });
};

const pickBestPair = (pairs) => {
  if (!Array.isArray(pairs) || !pairs.length) return null;
  const onChain = pairs.filter(
    (p) => !TOKEN_CHAIN || p.chainId === TOKEN_CHAIN
  );
  const pool = onChain.length ? onChain : pairs;
  return pool.sort(
    (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
  )[0];
};

const setupChartEmbed = (pair) => {
  const iframe = document.getElementById("dex-embed");
  const placeholder = document.getElementById("chart-placeholder");
  const link = document.getElementById("dexscreener-link");
  if (!iframe || !pair?.pairAddress) return;

  const src = `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}?embed=1&theme=dark&trades=0&info=0`;
  if (iframe.src !== src) iframe.src = src;
  iframe.hidden = false;
  if (placeholder) placeholder.style.display = "none";
  if (link && pair.url) link.href = pair.url;
};

const refreshPrice = async () => {
  if (!isValidCa(TOKEN_ADDRESS)) return;
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`
    );
    if (!res.ok) return;
    const data = await res.json();
    const pair = pickBestPair(data.pairs);
    if (!pair) return;

    const price = Number(pair.priceUsd);
    const change = Number(pair.priceChange?.h24);
    setText(".js-price", fmtPrice(price));
    setChange(fmtChange(change), Number.isFinite(change) && change < 0);
    setText(".js-mcap", fmtCompactUsd(Number(pair.marketCap ?? pair.fdv)));
    setText(".js-liq", fmtCompactUsd(Number(pair.liquidity?.usd)));

    setupChartEmbed(pair);
  } catch (err) {
    /* network hiccup — keep last known values */
  }
};

// Holder count isn't in the DexScreener feed. Ethplorer (free "freekey")
// serves it for Ethereum ERC-20s. For other chains, see the note below.
const refreshHolders = async () => {
  if (!isValidCa(TOKEN_ADDRESS)) return;
  try {
    let holders = NaN;

    if (TOKEN_CHAIN === "ethereum") {
      const res = await fetch(
        `https://api.ethplorer.io/getTokenInfo/${TOKEN_ADDRESS}?apiKey=freekey`
      );
      if (res.ok) {
        const data = await res.json();
        holders = Number(data.holdersCount);
      }
    }
    // To support another chain, plug its holders endpoint here, e.g.
    //   if (TOKEN_CHAIN === "base") { ...fetch + set `holders`... }

    if (Number.isFinite(holders) && holders > 0) {
      setText(".js-holders", holders.toLocaleString("en-US"));
    }
  } catch (err) {
    /* network hiccup — keep last known value */
  }
};

setupContract();
if (isValidCa(TOKEN_ADDRESS)) {
  refreshPrice();
  refreshHolders();
  setInterval(refreshPrice, REFRESH_MS);
  setInterval(refreshHolders, REFRESH_MS * 2); // holders move slower; poll gently
}

const hero = document.querySelector(".hero");
const coin = document.querySelector(".hero__backdrop");

if (
  hero &&
  coin &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    coin.style.translate = `${x * 26}px ${y * 26}px`;
  });

  hero.addEventListener("pointerleave", () => {
    coin.style.translate = "0px 0px";
  });
}
