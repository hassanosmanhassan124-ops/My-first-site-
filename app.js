/* ============================================================
   Luna Spa Admin — app.js
   ============================================================ */

const CATEGORY_LABELS = { hair: "الشعر", skin: "البشرة", nails: "الأظافر", spa: "السبا" };
const BUCKET = "luna-spa";
let CURRENT_USER = null;

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireAdmin();
  if(!ok) return;

  initSidebar();
  initModals();
  initLogout();
  initServiceForm();
  initOfferForm();
  initGalleryForm();
  initSettingsForm();

  await Promise.all([loadOverview(), loadServices(), loadOffers(), loadGallery(), loadBookings(), loadMessages(), loadSettings()]);
});

/* ---------- Auth guard ---------- */
async function requireAdmin(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session){ window.location.href = "login.html"; return false; }

  const { data: adminRow, error } = await supabaseClient.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
  if(error || !adminRow){
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
    return false;
  }
  CURRENT_USER = session.user;
  const emailEl = document.getElementById("admin-email");
  if(emailEl) emailEl.textContent = session.user.email;
  return true;
}

function initLogout(){
  document.getElementById("logout-btn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
}

/* ---------- Sidebar / tabs ---------- */
function initSidebar(){
  const titles = {
    overview: "نظرة عامة", services: "إدارة الخدمات", offers: "إدارة العروض",
    gallery: "معرض الأعمال", bookings: "الحجوزات", messages: "رسائل التواصل", settings: "إعدادات النشاط",
  };
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab"), titles));
  });
  document.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-goto"), titles));
  });

  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  menuToggle?.addEventListener("click", () => { sidebar.classList.add("open"); backdrop.classList.add("open"); });
  backdrop?.addEventListener("click", () => { sidebar.classList.remove("open"); backdrop.classList.remove("open"); });
}

function switchTab(tab, titles){
  document.querySelectorAll(".tab-panel").forEach(p => p.style.display = "none");
  document.getElementById(`tab-${tab}`).style.display = "";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === tab));
  document.getElementById("topbar-title").textContent = titles[tab] || tab;
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-backdrop").classList.remove("open");
}

/* ---------- Modals ---------- */
function initModals(){
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close")));
  });
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => { if(e.target === overlay) closeModal(overlay.id); });
  });
}
function openModal(id){ document.getElementById(id).classList.add("open"); }
function closeModal(id){ document.getElementById(id).classList.remove("open"); }

/* ---------- Image upload helper ---------- */
async function uploadImage(file, folder){
  const ext = file.name.split(".").pop();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file, { upsert: false });
  if(error){ showToast("فشل رفع الصورة: " + error.message, true); return null; }
  const { data } = supabaseClient.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
function previewFile(input, previewEl){
  input.addEventListener("change", () => {
    const file = input.files[0];
    if(!file) return;
    const url = URL.createObjectURL(file);
    previewEl.style.backgroundImage = `url(${url})`;
    previewEl.textContent = "";
  });
}

/* ================================================================
   OVERVIEW
   ================================================================ */
async function loadOverview(){
  const [{ count: svcCount }, { count: ofrCount }, { count: galCount }, { count: bkgCount }, { count: msgCount }] = await Promise.all([
    supabaseClient.from("services").select("*", { count: "exact", head: true }),
    supabaseClient.from("offers").select("*", { count: "exact", head: true }),
    supabaseClient.from("gallery_images").select("*", { count: "exact", head: true }),
    supabaseClient.from("bookings").select("*", { count: "exact", head: true }),
    supabaseClient.from("contact_messages").select("*", { count: "exact", head: true }),
  ]);
  document.getElementById("stat-services").textContent = svcCount ?? 0;
  document.getElementById("stat-offers").textContent = ofrCount ?? 0;
  document.getElementById("stat-gallery").textContent = galCount ?? 0;
  document.getElementById("stat-bookings").textContent = bkgCount ?? 0;
  document.getElementById("stat-messages").textContent = msgCount ?? 0;

  const { data: recent } = await supabaseClient.from("bookings").select("*").order("created_at", { ascending: false }).limit(5);
  const body = document.getElementById("overview-bookings-body");
  if(!recent?.length){ body.innerHTML = `<tr><td colspan="4" class="empty-row">لا توجد حجوزات بعد</td></tr>`; return; }
  body.innerHTML = recent.map(b => `
    <tr>
      <td>${escapeHtml(b.customer_name)}</td>
      <td>${escapeHtml(b.service)}</td>
      <td>${b.booking_date}</td>
      <td><span class="badge ${b.status}">${statusLabel(b.status)}</span></td>
    </tr>`).join("");
}

