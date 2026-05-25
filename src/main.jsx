import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import JSZip from "jszip";
import QRCode from "qrcode";
import "./style.css";

const RATIOS = {
  "IG 4:5": [1080, 1350],
  "Square 1:1": [1080, 1080],
  "Story 9:16": [1080, 1920],
  "Xiaohongshu 3:4": [1080, 1440],
  "WhatsApp Status": [1080, 1920]
};

const MODELS = [
  "JAECOO J7", "JAECOO J5", "PROTON X50", "PROTON X70", "PROTON S70",
  "TIGGO CROSS", "CHERY TIGGO 7 PRO", "CHERY TIGGO 8 PRO", "OMODA 5",
  "JAECOO J8", "TIGGO 9", "BMW 218i", "TOYOTA SUPRA"
];

const DEFAULT = {
  mode: "delivery",
  template: "modern",
  ratio: "IG 4:5",
  title: "DELIVERED",
  subtitle: "SUCCESSFULLY",
  model: "CHERY TIGGO 8 PRO",
  name: "Jayden Ho",
  brand: "JAX AUTO",
  watermark: "@jaydenho.auto",
  whatsapp: "https://wa.me/60172520833",
  promoHeadline: "FREE GIFTS INCLUDED",
  promoOffer: "RM 988 / MONTH",
  gifts: "40% VIGMA Tinted Voucher\nFull Tank Petrol\nGoodies Bag Package (10 Items)\nRFID\nTouch 'n Go Card\nOriginal Carmat\nPolish & Wax\nCar Wash",
  compareTitle: "Which one suits you better?",
  leftModel: "PROTON X50",
  rightModel: "JAECOO J7",
  compareList: "Budget friendly | Premium SUV feel\nCity drive | Family / long distance\nCompact size | Bigger cabin\nPetrol saving | Comfort & safety",
  loanAmount: "135000",
  flatRate: "2.86",
  tenure: "108",
  brightness: 106,
  contrast: 112,
  saturation: 108,
  vignette: 28,
  showLogo: true,
  showWatermark: true,
  showQR: false,
  blurBox: false,
  faceHide: false
};

function loadState() {
  try { return { ...DEFAULT, ...(JSON.parse(localStorage.getItem("jax-final-state")) || {}) }; }
  catch { return DEFAULT; }
}

function fileToImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function fitText(ctx, text, x, y, maxWidth, size, weight = "700", align = "left", color = "#fff", font = "Arial") {
  let s = Number(size);
  ctx.save();
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${s}px ${font}`;
  while (ctx.measureText(String(text)).width > maxWidth && s > 10) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${font}`;
  }
  ctx.fillText(String(text), x, y);
  ctx.restore();
  return s;
}

function wrapText(ctx, text, x, y, maxWidth, size, lineHeight, color = "#fff") {
  ctx.save();
  ctx.font = `500 ${size}px Arial`;
  ctx.fillStyle = color;
  const words = String(text).split(" ");
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line, x, y);
      line = words[i] + " ";
      y += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y);
  ctx.restore();
}

function flatMonthly(loanAmount, flatRate, months) {
  const p = Number(loanAmount) || 0;
  const r = (Number(flatRate) || 0) / 100;
  const m = Number(months) || 0;
  if (!m) return 0;
  const years = m / 12;
  return (p + p * r * years) / m;
}

