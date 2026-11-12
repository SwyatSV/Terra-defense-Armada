(function () {
  function showError(error) {
    if (document.getElementById("startup-error")) return;
    var panel = document.createElement("section");
    panel.id = "startup-error";
    panel.setAttribute("role", "alert");
    panel.style.cssText =
      "position:fixed;inset:20px;z-index:1000;overflow:auto;padding:24px;background:#081725;color:#e4f5fc;border:1px solid #42d9ea;border-radius:8px;font:16px/1.5 Segoe UI,Arial,sans-serif";
    var heading = document.createElement("h1");
    heading.textContent = "Не удалось открыть игру / Unable to open game";
    var note = document.createElement("p");
    note.textContent =
      "Сохранения не удалены. Попробуйте обновить страницу. Если ошибка повторится, передайте текст ниже разработчику.";
    var details = document.createElement("pre");
    details.style.cssText =
      "white-space:pre-wrap;overflow-wrap:anywhere;background:#050d17;padding:16px;font-size:13px";
    details.textContent = String(
      (error && (error.stack || error.message)) || error,
    );
    var retry = document.createElement("button");
    retry.textContent = "Обновить страницу / Reload";
    retry.style.cssText = "padding:12px 20px;cursor:pointer";
    retry.onclick = function () {
      location.reload();
    };
    panel.append(heading, note, details, retry);
    document.body.appendChild(panel);
  }
  window.armadaShowError = showError;
  window.addEventListener("error", function (event) {
    if (event.error) showError(event.error);
  });
  window.addEventListener("unhandledrejection", function (event) {
    showError(event.reason);
  });
  setTimeout(function () {
    if (document.getElementById("startup-loading")) {
      showError(
        "Загрузка модулей не завершилась. Адрес: " +
          location.href +
          "\nПопробуйте Ctrl+F5 и проверьте, что локальный сервер запущен.",
      );
    }
  }, 12000);
})();
