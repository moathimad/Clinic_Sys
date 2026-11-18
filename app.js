import {
  SPECIALTIES,
  DEMO_CODE,
  readState,
  writeState,
  today,
  addDays,
  weekday,
  normalizePhone,
  isValidName,
  slotsFor,
  availableDoctors,
  createBooking,
  updateBooking,
} from "./data.js";

const app = document.querySelector("#app");
const modal = document.querySelector("#modal");
const chatRoot = document.querySelector("#chat-root");
const backToTop = document.createElement("button");
backToTop.type = "button";
backToTop.className = "back-to-top";
backToTop.hidden = true;
backToTop.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 12 6-6 6 6M12 6v14"/></svg>';
document.body.append(backToTop);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const getSession = (key) => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};
const setSession = (key, value) => {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Demo can still run without persistence. */
  }
};
let lang;
try {
  lang = localStorage.getItem("careslot.language") === "ar" ? "ar" : "en";
} catch {
  lang = "en";
}
const t = (en, ar) => (lang === "ar" ? ar : en);
const spec = (id) => {
  const s = SPECIALTIES.find((s) => s.id === id);
  return s ? s[lang] : "";
};
const doctorName = (d) =>
  d
    ? lang === "ar"
      ? d.ar
      : d.name
    : t("To be assigned", "سيتم تعيين الطبيب");
const dateText = (date, long = false) =>
  new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", {
    timeZone: "Asia/Amman",
    weekday: long ? "long" : "short",
    month: long ? "long" : "short",
    day: "numeric",
  }).format(new Date(date + "T12:00:00Z"));
const money = () => `${readState().fee} ${t("JOD", "د.أ")}`;
const brand = (href = "#/") =>
  `<a class="brand" href="${href}" aria-label="CareSlot home"><span class="brand-mark" aria-hidden="true">+</span>CareSlot</a>`;
const button = (label, action, extra = "", cls = "") =>
  `<button class="btn ${cls}" type="button" data-action="${action}" ${extra}>${label}</button>`;
const badge = (status) =>
  `<span class="badge ${escape(status)}">${{ pending: t("Pending", "بانتظار التأكيد"), confirmed: t("Confirmed", "مؤكد"), cancelled: t("Cancelled", "ملغى"), completed: t("Completed", "مكتمل"), approved: t("Approved", "موافق عليه"), declined: t("Declined", "مرفوض") }[status] || escape(status)}</span>`;
const languageButton = () =>
  `<button type="button" class="text-button" data-action="language" lang="${lang === "en" ? "ar" : "en"}">${t("العربية", "English")}</button>`;
const notice = (text, kind = "") => `<div class="notice ${kind}">${text}</div>`;
const errorBox = () =>
  '<div class="form-error" role="alert" id="form-error"></div>';
const demoNote = () =>
  `<div class="demo-note">${t("Frontend demo: no SMS is sent. Use verification code", "نسخة تجريبية: لن يتم إرسال رسالة. استخدم رمز التحقق")} <strong class="ltr">${DEMO_CODE}</strong>.</div>`;
const field = (label, name, value = "", options = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" value="${escape(value)}" ${options}></label>`;
const demoPatientNames = {
  "CS-4821": ["Lina Mahmoud", "لينا محمود"],
  "CS-4822": ["Omar Khalil", "عمر خليل"],
  "CS-4823": ["Reem Saleh", "ريم صالح"],
  "CS-4824": ["Sami Odeh", "سامي عودة"],
  "CS-4825": ["Hala Barakat", "هالة بركات"],
  "CS-4826": ["Dana Aziz", "دانا عزيز"],
};
const patientName = (b) => {
  const demo = demoPatientNames[b.id];
  return lang === "ar" && demo?.[0] === b.name ? demo[1] : b.name;
};
const person = (d, subtitle = "") =>
  `<div class="person"><span class="avatar">${escape(d?.initials || "?")}</span><div><strong>${escape(doctorName(d))}</strong>${subtitle ? `<p>${escape(subtitle)}</p>` : ""}</div></div>`;
const portal = document.documentElement.dataset.portal;
const authKey = "careslot.auth." + portal;
let session = portal ? getSession(authKey) : null;
if (session?.role !== portal) session = null;
let verified = getSession("careslot.verified");
const defaultDraft = {
  specialty: "dermatology",
  preferredId: "any",
  date: readState().bookings[0]?.date || today(),
  time: "",
  name: "",
  phone: "",
  note: "",
};
const savedDraft = getSession("careslot.draft");
let draft = { ...defaultDraft };
if (savedDraft && typeof savedDraft === "object") {
  for (const key of Object.keys(defaultDraft)) {
    if (typeof savedDraft[key] === "string") draft[key] = savedDraft[key];
  }
}
const parsedDraftDate = new Date(draft.date + "T12:00:00Z");
if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !Number.isFinite(parsedDraftDate.getTime()) ||
    parsedDraftDate.toISOString().slice(0, 10) !== draft.date) {
  draft.date = defaultDraft.date;
  draft.time = "";
}
if (!SPECIALTIES.some((specialty) => specialty.id === draft.specialty)) {
  draft.specialty = defaultDraft.specialty;
  draft.time = "";
}
let calendarMonth = draft.date.slice(0, 7);
let lookupPhone = "";
let lookupStage = "phone";
let lookupResult = [];
let staffDay = readState().bookings[0]?.date || today();
let staffFilter = "all";
let search = "";
let lastFocus;
let resendAt = 0;
let resendTimer;
let chatOpen = false;
let chatMessages = [];
let chatBusy = false;
let chatContext = {
  specialty: "dermatology",
  date: draft.date,
  preferredId: "any",
};
let toastTimer;

function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 4200);
}
function saveDraft() {
  setSession("careslot.draft", draft);
}
function go(path) {
  saveDraft();
  if (location.hash === "#" + path) render();
  else location.hash = path;
}
function route() {
  const h = location.hash.slice(1);
  return h.startsWith("/") ? h : "/";
}
function isVerified(phone) {
  return verified && verified.phone === phone && verified.expires > Date.now();
}
function assertStaff() {
  return session?.role === "staff";
}
function clearFieldError(input) {
  input.closest(".field")?.querySelector(".field-error")?.remove();
  input.removeAttribute("aria-invalid");
  input.removeAttribute("aria-describedby");
}
function showFieldError(input, message) {
  clearFieldError(input);
  const error = document.createElement("span");
  error.id = input.form.id + "-" + input.name + "-error";
  error.className = "field-error";
  error.setAttribute("role", "alert");
  error.textContent = message;
  input.insertAdjacentElement("afterend", error);
  input.setAttribute("aria-invalid", "true");
  input.setAttribute("aria-describedby", error.id);
}
function formError(message, form = document) {
  const box =
    form.querySelector("#form-error") || document.querySelector("#form-error");
  if (box) {
    box.textContent = message;
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } else toast(message);
}
function title(text) {
  document.title = text + " — CareSlot";
}
function header() {
  return `<header class="app-header">${brand()}<div class="header-right">${languageButton()}<a class="link" href="#/lookup">${t("Find my booking", "العثور على حجزي")}</a></div></header>`;
}
function summary(
  date = draft.date,
  time = draft.time,
  specialty = draft.specialty,
  preferredId = draft.preferredId,
) {
  const state = readState(),
    doc = state.doctors.find((d) => d.id === preferredId);
  return `<div class="summary-line"><span>${t("Date", "التاريخ")}</span><strong>${escape(dateText(date))}</strong></div><div class="summary-line"><span>${t("Time", "الوقت")}</span><strong class="ltr">${escape(time || t("Not selected", "لم يتم الاختيار"))}</strong></div><div class="summary-line"><span>${t("Doctor", "الطبيب")}</span><strong>${escape(doc ? doctorName(doc) : t("Any available doctor", "أي طبيب متاح"))}</strong></div><p>${escape(spec(specialty))} · ${state.duration} ${t("min", "دقيقة")} · ${money()}<br>${t("Building 12, Al-Rainbow St, Jabal Amman", "مبنى ١٢، شارع الرينبو، جبل عمّان")}</p>`;
}
function sideSummary() {
  const state = readState();
  const doctor = state.doctors.find((d) => d.id === draft.preferredId);
  return `<div class="booking-sidebar"><aside class="panel summary-panel" aria-labelledby="visit-summary-title"><header><h3 id="visit-summary-title">${t("Your visit", "زيارتك")}</h3><p class="muted">${t("CareSlot Clinic · Amman", "عيادة كيرسلوت · عمّان")}</p></header><dl class="visit-details"><div><dt>${t("Date", "التاريخ")}</dt><dd>${escape(dateText(draft.date))}</dd></div><div><dt>${t("Time", "الوقت")}</dt><dd>${draft.time ? `<bdi>${escape(draft.time)}</bdi>` : t("Not selected", "لم يتم الاختيار")}</dd></div><div class="visit-doctor"><dt>${t("Doctor", "الطبيب")}</dt><dd>${escape(doctor ? doctorName(doctor) : t("Any available doctor", "أي طبيب متاح"))}</dd></div></dl><div class="visit-service"><div><strong>${escape(spec(draft.specialty))}</strong><span>${state.duration} ${t("min consultation", "دقيقة للاستشارة")}</span></div><strong class="visit-fee">${money()}</strong></div><p class="visit-location">${t("Building 12, Al-Rainbow St, Jabal Amman", "مبنى ١٢، شارع الرينبو، جبل عمّان")}</p><p class="visit-note">${t("Pay at the clinic. We’ll message you once your doctor is assigned and your visit is confirmed.", "الدفع في العيادة. سنرسل رسالة عند تعيين الطبيب وتأكيد زيارتك.")}</p></aside><div class="booking-help" id="booking-help"></div></div>`;
}
function bookingShell(content, step = 1) {
  const steps = [
    ["specialty", t("Specialty & date", "التخصص والتاريخ")],
    ["time", t("Time", "الوقت")],
    ["details", t("Details & verification", "البيانات والتحقق")],
  ];
  const links = steps.map(([path, label], index) =>
    `<a href="#/book/${path}" data-action="booking-step" data-step="${index + 1}" class="${step === index + 1 ? "current" : ""}"${step === index + 1 ? ' aria-current="step"' : ""}>${index + 1} · ${label}</a>`,
  ).join('<span aria-hidden="true">→</span>');
  return `${header()}<main class="page-shell" id="main"><h1 class="page-title">${t("Book a visit", "احجز زيارة")}</h1><nav class="breadcrumbs" aria-label="${t("Booking steps", "خطوات الحجز")}">${links}</nav><div class="booking-layout"><section class="panel">${content}</section>${sideSummary()}</div></main>`;
}

