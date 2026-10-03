// ========================================================
// 🔹 GESTIÓN UNIFICADA DE TRÁMITE (recuperaIVA / recuperaRTA)
// 🔹 CARGA FLEXIBLE MULTI-DOCUMENTO (HASTA 10 ARCHIVOS)
// ========================================================
window.TIPO_TRAMITE = "recuperaIVA"; // "recuperaIVA" | "recuperaRTA"
window.archivosCargados = []; // Array de { id, file, name, size, type, md5, category }
const MAX_DOCUMENTOS = 10;

/* ---------------------------------------------------------------------------
   COMPATIBILIDAD DE OCULTACIÓN

   El HTML marca los bloques ocultos con el atributo `hidden`, que es lo
   correcto: es semántico y los lectores de pantalla lo respetan. Pero este
   archivo, heredado, muestra y oculta bloques escribiendo `el.style.display`.

   `display: inline` NO es un valor válido para un `<span>` que debe ocultarse, y
   un `style.display = ""` deja actuar al `[hidden]` de la hoja. Para que ambos
   mecanismos convivan sin reescribir los ~50 puntos de uso, estas dos funciones
   son el puente:

     mostrar(el)  quita `hidden` y limpia el display en línea
     ocultar(el)  pone `hidden` y limpia el display en línea

   El CSS tiene `[hidden] { display: none !important }`, así que el atributo
   siempre gana: no hay forma de que un bloque oculto se muestre por descuido.
--------------------------------------------------------------------------- */
function mostrar(el) {
    if (!el) return;
    el.hidden = false;
    el.style.display = "";
}

function ocultar(el) {
    if (!el) return;
    el.hidden = true;
    el.style.display = "";
}

/** Alterna visibilidad. `visible` admite booleanos. */
function alternarVisibilidad(el, visible) {
    if (!el) return;
    if (visible) { mostrar(el); } else { ocultar(el); }
}

// Se exponen porque el módulo de registro también las necesita.
window.mostrar = mostrar;
window.ocultar = ocultar;
window.alternarVisibilidad = alternarVisibilidad;

/* ---------------------------------------------------------------------------
   AVISOS EN PANTALLA

   Sustituyen a los cuadros de diálogo nativos del navegador, que están
   prohibidos (§7.8.7) porque bloquean la interfaz y no se pueden tematizar.
   Todo aviso dice QUÉ falló, de QUÉ FAMILIA es el fallo y QUÉ hacer (§7.6):

     aviso.error   algo impidió continuar; el usuario debe actuar
     aviso.alerta  algo salió distinto de lo esperado, pero se puede seguir
     aviso.exito   la operación terminó bien

   El aviso se pinta en `#resultado`, junto a los controles de descarga, y es
   `role="status"` con `aria-live`, así que el lector de pantalla lo anuncia.
--------------------------------------------------------------------------- */
function mostrarAviso(mensaje, familia) {
    const caja = document.getElementById("resultado");
    if (!caja) { console.warn("[aviso] " + mensaje); return; }

    const clase = familia === "exito" ? "success"
                : familia === "alerta" ? "warning"
                : "error";

    // El mismo texto que ve el usuario queda en el registro técnico.
    if (familia === "error") { console.error("[aviso] " + mensaje); }
    else { console.warn("[aviso] " + mensaje); }

    caja.className = "message " + clase;
    caja.textContent = mensaje;
    mostrar(caja);
}

window.aviso = {
    error:  function (m) { mostrarAviso(m, "error"); },
    alerta: function (m) { mostrarAviso(m, "alerta"); },
    exito:  function (m) { mostrarAviso(m, "exito"); }
};

function actualizarElemento(id, valor) {
    const el = document.getElementById(id);
    if (!el) return;
    const v = valor ?? "";
    if ("value" in el) el.value = v;
    else el.textContent = v;
}
window.actualizarElemento = actualizarElemento;

// ========================================================
// 🔹 HANDLERS DE CARGA PDF PASO 1
// ========================================================
function cargarSolicitudPDF(event) {
    let file = null;
    if (event && event.target && event.target.files && event.target.files[0]) {
        file = event.target.files[0];
    } else if (event && event.files && event.files[0]) {
        file = event.files[0];
    } else if (event instanceof File) {
        file = event;
    } else {
        const inp = document.getElementById("inputSolicitudPDF");
        if (inp && inp.files && inp.files[0]) file = inp.files[0];
    }

    if (!file) {
        console.warn("⚠️ No se seleccionó archivo en Solicitud PDF");
        return;
    }

    console.log("📄 Solicitud PDF recibida:", file.name, file.size);

    const statusEl = document.getElementById("statusSolicitudPDF");
    if (statusEl) {
        statusEl.innerHTML = `✅ Procesado`;
        statusEl.classList.add("cargado");
    }

    if (typeof window.extraerDatosPDF === "function") {
        window.extraerDatosPDF(file);
    } else if (typeof extraerDatosPDF === "function") {
        extraerDatosPDF(file);
    }
}
window.cargarSolicitudPDF = cargarSolicitudPDF;


function extraerIdentificadoresComunicacion(textoOriginal, nombreArchivo = "") {
    const texto = String(textoOriginal || "").replace(/\s+/g, " ").trim();
    const textoBusqueda = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tiposDocumento = "OFICIO|PROVIDENCIA|RESOLUCION|REQUERIMIENTO|NOTIFICACION|PROCESO|AUTO|COMUNICACION|ACTO";
    const marcaNumero = "(?:(?:N(?:O|RO|UMERO)|N[°º])\\.?\\s*)?";
    const codigo = "([A-Z0-9][A-Z0-9\\/-]{7,39})";
    let tipoDocumento = "";
    let numeroDocumento = "";

    let mDocumento = textoBusqueda.match(new RegExp(
        "\\b(" + tiposDocumento + ")\\s*" + marcaNumero + "[\\s:.-]*" + codigo,
        "i"
    ));
    if (!mDocumento) {
        mDocumento = textoBusqueda.match(new RegExp(
            "\\b(?:NUMERO|NRO|NO|N[°º])\\.?\\s+DE\\s+(" + tiposDocumento + ")[\\s:.-]*" + codigo,
            "i"
        ));
    }
    if (!mDocumento) {
        const mGenerico = textoBusqueda.match(new RegExp(
            "\\b(?:DOCUMENTO|ACTO\\s+ADMINISTRATIVO|COMUNICACION\\s+SRI)\\s*" +
            marcaNumero + "[\\s:.-]*" + codigo,
            "i"
        ));
        if (mGenerico) {
            tipoDocumento = "DOCUMENTO SRI";
            numeroDocumento = mGenerico[1].toUpperCase();
        }
    }
    if (mDocumento) {
        tipoDocumento = mDocumento[1].toUpperCase();
        numeroDocumento = mDocumento[2].toUpperCase();
    }
    if (!numeroDocumento) {
        const codigos = [...textoBusqueda.matchAll(/\b(\d{6,}[A-Z]{1,8}[A-Z0-9-]{5,30})\b/gi)]
            .map(m => m[1].toUpperCase());
        if (codigos.length) numeroDocumento = codigos[0];
    }

    const inferirTipoDocumento = (valor) => {
        const mayusculas = (String(valor || "") + " " + String(nombreArchivo || "")).toUpperCase();
        if (mayusculas.includes("PDEV")) return "PROVIDENCIA";
        if (mayusculas.includes("ODEV")) return "OFICIO";
        if (mayusculas.includes("RDEV")) return "RESOLUCION";
        return "DOCUMENTO SRI";
    };
    if (!tipoDocumento && numeroDocumento) tipoDocumento = inferirTipoDocumento(numeroDocumento);

    const patronesTramite = [
        /\bTRAMITE(?:\s*\/\s*SOLICITUD)?\s*(?:(?:N(?:O|RO|UMERO)|N[°º])\.?\s*)?[\s:.-]*(\d{10,20})\b/i,
        /\b(?:NUMERO|NRO|NO|N[°º])\.?\s+DE\s+TRAMITE[\s:.-]*(\d{10,20})\b/i,
        /\b(?:RECLAMO|SOLICITUD|PETICION)\s+(?:SIGNAD[OA]\s+)?CON\s+EL\s+TRAMITE[\s:.-]*(\d{10,20})\b/i
    ];
    let tramite = "";
    for (const patron of patronesTramite) {
        const match = textoBusqueda.match(patron);
        if (match) {
            tramite = match[1];
            break;
        }
    }
    if (!tramite) {
        const candidatos = [...textoBusqueda.matchAll(/\b(\d{14,20})\b/g)].map(m => m[1]);
        if (candidatos.length) {
            const frecuencia = candidatos.reduce((acc, valor) => {
                acc[valor] = (acc[valor] || 0) + 1;
                return acc;
            }, {});
            tramite = candidatos.sort((a, b) => frecuencia[b] - frecuencia[a])[0];
        }
    }

    const rucsEtiquetados = [...textoBusqueda.matchAll(
        /\bRUC(?:\s*\/\s*C\.?\s*C\.?)?\s*[\s:.-]*(\d{13})\b/gi
    )].map(m => m[1]);
    const rucsGenericos = [...textoBusqueda.matchAll(/\b(\d{13})\b/g)].map(m => m[1]);
    const rucs = [...new Set([...rucsEtiquetados, ...rucsGenericos])];

    return {
        tipoDocumento,
        numeroDocumento,
        // Alias conservado para compatibilidad con la interfaz y datos anteriores.
        oficio: numeroDocumento,
        tramite,
        ruc: rucsEtiquetados[0] || rucs[0] || "",
        rucs
    };
}
window.extraerIdentificadoresComunicacion = extraerIdentificadoresComunicacion;

function actualizarAnexoComunicacionSRI(datos) {
    const bloque = document.getElementById("anexo-comunicacion-sri");
    const tramite = String(datos?.tramite || "").trim();
    const oficio = String(datos?.numeroDocumento || datos?.oficio || "").trim();
    const tipoDocumento = String(datos?.tipoDocumento || "OFICIO").trim().toUpperCase();
    actualizarElemento("anexo-numero-tramite", tramite);
    actualizarElemento("anexo-numero-oficio", oficio);
    actualizarElemento("anexo-tipo-documento", tipoDocumento);
    actualizarElemento("comunicacion-tipo-documento", tipoDocumento);
    if (bloque) alternarVisibilidad(bloque, tramite && oficio);
}
window.actualizarAnexoComunicacionSRI = actualizarAnexoComunicacionSRI;

async function procesarComunicacionSRI(file) {
    if (!file) return { ok: false, error: "No se seleccionó el PDF." };
    if (typeof pdfjsLib === "undefined") return { ok: false, error: "PDF.js no está disponible." };

    try {
        const data = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
        let texto = "";
        for (let pagina = 1; pagina <= pdf.numPages; pagina++) {
            const page = await pdf.getPage(pagina);
            const content = await page.getTextContent();
            texto += " " + content.items.map(item => item.str).join(" ");
        }

        const datos = extraerIdentificadoresComunicacion(texto, file.name);
        if (!datos.numeroDocumento || !datos.tramite || !datos.rucs.length) {
            return { ok: false, error: "No fue posible identificar el número del documento SRI, trámite y RUC en la comunicación." };
        }

        const rucSolicitud = (
            document.getElementById("ruc-txt")?.textContent ||
            document.getElementById("prev-ruc")?.textContent ||
            ""
        ).replace(/\D/g, "");

        if (rucSolicitud.length !== 13) {
            return { ok: false, error: "Primero cargue la solicitud principal para validar el RUC." };
        }
        if (!datos.rucs.includes(rucSolicitud)) {
            return { ok: false, error: "Ninguno de los RUC identificados en la comunicación (" + datos.rucs.join(", ") +
                ") coincide con el RUC de la solicitud (" + rucSolicitud + ")." };
        }
        datos.ruc = rucSolicitud;

        actualizarElemento("comunicacion-numero-tramite", datos.tramite);
        actualizarElemento("comunicacion-numero-oficio", datos.oficio);
        actualizarElemento("comunicacion-ruc", datos.ruc);
        actualizarAnexoComunicacionSRI(datos);
        const panel = document.getElementById("datosComunicacionSRI");
        if (panel) mostrar(panel);
        const error = document.getElementById("errorComunicacionSRI");
        if (error) {
            error.textContent = "";
            ocultar(error);
        }

        /* OJO: aquí NO se guarda el archivo ni se calcula su hash.
           cargarComunicacionPDF ya lo añadió a rchivosCargados con
           gregarArchivosConCategoria, que le calcula el MD5 y lo deduplica.
           Guardarlo otra vez hacía que la providencia saliera DUPLICADA en la
           tabla: una fila por rchivosCargados y otra por aquí. */
        window.comunicacionSRI = datos;
        return { ok: true, datos };
    } catch (error) {
        console.error("Error procesando comunicación SRI:", error);
        return { ok: false, error: "No fue posible leer la comunicación SRI." };
    }
}
window.procesarComunicacionSRI = procesarComunicacionSRI;

