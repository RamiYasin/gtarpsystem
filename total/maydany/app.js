(() => {
  "use strict";

  let loadedRows = [];
  let lastResults = [];

  const $ = id => document.getElementById(id);

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));

  function normalizeId(v){
    return String(v ?? "").trim();
  }

  function parseDate(v){
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // يستخرج العدد فقط من الرسائل التي تحتوي على:
  // سيناريوهات
  // العدد:[ 20 ]
  // يستخرج العدد من رسائل "سيناريوهات" أو "تقارير".
  // أمثلة:
  // سيناريوهات
  // العدد:[ 20 ]
  //
  // تقارير
  // العدد:[16]
  // يرجع نوع الرسالة والعدد المستخرج.
  // يدعم:
  // سيناريوهات -> العدد:[20]
  // تقارير     -> العدد:[16]
  function extractReportScenario(content){
    const text = String(content ?? "")
      .replace(/\u001b\[[0-9;]*m/g, "")
      .replace(/\\u001b\[[0-9;]*m/g, "")
      .replace(/\\x1b\[[0-9;]*m/g, "");

    let type = null;

    if (text.includes("سيناريوهات")) {
      type = "scenario";
    } else if (text.includes("تقارير")) {
      type = "report";
    }

    if (!type) {
      return null;
    }

    const match = text.match(
      /العدد\s*:\s*\[\s*(\d+(?:[.,]\d+)?)\s*\]/u
    );

    if (!match) {
      return null;
    }

    return {
      type,
      value: Number(match[1].replace(",", "."))
    };
  }
  function extractChannelId(input){
    const v = String(input ?? "").trim();
    if (!v) return "";
    const m = v.match(/channels\/(\d+)\/(\d+)/i);
    return m ? m[2] : (/^\d+$/.test(v) ? v : "");
  }

  // The uploaded response has: messages -> [ [message], [message], ... ]
  // This walker also tolerates future nesting changes.
  function extractMessages(payload){
    const out = [];
    const seen = new Set();

    function walk(node){
      if (!node || typeof node !== "object") return;

      if (Array.isArray(node)){
        for (const item of node) walk(item);
        return;
      }

      const authorId = node.author?.id;
      const channelId = node.channel_id;
      const timestamp = node.timestamp;
      const messageId = node.id;

      if (
        typeof authorId === "string" &&
        typeof channelId === "string" &&
        typeof timestamp === "string" &&
        typeof messageId === "string"
      ){
        if (!seen.has(messageId)){
          seen.add(messageId);
          out.push({
            id: messageId,
            userId: authorId,
            username: node.author?.username || "",
            globalName: node.author?.global_name || "",
            channelId,
            timestamp,
            content: typeof node.content === "string" ? node.content : "",
            reportScenario: extractReportScenario(node.content)
          });
        }
        return;
      }

      for (const value of Object.values(node)) walk(value);
    }

    walk(payload);
    return out;
  }

  function setStatus(el, text, error=false){
    el.textContent = (error ? "❌ " : "") + text;
  }

  async function loadText(text, source){
    try{
      const payload = JSON.parse(text);
      loadedRows = extractMessages(payload);

      if (!loadedRows.length){
        throw new Error("لم أجد رسائل بصيغة Discord المتوقعة.");
      }

      setStatus($("dataStatus"),
        `تم تحميل ${loadedRows.length} رسالة من ${source}.`
      );
    }catch(err){
      loadedRows = [];
      setStatus($("dataStatus"), err.message, true);
    }
  }

  $("jsonFile").addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await loadText(text, file.name);
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(x => x.classList.remove("active"));
      tab.classList.add("active");
      $(tab.dataset.tab + "Tab").classList.add("active");
    });
  });

  $("jsonText").addEventListener("input", async () => {
    const text = $("jsonText").value.trim();
    if (text) await loadText(text, "النص الملصق");
  });

  $("check").addEventListener("click", () => {
    try{
      if (!loadedRows.length){
        throw new Error("حمّل ملف JSON أو الصق Response أولًا.");
      }

      const channelId = extractChannelId($("channel").value);
      if (!channelId){
        throw new Error("أدخل رابط القناة أو Channel ID صحيحًا.");
      }

      // البحث الأساسي يتم بواسطة Username فقط، وليس User ID.
      const users = $("users").value
        .split(/\r?\n/)
        .map(x => String(x).trim().replace(/^@+/, "").trim())
        .filter(Boolean);

      if (!users.length){
        throw new Error("أدخل Username واحدًا على الأقل.");
      }

      const wanted = new Set(users.map(x => x.toLowerCase()));

      const matches = loadedRows.filter(row => {
        const d = parseDate(row.timestamp);
        const rowUsername = String(row.username || "").trim().toLowerCase();

        return d &&
          row.channelId === channelId &&
          wanted.has(rowUsername);
      }).sort((a,b) => parseDate(a.timestamp) - parseDate(b.timestamp));

      lastResults = users.map(username => {
        const rows = matches.filter(x =>
          String(x.username || "").trim().toLowerCase() === username.toLowerCase()
        );

        return {
          username: rows.find(x => x.username)?.username || username,
          userId: rows.find(x => x.userId)?.userId || "",
          globalName: rows.find(x => x.globalName)?.globalName || "",
          count: rows.length,
          scenarioTotal: rows.reduce(
            (sum, row) =>
              sum + (
                row.reportScenario?.type === "scenario"
                  ? row.reportScenario.value
                  : 0
              ),
            0
          ),

          reportTotal: rows.reduce(
            (sum, row) =>
              sum + (
                row.reportScenario?.type === "report"
                  ? row.reportScenario.value
                  : 0
              ),
            0
          ),
          first: rows[0]?.timestamp || "",
          last: rows.at(-1)?.timestamp || "",
          messages: rows
        };
      });

      render(lastResults, channelId);
      setStatus($("checkStatus"),
        `تم الفحص: ${matches.length} رسالة مطابقة ضمن ${loadedRows.length} رسالة محمّلة.`
      );
    }catch(err){
      setStatus($("checkStatus"), err.message, true);
      $("summaryCard").hidden = true;
      $("messagesCard").hidden = true;
    }
  });

  function formatDate(value){
    const d = parseDate(value);
    return d ? new Intl.DateTimeFormat("ar", {
      dateStyle:"medium", timeStyle:"short"
    }).format(d) : "—";
  }

  function render(results, channelId){
    $("summaryCard").hidden = false;

    const sent = results.filter(r => r.count > 0).length;
    const total = results.length;
    const totalMessages = results.reduce((n,r) => n + r.count, 0);

    const scenarioTotal = results.reduce(
      (n, r) => n + r.scenarioTotal,
      0
    );

    const reportTotal = results.reduce(
      (n, r) => n + r.reportTotal,
      0
    );

    $("summaryMeta").textContent =
      `القناة: ${channelId} • تم البحث في جميع البيانات المحمّلة`;

    $("summaryBoxes").innerHTML = `
      <div class="box"><b>${total}</b><span>عدد المستخدمين</span></div>
      <div class="box"><b>${sent}</b><span>أرسلوا</span></div>
      <div class="box"><b>${totalMessages}</b><span>إجمالي الرسائل</span></div>
      <div class="box"><b>${scenarioTotal}</b><span>مجموع السيناريوهات</span></div>
      <div class="box"><b>${reportTotal}</b><span>مجموع التقارير</span></div>
    `;

    $("resultsBody").innerHTML = results.map(r => `
      <tr>
        <td dir="ltr">${esc(r.username || "—")}</td>
        <td dir="ltr">${esc(r.userId || "—")}</td>
        <td>${esc(r.globalName || "—")}</td>
        <td class="${r.count ? "ok" : "bad"}">${r.count ? "✅ أرسل" : "❌ لم يرسل"}</td>
        <td>${r.count}</td>
        <td><strong>${r.scenarioTotal ?? 0}</strong></td>
        <td>${formatDate(r.first)}</td>
        <td>${formatDate(r.last)}</td>
      </tr>
    `).join("");

    const allMessages = results.flatMap(r => r.messages.map(m => ({...m, userId:r.userId})));
    $("messagesCard").hidden = !allMessages.length;

    $("messagesList").innerHTML = allMessages.map(m => `
      <article class="message">
        <div class="message-meta">${esc(m.userId)} • ${esc(formatDate(m.timestamp))}</div>
        <div class="message-text">${esc(m.content || "(بدون نص)")}</div>
        ${
          m.reportScenario
            ? `<div class="message-meta">🔢 ${
                m.reportScenario.type === "scenario"
                  ? "السيناريوهات"
                  : "التقارير"
              }: ${m.reportScenario.value}</div>`
            : ""
        }
      </article>
    `).join("");
  }

  $("downloadCsv")?.addEventListener(
    "click",
    () => {

      if (!lastResults.length) {
        return;
      }

      // تصدير TXT:
      // @Username
      // السيناريوهات: 20
      // التقارير: 16
      const lines = [];

      lastResults.forEach(r => {

        const username =
          String(r.username || "")
            .trim()
            .replace(/^@+/, "");

        lines.push(`@${username}`);
        lines.push(`السيناريوهات: ${r.scenarioTotal ?? 0}`);
        lines.push(`التقارير: ${r.reportTotal ?? 0}`);
        lines.push("");

      });

      const txt =
        lines.join("\n").trim() + "\n";

      const blob =
        new Blob(
          ["\ufeff" + txt],
          {
            type: "text/plain;charset=utf-8"
          }
        );

      const a =
        document.createElement("a");

      const url =
        URL.createObjectURL(blob);

      a.href = url;
      a.download = "discord-check-results.txt";
      a.click();

      URL.revokeObjectURL(url);
    }
  );

  // =========================
  // مسح
  // =========================
  $("clear").addEventListener("click", () => {
    loadedRows = [];
    lastResults = [];
    $("jsonFile").value = "";
    $("jsonText").value = "";
    $("channel").value = "";
    $("users").value = "";
    $("summaryCard").hidden = true;
    $("messagesCard").hidden = true;
    $("messagesList").innerHTML = "";
    setStatus($("dataStatus"), "لم يتم تحميل بيانات بعد.");
    setStatus($("checkStatus"), "جاهز.");
  });
})();
