/* ============================================================
   Luna Spa — main.js (now database-driven via Supabase)
   ============================================================ */

let WHATSAPP_NUMBER = "966552333284"; // fallback until settings load
let SITE_SETTINGS = null;

document.addEventListener("DOMContentLoaded", async () => {
  initHeader();
  initMobileMenu();
  initActiveNav();
  initBackToTop();
  initLightbox();

  SITE_SETTINGS = await getSettings();
  if(SITE_SETTINGS?.whatsapp) WHATSAPP_NUMBER = SITE_SETTINGS.whatsapp;
  applySettings(SITE_SETTINGS);

  await loadPageContent();

  initFilters();
  initRevealAnimations();
  initBookingForm();
  initWhatsappLinks();
  initYear();
});

/* ---------- Apply business settings (name/phone/location/tiktok) ---------- */
function applySettings(settings){
  if(!settings) return;
  document.querySelectorAll(".brand-name").forEach(el => {
    const firstNode = el.childNodes[0];
    if(firstNode) firstNode.textContent = settings.business_name || "Luna Spa";
  });
  document.querySelectorAll(".footer-brand h3").forEach(el => el.textContent = settings.business_name || "Luna Spa");
  document.querySelectorAll('a[href^="tel:"]').forEach(el => el.href = `tel:${(settings.phone||"").replace(/\s/g,"")}`);
  document.querySelectorAll('a[href*="tiktok.com/@lunasalon24"]').forEach(el => { if(settings.tiktok_url) el.href = settings.tiktok_url; });
}

/* ---------- Route content loading by current page ---------- */
async function loadPageContent(){
  const page = location.pathname.split("/").pop() || "index.html";
  if(page === "index.html" || page === "") await loadHomePreview();
  if(page === "services.html") await loadServicesPage();
  if(page === "offers.html") await loadOffersPage();
  if(page === "gallery.html") await loadGalleryPage();
  if(page === "booking.html") await loadBookingServiceOptions();
}

async function loadHomePreview(){
  const wrap = document.querySelector("#home-services-wrap");
  if(wrap){
    const services = (await getServices()).slice(0, 4);
    wrap.innerHTML = services.map(serviceCardHTML).join("") || emptyState("لا توجد خدمات متاحة حالياً");
  }
  const offerWrap = document.querySelector("#home-offer-wrap");
  if(offerWrap){
    const offers = await getOffers();
    offerWrap.innerHTML = offers.slice(0,1).map(offerCardHTML).join("") || emptyState("لا توجد عروض حالياً");
  }
}

async function loadServicesPage(){
  const wrap = document.querySelector("#services-wrap");
  if(!wrap) return;
  const services = await getServices();
  wrap.innerHTML = services.map(serviceCardHTML).join("") || emptyState("لا توجد خدمات متاحة حالياً");
}

async function loadOffersPage(){
  const wrap = document.querySelector("#offers-wrap");
  if(!wrap) return;
  const offers = await getOffers();
  wrap.innerHTML = offers.map(offerCardHTML).join("") || emptyState("لا توجد عروض حالياً — تابعينا على تيك توك لمعرفة أحدث العروض");
}

async function loadGalleryPage(){
  const wrap = document.querySelector("#gallery-wrap");
  if(!wrap) return;
  const images = await getGalleryImages();
  wrap.innerHTML = images.map(galleryCellHTML).join("") || emptyState("سيتم إضافة صور المعرض قريباً");
  initLightbox();
}

async function loadBookingServiceOptions(){
  const select = document.querySelector("#service");
  if(!select) return;
  const services = await getServices();
  const grouped = services.reduce((acc, s) => { (acc[s.category] = acc[s.category] || []).push(s); return acc; }, {});
  const order = ["spa","skin","nails","hair"];
  let html = `<option value="">اختاري الخدمة</option>`;
  order.forEach(cat => {
    if(!grouped[cat]?.length) return;
    html += `<optgroup label="${CATEGORY_LABELS[cat]}">`;
    grouped[cat].forEach(s => { html += `<option value="${s.name}">${s.name}</option>`; });
    html += `</optgroup>`;
  });
  html += `<option value="أخرى / غير محدد">أخرى / غير محدد</option>`;
  select.innerHTML = html;

  const params = new URLSearchParams(location.search);
  const serviceParam = params.get("service");
  if(serviceParam) select.value = serviceParam;
}