async function cargarComunicacionPDF(event) {
    let file = null;
    if (event && event.target && event.target.files && event.target.files[0]) {
        file = event.target.files[0];
    } else if (event && event.files && event.files[0]) {
        file = event.files[0];
    } else if (event instanceof File) {
        file = event;
    } else {
        const inp = document.getElementById("inputComunicacionPDF");
        if (inp && inp.files && inp.files[0]) file = inp.files[0];
    }

    if (!file) return;

    window.comunicacionSRI = null;
    actualizarAnexoComunicacionSRI(null);

    console.log("📩 Comunicación SRI PDF recibida:", file.name, file.size);

    const statusEl = document.getElementById("statusComunicacionPDF");
    if (statusEl) statusEl.textContent = "Validando...";

    const resultado = await procesarComunicacionSRI(file);
    if (!resultado.ok) {
        if (statusEl) {
            statusEl.textContent = "No aceptado";
            statusEl.classList.remove("cargado");
        }
        const error = document.getElementById("errorComunicacionSRI");
        if (error) {
            error.textContent = resultado.error;
            mostrar(error);
        }
        const input = document.getElementById("inputComunicacionPDF");
        if (input) input.value = "";
        return;
    }

    if (statusEl) {
        statusEl.textContent = "✅ Validado";
        statusEl.classList.add("cargado");
    }
    if (typeof window.agregarArchivosConCategoria === "function") {
        await window.agregarArchivosConCategoria([file], "Comunicación / Notificación del SRI");
    }
}
window.cargarComunicacionPDF = cargarComunicacionPDF;


function cambiarTipoTramite(nuevoTipo) {
    if (nuevoTipo !== "recuperaIVA" && nuevoTipo !== "recuperaRTA") return;
    window.TIPO_TRAMITE = nuevoTipo;

    /* En H6 se retiraron las dos líneas que marcaban el botón activo de
       `#btnTramiteIVA` / `#btnTramiteRTA`. Esos botones pertenecen al selector
       manual del flujo antiguo y no existen en el marcado: hoy el trámite se
       determina solo, leyendo la solicitud (`dirimirTramite`), y el resultado se
       muestra en `#tipo-tramite-detectado`. La función se conserva porque sigue
       siendo la que fija el párrafo legal y el contexto del registro. */

    const titleEl = document.querySelector(".title");
    const parrafoTramiteLegal = document.getElementById("nombre-tramite-legal");
    const tipoTramiteDetectado = document.getElementById("tipo-tramite-detectado");

    if (titleEl) titleEl.textContent = 'recuperaIVA - recuperaRTA';
    if (tipoTramiteDetectado) tipoTramiteDetectado.textContent = nuevoTipo;

    if (nuevoTipo === "recuperaIVA") {
        if (parrafoTramiteLegal) parrafoTramiteLegal.textContent = "SOLICITUD PARA LA DEVOLUCIÓN DE RETENCIONES DE IVA NO COMPENSADAS";
    } else {
        if (parrafoTramiteLegal) parrafoTramiteLegal.textContent = "SOLICITUD PARA LA DEVOLUCIÓN DE SALDO A FAVOR DE RETENCIONES EN LA FUENTE DE IMPUESTO A LA RENTA";
    }

    if (window.recuperaIVA_ctx) {
        window.recuperaIVA_ctx.tipoServicio = nuevoTipo;
    }

    if (typeof window.generarTablaArchivos === "function") {
        window.generarTablaArchivos();
    }
}
window.cambiarTipoTramite = cambiarTipoTramite;

function categorizarArchivo(nombreArchivo) {
    const fn = (nombreArchivo || "").toLowerCase();
    if (fn.includes("comunicacion") || fn.includes("notificacion") || fn.includes("oficio") || fn.includes("requerimiento") || fn.includes("respuesta")) return "Comunicación / Notificación del SRI";
    if (fn.endsWith(".txt") || fn.includes("nexo")) return "TXT NEXO";
    if (fn.includes("solicitud") || (fn.endsWith(".pdf") && fn.includes("devolucion"))) return "Solicitud de Devolución";
    if (fn.includes("declaracion") || fn.includes("iva") || fn.includes("104") || fn.includes("101") || fn.includes("102") || fn.includes("rta")) return "Declaración Impuesto";
    if (fn.includes("retenciones") || fn.includes("libro") || fn.includes("valores_por_mes") || fn.includes("listado") || fn.includes("reporte")) return "Libro / Reporte Retenciones";
    if (fn.includes("tratamiento") || fn.includes("contable")) return "Tratamiento Contable";
    if (fn.includes("nombramiento") || fn.includes("representante")) return "Nombramiento Representante Legal";
    return "Otro Documento";
}

function calcularMD5(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function () {
            const spark = new SparkMD5.ArrayBuffer();
            spark.append(reader.result);
            resolve(spark.end());
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}
window.calcularMD5 = calcularMD5;

function eliminarDocumentoUI(id) {
    const documento = window.archivosCargados.find(d => d.id === id);
    window.archivosCargados = window.archivosCargados.filter(d => d.id !== id);
    if (documento?.category === "Comunicación / Notificación del SRI") {
        window.comunicacionSRI = null;
        actualizarAnexoComunicacionSRI(null);
        const panel = document.getElementById("datosComunicacionSRI");
        if (panel) ocultar(panel);
        const input = document.getElementById("inputComunicacionPDF");
        if (input) input.value = "";
        const estado = document.getElementById("statusComunicacionPDF");
        if (estado) {
            estado.textContent = "Opcional - Sin cargar";
            estado.classList.remove("cargado");
        }
    }
    actualizarTablaDocumentosUI();
    if (typeof window.generarTablaArchivos === "function") {
        window.generarTablaArchivos();
    }
}
window.eliminarDocumentoUI = eliminarDocumentoUI;

function agregarArchivos(files) {
    if (typeof agregarArchivosConCategoria === "function") {
        agregarArchivosConCategoria(files);
    }
}
window.agregarArchivos = agregarArchivos;

function abrirSelectorSoportes(event) {
    if (event?.target?.id === "multiFileInput") return;
    const input = document.getElementById("multiFileInput");
    if (input) {
        input.disabled = false;
        input.click();
    }
}
window.abrirSelectorSoportes = abrirSelectorSoportes;

function habilitarCargaArchivosPostSolicitud() {
    /* Hasta H6 esta función reabría los campos del flujo antiguo (`ivaInput`,
       `valorMesInput`, `libroRetIVA1Input`, `libroVTASInput`, `listadoPDFInput`,
       `listadoXLSInput`). Se retiraron de `index.html`: la carga de soportes es
       hoy una sola lista flexible, y basta con dejar operativo su campo. */
    const multiInput = document.getElementById("multiFileInput");
    if (multiInput) multiInput.disabled = false;

    const datosTxtDiv = document.getElementById("datos-txt");
    if (datosTxtDiv) mostrar(datosTxtDiv);

    const datosDecDiv = document.getElementById("datos-declaracion");
    if (datosDecDiv) mostrar(datosDecDiv);

    const vistaPreviaDiv = document.getElementById("vista-previa");
    if (vistaPreviaDiv) mostrar(vistaPreviaDiv);

    const tablaPreviaDiv = document.getElementById("tabla-previa");
    if (tablaPreviaDiv) mostrar(tablaPreviaDiv);
}
window.habilitarCargaArchivosPostSolicitud = habilitarCargaArchivosPostSolicitud;

function manejarArchivosSeleccionados(event) {

    const files = event.target.files;
    if (files && files.length > 0) {
        agregarArchivos(files);
        event.target.value = "";
    }
}
window.manejarArchivosSeleccionados = manejarArchivosSeleccionados;

function manejarArchivosDrop(event) {
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
        agregarArchivos(files);
    }
}
window.manejarArchivosDrop = manejarArchivosDrop;


function limpiarNombreContaminado(s) {
    if (!s) return "";
    let str = String(s).replace(/\s+/g, " ").trim();
    let prev = "";
    let iter = 0;
    while (prev !== str && iter < 10) {
        iter++;
        prev = str;
        str = str.replace(/^(?:Legal\s+de|Representante\s+Legal\s+de|Representada\s+por|en\s+calidad\s+de|el\s+Sñr\.|la\s+Sra\.|Yo,?\s*)+/i, "");
        str = str.replace(/(?:\s+RUC\s+No\.?|\s+RUC\s*:?|\s+C\.I\.?\s*:?|\b\d{10,13}\b)+\s*$/i, "");
        str = str.trim();
    }
    return str;
}
window.limpiarNombreContaminado = limpiarNombreContaminado;

