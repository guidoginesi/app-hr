'use client';

import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			const supabase = getSupabaseBrowser();
			const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
			if (signInError) {
				setError(signInError.message);
				setLoading(false);
				return;
			}
			if (data?.user) {
				// Esperar un momento para que las cookies se establezcan
				await new Promise(resolve => setTimeout(resolve, 200));
				// Usar window.location para forzar recarga completa y leer cookies
				window.location.href = '/admin';
			} else {
				setError('No se pudo iniciar sesión');
				setLoading(false);
			}
		} catch (err: any) {
			setError(err?.message ?? 'Error al iniciar sesión');
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
			<form
				onSubmit={onSubmit}
				className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm"
			>
				<h1 className="mb-4 text-xl font-semibold">Ingreso administradores</h1>
				<div className="space-y-3">
					<input
						type="email"
						className="w-full rounded-md border px-3 py-2 text-sm"
						placeholder="Email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
					<input
						type="password"
						className="w-full rounded-md border px-3 py-2 text-sm"
						placeholder="Contraseña"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
					>
						{loading ? 'Ingresando…' : 'Ingresar'}
					</button>
					{error && <p className="text-sm text-red-600">{error}</p>}
				</div>
				<p className="mt-4 text-xs text-zinc-600">
					Los usuarios deben estar agregados a la tabla de administradores.
				</p>
			</form>
		</div>
	);
}


