(() => {
  const uploadForm = document.getElementById("uploadForm");
  const fileInput = document.getElementById("file");
  const uploadResult = document.getElementById("uploadResult");

  const productsEl = document.getElementById("products");
  const brandEl = document.getElementById("brand");
  const colorEl = document.getElementById("color");
  const minPriceEl = document.getElementById("minPrice");
  const maxPriceEl = document.getElementById("maxPrice");
  const searchBtn = document.getElementById("searchBtn");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const pageInfo = document.getElementById("pageInfo");
  const pageButtons = document.getElementById("pageButtons");
  const activeFiltersEl = document.getElementById("activeFilters");
  const clearFiltersBtn = document.getElementById("clearFilters");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const clearUploadBtn = document.getElementById("clearUpload");

  let page = 1;
  const limit = 10;
  let currentMode = "browse"; // or 'search'
  let lastSearchParams = null;

  // reveal animation observer for product cards
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  // helper to show selected file
  const fileMeta = document.getElementById("fileMeta");
  const fileNameEl = document.getElementById("fileName");
  const uploadProgressEl = document.querySelector(".progress-bar");
  const uploadLoader = document.getElementById("uploadLoader");
  // track selected file explicitly to avoid browser quirks when assigning FileList
  let selectedFile = null;

  function showSelectedFile(f) {
    if (!f) {
      fileMeta.style.display = "none";
      return;
    }
    fileMeta.style.display = "flex";
    fileNameEl.textContent = `${f.name} (${Math.round(f.size / 1024)} KB)`;
    // show filled progress when file is loaded/selected so user knows file is ready
    if (uploadProgressEl) uploadProgressEl.style.width = "100%";
  }

  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    selectedFile = f || null;
    showSelectedFile(selectedFile);
  });

  uploadForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = fileInput.files[0];
    if (!selectedFile && !f) {
      uploadResult.innerHTML = '<div class="badge">Please choose a file</div>';
      uploadResult.classList.add("show");
      return;
    }

    // prefer selectedFile (set by drop or picker) to avoid relying on fileInput.files assignment
    const fileToUpload = selectedFile || f;

    // use XHR to get upload progress in browsers
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", fileToUpload);

    uploadResult.classList.remove("error", "success");
    uploadResult.innerHTML = `<div class="badge">Uploading...</div>`;
    uploadResult.classList.add("show");

    // show loader and reset progress to 0 at upload start
    if (uploadLoader) uploadLoader.style.display = "inline-block";
    if (uploadProgressEl) uploadProgressEl.style.width = "0%";

    xhr.upload.onprogress = function (evt) {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        if (uploadProgressEl) uploadProgressEl.style.width = pct + "%";
      }
    };

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (uploadLoader) uploadLoader.style.display = "none";
        try {
          const json = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) {
            uploadResult.classList.add("success");
            renderUploadResult(json);
            page = 1;
            loadProducts();
          } else {
            uploadResult.classList.add("error");
            uploadResult.innerHTML = `<div class="badge" style="background:#3b0b0b">Error ${
              xhr.status
            }</div><div style="margin-top:8px">${escapeHtml(
              xhr.responseText || "Upload failed"
            )}</div>`;
          }
        } catch (err) {
          uploadResult.classList.add("error");
          uploadResult.innerHTML = `<div class="badge" style="background:#3b0b0b">Error</div><div style="margin-top:8px">${escapeHtml(
            String(err)
          )}</div>`;
        }
      }
    };

    xhr.open("POST", "/api/upload", true);
    xhr.send(fd);
  });

  clearUploadBtn?.addEventListener("click", () => {
    uploadResult.innerHTML = "";
    fileInput.value = "";
    selectedFile = null;
    if (uploadProgressEl) uploadProgressEl.style.width = "0%";
    fileMeta.style.display = "none";
    uploadResult.classList.remove("show");
  });

  async function loadProducts() {
    // If in search mode, call the search endpoint with pagination params
    let res, json;
    if (currentMode === "search" && lastSearchParams) {
      const params = Object.assign({}, lastSearchParams);
      params.page = String(page);
      params.limit = String(limit);
      const q = new URLSearchParams(params);
      res = await fetch("/api/products/search?" + q.toString());
      json = await res.json();
    } else {
      const q = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      res = await fetch("/api/products?" + q.toString());
      json = await res.json();
    }
    const list = json.items || [];
    const total = json.total || 0;
    renderProducts(list);
    renderPaginationControls(page, limit, total);
    const start = total === 0 ? 0 : (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    pageInfo.textContent = `Showing ${start}–${end} of ${total} entries`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = end >= total;
  }

  function renderProducts(list) {
    productsEl.innerHTML = "";
    if (!list || list.length === 0) {
      productsEl.innerHTML = `<div class="empty">No products</div>`;
      return;
    }

    for (const p of list) {
      const div = document.createElement("div");
      div.className = "market-card";
      const title = escapeHtml(p.name || p.sku || "");
      const brand = escapeHtml(p.brand || "");
      const price = Number(p.price || 0);
      const mrp = Number(p.mrp || 0);
      const savings = mrp > price ? mrp - price : 0;
      const size = escapeHtml(p.size || "");
      const colorVal = escapeHtml(p.color || "");

      // try parsing the color value (accepts hex, named colors, rgb())
      const parsed = parseCssColorToRgb(p.color);
      if (parsed) {
        // stronger top tint and subtle bottom tint for visible gradient
        const top = rgbToRgba(parsed, 0.14);
        const bottom = rgbToRgba(parsed, 0.04);
        div.style.background = `linear-gradient(180deg, ${top}, ${bottom})`;
        div.style.border = `1px solid ${rgbToRgba(parsed, 0.18)}`;
      } else {
        // fallback to a darker->lighter HSL tint for more contrast
        const hue = stringToHue(p.color || p.brand || p.name || p.sku || "");
        const bgTop = `hsl(${hue} 60% 92%)`;
        const bgBottom = `hsl(${hue} 60% 98%)`;
        div.style.background = `linear-gradient(180deg, ${bgTop}, ${bgBottom})`;
        div.style.border = "1px solid rgba(10,12,20,0.06)";
      }

      div.innerHTML = `
        <div class="market-image"> 
          <div class="market-thumb">${thumbnailHtml(p)}</div>
        </div>
        <div class="market-body">
          <div class="market-title">${title}</div>
          <div class="market-brand">${brand}</div>
          <div class="market-meta">${
            colorVal
              ? `<span class="chip color-chip">Color: ${colorVal}</span>`
              : ""
          }${size ? `<span class="chip">Size: ${size}</span>` : ""}</div>
          <div class="market-rating">⭐ 4.2</div>
          <div class="market-price">
            <span class="price-label">Price: <span class="now">₹${price}</span></span>
            <span class="mrp-label">MRP: <span class="mrp">₹${mrp}</span></span>
            ${savings ? `<span class="savings">Save ₹${savings}</span>` : ""}
          </div>
        </div>
      `;
      productsEl.appendChild(div);
      // animate in when scrolled into view
      revealObserver.observe(div);
    }
  }

  function thumbnailHtml(p) {
    const initials = thumbnailInitials(p.name || p.sku || "");
    if (typeof initials === "string" && initials.length <= 2) {
      return `<svg class="thumb-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 3h6a2 2 0 0 1 2 2z" stroke="#07203a" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 3v4" stroke="#07203a" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    return `<div class="thumb-text">${escapeHtml(initials)}</div>`;
  }

  // simple deterministic string -> hue (0-360)
  function stringToHue(s) {
    let h = 0;
    for (let i = 0; i < (s || "").length; i++)
      h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }

  // try to parse a CSS color string to {r,g,b} using the browser
  function parseCssColorToRgb(input) {
    if (!input) return null;
    const el = document.createElement("div");
    el.style.color = "";
    el.style.color = input;
    document.body.appendChild(el);
    const cs = getComputedStyle(el).color;
    document.body.removeChild(el);
    // cs should be like 'rgb(r, g, b)' or 'rgba(r, g, b, a)'
    const m = cs.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }

  function rgbToRgba({ r, g, b }, a = 0.06) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function escapeHtml(s) {
    if (!s) return "";
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c])
    );
  }

  searchBtn.addEventListener("click", async () => {
    const params = {};
    const b = brandEl.value && brandEl.value.trim();
    const c = colorEl.value && colorEl.value.trim();
    const min = minPriceEl.value && minPriceEl.value.trim();
    const max = maxPriceEl.value && maxPriceEl.value.trim();
    if (b) params.brand = b;
    if (c) params.color = c;
    if (min) params.minPrice = min;
    if (max) params.maxPrice = max;
    const q = new URLSearchParams(params);
    // set search mode and reset to first page
    currentMode = "search";
    lastSearchParams = params;
    page = 1;
    renderActiveFilters(params);
    await loadProducts();
  });

  clearFiltersBtn?.addEventListener("click", () => {
    brandEl.value = "";
    colorEl.value = "";
    minPriceEl.value = "";
    maxPriceEl.value = "";
    lastSearchParams = null;
    currentMode = "browse";
    activeFiltersEl.innerHTML = "";
    page = 1;
    loadProducts();
  });

  clearAllBtn?.addEventListener("click", async () => {
    if (!confirm("Delete ALL products? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/products", { method: "DELETE" });
      const json = await res.json();
      uploadResult.innerHTML = `<div class="badge">Deleted: ${
        json.deleted || 0
      }</div>`;
      // refresh list
      page = 1;
      loadProducts();
    } catch (err) {
      uploadResult.innerHTML = `<div class="badge" style="background:#3b0b0b">Error</div><div style="margin-top:8px">${escapeHtml(
        String(err)
      )}</div>`;
    }
  });

  prevBtn.addEventListener("click", () => {
    if (page <= 1) return;
    page--;
    loadProducts();
  });

  nextBtn.addEventListener("click", () => {
    page++;
    loadProducts();
  });

  function thumbnailInitials(text) {
    const parts = String(text).trim().split(/\s+/);
    if (parts.length === 1) {
      const w = parts[0] || "";
      // treat 1- or 2-letter words as neutral (avoid CC, ES short forms)
      if (w.length <= 2) return "◻";
      return w.slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // make the centered placeholder open the file picker when clicked
  const placeholder = document.querySelector(".drop-placeholder");
  if (placeholder) {
    placeholder.addEventListener("click", (ev) => {
      ev.stopPropagation();
      fileInput.click();
    });
  }

  // make the whole upload form clickable (except the action buttons)
  if (uploadForm) {
    uploadForm.addEventListener("click", (e) => {
      // if click is on a button or inside .file-actions, don't open picker
      if (e.target.closest && e.target.closest(".file-actions")) return;
      if (e.target.tagName === "BUTTON") return;
      // only open picker when click is on the form background or the placeholder
      if (
        e.target === uploadForm ||
        e.target.classList.contains("drop-placeholder")
      ) {
        fileInput.click();
      }
    });
  }

  function renderActiveFilters(params) {
    activeFiltersEl.innerHTML = "";
    const chips = [];
    for (const k of ["brand", "color", "minPrice", "maxPrice"]) {
      if (params[k]) {
        const c = document.createElement("span");
        c.className = "chip";
        c.textContent = `${k}: ${params[k]}`;
        chips.push(c);
      }
    }
    if (chips.length === 0) return;
    for (const ch of chips) activeFiltersEl.appendChild(ch);
  }

  function renderPaginationControls(currentPage, limit, total) {
    pageButtons.innerHTML = "";
    const totalPages = Math.max(1, Math.ceil(total / limit));
    // Build a set of page indices to show: first two, prev/current/next, last two
    const toShow = new Set();
    toShow.add(1);
    if (totalPages >= 2) toShow.add(2);
    // prev, current, next
    if (currentPage - 1 >= 1) toShow.add(currentPage - 1);
    toShow.add(currentPage);
    if (currentPage + 1 <= totalPages) toShow.add(currentPage + 1);
    if (totalPages - 1 >= 1) toShow.add(totalPages - 1);
    if (totalPages >= 1) toShow.add(totalPages);

    // convert to sorted array
    const pages = Array.from(toShow)
      .filter((i) => i >= 1 && i <= totalPages)
      .sort((a, b) => a - b);

    // helper to add ellipses between non-consecutive pages
    function addEllipsis() {
      const ell = document.createElement("span");
      ell.textContent = "...";
      ell.style.padding = "0 8px";
      pageButtons.appendChild(ell);
    }

    function addRangeBtn(i, isActive = false) {
      const b = document.createElement("button");
      b.className = "btn";
      const start = (i - 1) * limit + 1;
      const end = Math.min(i * limit, total);
      b.textContent = `${start}–${end}`; // en-dash
      if (isActive) {
        b.disabled = true;
        b.classList.add("active");
      }
      b.addEventListener("click", () => {
        page = i;
        loadProducts();
      });
      pageButtons.appendChild(b);
    }

    let last = 0;
    for (const pIndex of pages) {
      if (last && pIndex > last + 1) addEllipsis();
      addRangeBtn(pIndex, pIndex === currentPage);
      last = pIndex;
    }
  }

  function renderUploadResult(json) {
    if (!json) {
      uploadResult.innerHTML = "";
      uploadResult.classList.remove("show");
      return;
    }
    const { stored, failed } = json;
    let html = `<div><span class="badge">Stored: ${stored}</span>`;
    if (failed && failed.length) {
      html += `<span class="badge" style="background:#2b0b0b">Failed: ${failed.length}</span>`;
      html += `</div><table><thead><tr><th>Row</th><th>Errors</th><th>Raw</th></tr></thead><tbody>`;
      for (const f of failed.slice(0, 20)) {
        html += `<tr class="failed-row"><td>${f.row}</td><td>${escapeHtml(
          f.errors.join("; ")
        )}</td><td>${escapeHtml(JSON.stringify(f.raw))}</td></tr>`;
      }
      html += `</tbody></table>`;
    } else {
      html += `</div>`;
    }
    uploadResult.innerHTML = html;
    uploadResult.classList.add("show");
  }

  // Drag & drop UX for upload area
  (function setupDragDrop() {
    const form = uploadForm;
    if (!form) return;
    form.addEventListener("dragover", (e) => {
      e.preventDefault();
      form.classList.add("dragover");
    });
    form.addEventListener("dragleave", () => {
      form.classList.remove("dragover");
    });
    form.addEventListener("drop", (e) => {
      e.preventDefault();
      form.classList.remove("dragover");
      const f = e.dataTransfer?.files?.[0];
      if (f) {
        // assign to selectedFile to avoid FileList assignment quirks
        selectedFile = f;
        // also set fileInput.files for form semantics (some browsers require it)
        try {
          fileInput.files = e.dataTransfer.files;
        } catch (err) {
          /* ignore readonly in some browsers */
        }
        showSelectedFile(f);
      }
    });
  })();

  // initial load
  loadProducts();
})();