function procesarDatosSolicitudIdentidad(textoOriginal, canton) {
    const t = (textoOriginal || "")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.:;])/g, "$1")
        .trim();

    let nombre = "";
    let ced = "";
    let razonSocial = "";
    let ruc = "";
    const esPersonaNaturalExplicita =
        /PERSONAS?\s+NATURALES?\s+NO\s+OBLIGADAS?\s+A\s+LLEVAR\s+CONTABILIDAD/i.test(t);

    // Persona natural: el nombre del contribuyente aparece después de "Yo,".
    // No existe representante ni razón social; cédula y RUC pertenecen a la misma persona.
    if (esPersonaNaturalExplicita) {
        const mPersona = t.match(
            /\bYo,?\s*([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s]{4,100}?)\s+(?=con\s+c[eé]dula|c[eé]dula|con\s+RUC|RUC\s+No\.?)/i
        );
        const mCedPersona = t.match(/c[eé]dula(?:\s+de\s+ciudadan[ií]a\s+o\s+identidad)?\s+No\.?\s*(\d{10})/i);
        const mRucPersona = t.match(/\bRUC\s+No\.?\s*(\d{13})\b/i);
        if (mPersona) nombre = mPersona[1].replace(/\s{2,}/g, " ").trim();
        if (mCedPersona) ced = mCedPersona[1];
        if (mRucPersona) ruc = mRucPersona[1];
    }

    // recuperaIVA: los campos visuales del párrafo pueden quedar vacíos en
    // el orden interno del PDF y los valores reales aparecen juntos al final:
    // NOMBRE + CEDULA + RAZON SOCIAL + RUC. Tomamos la última coincidencia,
    // que normalmente corresponde al bloque de firma y evita el encabezado.
    const bloquesPie = esPersonaNaturalExplicita ? [] : [...t.matchAll(/([A-ZÁÉÍÓÚÑÜ ]{10,})\s+(\d{10})\s+([A-Z0-9ÁÉÍÓÚÑÜ\.\s&,-]{3,}?)\s+(\d{13})/g)];
    const pieSolicitud = bloquesPie.length ? bloquesPie[bloquesPie.length - 1] : null;
    if (pieSolicitud) {
        nombre = pieSolicitud[1].replace(/\s{2,}/g, " ").trim();
        ced = pieSolicitud[2];
        razonSocial = pieSolicitud[3].replace(/\s{2,}/g, " ").trim();
        ruc = pieSolicitud[4];

        const partesNombre = nombre.split(/\s+/).filter(Boolean);
        if (canton && partesNombre.length > 2 && partesNombre[0].toUpperCase() === canton.toUpperCase()) {
            partesNombre.shift();
            nombre = partesNombre.join(" ");
        }
    }

    // Patrón 1: Cláusula Legal Principal ("Yo, [REPRESENTANTE] con cédula... Representante Legal de [RAZON_SOCIAL] RUC No. [RUC]")
    const mLeg = t.match(/(?:Yo,?\s*)?([A-ZÁÉÍÓÚÑ]{2,}(?:\s+(?!con\b)[A-ZÁÉÍÓÚÑ]{2,}){1,5})\s+(?:con\s+c[eé]dula|c[eé]dula|identidad)[^\d]*(\d{10})[\s\S]*?(?:Representante\s+Legal\s+de\s+|Legal\s+de\s+)([A-ZÁÉÍÓÚÑ0-9\s\.\-&,]{3,100}?)\s+RUC\s+No\.?\s*(\d{13})/i);

    // recuperaRTA suele traer la identidad completa dentro de la cláusula.
    // Se usa cuando no existe el bloque final estructurado de recuperaIVA.
    if (mLeg && !pieSolicitud && !esPersonaNaturalExplicita) {
        nombre = mLeg[1].trim();
        ced = mLeg[2].trim();
        razonSocial = mLeg[3].replace(/\s{2,}/g, " ").trim();
        ruc = mLeg[4].trim();
    }

    // Fallback 1: RUC (13 dígitos)
    if (!ruc) {
        const rucs = [...t.matchAll(/\b\d{13}\b/g)].map(m => m[0]);
        ruc = rucs.find(x => x.endsWith("001")) || (rucs.length ? rucs[rucs.length - 1] : "");
    }

    // Fallback 2: Cédula (10 dígitos ecuatoriana)
    if (!ced) {
        const mCed = t.match(/\b(0[1-9]|1[0-9]|2[0-4])\d{8}\b/);
        if (mCed) ced = mCed[0];
    }

    // Helper: detectar si un texto es nombre de empresa
    const esNombreEmpresa = (str) => /CIA\b|LTDA\b|S\.?A\.?\b|SOCIEDAD\b|CONSULTORES\b|ASESORES\b|CORPORATION\b|CORP\b|INC\b/i.test(str || "");

    // Si el nombre extraído es igual a la razón social o contiene sufijos de empresa, NO es un representante
    if (nombre && (esNombreEmpresa(nombre) || nombre.toLowerCase().startsWith("legal de"))) {
        nombre = "";
    }

    // Fallback 3: Buscar nombre de representante
    if (!nombre) {
        // En varios PDF de persona natural, PDF.js deja vacío el campo junto a "Yo,"
        // y desplaza la identidad al final. La última firma NOMBRE + CÉDULA es autoritativa.
        if (esPersonaNaturalExplicita && ced) {
            const patronFirmaPersona = new RegExp(
                "(?:^|[^A-ZÁÉÍÓÚÑÜ])([A-ZÁÉÍÓÚÑÜ]{2,}(?:\\s+[A-ZÁÉÍÓÚÑÜ]{2,}){1,6})\\s+" + ced + "\\b",
                "g"
            );
            const firmasPersona = [...t.matchAll(patronFirmaPersona)];
            if (firmasPersona.length) {
                nombre = firmasPersona[firmasPersona.length - 1][1].replace(/\s{2,}/g, " ").trim();
            }
        }
        if (!nombre && ced) {
            const mNom = t.match(new RegExp(`([A-ZÁÉÍÓÚÑ]{2,}(?:\\s+(?!con\\b)[A-ZÁÉÍÓÚÑ]{2,}){1,5})\\s+(?:con\\s+c[eé]dula|c[eé]dula|identidad|C\\.I\\.?|${ced}\\b)`, "i"));
            if (mNom && mNom[1] && !esNombreEmpresa(mNom[1])) nombre = mNom[1].trim();
        }
        if (!nombre) {
            const mYo = t.match(/Yo,?\s*([A-ZÁÉÍÓÚÑ]{2,}(?:\s+(?!con\b)[A-ZÁÉÍÓÚÑ]{2,}){1,5})/i) ||
                        t.match(/Atentamente\s+([A-ZÁÉÍÓÚÑ]{2,}(?:\s+(?!con\b)[A-ZÁÉÍÓÚÑ]{2,}){1,5})/i);
            if (mYo && mYo[1] && !esNombreEmpresa(mYo[1])) nombre = mYo[1].trim();
        }
    }

    // Fallback 4: Razón Social
    if (!razonSocial && !esPersonaNaturalExplicita) {
        const mRaz = t.match(/(?:Representante\s+Legal\s+de\s+|Legal\s+de\s+)([A-ZÁÉÍÓÚÑ0-9\s\.\-&,]{3,100})\s+RUC\s+No\.?\s*\d{13}/i) ||
                    t.match(/([A-ZÁÉÍÓÚÑ ]{10,})\s+\d{10}\s+([A-Z0-9ÁÉÍÓÚÑ\.\s&,-]{3,})\s+\d{13}/);
        if (mRaz) razonSocial = (mRaz[3] || mRaz[1]).replace(/\s{2,}/g, " ").trim();
    }

    // Sanitización final estricta
    if (typeof limpiarNombreContaminado === "function") {
        if (nombre) nombre = limpiarNombreContaminado(nombre);
        if (razonSocial) razonSocial = limpiarNombreContaminado(razonSocial);
    }

    const esSociedad = esPersonaNaturalExplicita
        ? false
        : (typeof esSociedadPorSolicitud === "function" ? esSociedadPorSolicitud(t) : (!!razonSocial || t.includes("SOCIEDADES") || t.includes("REPRESENTANTE LEGAL")));

    // El orquestador de la carta consulta estas banderas al pintar la firma.
    // Deben quedar listas antes de emitir; de lo contrario trata una sociedad
    // como persona natural y borra nombre/cédula del representante.
    window.__SOCIEDAD = esSociedad;
    window.tipoContribuyente = esSociedad ? "SOCIEDAD" : "PERSONA";

    // Dirección
    const tNorm = t.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n+/g, "\n").trim();
    let direccion = "";
    const mDir = tNorm.match(/Provincia:\s*([\s\S]*?)(?=\s*,?\s*comparezco\s+ante\s+su\s+autoridad|\s+\d{1,6}\.\d{2}\b|\s+La misma que est[aá] registrada|\s+ACREDITACI[oó]N|\s+www\.sri\.gob\.ec|\s+SOLICITUD|\s*$)/i);
    if (mDir && mDir[1]) {
        direccion = ("Provincia: " + mDir[1]).replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim().replace(/[\s,]+$/, "");
    }

    // Fallback común para IVA/RTA: algunos PDF no conservan bien la cabecera
    // zonal, pero sí incluyen el cantón dentro del domicilio tributario.
    let cantonFinal = String(canton || "").trim();
    if (!cantonFinal) {
        const mCantonDireccion = t.match(/Cant[oó]n\s*:\s*([^,;\n]{2,60})/i);
        if (mCantonDireccion) cantonFinal = mCantonDireccion[1].replace(/\s{2,}/g, " ").trim();
    }

    // === Actualización DOM de Spans e Inputs ===
    if (ruc) {
        actualizarElemento("rucRUC", ruc);
        actualizarElemento("prev-ruc", ruc);
        actualizarElemento("prev-ruc-doc-soc", ruc);
        actualizarElemento("prev-ruc-doc-per", ruc);
        actualizarElemento("ruc-txt", ruc);
    }

    if (ced) {
        actualizarElemento("prev-cedula", ced);
        actualizarElemento("prev-rep-cedula-doc", ced);
    } else {
        actualizarElemento("prev-cedula", "");
        actualizarElemento("prev-rep-cedula-doc", "");
    }

    if (nombre) {
        actualizarElemento("prev-nombre", nombre);
        actualizarElemento("prev-rep-nombre-doc", nombre);
    } else {
        actualizarElemento("prev-nombre", "");
        actualizarElemento("prev-rep-nombre-doc", "");
    }

    if (razonSocial) {
        actualizarElemento("nombreRUC", razonSocial);
        actualizarElemento("prev-razon-social-doc", razonSocial);
        actualizarElemento("nombre-contribuyente-txt", razonSocial);
    } else if (nombre) {
        actualizarElemento("nombreRUC", "");
        actualizarElemento("nombre-contribuyente-txt", nombre);
    }

    if (typeof window.setText === "function") {
        window.setText("cert-rol", esSociedad ? ", en calidad de Representante Legal de " : ", ");
    }

    const segmentoCedula = document.getElementById("segmento-cedula-cert");
    const segmentoRuc = document.getElementById("segmento-ruc-cert");
    if (segmentoCedula) alternarVisibilidad(segmentoCedula, ced);
    if (segmentoRuc) alternarVisibilidad(segmentoRuc, ruc);

    if (direccion) actualizarElemento("prev-direccion", direccion);
    if (cantonFinal) actualizarElemento("prev-canton", cantonFinal);


    // Contexto Global
    window.recuperaIVA_ctx = window.recuperaIVA_ctx || {};
    window.recuperaIVA_ctx.ruc = ruc;
    window.recuperaIVA_ctx.direccion = direccion;
    window.recuperaIVA_ctx.canton = cantonFinal;
    window.recuperaIVA_ctx.representanteNombre = nombre;
    window.recuperaIVA_ctx.representanteCedula = ced;
    window.recuperaIVA_ctx.razonSocial = razonSocial || nombre;

    // La solicitud principal es el punto autoritativo para validar al cliente.
    if (ruc && ruc.length === 13 && ruc !== window.ultimoRucValidadoCliente) {
        window.ultimoRucValidadoCliente = ruc;
        if (typeof window.verificarRUC === "function") {
            Promise.resolve(window.verificarRUC()).catch(error => {
                console.error("Error en validación de cliente:", error);
            });
        }
    }

    if (typeof window.emitirCertificacion === "function") {
        window.emitirCertificacion();
    }
}
window.procesarDatosSolicitudIdentidad = procesarDatosSolicitudIdentidad;




async function agregarArchivosConCategoria(fileList, categoriaExplicit) {
    if (!fileList || fileList.length === 0) return;

    const mensaje = document.getElementById("mensajeCargaSoportes");
    if (mensaje) {
        mensaje.textContent = "";
        ocultar(mensaje);
    }
    const rechazados = [];

    for (let i = 0; i < fileList.length; i++) {
        if (window.archivosCargados.length >= MAX_DOCUMENTOS) {
            rechazados.push("Se alcanzó el máximo de 10 documentos.");
            break;
        }
        const file = fileList[i];
        if (!/\.(pdf|xls|xlsx)$/i.test(file.name || "")) {
            rechazados.push(`${file.name}: formato no permitido.`);
            continue;
        }
        if (window.archivosCargados.some(a => a.name === file.name && a.size === file.size)) continue;

        const docObj = {
            id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            file: file,
            name: file.name,
            size: file.size,
            category: categoriaExplicit || categorizarArchivo(file.name),
            md5: 'Calculando...'
        };

        window.archivosCargados.push(docObj);

        calcularMD5(file).then(md5Hash => {
            docObj.md5 = md5Hash || 'N/A';
            actualizarTablaDocumentosUI();
        }).catch(() => {
            docObj.md5 = 'N/A';
            actualizarTablaDocumentosUI();
        });
    }

    actualizarTablaDocumentosUI();
    if (typeof window.generarTablaArchivos === "function") window.generarTablaArchivos();
    if (mensaje && rechazados.length) {
        mensaje.textContent = rechazados.join(" ");
        mostrar(mensaje);
    }
}
window.agregarArchivosConCategoria = agregarArchivosConCategoria;

const TEXTO_LISTA_VACIA =
    "Todavía no ha añadido documentos de soporte. Arrastre archivos a la zona superior o use el botón «Documentos de soporte».";

function actualizarTablaDocumentosUI() {
    const contenedor = document.getElementById("contenedorListaDocumentos");
    const listaUI = document.getElementById("listaDocumentosUI");
    const badge = document.getElementById("contadorDocsBadge");

    if (badge) badge.textContent = `Archivos: ${window.archivosCargados.length} / ${MAX_DOCUMENTOS}`;

    if (!contenedor || !listaUI) return;

    /* Mientras no haya documentos, la sección se oculta entera. El texto de
       "estado vacío" que la sección trae en el marcado se conserva para
       restaurarlo: si se vaciara el contenedor, al quitar el último archivo la
       lista quedaría en blanco y sin explicación (§7.5). */
    if (window.archivosCargados.length === 0) {
        ocultar(contenedor);
        listaUI.innerHTML = `<p class="lista-vacia">${TEXTO_LISTA_VACIA}</p>`;
        return;
    }

    mostrar(contenedor);
    let html = "";
    window.archivosCargados.forEach(doc => {
        html += `
        <div class="doc-item-row">
            <div class="doc-item-info">
                <div class="doc-item-name">📄 ${doc.name}</div>
            </div>
            <button type="button" class="doc-item-remove-btn" onclick="eliminarDocumentoUI('${doc.id}')" title="Eliminar archivo">✕</button>
        </div>`;
    });

    listaUI.innerHTML = html;
}
window.actualizarTablaDocumentosUI = actualizarTablaDocumentosUI;

function procesarArchivoSubido(file, category) {
    const fn = file.name.toLowerCase();
    dirimirTipoTramite("", file.name);

    if (fn.endsWith(".pdf")) {
        window.extraerDatosPDFArchivo(file);
    }
}

window.cargarTXTArchivo = function (file) {
    if (!file) return;
    dirimirTipoTramite("", file.name);

    const reader = new FileReader();
    reader.readAsText(file, "iso-8859-1");
    reader.onload = function (e) {
        const contenido = e.target.result;
        dirimirTipoTramite(contenido, file.name);

        const lineas = contenido.split(/\r?\n/);
        let ruc = "", razonSocial = "", periodoDesde = "", periodoHasta = "", retenido = 0;
        let cantidadRetenciones = 0;
        let agentesSet = new Set();

        for (let linea of lineas) {
            let campos = linea.split("\t");
            if (campos.length > 1) {
                if (!ruc && campos[0] && campos[0].length === 13 && /^\d+$/.test(campos[0])) {
                    ruc = campos[0];
                }
                if (campos.length >= 5 && campos[4] && campos[4].length > 3 && !razonSocial) {
                    razonSocial = campos[4].trim();
                }
                if (campos.length >= 8 && campos[7] && campos[7].includes("/")) {
                    if (!periodoDesde) periodoDesde = campos[7];
                    periodoHasta = campos[7];
                }
                if (campos.length >= 3 && campos[2] && campos[2].length === 13) {
                    agentesSet.add(campos[2]);
                }
                if (campos.length >= 10) {
                    let val = parseFloat((campos[9] || "0").replace(",", "."));
                    if (!isNaN(val)) {
                        retenido += val;
                        cantidadRetenciones++;
                    }
                }
            }
        }

        if (ruc) {
            actualizarElemento("ruc-txt", ruc);
            actualizarElemento("rucRUC", ruc);
            actualizarElemento("prev-ruc", ruc);
            actualizarElemento("prev-ruc-doc-per", ruc);
            actualizarElemento("prev-ruc-doc-soc", ruc);
        }
        if (razonSocial) {
            actualizarElemento("nombre-contribuyente-txt", razonSocial);
            actualizarElemento("prev-nombre", razonSocial);
            actualizarElemento("prev-nombre-doc", razonSocial);
            actualizarElemento("prev-razon-social-doc", razonSocial);
            actualizarElemento("nombreRUC", razonSocial);
        }
        if (periodoDesde) actualizarElemento("periodo-desde", periodoDesde);
        if (periodoHasta) actualizarElemento("periodo-hasta", periodoHasta);
        actualizarElemento("copia-cantidad-agentes", agentesSet.size);
        actualizarElemento("copia-cantidad-retenciones", cantidadRetenciones);
        actualizarElemento("retenido", retenido.toFixed(2));

        const datosTxtDiv = document.getElementById("datos-txt");
        if (datosTxtDiv) mostrar(datosTxtDiv);

        if (ruc && ruc !== window.ultimoRucVerificado) {
            window.ultimoRucVerificado = ruc;
            verificarRUC();
        }

        if (typeof window.emitirCertificacion === "function") {
            window.emitirCertificacion();
        }
        if (typeof window.generarTablaArchivos === "function") {
            window.generarTablaArchivos();
        }
    };
};

if (typeof window.pdfjsLib !== "undefined" && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js";
}

