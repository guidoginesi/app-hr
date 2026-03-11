// ================================================================
// POW - Add-on de Reserva de Salas para Google Calendar
// ================================================================
// Configuración en Script Properties (Archivo > Propiedades del proyecto):
//   APP_URL     → URL de tu app (ej: https://app-hr.pow-apps.com)
//   ADDON_SECRET → El mismo valor que ADDON_SECRET en tu .env de Next.js
// ================================================================

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    appUrl: props.getProperty('APP_URL') || '',
    addonSecret: props.getProperty('ADDON_SECRET') || ''
  };
}

// ================================================================
// Entry points declarados en appsscript.json
// ================================================================

function onCalendarHomepage(e) {
  return buildSearchCard_({});
}

function onCalendarEventOpen(e) {
  var startMs = e.calendar && e.calendar.startTime ? e.calendar.startTime : null;
  var endMs   = e.calendar && e.calendar.endTime   ? e.calendar.endTime   : null;
  return buildSearchCard_({ startMs: startMs, endMs: endMs });
}

// ================================================================
// Card 1: Selección de fecha y horario
// ================================================================

function buildSearchCard_(params) {
  var now        = new Date();
  var nextHour   = new Date(now);
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  var nextTwoHrs = new Date(nextHour.getTime() + 3600 * 1000);

  var startMs = params.startMs || nextHour.getTime();
  var endMs   = params.endMs   || nextTwoHrs.getTime();

  var startPicker = CardService.newDateTimePicker()
    .setTitle('Desde')
    .setFieldName('start_at')
    .setValueInMsSinceEpoch(startMs);

  var endPicker = CardService.newDateTimePicker()
    .setTitle('Hasta')
    .setFieldName('end_at')
    .setValueInMsSinceEpoch(endMs);

  var searchBtn = CardService.newTextButton()
    .setText('Ver salas disponibles')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(CardService.newAction().setFunctionName('onSearchRooms'));

  var myBookingsBtn = CardService.newTextButton()
    .setText('Mis reservas')
    .setOnClickAction(CardService.newAction().setFunctionName('onShowMyBookings'));

  return CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Reservar sala')
        .setSubtitle('Sistema de salas POW')
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Seleccioná el horario')
        .addWidget(startPicker)
        .addWidget(endPicker)
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newButtonSet().addButton(searchBtn))
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newButtonSet().addButton(myBookingsBtn))
    )
    .build();
}

// ================================================================
// Action: Buscar disponibilidad y mostrar salas
// ================================================================