/* ================================================================
   SERVICES
   ================================================================ */
let SERVICES_CACHE = [];

async function loadServices(){
  const { data, error } = await supabaseClient.from("services").select("*").order("sort_order", { ascending: true });
  const body = document.getElementById("services-body");
  if(error){ body.innerHTML = `<tr><td colspan="6" class="empty-row">تعذر تحميل الخدمات</td></tr>`; return; }
  SERVICES_CACHE = data;
  if(!data.length){ body.innerHTML = `<tr><td colspan="6" class="empty-row">لا توجد خدمات — أضيفي خدمة جديدة</td></tr>`; return; }
  body.innerHTML = data.map(s => `
    <tr>
      <td>${s.image_url ? `<img class="thumb" src="${s.image_url}" alt="">` : "—"}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${CATEGORY_LABELS[s.category] || s.category}</td>
      <td>${s.price_on_request ? "عند الحجز" : (s.price ?? "—") + " ريال"}</td>
      <td><span class="badge ${s.active ? "active" : "inactive"}">${s.active ? "مفعّلة" : "غير مفعّلة"}</span></td>
      <td class="row-actions">
        <button class="icon-btn" data-edit-service="${s.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn danger" data-delete-service="${s.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join("");

  body.querySelectorAll("[data-edit-service]").forEach(btn => btn.addEventListener("click", () => openServiceModal(btn.getAttribute("data-edit-service"))));
  body.querySelectorAll("[data-delete-service]").forEach(btn => btn.addEventListener("click", () => deleteService(btn.getAttribute("data-delete-service"))));
}

function initServiceForm(){
  document.getElementById("add-service-btn").addEventListener("click", () => openServiceModal(null));
  previewFile(document.getElementById("svc-file"), document.getElementById("svc-preview"));

  document.getElementById("service-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("svc-save-btn");
    btn.disabled = true;

    const id = document.getElementById("svc-id").value || null;
    const file = document.getElementById("svc-file").files[0];
    let imageUrl = document.getElementById("svc-preview").dataset.url || "";
    if(file){
      const uploaded = await uploadImage(file, "services");
      if(uploaded) imageUrl = uploaded;
    }

    const payload = {
      name: document.getElementById("svc-name").value.trim(),
      category: document.getElementById("svc-category").value,
      description: document.getElementById("svc-desc").value.trim(),
      price: document.getElementById("svc-price-request").checked ? null : (parseFloat(document.getElementById("svc-price").value) || null),
      price_on_request: document.getElementById("svc-price-request").checked,
      image_url: imageUrl,
      active: document.getElementById("svc-active").checked,
      updated_at: new Date().toISOString(),
    };

    const { error } = id
      ? await supabaseClient.from("services").update(payload).eq("id", id)
      : await supabaseClient.from("services").insert(payload);

    btn.disabled = false;
    if(error){ showToast("تعذر حفظ الخدمة: " + error.message, true); return; }
    showToast("تم حفظ الخدمة بنجاح");
    closeModal("service-modal");
    await Promise.all([loadServices(), loadOverview()]);
  });
}

function openServiceModal(id){
  const form = document.getElementById("service-form");
  form.reset();
  document.getElementById("svc-id").value = "";
  document.getElementById("svc-preview").style.backgroundImage = "";
  document.getElementById("svc-preview").textContent = "لا توجد صورة";
  document.getElementById("svc-preview").dataset.url = "";
  document.getElementById("svc-price-request").checked = false;

  if(id){
    const s = SERVICES_CACHE.find(x => x.id === id);
    document.getElementById("service-modal-title").textContent = "تعديل الخدمة";
    document.getElementById("svc-id").value = s.id;
    document.getElementById("svc-name").value = s.name;
    document.getElementById("svc-category").value = s.category;
    document.getElementById("svc-price").value = s.price ?? "";
    document.getElementById("svc-price-request").checked = s.price_on_request;
    document.getElementById("svc-desc").value = s.description || "";
    document.getElementById("svc-active").checked = s.active;
    if(s.image_url){
      document.getElementById("svc-preview").style.backgroundImage = `url(${s.image_url})`;
      document.getElementById("svc-preview").textContent = "";
      document.getElementById("svc-preview").dataset.url = s.image_url;
    }
  } else {
    document.getElementById("service-modal-title").textContent = "إضافة خدمة";
  }
  openModal("service-modal");
}

async function deleteService(id){
  if(!confirm("هل تريدين حذف هذه الخدمة؟")) return;
  const { error } = await supabaseClient.from("services").delete().eq("id", id);
  if(error){ showToast("تعذر حذف الخدمة", true); return; }
  showToast("تم حذف الخدمة");
  await Promise.all([loadServices(), loadOverview()]);
}

/* ================================================================
   OFFERS
   ================================================================ */
let OFFERS_CACHE = [];

async function loadOffers(){
  const { data, error } = await supabaseClient.from("offers").select("*").order("sort_order", { ascending: true });
  const body = document.getElementById("offers-body");
  if(error){ body.innerHTML = `<tr><td colspan="5" class="empty-row">تعذر تحميل العروض</td></tr>`; return; }
  OFFERS_CACHE = data;
  if(!data.length){ body.innerHTML = `<tr><td colspan="5" class="empty-row">لا توجد عروض — أضيفي عرضاً جديداً</td></tr>`; return; }
  body.innerHTML = data.map(o => `
    <tr>
      <td>${escapeHtml(o.title)}</td>
      <td>${o.old_price ?? "—"}</td>
      <td>${o.new_price_on_request ? "عند الحجز" : (o.new_price ?? "—")}</td>
      <td><span class="badge ${o.active ? "active" : "inactive"}">${o.active ? "مفعّل" : "غير مفعّل"}</span></td>
      <td class="row-actions">
        <button class="icon-btn" data-edit-offer="${o.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn danger" data-delete-offer="${o.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join("");

  body.querySelectorAll("[data-edit-offer]").forEach(btn => btn.addEventListener("click", () => openOfferModal(btn.getAttribute("data-edit-offer"))));
  body.querySelectorAll("[data-delete-offer]").forEach(btn => btn.addEventListener("click", () => deleteOffer(btn.getAttribute("data-delete-offer"))));
}

function initOfferForm(){
  document.getElementById("add-offer-btn").addEventListener("click", () => openOfferModal(null));

  document.getElementById("offer-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("ofr-save-btn");
    btn.disabled = true;

    const id = document.getElementById("ofr-id").value || null;
    const servicesLines = document.getElementById("ofr-services").value.split("\n").map(l => l.trim()).filter(Boolean);
    const includedServices = servicesLines.map(line => {
      const [name, price] = line.split(" - ");
      return { name: (name || line).trim(), price: (price || "السعر عند الحجز").trim() };
    });

    const payload = {
      title: document.getElementById("ofr-title").value.trim(),
      description: document.getElementById("ofr-desc").value.trim(),
      included_services: includedServices,
      old_price: parseFloat(document.getElementById("ofr-old-price").value) || null,
      new_price: document.getElementById("ofr-price-request").checked ? null : (parseFloat(document.getElementById("ofr-new-price").value) || null),
      new_price_on_request: document.getElementById("ofr-price-request").checked,
      valid_text: document.getElementById("ofr-valid").value.trim(),
      active: document.getElementById("ofr-active").checked,
      updated_at: new Date().toISOString(),
    };

    const { error } = id
      ? await supabaseClient.from("offers").update(payload).eq("id", id)
      : await supabaseClient.from("offers").insert(payload);

    btn.disabled = false;
    if(error){ showToast("تعذر حفظ العرض: " + error.message, true); return; }
    showToast("تم حفظ العرض بنجاح");
    closeModal("offer-modal");
    await Promise.all([loadOffers(), loadOverview()]);
  });
}