// Conservado solo para referencia de compatibilidad. No debe reemplazar al
// parser unificado y completo declarado anteriormente.
function procesarDatosSolicitudIdentidadLegacy(extractedText, canton) {
    const t = (extractedText || "").replace(/\s+/g, " ").trim();

    let ruc = "";
    const mRuc = t.match(/\b(\d{13})\b/);
    if (mRuc) ruc = mRuc[1];

    let nombre = "";
    const mNombre = t.match(/(?:RAZ[ÓO]N\s+SOCIAL|CONTRIBUYENTE|SOLICITANTE|NOMBRES\s+Y\s+APELLIDOS)\s*[:\s]\s*([A-ZÁÉÍÓÚÑ0-9\s.,&-]{4,60})(?=\s+RUC|\s+CÉDULA|\s+DIRECCIÓN|\s+ZONA|\s+TELÉFONO|$)/i);
    if (mNombre) {
        nombre = mNombre[1].trim().replace(/\s{2,}/g, " ");
    } else if (ruc) {
        const mContext = t.match(new RegExp(`([A-ZÁÉÍÓÚÑ0-9\\s.,&-]{4,60})\\s+${ruc}`, "i"));
        if (mContext) nombre = mContext[1].trim();
    }

    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    if (ruc) {
        setEl("ruc-txt", ruc);
        setEl("rucRUC", ruc);
        setEl("prev-ruc", ruc);
        setEl("prev-ruc-doc-per", ruc);
        setEl("prev-ruc-doc-soc", ruc);

        if (window.recuperaIVA_ctx) window.recuperaIVA_ctx.ruc = ruc;

        if (ruc !== window.ultimoRucVerificado) {
            window.ultimoRucVerificado = ruc;
            if (typeof window.verificarRUC === "function") window.verificarRUC();
        }
    }

    if (nombre) {
        setEl("nombre-contribuyente-txt", nombre);
        setEl("prev-nombre", nombre);
        setEl("prev-nombre-doc", nombre);
        setEl("prev-razon-social-doc", nombre);
        setEl("nombreRUC", nombre);

        if (window.recuperaIVA_ctx) window.recuperaIVA_ctx.razonSocial = nombre;
    }

    if (canton) {
        setEl("prev-canton", canton);
    }

    const datosTxtDiv = document.getElementById("datos-txt");
    if (datosTxtDiv) mostrar(datosTxtDiv);
}

function procesarDatosSolicitudDeclaracion(extractedText) {
    const t = (extractedText || "").replace(/\s+/g, " ").trim();
    const setEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    const mFechas = t.match(/\b(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{4})\b/g);
    if (mFechas && mFechas.length >= 1) {
        setEl("periodo-desde", mFechas[0]);
        setEl("periodo-hasta", mFechas[mFechas.length - 1]);
        setEl("periodo-declaracion", mFechas[mFechas.length - 1]);
    }
}
window.procesarDatosSolicitudDeclaracion = procesarDatosSolicitudDeclaracion;

// ================================
// ✅ SALDO CRÉDITO desde SOLICITUD (ancla "DÓLARES CON")
// ================================
function extraerSaldoCreditoDesdeSolicitudPorDolaresCon(extractedText) {
    const t = (extractedText || "").replace(/\s+/g, " ").trim();
    const up = t.toUpperCase();

    // Busca el marcador "DÓLARES CON" (con o sin tilde)
    const idx = up.search(/D[ÓO]LARES\s+CON/);
    if (idx === -1) return 0;

    // Ventana de texto justo ANTES del marcador (donde en tu PDF aparece "565.23 QUINIENTOS ... DÓLARES CON")
    const start = Math.max(0, idx - 260);
    const ventana = t.substring(start, idx);

    // Captura números tipo 565.23 / 1.234,56 / 1234.56 etc.
    const matches = ventana.match(/\b\d{1,3}(?:[.,]\d{3})*[.,]\d{2}\b/g);
    if (!matches || !matches.length) return 0;

    // El último suele ser el valor correcto inmediatamente antes del texto en letras
    const candidato = matches[matches.length - 1];
    const n = normalizarNumeroEC(candidato);
    return (Number.isFinite(n) && n > 0) ? n : 0;
}

// Procesa y fija el saldo global correcto (565.23)
function procesarSaldoCreditoSolicitud(extractedText) {
    const saldo = extraerSaldoCreditoDesdeSolicitudPorDolaresCon(extractedText);

    window.SALDO_CREDITO = saldo;

    if (window.recuperaIVA_ctx) {
        window.recuperaIVA_ctx.saldo = saldo;
    }

    // Si tienes el span del preview, lo llenamos para consistencia visual
    const el = document.getElementById("prev-dec-saldo-credito");
    if (el && saldo > 0) el.textContent = saldo.toFixed(2);

    console.log("✅ SALDO_CREDITO (PDF SOLICITUD, DÓLARES CON):", saldo);
    return saldo;
}
// ================================
// FUNCIÓN ÚNICA DE FIRMA PARA CERTIFICACIÓN
// ================================
function generarPieFirmaCertificacion(ctx) {
    if (!ctx) return '';

    // PERSONA NATURAL
    if (ctx.tipoContribuyente === 'PERSONA') {
        return [
            ctx.nombreCompleto || ctx.razonSocial || '',
            ctx.cedula ? `C.I. ${ctx.cedula}` : ''
        ].filter(Boolean).join('\n');
    }

    // SOCIEDAD
    if (ctx.tipoContribuyente === 'SOCIEDAD') {
        return [
            ctx.representanteNombre || '',
            ctx.representanteCedula ? `C.I. ${ctx.representanteCedula}` : '',
            ctx.razonSocial || '',
            ctx.ruc ? `RUC No. ${ctx.ruc}` : ''
        ].filter(Boolean).join('\n');
    }

    return '';
}
// ================================
// Utilidad: actualizar innerHTML de un elemento de forma segura
// ================================
function actualizarElementoHTML(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = (html ?? "");
}
// ================================
// ✅ FUNCIÓN ÚNICA (ORQUESTADOR) DE CERTIFICACIÓN
// ================================
window.emitirCertificacion = function emitirCertificacion() {
    // 1) Validaciones mínimas de DOM
    const vista = document.getElementById("vista-previa");
    if (!vista) {
        console.warn("emitirCertificacion: no existe #vista-previa");
        return false;
    }

    const esSociedad = (window.__SOCIEDAD === true); // ✅ AQUÍ

    // 2) Helpers seguros
    window.setText = function setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = (val ?? "").toString().trim();
    };

    // 3) Construir/normalizar contexto desde lo que YA está en DOM
    // (esto evita que dependas de ctx con nombres inconsistentes)
    const ctx = window.recuperaIVA_ctx = window.recuperaIVA_ctx || {};

    const ruc = (document.getElementById("prev-ruc")?.textContent?.trim() || ctx.ruc || "").replace(/\D/g, "");
    const direccion = document.getElementById("prev-direccion")?.textContent?.trim() || ctx.direccion || "";
    const repNombre = limpiarNombreContaminado(document.getElementById("prev-nombre")?.textContent?.trim() || ctx.representanteNombre || ctx.repNombre || "");
    const repCedula = (document.getElementById("prev-cedula")?.textContent?.trim() || ctx.representanteCedula || ctx.repCedula || "").replace(/\D/g, "");
    const razonSocial = limpiarNombreContaminado(document.getElementById("nombreRUC")?.textContent?.trim() || ctx.razonSocial || "");

    ctx.ruc = ruc;
    ctx.direccion = direccion;
    ctx.representanteNombre = limpiarNombreContaminado(repNombre);
    ctx.representanteCedula = repCedula;
    ctx.razonSocial = limpiarNombreContaminado(razonSocial);

    // 4) Asegurar tipo contribuyente (usa SOLO la función global)
    // Nota: tu pipeline actual setea window.__SOCIEDAD en extraerDatosPDF.
    // Aquí solo sincronizamos window.tipoContribuyente para firma/visibilidad.
    window.tipoContribuyente = esSociedad ? "SOCIEDAD" : "PERSONA";

    // 5) Ajustar redacción SOLO con el span #cert-rol (NO tocar innerHTML del párrafo)
    // El párrafo base ya tiene <span id="cert-rol"></span>
    window.setText("cert-rol", esSociedad ? ", en calidad de Representante Legal de " : ", ");

    // 6) Rellenar el bloque “nombreRUC”:
    // - SOCIEDAD: debe mostrar Razón Social
    // - PERSONA: lo dejamos vacío (o si quieres: repetir nombre)
    const cleanRazon = limpiarNombreContaminado(ctx.razonSocial || "");
    window.setText("nombreRUC", esSociedad ? cleanRazon : "");

    // 7) Rellenar firmas según tipo usando los IDs reales del HTML

        if (esSociedad) {
            // ✅ 4 líneas SOCIEDAD (firma)
            window.setText("prev-rep-nombre-doc", limpiarNombreContaminado(ctx.representanteNombre || ""));
            window.setText("prev-rep-cedula-doc", ctx.representanteCedula || "");
            window.setText("prev-razon-social-doc", cleanRazon);
            window.setText("prev-ruc-doc-soc", ctx.ruc || "");
        }
        // ✅ Siempre setear ambos (por seguridad)
        window.setText("prev-ruc-doc-per", ctx.ruc || ruc || "");


        // =====================
        // PERSONA NATURAL: FIRMA OBLIGATORIA (Nombre + RUC)
        // =====================
        if (!esSociedad) {
            const nombrePersona =
                document.getElementById("prev-nombre")?.textContent?.trim() ||   // <- el nombre real del solicitante
                ctx.razonSocial?.toString().trim() ||                            // fallback
                document.getElementById("nombreRUC")?.textContent?.trim() ||     // fallback extra
                "";

            const identificacionPersona =
                (ctx.ruc || ruc || ctx.representanteCedula || repCedula || "").toString().trim();
            const etiquetaIdentificacion = identificacionPersona.length === 13 ? "RUC No." : "C.I.";


            // ✅ Firma persona (OBLIGATORIO)
            window.setText("prev-nombre-doc", nombrePersona);
            window.setText("prev-identificacion-label", etiquetaIdentificacion);
            window.setText("prev-ruc-doc-per", identificacionPersona);

            // ✅ Panel “CONTRIBUYENTE” (opcional, pero recomendado para coherencia visual)
            window.setText("nombre-contribuyente-txt", nombrePersona);

            // 🔒 Forzar visualización EXACTA de líneas PERSONA (sin depender de estado previo)
            const show = (id, on) => {
                const el = document.getElementById(id);
                if (el) alternarVisibilidad(el, on);
            };

            // Ocultar líneas SOCIEDAD
            show("linea-rep-nombre-doc", false);
            show("linea-rep-cedula-doc", false);
            show("linea-razon-social-doc", false);
            show("linea-firma-ruc-doc-soc", false);

            // Mostrar líneas PERSONA
            show("linea-firma-nombre-doc", true);
            show("linea-firma-ruc-doc-per", true);
        }

    // 8) Mostrar/ocultar líneas firma según tipo (usa tu función existente)
    if (typeof aplicarFirmasSegunTipoContribuyenteCertificacion === "function") {
        aplicarFirmasSegunTipoContribuyenteCertificacion();
    }

    // 9) Asegurar que la vista previa esté visible si ya corresponde
    // (tu lógica actual la muestra cuando todos los archivos están subidos)
    // aquí NO forzamos, solo devolvemos OK
    return true;
};
// --- FUNCIÓN GLOBAL PARA SETEAR TIPO DE CONTRIBUYENTE ---
window.setTipoContribuyente = function (esSociedad) {
    window.__SOCIEDAD = !!esSociedad;
    window.__PERSONA  = !window.__SOCIEDAD;
    window.tipoContribuyente = window.__SOCIEDAD ? "SOCIEDAD" : "PERSONA";

    /* En H6 se retiró de aquí el manejo de `#bloqueNombramiento` y
       `#nombramientoInput`: ninguno de los dos existe ya en `index.html`. El
       tipo de contribuyente decide hoy qué líneas de firma se muestran, y de
       eso se encarga `aplicarFirmasSegunTipoContribuyenteCertificacion`. */
};
function aplicarFirmasSegunTipoContribuyenteCertificacion() {
    const tipo = (window.tipoContribuyente || "").toUpperCase();
    const esSociedad = tipo.includes("SOC");

    const show = (id, on) => {
        const el = document.getElementById(id);
        if (el) alternarVisibilidad(el, on);
    };

    // SOCIEDAD (4 líneas)
    show("linea-rep-nombre-doc", esSociedad);
    show("linea-rep-cedula-doc", esSociedad);
    show("linea-razon-social-doc", esSociedad);
    show("linea-firma-ruc-doc-soc", esSociedad);

    // PERSONA NATURAL (2 líneas)
    show("linea-firma-nombre-doc", !esSociedad);
    show("linea-firma-ruc-doc-per", !esSociedad);

}
function cargarFirmasCertificacionDesdeDOM() {
    // Pie de firma único
    const firma = generarPieFirmaCertificacion(window.recuperaIVA_ctx);
    actualizarElemento('prev-firma', firma);
}
function aplicarCorreccionesCertificacion() {
    const vista = document.getElementById("vista-previa");
    if (!vista) return;

    const esSociedad = (window.__SOCIEDAD === true);


    // ========= 2) FIRMA (abajo) =========

    // 2.1 Asegurar que PERSONA tenga nombre en firma
    if (!esSociedad) {
        const nombrePersona =
            document.getElementById("prev-nombre-doc")?.textContent?.trim() ||
            document.getElementById("prev-nombre")?.textContent?.trim() ||
            document.getElementById("nombreRUC")?.textContent?.trim() || "";

        // Si por algún motivo nombreRUC quedó vacío, lo reponemos
        const elNombreRUC = document.getElementById("nombreRUC");
        if (elNombreRUC && !elNombreRUC.textContent.trim() && nombrePersona) {
            elNombreRUC.textContent = nombrePersona;
        }
    }

    // 2.2 SOCIEDAD: insertar NOMBRE REPRESENTANTE + CÉDULA en firma (sin tocar HTML)
    if (esSociedad) {
        const repNombre = document.getElementById("prev-nombre")?.textContent?.trim() || "";
        const repCedula = document.getElementById("prev-cedula")?.textContent?.trim() || "";

        // Ubicar el <p> que contiene la línea "-----------------------------------"
        const pLinea = [...vista.querySelectorAll("p")]
            .find(p => (p.textContent || "").includes("-----------------------------------"));

        // Insertar (solo si no existen)
        if (pLinea) {
            const yaExiste = vista.querySelector("#firma-rep-nombre");
            if (!yaExiste) {
                const pRepNombre = document.createElement("p");
                pRepNombre.id = "firma-rep-nombre";
                pRepNombre.textContent = repNombre ? repNombre : "";
                pLinea.insertAdjacentElement("afterend", pRepNombre);

                const pRepCedula = document.createElement("p");
                pRepCedula.id = "firma-rep-cedula";
                pRepCedula.textContent = repCedula ? repCedula : "";
                pRepNombre.insertAdjacentElement("afterend", pRepCedula);
            } else {
                // Actualizar si ya existían
                const pRepNombre = vista.querySelector("#firma-rep-nombre");
                const pRepCedula = vista.querySelector("#firma-rep-cedula");
                if (pRepNombre) pRepNombre.textContent = repNombre;
                if (pRepCedula) pRepCedula.textContent = repCedula;
            }
        }
    }
}
function actualizarRedaccionCertificacionRol() {
    const el = document.getElementById("cert-rol");
    if (!el) return;

    const esSociedad = (window.__SOCIEDAD === true);

    el.textContent = esSociedad
        ? ", en calidad de Representante Legal de "
        : ", ";
}
// Genera la tabla de archivos subidos y sus hashes MD5 dinámicamente
function obtenerNombreCertificacion(extension = "pdf") {
    const tipo = window.TIPO_TRAMITE === "recuperaRTA" ? "retRTA" : "retIVA";
    const ext = String(extension || "pdf").replace(/^\./, "");
    return `CERTIFICACION_Devolucion_${tipo}.${ext}`;
}
window.obtenerNombreCertificacion = obtenerNombreCertificacion;

