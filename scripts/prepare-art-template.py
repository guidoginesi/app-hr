#!/usr/bin/env python3
"""Genera el template sin encriptar a partir del PDF original de Berkley."""
from pypdf import PdfReader, PdfWriter
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'assets/templates/berkley-teletrabajo-source.pdf'
dst = ROOT / 'assets/templates/berkley-teletrabajo.pdf'

if not src.exists():
    print(f'Fuente no encontrada: {src}')
    sys.exit(1)

reader = PdfReader(str(src))
writer = PdfWriter()
writer.clone_document_from_reader(reader)
with open(dst, 'wb') as f:
    writer.write(f)

print(f'OK → {dst} (encrypted={reader.is_encrypted})')
