/* ============================================================
   Data access layer — customer-facing website.
   All reads go through Supabase; RLS only exposes active rows
   to anonymous visitors (see database/schema.sql).
   ============================================================ */

const CATEGORY_LABELS = { hair: "الشعر", skin: "البشرة", nails: "الأظافر", spa: "السبا" };

async function getSettings(){
  const { data, error } = await supabaseClient.from("settings").select("*").eq("id", 1).single();
  if(error){ console.error("settings error", error); return null; }
  return data;
}

async function getServices(){
  const { data, error } = await supabaseClient.from("services").select("*").eq("active", true).order("sort_order", { ascending: true });
  if(error){ console.error("services error", error); return []; }
  return data;
}

async function getOffers(){
  const { data, error } = await supabaseClient.from("offers").select("*").eq("active", true).order("sort_order", { ascending: true });
  if(error){ console.error("offers error", error); return []; }
  return data;
}

async function getGalleryImages(){
  const { data, error } = await supabaseClient.from("gallery_images").select("*").order("sort_order", { ascending: true });
  if(error){ console.error("gallery error", error); return []; }
  return data;
}

async function submitBooking(booking){
  const { error } = await supabaseClient.from("bookings").insert({
    customer_name: booking.name,
    phone: booking.phone,
    service: booking.service,
    booking_date: booking.date,
    booking_time: booking.time,
    notes: booking.notes || "",
  });
  if(error){ console.error("booking insert error", error); return false; }
  return true;
}

async function submitContactMessage(msg){
  const { error } = await supabaseClient.from("contact_messages").insert({
    customer_name: msg.name || "غير محدد",
    phone: msg.phone || "",
    message: msg.message,
  });
  if(error){ console.error("contact message insert error", error); return false; }
  return true;
}

function formatPrice(row){
  if(row.price_on_request || row.price === null || row.price === undefined){
    return { text: "السعر عند الحجز", small: "" };
  }
  return { text: String(row.price), small: "ريال" };
}