function landing() {
  const services = SPECIALTIES.map(
    (s) =>
      `<button class="service-card" data-action="service-book" data-specialty="${s.id}"><h3>${s[lang]}</h3><p>${lang === "ar" ? s.arabic : s.description}</p><span class="service-booking-link">${t("View appointments", "عرض المواعيد")}<span aria-hidden="true">${t("↗", "↖")}</span></span></button>`,
  ).join("");
  return `<header class="site-header">${brand()}<nav class="nav-links" aria-label="${t("Main navigation", "التنقل الرئيسي")}"><a href="#how">${t("How it works", "كيف يعمل")}</a><a href="#doctors">${t("Doctors", "الأطباء")}</a><a href="#services">${t("Services", "التخصصات")}</a><a href="#about">${t("About", "عن العيادة")}</a><a href="#visit">${t("Visit us", "موقعنا")}</a></nav><div class="nav-actions">${languageButton()}<a class="btn pill" href="#/book/specialty">${t("Book a visit", "احجز زيارة")}</a><button class="menu-toggle" data-action="menu" aria-expanded="false" aria-controls="mobile-navigation">${t("Menu", "القائمة")}</button></div></header>
  <nav class="mobile-menu" id="mobile-navigation" aria-label="${t("Mobile navigation", "قائمة الهاتف")}"><a href="#how">${t("How it works", "كيف يعمل")}</a><a href="#doctors">${t("Doctors", "الأطباء")}</a><a href="#services">${t("Services", "التخصصات")}</a><a href="#about">${t("About", "عن العيادة")}</a><a href="#visit">${t("Visit us", "موقعنا")}</a></nav>
  <main id="main"><section class="hero"><div class="hero-copy"><span class="mobile-eyebrow">${t("Online booking · no account needed", "حجز عبر الإنترنت · دون إنشاء حساب")}</span><h1>${t("Book your next visit with ease.", "احجز زيارتك القادمة بسهولة.")}</h1><p class="hero-description">${t("Choose a date and time, enter your details, and verify your phone. The clinic assigns a doctor and confirms your request by message.", "اختر التاريخ والوقت، وأدخل بياناتك وتحقق من هاتفك. ستعيّن العيادة الطبيب وتؤكد طلبك برسالة.")}</p><div class="booking-actions"><div class="actions"><a class="btn pill" href="#/book/specialty">${t("Book a visit", "احجز زيارة")}</a><a class="btn pill outline" href="#how">${t("How it works", "كيف يعمل")}</a></div><div class="returning-link"><img src="assets/calendar.svg" width="16" height="16" alt=""><span>${t("Already booked?", "لديك حجز؟")}</span><a href="#/lookup">${t("Find my booking →", "العثور على حجزي ←")}</a></div></div></div><img class="hero-photo" src="assets/clinic-consultation.png" width="668" height="760" alt="${t("A doctor listening to her patient during a consultation", "طبيبة تستمع إلى المريضة خلال الاستشارة")}" fetchpriority="high"></section>
  <section class="container landing-section how" id="how"><div class="section-heading"><h2>${t("From booking to the doctor’s screen in three steps", "من الحجز إلى شاشة الطبيب في ثلاث خطوات")}</h2></div><div class="three-grid">${[
    [
      t("Pick a date", "اختر التاريخ"),
      t(
        "See free days at a glance. Choose a specialty, then a doctor or any available doctor in that specialty.",
        "اختر التخصص، ثم اليوم المناسب وطبيباً من التخصص أو اترك الاختيار للعيادة.",
      ),
    ],
    [
      t("Pick a time", "اختر الوقت"),
      t(
        "Morning and afternoon slots. Taken times are greyed out, so you never double book.",
        "مواعيد صباحية ومسائية. الأوقات المحجوزة غير قابلة للاختيار.",
      ),
    ],
    [
      t("Send your request", "أرسل طلبك"),
      t(
        "Enter your details and verify your phone. The clinic assigns a doctor and confirms by message.",
        "أدخل بياناتك وتحقق من هاتفك. ستعيّن العيادة الطبيب وتؤكد موعدك برسالة.",
      ),
    ],
  ]
    .map(
      ([name, text], i) =>
        `<article class="step-card ${i === 1 ? "featured" : ""}"><span class="step-number">0${i + 1}</span><h3>${name}</h3><p>${text}</p></article>`,
    )
    .join("")}</div></section>
  <section class="container landing-section doctors-section" id="doctors"><div class="section-heading"><h2>${t("Meet your doctors", "تعرف على أطبائنا")}</h2>${button(t("See all", "عرض الجميع"), "all-doctors", "", "pill outline")}</div><div class="three-grid"><article><img class="doctor-photo" src="assets/dr-omar.png" width="397" height="460" alt="${t("Dr. Omar Haddad", "د. عمر حداد")}" loading="lazy"><div class="doctor-caption"><h3>${t("Dr. Omar Haddad", "د. عمر حداد")}</h3><p>${spec("dermatology")}</p></div></article><article><img class="doctor-photo" src="assets/dr-layla.png" width="397" height="460" alt="${t("Dr. Layla Khoury", "د. ليلى خوري")}" loading="lazy"><div class="doctor-caption"><h3>${t("Dr. Layla Khoury", "د. ليلى خوري")}</h3><p>${spec("pediatrics")}</p></div></article><article class="any-doctor"><span class="eyebrow">${t("Not sure who to see?", "لست متأكداً من الطبيب المناسب؟")}</span><h3>${t("Any available doctor", "أي طبيب متاح")}</h3><p>${t("Choose your specialty and leave the doctor open. The clinic will assign the right one for your visit.", "اختر التخصص واترك اختيار الطبيب للعيادة، وسنحدد الطبيب المناسب لزيارتك.")}</p><div><a class="btn pill white" href="#/book/specialty">${t("Book a visit", "احجز زيارة")}</a></div></article></div></section>
  <section class="container landing-section about-grid" id="about"><div class="about-copy"><span class="eyebrow">${t("About the clinic", "عن العيادة")}</span><h2>${t("A modern clinic, built around your time.", "عيادة حديثة تراعي وقتك.")}</h2><p>${t("CareSlot Clinic brings general medicine and specialist care together in one place in Amman. Our doctors see patients by appointment, so you spend less time waiting and more time being seen. Book online, or call us and the team will book for you.", "تجمع عيادة كيرسلوت الطب العام والرعاية التخصصية في مكان واحد في عمّان. نعمل بنظام المواعيد لتقضي وقتاً أقل في الانتظار. احجز عبر الإنترنت أو اتصل بفريق العيادة.")}</p></div><div class="stat-grid">${[
    ["12+", t("Years of care", "سنوات من الرعاية")],
    ["8", t("Doctors", "أطباء")],
    ["6", t("Specialties", "تخصصات")],
    ["20k+", t("Patients seen", "مريض")],
  ]
    .map(
      ([n, label]) =>
        `<div class="stat-card"><strong>${n}</strong><span>${label}</span></div>`,
    )
    .join("")}</div></section>
  <section class="container landing-section" id="services"><div class="section-heading"><h2>${t("What we treat", "تخصصاتنا")}</h2><p>${t("Pick a doctor by specialty, or leave it open and the clinic will assign one.", "اختر الطبيب حسب التخصص أو اترك الاختيار للعيادة.")}</p></div><div class="service-grid">${services}</div></section>
  <section class="container landing-section" id="visit"><div class="clinic-contact-card"><h2>${t("Find the clinic", "موقع العيادة")}</h2><div class="clinic-contact-details"><div class="contact-block"><small>${t("Address", "العنوان")}</small><p>${t("CareSlot Clinic, Building 12, Al-Rainbow Street, Jabal Amman, Amman", "عيادة كيرسلوت، مبنى ١٢، شارع الرينبو، جبل عمّان، عمّان")}</p></div><div class="contact-block"><small>${t("Opening hours", "ساعات العمل")}</small><p>${t("Sunday to Thursday, 09:00 to 17:00", "الأحد إلى الخميس، 09:00–17:00")}<br>${t("Saturday, 10:00 to 14:00", "السبت، 10:00–14:00")}<br>${t("Friday closed", "الجمعة مغلق")}</p></div><div class="contact-block"><small>${t("Phone", "الهاتف")}</small><a class="ltr" href="tel:+96265550100">+962 6 555 0100</a></div><div class="contact-block"><small>${t("Email", "البريد الإلكتروني")}</small><a href="mailto:hello@careslot.example">hello@careslot.example</a></div></div><a class="btn" href="https://www.google.com/maps/search/?api=1&query=Building%2012%20Al-Rainbow%20Street%20Jabal%20Amman%20Amman" target="_blank" rel="noopener">${t("Open address in Google Maps", "فتح العنوان في خرائط Google")}</a></div></section>
  <section class="container landing-section"><div class="final-cta"><div><h2>${t("Your next visit starts here.", "زيارتك القادمة تبدأ هنا.")}</h2><p>${t("Choose a convenient time, verify your phone, and send your request. We’ll message you when the clinic confirms.", "اختر الوقت المناسب، وتحقق من هاتفك وأرسل طلبك. سنرسل لك رسالة عند تأكيد العيادة.")}</p><a class="btn" href="#/book/specialty">${t("Book a visit", "احجز زيارة")}</a></div><img src="assets/clinic-consultation.png" width="320" height="400" alt="${t("Care at CareSlot Clinic", "الرعاية في عيادة كيرسلوت")}" loading="lazy"></div></section></main><footer class="container site-footer"><strong>CareSlot</strong><span>${t("Amman · Sun–Thu 09:00–17:00 · Sat 10:00–14:00 · Fri closed", "عمّان · الأحد–الخميس 09:00–17:00 · السبت 10:00–14:00 · الجمعة مغلق")}</span><span>© ${new Date().getFullYear()} CareSlot ·  · </span></footer>`;
}