function onSearchRooms(e) {
  var inputs = e.commonEventObject.formInputs || {};

  var startMs = inputs['start_at'] && inputs['start_at']['dateTimeInput']
    ? Number(inputs['start_at']['dateTimeInput']['msSinceEpoch'])
    : null;
  var endMs = inputs['end_at'] && inputs['end_at']['dateTimeInput']
    ? Number(inputs['end_at']['dateTimeInput']['msSinceEpoch'])
    : null;

  if (!startMs || !endMs) {
    return showNotification_('Seleccioná fecha y hora de inicio y fin.');
  }

  var startDate = new Date(startMs);
  var endDate   = new Date(endMs);

  if (endDate <= startDate) {
    return showNotification_('El horario de fin debe ser posterior al inicio.');
  }
  if (endDate <= new Date()) {
    return showNotification_('El horario debe ser en el futuro.');
  }

  var cfg   = getConfig_();
  var email = Session.getActiveUser().getEmail();

  // Fecha en Argentina (UTC-3) para armar el parámetro date=YYYY-MM-DD
  var arDate = new Date(startDate.getTime() - 3 * 3600 * 1000);
  var dateStr = Utilities.formatDate(arDate, 'UTC', 'yyyy-MM-dd');

  // Traer todas las salas
  var rooms = [];
  try {
    var resp = UrlFetchApp.fetch(cfg.appUrl + '/api/addon/room-booking/rooms', {
      headers: { 'x-addon-key': cfg.addonSecret, 'x-user-email': email },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) {
      return showNotification_('No se pudieron obtener las salas. Verificá tu conexión.');
    }
    rooms = JSON.parse(resp.getContentText()).rooms || [];
  } catch (err) {
    return showNotification_('Error al obtener salas: ' + err.message);
  }

  // Traer reservas del día para detectar conflictos localmente
  var bookings = [];
  try {
    var bResp = UrlFetchApp.fetch(
      cfg.appUrl + '/api/addon/room-booking/bookings?date=' + dateStr + '&to=' + dateStr,
      {
        headers: { 'x-addon-key': cfg.addonSecret, 'x-user-email': email },
        muteHttpExceptions: true
      }
    );
    if (bResp.getResponseCode() === 200) {
      bookings = JSON.parse(bResp.getContentText()).bookings || [];
    }
  } catch (err) { /* No-op: mostraremos todas las salas sin filtrar */ }

  // Detectar qué salas tienen overlap con el horario pedido
  var occupiedIds = {};
  for (var i = 0; i < bookings.length; i++) {
    var b = bookings[i];
    var bStart = new Date(b.start_at).getTime();
    var bEnd   = new Date(b.end_at).getTime();
    if (startMs < bEnd && endMs > bStart) {
      occupiedIds[b.room_id] = true;
    }
  }

  var available = rooms.filter(function(r) { return !occupiedIds[r.id]; });
  var occupied  = rooms.filter(function(r) { return !!occupiedIds[r.id]; });

  var card = buildRoomSelectionCard_(startDate, endDate, available, occupied);
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

// ================================================================
// Card 2: Selección de sala + formulario de reserva
// ================================================================

function buildRoomSelectionCard_(startDate, endDate, available, occupied) {
  var tz      = 'America/Argentina/Buenos_Aires';
  var timeStr = Utilities.formatDate(startDate, tz, 'HH:mm') + ' – ' + Utilities.formatDate(endDate, tz, 'HH:mm');
  var dateStr = Utilities.formatDate(startDate, tz, "EEEE d 'de' MMMM");

  var headerSection = CardService.newCardSection()
    .addWidget(
      CardService.newDecoratedText()
        .setText('📅 ' + dateStr)
        .setBottomLabel(timeStr)
    );

  // Sección de salas disponibles
  var roomSection = CardService.newCardSection().setHeader('Salas disponibles');

  if (available.length === 0) {
    roomSection.addWidget(
      CardService.newTextParagraph().setText('⚠️ No hay salas disponibles para este horario.')
    );
  } else {
    var selector = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.RADIO_BUTTON)
      .setFieldName('room_id')
      .setTitle('Seleccioná una sala');

    for (var i = 0; i < available.length; i++) {
      var r = available[i];
      var label = r.name
        + (r.location  ? ' — ' + r.location         : '')
        + (r.capacity  ? ' (cap. ' + r.capacity + ')' : '');
      selector.addItem(label, r.id, i === 0);
    }
    roomSection.addWidget(selector);
  }

  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Elegir sala'))
    .addSection(headerSection)
    .addSection(roomSection);

  // Salas ocupadas (informativo)
  if (occupied.length > 0) {
    var occupiedSection = CardService.newCardSection().setHeader('No disponibles en este horario');
    for (var j = 0; j < occupied.length; j++) {
      occupiedSection.addWidget(
        CardService.newDecoratedText()
          .setText('🔴 ' + occupied[j].name)
          .setBottomLabel(occupied[j].location || '')
      );
    }
    card.addSection(occupiedSection);
  }

  // Formulario
  var formSection = CardService.newCardSection()
    .setHeader('Datos de la reunión')
    .addWidget(
      CardService.newTextInput()
        .setFieldName('title')
        .setTitle('Título de la reunión')
        .setHint('Ej: Reunión de equipo, Demo cliente')
    )
    .addWidget(
      CardService.newTextInput()
        .setFieldName('notes')
        .setTitle('Notas (opcional)')
        .setMultiline(true)
    );

  var bookAction = CardService.newAction()
    .setFunctionName('onCreateBooking')
    .setParameters({
      start_at: startDate.toISOString(),
      end_at:   endDate.toISOString()
    });

  var bookBtn = CardService.newTextButton()
    .setText('Confirmar reserva')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(bookAction);

  if (available.length === 0) bookBtn.setDisabled(true);

  card
    .addSection(formSection)
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newButtonSet().addButton(bookBtn)
      )
    );

  return card.build();
}