function openOfferModal(id){
  const form = document.getElementById("offer-form");
  form.reset();
  document.getElementById("ofr-id").value = "";
  document.getElementById("ofr-price-request").checked = false;

  if(id){
    const o = OFFERS_CACHE.find(x => x.id === id);
    document.getElementById("offer-modal-title").textContent = "تعديل العرض";
    document.getElementById("ofr-id").value = o.id;
    document.getElementById("ofr-title").value = o.title;
    document.getElementById("ofr-desc").value = o.description || "";
    document.getElementById("ofr-services").value = (o.included_services || []).map(s => `${s.name} - ${s.price}`).join("\n");
    document.getElementById("ofr-old-price").value = o.old_price ?? "";
    document.getElementById("ofr-new-price").value = o.new_price ?? "";
    document.getElementById("ofr-price-request").checked = o.new_price_on_request;
    document.getElementById("ofr-valid").value = o.valid_text || "";
    document.getElementById("ofr-active").checked = o.active;
  } else {
    document.getElementById("offer-modal-title").textContent = "إضافة عرض";
  }
  openModal("offer-modal");
}

async function deleteOffer(id){
  if(!confirm("هل تريدين حذف هذا العرض؟")) return;
  const { error } = await supabaseClient.from("offers").delete().eq("id", id);
  if(error){ showToast("تعذر حذف العرض", true); return; }
  showToast("تم حذف العرض");
  await Promise.all([loadOffers(), loadOverview()]);
}

