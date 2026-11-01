# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti Keep a Changelog, versi mengikuti SemVer.

## [Unreleased]

### Added
- Deteksi celah traceability G1–G6 per rilis, beserta skor coverage requirement.
- Analisis dampak perubahan file: requirement, hazard, safety class, dan test yang harus diulang.
- Enam action Rovo (`list_gaps`, `get_trace`, `check_change_impact`, `find_requirements_for_path`, `generate_evidence_pack`, `assign_gap`); lima di antaranya juga tersedia sebagai tool MCP lewat `rovo:mcp`.
- Agen Rovo "Audit Prep Agent" dengan data demo CardioSense (rilis 2.3, satu contoh untuk tiap celah).
- `generate_evidence_pack` dan `assign_gap` masih berupa pratinjau: belum membuat halaman Confluence atau issue Jira.
