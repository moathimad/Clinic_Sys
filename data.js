export const STORE_KEY = "careslot.frontend.v1";
export const DEMO_CODE = "482106";
export const SPECIALTIES = [
  {
    id: "general",
    en: "General medicine",
    ar: "الطب العام",
    description: "Check-ups, fevers, ongoing care and referrals.",
    arabic: "فحوصات عامة ورعاية مستمرة وإحالات.",
  },
  {
    id: "dermatology",
    en: "Dermatology",
    ar: "الجلدية",
    description: "Skin, hair and nail conditions.",
    arabic: "العناية بالبشرة والشعر والأظافر.",
  },
  {
    id: "pediatrics",
    en: "Pediatrics",
    ar: "طب الأطفال",
    description: "Care for babies, children and teenagers.",
    arabic: "رعاية الرضع والأطفال والمراهقين.",
  },
  {
    id: "dentistry",
    en: "Dentistry",
    ar: "طب الأسنان",
    description: "Cleaning, fillings and routine dental care.",
    arabic: "تنظيف وحشوات ورعاية الأسنان.",
  },
  {
    id: "cardiology",
    en: "Cardiology",
    ar: "القلب",
    description: "Heart health, blood pressure and tests.",
    arabic: "صحة القلب وضغط الدم والفحوصات.",
  },
  {
    id: "eye",
    en: "Eye care",
    ar: "طب العيون",
    description: "Vision tests and eye health checks.",
    arabic: "فحوصات النظر وصحة العين.",
  },
];
export const DOCTORS = [
  {
    id: "omar",
    name: "Dr. Omar Haddad",
    ar: "د. عمر حداد",
    specialty: "dermatology",
    initials: "OH",
    photo: "assets/dr-omar.png",
    active: true,
  },
  {
    id: "layla",
    name: "Dr. Layla Khoury",
    ar: "د. ليلى خوري",
    specialty: "pediatrics",
    initials: "LK",
    photo: "assets/dr-layla.png",
    active: true,
  },
  {
    id: "nasser",
    name: "Dr. Mahmoud Nasser",
    ar: "د. محمود ناصر",
    specialty: "general",
    initials: "MN",
    active: true,
  },
  {
    id: "sara",
    name: "Dr. Sara Odeh",
    ar: "د. سارة عودة",
    specialty: "dentistry",
    initials: "SO",
    active: true,
  },
  {
    id: "rami",
    name: "Dr. Rami Saleh",
    ar: "د. رامي صالح",
    specialty: "cardiology",
    initials: "RS",
    active: true,
  },
  {
    id: "nour",
    name: "Dr. Nour Aziz",
    ar: "د. نور عزيز",
    specialty: "eye",
    initials: "NA",
    active: true,
  },
  {
    id: "tariq",
    name: "Dr. Tariq Mansour",
    ar: "د. طارق منصور",
    specialty: "cardiology",
    initials: "TM",
    active: true,
  },
  {
    id: "maya",
    name: "Dr. Maya Khalil",
    ar: "د. مايا خليل",
    specialty: "eye",
    initials: "MK",
    active: true,
  },
];
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekday(iso) {
  return new Date(iso + "T12:00:00Z").getUTCDay();
}
export function isValidName(value) {
  const name = String(value ?? "").trim();
  return (
    name.length >= 2 &&
    name.length <= 100 &&
    (name.match(/\p{L}/gu) || []).length >= 2 &&
    /^\p{L}[\p{L}\p{M}]*(?:(?: +|['\u2019-])[\p{L}\p{M}]+)*$/u.test(name)
  );
}
export function normalizePhone(value) {
  let p = String(value)
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0))
    .replace(/[\s()-]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (/^07\d{8}$/.test(p)) p = "+962" + p.slice(1);
  return /^\+\d{9,15}$/.test(p) ? p : "";
}
export function seedState() {
  let date = addDays(today(), 2);
  if (weekday(date) === 5) date = addDays(date, 1);
  const row = (
    id,
    name,
    phone,
    time,
    specialty,
    doctorId,
    status = "confirmed",
  ) => ({
    id,
    name,
    phone,
    date,
    time,
    specialty,
    doctorId,
    preferredId: doctorId || "any",
    status,
    note: "",
    createdAt: new Date().toISOString(),
  });
  return {
    doctors: structuredClone(DOCTORS),
    bookings: [
      row(
        "CS-4821",
        "Lina Mahmoud",
        "+962792204410",
        "09:00",
        "dermatology",
        "omar",
      ),
      row(
        "CS-4822",
        "Omar Khalil",
        "+962783107752",
        "09:30",
        "general",
        "nasser",
      ),
      row(
        "CS-4823",
        "Reem Saleh",
        "+962791234567",
        "10:00",
        "dermatology",
        null,
        "pending",
      ),
      row(
        "CS-4824",
        "Sami Odeh",
        "+962785550192",
        "10:30",
        "general",
        null,
        "pending",
      ),
      row(
        "CS-4825",
        "Hala Barakat",
        "+962776402381",
        "11:00",
        "pediatrics",
        "layla",
      ),
      row(
        "CS-4826",
        "Dana Aziz",
        "+962774001288",
        "11:30",
        "dermatology",
        null,
        "pending",
      ),
    ],
    hours: {
      open: "09:00",
      close: "17:00",
      saturdayOpen: "10:00",
      saturdayClose: "14:00",
    },
    fee: 25,
    duration: 30,
    timeOff: [],
    settings: { clinicName: "CareSlot Clinic", phone: "+96265550100" },
  };
}
let memory;
export function readState() {
  try {
    const raw = globalThis.localStorage?.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed.bookings) &&
        Array.isArray(parsed.doctors) &&
        parsed.hours
      )
        return parsed;
    }
  } catch {
    /* Browser storage may be disabled. */
  }
  if (!memory) {
    memory = seedState();
    writeState(memory);
  }
  return structuredClone(memory);
}
export function writeState(state) {
  memory = structuredClone(state);
  try {
    globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* Keep the demo usable in memory. */
  }
}
export function availableDoctors(
  state,
  date,
  time,
  specialty,
  preferredId = "any",
  excludeId = null,
) {
  const parsedDate = new Date(date + "T12:00:00Z");
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    return [];
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date < today() ||
    weekday(date) === 5
  )
    return [];
  const day = weekday(date),
    start = day === 6 ? state.hours.saturdayOpen : state.hours.open,
    end = day === 6 ? state.hours.saturdayClose : state.hours.close;
  if (time < start || time >= end) return [];
  const minute = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  if (
    minute(time) + state.duration > minute(end) ||
    (minute(time) - minute(start)) % state.duration
  )
    return [];
  if (date === today()) {
    const clock = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Amman",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());
    if (time <= clock) return [];
  }
  const occupied = state.bookings.filter(
    (b) =>
      b.id !== excludeId &&
      b.date === date &&
      b.status !== "cancelled" &&
      b.status !== "completed" &&
      Math.abs(minute(b.time) - minute(time)) < state.duration,
  );
  let free = state.doctors.filter(
    (d) =>
      d.active &&
      d.specialty === specialty &&
      !state.timeOff.some(
        (t) =>
          t.doctorId === d.id &&
          t.status === "approved" &&
          date >= t.from &&
          date <= t.to,
      ) &&
      !occupied.some(
        (b) =>
          (b.doctorId || (b.preferredId !== "any" && b.preferredId)) === d.id,
      ),
  );
  const unassigned = occupied.filter(
    (b) =>
      b.specialty === specialty &&
      !b.doctorId &&
      (!b.preferredId || b.preferredId === "any"),
  ).length;
  if (free.length <= unassigned) return [];
  if (preferredId !== "any") return free.filter((d) => d.id === preferredId);
  return free.slice(unassigned);
}
export function slotsFor(
  state,
  date,
  specialty,
  preferredId = "any",
  excludeId = null,
) {
  const day = weekday(date),
    start = day === 6 ? state.hours.saturdayOpen : state.hours.open,
    end = day === 6 ? state.hours.saturdayClose : state.hours.close;
  const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const slots = [];
  for (
    let m = minutes(start);
    m + state.duration <= minutes(end);
    m += state.duration
  ) {
    const time =
      String(Math.floor(m / 60)).padStart(2, "0") +
      ":" +
      String(m % 60).padStart(2, "0");
    slots.push({
      time,
      doctors: availableDoctors(
        state,
        date,
        time,
        specialty,
        preferredId,
        excludeId,
      ),
    });
  }
  return slots;
}
export function createBooking(input, confirmed = false) {
  const state = readState(),
    phone = normalizePhone(input.phone);
  if (!isValidName(input.name))
    throw new Error("Enter a name using letters, without numbers or symbols.");
  if (!phone)
    throw new Error("Please enter your full name and a valid phone number.");
  const matches = availableDoctors(
    state,
    input.date,
    input.time,
    input.specialty,
    input.preferredId || "any",
  );
  if (!matches.length)
    throw new Error(
      "That time was just taken. Please choose another available time.",
    );
  const id =
    "CS-" +
    Math.max(4827, ...state.bookings.map((b) => Number(b.id.slice(3)) + 1));
  const booking = {
    ...input,
    id,
    name: input.name.trim(),
    phone,
    status: confirmed ? "confirmed" : "pending",
    doctorId: confirmed ? matches[0].id : null,
    createdAt: new Date().toISOString(),
  };
  state.bookings.push(booking);
  writeState(state);
  return booking;
}
export function updateBooking(id, changes) {
  const state = readState(),
    b = state.bookings.find((b) => b.id === id);
  if (!b) throw new Error("Booking not found.");
  if (changes.date || changes.time || changes.doctorId) {
    if (b.status === "cancelled" || b.status === "completed")
      throw new Error("This appointment can no longer be changed.");
    const doctorId = changes.doctorId || b.doctorId || b.preferredId || "any";
    if (
      !availableDoctors(
        state,
        changes.date || b.date,
        changes.time || b.time,
        b.specialty,
        doctorId,
        id,
      ).length
    )
      throw new Error(
        "That doctor or time is no longer available. Your existing booking is unchanged.",
      );
  }
  Object.assign(b, changes);
  writeState(state);
  return b;
}