/* ================================================================
   GALLERY
   ================================================================ */
async function loadGallery(){
  const { data, error } = await supabaseClient.from("gallery_images").select("*").order("sort_order", { ascending: true });
  const body = document.getElementById("gallery-body");
  if(error){ body.innerHTML = `<tr><td colspan="4" class="empty-row">تعذر تحميل الصور</td></tr>`; return; }
  if(!data.length){ body.innerHTML = `<tr><td colspan="4" class="empty-row">لا توجد صور — ارفعي صورة جديدة</td></tr>`; return; }
  body.innerHTML = data.map(g => `
    <tr>
      <td><img class="thumb" src="${g.image_url}" alt=""></td>
      <td>${escapeHtml(g.title || "—")}</td>
      <td>${CATEGORY_LABELS[g.category] || g.category}</td>
      <td class="row-actions"><button class="icon-btn danger" data-delete-gallery="${g.id}"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join("");
  body.querySelectorAll("[data-delete-gallery]").forEach(btn => btn.addEventListener("click", () => deleteGalleryImage(btn.getAttribute("data-delete-gallery"))));
}

function initGalleryForm(){
  document.getElementById("add-gallery-btn").addEventListener("click", () => {
    document.getElementById("gallery-form").reset();
    document.getElementById("gal-preview").style.backgroundImage = "";
    document.getElementById("gal-preview").textContent = "لا توجد صورة";
    openModal("gallery-modal");
  });
  previewFile(document.getElementById("gal-file"), document.getElementById("gal-preview"));

  document.getElementById("gallery-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("gal-save-btn");
    const file = document.getElementById("gal-file").files[0];
    if(!file){ showToast("يرجى اختيار صورة", true); return; }
    btn.disabled = true;

    const imageUrl = await uploadImage(file, "gallery");
    if(!imageUrl){ btn.disabled = false; return; }

    const { error } = await supabaseClient.from("gallery_images").insert({
      title: document.getElementById("gal-title").value.trim(),
      category: document.getElementById("gal-category").value,
      image_url: imageUrl,
    });

    btn.disabled = false;
    if(error){ showToast("تعذر رفع الصورة: " + error.message, true); return; }
    showToast("تم رفع الصورة بنجاح");
    closeModal("gallery-modal");
    await Promise.all([loadGallery(), loadOverview()]);
  });
}

async function deleteGalleryImage(id){
  if(!confirm("هل تريدين حذف هذه الصورة؟")) return;
  const { error } = await supabaseClient.from("gallery_images").delete().eq("id", id);
  if(error){ showToast("تعذر حذف الصورة", true); return; }
  showToast("تم حذف الصورة");
  await Promise.all([loadGallery(), loadOverview()]);
}

/* ================================================================
   BOOKINGS
   ================================================================ */
async function loadBookings(){
  const { data, error } = await supabaseClient.from("bookings").select("*").order("created_at", { ascending: false });
  const body = document.getElementById("bookings-body");
  if(error){ body.innerHTML = `<tr><td colspan="7" class="empty-row">تعذر تحميل الحجوزات</td></tr>`; return; }
  if(!data.length){ body.innerHTML = `<tr><td colspan="7" class="empty-row">لا توجد حجوزات بعد</td></tr>`; return; }
  body.innerHTML = data.map(b => `
    <tr>
      <td>${escapeHtml(b.customer_name)}</td>
      <td dir="ltr">${escapeHtml(b.phone)}</td>
      <td>${escapeHtml(b.service)}</td>
      <td>${b.booking_date}</td>
      <td>${b.booking_time}</td>
      <td>${escapeHtml(b.notes || "—")}</td>
      <td>
        <select class="status-select" data-booking-status="${b.id}">
          <option value="new" ${b.status==="new"?"selected":""}>جديد</option>
          <option value="confirmed" ${b.status==="confirmed"?"selected":""}>مؤكد</option>
          <option value="completed" ${b.status==="completed"?"selected":""}>مكتمل</option>
          <option value="cancelled" ${b.status==="cancelled"?"selected":""}>ملغي</option>
        </select>
      </td>
    </tr>`).join("");

  body.querySelectorAll("[data-booking-status]").forEach(sel => {
    sel.addEventListener("change", async () => {
      const id = sel.getAttribute("data-booking-status");
      const { error } = await supabaseClient.from("bookings").update({ status: sel.value }).eq("id", id);
      if(error){ showToast("تعذر تحديث الحالة", true); return; }
      showToast("تم تحديث حالة الحجز");
      loadOverview();
    });
  });
}

function statusLabel(s){
  return { new: "جديد", confirmed: "مؤكد", completed: "مكتمل", cancelled: "ملغي" }[s] || s;
}

/* ================================================================
   CONTACT MESSAGES
   ================================================================ */
async function loadMessages(){
  const { data, error } = await supabaseClient.from("contact_messages").select("*").order("created_at", { ascending: false });
  const body = document.getElementById("messages-body");
  if(error){ body.innerHTML = `<tr><td colspan="6" class="empty-row">تعذر تحميل الرسائل</td></tr>`; return; }
  if(!data.length){ body.innerHTML = `<tr><td colspan="6" class="empty-row">لا توجد رسائل بعد</td></tr>`; return; }
  body.innerHTML = data.map(m => `
    <tr>
      <td>${escapeHtml(m.customer_name)}</td>
      <td dir="ltr">${escapeHtml(m.phone || "—")}</td>
      <td style="max-width:280px;white-space:pre-wrap;">${escapeHtml(m.message)}</td>
      <td>${new Date(m.created_at).toLocaleDateString("ar-SA")}</td>
      <td><span class="badge ${m.status === "new" ? "new" : "active"}">${m.status === "new" ? "جديدة" : "مقروءة"}</span></td>
      <td class="row-actions">
        ${m.status === "new" ? `<button class="icon-btn" data-read-message="${m.id}" title="تحديد كمقروءة"><i class="fa-solid fa-envelope-open"></i></button>` : ""}
        <button class="icon-btn danger" data-delete-message="${m.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join("");

  body.querySelectorAll("[data-read-message]").forEach(btn => btn.addEventListener("click", async () => {
    const id = btn.getAttribute("data-read-message");
    const { error } = await supabaseClient.from("contact_messages").update({ status: "read" }).eq("id", id);
    if(error){ showToast("تعذر تحديث الرسالة", true); return; }
    await loadMessages();
  }));
  body.querySelectorAll("[data-delete-message]").forEach(btn => btn.addEventListener("click", async () => {
    if(!confirm("هل تريدين حذف هذه الرسالة؟")) return;
    const id = btn.getAttribute("data-delete-message");
    const { error } = await supabaseClient.from("contact_messages").delete().eq("id", id);
    if(error){ showToast("تعذر حذف الرسالة", true); return; }
    showToast("تم حذف الرسالة");
    await Promise.all([loadMessages(), loadOverview()]);
  }));
}

/* ================================================================
   SETTINGS
   ================================================================ */
async function loadSettings(){
  const { data, error } = await supabaseClient.from("settings").select("*").eq("id", 1).single();
  if(error || !data) return;
  document.getElementById("s-name").value = data.business_name || "";
  document.getElementById("s-phone").value = data.phone || "";
  document.getElementById("s-whatsapp").value = data.whatsapp || "";
  document.getElementById("s-location").value = data.location || "";
  document.getElementById("s-tiktok").value = data.tiktok_url || "";
  document.getElementById("s-instagram").value = data.instagram_url || "";
  document.getElementById("s-desc").value = data.description || "";
  if(data.logo_url){
    document.getElementById("logo-preview").style.backgroundImage = `url(${data.logo_url})`;
    document.getElementById("logo-preview").textContent = "";
    document.getElementById("logo-preview").dataset.url = data.logo_url;
  }
}

function initSettingsForm(){
  previewFile(document.getElementById("logo-file"), document.getElementById("logo-preview"));

  document.getElementById("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("settings-save-btn");
    btn.disabled = true;

    let logoUrl = document.getElementById("logo-preview").dataset.url || "";
    const logoFile = document.getElementById("logo-file").files[0];
    if(logoFile){
      const uploaded = await uploadImage(logoFile, "branding");
      if(uploaded) logoUrl = uploaded;
    }

    const payload = {
      business_name: document.getElementById("s-name").value.trim(),
      phone: document.getElementById("s-phone").value.trim(),
      whatsapp: document.getElementById("s-whatsapp").value.trim(),
      location: document.getElementById("s-location").value.trim(),
      tiktok_url: document.getElementById("s-tiktok").value.trim(),
      instagram_url: document.getElementById("s-instagram").value.trim(),
      description: document.getElementById("s-desc").value.trim(),
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseClient.from("settings").update(payload).eq("id", 1);
    btn.disabled = false;
    if(error){ showToast("تعذر حفظ الإعدادات: " + error.message, true); return; }
    showToast("تم حفظ الإعدادات بنجاح");
  });
}

/* ---------- Helpers ---------- */
function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

function showToast(msg, isError){
  let toast = document.querySelector(".toast");
  if(!toast){ toast = document.createElement("div"); toast.className = "toast"; document.body.appendChild(toast); }
  toast.textContent = msg;
  toast.classList.toggle("error", !!isError);
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 3400);
}
