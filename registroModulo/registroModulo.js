// registroModulo.js
// Modulo independiente: "Renovacion / Registro"
// - Carga dinamica de HTML + CSS del modal (si no existen)
// - Expone window.RegistroModulo.mostrarModalRegistro(...)
// - No depende de frameworks
//
// SEGURIDAD (Estandar GJVcorp v1.1 §7.8.11)
//   Este archivo NO contiene el endpoint del backend de registro. Un endpoint
//   de Apps Script publicado es invocable por cualquiera que lea el codigo:
//   dejarlo aqui permitia inyectar registros falsos en la base de licencias.
//   El envio se resuelve en el servidor (ver 00 MANUAL ... Publicacion Web.md).

(function () {
  'use strict';

  // --- Configuracion ---
  // Vacio a proposito. Si el registro debe enviarse desde el navegador, se
  // configura en tiempo de ejecucion desde el backend, nunca en el repositorio:
  //   RegistroModulo.configurar({ backendUrl: "https://.../exec" });
  const config = { backendUrl: '' };

  // --- Resolver basePath (funciona aunque abras /registroModulo/ o /) ---
  function getBasePath() {
    try {
      const script = document.currentScript;
      if (script && script.src) {
        return script.src.substring(0, script.src.lastIndexOf('/') + 1);
      }
    } catch (_) {}
    // fallback (si el script se concatena)
    return 'registroModulo/';
  }
  const basePath = getBasePath();

  function hayBackend() {
    return typeof config.backendUrl === 'string' && config.backendUrl.trim() !== '';
  }

  // --- Recursos del modulo ---
  /* Hasta H6 esta funcion intentaba, ademas, descargar `registroModulo.html` con
     `fetch` cuando no encontraba el modal en la pagina. Eso tenia dos problemas:

       1. El HTML del modal vive en `index.html` desde v41. El `fetch` era una
          rama muerta que solo se activaba si el marcado no estaba, y en ese caso
          inyectaba una SEGUNDA copia del formulario, con los mismos ids.
       2. `fetch` no funciona al abrir el proyecto con `file://`, que es como se
          usa esta herramienta en local: habria fallado justo en ese caso.

     Se retira la descarga y se conserva la comprobacion del CSS, que si puede
     faltar si la pagina lo carga por otra via. `registroModulo.html` se elimina
     del proyecto: era una copia que podia quedar desincronizada de `index.html`. */
  async function cargarRecursos() {
    // El modal ya viene en la pagina. Si no esta, es un fallo del marcado.
    if (!document.getElementById('modalSuscripcion')) {
      throw new Error('No se encontro el formulario de registro en la pagina.');
    }

    // CSS del modal, si la pagina no lo cargo desde el encabezado
    if (!document.getElementById('iva-registro-css')) {
      const link = document.createElement('link');
      link.id = 'iva-registro-css';
      link.rel = 'stylesheet';
      link.href = basePath + 'registroModulo.css';
      document.head.appendChild(link);
    }
  }

  // --- Plan sugerido segun saldo ---
  function determinarPlanSugerido(saldo) {
    const saldoNum = parseFloat(String(saldo).replace(/[^0-9.-]+/g, "")) || 0;
    if (saldoNum > 2500) return 'CONTACTAR';
    if (saldoNum > 1200) return 'PREMIUM';
    if (saldoNum > 400) return 'BASICA';
    return 'REGISTRO';
  }

  function valorInversion(plan) {
    switch (plan) {
      case 'REGISTRO': return 'INVERSION: USD 9.00';
      case 'BASICA': return 'INVERSION: USD 29.00';
      case 'PREMIUM': return 'INVERSION: USD 49.00';
      case 'CONTACTAR': return 'Por favor contactenos para cotizacion personalizada';
      default: return '';
    }
  }

  // --- Util: fecha caduca (30 dias) ---
  function fechaCaducaISO(dias = 30) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    // formato dd/mm/yyyy
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // --- Mostrar modal ---
  async function mostrarModalRegistro(nombrePlan, datosPlan) {
    // Compatibilidad: mostrarModalRegistro(datosPlan)
    if (typeof nombrePlan === 'object' && datosPlan === undefined) {
      datosPlan = nombrePlan;
      nombrePlan = 'REGISTRO';
    }

    // La API publica puede invocarse antes de que finalice la carga automatica
    // del HTML. Garantizar aqui los recursos evita que el boton no haga nada.
    if (!document.getElementById('modalSuscripcion')) {
      await cargarRecursos();
      inicializarEventListeners();
    }
    const modal = document.getElementById('modalSuscripcion');
    if (!modal) throw new Error('No se pudo inicializar el formulario de registro.');

    // Prellenar campos desde los datos recibidos
    if (datosPlan && datosPlan.ruc) {
      const el = document.getElementById('inputRUC');
      if (el) el.value = String(datosPlan.ruc).trim();
    }
    if (datosPlan && datosPlan.razonSocial) {
      const el = document.getElementById('inputNombres');
      if (el) el.value = String(datosPlan.razonSocial).trim();
    }
    if (datosPlan && datosPlan.direccion) {
      const el = document.getElementById('inputDireccion');
      if (el) el.value = String(datosPlan.direccion).trim();
    }

    // Mostrar saldo y plan segun datos recibidos
    const infoSaldo = document.getElementById('infoSaldo');
    const montoSaldo = document.getElementById('montoSaldo');
    const nombrePlanSugerido = document.getElementById('nombrePlanSugerido');
    const valorLicencia = document.getElementById('valorLicencia');

    let saldo = '';
    let planSugerido = 'REGISTRO';
    if (datosPlan && typeof datosPlan.saldo !== 'undefined' && datosPlan.saldo !== null && !isNaN(Number(datosPlan.saldo))) {
      saldo = String(datosPlan.saldo);
    }
    if (datosPlan && typeof datosPlan.plan === 'string') {
      planSugerido = datosPlan.plan;
    } else if (saldo !== '') {
      planSugerido = determinarPlanSugerido(saldo);
    }
    if (infoSaldo) {
      infoSaldo.hidden = false;
      if (montoSaldo) montoSaldo.textContent = `$${saldo}`;
      modal.dataset.planSugerido = planSugerido;
      if (nombrePlanSugerido) nombrePlanSugerido.textContent = planSugerido;
      if (valorLicencia) valorLicencia.textContent = valorInversion(planSugerido);
    }

    // Limpiar campos editables
    const email = document.getElementById('inputEmail');
    const tel = document.getElementById('inputTelefono');
    const dir = document.getElementById('inputDireccion');
    if (email) email.value = '';
    if (tel) tel.value = '';
    if (dir && (!datosPlan || !datosPlan.direccion)) dir.value = '';

    modal.hidden = false;
  }

  function cerrarModalSuscripcion() {
    const modal = document.getElementById('modalSuscripcion');
    if (modal) modal.hidden = true;
  }

  // --- Enviar formulario ---
  async function enviarFormularioRegistro() {
    const form = document.getElementById('formRegistro');
    if (!form) return;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Sin endpoint configurado no se puede guardar nada. Se dice con claridad
    // en lugar de simular un exito (Estandar §7.6).
    if (!hayBackend()) {
      alert(
        'No se guardo el registro.\n\n' +
        'Falto configurar el servicio de registro. ' +
        'Contactenos indicando su RUC para completar la renovacion.'
      );
      return;
    }

    const ruc = (document.getElementById('inputRUC')?.value || '').trim();
    const nombres = (document.getElementById('inputNombres')?.value || '').trim();
    const email = (document.getElementById('inputEmail')?.value || '').trim();
    const telefono = (document.getElementById('inputTelefono')?.value || '').trim();
    const direccion = (document.getElementById('inputDireccion')?.value || '').trim() || 'No especificada';

    const montoSaldoElem = document.getElementById('montoSaldo');
    const saldo = montoSaldoElem ? String(montoSaldoElem.textContent || '').replace('$', '').trim() : '0.00';

    const modal = document.getElementById('modalSuscripcion');
    const planSugerido = (modal && modal.dataset && modal.dataset.planSugerido) ? modal.dataset.planSugerido : 'REGISTRO';

    // clave: 6 digitos del RUC (posicion 4 a 9)
    let clave = '';
    if (planSugerido !== 'CONTACTAR' && ruc && ruc.length >= 9) clave = ruc.substring(3, 9);

    let versionContratar = '';
    switch (planSugerido) {
      case 'REGISTRO': versionContratar = 'version REGISTRO (USD 9)'; break;
      case 'BASICA': versionContratar = 'version BASICA (USD 29)'; break;
      case 'PREMIUM': versionContratar = 'version PREMIUM (USD 49)'; break;
      case 'CONTACTAR': versionContratar = 'ASESORIA - Cotizacion Personalizada'; break;
    }

    const datosRegistro = {
      ruc: ruc,
      razonSocial: nombres,
      direccion: direccion,
      email: email,
      telefono: "'" + telefono,
      deseaContratar: 'SI',
      numeroIngreso: '',
      tipoServicio: (window.TIPO_TRAMITE || 'recuperaIVA'),
      versionContratar: versionContratar,
      clave: "'" + clave,
      clase: planSugerido,
      saldo: saldo,
      plan: planSugerido
    };

    const botonConfirmar = document.getElementById('btnConfirmarRegistro');
    const textoBoton = botonConfirmar ? botonConfirmar.textContent : '';
    if (botonConfirmar) {
      botonConfirmar.disabled = true;
      botonConfirmar.textContent = 'GUARDANDO...';
    }

    try {
      const respuesta = await fetch(config.backendUrl, {
        method: 'POST',
        redirect: 'follow',
        // text/plain evita una peticion OPTIONS y mantiene el JSON esperado por Apps Script.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(datosRegistro)
      });

      if (!respuesta.ok) throw new Error(`El servicio respondio HTTP ${respuesta.status}`);
      const textoRespuesta = await respuesta.text();
      let resultadoBackend;
      try {
        resultadoBackend = JSON.parse(textoRespuesta);
      } catch (_) {
        throw new Error('El servicio no devolvio una confirmacion valida.');
      }
      if (!resultadoBackend || resultadoBackend.success !== true) {
        throw new Error((resultadoBackend && resultadoBackend.message) || 'El servicio rechazo el registro.');
      }

      form.reset();
      cerrarModalSuscripcion();
      mostrarModalConfirmacion(datosRegistro);
    } catch (err) {
      console.error('Error al enviar el registro:', err);
      alert('No se guardo el registro: ' + err.message);
    } finally {
      if (botonConfirmar) {
        botonConfirmar.disabled = false;
        botonConfirmar.textContent = textoBoton;
      }
    }
  }

  function mostrarModalConfirmacion(datosRegistro) {
    const modalConfirmacion = document.getElementById('modalConfirmacion');
    const contenidoConfirmacion = document.getElementById('contenidoConfirmacion');
    if (!modalConfirmacion || !contenidoConfirmacion) return;

    const esPlanAsesoria = datosRegistro.plan === "CONTACTAR";
    const contenidoHTML = `
      <div class="dato-item"><strong>RUC:</strong> ${datosRegistro.ruc || ''}</div>
      <div class="dato-item"><strong>Razon Social:</strong> ${datosRegistro.razonSocial || ''}</div>
      <div class="dato-item"><strong>Servicio:</strong> ${datosRegistro.tipoServicio || ''}</div>
      <div class="dato-item"><strong>Plan:</strong> ${datosRegistro.plan || ''}</div>
      <div class="dato-item"><strong>Email:</strong> ${datosRegistro.email || ''}</div>
      <div class="dato-item"><strong>Telefono:</strong> ${String(datosRegistro.telefono || '').replace(/^'/,'')}</div>
      <div class="dato-item"><strong>Desea contratar:</strong> SI</div>
      <div class="aviso-confirmacion">
        <strong>Registro confirmado</strong>
        <p>El registro fue guardado correctamente. El servicio procesa el correo ${esPlanAsesoria ? 'informativo' : 'con los datos bancarios'} para:<br><strong>${datosRegistro.email || ''}</strong></p>
      </div>
      <div class="separador">
        <h3>LEA ESTO ATENTAMENTE</h3>
        <p class="confirmacion-alerta">SI NO VES EL EMAIL EN 5 MINUTOS:</p>
        <div class="advertencia-item">Revisa tu carpeta de <strong>SPAM</strong></div>
        <div class="advertencia-item">Revisa <strong>CORREO NO DESEADO</strong></div>
        <div class="advertencia-item">Revisa carpeta <strong>PROMOCIONES</strong></div>
        <p class="confirmacion-pie">${esPlanAsesoria ? 'El email contiene informacion sobre tu asesoria personalizada.' : 'El email contiene los datos para activar tu licencia.'}</p>
      </div>
      <div class="confirmacion-contacto">
        <p>Si no encuentras el email, contactanos, indicando tu RUC:</p>
        <p><strong>WhatsApp: +593 96 367 5173</strong></p>
      </div>
      <p class="confirmacion-cierre">Pronto nos pondremos en contacto contigo.</p>
    `;
    contenidoConfirmacion.innerHTML = contenidoHTML;

    modalConfirmacion.hidden = false;

    const btnCerrar = document.getElementById('btnCerrarConfirmacion');
    if (btnCerrar) btnCerrar.onclick = () => (modalConfirmacion.hidden = true);
  }

  let eventosInicializados = false;
  function inicializarEventListeners() {
    if (eventosInicializados) return;
    eventosInicializados = true;
    const closeModal = document.getElementById('closeModal');
    if (closeModal) closeModal.addEventListener('click', cerrarModalSuscripcion);

    window.addEventListener('click', function (event) {
      const modal = document.getElementById('modalSuscripcion');
      if (event.target === modal) cerrarModalSuscripcion();
    });

    const btnCancelar = document.getElementById('btnCancelar');
    if (btnCancelar) btnCancelar.addEventListener('click', cerrarModalSuscripcion);

    const btnConfirmar = document.getElementById('btnConfirmarRegistro');
    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', function (e) {
        e.preventDefault();
        enviarFormularioRegistro();
      });
    }
  }

  // --- Init automatico ---
  window.addEventListener('DOMContentLoaded', async function () {
    try {
      await cargarRecursos();
      inicializarEventListeners();
    } catch (e) {
      console.error('RegistroModulo init error:', e);
    }
  });

  // --- API publica ---
  window.RegistroModulo = {
    mostrarModalRegistro,
    cerrarModalSuscripcion,
    configurar: function (options = {}) {
      if (options.backendUrl) config.backendUrl = options.backendUrl;
    }
  };
})();
