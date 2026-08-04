import { z } from 'zod';

/**
 * Validador de identificadores que vienen de columnas `uuid` de Postgres.
 *
 * NO usar `z.uuid()` ni `z.string().uuid()` para esto. Desde zod 4, `uuid()`
 * valida la *semántica* del RFC 9562: exige que el nibble de versión sea 1-8 y
 * que los bits de variante sean 8/9/a/b. Postgres es mucho más permisivo: acepta
 * cualquier hexadecimal 8-4-4-4-12, y de hecho en esta base hay ids sembrados a
 * mano —del estilo `20000000-0000-0000-0000-000000000006`— que son válidos para
 * Postgres pero que `uuid()` rechaza.
 *
 * El resultado de mezclar las dos cosas es un 400 "Identificador inválido" en
 * filas que existen perfectamente: al momento de escribir esto, 36 de 42
 * empleados tenían ids que zod rechazaba, y eso rompía el budget de
 * capacitaciones, los habilitados de reintegros, la audiencia "Equipo de X" de
 * Mensajes y la asignación de líder.
 *
 * `z.guid()` es la versión laxa: mismo formato, sin exigir la semántica del RFC.
 * Sigue rechazando strings vacíos, texto libre y formatos mal armados.
 */
export const dbId = (message = 'Identificador inválido.') => z.guid(message);
