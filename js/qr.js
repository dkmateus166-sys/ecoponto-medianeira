/* qr.js — REMOVIDO nesta versão.
   O gerador de QR Code apresentou falhas na informação de formato e foi retirado
   do app para que nenhuma tela exiba um código inválido. O protocolo continua
   funcionando por código + link compartilhável. */
(function (root) {
  const api = {
    disponivel: false,
    toCanvas() { return false; },
    generate() { throw new Error("QR Code indisponível nesta versão."); },
    toSvg() { return ""; }
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.QR = api;
})(typeof globalThis !== "undefined" ? globalThis : this);