// ================================================================
// Action: Crear reserva
// ================================================================

function onCreateBooking(e) {
  var params = e.commonEventObject.parameters || {};
  var inputs = e.commonEventObject.formInputs  || {};

  var startAt = params['start_at'];
  var endAt   = params['end_at'];
  var roomId  = inputs['room_id'] && inputs['room_id']['stringInputs']
    ? inputs['room_id']['stringInputs']['value'][0] : null;
  var title  = inputs['title'] && inputs['title']['stringInputs']
    ? inputs['title']['stringInputs']['value'][0] : null;
  var notes  = inputs['notes'] && inputs['notes']['stringInputs']
    ? inputs['notes']['stringInputs']['value'][0] : null;

  if (!roomId) {
    return showNotification_('Seleccioná una sala.');
  }
  if (!title || title.trim() === '') {
    return showNotification_('Ingresá el título de la reunión.');
  }

  var cfg   = getConfig_();
  var email = Session.getActiveUser().getEmail();

  var payload = JSON.stringify({
    room_id:  roomId,
    title:    title.trim(),
    start_at: startAt,
    end_at:   endAt,
    notes:    notes || null
  });

  try {
    var resp = UrlFetchApp.fetch(cfg.appUrl + '/api/addon/room-booking/bookings', {
      method:      'post',
      contentType: 'application/json',
      headers:     { 'x-addon-key': cfg.addonSecret, 'x-user-email': email },
      payload:     payload,
      muteHttpExceptions: true
    });

    var code = resp.getResponseCode();
    var body = JSON.parse(resp.getContentText());

    if (code !== 201) {
      return showNotification_(body.error || 'No se pudo crear la reserva.');
    }

    var successCard = buildSuccessCard_(title.trim(), startAt, endAt);
    return CardService.newActionResponseBuilder()
      .setNavigation(
        CardService.newNavigation().popToRoot().pushCard(successCard)
      )
      .build();

  } catch (err) {
    return showNotification_('Error al crear la reserva: ' + err.message);
  }
}

// ================================================================
// Card 3: Confirmación exitosa
// ================================================================

function buildSuccessCard_(title, startAt, endAt) {
  var tz    = 'America/Argentina/Buenos_Aires';
  var start = new Date(startAt);
  var end   = new Date(endAt);

  var section = CardService.newCardSection()
    .addWidget(
      CardService.newDecoratedText()
        .setText('✅ Reserva creada exitosamente')
        .setWrapText(true)
    )
    .addWidget(
      CardService.newDecoratedText()
        .setText(title)
        .setBottomLabel(
          Utilities.formatDate(start, tz, "EEEE d/MM") + ' · ' +
          Utilities.formatDate(start, tz, 'HH:mm') + ' – ' +
          Utilities.formatDate(end,   tz, 'HH:mm')
        )
    );

  var newBtn = CardService.newTextButton()
    .setText('Nueva reserva')
    .setOnClickAction(CardService.newAction().setFunctionName('onBackToHome'));

  var myBookingsBtn = CardService.newTextButton()
    .setText('Mis reservas')
    .setOnClickAction(CardService.newAction().setFunctionName('onShowMyBookings'));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('¡Reserva confirmada!'))
    .addSection(section)
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newButtonSet().addButton(newBtn).addButton(myBookingsBtn)
      )
    )
    .build();
}