async function generarTablaArchivos() {
    const certPdfNombre = obtenerNombreCertificacion("pdf");

    /* La tabla se construye con CLASES, no con estilos en línea (§7.4), y SIN
       `white-space: nowrap`: ese era el motivo de que los nombres largos se
       salieran de la hoja. El nombre de archivo puede partirse; el hash no,
       porque un MD5 partido deja de ser legible. Los anchos se fijan en la hoja
       de estilos: el del hash es fijo (32 caracteres) y el del nombre toma el
       resto. */
    let tablaHTML = `<table class="tabla-certificacion">
        <thead><tr><th>Nombre del archivo o documento</th><th class="hash">Hash MD5</th></tr></thead>
        <tbody>`;

    // Primera línea: la certificación PDF que se está generando.
    // No lleva MD5 propio porque se genera en este momento: un archivo no puede
    // contener su propio hash. Aun así cuenta como documento entregado.
    tablaHTML += `<tr><td class="nombre"><strong>${certPdfNombre}</strong></td><td class="hash">---</td></tr>`;

    /* Las demás filas salen de `archivosCargados`, que YA incluye la solicitud y
       la comunicación del SRI: `cargarComunicacionPDF` las añade por
       `agregarArchivosConCategoria`. Aquí no se añade ninguna fila más.

       Se intentó añadir la comunicación aparte y salió DUPLICADA: aparecía una
       vez por su propia fila y otra por `archivosCargados`. La lista de la tabla
       es una sola, y es esa. */
    if (window.archivosCargados && window.archivosCargados.length > 0) {
        for (let item of window.archivosCargados) {
            let hash = item.md5 || 'Calculando...';
            if (hash === 'Calculando...') {
                try {
                    hash = await calcularMD5(item.file);
                    item.md5 = hash;
                } catch (e) {
                    hash = 'N/A';
                }
            }
            tablaHTML += `<tr>
                <td class="nombre">${item.name}</td>
                <td class="hash">${hash}</td>
            </tr>`;
        }
    }

    tablaHTML += `</tbody></table>`;

    const datosArchivosDiv = document.getElementById("datos-archivos");
    const tablaPreviaDiv = document.getElementById("tabla-previa");
    if (datosArchivosDiv) {
        // No duplicar la tabla dentro del bloque de datos de la solicitud.
        datosArchivosDiv.innerHTML = "";
        ocultar(datosArchivosDiv);
    }
    if (tablaPreviaDiv) {
        tablaPreviaDiv.innerHTML = tablaHTML;
        mostrar(tablaPreviaDiv);
    }

    actualizarCantidadDocumentosDigitales();
}

// Cuenta los documentos digitales y actualiza el span correspondiente
function actualizarCantidadDocumentosDigitales() {
    const cantDocs = document.getElementById("cantidad-docs-digitales");
    if (!cantDocs) return;

    /* archivosCargados YA contiene todo lo que el usuario entregó: la
       solicitud, la comunicación del SRI (la añade cargarComunicacionPDF) y
       cada soporte. Solo falta sumar la certificación, que se genera aquí y por
       eso no está en la lista.

       NO hay que añadir la comunicación aparte: ya está contada. Se intentó y el
       total daba 9 en un caso de 8. */
    const archivos = window.archivosCargados ? window.archivosCargados.length : 0;
    cantDocs.textContent = archivos + 1;
}
// Mostrar bloque de certificación según tipo de contribuyente
document.addEventListener("DOMContentLoaded", function () {
    function actualizarBloqueCertificacion() {
    } 
    // Exponer para que otras rutinas puedan llamarlo si cambia el contexto
    window.actualizarBloqueCertificacion = actualizarBloqueCertificacion;
}); // <-- cierre correcto del addEventListener
// =====================
// Integración del botón REGISTRARSE con registroModulo
// =====================
document.addEventListener("DOMContentLoaded", function () {
    // Inicializa el contexto global si no existe
    window.recuperaIVA_ctx = window.recuperaIVA_ctx || {
        ruc: null,
        razonSocial: null,
        saldo: null
    };

    const registroBtn = document.getElementById("registroBtn");
    if (registroBtn) {
        registroBtn.addEventListener("click", function () {
            const ctx = window.recuperaIVA_ctx || {};




                                                // Las distintas estructuras PDF pueden publicar el monto
                                                // en cualquiera de estas fuentes equivalentes.
                                                const fuentesMonto = [
                                                    window.MONTO_SOLICITADO,
                                                    window.SALDO_CREDITO,
                                                    ctx.saldo
                                                ];
                                                const montoSolicitud = fuentesMonto
                                                    .map(valor => Number(valor))
                                                    .find(valor => Number.isFinite(valor) && valor > 0) || 0;
                                                ctx.saldo = montoSolicitud;

                                                if (!ctx.saldo) {
                                                    window.aviso.error("No se pudo leer el monto de la solicitud en el PDF. Vuelva a cargar el archivo o compruebe que es la solicitud de devolución completa.");
                                                    return;
                                                }

                                                console.log("[REGISTRO] saldo enviado:", ctx.saldo, {
                                                        montoSolicitud: window.MONTO_SOLICITADO
                                                });

            if (window.RegistroModulo && window.RegistroModulo.mostrarModalRegistro) {
                Promise.resolve(window.RegistroModulo.mostrarModalRegistro({
                    ruc: ctx.ruc || '',
                    razonSocial: ctx.razonSocial || '',
                    saldo: ctx.saldo || '',
                    direccion: ctx.direccion || ''
                })).catch(error => {
                    console.error("Error al abrir el módulo de registro:", error);
                    window.aviso.error("No se pudo abrir el formulario de registro. Recargue la página; si persiste, contacte a soporte.");
                });
            } else {
                window.aviso.error("El formulario de registro no está disponible. Recargue la página; si persiste, contacte a soporte.");
            }
        });
    }
});
        // Rol y otros helpers solo tras cargar el DOM
        document.addEventListener("DOMContentLoaded", function() {
            if (typeof window.setText === "function") {
                window.setText("cert-rol", (window.__SOCIEDAD === true) ? ", en calidad de Representante Legal de " : ", ");
            }
            console.log("JS cargado OK");
        });
        const normRuc = (v) => String(v ?? "").replace(/\D/g, "").trim();

        const parseCaduca = (s) => {
            if (!s) return null;
            const partes = String(s).split("/");
            if (partes.length !== 3) return null;
            const [dia, mes, anio] = partes.map(Number);
            if (isNaN(dia) || isNaN(mes) || isNaN(anio)) return null;
            return new Date(anio, mes - 1, dia, 23, 59, 59);
        };
