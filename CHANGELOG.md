# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti Keep a Changelog, versi mengikuti SemVer.

## [Unreleased]

### Added
- Deteksi celah traceability G1–G6 per rilis, beserta skor coverage requirement.
- Analisis dampak perubahan file: requirement, hazard, safety class, dan test yang harus diulang.
- Enam action Rovo (`list_gaps`, `get_trace`, `check_change_impact`, `find_requirements_for_path`, `generate_evidence_pack`, `assign_gap`); lima di antaranya juga tersedia sebagai tool MCP lewat `rovo:mcp`.
- Agen Rovo "Audit Prep Agent" dengan data demo CardioSense (rilis 2.3, satu contoh untuk tiap celah).
- `generate_evidence_pack` dan `assign_gap` masih berupa pratinjau: belum membuat halaman Confluence atau issue Jira.
- Halaman proyek Jira "TraceGuard": skor coverage, matriks traceability dengan rantai hazard → work → change → test per requirement, daftar celah yang bisa difilter per severity, dan pemeriksa dampak perubahan file.
- Panel isu Jira "Trace chain": rantai lengkap requirement untuk isu yang dibuka, serta pencarian key lain (REQ, issue, test).
- Halaman admin "TraceGuard setup": ringkasan sumber data, path safety-critical, peta requirement → kode, dan langkah menyambungkan agen coding lewat MCP (URL server bisa disalin).
- Macro Confluence "Traceability matrix" kini menampilkan coverage dan matriks rilis, bukan lagi teks placeholder.
- Data dibaca langsung dari proyek Jira `CSM`: issue type Requirement, Hazard, dan Test Case, link Implements/Verifies/Mitigates, fix version sebagai rilis, serta issue property `traceguard` (safety class, approval, path kode, hasil test terakhir). Selama proyek itu belum ada, semua tampilan dan tool tetap memakai sampel bawaan.
- Tombol "Load demo data" di TraceGuard setup (khusus admin Jira) membuat proyek CardioSense `CSM` sebagai issue Jira asli, lengkap dengan satu contoh celah G1–G6. Riwayat pull request disimpan sebagai data simulasi.

### Changed
- App sekarang meminta scope `manage:jira-project`, `manage:jira-configuration`, dan `storage:app`. Admin site harus menyetujui upgrade versi mayor.
- Panel "Trace chain" bisa dibuka dari issue requirement itu sendiri (dicari lewat issue key maupun ID REQ).
