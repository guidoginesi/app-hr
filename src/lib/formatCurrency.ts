/**
 * Formatea un número o string a formato de moneda argentina
 * Ejemplo: 1500000 -> $1.500.000
 */
export function formatCurrency(value: string | number | null | undefined): string {
	if (!value) return '';
	
	// Convertir a número si es string
	const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d]/g, '')) : value;
	
	if (isNaN(numValue)) return String(value);
	
	// Formatear con separadores de miles
	return new Intl.NumberFormat('es-AR', {
		style: 'currency',
		currency: 'ARS',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(numValue);
}

