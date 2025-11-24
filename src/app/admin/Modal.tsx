'use client';

import { ReactNode, useEffect } from 'react';

type ModalProps = {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: ReactNode;
	maxWidth?: string;
};

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-6xl' }: ModalProps) {
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = 'unset';
		}
		return () => {
			document.body.style.overflow = 'unset';
		};
	}, [isOpen]);

	// Cerrar modal con tecla ESC
	useEffect(() => {
		if (!isOpen) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, [isOpen, onClose]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			onClick={onClose}
		>
			<div
				className={`w-full ${maxWidth} rounded-xl border border-zinc-200 bg-white shadow-xl`}
				onClick={(e) => e.stopPropagation()}
			>
				{title && (
					<div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
						<h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
						>
							<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				)}
				{!title && (
					<div className="flex items-center justify-end border-b border-zinc-200 px-6 py-4">
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
						>
							<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				)}
				<div className="max-h-[calc(100vh-200px)] overflow-y-auto p-6">{children}</div>
			</div>
		</div>
	);
}

