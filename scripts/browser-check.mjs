import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const targets = await fetch("http://127.0.0.1:9333/json").then((r) => r.json());
const target = targets.find((t) => t.type === "page");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) =>
  socket.addEventListener("open", resolve, { once: true }),
);
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const p = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) p.reject(new Error(JSON.stringify(message.error)));
    else p.resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown")
    errors.push(
      message.params.exceptionDetails.text +
        " " +
        (message.params.exceptionDetails.exception?.description || ""),
    );
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails)
    throw new Error(
      r.exceptionDetails.exception?.description || r.exceptionDetails.text,
    );
  return r.result.value;
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: "http://localhost:4173" });
await pause(1000);
await evaluate("localStorage.clear();sessionStorage.clear();location.reload()");
await pause(700);
await evaluate("document.fonts.ready");
await evaluate(
  "Promise.all([...document.images].map(image=>{image.loading='eager';return image.decode();}))",
);
await mkdir(new URL("../qa/", import.meta.url), { recursive: true });
async function screenshot(name) {
  await evaluate(
    'document.querySelector("#toast").classList.remove("visible")',
  );
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(
    new URL("../qa/" + name + ".png", import.meta.url),
    Buffer.from(shot.data, "base64"),
  );
}
async function navigate(path) {
  await evaluate(`location.hash=${JSON.stringify(path)}`);
  await pause(180);
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await pause(150);
}
async function fill(selector, value) {
  await evaluate(
    `document.querySelector(${JSON.stringify(selector)}).value=${JSON.stringify(value)}`,
  );
}
async function submit(selector) {
  await evaluate(
    `document.querySelector(${JSON.stringify(selector)}).requestSubmit()`,
  );
  await pause(600);
}
assert.equal(
  await evaluate('document.querySelector("h1").textContent'),
  "Book your next visit with ease.",
);
assert.ok(
  await evaluate(
    "[...document.images].every(i=>!i.complete||i.naturalWidth>0)",
  ),
);
assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
await screenshot("landing-desktop");
await evaluate(
  'document.querySelector("[data-specialty=cardiology]").focus({preventScroll:true}); window.scrollTo({top:document.querySelector("#services").offsetTop,behavior:"instant"})',
);
await pause(250);
await screenshot("services-desktop");
await click('[data-specialty="cardiology"] .service-booking-link');
assert.equal(await evaluate("location.hash"), "#/book/date");
assert.equal(
  await evaluate(
    'document.querySelector("#preferred-doctor").closest("label").textContent.includes("Cardiology")',
  ),
  true,
);
await navigate("/book/specialty");
await click('[data-action="specialty"][data-id="dermatology"]');
await navigate("/book/date");
await click(".calendar-day.available:not(:disabled)");
await click('[data-action="date-continue"]');
await click(".slot:not(:disabled)");
await click('[data-action="time-continue"]');
await screenshot("booking-desktop");
await fill('[name="name"]', "Browser Test Patient");
await fill('[name="phone"]', "0791111122");
await submit("#details-form");
await fill('[name="code"]', "000000");
await submit("#booking-verify");
assert.ok(
  await evaluate(
    'document.querySelector("#form-error").textContent.includes("incorrect")',
  ),
);
await fill('[name="code"]', "482106");
await submit("#booking-verify");
assert.ok(await evaluate('location.hash.startsWith("#/receipt/")'));
const created = await evaluate(
  'JSON.parse(localStorage.getItem("careslot.frontend.v1")).bookings.find(b=>b.name==="Browser Test Patient")',
);
assert.equal(created.status, "pending");
await navigate("/lookup");
await fill('[name="phone"]', "0791111122");
await submit("#lookup-phone");
await fill('[name="code"]', "482106");
await submit("#lookup-verify");
assert.ok(
  await evaluate(
    'document.querySelector(".lookup-list").textContent.includes("Browser Test Patient")',
  ),
);
await navigate("/booking/" + created.id);
await click('[data-action="reschedule"]');
await submit("#reschedule-form");
assert.ok(await evaluate('!document.querySelector("dialog").open'));
await click('[data-action="cancel"]');
await submit("#cancel-form");
assert.equal(
  await evaluate(
    `JSON.parse(localStorage.getItem('careslot.frontend.v1')).bookings.find(b=>b.id===${JSON.stringify(created.id)}).status`,
  ),
  "cancelled",
);
await navigate("/login");
await click('[data-action="demo-role"][data-role="staff"]');
await submit("#login-form");
assert.ok(await evaluate('document.querySelector(".metrics")!==null'));
await screenshot("staff-desktop");
await click('[data-action="assign"]');
await submit("#assign-form");
assert.ok(await evaluate('!document.querySelector("dialog").open'));
await navigate("/workspace/doctors");
assert.ok(
  await evaluate('document.querySelectorAll(".directory-card-row").length>=6'),
);
await click('[data-action="toggle-doctor"][data-id="maya"]');
assert.equal(
  await evaluate(
    'document.querySelector("[data-action=toggle-doctor][data-id=maya]").getAttribute("aria-checked")',
  ),
  "false",
);
await click('[data-action="toggle-doctor"][data-id="maya"]');
await navigate("/workspace/availability");
assert.ok(await evaluate('document.querySelector("#hours-form")!==null'));
await navigate("/login");
await click('[data-action="demo-role"][data-role="doctor"]');
await submit("#login-form");
await navigate("/workspace/doctors");
assert.ok(
  await evaluate(
    'document.querySelector("h1").textContent.includes("managed by clinic staff")',
  ),
);
await navigate("/workspace/timeoff");
await submit("#timeoff-form");
assert.equal(
  await evaluate(
    'JSON.parse(localStorage.getItem("careslot.frontend.v1")).timeOff.length',
  ),
  1,
);
await navigate("/");
await click('[data-action="chat-open"]');
await click('[data-action="chat-find"]');
await click('[data-action="chat-specialty"][data-specialty="dermatology"]');
await pause(700);
assert.ok(
  await evaluate('document.querySelector("[data-action=chat-slot]")!==null'),
);
await click('[data-action="chat-slot"]');
await screenshot("chat-desktop");
await click('[data-action="chat-continue"]');
assert.equal(await evaluate("location.hash"), "#/book/details");
assert.ok(
  await evaluate(
    'document.querySelector(".summary-inline").textContent.includes("Dr. Omar Haddad")',
  ),
);
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await navigate("/");
await pause(200);
assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
await screenshot("landing-mobile");
assert.equal(
  await evaluate(
    'Math.round(document.querySelector(".hero-photo").getBoundingClientRect().height)',
  ),
  300,
);
await click('[data-action="language"]');
assert.equal(await evaluate("document.documentElement.dir"), "rtl");
assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
await screenshot("landing-arabic");
await click('[data-action="chat-open"]');
assert.equal(await evaluate('document.querySelector("#app").inert'), true);
await evaluate('document.querySelector("#chat-form button").focus()');
await send("Input.dispatchKeyEvent", {
  type: "keyDown",
  key: "Tab",
  code: "Tab",
  windowsVirtualKeyCode: 9,
});
assert.equal(
  await evaluate('document.activeElement.classList.contains("chat-close")'),
  true,
);
await screenshot("chat-mobile-arabic");
await click('[data-action="chat-close"]');
assert.equal(await evaluate('document.querySelector("#app").inert'), false);
assert.deepEqual(errors, []);
await evaluate(
  'localStorage.clear();sessionStorage.clear();location.hash="/";location.reload()',
);
await pause(300);
console.log(
  "PASS: responsive landing, local assets, booking verification, lookup, rescheduling, cancellation, staff assignment, doctor permissions, time off, shared-data chatbot, and Arabic RTL.",
);
console.log("Screenshots saved in careslot/qa/.");
socket.close();
