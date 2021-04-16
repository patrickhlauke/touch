let rAF;
let uniquePoints = [];
let coalescedPoints = [];
let predictedPoints = [];
let totalUniquePoints = 0;
let totalCoalescedPoints = 0;
let rect;

let drawing = false;

const supportsPointerEvents =
  typeof document.defaultView.PointerEvent !== "undefined";

const supportsCoalescedEvents = supportsPointerEvents
  ? document.defaultView.PointerEvent.prototype.getCoalescedEvents
  : undefined;

const supportsPredictedEvents = supportsPointerEvents
  ? document.defaultView.PointerEvent.prototype.getPredictedEvents
  : undefined;

document.querySelector(".support").innerHTML = supportsCoalescedEvents
  ? "showing coalesced points (thick red circles). "
  : "no browser support for coalesced events. ";

document.querySelector(".support").innerHTML += supportsPredictedEvents
  ? "showing predicted points (thin gray circles)."
  : "no browser support for predicted events.";


const container = document.querySelector(".container");

const canvas = document.querySelector("canvas");

const eventPos = event => {
  return typeof event.clientX !== "undefined"
    ? { x: event.clientX, y: event.clientY }
    : { x: event.touches[0].clientX, y: event.touches[0].clientY };
};

resetCanvas();

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointerup", stopDrawing);
if (!supportsPointerEvents) {
  canvas.addEventListener("mousedown", startDrawing);
  canvas.addEventListener("touchstart", startDrawing);
  canvas.addEventListener("mouseup", stopDrawing);
  canvas.addEventListener("touchend", stopDrawing);
  // Needs to be added here or event.preventDefault() won't work in iOS Safari
  // https://bugs.webkit.org/show_bug.cgi?id=184250
  canvas.addEventListener("touchmove", savePoints, {
    passive: false
  });
  canvas.addEventListener("mousemove", savePoints);
}

function startDrawing(event) {
  resetCanvas();
  drawing = true;
  totalUniquePoints = 0;
  totalCoalescedPoints = 0;
  rect = canvas.getBoundingClientRect();
  uniquePoints.push([
    eventPos(event).x - rect.left,
    eventPos(event).y - rect.top
  ]);
  coalescedPoints.push([
    eventPos(event).x - rect.left,
    eventPos(event).y - rect.top
  ]);
  predictedPoints.push([
    eventPos(event).x - rect.left,
    eventPos(event).y - rect.top
  ]);
  canvas.addEventListener("pointermove", savePoints);
  rAF = requestAnimationFrame(drawPoints);
}

function savePoints(event) {
  if (drawing) {
    event.preventDefault();
    if (typeof event.getCoalescedEvents === "function") {
      const events = event.getCoalescedEvents();
      for (const event of events) {
        coalescedPoints.push([
          eventPos(event).x - rect.left,
          eventPos(event).y - rect.top
        ]);
      }
    }
    if (typeof event.getPredictedEvents === "function") {
        const events = event.getPredictedEvents();
        for (const event of events) {
          predictedPoints.push([
            eventPos(event).x - rect.left,
            eventPos(event).y - rect.top
          ]);
        }
      }
    uniquePoints.push([
      eventPos(event).x - rect.left,
      eventPos(event).y - rect.top
    ]);
  }
}

function drawPoints() {
  totalUniquePoints += uniquePoints.length;
  totalCoalescedPoints += coalescedPoints.length;
  const ctx = canvas.getContext("2d");

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#F00";

  coalescedPoints.forEach(point => {
    ctx.beginPath();
    ctx.arc(point[0], point[1], 4, 0, Math.PI * 2, true); // Draw a point using the arc function of the canvas with a point structure.
    ctx.stroke();
  });

  ctx.lineWidth = 1;
  ctx.strokeStyle = "#AAA"

  ctx.beginPath();
  coalescedPoints.forEach(point => {
    ctx.lineTo(point[0], point[1]);
    ctx.moveTo(point[0], point[1]);
  });
  ctx.closePath();
  ctx.stroke();

  /* coalescedPoints = []; */

  ctx.fillStyle = "#444";

  uniquePoints.forEach(point => {
    ctx.beginPath();
    ctx.arc(point[0], point[1], 5, 0, Math.PI * 2, true); // Draw a point using the arc function of the canvas with a point structure.
    ctx.fill();
  });

  ctx.lineWidth = 1;
  ctx.strokeStyle = "#888888"

  predictedPoints.forEach(point => {
    ctx.beginPath();
    ctx.arc(point[0], point[1], 4, 0, Math.PI * 2, true); // Draw a point using the arc function of the canvas with a point structure.
    ctx.stroke();
  });

  predictedPoints = []; 

  if (rAF) {
    rAF = requestAnimationFrame(drawPoints);
  }
}

function stopDrawing() {
  drawing = false;
  canvas.removeEventListener("pointermove", savePoints);
  cancelAnimationFrame(rAF);
  rAF = null;
  drawPoints();
}

function resetCanvas() {
  uniquePoints = [];
  coalescedPoints = [];
  predictedPoints = [];
  totalUniquePoints = 0;
  totalCoalescedPoints = 0;
  const containerRect = container.getBoundingClientRect();
  canvas.width = containerRect.width * window.devicePixelRatio;
  canvas.height = containerRect.height * window.devicePixelRatio;
  const ctx = canvas.getContext("2d");
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}