let ultimoRucVerificado = "";
window.cargarTXT = function cargarTXT(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Obtener el RUC del nombre del archivo
    const fileName = file.name;
    const RUCTXT = fileName.split('_')[0];

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = function (e) {
        const lines = e.target.result.split('\n').filter(line => line.trim() !== ""); // Filtrar líneas vacías
        let fechas = [];
        let valoresRetenidos = [];
        let agentesRetencion = new Set();
        let cantidadRetenciones = 0;

        for (let i = 1; i < lines.length; i++) {
            let columns = lines[i].split('\t').map(col => col.replace(/"/g, "").trim()); // Eliminar comillas y espacios extra

            if (columns.length < 12) continue; // Evitar líneas incompletas

            let fechaEmision = columns[2]; // FECHA DE EMISIÓN (columna 3, índice 2)
            let valorRetenido = parseFloat(columns[10]) || 0; // VALOR RETENIDO IVA (columna 11, índice 10)
            let rucAgente = columns[0]; // RUC DEL AGENTE RETENCIÓN (columna 1, índice 0)

            if (fechaEmision && fechaEmision.includes('/')) {
                let partesFecha = fechaEmision.split('/');
                if (partesFecha.length === 3) {
                    let mes = partesFecha[1].padStart(2, '0'); // Asegurar formato MM
                    let anio = partesFecha[2];
                    fechas.push(`${mes}/${anio}`); // Guardamos solo MES/AÑO
                }
            }

            if (valorRetenido > 0) { // Solo sumar líneas con valores retenidos mayores a 0
                valoresRetenidos.push(valorRetenido);
                cantidadRetenciones++;
            }

            if (rucAgente) {
                agentesRetencion.add(rucAgente);
            }
        }

        if (fechas.length === 0 || valoresRetenidos.length === 0) {
            window.aviso.error("No se encontraron fechas ni valores retenidos en el archivo TXT. Compruebe que es el reporte de retenciones correcto.");
            return;
        }

        // Ordenar las fechas en orden cronológico (mes/año)
        fechas.sort((a, b) => {
            let [mesA, anioA] = a.split('/').map(Number);
            let [mesB, anioB] = b.split('/').map(Number);
            return anioA !== anioB ? anioA - anioB : mesA - mesB;
        });

        let periodoDesde = fechas[0];
        let periodoHasta = fechas[fechas.length - 1];
        let totalRetenido = valoresRetenidos.reduce((acc, curr) => acc + curr, 0).toFixed(2);
        let cantidadAgentes = agentesRetencion.size;

        // Crear variables adicionales copiando los datos
        let copiaCantidadRetenciones = cantidadRetenciones;
        let copiaCantidadAgentes = cantidadAgentes;
        let copiatotalRetenido = totalRetenido;       

        console.log("📌 Datos Extraídos:");
        console.log("RUCTXT:", RUCTXT);
        console.log("Periodo Desde:", periodoDesde);
        console.log("Periodo Hasta:", periodoHasta);
        console.log("Monto Retenido:", totalRetenido);
        console.log("Cantidad de Retenciones:", cantidadRetenciones);
        console.log("Cantidad de Agentes de Retención:", cantidadAgentes);

        actualizarElemento("ruc-txt", RUCTXT);
        actualizarElemento("retenido", totalRetenido);
        actualizarElemento("periodo-desde", periodoDesde);
        actualizarElemento("periodo-hasta", periodoHasta);
        actualizarElemento("periodo-declaracion", periodoHasta); // Solo mostrar el periodo final

        // Actualizar elementos con las variables adicionales
        actualizarElemento("copia-cantidad-retenciones", copiaCantidadRetenciones);
        actualizarElemento("copia-cantidad-agentes", copiaCantidadAgentes);

        // Mostrar el contenedor con los datos del TXT
        mostrar(document.getElementById("datos-txt"));

        // Llamar a mostrarIdentificacionGuardada después de cargar el TXT
        mostrarIdentificacionGuardada(RUCTXT);
    };
}


function actualizarSaldoCredito(saldo, datoTipoPlan) {
    document.getElementById('prev-dec-saldo-credito').textContent = saldo;
    evaluarPermisosDescarga();
}

// Las descargas dependen únicamente de que el RUC esté registrado y su fecha sea autorizada.
function evaluarPermisosDescarga() {
    const btnPDF = document.getElementById("downloadReportButton");
    const btnTABLA = document.getElementById("downloadReportButton2");
    const autorizado = window.clienteAutorizadoPorFecha === true;
    if (btnPDF) btnPDF.disabled = !autorizado;
    if (btnTABLA) btnTABLA.disabled = !autorizado;
    console.log(autorizado
        ? "✅ Descargas habilitadas: RUC registrado y fecha autorizada."
        : "🔒 Descargas bloqueadas: falta validar RUC registrado y fecha.");
}

function mostrarIdentificacionGuardada(ruc) {
    let contenedor = document.getElementById("ruc-txt");
    if (contenedor) {
        console.log("Elemento encontrado, actualizando contenido...");
        contenedor.textContent = ruc;
    } else {
        console.error("Elemento con ID 'ruc-txt' no encontrado.");
    }
}

function llenarSelectoresPeriodo(mesesFiscales) {
    document.getElementById("periodo-desde").textContent = mesesFiscales[mesesFiscales.length - 1];
    document.getElementById("periodo-hasta").textContent = mesesFiscales[0];
}

/* RETIRADA EN H6 — `validarSubidaPDF()`
   Dependía de `#retenido`, `#pdfInput` y `#ivaInput`, tres elementos del flujo
   antiguo que ya NO existen en `index.html` (el RUC y el monto se extraen hoy
   del PDF de la solicitud). Al no existir `#retenido`, la función lanzaba una
   excepción en cuanto se cargaba un TXT; estaba llamándose desde el flujo del
   TXT. Se retira la función y su llamada. La validación de que hay solicitud
   cargada la hace hoy `verificarRUC`. */


// ================================
// ✅ MONTO SOLICITADO (PDF SOLICITUD)
// ================================

function obtenerFraseMontoSolicitadoHastaParentesis(extractedText) {
    const t = (extractedText || "").replace(/\s+/g, " ").trim();

    const inicio = t.toLowerCase().indexOf(
        "el valor que estoy solicitando en esta petición asciende a un monto de usd"
    );

    if (inicio === -1) return null;

    const desde = t.substring(inicio);
    const posPar = desde.indexOf("(");

    if (posPar === -1) {
        return desde.substring(0, Math.min(desde.length, 180));
    }

    return desde.substring(0, posPar + 1);
}
function normalizarNumeroEC(valor) {
    if (!valor) return 0;

    let s = String(valor).trim().replace(/[^\d.,-]/g, "");
    const tieneComa = s.includes(",");
    const tienePunto = s.includes(".");

    if (tieneComa && tienePunto) {
        if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
            s = s.replace(/\./g, "").replace(",", ".");
        } else {
            s = s.replace(/,/g, "");
        }
    } else if (tieneComa && !tienePunto) {
        s = s.replace(",", ".");
    }

    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
}

// ✅ Fuente única: monto impreso como "4508.49 ... DÓLARES CON ..." / "565.23 ... DÓLARES CON ..."
// 🔧 Normaliza texto para reconstruir números partidos por pdf.js
function normalizarTextoParaMontosPDF(t) {
    return String(t || "")
        .replace(/\u0000/g, " ")
        .replace(/\s+/g, " ")
        // 🔧 reconstruir números partidos por pdf.js:
        // 4 508 . 49  -> 4508.49
        // 4 5 0 8 . 4 9 -> 4508.49
        .replace(/(\d)\s+(?=\d)/g, "$1")
        .replace(/(\d)\s+(?=[.,])/g, "$1")
        .replace(/([.,])\s+(?=\d)/g, "$1")
        .trim();
}

function extraerMontoSolicitadoDesdeDolaresCon_ESTRICTO(extractedText) {
    const t = normalizarTextoParaMontosPDF(extractedText);

    // Patrón 1: Frase legal con dólares
    const re1 = /\b(\d{1,6}(?:[.,]\d{3})*[.,]\d{2})\b\s*(?:[\(,]\s*)?[A-ZÁÉÍÓÚÑÜ\s]{3,220}\bD[ÓO]LARES\s+CON\b/i;
    const m1 = t.match(re1);
    if (m1 && m1[1]) {
        const n = normalizarNumeroEC(m1[1]);
        if (n > 0) return n;
    }

    // Patrón 2: USD 1234.56
    const re2 = /\bUSD\s*(\d{1,6}(?:[.,]\d{3})*(?:[.,]\d{2})?)\b/i;
    const m2 = t.match(re2);
    if (m2 && m2[1]) {
        const n = normalizarNumeroEC(m2[1]);
        if (n > 0) return n;
    }

    // Patrón 3: cualquier valor numérico con decimales cerca de SOLICITADO / DEVOLUCION / MONTO
    const re3 = /(?:SOLICITAD[OA]|MONTO|VALOR|DEVOLUCI[ÓO]N)[\s\S]{0,80}?\b(\d{1,6}(?:[.,]\d{3})*[.,]\d{2})\b/i;
    const m3 = t.match(re3);
    if (m3 && m3[1]) {
        const n = normalizarNumeroEC(m3[1]);
        if (n > 0) return n;
    }

    return 0;
}

function procesarMontoSolicitadoSolicitud(extractedText) {
    let monto = extraerMontoSolicitadoDesdeDolaresCon_ESTRICTO(extractedText);
    console.log("✅ MONTO_SOLICITADO (PDF):", monto);

    window.MONTO_SOLICITADO = monto;
    window.SALDO_CREDITO = monto;
    if (window.recuperaIVA_ctx) {
        window.recuperaIVA_ctx.saldo = monto;
    }

    const el = document.getElementById("prev-dec-saldo-credito");
    if (el) el.textContent = monto ? monto.toFixed(2) : "0.00";
}

function dirimirTipoTramite(extractedText, fileName) {
    const t = (extractedText || "").toUpperCase();
    const fn = (fileName || "").toUpperCase();

    // El tipo de contribuyente no define el impuesto. En particular,
    // "REPRESENTANTE LEGAL" aparece tanto en IVA como en RTA.
    const contenidoIVA =
        t.includes("RETENCIONES DE IVA NO COMPENSADAS") ||
        t.includes("DEVOLUCIÓN DE RETENCIONES DE IVA") ||
        t.includes("DEVOLUCION DE RETENCIONES DE IVA") ||
        t.includes("IMPUESTO AL VALOR AGREGADO") ||
        t.includes("FORMULARIO 104") ||
        t.includes("IVA NO COMPENSADAS");

    const contenidoRTA =
        t.includes("RENTA ANUAL") ||
        t.includes("IMPUESTO A LA RENTA") ||
        t.includes("TRÁMITE DE PAGO EN EXCESO") ||
        t.includes("TRAMITE DE PAGO EN EXCESO") ||
        t.includes("FORMULARIO SOLICITUD ARTÍCULO 119") ||
        t.includes("FORMULARIO SOLICITUD ARTICULO 119") ||
        t.includes("SALDO A FAVOR");

    const nombreIVA = fn.includes("RETIVA") || fn.includes("RECIVA") || fn.includes("I03");
    const nombreRTA = fn.includes("RETRTA") || fn.includes("RECRTA") || fn.includes("R03") || fn.includes("RENTA");

    let nuevoTipo = window.TIPO_TRAMITE || "recuperaIVA";
    if (contenidoIVA) {
        nuevoTipo = "recuperaIVA";
    } else if (contenidoRTA) {
        nuevoTipo = "recuperaRTA";
    } else if (nombreIVA) {
        nuevoTipo = "recuperaIVA";
    } else if (nombreRTA) {
        nuevoTipo = "recuperaRTA";
    }

    console.log("🎯 Trámite dirimido automáticamente:", nuevoTipo);
    if (typeof window.cambiarTipoTramite === "function") {
        window.cambiarTipoTramite(nuevoTipo);
    }
    return nuevoTipo;
}
window.dirimirTipoTramite = dirimirTipoTramite;

function esSociedadPorSolicitud(extractedText) {
    const t = (extractedText || "").toUpperCase();
    if (/PERSONAS?\s+NATURALES?\s+NO\s+OBLIGADAS?\s+A\s+LLEVAR\s+CONTABILIDAD/.test(t)) return false;
    const mRuc = t.match(/\b\d{13}\b/);
    if (mRuc) {
        const ruc = mRuc[0];
        const tercerDigito = parseInt(ruc.charAt(2), 10);
        if (tercerDigito === 9) return true;
        if (tercerDigito < 6) return false;
    }
    if (t.includes("RAZON SOCIAL") || t.includes("RAZÓN SOCIAL") || t.includes("COMPAÑIA") || t.includes("COMPAÑÍA") || t.includes("S.A.") || t.includes("CIA. LTDA.") || t.includes("SOCIEDAD")) {
        return true;
    }
    return false;
}
window.esSociedadPorSolicitud = esSociedadPorSolicitud;

window.extraerDatosPDF = async function extraerDatosPDF(inputFileOrObj) {
    try {
        let file = null;
        if (inputFileOrObj instanceof File) {
            file = inputFileOrObj;
        } else if (inputFileOrObj && inputFileOrObj.files && inputFileOrObj.files[0]) {
            file = inputFileOrObj.files[0];
        } else {
            file = document.getElementById("inputSolicitudPDF")?.files[0];
        }

        if (!file) {
            window.aviso.alerta("No se seleccionó ningún archivo PDF. Elija la solicitud de devolución para continuar.");
            return;
        }

        console.log("🚀 Analizando PDF:", file.name, file.size);

        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = async function () {
            try {
                if (typeof pdfjsLib === "undefined") {
                    window.aviso.error("No se pudo leer el PDF porque la librería de lectura no está cargada. Compruebe su conexión a Internet y recargue la página.");
                    return;
                }

                const typedarray = new Uint8Array(reader.result);
                const loadingTask = pdfjsLib.getDocument({
                    data: typedarray,
                    disableWorker: true
                });
                const pdf = await loadingTask.promise;

                let raw = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const pageText = await page.getTextContent();
                    raw += pageText.items.map(it => it.str).join(" ") + " ";
                }
                const extractedText = raw.replace(/\s+/g, " ").trim();
                console.log("📄 Texto extraído:", extractedText.length, "caracteres.");

                dirimirTipoTramite(extractedText, file.name);

                let canton = "";
                const mCanton = extractedText.match(/ZONA\s*\d+\s*\/\s*[^\/]+\/\s*([A-ZÁÉÍÓÚÑ ]+?)(?=\s+[A-ZÁÉÍÓÚÑ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ]{3,}){1,}\s+\d{10}\b|\s+\d{10}\b|\s+Provincia:|$)/i);
                if (mCanton) canton = mCanton[1].trim().replace(/\s{2,}/g, " ");

                procesarDatosSolicitudIdentidad(extractedText, canton);
                procesarDatosSolicitudDeclaracion(extractedText);
                procesarMontoSolicitadoSolicitud(extractedText);

                const esSoc = esSociedadPorSolicitud(extractedText);
                if (typeof window.setTipoContribuyente === "function") {
                    window.setTipoContribuyente(esSoc);
                }

                // FORZAR VISIBILIDAD DE PANELES DE DATOS Y CERTIFICACIÓN EN PANTALLA
                const datosTxtEl = document.getElementById("datos-txt");
                if (datosTxtEl) mostrar(datosTxtEl);

                const datosDecEl = document.getElementById("datos-declaracion");
                if (datosDecEl) mostrar(datosDecEl);

                const vistaPreviaEl = document.getElementById("vista-previa");
                if (vistaPreviaEl) mostrar(vistaPreviaEl);

                const tablaPreviaEl = document.getElementById("tabla-previa");
                if (tablaPreviaEl) mostrar(tablaPreviaEl);

                if (typeof window.emitirCertificacion === "function") {
                    window.emitirCertificacion();
                }
                if (typeof window.generarTablaArchivos === "function") {
                    window.generarTablaArchivos();
                }

                if (typeof habilitarCargaArchivosPostSolicitud === "function") {
                    habilitarCargaArchivosPostSolicitud();
                }
            } catch (errInner) {
                console.error("❌ Error al procesar páginas del PDF:", errInner);
                window.aviso.error("No se pudieron procesar las páginas del PDF: " + errInner.message + ". Abra el PDF, vuelva a guardarlo e inténtelo de nuevo.");
            }
        };
    } catch (e) {
        console.error("❌ Error en extraerDatosPDF:", e);
        window.aviso.error("No se pudieron extraer los datos de la solicitud: " + e.message + ". Compruebe que el PDF no está dañado y vuelva a cargarlo.");
    }
};
window.extraerDatosPDFArchivo = window.extraerDatosPDF;

/* ---------------------------------------------------------------------------
   CONSULTA DE LICENCIA

   La consulta se resuelve contra un endpoint PUBLICO del backend de licencias.
   El navegador nunca recibe la API key ni el ID de la hoja: la clave y los datos
   permanecen en el proveedor del servicio (Estandar GJVcorp v1.1 §7.8.11).

   Antes esta funcion consultaba Google Sheets directamente con una API key
   incrustada en el codigo, lo que exponia la base completa de clientes.

   El endpoint se configura en `config.publica.js`.
--------------------------------------------------------------------------- */

function leerConfigPublica() {
    const cfg = window.IVA_CERT_CONFIG || {};
    return {
        endpoint: String(cfg.endpointLicencia || "").trim(),
        timeoutMs: Number(cfg.timeoutLicenciaMs) > 0 ? Number(cfg.timeoutLicenciaMs) : 12000,
        mesesGracia: Number.isFinite(Number(cfg.mesesGracia)) ? Number(cfg.mesesGracia) : 6
    };
}

/* Consulta el estado de licencia de un RUC contra el Worker de licencias.
   Devuelve la respuesta del Worker o lanza un error con un motivo legible.

   El Worker ya devuelve `ok`, `estado` y `vigente` calculados en hora de
   Ecuador. Aqui NO se reinterpreta la caducidad: se usa lo que dice el
   servicio, que es la unica fuente. */
