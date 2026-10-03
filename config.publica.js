/* ==========================================================================
   config.publica.js  -  Configuracion publica de creaCERTIFICACION
   --------------------------------------------------------------------------
   Este archivo SI se publica. Por eso NO puede contener secretos:
   nada de API keys, tokens, contrasenas, certificados ni IDs de hojas
   privadas. Estandar GJVcorp v1.1 §7.8.11.

   QUE VIVE AQUI
     Solo URLs de endpoints PUBLICOS autorizados. La clave y los datos
     permanecen en el proveedor del servicio (Google Apps Script).

   COMO SE CAMBIA EL ENDPOINT
     Editar ENDPOINT_LICENCIA y volver a subir este archivo.
     Alternativa sin tocar el archivo, antes de que cargue app.js:
       window.IVA_CERT_CONFIG.endpointLicencia = "https://.../exec";

   CONTRATO DEL ENDPOINT  (POST, Content-Type: text/plain;charset=utf-8)
     Envia : { "ruc": "1790012345001" }
     Debe responder JSON:
       {
         "ok": true, "ruc": "...", "nombre": "...",
         "tipoServicio": "recuperaIVA", "plan": "PREMIUM",
         "clase": "...", "caduca": "31/12/2026",
         "estado": "ACTIVA | CADUCADA | SIN_ACTIVAR",
         "vigente": true,
         "filas": [ ... ]     // TODAS las filas del RUC (renovaciones)
       }
     Si el RUC no existe: { "ok": false, "code": "NO_ENCONTRADO" }
     Si algo falla:       { "ok": false, "code": "...", "message": "motivo" }

   PROHIBIDO volver a consultar Google Sheets directamente desde el
   navegador: eso exponia la API key y la base completa de clientes.
   ========================================================================== */
(function () {
  'use strict';

  window.IVA_CERT_CONFIG = {
    /* Worker de consulta de licencias (ruta /cliente).
       Mismo servicio que ya usa GJVcorp ir00 areaCLIENTES.
       Si cambia de Worker, se cambia SOLO esta linea. */
    endpointLicencia: 'https://dbcorp-consulta.jimenezlg.workers.dev/cliente',

    /* Milisegundos maximos de espera antes de tratar la consulta como fallida. */
    timeoutLicenciaMs: 12000,

    /* Periodo de gracia: una licencia caducada dentro de estos meses aun permite
       emitir. Debe coincidir con la regla del backend. */
    mesesGracia: 6
  };
})();