/* ---------- Card templates (identical markup/classes to the original design) ---------- */
function serviceCardHTML(s){
  const price = formatPrice(s);
  return `
  <div class="card service-item reveal in" data-cat="${s.category}">
    <div class="card-img">
      <img src="${s.image_url || fallbackImg()}" alt="${s.name}" loading="lazy">
      <span class="card-tag">${CATEGORY_LABELS[s.category] || ""}</span>
    </div>
    <div class="card-body">
      <h3>${s.name}</h3>
      <p>${s.description || ""}</p>
      <div class="card-foot">
        <span class="price">${price.text} ${price.small ? `<small>${price.small}</small>` : ""}</span>
        <a href="booking.html?service=${encodeURIComponent(s.name)}" class="btn btn-outline btn-sm">احجزي الآن</a>
      </div>
    </div>
  </div>`;
}

function offerCardHTML(o){
  const priceRow = o.new_price_on_request || !o.new_price
    ? `<span class="new-price">السعر عند الحجز</span>`
    : `${o.old_price ? `<span class="old-price">${o.old_price} ريال</span>` : ""}<span class="new-price">${o.new_price} ريال</span>`;
  const services = Array.isArray(o.included_services) ? o.included_services : [];
  return `
  <div class="offer-card reveal in">
    <span class="offer-badge">عرض خاص</span>
    <h3>${o.title}</h3>
    <p class="desc">${o.description || ""}</p>
    ${services.length ? `<ul class="offer-services">${services.map(s => `<li><span>${s.name}</span><b>${s.price}</b></li>`).join("")}</ul>` : ""}
    <div class="offer-price-row">${priceRow}</div>
    ${o.valid_text ? `<p class="offer-valid">${o.valid_text}</p>` : ""}
    <a class="btn btn-primary btn-block" href="booking.html?offer=${encodeURIComponent(o.title)}">
      احجزي العرض الآن <i class="fa-solid fa-arrow-left"></i>
    </a>
  </div>`;
}

function galleryCellHTML(g){
  return `
  <div class="gallery-cell gallery-item reveal in" data-cat="${g.category}">
    <img src="${g.image_url}" alt="${g.title || "صورة من Luna Spa"}" loading="lazy">
    <div class="zoom"><i class="fa-solid fa-magnifying-glass-plus"></i></div>
  </div>`;
}

function fallbackImg(){ return "https://images.unsplash.com/photo-1600334129128-685c5582fd35?q=80&w=600&auto=format&fit=crop"; }
function emptyState(msg){ return `<p style="grid-column:1/-1;text-align:center;color:var(--brown-soft);padding:40px 0;">${msg}</p>`; }

/* ---------- Header scroll shadow ---------- */
function initHeader(){
  const header = document.querySelector(".site-header");
  if(!header) return;
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 10);
  onScroll();
  window.addEventListener("scroll", onScroll);
}

/* ---------- Mobile menu ---------- */
function initMobileMenu(){
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".mobile-menu");
  if(!toggle || !menu) return;
  toggle.addEventListener("click", () => {
    menu.classList.toggle("open");
    const icon = toggle.querySelector("i");
    if(icon){
      icon.classList.toggle("fa-bars");
      icon.classList.toggle("fa-xmark");
    }
  });
  menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
    menu.classList.remove("open");
  }));
}

/* ---------- Active nav link by current page ---------- */
function initActiveNav(){
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a, .mobile-menu a").forEach(a => {
    const href = a.getAttribute("href").split("#")[0] || "index.html";
    if(href === path || (path === "" && href === "index.html")){
      a.classList.add("active");
    }
  });
}