async function consultarLicenciaRUC(ruc) {
    const cfg = leerConfigPublica();

    if (!cfg.endpoint) {
        throw new Error("Falta configurar el servicio de consulta de licencias.");
    }

    const controlador = typeof AbortController !== "undefined" ? new AbortController() : null;
    const temporizador = controlador
        ? setTimeout(function () { controlador.abort(); }, cfg.timeoutMs)
        : null;

    let respuesta;
    try {
        // El Worker expone GET /cliente?ruc=... y responde con CORS.
        respuesta = await fetch(cfg.endpoint + "?ruc=" + encodeURIComponent(ruc), {
            method: "GET",
            redirect: "follow",
            signal: controlador ? controlador.signal : undefined
        });
    } catch (e) {
        if (e && e.name === "AbortError") {
            throw new Error("El servicio de licencias tardó demasiado en responder.");
        }
        throw new Error("No se pudo contactar el servicio de licencias.");
    } finally {
        if (temporizador) clearTimeout(temporizador);
    }

    // El Worker usa 404 para "no encontrado": eso NO es un fallo del servicio.
    if (respuesta.status === 404) {
        return { ok: false, code: "NO_ENCONTRADO" };
    }
    if (!respuesta.ok) {
        throw new Error("El servicio de licencias respondió HTTP " + respuesta.status + ".");
    }

    const texto = await respuesta.text();
    let datos;
    try {
        datos = JSON.parse(texto);
    } catch (_) {
        throw new Error("El servicio de licencias no devolvió una respuesta válida.");
    }
    if (!datos || datos.ok !== true) {
        const codigo = (datos && datos.code) || "ERROR";
        // NO_ENCONTRADO se trata como respuesta legitima; lo demas es un fallo.
        if (codigo === "NO_ENCONTRADO") return { ok: false, code: codigo };
        throw new Error((datos && datos.message) || "El servicio de licencias rechazó la consulta (" + codigo + ").");
    }
    return datos;
}

/* De una lista de registros de un mismo RUC elige el de caducidad mas
   reciente; si ninguno tiene fecha valida, el primero. */
function elegirMejorRegistro(registros, parseFecha) {
    let mejor = null;
    let mejorFecha = null;
    for (let i = 0; i < registros.length; i++) {
        const f = parseFecha(registros[i].caduca);
        if (!f) { if (!mejor) mejor = registros[i]; continue; }
        if (!mejor || !mejorFecha || f > mejorFecha) { mejor = registros[i]; mejorFecha = f; }
    }
    return mejor;
}

async function verificarRUC() {
    let rucElement = document.getElementById("rucRUC");
    if (!rucElement) {
        console.error("❌ Error: Elemento 'rucRUC' no encontrado en el DOM.");
        return;
    }
    let rucIngresado = rucElement.textContent.trim();

    let resultado = document.getElementById("resultado");
    let fechaRegistro = document.getElementById("fechaRegistro");
    let tipoPlan = document.getElementById("tipoPlan");
    let registroBtn = document.getElementById("registroBtn");
    const downloadReportButton = document.getElementById("downloadReportButton"); // PDF
    const downloadReportButton2 = document.getElementById("downloadReportButton2"); // TABLA

    const normalizarRucCliente = (valor) => String(valor || "").replace(/\D/g, "").padStart(13, "0").slice(-13);
    const parseFechaCaducaCliente = (valor) => {
        const match = String(valor || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) return null;
        const fecha = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 23, 59, 59);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
    };

    // Cada consulta reinicia la autorización hasta comprobar RUC y fecha.
    window.clienteAutorizadoPorFecha = false;

    // Asegurar que los botones comiencen deshabilitados
    if (downloadReportButton) downloadReportButton.disabled = true;
    if (downloadReportButton2) downloadReportButton2.disabled = true;

    if (resultado) {
        resultado.textContent = "⏳ Validando cliente...";
        resultado.style.color = "#0369a1";
    }


    if (!rucIngresado) {
        resultado.textContent = "No se encontró un RUC válido";
        fechaRegistro.textContent = "";
        tipoPlan.textContent = "";
        ocultar(tipoPlan);
        if (registroBtn) ocultar(registroBtn);
        return;
    }

    try {
                const cfg = leerConfigPublica();
                const fechaHoy = new Date();

                // Normalizar RUC ingresado
                const rucNormalizado = normalizarRucCliente(rucIngresado);

                // Consulta al backend de licencias. El backend resuelve el RUC y
                // devuelve solo el registro mas reciente de ese contribuyente.
                const datos = await consultarLicenciaRUC(rucNormalizado);

                if (datos && datos.ok === true) {
                    // Un mismo RUC puede tener varios registros (renovaciones).
                    // Se elige el de caducidad mas reciente, igual que antes.
                    const registros = (Array.isArray(datos.filas) && datos.filas.length)
                        ? datos.filas
                        : [datos];
                    const mejor = elegirMejorRegistro(registros, parseFechaCaducaCliente) || datos;

                    const datoTipoPlan = String(mejor.plan || "").trim();
                    const tipoServicio = String(mejor.tipoServicio || "").trim();
                    const fechaCaducidad = String(mejor.caduca || "").trim();
                    const mejorFecha = parseFechaCaducaCliente(fechaCaducidad);

                    if (fechaCaducidad && mejorFecha) {
                        fechaRegistro.textContent = `📅 Válido hasta: ${fechaCaducidad}`;

                        // Límite del periodo de gracia (por defecto 6 meses)
                        const fechaGracia = new Date(fechaHoy);
                        fechaGracia.setMonth(fechaGracia.getMonth() - cfg.mesesGracia);

                        if (mejorFecha >= fechaHoy) {
                            // Licencia Activa / Vigente
                            window.clienteAutorizadoPorFecha = true;
                            resultado.textContent = "✅ RUC válido y vigente en la base de datos";
                            resultado.style.color = "green";
                            if (registroBtn) ocultar(registroBtn);
                            let textoPlan = `Plan: ${datoTipoPlan}`;
                            if (tipoServicio) textoPlan += ` | Servicio: ${tipoServicio}`;
                            tipoPlan.textContent = textoPlan;
                            alternarVisibilidad(tipoPlan, datoTipoPlan);
                            evaluarPermisosDescarga();
                        } else if (mejorFecha >= fechaGracia) {
                            // Licencia caducada PERO dentro del periodo de gracia -> permitido
                            window.clienteAutorizadoPorFecha = true;
                            resultado.textContent = `⚠️ Licencia caducada (${fechaCaducidad}), pero dentro del periodo de gracia de ${cfg.mesesGracia} meses. Se permite la emisión.`;
                            resultado.style.color = "#d97706";
                            if (registroBtn) mostrar(registroBtn);
                            let textoPlan = `Plan: ${datoTipoPlan}`;
                            if (tipoServicio) textoPlan += ` | Servicio: ${tipoServicio}`;
                            tipoPlan.textContent = textoPlan;
                            alternarVisibilidad(tipoPlan, datoTipoPlan);
                            evaluarPermisosDescarga();
                        } else {
                            // Caducado fuera del periodo de gracia -> bloqueado
                            resultado.textContent = `❌ Licencia caducó el ${fechaCaducidad} (hace más de ${cfg.mesesGracia} meses). Debe renovar para descargar.`;
                            resultado.style.color = "red";
                            if (registroBtn) mostrar(registroBtn);
                            ocultar(tipoPlan);
                        }
                    } else {
                        resultado.textContent = "❌ Registro de RUC sin fecha de caducidad válida. Debe renovar.";
                        resultado.style.color = "red";
                        fechaRegistro.textContent = "📅 Válido hasta: No disponible";
                        ocultar(tipoPlan);
                        if (registroBtn) mostrar(registroBtn);
                    }
                } else {
                    // El backend no encontró el RUC: nunca tuvo licencia
                    resultado.textContent = "❌ RUC no encontrado. Debe registrarse previamente para habilitar descargas.";
                    resultado.style.color = "red";
                    fechaRegistro.textContent = "";
                    tipoPlan.textContent = "";
                    ocultar(tipoPlan);
                    if (registroBtn) mostrar(registroBtn);
                }

    } catch (error) {
        console.error("❌ Error al consultar el servicio de licencias:", error);
        // El mensaje dice qué falló y qué hacer (Estandar §7.6), sin afirmar
        // que el RUC no existe: un fallo del servicio no es un RUC inválido.
        resultado.textContent = "No se pudo validar el registro: " + (error && error.message ? error.message : "error desconocido") + " Compruebe su conexión y vuelva a intentarlo.";
        resultado.style.color = "red";
        fechaRegistro.textContent = "";
        ocultar(tipoPlan);
        if (registroBtn) mostrar(registroBtn);
    }
}
window.verificarRUC = verificarRUC;

function registrarRUC() {
    const FORM_URL = "https://forms.gle/tKKE3jmK6oGpZsD8A";
    window.open(FORM_URL, '_blank');
}

function imprimirVistaPreviaPDF() {
    // Estado ocupado: generar el PDF con html2canvas tarda más de 300 ms y el
    // usuario necesita saber que el clic hizo algo (§7.5).
    const botonPdf = document.getElementById("downloadReportButton");
    const textoBotonPdf = botonPdf ? botonPdf.textContent : "";
    if (botonPdf) {
        botonPdf.disabled = true;
        botonPdf.textContent = "Generando…";
        botonPdf.classList.add("is-busy");
    }

    try {

        if (typeof window.emitirCertificacion === "function") {
            window.emitirCertificacion();
        }
        console.log("✅ Función imprimirVistaPreviaPDF ejecutada correctamente");

    // Verificar si la vista previa está visible
    let vistaPrevia = document.getElementById("vista-previa");
    if (!vistaPrevia || vistaPrevia.hidden) {
        window.aviso.error("No hay contenido que exportar. Cargue la solicitud y sus documentos de soporte antes de descargar.");
        return;
    }

    // Importar jsPDF
    const { jsPDF } = window.jspdf;
    let doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    // Clonar el contenido para evitar modificaciones en el DOM
    let contenidoClonado = vistaPrevia.cloneNode(true);
    contenidoClonado.style.width = "210mm"; // Ancho total A4
    contenidoClonado.style.height = "auto"; // Ajustar altura dinámicamente
    contenidoClonado.style.margin = "0";
    contenidoClonado.style.padding = "0";
    contenidoClonado.style.fontSize = "16px"; // Tamaño de fuente aumentado para mejor legibilidad
    contenidoClonado.style.background = "#FFFFFF";

    /* OJO — NO sacar el clon del flujo visual con `left: -10000px`.
       Se probó y el PDF salió EN BLANCO: la exportación usa la posición del
       elemento como origen del contenido, así que el desplazamiento se
       traslada al documento y todo el texto acaba dibujado en X negativo
       (≈ -5967 pt en una hoja A4 de 595 pt de ancho). El contenido está —se
       puede extraer— pero cae fuera de la página.

       El clon se deja donde estaba: dentro del documento y en su sitio. */

    /* La exportación convierte el HTML a imágenes de texto y luego reconstruye
       el texto. Si una palabra se parte entre dos nodos, la reconstrucción la
       pega con la siguiente y el resultado sale como `JIMENEZVILLAVICENCIO`.

       La causa está en el marcado: cada `span` es un nodo aparte, así que la
       frase "Yo, <span>NOMBRE</span>, con cédula..." se dibuja en trozos. Para
       que el PDF reconstruya los espacios, se normalizan los nodos de texto:
       los que solo contienen espacios se convierten en un espacio simple, y los
       vacíos se retiran. */
    const normalizarNodos = (raiz) => {
        const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
        const sobrantes = [];
        let nodo;
        while ((nodo = caminante.nextNode())) {
            const original = nodo.nodeValue;
            const limpio = original.replace(/[\t\r\n]+/g, " ").replace(/ {2,}/g, " ");
            if (limpio !== original) { nodo.nodeValue = limpio; }
            if (limpio === "" && original !== "") { sobrantes.push(nodo); }
        }
        sobrantes.forEach((n) => n.parentNode && n.parentNode.removeChild(n));
    };
    normalizarNodos(contenidoClonado);

    /* NO se monta el clon en el documento. También se probó y también descoloca
       la exportación: al añadirlo al `body`, el contenido pasa a estar dos veces
       y el motor calcula el origen con el elemento equivocado. El clon se queda
       suelto, que es como funcionaba. */
    
    // Ajustes específicos de formato
    let tituloSolicitud = contenidoClonado.querySelector("h1");
    if (tituloSolicitud) {
        tituloSolicitud.style.whiteSpace = "nowrap"; // Evita el salto de línea en el título
        tituloSolicitud.style.textAlign = "center"; // Centra el título en la página
    }
    
    let acreditacion = contenidoClonado.querySelector(".acreditacion");
    if (acreditacion) {
        acreditacion.style.textAlign = "right"; // Alinea el texto a la derecha
        mostrar(acreditacion); // Asegura que se muestre correctamente
    }
    
    // Ajustar el renderizado con márgenes de 2 cm izquierdo y 1 cm derecho
    let opciones = {
        callback: function (doc) {
            doc.save(obtenerNombreCertificacion("pdf"));
        },
        x: 20, // Margen izquierdo de 2 cm
        y: 20, // Margen superior de 2 cm
        width: 170, // Ajuste para respetar márgenes: 210mm - (2cm + 1cm)
        windowWidth: 800,

        /* Las fuentes tienen que estar DESCARGADAS antes de rasterizar. Si no lo
           están, el motor mide el texto con la fuente de respaldo y lo dibuja con
           otra: de ahí salen las palabras pegadas y los espacios perdidos. Este
           es el punto donde se espera a que `Inter` esté lista. */
        html2canvas: {
            onclone: function (documentoClonado) {
                // El clon que recibe html2canvas ya lleva los nodos normalizados.
            }
        }
    };

    /* Se espera a que las fuentes estén cargadas. `document.fonts.ready` no
       basta: resuelve cuando no hay descargas EN CURSO, y si ninguna ha
       empezado todavía, resuelve de inmediato. Por eso se piden primero. */
    const asegurarFuentes = async () => {
        if (!document.fonts || typeof document.fonts.load !== "function") return;
        try {
            await Promise.all([
                document.fonts.load("400 16px Inter"),
                document.fonts.load("700 16px Inter"),
                document.fonts.load("italic 400 16px Inter")
            ]);
            await document.fonts.ready;
        } catch (e) {
            console.warn("No se pudieron precargar las fuentes:", e);
        }
    };

    // Renderizar el HTML al PDF respetando las dimensiones A4 y márgenes
    asegurarFuentes().then(function () {
        doc.html(contenidoClonado, opciones);
    }).catch(function (e) {
        console.error("Fallo al preparar el PDF:", e);
        window.aviso.error("No se pudo preparar el PDF: " + (e && e.message ? e.message : "error desconocido") + ".");
    });

    cleanData();

    } catch (err) {
        console.error("No se pudo generar el PDF:", err);
        window.aviso.error("No se pudo generar el PDF: " + (err && err.message ? err.message : "error desconocido") + ". Vuelva a cargar la solicitud e inténtelo de nuevo.");
    } finally {
        // El botón siempre vuelve a su estado, haya salido bien o mal.
        if (botonPdf) {
            botonPdf.disabled = false;
            botonPdf.textContent = textoBotonPdf;
            botonPdf.classList.remove("is-busy");
        }
    }
}