// ================================================================
// Card: Mis reservas
// ================================================================

function onShowMyBookings(e) {
  var card = buildMyBookingsCard_();
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

function buildMyBookingsCard_() {
  var cfg   = getConfig_();
  var email = Session.getActiveUser().getEmail();

  var bookings = [];
  try {
    var resp = UrlFetchApp.fetch(
      cfg.appUrl + '/api/addon/room-booking/bookings?mine=true',
      {
        headers: { 'x-addon-key': cfg.addonSecret, 'x-user-email': email },
        muteHttpExceptions: true
      }
    );
    if (resp.getResponseCode() === 200) {
      bookings = JSON.parse(resp.getContentText()).bookings || [];
    }
  } catch (err) { /* mostrar vacío */ }

  var now      = new Date();
  var upcoming = bookings.filter(function(b) {
    return new Date(b.start_at) > now && b.status === 'confirmed';
  });

  var tz   = 'America/Argentina/Buenos_Aires';
  var card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Mis próximas reservas'));

  if (upcoming.length === 0) {
    card.addSection(
      CardService.newCardSection().addWidget(
        CardService.newTextParagraph().setText('No tenés reservas futuras.')
      )
    );
  } else {
    var section = CardService.newCardSection()
      .setHeader(upcoming.length + (upcoming.length === 1 ? ' reserva' : ' reservas'));

    for (var i = 0; i < upcoming.length; i++) {
      var b     = upcoming[i];
      var start = new Date(b.start_at);
      var end   = new Date(b.end_at);
      var label = (b.room_name || 'Sala') + ' · ' +
        Utilities.formatDate(start, tz, 'd/MM') + ' · ' +
        Utilities.formatDate(start, tz, 'HH:mm') + '–' +
        Utilities.formatDate(end,   tz, 'HH:mm');

      var cancelAction = CardService.newAction()
        .setFunctionName('onCancelBooking')
        .setParameters({ booking_id: b.id, title: b.title });

      var cancelBtn = CardService.newTextButton()
        .setText('Cancelar')
        .setOnClickAction(cancelAction);

      section.addWidget(
        CardService.newDecoratedText()
          .setText(b.title)
          .setBottomLabel(label)
          .setButton(cancelBtn)
      );
    }

    card.addSection(section);
  }

  var backBtn = CardService.newTextButton()
    .setText('← Volver')
    .setOnClickAction(CardService.newAction().setFunctionName('onBackToHome'));

  card.addSection(
    CardService.newCardSection().addWidget(
      CardService.newButtonSet().addButton(backBtn)
    )
  );

  return card.build();
}

// ================================================================
// Action: Cancelar reserva
// ================================================================

function onCancelBooking(e) {
  var params    = e.commonEventObject.parameters || {};
  var bookingId = params['booking_id'];
  var title     = params['title'] || 'la reserva';

  var cfg   = getConfig_();
  var email = Session.getActiveUser().getEmail();

  try {
    var resp = UrlFetchApp.fetch(
      cfg.appUrl + '/api/addon/room-booking/bookings/' + bookingId,
      {
        method:  'delete',
        headers: { 'x-addon-key': cfg.addonSecret, 'x-user-email': email },
        muteHttpExceptions: true
      }
    );

    var code = resp.getResponseCode();
    if (code !== 200) {
      var body = JSON.parse(resp.getContentText());
      return showNotification_(body.error || 'No se pudo cancelar la reserva.');
    }

    // Refrescar la lista
    var updatedCard = buildMyBookingsCard_();
    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().updateCard(updatedCard))
      .setNotification(
        CardService.newNotification().setText('Reserva "' + title + '" cancelada.')
      )
      .build();

  } catch (err) {
    return showNotification_('Error al cancelar: ' + err.message);
  }
}

// ================================================================
// Helpers de navegación
// ================================================================

function onBackToHome(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popToRoot())
    .build();
}

function showNotification_(text) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(text))
    .build();
}
