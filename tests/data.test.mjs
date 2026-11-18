import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  seedState,
  writeState,
  readState,
  normalizePhone,
  isValidName,
  availableDoctors,
  createBooking,
  updateBooking,
  addDays,
  today,
  weekday,
} from "../data.js";
function openDate() {
  let d = addDays(today(), 4);
  while (weekday(d) === 5) d = addDays(d, 1);
  return d;
}
beforeEach(() => writeState(seedState()));

test("patient names accept letters and common name separators in English and Arabic", () => {
  for (const name of ["Moath", "Moath Ahmad", " محمد أحمد ", "مُحَمَّد علي", "Anne-Marie", "O’Connor", "D'Angelo", "José García", "Moath  Ahmad"])
    assert.equal(isValidName(name), true, name);
});

test("patient names reject digits, symbols, blank values and invalid lengths", () => {
  for (const name of ["899", "٨٩٩", "۸۹۹", "Moath123", "محمد ١٢", "????", "<script>", "", "   ", "A", "A'", "a".repeat(101), null])
    assert.equal(isValidName(name), false, String(name));
});

test("invalid names cannot create bookings or consume availability", () => {
  const input = {
    phone: "0791111111",
    date: openDate(),
    time: "11:00",
    specialty: "dermatology",
    preferredId: "any",
  };
  const before = readState().bookings.length;
  for (const name of ["899", "٨٩٩", "Moath123"])
    assert.throws(() => createBooking({ ...input, name }), /name using letters/);
  assert.equal(readState().bookings.length, before);
  const booking = createBooking({ ...input, name: " محمد أحمد " });
  assert.equal(booking.name, "محمد أحمد");
});
test("Jordanian phone numbers normalize consistently for booking lookup", () => {
  assert.equal(normalizePhone("079 220 4410"), "+962792204410");
  assert.equal(normalizePhone("00962 79 220 4410"), "+962792204410");
  assert.equal(normalizePhone("invalid"), "");
  assert.equal(normalizePhone("٠٧٩ ٢٢٠ ٤٤١٠"), "+962792204410");
});
test("invalid calendar dates and malformed times never yield availability", () => {
  assert.equal(
    availableDoctors(readState(), "2099-02-31", "11:00", "dermatology").length,
    0,
  );
  assert.equal(
    availableDoctors(readState(), openDate(), "11:00junk", "dermatology")
      .length,
    0,
  );
});
test("specialty and doctor availability cannot cross specialties", () => {
  assert.equal(
    availableDoctors(readState(), openDate(), "11:00", "dermatology", "layla")
      .length,
    0,
  );
  assert.ok(
    availableDoctors(readState(), openDate(), "11:00", "dermatology", "omar")
      .length,
  );
});
test("a pending appointment consumes capacity, and cancellation releases it", () => {
  const date = openDate();
  const b = createBooking({
    name: "Demo Patient",
    phone: "0791111111",
    date,
    time: "11:00",
    specialty: "dermatology",
    preferredId: "any",
  });
  assert.equal(b.status, "pending");
  assert.equal(
    availableDoctors(readState(), date, "11:00", "dermatology").length,
    0,
  );
  assert.throws(
    () =>
      createBooking({
        name: "Other Patient",
        phone: "0792222222",
        date,
        time: "11:00",
        specialty: "dermatology",
        preferredId: "any",
      }),
    /taken/,
  );
  updateBooking(b.id, { status: "cancelled" });
  assert.equal(
    availableDoctors(readState(), date, "11:00", "dermatology").length,
    1,
  );
});
test("conflicting reschedule fails without changing the original appointment", () => {
  const date = openDate();
  const input = {
    name: "Patient",
    phone: "0791111111",
    date,
    specialty: "dermatology",
    preferredId: "omar",
  };
  const first = createBooking({ ...input, time: "11:00" }, true);
  createBooking({ ...input, time: "11:30" }, true);
  assert.throws(() => updateBooking(first.id, { time: "11:30" }), /unchanged/);
  assert.equal(
    readState().bookings.find((b) => b.id === first.id).time,
    "11:00",
  );
});
test("only matching available doctors can be assigned to pending requests", () => {
  const date = openDate();
  const b = createBooking({
    name: "Demo",
    phone: "0791111111",
    date,
    time: "12:00",
    specialty: "dermatology",
    preferredId: "any",
  });
  assert.throws(
    () => updateBooking(b.id, { doctorId: "layla", status: "confirmed" }),
    /unchanged/,
  );
  const saved = updateBooking(b.id, { doctorId: "omar", status: "confirmed" });
  assert.equal(saved.doctorId, "omar");
  assert.equal(saved.status, "confirmed");
});
test("clinic closure, duration boundaries, and approved time off are respected", () => {
  const s = readState(),
    date = openDate();
  s.timeOff.push({
    doctorId: "omar",
    from: date,
    to: date,
    status: "approved",
  });
  assert.equal(availableDoctors(s, date, "11:00", "dermatology").length, 0);
  assert.equal(availableDoctors(s, date, "16:45", "general").length, 0);
  let friday = today();
  while (weekday(friday) !== 5) friday = addDays(friday, 1);
  assert.equal(availableDoctors(s, friday, "11:00", "general").length, 0);
});
