let rAF;
let uniquePoints = [];
let rect;

let activePointerId = null;

const supportsPointerEvents =
  typeof document.defaultView.PointerEvent !== "undefined";

const container = document.querySelector(".container");

const canvas = document.querySelector("canvas");

const eventPos = event => {
  return { x: event.clientX, y: event.clientY };
};

initialiseCanvas();
resetCanvas();

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointerout", stopDrawing);

function startDrawing(event) {
  /* bail if there's already an active pointer that's doing the drawing, or if it's not a primary pointer */
  if (activePointerId || !event.isPrimary) { return; }
  resetCanvas();
  activePointerId = event.pointerId;
  rect = canvas.getBoundingClientRect();
  uniquePoints.push([
    eventPos(event).x - rect.left,
    eventPos(event).y - rect.top
  ]);
  canvas.addEventListener("pointermove", savePoints);
  rAF = requestAnimationFrame(drawPoints);
}

function savePoints(event) {
  console.log('saving points');
  /* only save points if they're from the pointer we started tracking */
  if (event.pointerId === activePointerId) {
    event.preventDefault();

    uniquePoints.push([
      eventPos(event).x - rect.left,
      eventPos(event).y - rect.top
    ]);
  }
}

function drawPoints() {
  console.log('drawing points');
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#444";

  uniquePoints.forEach(point => {
    ctx.beginPath();
    ctx.arc(point[0], point[1], 5, 0, Math.PI * 2, true);
    ctx.fill();
  });

  uniquePoints = uniquePoints.slice(-4); /* free up some memory/processing */
 
  /* draw continuous line for the points */

  ctx.lineWidth = 1;
  ctx.strokeStyle = "#AAA"; /* if there are no non-coalesced raw points, make it solid */

  ctx.beginPath();
  uniquePoints.forEach(point => {
    ctx.lineTo(point[0], point[1]);
    ctx.moveTo(point[0], point[1]);
  });
  ctx.closePath();
  ctx.stroke();
    
  if (rAF) {
    rAF = requestAnimationFrame(drawPoints);
  }
}

function stopDrawing() {
  activePointerId = null;
  canvas.removeEventListener("pointermove", savePoints);
  cancelAnimationFrame(rAF);
  rAF = null;
  drawPoints();
}

function initialiseCanvas() {
  const containerRect = container.getBoundingClientRect();
  canvas.width = containerRect.width * window.devicePixelRatio;
  canvas.height = containerRect.height * window.devicePixelRatio;
  const ctx = canvas.getContext("2d");
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

function resetCanvas() {
  uniquePoints = [];
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
console.log('test')