/* ---------- Fade-in on scroll ---------- */
function initRevealAnimations(){
  const items = document.querySelectorAll(".reveal:not(.in)");
  if(!items.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach(el => io.observe(el));
}

/* ---------- Back to top ---------- */
function initBackToTop(){
  const btn = document.querySelector(".back-top");
  if(!btn) return;
  window.addEventListener("scroll", () => {
    btn.classList.toggle("show", window.scrollY > 500);
  });
  btn.addEventListener("click", () => window.scrollTo({ top:0, behavior:"smooth" }));
}

/* ---------- Category filters (services / gallery) ---------- */
function initFilters(){
  const filterGroups = document.querySelectorAll("[data-filter-group]");
  filterGroups.forEach(group => {
    const buttons = group.querySelectorAll(".filter-btn");
    const targetSelector = group.getAttribute("data-filter-group");
    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        buttons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const cat = btn.getAttribute("data-cat");
        document.querySelectorAll(targetSelector).forEach(item => {
          const match = cat === "all" || item.getAttribute("data-cat") === cat;
          item.style.display = match ? "" : "none";
        });
      });
    });
  });
}

/* ---------- Lightbox for gallery ---------- */
function initLightbox(){
  const lightbox = document.querySelector(".lightbox");
  if(!lightbox) return;
  const lightboxImg = lightbox.querySelector("img");
  const closeBtn = lightbox.querySelector(".lightbox-close");

  document.querySelectorAll(".gallery-item img").forEach(img => {
    img.addEventListener("click", () => {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.add("open");
    });
  });
  const close = () => lightbox.classList.remove("open");
  closeBtn.onclick = close;
  lightbox.onclick = (e) => { if(e.target === lightbox) close(); };
  document.addEventListener("keydown", (e) => { if(e.key === "Escape") close(); });
}

/* ---------- Booking form → save to database → open WhatsApp ---------- */
function initBookingForm(){
  const form = document.querySelector("#booking-form");
  if(!form) return;

  const params = new URLSearchParams(location.search);
  const offerParam = params.get("offer");
  if(offerParam){
    const noteField = form.querySelector("#notes");
    if(noteField) noteField.value = `بخصوص العرض: ${offerParam}`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fields = {
      name: form.querySelector("#name"),
      phone: form.querySelector("#phone"),
      service: form.querySelector("#service"),
      date: form.querySelector("#date"),
      time: form.querySelector("#time"),
      notes: form.querySelector("#notes"),
    };

    let valid = true;
    ["name","phone","service","date","time"].forEach(key => {
      const el = fields[key];
      const wrap = el.closest(".field");
      if(!el.value.trim()){
        wrap.classList.add("invalid");
        valid = false;
      } else {
        wrap.classList.remove("invalid");
      }
    });

    if(!valid){
      showToast("يرجى تعبئة الحقول المطلوبة قبل إرسال الحجز");
      return;
    }

    const submitBtn = form.querySelector("button[type=submit]");
    if(submitBtn) submitBtn.disabled = true;

    const saved = await submitBooking({
      name: fields.name.value.trim(),
      phone: fields.phone.value.trim(),
      service: fields.service.value,
      date: fields.date.value,
      time: fields.time.value,
      notes: fields.notes.value.trim(),
    });

    if(submitBtn) submitBtn.disabled = false;

    if(!saved){
      showToast("تعذر حفظ الحجز، يرجى المحاولة مرة أخرى أو التواصل عبر واتساب مباشرة");
      return;
    }

    const message =
`مرحباً ${SITE_SETTINGS?.business_name || "Luna Spa"}، أرغب في حجز موعد:

الاسم: ${fields.name.value.trim()}
رقم الجوال: ${fields.phone.value.trim()}
الخدمة: ${fields.service.value}
التاريخ: ${fields.date.value}
الوقت: ${fields.time.value}
ملاحظات: ${fields.notes.value.trim() || "لا يوجد"}`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    showToast("تم حفظ حجزك، جاري تحويلك إلى واتساب لتأكيده...");
    form.reset();
    setTimeout(() => window.open(url, "_blank"), 600);
  });
}

/* ---------- Set every WhatsApp CTA link to the current number ---------- */
function initWhatsappLinks(){
  document.querySelectorAll("[data-whatsapp]").forEach(a => {
    const text = a.getAttribute("data-whatsapp-text") || "مرحباً Luna Spa، أرغب في الاستفسار عن خدماتكم";
    a.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  });
}

/* ---------- Toast ---------- */
function showToast(msg){
  let toast = document.querySelector(".toast");
  if(!toast){
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 3200);
}

/* ---------- Footer year ---------- */
function initYear(){
  document.querySelectorAll(".cur-year").forEach(el => el.textContent = new Date().getFullYear());
}
