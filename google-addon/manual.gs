// ================================================================
// POW - Sincronización del Manual RRHH con app-hr
// ================================================================
// Va pegado AL DOCUMENTO del manual (Extensiones > Apps Script), no es
// un add-on aparte.
//
// Configuración en Propiedades del script:
//   APP_URL      → https://hr.pow-apps.com
//   ADDON_SECRET → el mismo valor que ADDON_SECRET en Vercel
//
// Se hace así, empujando desde el Doc, y no leyendo el Doc desde la app,
// para no montar una service account de Google ni tener que publicar el
// documento: adentro están el procedimiento de despido y las bandas
// salariales.
//
// Ventaja de leerlo desde acá: se usa la estructura REAL de encabezados
// del documento, no un renderizado en texto. Por eso no hay que adivinar
// nada con expresiones regulares.
// ================================================================

var NIVELES = {};
NIVELES[DocumentApp.ParagraphHeading.HEADING1] = 1;
NIVELES[DocumentApp.ParagraphHeading.HEADING2] = 2;
NIVELES[DocumentApp.ParagraphHeading.HEADING3] = 3;
NIVELES[DocumentApp.ParagraphHeading.HEADING4] = 4;

function onOpen() {
  DocumentApp.getUi()
    .createMenu('Pow RRHH')
    .addItem('Sincronizar con app-hr', 'sincronizarManual')
    .addToUi();
}

/** Llamable a mano desde el menú y desde un trigger de tiempo. */
function sincronizarManual() {
  var secciones = leerSecciones_();
  var respuesta = enviar_(secciones);
  var ui = null;
  try { ui = DocumentApp.getUi(); } catch (e) { /* corriendo por trigger, sin UI */ }
  if (ui) {
    ui.alert(
      'Manual sincronizado',
      secciones.length + ' secciones enviadas.\n\n' +
        'Nuevas: ' + respuesta.nuevas + '\n' +
        'Modificadas: ' + respuesta.modificadas + '\n' +
        'Sin cambios: ' + respuesta.sin_cambios + '\n' +
        'Jubiladas: ' + respuesta.jubiladas + '\n\n' +
        'Sin revisar (falta marcar audiencia): ' + respuesta.sin_revisar,
      ui.ButtonSet.OK,
    );
  }
}

/**
 * Recorre el cuerpo y arma una sección por encabezado.
 *
 * El índice se saltea solo: es un elemento TABLE_OF_CONTENTS, no párrafos.
 * Las tablas sí se leen —la escala de vacaciones por antigüedad es una tabla—
 * aplanadas como filas separadas por " | ".
 */
function leerSecciones_() {
  var cuerpo = DocumentApp.getActiveDocument().getBody();
  var secciones = [];
  var ruta = [];
  var actual = null;

  function cerrar_() {
    if (actual) {
      actual.texto = actual.texto.join('\n').replace(/\n{3,}/g, '\n\n').trim();
      secciones.push(actual);
    }
  }

  for (var i = 0; i < cuerpo.getNumChildren(); i++) {
    var hijo = cuerpo.getChild(i);
    var tipo = hijo.getType();

    if (tipo === DocumentApp.ElementType.TABLE_OF_CONTENTS) continue;

    if (tipo === DocumentApp.ElementType.PARAGRAPH) {
      var p = hijo.asParagraph();
      var nivel = NIVELES[p.getHeading()];
      if (nivel) {
        var titulo = limpiar_(p.getText());
        if (!titulo) continue;
        cerrar_();
        ruta = ruta.slice(0, nivel - 1);
        ruta.push(titulo);
        actual = { ruta: ruta.slice(), titulo: titulo, nivel: nivel, texto: [] };
        continue;
      }
      if (actual) actual.texto.push(limpiar_(p.getText()));
      continue;
    }

    if (tipo === DocumentApp.ElementType.LIST_ITEM && actual) {
      actual.texto.push('- ' + limpiar_(hijo.asListItem().getText()));
      continue;
    }

    if (tipo === DocumentApp.ElementType.TABLE && actual) {
      var tabla = hijo.asTable();
      for (var f = 0; f < tabla.getNumRows(); f++) {
        var fila = tabla.getRow(f);
        var celdas = [];
        for (var c = 0; c < fila.getNumCells(); c++) {
          celdas.push(limpiar_(fila.getCell(c).getText()));
        }
        actual.texto.push(celdas.join(' | '));
      }
    }
  }
  cerrar_();

  var url = DocumentApp.getActiveDocument().getUrl();
  return secciones.map(function (s, i) {
    return {
      ruta: s.ruta,
      titulo: s.titulo,
      nivel: s.nivel,
      orden: i,
      texto: s.texto,
      anchor: url,
    };
  });
}

function limpiar_(texto) {
  return (texto || '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function enviar_(secciones) {
  var props = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var secreto = props.getProperty('ADDON_SECRET');
  if (!appUrl || !secreto) {
    throw new Error('Faltan APP_URL o ADDON_SECRET en las propiedades del script.');
  }

  var res = UrlFetchApp.fetch(appUrl.replace(/\/$/, '') + '/api/addon/manual', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-addon-key': secreto },
    payload: JSON.stringify({ secciones: secciones, origen: 'apps-script' }),
    muteHttpExceptions: true,
  });

  var cuerpo = res.getContentText();
  if (res.getResponseCode() !== 200) {
    throw new Error('app-hr respondió ' + res.getResponseCode() + ': ' + cuerpo);
  }
  return JSON.parse(cuerpo);
}