function App() {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const [state, setState] = useState(loadState);
  const [images, setImages] = useState({ main: null, second: null, logo: null, batch: [] });
  const [qrSrc, setQrSrc] = useState("");
  const [pos, setPos] = useState({
    title: { x: 85, y: 105 },
    logo: { x: 1010, y: 70 },
    watermark: { x: 1010, y: 1292 },
    thanks: { x: 70, y: 1200 },
    name: { x: 1010, y: 1200 },
    box: { x: 70, y: 735, w: 940, h: 390 },
    blur: { x: 420, y: 850, w: 280, h: 90 },
    face: { x: 360, y: 250, w: 220, h: 220 },
    qr: { x: 805, y: 1040, w: 160, h: 160 }
  });

  useEffect(() => {
    localStorage.setItem("jax-final-state", JSON.stringify(state));
    draw();
  }, [state, images, pos, qrSrc]);

  useEffect(() => {
    QRCode.toDataURL(state.whatsapp || "https://wa.me/", { margin: 1, width: 300 })
      .then(setQrSrc)
      .catch(() => setQrSrc(""));
  }, [state.whatsapp]);

  function update(key, value) {
    setState(prev => ({ ...prev, [key]: value }));
  }

  async function uploadOne(e, key) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const img = await fileToImage(file);
    setImages(prev => ({ ...prev, [key]: img }));
  }

  async function uploadBatch(e) {
    const files = Array.from(e.target.files || []).slice(0, 50);
    const batch = [];
    for (const file of files) batch.push(await fileToImage(file));
    setImages(prev => ({ ...prev, batch }));
  }

  function setSize() {
    const canvas = canvasRef.current;
    const [w, h] = RATIOS[state.ratio] || RATIOS["IG 4:5"];
    canvas.width = w;
    canvas.height = h;
  }

  function cover(ctx, img, x = 0, y = 0, w = ctx.canvas.width, h = ctx.canvas.height) {
    if (!img) return;
    const scale = Math.max(w / img.width, h / img.height);
    const nw = img.width * scale;
    const nh = img.height * scale;
    ctx.drawImage(img, x + (w - nw) / 2, y + (h - nh) / 2, nw, nh);
  }

  function base(ctx, customImg = null) {
    const img = customImg || images.main;
    if (img) {
      ctx.save();
      ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
      cover(ctx, img);
      ctx.restore();
    } else {
      ctx.fillStyle = "#222";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      fitText(ctx, "Upload photo", ctx.canvas.width / 2, ctx.canvas.height / 2, ctx.canvas.width - 100, 36, "700", "center", "#aaa");
    }
  }

  function gradient(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const top = ctx.createLinearGradient(0, 0, 0, h * 0.35);
    top.addColorStop(0, "rgba(0,0,0,.58)");
    top.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.42);

    const bottom = ctx.createLinearGradient(0, h * 0.55, 0, h);
    bottom.addColorStop(0, "rgba(0,0,0,0)");
    bottom.addColorStop(1, "rgba(0,0,0,.72)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
  }

  function vignette(ctx) {
    const amount = Number(state.vignette) / 100;
    if (!amount) return;
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .2, w / 2, h / 2, Math.max(w, h) * .75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${amount})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawLogo(ctx) {
    if (!state.showLogo) return;
    if (images.logo) {
      const scale = Math.min(180 / images.logo.width, 80 / images.logo.height);
      const nw = images.logo.width * scale;
      const nh = images.logo.height * scale;
      ctx.drawImage(images.logo, pos.logo.x - nw, pos.logo.y, nw, nh);
    } else {
      fitText(ctx, state.brand.toUpperCase(), pos.logo.x, pos.logo.y + 30, 260, 27, "800", "right", "#fff");
    }
  }

  function drawWatermark(ctx) {
    if (state.showWatermark) {
      fitText(ctx, state.watermark, pos.watermark.x, pos.watermark.y, 360, 20, "500", "right", "rgba(255,255,255,.82)");
    }
  }

  function drawQR(ctx) {
    if (!state.showQR || !qrSrc) return;
    const img = new Image();
    img.src = qrSrc;
    if (img.complete) ctx.drawImage(img, pos.qr.x, pos.qr.y, pos.qr.w, pos.qr.h);
  }

  function drawSelection(ctx, r, label) {
    ctx.save();
    ctx.strokeStyle = "#caa85a";
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 8]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);
    ctx.fillStyle = "#caa85a";
    ctx.fillRect(r.x + r.w - 24, r.y + r.h - 24, 24, 24);
    ctx.fillStyle = "#111";
    ctx.font = "700 12px Arial";
    ctx.fillText("↘", r.x + r.w - 18, r.y + r.h - 7);
    ctx.fillStyle = "rgba(0,0,0,.75)";
    ctx.fillRect(r.x, r.y - 30, 130, 26);
    ctx.fillStyle = "#fff";
    ctx.font = "700 16px Arial";
    ctx.fillText(label, r.x + 8, r.y - 10);
    ctx.restore();
  }

  function privacy(ctx) {
    if (state.blurBox) {
      const b = pos.blur;
      ctx.save();
      ctx.filter = "blur(14px)";
      ctx.drawImage(ctx.canvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h);
      ctx.restore();
      drawSelection(ctx, b, "BLUR");
    }
    if (state.faceHide) {
      const f = pos.face;
      ctx.fillStyle = "rgba(0,0,0,.86)";
      ctx.fillRect(f.x, f.y, f.w, f.h);
      fitText(ctx, "PRIVATE", f.x + f.w / 2, f.y + f.h / 2 + 8, f.w - 20, 26, "800", "center", "#fff");
      drawSelection(ctx, f, "FACE HIDE");
    }
  }

  function delivery(ctx, customImg = null) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    if (state.template === "polaroid") return polaroid(ctx, customImg);

    base(ctx, customImg); gradient(ctx); vignette(ctx);

    if (state.template === "minimal") {
      ctx.fillStyle = "rgba(0,0,0,.78)";
      ctx.fillRect(0, 0, w, 170);
      ctx.fillRect(0, h - 180, w, 180);
    }

    if (state.template === "cinematic") {
      ctx.fillStyle = "rgba(0,0,0,.88)";
      ctx.fillRect(0, 0, w, 130);
      ctx.fillRect(0, h - 170, w, 170);
    }

    ctx.strokeStyle = state.template === "luxury" || state.template === "premiumBlack" ? "#caa85a" : "rgba(255,255,255,.92)";
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, w - 56, h - 56);

    ctx.fillStyle = "#caa85a";
    ctx.fillRect(pos.title.x - 25, pos.title.y - 33, 5, 70);

    const s1 = fitText(ctx, state.title.toUpperCase(), pos.title.x, pos.title.y, Math.min(580, w - pos.title.x - 80), 48, "900");
    const subY = pos.title.y + Math.max(38, s1 * .95);
    const s2 = fitText(ctx, state.subtitle.toUpperCase(), pos.title.x, subY, Math.min(580, w - pos.title.x - 80), 30, "400");
    fitText(ctx, state.model.toUpperCase(), pos.title.x, subY + Math.max(34, s2 * 1.2), Math.min(680, w - pos.title.x - 80), 22, "600", "left", "rgba(255,255,255,.86)");

    ctx.fillStyle = "#fff";
    ctx.font = "italic 68px Brush Script MT, Segoe Script, cursive";
    ctx.fillText("Thank you!", pos.thanks.x, pos.thanks.y);

    ctx.font = "400 22px Arial";
    ctx.fillText("ENJOY YOUR NEW RIDE", pos.thanks.x + 2, pos.thanks.y + 50);

    fitText(ctx, "Delivered by " + state.name, pos.name.x, pos.name.y, 480, 36, "700", "right");
    fitText(ctx, "YOUR CAR ADVISOR", pos.name.x, pos.name.y + 50, 320, 22, "400", "right");

    drawLogo(ctx);
    drawWatermark(ctx);
    drawQR(ctx);
    privacy(ctx);
  }

  function polaroid(ctx, customImg = null) {
    const img = customImg || images.main;
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(0, 0, w, h);

    const m = 70, px = m, py = m, pw = w - m * 2, ph = Math.round(h * .66);
    ctx.shadowColor = "rgba(0,0,0,.25)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#fff";
    ctx.fillRect(m - 18, m - 18, pw + 36, ph + 230);
    ctx.shadowColor = "transparent";

    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      cover(ctx, img, px, py, pw, ph);
      ctx.restore();
    }

    fitText(ctx, "Delivered ♡", m, h - 245, w - m * 2, 72, "400", "left", "#111", "Brush Script MT");
    fitText(ctx, state.model.toUpperCase(), m, h - 190, w - m * 2, 24, "800", "left", "#111");
    fitText(ctx, "Delivered by " + state.name, m, h - 140, w - m * 2, 22, "600", "left", "#111");

    drawWatermark(ctx);
    privacy(ctx);
  }

  function promo(ctx, customImg = null) {
    const w = ctx.canvas.width, h = ctx.canvas.height, b = pos.box;
    base(ctx, customImg);
    ctx.fillStyle = "rgba(0,0,0,.48)";
    ctx.fillRect(0, 0, w, h);
    gradient(ctx); vignette(ctx);

    ctx.fillStyle = "#caa85a";
    ctx.fillRect(0, 0, w, 16);

    drawLogo(ctx);

    fitText(ctx, state.model.toUpperCase(), 70, 95, w - 140, 50, "900");
    fitText(ctx, state.promoHeadline.toUpperCase(), 70, 140, w - 140, 30, "500");

    ctx.fillStyle = "rgba(0,0,0,.74)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "#caa85a";
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    fitText(ctx, state.promoOffer.toUpperCase(), b.x + b.w / 2, b.y + 90, b.w - 60, 74, "900", "center", "#caa85a");

    ctx.fillStyle = "#fff";
    ctx.font = "500 28px Arial";
    state.gifts.split("\n").filter(Boolean).slice(0, 8).forEach((line, i) => {
      ctx.fillText("✓ " + line, b.x + 45, b.y + 150 + i * 35);
    });

    drawWatermark(ctx);
    drawQR(ctx);
    privacy(ctx);
  }

  function compare(ctx) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);
    vignette(ctx); drawLogo(ctx);

    fitText(ctx, state.compareTitle, w / 2, 90, w - 120, 48, "900", "center", "#fff");

    const top = 150, gap = 30, boxH = Math.round(h * .38), bw = (w - 140 - gap) / 2;
    if (images.main) cover(ctx, images.main, 70, top, bw, boxH); else { ctx.fillStyle = "#333"; ctx.fillRect(70, top, bw, boxH); }
    if (images.second) cover(ctx, images.second, 70 + bw + gap, top, bw, boxH); else { ctx.fillStyle = "#333"; ctx.fillRect(70 + bw + gap, top, bw, boxH); }

    ctx.strokeStyle = "#caa85a"; ctx.lineWidth = 3;
    ctx.strokeRect(70, top, bw, boxH);
    ctx.strokeRect(70 + bw + gap, top, bw, boxH);

    fitText(ctx, state.leftModel, 70 + bw / 2, top + boxH + 55, bw, 34, "900", "center");
    fitText(ctx, state.rightModel, 70 + bw + gap + bw / 2, top + boxH + 55, bw, 34, "900", "center");

    let y = top + boxH + 115;
    ctx.font = "500 24px Arial";
    state.compareList.split("\n").filter(Boolean).slice(0, 7).forEach(line => {
      const [l, r] = line.split("|");
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.fillRect(70, y - 28, w - 140, 44);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText((l || "").trim(), 70 + bw / 2, y);
      ctx.fillText((r || "").trim(), 70 + bw + gap + bw / 2, y);
      ctx.textAlign = "left";
      y += 56;
    });

    drawWatermark(ctx);
  }

  function finance(ctx, customImg = null) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    base(ctx, customImg);
    ctx.fillStyle = "rgba(0,0,0,.72)";
    ctx.fillRect(0, 0, w, h);
    vignette(ctx); drawLogo(ctx);

    const monthly = flatMonthly(state.loanAmount, state.flatRate, state.tenure);

    fitText(ctx, "MONTHLY INSTALLMENT", 70, 140, w - 140, 48, "900");
    fitText(ctx, `RM ${Math.round(monthly).toLocaleString()} / MONTH`, w / 2, h * .42, w - 140, 86, "900", "center", "#caa85a");
    fitText(ctx, `${state.model} | Loan RM ${Number(state.loanAmount).toLocaleString()}`, w / 2, h * .50, w - 140, 30, "700", "center");
    fitText(ctx, `Flat Rate ${state.flatRate}% | Tenure ${state.tenure} months`, w / 2, h * .55, w - 140, 26, "500", "center");
    fitText(ctx, "DM / WhatsApp for full quotation", w / 2, h * .70, w - 140, 36, "800", "center", "#fff");

    drawQR(ctx);
    drawWatermark(ctx);
  }

  function review(ctx, customImg = null) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    base(ctx, customImg);
    ctx.fillStyle = "rgba(0,0,0,.62)";
    ctx.fillRect(0, 0, w, h);
    vignette(ctx); drawLogo(ctx);

    fitText(ctx, "CUSTOMER REVIEW", 70, 120, w - 140, 44, "900");

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillRect(70, h * .42, w - 140, 360);
    ctx.strokeStyle = "#caa85a"; ctx.lineWidth = 4;
    ctx.strokeRect(70, h * .42, w - 140, 360);

    fitText(ctx, "★★★★★", w / 2, h * .42 + 75, w - 180, 56, "900", "center", "#caa85a");
    wrapText(ctx, "Fast response, smooth loan process and good service. Recommended!", 120, h * .42 + 145, w - 240, 34, 44, "#111");
    fitText(ctx, "— Happy Customer", w - 110, h * .42 + 310, w - 240, 28, "700", "right", "#111");

    drawWatermark(ctx);
  }

  function collage(ctx) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, w, h);
    drawLogo(ctx);

    const photos = [images.main, images.second, ...images.batch].filter(Boolean).slice(0, 9);
    fitText(ctx, "JAX AUTO DELIVERY GALLERY", w / 2, 90, w - 120, 42, "900", "center");

    if (!photos.length) return;

    const n = photos.length, cols = n <= 2 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
    const gap = 18, top = 140, pad = 50;
    const cellW = (w - pad * 2 - gap * (cols - 1)) / cols;
    const cellH = (h - top - 140 - gap * (rows - 1)) / rows;

    photos.forEach((img, i) => cover(ctx, img, pad + (i % cols) * (cellW + gap), top + Math.floor(i / cols) * (cellH + gap), cellW, cellH));

    drawWatermark(ctx);
  }

  function draw(customImg = null) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSize();
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state.mode === "delivery") delivery(ctx, customImg);
    if (state.mode === "promo") promo(ctx, customImg);
    if (state.mode === "compare") compare(ctx);
    if (state.mode === "finance") finance(ctx, customImg);
    if (state.mode === "review") review(ctx, customImg);
    if (state.mode === "collage") collage(ctx);
  }

  function canvasBlob(type = "image/png", quality = 0.95) {
    return new Promise(resolve => canvasRef.current.toBlob(resolve, type, quality));
  }

  async function downloadFile(type = "image/png") {
    draw();
    const blob = await canvasBlob(type, 0.95);
    const ext = type === "image/jpeg" ? "jpg" : "png";
    const fileName = `jax-auto-editor.${ext}`;

    if (navigator.share && navigator.canShare) {
      const file = new File([blob], fileName, { type });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "JAX AUTO Delivery Studio" });
          return;
        } catch {}
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareImage() {
    draw();
    const blob = await canvasBlob("image/png", 0.95);
    const file = new File([blob], "jax-auto-share.png", { type: "image/png" });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "JAX AUTO",
        text: "JAX AUTO Delivery Studio",
        files: [file]
      });
    } else {
      alert("Your browser does not support direct sharing. Use Download PNG instead.");
    }
  }

  async function downloadZip() {
    if (!images.batch.length) return alert("Upload batch photos first");
    const zip = new JSZip();

    for (let i = 0; i < images.batch.length; i++) {
      draw(images.batch[i]);
      const blob = await canvasBlob("image/png", 0.95);
      zip.file(`jax-auto-${i + 1}.png`, blob);
      await new Promise(r => setTimeout(r, 50));
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jax-auto-batch.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    draw();
  }

  function point(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const p = e.touches?.[0] || e.changedTouches?.[0] || e;
    return {
      x: (p.clientX - rect.left) * (canvasRef.current.width / rect.width),
      y: (p.clientY - rect.top) * (canvasRef.current.height / rect.height)
    };
  }

  function hitRect(r, p) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  function hitHandle(r, p) {
    return p.x >= r.x + r.w - 38 && p.x <= r.x + r.w + 20 && p.y >= r.y + r.h - 38 && p.y <= r.y + r.h + 20;
  }

  function startDrag(e) {
    const p = point(e);

    if (state.blurBox && hitHandle(pos.blur, p)) {
      dragRef.current = { type: "resize", key: "blur", start: p, original: { ...pos.blur } };
      e.preventDefault();
      return;
    }

    if (state.faceHide && hitHandle(pos.face, p)) {
      dragRef.current = { type: "resize", key: "face", start: p, original: { ...pos.face } };
      e.preventDefault();
      return;
    }

    if (state.blurBox && hitRect(pos.blur, p)) {
      dragRef.current = { type: "move", key: "blur", offset: { x: p.x - pos.blur.x, y: p.y - pos.blur.y } };
      e.preventDefault();
      return;
    }

    if (state.faceHide && hitRect(pos.face, p)) {
      dragRef.current = { type: "move", key: "face", offset: { x: p.x - pos.face.x, y: p.y - pos.face.y } };
      e.preventDefault();
    }
  }

  function moveDrag(e) {
    const drag = dragRef.current;
    if (!drag) return;

    const p = point(e);

    setPos(prev => {
      const next = { ...prev };
      const r = { ...next[drag.key] };

      if (drag.type === "move") {
        r.x = Math.max(0, Math.min(canvasRef.current.width - r.w, p.x - drag.offset.x));
        r.y = Math.max(0, Math.min(canvasRef.current.height - r.h, p.y - drag.offset.y));
      }

      if (drag.type === "resize") {
        r.w = Math.max(60, drag.original.w + (p.x - drag.start.x));
        r.h = Math.max(50, drag.original.h + (p.y - drag.start.y));
      }

      next[drag.key] = r;
      return next;
    });

    e.preventDefault();
  }

  function endDrag() {
    dragRef.current = null;
  }

  return (
    <div className="app">
      <aside className="panel">
        <h1>JAX AUTO Delivery Studio</h1>
        <p>Upgrade build · mobile share · draggable privacy tools · custom model</p>

        <div className="modes">
          {["delivery", "promo", "compare", "finance", "review", "collage"].map(m => (
            <button key={m} className={state.mode === m ? "active" : ""} onClick={() => update("mode", m)}>{m.toUpperCase()}</button>
          ))}
        </div>

        <label>Main photo</label><input type="file" accept="image/*" onChange={e => uploadOne(e, "main")} />
        <label>Second photo</label><input type="file" accept="image/*" onChange={e => uploadOne(e, "second")} />
        <label>Logo</label><input type="file" accept="image/*" onChange={e => uploadOne(e, "logo")} />
        <label>Batch photos</label><input type="file" accept="image/*" multiple onChange={uploadBatch} />

        <div className="grid2">
          <div><label>Template</label><select value={state.template} onChange={e => update("template", e.target.value)}>
            <option value="modern">Modern Clean</option>
            <option value="luxury">Luxury Dealer</option>
            <option value="premiumBlack">Premium Black</option>
            <option value="cinematic">Cinematic</option>
            <option value="polaroid">Polaroid</option>
            <option value="minimal">Minimal</option>
          </select></div>
          <div><label>Ratio</label><select value={state.ratio} onChange={e => update("ratio", e.target.value)}>
            {Object.keys(RATIOS).map(r => <option key={r}>{r}</option>)}
          </select></div>
        </div>

        <div className="grid2">
          <div><label>Brightness</label><input type="range" min="75" max="140" value={state.brightness} onChange={e => update("brightness", e.target.value)} /></div>
          <div><label>Contrast</label><input type="range" min="75" max="150" value={state.contrast} onChange={e => update("contrast", e.target.value)} /></div>
          <div><label>Saturation</label><input type="range" min="60" max="170" value={state.saturation} onChange={e => update("saturation", e.target.value)} /></div>
          <div><label>Vignette</label><input type="range" min="0" max="90" value={state.vignette} onChange={e => update("vignette", e.target.value)} /></div>
        </div>

        <label>Custom Model</label>
        <input list="model-list" value={state.model} onChange={e => update("model", e.target.value)} placeholder="Type any model..." />
        <datalist id="model-list">
          {MODELS.map(m => <option key={m} value={m} />)}
        </datalist>

        <div className="modelBtns">
          {MODELS.slice(0, 9).map(m => <button key={m} onClick={() => update("model", m)}>{m}</button>)}
        </div>

        {[
          ["Title", "title"], ["Subtitle", "subtitle"], ["Name", "name"], ["Brand", "brand"],
          ["Watermark", "watermark"], ["WhatsApp / QR Link", "whatsapp"], ["Promo Headline", "promoHeadline"],
          ["Promo Offer", "promoOffer"], ["Compare Title", "compareTitle"], ["Left Model", "leftModel"], ["Right Model", "rightModel"],
          ["Loan Amount", "loanAmount"], ["Flat Rate %", "flatRate"], ["Tenure Months", "tenure"]
        ].map(([label, key]) => (
          <React.Fragment key={key}>
            <label>{label}</label>
            <input value={state[key]} onChange={e => update(key, e.target.value)} />
          </React.Fragment>
        ))}

        <label>Gift List</label><textarea value={state.gifts} onChange={e => update("gifts", e.target.value)} />
        <label>Compare List: left | right</label><textarea value={state.compareList} onChange={e => update("compareList", e.target.value)} />

        <div className="checks">
          <label><input type="checkbox" checked={state.showLogo} onChange={e => update("showLogo", e.target.checked)} /> Show logo</label>
          <label><input type="checkbox" checked={state.showWatermark} onChange={e => update("showWatermark", e.target.checked)} /> Show watermark</label>
          <label><input type="checkbox" checked={state.showQR} onChange={e => update("showQR", e.target.checked)} /> Show QR</label>
          <label><input type="checkbox" checked={state.blurBox} onChange={e => update("blurBox", e.target.checked)} /> Blur plate box</label>
          <label><input type="checkbox" checked={state.faceHide} onChange={e => update("faceHide", e.target.checked)} /> Face hide box</label>
        </div>

        <button onClick={() => downloadFile("image/png")}>Download PNG / Share</button>
        <button onClick={() => downloadFile("image/jpeg")} className="secondary">Download JPG / Share</button>
        <button onClick={shareImage} className="secondary">Share / Save to Photos</button>
        <button onClick={downloadZip} className="secondary">Batch ZIP Download</button>
        <button onClick={() => { localStorage.clear(); location.reload(); }} className="secondary">Reset Settings</button>
      </aside>

      <main className="preview">
        <canvas
          ref={canvasRef}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onTouchStart={startDrag}
          onTouchMove={moveDrag}
          onTouchEnd={endDrag}
        />
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