/* Comprueba que esté lo mínimo para emitir la certificación:
   la solicitud del trámite y, al menos, un documento de soporte.

   Hasta H6 esta función exigía siete campos del flujo antiguo (`pdfInput`,
   `ivaInput`, `valorMesInput`, `libroRetIVA1Input`, `libroVTASInput`,
   `listadoPDFInput`, `listadoXLSInput`) y el nombramiento para sociedades. Todos
   esos elementos se retiraron de `index.html`: la interfaz de hoy carga una
   solicitud y una lista flexible de hasta 10 soportes. La comprobación se
   reescribe sobre lo que existe de verdad. */
function verificarArchivosSubidos() {
    const inputSolicitud = document.getElementById("inputSolicitudPDF");
    const haySolicitud = !!(inputSolicitud && inputSolicitud.files && inputSolicitud.files.length > 0);
    const haySoportes = Array.isArray(window.archivosCargados) && window.archivosCargados.length > 0;

    const listo = haySolicitud && haySoportes;
    console.log("✅ Archivos listos:", listo, "· solicitud:", haySolicitud, "· soportes:", window.archivosCargados.length);

    if (listo) {
        generarTablaArchivos(); // Generar la tabla cuando todo esté listo

        const vistaPrevia = document.getElementById("vista-previa");
        if (vistaPrevia) mostrar(vistaPrevia); // Mostrar la certificación

        console.log("✅ Mostrando vista previa de certificación");
    }
}

function descargarTabla() {
    // Estado ocupado mientras se arma el libro y se calculan los MD5 pendientes.
    const botonTabla = document.getElementById("downloadReportButton2");
    const textoBotonTabla = botonTabla ? botonTabla.textContent : "";
    if (botonTabla) {
        botonTabla.disabled = true;
        botonTabla.textContent = "Generando…";
        botonTabla.classList.add("is-busy");
    }

    try {

    // Verificar si SheetJS (XLSX) está disponible
    if (typeof XLSX === "undefined") {
        window.aviso.error("No se pudo generar la tabla porque la librería de Excel no está cargada. Compruebe su conexión a Internet y recargue la página.");
        return;
    }

    // Obtener la tabla
    const tabla = document.getElementById('tabla-previa');
    if (!tabla) {
        window.aviso.error("No hay tabla que descargar. Cargue la solicitud y sus documentos de soporte antes de descargar.");
        return;
    }

    // Convertir la tabla a una hoja de cálculo
    const wb = XLSX.utils.book_new(); // Crear un nuevo libro de Excel
    const ws = XLSX.utils.table_to_sheet(tabla); // Convertir tabla a hoja de Excel

    // Ajustar el ancho de las columnas automáticamente
    const range = XLSX.utils.decode_range(ws["!ref"]); // Obtener el rango de la hoja
    ws["!cols"] = []; // Crear propiedad de anchos de columna

    for (let col = range.s.c; col <= range.e.c; col++) {
        let maxWidth = 10; // Ancho mínimo inicial
        for (let row = range.s.r; row <= range.e.r; row++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = ws[cellAddress];
            if (cell && cell.v) {
                const textLength = cell.v.toString().length;
                if (textLength > maxWidth) {
                    maxWidth = textLength; // Ajustar al texto más largo
                }
            }
        }
        ws["!cols"].push({ wch: maxWidth + 2 }); // Agregar un poco más de espacio
    }

    // Agregar la hoja al libro y descargar el archivo Excel
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, "GJVcorp_tablaMD5_recIVA.xlsx");

    } catch (err) {
        console.error("No se pudo generar la tabla:", err);
        window.aviso.error("No se pudo generar la tabla: " + (err && err.message ? err.message : "error desconocido") + ". Vuelva a cargar la solicitud e inténtelo de nuevo.");
    } finally {
        if (botonTabla) {
            botonTabla.disabled = false;
            botonTabla.textContent = textoBotonTabla;
            botonTabla.classList.remove("is-busy");
        }
    }
}

function cleanData() {
    window.clienteAutorizadoPorFecha = false;
    window.comunicacionSRI = null;
    window.archivosCargados = [];
    window.MONTO_SOLICITADO = 0;
    window.ultimoRucValidadoCliente = "";
    window.ultimoRucVerificado = "";
    ultimoRucVerificado = "";
    actualizarAnexoComunicacionSRI(null);

    console.log("🧹 Eliminando datos, ocultando secciones, limpiando archivos subidos y deshabilitando botones...");

    // 🔹 Limpiar contenido de los elementos indicados
    // (los ids inexistentes se ignoran solos: el bucle ya comprueba el elemento)
    const elementosLimpieza = [
        "ruc-txt", "periodo-desde", "periodo-hasta", "periodo-declaracion",
        "copia-cantidad-retenciones", "copia-cantidad-agentes", "prev-nombre", "prev-nombre-doc",
        "prev-ruc", "prev-ruc-doc", "prev-cedula", "prev-canton", "prev-direccion",
        "prev-dec-periodo-fiscal", "prev-dec-numero-serial", "prev-dec-saldo-credito",
        "rucRUC", "resultado", "fechaRegistro", "tipoPlan", "nombreRUC"
    ];

    elementosLimpieza.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.textContent = ""; // 🔹 Solo limpia el contenido
        }
    });

    // Reiniciar estados visibles de los dos documentos principales.
    const estadoSolicitud = document.getElementById("statusSolicitudPDF");
    if (estadoSolicitud) {
        estadoSolicitud.textContent = "Sin cargar";
        estadoSolicitud.classList.remove("cargado");
    }
    const estadoComunicacion = document.getElementById("statusComunicacionPDF");
    if (estadoComunicacion) {
        estadoComunicacion.textContent = "Opcional - Sin cargar";
        estadoComunicacion.classList.remove("cargado");
    }

    // Borrar y ocultar los datos extraídos de la comunicación del SRI.
    ["comunicacion-numero-tramite", "comunicacion-numero-oficio", "comunicacion-ruc"].forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = "";
    });
    const panelComunicacion = document.getElementById("datosComunicacionSRI");
    if (panelComunicacion) ocultar(panelComunicacion);

    // Vaciar la lista interactiva y restablecer su contador.
    actualizarTablaDocumentosUI();
    const cantidadDocs = document.getElementById("cantidad-docs-digitales");
    if (cantidadDocs) cantidadDocs.textContent = "";

    // Ocultar paneles de datos y mensajes residuales.
    ["datos-txt", "datos-declaracion"].forEach(id => {
        const panel = document.getElementById(id);
        if (panel) ocultar(panel);
    });
    ["errorComunicacionSRI", "mensajeCargaSoportes", "mensaje-error-ruc", "mensaje-error-declaracion"].forEach(id => {
        const mensaje = document.getElementById(id);
        if (mensaje) {
            mensaje.textContent = "";
            ocultar(mensaje);
        }
    });
    const registroBtn = document.getElementById("registroBtn");
    if (registroBtn) ocultar(registroBtn);

    // 🔹 Limpiar y OCULTAR la tabla `tabla-previa`
    const tablaPrevia = document.getElementById("tabla-previa");
    if (tablaPrevia) {
        tablaPrevia.innerHTML = ""; // 🔹 Elimina los datos
        ocultar(tablaPrevia); // 🔹 Oculta la tabla
    }

    // 🔹 Limpiar y OCULTAR `datos-archivos`
    const datosArchivosDiv = document.getElementById("datos-archivos");
    if (datosArchivosDiv) {
        datosArchivosDiv.innerHTML = ""; // 🔹 Elimina los datos
        ocultar(datosArchivosDiv); // 🔹 Oculta la sección
    }

    // 🔹 OCULTAR `datos-completos` (NO borrar innerHTML, solo ocultar)
    const datosCompletos = document.getElementById("datos-completos");
    if (datosCompletos) {
        ocultar(datosCompletos); // 🔹 Solo oculta la sección
    }

    // 🔹 OCULTAR `vista-previa`
    const vistaPrevia = document.getElementById("vista-previa");
    if (vistaPrevia) {
        ocultar(vistaPrevia); // 🔹 Oculta la vista previa
    }

    // 🔹 Reiniciar los inputs de archivos (eliminar archivos subidos)
    const inputsArchivos = document.querySelectorAll('input[type="file"]');
    inputsArchivos.forEach(input => {
        input.value = ""; // 🔹 Resetea el input de archivos
    });

    /* Los campos del flujo antiguo (`ivaInput`, `valorMesInput`,
       `libroRetIVA1Input`, `libroVTASInput`, `listadoPDFInput`,
       `solicitudDevolucionInput`, `listadoXLSInput`) y los inputs legacy
       (`txtInput`, `pdfInput`) se retiraron de `index.html` en H6. Aquí se
       mantenían habilitados y deshabilitados por listas de ids que ya no
       existen: el bloque no hacía nada. La interfaz de hoy siempre deja sus
       tres campos de archivo operativos para una carga nueva, así que no hay
       nada que reabrir. */

    // 🔹 Deshabilitar botones de descarga
    const botonesDescarga = [
        "downloadReportButton", "downloadReportButton2"
    ];

    botonesDescarga.forEach(id => {
        const boton = document.getElementById(id);
        if (boton) {
            boton.disabled = true; // 🔹 Deshabilita los botones de descarga
        }
    });

    console.log("✅ Datos eliminados, archivos limpiados, secciones ocultas y descargas deshabilitadas.");
}


document.addEventListener('DOMContentLoaded', function() {
    const downloadReportButton = document.getElementById('downloadReportButton');
    const downloadReportButton2 = document.getElementById('downloadReportButton2');

    if (downloadReportButton) {
        downloadReportButton.addEventListener('click', imprimirVistaPreviaPDF);
    } else {
        console.error("Elemento con ID 'downloadReportButton' no encontrado.");
    }
    if (downloadReportButton2) {
        downloadReportButton2.addEventListener('click', descargarTabla);
    } else {
        console.error("Elemento con ID 'downloadReportButton2' no encontrado.");
    }    
});

/* Cuando cambia cualquier campo de archivo que participa en la certificación,
   se revisa si ya está todo para emitir. En H6 la lista se redujo a los tres
   campos que existen: la solicitud, la comunicación del SRI y los soportes. */
document.addEventListener('DOMContentLoaded', function () {
    const archivos = [
        'inputSolicitudPDF',
        'inputComunicacionPDF',
        'multiFileInput'
    ];
    archivos.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', verificarArchivosSubidos);
        }
    });
});

document.addEventListener("DOMContentLoaded", function () {
    console.log("🚫 Protección contra capturas de pantalla activada.");

    // Bloquear la tecla PrintScreen
    document.addEventListener("keydown", function (event) {
        if (event.key === "PrintScreen") {
            event.preventDefault();
            window.aviso.alerta("Las capturas de pantalla no están permitidas en esta vista.");
            navigator.clipboard.writeText(""); // Borra el portapapeles
        }
    });

    document.addEventListener("keyup", function (event) {
        if (event.key === "PrintScreen") {
            navigator.clipboard.writeText(""); // Borra el portapapeles si intentan capturar
        }
    });
});

    // =====================
    // Lectura de PDF y extracción de monto solicitado
    // Requiere pdf.js (https://mozilla.github.io/pdf.js/)
    // =====================

    async function leerPDF(file) {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.worker.min.js';

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let textoCompleto = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const textoPagina = content.items.map(item => item.str).join(' ');
            textoCompleto += textoPagina + '\n';
        }
        return textoCompleto;
    }

    /* RETIRADO EN H6 — listener de `#inputPDF`
       Este bloque escuchaba un elemento `inputPDF` que no existe en el marcado:
       era un resto de ejemplo («Agrega en tu HTML: <input id="inputPDF">») que
       nunca llegó a ejecutarse. La lectura de la solicitud la hace hoy
       `cargarSolicitudPDF` sobre `#inputSolicitudPDF`. La función `leerPDF` se
       conserva porque la usa ese flujo. */