function specialtyPage() {
  return bookingShell(
    `<h2>${t("What kind of visit?", "ما نوع الزيارة؟")}</h2><p class="muted">${t("Choose a specialty first, then a doctor and date.", "اختر التخصص أولاً، ثم الطبيب والتاريخ.")}</p><div class="specialty-grid">${SPECIALTIES.map((s) => `<button class="specialty-option ${draft.specialty === s.id ? "active" : ""}" data-action="specialty" data-id="${s.id}" aria-pressed="${draft.specialty === s.id}">${s[lang]}${draft.specialty === s.id ? `<span>✓ ${t("Selected", "محدد")}</span>` : ""}</button>`).join("")}</div>${notice(t("Choose any available doctor within your selected specialty, or pick your preferred doctor on the next screen.", "اختر أي طبيب متاح ضمن التخصص المحدد أو اختر طبيبك المفضل في الخطوة التالية."))}<div class="form-actions"><a class="btn full" href="#/book/date">${t("Choose a date", "اختر التاريخ")}</a><a class="btn secondary" href="#/">${t("Back to home", "العودة للرئيسية")}</a></div>`,
  );
}
function calendar() {
  const state = readState(),
    [y, m] = calendarMonth.split("-").map(Number),
    first = `${calendarMonth}-01`,
    days = new Date(Date.UTC(y, m, 0)).getUTCDate(),
    start = weekday(first);
  const heading = new Intl.DateTimeFormat(lang === "ar" ? "ar-JO" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Amman",
  }).format(new Date(first + "T12:00:00Z"));
  const labels =
    lang === "ar"
      ? ["أحد", "اثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `<div class="calendar-header">${button("‹", "month", `data-offset="-1" aria-label="${t("Previous month", "الشهر السابق")}"`, "icon-button")}<strong>${heading}</strong>${button("›", "month", `data-offset="1" aria-label="${t("Next month", "الشهر التالي")}"`, "icon-button")}</div><div class="calendar">${labels.map((s) => `<span class="calendar-label">${s}</span>`).join("")}${Array(start).fill('<span class="calendar-day blank"></span>').join("")}${Array.from(
    { length: days },
    (_, i) => {
      const date = `${calendarMonth}-${String(i + 1).padStart(2, "0")}`;
      const available =
        date >= today() &&
        slotsFor(state, date, draft.specialty, draft.preferredId).some(
          (s) => s.doctors.length,
        );
      return `<button class="calendar-day ${date === draft.date ? "active" : available ? "available" : ""}" ${!available ? "disabled" : ""} data-action="date" data-date="${date}" aria-label="${escape(dateText(date, true))}" aria-pressed="${date === draft.date}">${i + 1}</button>`;
    },
  ).join(
    "",
  )}</div><div class="calendar-legend"><span><i class="dot"></i>${t("Available", "متاح")}</span><span><i class="dot selected"></i>${t("Selected", "محدد")}</span><span>${t("Grey = full or closed", "الرمادي: مغلق أو ممتلئ")}</span></div>`;
}
function datePage() {
  const state = readState();
  return bookingShell(
    `<h2>${t("Pick a date", "اختر التاريخ")}</h2><p class="subheading">${t("Choose a day that works for you.", "اختر اليوم المناسب لك.")}</p><label class="field"><span>${escape(spec(draft.specialty))} · ${t("Preferred doctor (optional)", "الطبيب المفضل (اختياري)")}</span><select id="preferred-doctor"><option value="any">${t("Any available doctor in this specialty", "أي طبيب متاح ضمن هذا التخصص")}</option>${state.doctors
      .filter((d) => d.active && d.specialty === draft.specialty)
      .map(
        (d) =>
          `<option value="${d.id}" ${draft.preferredId === d.id ? "selected" : ""}>${escape(doctorName(d))}</option>`,
      )
      .join(
        "",
      )}</select></label>${calendar()}<div class="form-actions">${button(t("Continue", "متابعة"), "date-continue", "", "full")}<a class="btn secondary" href="#/book/specialty">${t("Change specialty", "تغيير التخصص")}</a></div>`,
  );
}
function timePage() {
  const slots = slotsFor(
      readState(),
      draft.date,
      draft.specialty,
      draft.preferredId,
    ),
    hasSlots = slots.some((s) => s.doctors.length);
  return bookingShell(
    `<h2>${t("Pick a time", "اختر الوقت")}</h2><div class="chip">${escape(dateText(draft.date))} · ${escape(spec(draft.specialty))} <a class="link" href="#/book/date">${t("Change", "تغيير")}</a></div>${
      !hasSlots
        ? `<div class="empty-state"><h3>${t("No free slots on this day", "لا توجد أوقات متاحة في هذا اليوم")}</h3><p>${t("Try the next available day or choose a different doctor.", "جرّب اليوم التالي المتاح أو اختر طبيباً آخر.")}</p>${button(t("Find next available day", "البحث عن اليوم التالي المتاح"), "next-available")}</div>`
        : ["morning", "afternoon"]
            .map((group) => {
              const list = slots.filter((s) =>
                group === "morning" ? s.time < "12:00" : s.time >= "12:00",
              );
              return list.length
                ? `<section class="slot-section"><h3>${group === "morning" ? t("Morning", "صباحاً") : t("Afternoon", "بعد الظهر")}</h3><div class="slots">${list.map((s) => `<button class="slot ${draft.time === s.time ? "active" : ""}" data-action="time" data-time="${s.time}" ${!s.doctors.length ? "disabled" : ""} aria-pressed="${draft.time === s.time}"><bdi>${s.time}</bdi>${!s.doctors.length ? `<span class="visually-hidden"> ${t("Unavailable", "غير متاح")}</span>` : ""}</button>`).join("")}</div></section>`
                : "";
            })
            .join("")
    }<div class="form-actions">${button(t("Continue", "متابعة"), "time-continue", !draft.time ? "disabled" : "", "full")}<a class="btn secondary" href="#/book/date">${t("Back", "رجوع")}</a></div>`,
    2,
  );
}
function detailsPage() {
  return bookingShell(
    `<h2>${t("Your details", "بياناتك")}</h2><div class="summary-inline">${summary()}</div><form id="details-form" class="form-stack">${field(t("Full name *", "الاسم الكامل *"), "name", draft.name, 'required minlength="2" maxlength="100" autocomplete="name" placeholder="' + t("Your full name", "اسمك الكامل") + '"')}${field(t("Phone number *", "رقم الهاتف *"), "phone", draft.phone, 'required type="tel" autocomplete="tel" dir="ltr" placeholder="+962 7X XXX XXXX"')}<label class="field"><span>${t("Note for the clinic (optional)", "ملاحظة للعيادة (اختياري)")}</span><textarea name="note" maxlength="500" placeholder="${t("Add a short note", "أضف ملاحظة قصيرة")}">${escape(draft.note)}</textarea></label><p class="muted" style="font-size:14px">${t("We use your phone number to verify and update your booking. Pay at the clinic.", "نستخدم هاتفك للتحقق وإرسال تحديثات الحجز. الدفع في العيادة.")}</p>${errorBox()}<div class="form-actions"><button class="btn full" type="submit">${t("Continue to verification", "المتابعة للتحقق")}</button><a class="btn secondary" href="#/book/time">${t("Back", "رجوع")}</a></div></form>`,
    3,
  );
}
function verificationField() {
  return field(t("Verification code (6 digits)", "رمز التحقق (٦ أرقام)"), "code", "",
    'required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" class="otp-input"');
}

function verifyPage() {
  return bookingShell(
    `<h2>${t("Verify your phone", "تحقق من هاتفك")}</h2><p class="subheading">${t("Enter the 6-digit verification code for", "أدخل رمز التحقق المكون من ٦ أرقام للهاتف")} <bdi>${escape(draft.phone)}</bdi>.</p><form id="booking-verify" class="form-stack">${verificationField()}${errorBox()}<button class="btn full" type="submit">${t("Verify and send request", "التحقق وإرسال الطلب")}</button><div class="center">${button(t("Resend code", "إعادة إرسال الرمز"), "resend", "", "text-button")} · <a class="link" href="#/book/details">${t("Change number", "تغيير الرقم")}</a></div></form>${demoNote()}`,
    3,
  );
}
function receiptPage(id) {
  const b = readState().bookings.find((b) => b.id === id);
  if (!b) return notFound();
  if (!canAccess(b)) return lookupPage();
  return `${header()}<main class="page-shell narrow" id="main"><section class="panel receipt"><div class="center"><div class="success-icon">✓</div><h1 class="page-title">${t("Booking received", "تم استلام طلب الحجز")}</h1><p class="muted">${t("Booking reference:", "رقم الحجز:")} ${escape(b.id)}</p></div><div class="summary-inline">${summary(b.date, b.time, b.specialty, b.preferredId)}</div>${notice(t("Your request is awaiting clinic confirmation and doctor assignment. Usually confirmed within 2 clinic opening hours.", "طلبك بانتظار تأكيد العيادة وتعيين الطبيب. نؤكد الطلب عادة خلال ساعتين من ساعات العمل."))}<p class="muted">${t("If you haven’t heard from us, call", "إن لم تصلك رسالة، اتصل على")} <a class="link ltr" href="tel:+96265550100">+962 6 555 0100</a>.</p><a class="btn full" href="#/booking/${escape(b.id)}">${t("View my booking", "عرض حجزي")}</a><a class="btn secondary" href="#/">${t("Back to home", "العودة للرئيسية")}</a></section></main>`;
}
function bookingCard(b, actions = true) {
  const state = readState(),
    d = state.doctors.find((d) => d.id === b.doctorId);
  return `<article class="booking-card"><div class="topline"><span>${t("Booking", "الحجز")} ${escape(b.id)}</span>${badge(b.status)}</div><div><h3>${escape(dateText(b.date))}</h3><strong class="ltr" style="color:var(--teal);font-size:21px">${escape(b.time)}</strong></div><div class="divider"></div>${person(d, spec(b.specialty))}<div class="summary-line"><span>${t("Patient", "المريض")}</span><strong>${escape(patientName(b))}</strong></div><div class="summary-line"><span>${t("Clinic", "العيادة")}</span><strong>${t("CareSlot Clinic, Amman", "عيادة كيرسلوت، عمّان")}</strong></div><div class="summary-line"><span>${t("Phone", "الهاتف")}</span><strong class="ltr">${escape(b.phone)}</strong></div>${actions ? `<a class="btn secondary full" href="#/booking/${escape(b.id)}">${t("View booking", "عرض الحجز")}</a>` : ""}</article>`;
}
function bookingPage(id) {
  const b = readState().bookings.find((b) => b.id === id);
  if (!b) return notFound();
  if (!canAccess(b))
    return `${header()}<main class="page-shell narrow" id="main"><section class="panel"><h1 class="page-title">${t("Verify to view your booking", "تحقق لعرض حجزك")}</h1><p class="subheading">${t("Use the phone number from your booking to securely continue.", "استخدم رقم الهاتف المسجل للحجز للمتابعة.")}</p><a class="btn full" href="#/lookup">${t("Find my booking", "العثور على حجزي")}</a></section></main>`;
  return `${header()}<main class="page-shell narrow" id="main"><h1 class="page-title">${t("My booking", "حجزي")}</h1>${bookingCard(b, false)}<div style="margin-top:20px">${notice(b.status === "pending" ? t("Usually confirmed within 2 opening hours. Need help? Call the clinic.", "يؤكد الطلب عادة خلال ساعتين من ساعات العمل. للمساعدة اتصل بالعيادة.") : b.status === "confirmed" ? t("Please arrive 10 minutes early.", "يرجى الحضور قبل الموعد بعشر دقائق.") : t("This appointment is " + b.status + ". You can book another visit at any time.", "يمكنك حجز زيارة جديدة في أي وقت."))}</div><div class="form-actions">${b.status === "confirmed" ? button(t("Add to calendar", "إضافة للتقويم"), "calendar-download", `data-id="${escape(b.id)}"`, "full") : ""}${["pending", "confirmed"].includes(b.status) ? `${button(t("Reschedule", "إعادة الجدولة"), "reschedule", `data-id="${escape(b.id)}"`, "secondary full")}${button(t("Cancel booking", "إلغاء الحجز"), "cancel", `data-id="${escape(b.id)}"`, "ghost full")}` : `<a class="btn" href="#/book/specialty">${t("Book another visit", "احجز زيارة أخرى")}</a>`}<a class="btn secondary full" href="#/lookup">${t("All my bookings", "جميع حجوزاتي")}</a></div></main>`;
}
function lookupPage() {
  let content;
  if (lookupStage === "phone")
    content = `<p class="subheading">${t("Use the phone number from your booking. We’ll verify it before showing your details.", "أدخل رقم الهاتف المستخدم للحجز. سنتحقق منه قبل عرض بياناتك.")}</p><form id="lookup-phone" class="form-stack">${field(t("Phone number", "رقم الهاتف"), "phone", lookupPhone, 'required type="tel" autocomplete="tel" dir="ltr" placeholder="+962 79 123 4567"')}${errorBox()}<button class="btn full" type="submit">${t("Send verification code", "إرسال رمز التحقق")}</button></form><div class="demo-note">${t("Try the sample patient number", "جرّب رقم المريض التجريبي")} <bdi>+962 79 220 4410</bdi> ${t("or the number from a booking you create.", "أو رقم الهاتف الذي استخدمته لحجز جديد.")}</div>`;
  else if (lookupStage === "verify")
    content = `<p class="subheading">${t("Enter the code for", "أدخل الرمز للهاتف")} <bdi>${escape(lookupPhone)}</bdi>.</p><form id="lookup-verify" class="form-stack">${verificationField()}${errorBox()}<button class="btn full" type="submit">${t("View my bookings", "عرض حجوزاتي")}</button>${button(t("Resend code", "إعادة إرسال الرمز"), "resend", "", "secondary")}${button(t("Change phone number", "تغيير رقم الهاتف"), "lookup-reset", "", "change-phone")}</form>${demoNote()}`;
  else
    content = `<p class="subheading">${t("Bookings linked to your verified phone", "الحجوزات المرتبطة برقم هاتفك المتحقق منه")}</p><div class="lookup-list">${lookupResult.length ? lookupResult.map((b) => bookingCard(b)).join("") : `<div class="empty-state"><h3>${t("No bookings found", "لا توجد حجوزات")}</h3><p>${t("There are no bookings for this number. Try another phone number or book a new visit.", "لا توجد حجوزات لهذا الرقم. جرّب رقماً آخر أو احجز زيارة جديدة.")}</p><a class="btn" href="#/book/specialty">${t("Book a visit", "احجز زيارة")}</a></div>`}</div><div class="form-actions">${button(t("Use another phone number", "استخدام رقم آخر"), "lookup-reset", "", "secondary full")}</div>`;
  return `${header()}<main class="page-shell narrow" id="main"><section class="panel"><h1 class="page-title">${t("Find my booking", "العثور على حجزي")}</h1>${content}</section></main>`;
}

function loginPage(recovery = false) {
  return `<main class="login-page" id="main"><section class="login-visual">${brand("#/")}<div><h1>${t("Every reservation, in one place.", "كل الحجوزات في مكان واحد.")}</h1><p>${t("Assign doctors, confirm visits and keep the clinic’s schedule under control.", "عيّن الأطباء وأكد الزيارات ونظّم جدول العيادة.")}</p><ul class="login-features">${[t("New bookings appear instantly", "الحجوزات الجديدة تظهر مباشرة"), t("Assign a doctor in one click", "تعيين الطبيب بنقرة واحدة"), t("Clear daily schedule for every doctor", "جدول يومي واضح لكل طبيب")].map((text) => `<li><img src="assets/login-dot.svg" width="10" height="10" alt="">${text}</li>`).join("")}</ul></div></section><section class="login-content"><div class="login-form"><div style="margin-bottom:32px">${languageButton()}</div><h2>${recovery ? t("Forgot your password?", "نسيت كلمة المرور؟") : (portal === "doctor" ? t("Doctor sign in", "دخول الطبيب") : t("Staff sign in", "دخول الموظفين"))}</h2><p class="muted">${recovery ? t("Enter your email to request a reset link.", "أدخل بريدك الإلكتروني لطلب رابط إعادة التعيين.") : t("Sign in to your clinic workspace.", "سجّل الدخول إلى مساحة عمل العيادة.")}</p>${recovery ? `<form id="recovery-form" class="form-stack" style="margin-top:24px">${field(t("Email address", "البريد الإلكتروني"), "email", "", 'required type="email" autocomplete="email"')}<button class="btn full" type="submit">${t("Send reset link", "إرسال رابط إعادة التعيين")}</button><a class="link" href="#/login">${t("Back to sign in", "العودة لتسجيل الدخول")}</a><div class="demo-note">${t("This frontend demonstration does not send email.", "هذه النسخة التجريبية لا ترسل بريداً إلكترونياً.")}</div></form>` : `<div class="role-buttons"><button class="btn secondary" data-action="demo-role" data-role="${portal}">${t("Fill demo account", "تعبئة الحساب التجريبي")}</button></div><form id="login-form" class="form-stack">${field(t("Email address", "البريد الإلكتروني"), "email", portal + "@careslot.example", 'required type="email" autocomplete="username"')}<div class="field"><label for="login-password">${t("Password", "كلمة المرور")}</label><div class="password-wrap"><input id="login-password" name="password" required type="password" autocomplete="current-password" placeholder="${t("Enter demo password", "أدخل كلمة المرور التجريبية")}"><button type="button" class="password-eye" data-action="toggle-password" aria-controls="login-password" aria-label="${t("Show password", "إظهار كلمة المرور")}"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="m3 3 18 18"/></svg></button></div></div><a class="link" href="#/forgot">${t("Forgot password?", "نسيت كلمة المرور؟")}</a>${errorBox()}<button class="btn full" type="submit">${t("Sign in", "تسجيل الدخول")}</button></form><div class="demo-note">${t("Demo access only. Use", "دخول تجريبي فقط. استخدم")} <strong>demo1234</strong>. ${t("Use the demo account button to fill the form.", "استخدم زر الحساب التجريبي لتعبئة النموذج.")}</div>`}</div></section></main>`;
}
function workspaceShell(content, active) {
  const isDoctor = session.role === "doctor",
    links = isDoctor
      ? [
          ["dashboard", t("My schedule", "جدولي")],
          ["patients", t("My patients", "مرضاي")],
          ["timeoff", t("Time off", "الإجازات")],
          ["settings", t("Account", "الحساب")],
        ]
      : [
          ["dashboard", t("Dashboard", "لوحة التحكم")],
          ["bookings", t("Bookings", "الحجوزات")],
          ["doctors", t("Doctors", "الأطباء")],
          ["availability", t("Availability", "التوفر")],
          ["timeoff", t("Time-off requests", "طلبات الإجازات")],
          ["settings", t("Settings", "الإعدادات")],
        ];
  const doc = readState().doctors.find((d) => d.id === session.doctorId);
  return `<div class="workspace"><aside class="sidebar" id="workspace-sidebar">${brand()}<nav aria-label="${t("Workspace navigation", "قائمة مساحة العمل")}">${links.map(([id, label]) => `<a class="${active === id ? "active" : ""}" href="#/workspace/${id}">${label}</a>`).join("")}</nav><div class="sidebar-profile"><div class="person"><span class="avatar">${isDoctor ? "OH" : "R"}</span><div><strong>${isDoctor ? escape(doctorName(doc)) : t("Reception", "الاستقبال")}</strong><p>${isDoctor ? t("Doctor", "طبيب") : t("Staff", "موظف")}</p></div></div><button class="text-button" data-action="logout" style="color:#c6d8e2;font-size:12px;margin-top:10px">${t("Sign out", "تسجيل الخروج")}</button></div></aside><main class="workspace-main" id="main"><div class="workspace-mobile-top">${brand()}<button class="menu-toggle" data-action="workspace-menu" aria-expanded="false" aria-controls="workspace-sidebar">${t("Menu", "القائمة")}</button></div><div class="demo-banner"><span>${t("Browser demo · Changes are saved on this device only.", "نسخة تجريبية · يتم حفظ التغييرات على هذا الجهاز فقط.")}</span><div>${languageButton()}</div></div>${content}</main></div>`;
}
function workspaceHeading(name, subtitle, actions = "") {
  return `<div class="workspace-header"><div><h1>${name}</h1><p>${subtitle}</p></div><div class="workspace-tools">${actions}</div></div>`;
}
function bookingsTable(bookings, showActions = true) {
  const state = readState();
  return bookings.length
    ? `<div class="table-wrap mobile-cards"><table><thead><tr>${[t("Reference", "المرجع"), t("Time", "الوقت"), t("Patient", "المريض"), t("Phone", "الهاتف"), t("Doctor", "الطبيب"), t("Status", "الحالة"), ...(showActions ? [t("Actions", "الإجراءات")] : [])].map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${bookings
        .map((b) => {
          const d = state.doctors.find((d) => d.id === b.doctorId);
          return `<tr data-open="${escape(b.id)}" tabindex="0"><td data-label="Reference">${escape(b.id)}</td><td data-label="Time"><strong class="ltr">${escape(b.time)}</strong></td><td data-label="Patient">${escape(patientName(b))}</td><td data-label="Phone"><bdi>${escape(b.phone)}</bdi></td><td data-label="Doctor">${d ? escape(doctorName(d)) : `<span class="badge pending">${t("Not assigned", "غير معين")}</span>`}</td><td data-label="Status">${badge(b.status)}</td>${showActions ? `<td data-label="Actions"><div class="table-actions">${b.status === "pending" && assertStaff() ? `<button class="link" data-action="assign" data-id="${escape(b.id)}">${t("Assign doctor", "تعيين طبيب")}</button>` : `<button class="link" data-action="booking-detail" data-id="${escape(b.id)}">${t("View", "عرض")}</button>`}</div></td>` : ""}</tr>`;
        })
        .join("")}</tbody></table></div>`
    : `<div class="empty-state"><h3>${t("No appointments found", "لا توجد مواعيد")}</h3><p>${t("Try a different day or clear your search and filters.", "جرّب يوماً آخر أو امسح البحث والفلاتر.")}</p>${button(t("Clear search and filters", "مسح البحث والفلاتر"), "clear-filters", "", "secondary")}</div>`;
}
function dashboard() {
  const state = readState(),
    isDoctor = session.role === "doctor",
    dayBookings = state.bookings.filter(
      (b) =>
        b.date === staffDay && (!isDoctor || b.doctorId === session.doctorId),
    ),
    pending = dayBookings.filter((b) => b.status === "pending"),
    confirmed = dayBookings.filter((b) => b.status === "confirmed"),
    cancelled = dayBookings.filter((b) => b.status === "cancelled");
  if (isDoctor)
    return (
      workspaceHeading(
        t("My schedule", "جدولي"),
        `${dateText(staffDay, true)} · ${t("Your assigned appointments", "مواعيدك المعينة")}`,
        `<input type="date" value="${staffDay}" id="staff-day" aria-label="${t("Schedule date", "تاريخ الجدول")}">`,
      ) +
      `<div class="lookup-list">${
        dayBookings
          .filter((b) => b.status !== "cancelled")
          .map(
            (b) =>
              `<article class="work-card"><div class="work-card-heading"><h2><bdi>${escape(b.time)}</bdi> · ${escape(patientName(b))}</h2>${badge(b.status)}</div><p class="muted">${escape(spec(b.specialty))} · ${state.duration} ${t("min", "دقيقة")}</p><div class="form-actions">${button(t("View assigned patient", "عرض المريض المعين"), "booking-detail", `data-id="${escape(b.id)}"`, "secondary")}</div></article>`,
          )
          .join("") ||
        `<div class="empty-state"><h3>${t("No appointments today", "لا توجد مواعيد اليوم")}</h3><p>${t("Your schedule is clear. Choose another date to see your appointments.", "جدولك فارغ لهذا اليوم. اختر تاريخاً آخر لعرض المواعيد.")}</p></div>`
      }${notice(t("Need time away? Request time off. Clinic staff review your request before availability changes.", "تحتاج إلى إجازة؟ أرسل طلباً وسيراجعه موظفو العيادة قبل تغيير المواعيد."))}<a class="btn" href="#/workspace/timeoff">${t("Request time off", "طلب إجازة")}</a></div>`
    );
  return (
    workspaceHeading(
      t("Today", "اليوم"),
      `${dateText(staffDay, true)} · ${dayBookings.length} ${t("bookings", "حجوزات")}`,
      `<input type="date" id="staff-day" value="${staffDay}" aria-label="${t("Dashboard date", "تاريخ لوحة التحكم")}">${button(t("New booking", "حجز جديد"), "new-booking")}`,
    ) +
    `<section class="metrics" aria-label="${t("Daily metrics", "إحصاءات اليوم")}">${[
      [t("Bookings today", "حجوزات اليوم"), dayBookings.length],
      [t("Need a doctor", "بحاجة لطبيب"), pending.length],
      [t("Confirmed", "مؤكدة"), confirmed.length],
      [t("Cancelled", "ملغاة"), cancelled.length],
    ]
      .map(
        ([label, n], i) =>
          `<article class="metric ${i === 1 ? "warning" : ""}"><p>${label}</p><strong>${n}</strong></article>`,
      )
      .join(
        "",
      )}</section><div class="dashboard-panels"><section class="work-card"><div class="work-card-heading"><h2>${t("Needs a doctor", "بحاجة إلى طبيب")}</h2><span class="badge pending">${pending.length} ${t("new", "جديد")}</span></div>${pending.map((b) => `<div class="pending-row"><strong class="ltr">${b.time}</strong><div class="person"><div><strong>${escape(patientName(b))}</strong><small>${escape(spec(b.specialty))} · <bdi>${escape(b.phone)}</bdi></small></div></div>${button(t("Assign doctor", "تعيين طبيب"), "assign", `data-id="${escape(b.id)}"`, "warning small")}</div>`).join("") || `<p class="muted">${t("All bookings have a doctor assigned.", "جميع الحجوزات لها طبيب معين.")}</p>`}</section><section class="work-card"><h2>${t("Doctors today", "أطباء اليوم")}</h2>${state.doctors
      .filter((d) => d.active)
      .slice(0, 3)
      .map(
        (d) =>
          `<div class="doctor-row">${person(d, spec(d.specialty))}<span class="badge completed">${dayBookings.filter((b) => b.doctorId === d.id).length} ${t("bookings", "حجوزات")}</span></div>`,
      )
      .join(
        "",
      )}</section></div><section class="work-card"><div class="work-card-heading"><h2>${t("Today’s schedule", "جدول اليوم")}</h2><a class="link" href="#/workspace/bookings">${t("View all bookings", "جميع الحجوزات")}</a></div>${bookingsTable(dayBookings.sort((a, b) => a.time.localeCompare(b.time)))}</section>`
  );
}
function bookingList() {
  const state = readState();
  let rows = state.bookings.filter(
    (b) =>
      (staffFilter === "all" || b.status === staffFilter) &&
      `${b.name} ${patientName(b)} ${b.phone} ${b.id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    workspaceHeading(
      t("Bookings", "الحجوزات"),
      t(
        "All reservations from the patient site",
        "جميع الحجوزات من موقع المرضى",
      ),
      button(t("Export CSV", "تصدير CSV"), "export", "", "secondary") +
        button(t("New booking", "حجز جديد"), "new-booking"),
    ) +
    `<div class="tabs">${["all", "pending", "confirmed", "completed", "cancelled"].map((status) => `<button class="tab ${staffFilter === status ? "active" : ""}" data-action="filter" data-filter="${status}">${status === "all" ? t("All", "الكل") : { pending: t("Needs doctor", "بحاجة لطبيب"), confirmed: t("Confirmed", "مؤكد"), completed: t("Completed", "مكتمل"), cancelled: t("Cancelled", "ملغى") }[status]} <span>${status === "all" ? state.bookings.length : state.bookings.filter((b) => b.status === status).length}</span></button>`).join("")}</div><div class="filters"><input id="booking-search" type="search" placeholder="${t("Search patient, phone or reference", "ابحث بالاسم أو الهاتف أو المرجع")}" value="${escape(search)}" aria-label="${t("Search bookings", "البحث في الحجوزات")}"></div><div id="booking-table">${bookingsTable(rows.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)))}</div>`
  );
}
function doctorsPage() {
  const state = readState();
  return (
    workspaceHeading(
      t("Doctors", "الأطباء"),
      t(
        "Manage the clinic’s doctors and their schedules",
        "إدارة أطباء العيادة وجداولهم",
      ),
      button(t("Add doctor", "إضافة طبيب"), "edit-doctor"),
    ) +
    `<div class="table-wrap doctor-directory"><table><thead><tr><th>${t("Doctor", "الطبيب")}</th><th>${t("Specialty", "التخصص")}</th><th>${t("Working days", "أيام العمل")}</th><th>${t("Upcoming bookings", "الحجوزات القادمة")}</th><th>${t("Active", "نشط")}</th><th></th></tr></thead><tbody>${state.doctors.map((d) => `<tr class="directory-card-row"><td>${person(d)}</td><td>${spec(d.specialty)}</td><td>${t("Sun–Thu, Sat", "الأحد–الخميس، السبت")}</td><td>${state.bookings.filter((b) => b.doctorId === d.id && b.date >= today() && b.status === "confirmed").length} ${t("bookings", "حجوزات")}</td><td><button class="switch-button" role="switch" aria-checked="${d.active}" aria-label="${escape(t("Accept bookings for ", "استقبال الحجوزات للطبيب ") + doctorName(d))}" data-action="toggle-doctor" data-id="${d.id}"><img src="assets/toggle-${d.active ? "on" : "off"}.svg" width="42" height="24" alt=""></button></td><td>${button(t("Edit", "تعديل"), "edit-doctor", `data-id="${d.id}"`, "small secondary")}</td></tr>`).join("")}</tbody></table></div>`
  );
}
function availabilityPage() {
  const s = readState();
  return (
    workspaceHeading(
      t("Availability settings", "إعدادات التوفر"),
      t(
        "Set clinic hours and manage time-off requests",
        "تعيين ساعات العمل وإدارة طلبات الإجازات",
      ),
    ) +
    `<div class="settings-grid"><form id="hours-form" class="work-card form-stack"><h2>${t("Clinic opening hours", "ساعات عمل العيادة")}</h2><p class="muted">${t("Sunday–Thursday", "الأحد–الخميس")}</p><div class="field-row">${field(t("Opens", "يفتح"), "open", s.hours.open, 'required type="time" step="1800"')}${field(t("Closes", "يغلق"), "close", s.hours.close, 'required type="time" step="1800"')}</div><p class="muted">${t("Saturday", "السبت")}</p><div class="field-row">${field(t("Opens", "يفتح"), "saturdayOpen", s.hours.saturdayOpen, 'required type="time" step="1800"')}${field(t("Closes", "يغلق"), "saturdayClose", s.hours.saturdayClose, 'required type="time" step="1800"')}</div>${notice(t("Friday is closed. Existing appointments must fit within the new opening hours.", "الجمعة مغلق. يجب أن تقع المواعيد الحالية ضمن ساعات العمل الجديدة."))}${errorBox()}<button type="submit" class="btn">${t("Save availability", "حفظ التوفر")}</button></form><section class="work-card"><h2>${t("Time-off requests", "طلبات الإجازات")}</h2><p class="muted">${t("Approve requests after resolving any affected appointments.", "وافق على الطلبات بعد معالجة المواعيد المتأثرة.")}</p><div class="form-actions"><a href="#/workspace/timeoff" class="btn secondary">${t("Review requests", "مراجعة الطلبات")}</a></div></section></div>`
  );
}
function timeOffPage() {
  const s = readState(),
    doctor = session.role === "doctor";
  const requests = s.timeOff.filter(
    (r) => !doctor || r.doctorId === session.doctorId,
  );
  return (
    workspaceHeading(
      t("Time off", "الإجازات"),
      doctor
        ? t(
            "Request days when you are not available",
            "طلب أيام لا تكون متاحاً فيها",
          )
        : t("Review doctor time-off requests", "مراجعة طلبات إجازات الأطباء"),
    ) +
    `${
      doctor
        ? `<form id="timeoff-form" class="work-card form-stack" style="max-width:760px;margin-bottom:24px"><h2>${t("New request", "طلب جديد")}</h2><div class="field-row">${field(t("From", "من"), "from", today(), 'required type="date" min="' + today() + '"')}${field(t("To", "إلى"), "to", addDays(today(), 1), 'required type="date" min="' + today() + '"')}</div><label class="field"><span>${t("Type", "النوع")}</span><div class="leave-types">${[
            ["Vacation", t("Vacation", "عطلة")],
            ["Sick leave", t("Sick leave", "إجازة مرضية")],
            ["Other", t("Other", "أخرى")],
          ]
            .map(
              ([value, label], i) =>
                `<label><input type="radio" name="type" value="${value}" ${i === 0 ? "checked" : ""}><span>${label}</span></label>`,
            )
            .join(
              "",
            )}</div></label>${field(t("Note (optional)", "ملاحظة (اختياري)"), "note", "", 'maxlength="200"')}<div class="notice warning notice-with-dot"><img src="assets/selection-dot.svg" width="10" height="10" alt=""><span>${t("Clinic staff review the request and resolve affected appointments before approval.", "يراجع موظفو العيادة الطلب ويعالجون المواعيد المتأثرة قبل الموافقة.")}</span></div>${errorBox()}<button class="btn" type="submit">${t("Send request", "إرسال الطلب")}</button></form>`
        : ""
    }<section class="work-card"><h2>${t("Requests", "الطلبات")}</h2>${requests.length ? `<div class="table-wrap"><table><thead><tr><th>${t("Doctor", "الطبيب")}</th><th>${t("Dates", "التواريخ")}</th><th>${t("Type", "النوع")}</th><th>${t("Status", "الحالة")}</th>${!doctor ? "<th>" + t("Actions", "الإجراءات") + "</th>" : ""}</tr></thead><tbody>${requests.map((r) => `<tr><td>${escape(doctorName(s.doctors.find((d) => d.id === r.doctorId)))}</td><td>${dateText(r.from)} – ${dateText(r.to)}</td><td>${escape(r.type)}</td><td>${badge(r.status)}</td>${!doctor ? `<td>${r.status === "pending" ? `${button(t("Approve", "موافقة"), "timeoff-decision", `data-id="${r.id}" data-status="approved"`, "small")}${button(t("Decline", "رفض"), "timeoff-decision", `data-id="${r.id}" data-status="declined"`, "small secondary")}` : ""}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : `<p class="muted">${t("No time-off requests yet.", "لا توجد طلبات إجازة حتى الآن.")}</p>`}</section>`
  );
}
function patientsPage() {
  const s = readState(),
    rows = s.bookings.filter((b) => b.doctorId === session.doctorId);
  return (
    workspaceHeading(
      t("My patients", "مرضاي"),
      t(
        "Patient details for your assigned appointments only",
        "بيانات مرضى مواعيدك المعينة فقط",
      ),
    ) + bookingsTable(rows)
  );
}
function settingsPage() {
  const s = readState();
  return (
    workspaceHeading(
      t("Account settings", "إعدادات الحساب"),
      t("Manage your workspace preferences", "إدارة تفضيلات مساحة العمل"),
    ) +
    `<form id="settings-form" class="work-card form-stack" style="max-width:650px">${field(t("Display name", "الاسم"), "name", session.role === "doctor" ? doctorName(s.doctors.find((d) => d.id === session.doctorId)) : s.settings.clinicName, 'required maxlength="100"')}${session.role === "staff" ? field(t("Consultation fee (JOD)", "رسوم الزيارة (د.أ)"), "fee", s.fee, 'required type="number" min="0" max="1000" step="0.5"') : ""}<label class="field"><span>${t("Language", "اللغة")}</span><select name="language"><option value="en" ${lang === "en" ? "selected" : ""}>English</option><option value="ar" ${lang === "ar" ? "selected" : ""}>العربية</option></select></label>${errorBox()}<button class="btn" type="submit">${t("Save changes", "حفظ التغييرات")}</button><div class="demo-note">${t("Changes are saved in this browser. This demonstration has no server authentication or live patient data.", "يتم حفظ التغييرات في هذا المتصفح. لا تحتوي النسخة التجريبية على مصادقة خادم أو بيانات مرضى حقيقية.")}</div></form>`
  );
}
function workspacePage(section) {
  if (!session) return loginPage();
  const doctor = session.role === "doctor";
  if (
    doctor &&
    !["dashboard", "patients", "timeoff", "settings"].includes(section)
  )
    return workspaceShell(
      `<section class="work-card"><h1 class="page-title">${t("This action is managed by clinic staff", "هذا الإجراء متاح لموظفي العيادة")}</h1><p class="subheading">${t("Your doctor account can view assigned patients and request time off.", "يمكن لحساب الطبيب عرض المرضى المعينين وطلب الإجازات.")}</p><a class="btn" href="#/workspace/dashboard">${t("Back to my schedule", "العودة إلى جدولي")}</a></section>`,
      "dashboard",
    );
  const renderer =
    {
      dashboard,
      bookings: bookingList,
      doctors: doctorsPage,
      availability: availabilityPage,
      timeoff: timeOffPage,
      patients: patientsPage,
      settings: settingsPage,
    }[section] || dashboard;
  return workspaceShell(renderer(), section);
}
function notFound() {
  return `${header()}<main class="page-shell narrow" id="main"><div class="empty-state"><h1 class="page-title">${t("Page not found", "الصفحة غير موجودة")}</h1><p>${t("Let’s get you back to the clinic.", "لنعد إلى موقع العيادة.")}</p><a class="btn" href="#/">${t("Back to home", "العودة للرئيسية")}</a></div></main>`;
}
function render() {
  const focused = document.activeElement;
  const restoreSelector = focused?.matches("[data-action=date], [data-action=time], [data-action=month], [data-action=specialty]")
    ? `[data-action="${focused.dataset.action}"]${focused.dataset.date ? `[data-date="${focused.dataset.date}"]` : focused.dataset.time ? `[data-time="${focused.dataset.time}"]` : focused.dataset.offset ? `[data-offset="${focused.dataset.offset}"]` : `[data-id="${focused.dataset.id}"]`}` : null;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelector(".skip-link").textContent = t("Skip to content", "انتقل إلى المحتوى");
  if (modal.open) modal.close();
  const path = route(),
    parts = path.split("/").filter(Boolean);
  if (
    parts[0] === "book" &&
    !["specialty", "date"].includes(parts[1]) &&
    !draft.date
  ) {
    go("/book/date");
    return;
  }
  if (
    parts[0] === "book" &&
    ["details", "verify"].includes(parts[1]) &&
    !draft.time
  ) {
    go("/book/time");
    return;
  }
  if (
    parts[0] === "book" &&
    parts[1] === "verify" &&
    (!isValidName(draft.name) || !normalizePhone(draft.phone))
  ) {
    go("/book/details");
    return;
  }
  const screens = {
    specialty: specialtyPage,
    date: datePage,
    time: timePage,
    details: detailsPage,
    verify: verifyPage,
  };
  if (portal && !["workspace", "login", "forgot"].includes(parts[0])) {
    location.replace("#" + (session ? "/workspace/dashboard" : "/login"));
    return;
  }
  if (!portal && ["workspace", "login", "forgot"].includes(parts[0])) {
    const previousRole = getSession("careslot.auth")?.role;
    const destination = previousRole === "doctor" ? "doctor" : "staff";
    location.replace(destination + ".html#" + path);
    return;
  }
  if (path === "/") {
    app.innerHTML = landing();
    title(t("Book your next visit with ease", "احجز زيارتك القادمة بسهولة"));
  } else if (parts[0] === "book") {
    app.innerHTML = (screens[parts[1]] || specialtyPage)();
    title(t("Book a visit", "احجز زيارة"));
  } else if (parts[0] === "receipt") {
    app.innerHTML = receiptPage(parts[1]);
    title(t("Booking received", "تم استلام الحجز"));
  } else if (parts[0] === "booking") {
    app.innerHTML = bookingPage(parts[1]);
    title(t("My booking", "حجزي"));
  } else if (parts[0] === "lookup") {
    if (lookupStage === "results" && !isVerified(lookupPhone))
      lookupStage = "phone";
    if (lookupStage === "results")
      lookupResult = readState()
        .bookings.filter((b) => b.phone === lookupPhone)
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
        );
    app.innerHTML = lookupPage();
    title(t("Find my booking", "العثور على حجزي"));
  } else if (parts[0] === "login" || parts[0] === "forgot") {
    app.innerHTML = loginPage(parts[0] === "forgot");
    title(t("Staff sign in", "دخول الموظفين"));
  } else if (parts[0] === "workspace") {
    app.innerHTML = workspacePage(parts[1] || "dashboard");
    title(t("Clinic workspace", "مساحة عمل العيادة"));
  } else app.innerHTML = notFound();
  renderChat();
  updateResendButtons();
  if (restoreSelector) document.querySelector(restoreSelector)?.focus({ preventScroll: true });
  const anchor = location.hash.slice(1);
  if (anchor && !anchor.startsWith("/"))
    requestAnimationFrame(() =>
      document.getElementById(anchor)?.scrollIntoView(),
    );
}

function openModal(content) {
  lastFocus = document.activeElement;
  modal.innerHTML = content;
  modal.showModal();
  setTimeout(() => modal.querySelector("input,select,button")?.focus(), 30);
}
function modalHeader(label) {
  return `<div class="modal-header"><h2>${label}</h2><button class="icon-button" data-action="close-modal" aria-label="${t("Close dialog", "إغلاق النافذة")}">×</button></div>`;
}
function canAccess(b) {
  return (
    b &&
    (assertStaff() ||
      (session?.role === "doctor" && b.doctorId === session.doctorId) ||
      isVerified(b.phone))
  );
}
function showBookingDetails(id) {
  const s = readState(),
    b = s.bookings.find((b) => b.id === id);
  if (!canAccess(b)) {
    toast(
      t(
        "Please verify your phone to view this booking.",
        "يرجى التحقق من هاتفك لعرض الحجز.",
      ),
    );
    return;
  }
  openModal(
    modalHeader(`${t("Booking", "الحجز")} ${escape(b.id)}`) +
      bookingCard(b, false) +
      `<p class="muted" style="margin-top:20px">${escape(b.note || t("No note provided.", "لا توجد ملاحظات."))}</p><div class="modal-actions">${session?.role === "doctor" ? `${b.status === "confirmed" ? button(t("Mark as completed", "تحديد كمكتمل"), "complete", `data-id="${b.id}"`) : ""}` : assertStaff() && ["pending", "confirmed"].includes(b.status) ? `${button(t("Cancel booking", "إلغاء الحجز"), "cancel", `data-id="${b.id}"`, "ghost")}${button(t("Reschedule", "إعادة الجدولة"), "reschedule", `data-id="${b.id}"`, "secondary")}${b.status === "pending" ? button(t("Assign doctor", "تعيين طبيب"), "assign", `data-id="${b.id}"`) : ""}` : ""}</div>`,
  );
}
function assignModal(id) {
  if (!assertStaff()) return;
  const s = readState(),
    b = s.bookings.find((b) => b.id === id);
  if (!b || b.status !== "pending") return;
  const doctors = availableDoctors(s, b.date, b.time, b.specialty, "any", b.id);
  openModal(
    modalHeader(t("Assign a doctor", "تعيين طبيب")) +
      `<p class="subheading">${escape(patientName(b))} · ${escape(spec(b.specialty))} · ${dateText(b.date)} · <bdi>${b.time}</bdi></p>${doctors.length ? `<form id="assign-form" class="form-stack" data-id="${b.id}"><label class="field"><span>${t("Available doctors in this specialty", "الأطباء المتاحون ضمن التخصص")}</span><select name="doctorId">${doctors.map((d) => `<option value="${d.id}">${escape(doctorName(d))} · ${escape(spec(d.specialty))}</option>`).join("")}</select></label>${notice(t("Assigning a doctor confirms this appointment. This demo does not send messages.", "يؤكد تعيين الطبيب هذا الموعد. لا ترسل النسخة التجريبية رسائل."))}${errorBox()}<button class="btn full" type="submit">${t("Assign and confirm", "تعيين وتأكيد")}</button></form>` : `${notice(t("No doctor in this specialty is available for the full visit. Choose another time; this request remains pending.", "لا يوجد طبيب متاح ضمن التخصص لمدة الزيارة. اختر وقتاً آخر؛ سيبقى الطلب معلقاً."), "warning")}<div class="form-actions">${button(t("Find another time", "البحث عن وقت آخر"), "reschedule", `data-id="${b.id}"`, "full")}</div>`}`,
  );
}
function cancelModal(id) {
  const b = readState().bookings.find((b) => b.id === id);
  if (
    !canAccess(b) ||
    session?.role === "doctor" ||
    !["pending", "confirmed"].includes(b.status)
  )
    return;
  openModal(
    modalHeader(t("Cancel this booking?", "إلغاء هذا الحجز؟")) +
      `<p>${dateText(b.date)} ${t("at", "الساعة")} <bdi>${b.time}</bdi>. ${t("The time will be released. You can book again any time.", "سيصبح الوقت متاحاً للحجز. يمكنك الحجز مجدداً في أي وقت.")}</p><form id="cancel-form" data-id="${b.id}" class="form-stack" style="margin-top:24px"><label class="field"><span>${t("Why are you cancelling? (optional)", "سبب الإلغاء (اختياري)")}</span><select name="reason"><option value="">${t("Select a reason", "اختر السبب")}</option><option>${t("Can’t make it", "لا أستطيع الحضور")}</option><option>${t("Booked by mistake", "تم الحجز بالخطأ")}</option><option>${t("Other", "أخرى")}</option></select></label><div class="modal-actions">${button(t("Keep booking", "الإبقاء على الحجز"), "close-modal", "", "secondary")}<button class="btn danger" type="submit">${t("Yes, cancel booking", "نعم، إلغاء الحجز")}</button></div></form>`,
  );
}
function rescheduleModal(id, selectedDate, selectedTime) {
  const s = readState(),
    b = s.bookings.find((b) => b.id === id);
  if (
    !canAccess(b) ||
    session?.role === "doctor" ||
    !["pending", "confirmed"].includes(b.status)
  )
    return;
  const date = selectedDate || b.date;
  const available = slotsFor(
    s,
    date,
    b.specialty,
    b.doctorId || b.preferredId || "any",
    id,
  ).filter((s) => s.doctors.length);
  openModal(
    modalHeader(t("Reschedule booking", "إعادة جدولة الحجز")) +
      `<p class="subheading">${t("Current booking:", "الحجز الحالي:")} ${dateText(b.date)} · <bdi>${b.time}</bdi></p><form id="reschedule-form" data-id="${b.id}" class="form-stack">${field(t("New date", "التاريخ الجديد"), "date", date, `required type="date" min="${today()}" id="reschedule-date" data-id="${b.id}"`)}<label class="field"><span>${t("New time", "الوقت الجديد")}</span><select name="time" required ${!available.length ? "disabled" : ""}>${available.length ? available.map((slot) => `<option value="${slot.time}" ${slot.time === selectedTime ? "selected" : ""}>${slot.time}</option>`).join("") : `<option value="">${t("No slots on this day", "لا توجد أوقات متاحة")}</option>`}</select></label>${notice(t("Your current booking stays in place until the new time is saved.", "يبقى حجزك الحالي كما هو حتى يتم حفظ الوقت الجديد."))}${errorBox()}<div class="modal-actions">${button(t("Keep current booking", "الإبقاء على الحجز الحالي"), "close-modal", "", "secondary")}<button class="btn" type="submit" ${!available.length ? "disabled" : ""}>${t("Confirm new time", "تأكيد الوقت الجديد")}</button></div></form>`,
  );
}
function doctorModal(id) {
  if (!assertStaff()) return;
  const d = readState().doctors.find((d) => d.id === id);
  openModal(
    modalHeader(
      d ? t("Edit doctor", "تعديل الطبيب") : t("Add doctor", "إضافة طبيب"),
    ) +
      `<form id="doctor-form" data-id="${escape(id || "")}" class="form-stack">${field(t("Doctor name", "اسم الطبيب"), "name", d?.name || "", 'required maxlength="100"')}${field(t("Arabic name", "الاسم بالعربية"), "ar", d?.ar || "", 'required maxlength="100"')}<label class="field"><span>${t("Specialty", "التخصص")}</span><select name="specialty">${SPECIALTIES.map((s) => `<option value="${s.id}" ${d?.specialty === s.id ? "selected" : ""}>${s[lang]}</option>`).join("")}</select></label><label class="toggle"><input type="checkbox" name="active" ${!d || d.active ? "checked" : ""}>${t("Accept new appointments", "استقبال مواعيد جديدة")}</label>${errorBox()}<button class="btn full" type="submit">${t("Save doctor", "حفظ الطبيب")}</button></form>`,
  );
}
function newBookingModal() {
  if (!assertStaff()) return;
  openModal(
    modalHeader(t("New booking", "حجز جديد")) +
      `<form id="staff-booking-form" class="form-stack">${field(t("Patient name", "اسم المريض"), "name", "", 'required minlength="2" maxlength="100"')}${field(t("Phone number", "رقم الهاتف"), "phone", "", 'required type="tel" dir="ltr" placeholder="+962 79 123 4567"')}<label class="field"><span>${t("Specialty", "التخصص")}</span><select name="specialty" id="new-booking-specialty">${SPECIALTIES.map((s) => `<option value="${s.id}">${s[lang]}</option>`).join("")}</select></label>${field(t("Date", "التاريخ"), "date", staffDay, `required type="date" min="${today()}" id="new-booking-date"`)}<label class="field"><span>${t("Available time", "الوقت المتاح")}</span><select name="time" id="new-booking-time" required></select></label>${errorBox()}<button class="btn full" type="submit">${t("Create confirmed booking", "إنشاء حجز مؤكد")}</button></form>`,
  );
  refreshStaffSlots();
}
function refreshStaffSlots() {
  const form = document.querySelector("#staff-booking-form");
  if (!form) return;
  const list = slotsFor(
    readState(),
    form.elements.date.value,
    form.elements.specialty.value,
  ).filter((s) => s.doctors.length);
  form.elements.time.innerHTML = list.length
    ? list.map((s) => `<option>${s.time}</option>`).join("")
    : `<option value="">${t("No available times", "لا توجد أوقات متاحة")}</option>`;
  form.querySelector("[type=submit]").disabled = !list.length;
}

function downloadFile(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function calendarDownload(id) {
  const s = readState(),
    b = s.bookings.find((b) => b.id === id);
  if (!canAccess(b) || b.status !== "confirmed") return;
  const start = new Date(b.date + "T" + b.time + ":00+03:00"),
    end = new Date(start.getTime() + s.duration * 60000);
  const stamp = (d) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  downloadFile(
    `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//CareSlot//Appointments//EN\r\nBEGIN:VEVENT\r\nUID:${b.id}@careslot.local\r\nDTSTAMP:${stamp(new Date())}\r\nDTSTART:${stamp(start)}\r\nDTEND:${stamp(end)}\r\nSUMMARY:CareSlot consultation\r\nLOCATION:CareSlot Clinic - Jabal Amman\r\nDESCRIPTION:Booking ${b.id}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`,
    b.id + ".ics",
    "text/calendar",
  );
}
function exportCSV() {
  if (!assertStaff()) return;
  const encode = (v) => {
    let s = String(v ?? "");
    if (/^[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const rows = [
    [
      "Reference",
      "Patient",
      "Phone",
      "Date",
      "Time",
      "Specialty",
      "Doctor",
      "Status",
    ],
    ...readState().bookings.map((b) => [
      b.id,
      b.name,
      b.phone,
      b.date,
      b.time,
      b.specialty,
      b.doctorId || "",
      b.status,
    ]),
  ];
  downloadFile(
    "\ufeff" + rows.map((r) => r.map(encode).join(",")).join("\r\n"),
    "careslot-bookings.csv",
    "text/csv;charset=utf-8",
  );
}
function updateResendButtons() {
  document.querySelectorAll("[data-action=resend]").forEach((b) => {
    const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    b.disabled = remaining > 0;
    b.textContent = remaining
      ? `${t("Resend in", "إعادة الإرسال خلال")} 0:${String(remaining).padStart(2, "0")}`
      : t("Resend code", "إعادة إرسال الرمز");
  });
}
function startResendTimer() {
  resendAt = Date.now() + 42000;
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    updateResendButtons();
    if (Date.now() >= resendAt) clearInterval(resendTimer);
  }, 1000);
  updateResendButtons();
}
function captureDraftFields() {
  const form = document.querySelector("#details-form");
  if (form) {
    const f = new FormData(form);
    draft = {
      ...draft,
      name: String(f.get("name") || ""),
      phone: String(f.get("phone") || ""),
      note: String(f.get("note") || ""),
    };
    saveDraft();
  }
}
function openChat() {
  captureDraftFields();
  lastFocus = document.activeElement;
  chatOpen = true;
  if (!chatMessages.length) chatWelcome();
  else renderChat();
  setTimeout(() => document.querySelector("#chat-input")?.focus(), 20);
}
function closeChat() {
  chatOpen = false;
  renderChat();
  if (lastFocus?.isConnected) lastFocus.focus();
  else document.querySelector(".chat-launcher")?.focus();
}
function chatWelcome() {
  chatMessages = [
    {
      type: "bot",
      text: t(
        "Hi! I can help find appointments and explain visit fees and clinic hours. What would you like to do?",
        "أهلاً! أساعدك في إيجاد موعد ومعرفة الرسوم وساعات عمل العيادة. كيف أساعدك؟",
      ),
    },
    { type: "quick" },
  ];
  renderChat();
}
function chatOptions(items) {
  return `<div class="chat-options">${items.join("")}</div>`;
}
function renderChat() {
  if (portal) return;
  updateBackToTop();
  const bookingHelp = document.querySelector("#booking-help");
  if (bookingHelp) bookingHelp.innerHTML = "";
  const pendingMessage = document.querySelector("#chat-input")?.value || "";
  const showAssistant =
    !route().startsWith("/workspace") &&
    route() !== "/login" &&
    route() !== "/forgot";
  const isModal =
    chatOpen && showAssistant && matchMedia("(max-width:680px)").matches;
  app.inert = isModal;
  document.body.classList.toggle("chat-is-open", isModal);
  if (
    route().startsWith("/workspace") ||
    route() === "/login" ||
    route() === "/forgot"
  ) {
    chatRoot.innerHTML = "";
    return;
  }
  if (!chatOpen) {
    chatRoot.innerHTML = `<button class="btn chat-launcher" data-action="chat-open" aria-haspopup="dialog" aria-controls="booking-assistant"><svg class="chat-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/><g fill="currentColor" stroke="none"><circle cx="8" cy="10.5" r="1"/><circle cx="12" cy="10.5" r="1"/><circle cx="16" cy="10.5" r="1"/></g></svg>${t("Need help booking?", "تحتاج مساعدة في الحجز؟")}</button>`;
    if (bookingHelp) bookingHelp.append(...chatRoot.childNodes);
    return;
  }
  chatRoot.innerHTML = `<section class="chat-panel" id="booking-assistant" role="dialog" aria-modal="false" aria-labelledby="chat-title"><header class="chat-header"><div class="chat-header-top"><h2 id="chat-title">${t("Booking assistant", "مساعد الحجز")}</h2><button class="chat-close" data-action="chat-close" aria-label="${t("Close chat", "إغلاق المحادثة")}">×</button></div><small>${t("CareSlot · Appointments and clinic information · Demo", "كيرسلوت · المواعيد ومعلومات العيادة · تجريبي")}</small></header><div class="chat-messages" role="log" aria-live="polite" aria-relevant="additions text">${chatMessages
    .map((m) => {
      if (m.type === "bot" || m.type === "user")
        return `<div class="message ${m.type === "user" ? "user" : ""}">${escape(m.text)}</div>`;
      if (m.type === "quick")
        return chatOptions([
          button(
            t("Find an available appointment", "البحث عن موعد متاح"),
            "chat-find",
            "",
            "full",
          ),
          button(
            t("Find my booking", "العثور على حجزي"),
            "chat-lookup",
            "",
            "secondary",
          ),
          button(
            t("Fees and clinic hours", "الرسوم وساعات العمل"),
            "chat-info",
            "",
            "secondary",
          ),
        ]);
      if (m.type === "specialties")
        return chatOptions(
          SPECIALTIES.map((s) =>
            button(
              s[lang],
              "chat-specialty",
              `data-specialty="${s.id}"`,
              "secondary",
            ),
          ),
        );
      if (m.type === "slots")
        return (
          `<p class="chat-note">${escape(spec(m.specialty))} · ${dateText(m.date)} · ${readState().duration} ${t("min", "دقيقة")} · ${money()}</p>` +
          chatOptions(
            m.slots.map((s) =>
              button(
                `<bdi>${s.time}</bdi>`,
                "chat-slot",
                `data-date="${m.date}" data-time="${s.time}" data-specialty="${m.specialty}" data-doc="${s.doctors[0].id}"`,
                "secondary",
              ),
            ),
          ) +
          `<p class="chat-note">${t("Times aren’t held until you submit your request.", "الأوقات غير محجوزة لك حتى إرسال الطلب.")}</p>`
        );
      if (m.type === "summary") {
        const d = readState().doctors.find((d) => d.id === m.preferredId);
        return `<div class="chat-summary"><h3>${dateText(m.date)} · <bdi>${m.time}</bdi></h3><p>${escape(doctorName(d))} · ${escape(spec(m.specialty))}<br>${readState().duration} ${t("min", "دقيقة")} · ${money()} · ${t("Pay at clinic", "الدفع في العيادة")}<br>${t("Building 12, Al-Rainbow St, Jabal Amman", "مبنى ١٢، شارع الرينبو، جبل عمّان")}</p>${button(t("Continue to booking", "المتابعة إلى الحجز"), "chat-continue", `data-date="${m.date}" data-time="${m.time}" data-specialty="${m.specialty}" data-doc="${m.preferredId}"`, "full")}</div><p class="chat-note">${t("Your request hasn’t been sent. We’ll recheck availability before submission.", "لم يتم إرسال طلبك بعد. نتحقق من توفر الموعد مجدداً قبل الإرسال.")}</p>`;
      }
      if (m.type === "lookup")
        return chatOptions([
          button(
            t("Verify and find my booking", "التحقق والعثور على حجزي"),
            "chat-verify",
            "",
            "full",
          ),
        ]);
      if (m.type === "error")
        return (
          `${notice(t("Couldn’t check availability. Check your connection and try again. No booking has been sent.", "تعذر التحقق من المواعيد. تحقق من الاتصال وحاول مرة أخرى. لم يتم إرسال أي حجز."), "error")}` +
          chatOptions([
            button(t("Try again", "إعادة المحاولة"), "chat-retry"),
            button(
              t("Use the booking form", "استخدام نموذج الحجز"),
              "chat-form",
              "",
              "secondary",
            ),
            `<a href="tel:+96265550100" class="btn secondary">${t("Call the clinic", "الاتصال بالعيادة")}</a>`,
          ])
        );
      return "";
    })
    .join(
      "",
    )}${chatBusy ? `<div class="message" aria-label="${t("Checking availability", "جار التحقق من المواعيد")}"><div class="typing"><span></span><span></span><span></span></div></div>` : ""}</div><form class="chat-composer" id="chat-form"><div class="chat-input-row"><input id="chat-input" name="message" placeholder="${t("Ask about appointments…", "اسأل عن المواعيد…")}" aria-label="${t("Message the booking assistant", "رسالة إلى مساعد الحجز")}" maxlength="500" autocomplete="off"><button type="submit" ${chatBusy ? "disabled" : ""}>${t("Send", "إرسال")}</button></div><small>${t("Booking help only. For medical questions, contact the clinic.", "للحجز فقط. للأسئلة الطبية تواصل مع العيادة.")}</small></form></section>`;
  const log = document.querySelector(".chat-messages");
  if (log) log.scrollTop = log.scrollHeight;
  const input = document.querySelector("#chat-input");
  if (input) input.value = pendingMessage;
  document
    .querySelector("#booking-assistant")
    ?.setAttribute("aria-modal", String(isModal));
}
function parseChatDate(message) {
  const lower = message.toLowerCase(),
    explicit = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicit && !Number.isNaN(Date.parse(explicit[1] + "T12:00:00Z")))
    return explicit[1];
  if (/tomorrow|غد|بكرة/.test(lower)) return addDays(today(), 1);
  if (/today|اليوم/.test(lower)) return today();
  const names = [
    ["sunday", "الأحد", "الاحد"],
    ["monday", "الاثنين"],
    ["tuesday", "الثلاثاء"],
    ["wednesday", "الأربعاء", "الاربعاء"],
    ["thursday", "الخميس"],
    ["friday", "الجمعة"],
    ["saturday", "السبت"],
  ];
  for (let day = 0; day < 7; day++)
    if (names[day].some((n) => lower.includes(n))) {
      let date = today();
      for (let i = 0; i < 7; i++) {
        if (weekday(date) === day) return date;
        date = addDays(date, 1);
      }
    }
  return chatContext.date;
}
async function chatAvailability(
  specialty = chatContext.specialty,
  date = chatContext.date,
  time = null,
) {
  if (chatBusy) return;
  chatContext = { ...chatContext, specialty, date };
  chatBusy = true;
  renderChat();
  await new Promise((resolve) => setTimeout(resolve, 550));
  chatBusy = false;
  if (!navigator.onLine) {
    chatMessages.push({ type: "error" });
    renderChat();
    return;
  }
  const s = readState(),
    slots = slotsFor(s, date, specialty).filter((s) => s.doctors.length);
  if (time) {
    const exact = slots.find((s) => s.time === time);
    if (exact) {
      const choice = {
        date,
        time,
        specialty,
        preferredId: exact.doctors[0].id,
      };
      chatMessages.push(
        {
          type: "bot",
          text: t(
            "That time is available. Review this appointment before continuing.",
            "هذا الوقت متاح. راجع الموعد قبل المتابعة.",
          ),
        },
        { type: "summary", ...choice },
      );
      renderChat();
      return;
    }
    chatMessages.push({
      type: "bot",
      text: t(
        `${time} is unavailable. Here are alternatives within the same specialty.`,
        `${time} غير متاح. إليك أوقاتاً بديلة ضمن التخصص نفسه.`,
      ),
    });
  } else if (slots.length)
    chatMessages.push({
      type: "bot",
      text: t(
        `These times are available on ${dateText(date)}. Select a time to continue.`,
        `هذه الأوقات متاحة يوم ${dateText(date)}. اختر وقتاً للمتابعة.`,
      ),
    });
  if (slots.length)
    chatMessages.push({
      type: "slots",
      date,
      specialty,
      slots: slots.slice(0, 4),
    });
  else {
    let next = date < today() ? today() : addDays(date, 1),
      nextSlots = [];
    for (let i = 0; i < 30; i++, next = addDays(next, 1)) {
      nextSlots = slotsFor(s, next, specialty).filter((s) => s.doctors.length);
      if (nextSlots.length) break;
    }
    chatMessages.push({
      type: "bot",
      text: t(
        `No matching doctors are available on ${dateText(date)}. ${nextSlots.length ? "Here is the next available date." : "Try another date in the booking form."}`,
        `لا يوجد أطباء متاحون ضمن التخصص يوم ${dateText(date)}. ${nextSlots.length ? "إليك اليوم التالي المتاح." : "جرّب تاريخاً آخر في نموذج الحجز."}`,
      ),
    });
    if (nextSlots.length) {
      chatContext.date = next;
      chatMessages.push({
        type: "slots",
        date: next,
        specialty,
        slots: nextSlots.slice(0, 3),
      });
    }
  }
  renderChat();
}
async function respondToChat(message) {
  chatMessages.push({ type: "user", text: message });
  const lower = message.toLowerCase();
  if (
    /diagnos|symptom|treatment|chest pain|rash|bleeding|دواء|علاج|ألم|اعراض|أعراض|تشخيص/.test(
      lower,
    )
  ) {
    chatMessages.push({
      type: "bot",
      text: t(
        "I can help with booking and clinic information. Please contact the clinic for questions about symptoms or treatment.",
        "أساعدك في الحجز ومعلومات العيادة. تواصل مع العيادة للأسئلة عن الأعراض أو العلاج.",
      ),
    });
    renderChat();
    return;
  }
  if (/fee|price|cost|hours|open|رسوم|سعر|تكلف|ساعات|يفتح/.test(lower)) {
    chatInfo();
    return;
  }
  if (/my booking|find.*book|reference|حجزي|حجوزاتي/.test(lower)) {
    chatLookup();
    return;
  }
  let specialty = chatContext.specialty;
  const keywords = {
    dermatology: /derm|skin|جلد/,
    general: /general|عام/,
    pediatrics: /pediatr|child|أطفال|اطفال/,
    dentistry: /dent|أسنان|اسنان/,
    cardiology: /cardio|heart|قلب/,
    eye: /eye|vision|عيون/,
  };
  for (const [id, re] of Object.entries(keywords))
    if (re.test(lower)) specialty = id;
  const time = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  await chatAvailability(
    specialty,
    parseChatDate(message),
    time ? time[1].padStart(2, "0") + ":" + time[2] : null,
  );
}
function chatInfo() {
  chatMessages.push({
    type: "bot",
    text: t(
      `Consultations are ${money()} for ${readState().duration} minutes, payable at the clinic.\nSunday–Thursday 09:00–17:00\nSaturday 10:00–14:00 · Friday closed\nRequests are usually confirmed within 2 clinic opening hours.\nBuilding 12, Al-Rainbow Street, Jabal Amman.`,
      `رسوم الزيارة ${money()} لمدة ${readState().duration} دقيقة، والدفع في العيادة.\nالأحد–الخميس 09:00–17:00\nالسبت 10:00–14:00 · الجمعة مغلق\nنؤكد الطلب عادة خلال ساعتين من ساعات العمل.\nمبنى ١٢، شارع الرينبو، جبل عمّان.`,
    ),
  });
  renderChat();
}
function chatLookup() {
  chatMessages.push(
    {
      type: "bot",
      text: t(
        "To protect your details, verify the phone number used for your booking. Appointment details stay private until verification.",
        "لحماية بياناتك، تحقق من رقم الهاتف المستخدم للحجز. لن نعرض تفاصيل الموعد قبل التحقق.",
      ),
    },
    { type: "lookup" },
  );
  renderChat();
}

function scrollToSection(hash) {
  if (!/^#[a-z][a-z-]*$/i.test(hash)) return false;
  const section = document.getElementById(hash.slice(1));
  if (!section) return false;
  if (hash === "#main" || document.documentElement.classList.contains("keyboard-input")) {
    section.setAttribute("tabindex", "-1");
    section.focus({ preventScroll: true });
  }
  document.querySelector("#mobile-navigation")?.classList.remove("open");
  document.querySelector('[data-action="menu"]')?.setAttribute("aria-expanded", "false");
  const scroll = () => section.isConnected && section.scrollIntoView({
    block: "start",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.classList.contains("keyboard-input") ? "instant" : "smooth",
  });
  if (document.fonts.status === "loading") document.fonts.ready.then(scroll);
  else scroll();
  return true;
}

document.addEventListener("click", async (event) => {
  const sectionLink = event.target.closest('a[href^="#"]');
  if (sectionLink && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
    const hash = sectionLink.getAttribute("href");
    if (scrollToSection(hash)) {
      event.preventDefault();
      if (location.hash !== hash) history.pushState(null, "", hash);
      return;
    }
  }
  const el = event.target.closest("[data-action]");
  if (!el) {
    const row = event.target.closest("[data-open]");
    if (row) showBookingDetails(row.dataset.open);
    return;
  }
  const a = el.dataset.action,
    id = el.dataset.id;
  try {
    if (a === "language") {
      captureDraftFields();
      lang = lang === "en" ? "ar" : "en";
      try {
        localStorage.setItem("careslot.language", lang);
      } catch {}
      chatMessages = [];
      if (chatOpen) chatWelcome();
      render();
    } else if (a === "booking-step") {
      event.preventDefault();
      captureDraftFields();
      const targetStep = Number(el.dataset.step);
      if (targetStep > 1 && !slotsFor(
        readState(), draft.date, draft.specialty, draft.preferredId,
      ).some((slot) => slot.doctors.length)) {
        go("/book/date");
        toast(t("Please choose an available date.", "يرجى اختيار تاريخ متاح."));
        return;
      }
      if (targetStep === 3 && !availableDoctors(
        readState(), draft.date, draft.time, draft.specialty, draft.preferredId,
      ).length) {
        draft.time = "";
        go("/book/time");
        toast(t("Please choose an available time first.", "يرجى اختيار وقت متاح أولاً."));
        return;
      }
      go(el.getAttribute("href").slice(1));
    } else if (a === "menu") {
      const nav = document.querySelector("#mobile-navigation");
      nav.classList.toggle("open");
      el.setAttribute("aria-expanded", nav.classList.contains("open"));
    } else if (a === "workspace-menu") {
      const nav = document.querySelector("#workspace-sidebar");
      nav.classList.toggle("open");
      el.setAttribute("aria-expanded", nav.classList.contains("open"));
    } else if (a === "service-book") {
      draft = {
        ...draft,
        specialty: el.dataset.specialty,
        preferredId: "any",
        time: "",
      };
      go("/book/date");
    } else if (a === "specialty") {
      draft = { ...draft, specialty: id, preferredId: "any", time: "" };
      saveDraft();
      render();
    } else if (a === "date") {
      draft.date = el.dataset.date;
      draft.time = "";
      saveDraft();
      render();
    } else if (a === "time") {
      draft.time = el.dataset.time;
      saveDraft();
      render();
    } else if (a === "month") {
      const [y, m] = calendarMonth.split("-").map(Number);
      const next = new Date(Date.UTC(y, m - 1 + Number(el.dataset.offset), 1));
      calendarMonth = next.toISOString().slice(0, 7);
      render();
    } else if (a === "date-continue") {
      if (
        !slotsFor(
          readState(),
          draft.date,
          draft.specialty,
          draft.preferredId,
        ).some((s) => s.doctors.length)
      ) {
        toast(t("Please choose an available date.", "يرجى اختيار تاريخ متاح."));
        return;
      }
      go("/book/time");
    } else if (a === "time-continue") {
      if (
        !availableDoctors(
          readState(),
          draft.date,
          draft.time,
          draft.specialty,
          draft.preferredId,
        ).length
      ) {
        draft.time = "";
        toast(
          t(
            "That time is no longer available. Choose another time.",
            "لم يعد الوقت متاحاً. اختر وقتاً آخر.",
          ),
        );
        render();
        return;
      }
      go("/book/details");
    } else if (a === "next-available") {
      let next = addDays(draft.date, 1);
      for (let i = 0; i < 60; i++, next = addDays(next, 1))
        if (
          slotsFor(readState(), next, draft.specialty, draft.preferredId).some(
            (s) => s.doctors.length,
          )
        ) {
          draft.date = next;
          draft.time = "";
          calendarMonth = next.slice(0, 7);
          saveDraft();
          render();
          return;
        }
      toast(
        t(
          "No dates found. Try another doctor.",
          "لا توجد مواعيد. جرّب طبيباً آخر.",
        ),
      );
    } else if (a === "resend") {
      if (Date.now() < resendAt) return;
      startResendTimer();
      toast(
        t(
          `Demo verification code: ${DEMO_CODE}`,
          `رمز التحقق التجريبي: ${DEMO_CODE}`,
        ),
      );
    } else if (a === "lookup-reset") {
      lookupStage = "phone";
      verified = null;
      setSession("careslot.verified", null);
      render();
    } else if (a === "calendar-download") calendarDownload(id);
    else if (a === "all-doctors") {
      const s = readState();
      openModal(
        modalHeader(t("Meet your doctors", "تعرف على أطبائنا")) +
          `<div class="form-stack">${s.doctors
            .filter((d) => d.active)
            .map(
              (d) =>
                `<div class="work-card-heading">${person(d, spec(d.specialty))}${button(t("Book", "حجز"), "book-doctor", `data-id="${d.id}"`, "small secondary")}</div>`,
            )
            .join("")}</div>`,
      );
    } else if (a === "book-doctor") {
      const d = readState().doctors.find((d) => d.id === id);
      draft = { ...draft, specialty: d.specialty, preferredId: id, time: "" };
      modal.close();
      go("/book/date");
    } else if (a === "toggle-password") {
      const password = document.getElementById("login-password");
      const reveal = password.type === "password";
      password.type = reveal ? "text" : "password";
      password.nextElementSibling.setAttribute("aria-label", reveal
        ? t("Hide password", "إخفاء كلمة المرور")
        : t("Show password", "إظهار كلمة المرور"));
    } else if (a === "demo-role") {
      document.querySelector("#login-form").elements.email.value =
        el.dataset.role === "doctor"
          ? "doctor@careslot.example"
          : "staff@careslot.example";
      document.querySelector("#login-form").elements.password.value =
        "demo1234";
      document
        .querySelectorAll(".role-buttons button")
        .forEach((b) => b.classList.toggle("secondary", b !== el));
    } else if (a === "logout") {
      session = null;
      setSession(authKey, null);
      go("/login");
    } else if (a === "booking-detail") showBookingDetails(id);
    else if (a === "assign") assignModal(id);
    else if (a === "reschedule") rescheduleModal(id);
    else if (a === "cancel") cancelModal(id);
    else if (a === "close-modal") modal.close();
    else if (a === "new-booking") newBookingModal();
    else if (a === "edit-doctor") doctorModal(id);
    else if (a === "toggle-doctor") {
      if (!assertStaff()) return;
      const s = readState(),
        d = s.doctors.find((d) => d.id === id);
      if (d) {
        d.active = !d.active;
        writeState(s);
        render();
        toast(
          t(
            "Doctor availability updated. Existing appointments are preserved.",
            "تم تحديث توفر الطبيب مع الاحتفاظ بالمواعيد الحالية.",
          ),
        );
      }
    } else if (a === "export") exportCSV();
    else if (a === "filter") {
      staffFilter = el.dataset.filter;
      render();
    } else if (a === "clear-filters") {
      search = "";
      staffFilter = "all";
      render();
    } else if (a === "complete") {
      const b = readState().bookings.find((b) => b.id === id);
      if (session?.role === "doctor" && b?.doctorId === session.doctorId) {
        updateBooking(id, { status: "completed" });
        modal.close();
        render();
        toast(t("Appointment marked as completed.", "تم تحديد الموعد كمكتمل."));
      }
    } else if (a === "timeoff-decision") {
      if (!assertStaff()) return;
      const s = readState(),
        request = s.timeOff.find((r) => r.id === id);
      if (!request) return;
      if (
        el.dataset.status === "approved" &&
        s.bookings.some(
          (b) =>
            b.doctorId === request.doctorId &&
            b.date >= request.from &&
            b.date <= request.to &&
            ["pending", "confirmed"].includes(b.status),
        )
      ) {
        toast(
          t(
            "Reschedule or cancel the affected appointments before approving this request.",
            "أعد جدولة أو ألغِ المواعيد المتأثرة قبل الموافقة على الطلب.",
          ),
        );
        return;
      }
      request.status = el.dataset.status;
      writeState(s);
      render();
      toast(t("Request updated.", "تم تحديث الطلب."));
    } else if (a === "chat-open") openChat();
    else if (a === "chat-close") closeChat();
    else if (a === "chat-find") {
      chatMessages.push(
        {
          type: "bot",
          text: t(
            "Which specialty would you like to book?",
            "ما التخصص الذي ترغب بحجزه؟",
          ),
        },
        { type: "specialties" },
      );
      renderChat();
    } else if (a === "chat-specialty") {
      chatMessages.push({ type: "user", text: spec(el.dataset.specialty) });
      await chatAvailability(el.dataset.specialty, chatContext.date);
    } else if (a === "chat-info") chatInfo();
    else if (a === "chat-lookup") chatLookup();
    else if (a === "chat-verify") {
      closeChat();
      lookupStage = "phone";
      go("/lookup");
    } else if (a === "chat-retry") await chatAvailability();
    else if (a === "chat-form") {
      closeChat();
      go("/book/specialty");
    } else if (a === "chat-slot" || a === "chat-continue") {
      const choice = {
        date: el.dataset.date,
        time: el.dataset.time,
        specialty: el.dataset.specialty,
        preferredId: el.dataset.doc,
      };
      if (
        !availableDoctors(
          readState(),
          choice.date,
          choice.time,
          choice.specialty,
          choice.preferredId,
        ).length
      ) {
        chatMessages.push({
          type: "bot",
          text: t(
            `${choice.time} is no longer available. Let’s find another time.`,
            `${choice.time} لم يعد متاحاً. لنبحث عن وقت آخر.`,
          ),
        });
        await chatAvailability(choice.specialty, choice.date);
        return;
      }
      if (a === "chat-slot") {
        chatMessages.push(
          { type: "user", text: choice.time },
          { type: "summary", ...choice },
        );
        renderChat();
      } else {
        draft = { ...draft, ...choice };
        saveDraft();
        closeChat();
        go("/book/details");
      }
    }
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener("change", (event) => {
  const el = event.target;
  if (el.id === "preferred-doctor") {
    draft.preferredId = el.value;
    draft.time = "";
    saveDraft();
    render();
  }
  if (el.id === "staff-day") {
    staffDay = el.value || today();
    render();
  }
  if (el.id === "reschedule-date") rescheduleModal(el.dataset.id, el.value);
  if (el.id === "new-booking-specialty" || el.id === "new-booking-date")
    refreshStaffSlots();
});
document.addEventListener("input", (event) => {
  const input = event.target;
  if (input.form?.id === "details-form") captureDraftFields();
  if (["details-form", "staff-booking-form"].includes(input.form?.id) && input.hasAttribute("aria-invalid")) {
    const valid = input.name === "name" ? isValidName(input.value) : normalizePhone(input.value);
    if (valid) clearFieldError(input);
  }
  if (event.target.id === "booking-search") {
    search = event.target.value;
    const s = readState(),
      rows = s.bookings.filter(
        (b) =>
          (staffFilter === "all" || b.status === staffFilter) &&
          `${b.name} ${patientName(b)} ${b.phone} ${b.id}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      );
    document.querySelector("#booking-table").innerHTML = bookingsTable(
      rows.sort(
        (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
      ),
    );
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  const submit = form.querySelector("[type=submit]");
  if (["details-form", "staff-booking-form"].includes(form.id)) {
    for (const input of form.querySelectorAll('[aria-invalid="true"]')) clearFieldError(input);
    form.querySelector("#form-error").textContent = "";
    const issues = [];
    if (!isValidName(values.name)) issues.push(["name", t("Enter your name using at least two letters. Numbers and symbols are not allowed.", "أدخل اسمك باستخدام حرفين على الأقل. لا يسمح بالأرقام أو الرموز.")]);
    if (!normalizePhone(values.phone)) issues.push(["phone", t("Enter a valid phone number, e.g. +962 79 123 4567.", "أدخل رقم هاتف صحيحاً، مثل +962 79 123 4567.")]);
    for (const [name, message] of issues) showFieldError(form.elements.namedItem(name), message);
    if (issues.length) {
      form.elements.namedItem(issues[0][0]).focus();
      return;
    }
  }
  try {
    if (form.id === "details-form") {
      const phone = normalizePhone(values.phone);
      draft = { ...draft, ...values, name: values.name.trim(), phone };
      saveDraft();
      go("/book/verify");
    } else if (form.id === "booking-verify") {
      if (values.code !== DEMO_CODE)
        throw new Error(
          t(
            "This code is incorrect or expired. Use the demo code shown below.",
            "الرمز غير صحيح أو منتهي. استخدم الرمز التجريبي الظاهر أدناه.",
          ),
        );
      submit.disabled = true;
      submit.textContent = t("Sending request…", "جار إرسال الطلب…");
      await new Promise((resolve) => setTimeout(resolve, 350));
      const b = createBooking(draft);
      verified = { phone: b.phone, expires: Date.now() + 15 * 60000 };
      setSession("careslot.verified", verified);
      draft = { ...draft, time: "", note: "" };
      saveDraft();
      go("/receipt/" + b.id);
    } else if (form.id === "lookup-phone") {
      lookupPhone = normalizePhone(values.phone);
      if (!lookupPhone)
        throw new Error(
          t("Please enter a valid phone number.", "يرجى إدخال رقم هاتف صحيح."),
        );
      lookupStage = "verify";
      render();
    } else if (form.id === "lookup-verify") {
      if (values.code !== DEMO_CODE)
        throw new Error(
          t(
            "This code is incorrect or expired. Try again.",
            "الرمز غير صحيح أو منتهي. حاول مجدداً.",
          ),
        );
      verified = { phone: lookupPhone, expires: Date.now() + 15 * 60000 };
      setSession("careslot.verified", verified);
      lookupResult = readState()
        .bookings.filter((b) => b.phone === lookupPhone)
        .sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
        );
      lookupStage = "results";
      render();
    } else if (form.id === "login-form") {
      const email = values.email.toLowerCase();
      if (
        email !== portal + "@careslot.example" ||
        values.password !== "demo1234"
      )
        throw new Error(
          t(
            "Use one of the demo accounts above with password demo1234.",
            "استخدم أحد الحسابات التجريبية أعلاه مع كلمة المرور demo1234.",
          ),
        );
      session = {
        role: email.startsWith("doctor") ? "doctor" : "staff",
        doctorId: email.startsWith("doctor") ? "omar" : null,
      };
      setSession(authKey, session);
      go("/workspace/dashboard");
    } else if (form.id === "recovery-form") {
      form.innerHTML =
        notice(
          t(
            "Demo: reset link preview ready. Email sending will be connected to a backend.",
            "تجريبي: معاينة رابط إعادة التعيين جاهزة. سيتم ربط إرسال البريد بخادم لاحقاً.",
          ),
          "success",
        ) +
        `<a class="btn secondary" href="#/login">${t("Back to sign in", "العودة لتسجيل الدخول")}</a>`;
    } else if (form.id === "assign-form") {
      if (!assertStaff()) return;
      updateBooking(form.dataset.id, {
        doctorId: values.doctorId,
        status: "confirmed",
      });
      modal.close();
      render();
      toast(
        t(
          "Doctor assigned. Appointment confirmed.",
          "تم تعيين الطبيب وتأكيد الموعد.",
        ),
      );
    } else if (form.id === "cancel-form") {
      const b = readState().bookings.find((b) => b.id === form.dataset.id);
      if (!canAccess(b) || session?.role === "doctor") return;
      updateBooking(b.id, { status: "cancelled", cancelReason: values.reason });
      modal.close();
      lookupResult = lookupResult.map((row) =>
        row.id === b.id ? { ...row, status: "cancelled" } : row,
      );
      render();
      toast(
        t(
          "Booking cancelled. The time is available again.",
          "تم إلغاء الحجز وأصبح الوقت متاحاً مجدداً.",
        ),
      );
    } else if (form.id === "reschedule-form") {
      const b = readState().bookings.find((b) => b.id === form.dataset.id);
      if (!canAccess(b) || session?.role === "doctor") return;
      updateBooking(b.id, { date: values.date, time: values.time });
      modal.close();
      render();
      toast(t("New appointment time saved.", "تم حفظ وقت الموعد الجديد."));
    } else if (form.id === "staff-booking-form") {
      if (!assertStaff()) return;
      createBooking({ ...values, preferredId: "any", note: "" }, true);
      modal.close();
      render();
      toast(t("Booking created and confirmed.", "تم إنشاء الحجز وتأكيده."));
    } else if (form.id === "doctor-form") {
      if (!assertStaff()) return;
      const s = readState(),
        d = s.doctors.find((d) => d.id === form.dataset.id);
      if (d) {
        if (
          values.specialty !== d.specialty &&
          s.bookings.some(
            (b) =>
              b.doctorId === d.id &&
              ["pending", "confirmed"].includes(b.status),
          )
        )
          throw new Error(
            t(
              "Resolve this doctor’s active appointments before changing their specialty.",
              "عالج المواعيد النشطة لهذا الطبيب قبل تغيير التخصص.",
            ),
          );
        Object.assign(d, values, { active: values.active === "on" });
      } else
        s.doctors.push({
          ...values,
          id: "doctor-" + Date.now(),
          initials: values.name
            .replace(/^Dr\.?\s*/i, "")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase(),
          active: values.active === "on",
        });
      writeState(s);
      modal.close();
      render();
      toast(t("Doctor saved.", "تم حفظ الطبيب."));
    } else if (form.id === "hours-form") {
      if (!assertStaff()) return;
      if (
        values.open >= values.close ||
        values.saturdayOpen >= values.saturdayClose
      )
        throw new Error(
          t(
            "Closing time must be after opening time.",
            "يجب أن يكون وقت الإغلاق بعد وقت الفتح.",
          ),
        );
      const s = readState(),
        minutes = (time) =>
          Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
      for (const b of s.bookings.filter(
        (b) => b.date >= today() && ["pending", "confirmed"].includes(b.status),
      )) {
        const start = weekday(b.date) === 6 ? values.saturdayOpen : values.open,
          end = weekday(b.date) === 6 ? values.saturdayClose : values.close;
        if (b.time < start || minutes(b.time) + s.duration > minutes(end))
          throw new Error(
            t(
              "Some active bookings fall outside these hours. Reschedule them first.",
              "توجد حجوزات نشطة خارج هذه الساعات. أعد جدولتها أولاً.",
            ),
          );
      }
      s.hours = values;
      writeState(s);
      toast(t("Availability saved.", "تم حفظ التوفر."));
    } else if (form.id === "timeoff-form") {
      if (session?.role !== "doctor") return;
      if (values.from < today() || values.to < values.from)
        throw new Error(
          t("Choose a valid date range.", "اختر نطاق تواريخ صحيحاً."),
        );
      const s = readState();
      s.timeOff.push({
        ...values,
        id: "leave-" + Date.now(),
        doctorId: session.doctorId,
        status: "pending",
      });
      writeState(s);
      render();
      toast(
        t(
          "Time-off request sent for staff review.",
          "تم إرسال طلب الإجازة لمراجعة الموظفين.",
        ),
      );
    } else if (form.id === "settings-form") {
      const s = readState();
      if (assertStaff()) {
        s.settings.clinicName = values.name;
        s.fee = Number(values.fee);
      } else {
        const d = s.doctors.find((d) => d.id === session.doctorId);
        if (d) {
          if (lang === "ar") d.ar = values.name;
          else d.name = values.name;
        }
      }
      writeState(s);
      lang = values.language;
      try {
        localStorage.setItem("careslot.language", lang);
      } catch {}
      render();
      toast(t("Changes saved.", "تم حفظ التغييرات."));
    } else if (form.id === "chat-form") {
      const message = String(values.message || "").trim();
      if (!message || chatBusy) return;
      form.reset();
      await respondToChat(message);
      document.querySelector("#chat-input")?.focus();
    }
  } catch (error) {
    formError(error.message, form);
    if (submit) {
      submit.disabled = false;
      if (form.id === "booking-verify")
        submit.textContent = t(
          "Verify and send request",
          "التحقق وإرسال الطلب",
        );
    }
  }
});
document.addEventListener("keydown", (event) => {
  document.documentElement.classList.add("keyboard-input");
  if (
    event.key === "Tab" &&
    chatOpen &&
    matchMedia("(max-width:680px)").matches &&
    !modal.open
  ) {
    const nodes = [
      ...document.querySelectorAll(
        "#booking-assistant button:not(:disabled),#booking-assistant a,#booking-assistant input",
      ),
    ];
    const first = nodes[0],
      last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  if (event.key === "Escape") {
    document.querySelector("#workspace-sidebar")?.classList.remove("open");
    if (chatOpen && !modal.open) closeChat();
  }
  if (
    (event.key === "Enter" || event.key === " ") &&
    event.target.matches("tr[data-open]")
  ) {
    event.preventDefault();
    showBookingDetails(event.target.dataset.open);
  }
});
modal.addEventListener("close", () => {
  if (lastFocus?.isConnected) lastFocus.focus();
});
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    const rect = modal.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      modal.close();
  }
});
window.addEventListener("hashchange", () => {
  if (scrollToSection(location.hash)) return;
  window.scrollTo({ top: 0, behavior: "instant" });
  render();
  const main = document.querySelector("#main");
  if (main) {
    main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });
  }
});
document.addEventListener("pointerdown", () => {
  document.documentElement.classList.remove("keyboard-input");
});
window.addEventListener("storage", (event) => {
  if (event.key === "careslot.frontend.v1") {
    if (route().startsWith("/workspace") || route().startsWith("/book/time"))
      render();
  }
});
function updateBackToTop() {
  const label = t("Back to top", "العودة إلى أعلى الصفحة");
  backToTop.setAttribute("aria-label", label);
  backToTop.title = label;
  backToTop.hidden = window.scrollY < 400 || chatOpen || modal.open;
}
backToTop.addEventListener("click", () => {
  const instant = matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.classList.contains("keyboard-input");
  document.querySelector(".brand")?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: instant ? "instant" : "smooth" });
});
window.addEventListener("scroll", updateBackToTop, { passive: true });
window.addEventListener("resize", updateBackToTop);
modal.addEventListener("toggle", updateBackToTop);
render();
