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
- Tombol "Link test case" di panel Trace chain menautkan Test Case ke requirement dengan link `Verifies` sehingga celah G2 tertutup. App memeriksa dulu izin Browse dan Link work items milik user di proyek tersebut, lalu me-refresh tampilan issue Jira.
- `generate_evidence_pack` (Rovo dan MCP) serta tombol "Publish evidence pack" di halaman proyek kini membuat halaman Confluence sungguhan: ringkasan coverage, daftar celah, dan matriks traceability dengan tautan ke issue Jira. Setiap run membuat halaman baru (snapshot). Space dipilih dari input `space`, setting, space dengan key yang sama dengan proyek Jira, atau space global pertama.
- "Load demo data" juga membuat space Confluence `CSM` untuk evidence pack bila Confluence terpasang.
- App kedua "TraceGuard for Bitbucket" (`bitbucket-app/`): merge check "TraceGuard trace check" menolak pull request yang mengubah kode safety-critical tanpa issue Jira yang tertaut ke requirement terdampak. Pesannya menyebut requirement, hazard, contoh issue, dan test yang harus diulang. Glob safety-critical bisa ditimpa per repo lewat `.traceguard.yml`.
- Halaman Workspace settings → TraceGuard di Bitbucket (khusus admin workspace) untuk menempelkan URL dan secret koneksi; koneksi diuji dengan request bertanda tangan sebelum disimpan.
- Panel "Connect Bitbucket" di TraceGuard setup (khusus admin Jira) membuat atau merotasi secret koneksi dan menampilkan URL web trigger. Secret hanya tampil sekali.
- Web trigger `trace-lookup` di app Jira menjawab merge check Bitbucket (HMAC-SHA256, toleransi 5 menit). Pull request yang lolos dan di-merge dicatat sebagai riwayat trace asli.
- `assign_gap` kini membuat Task Jira sungguhan untuk satu celah: label `traceguard-gap`, fix version rilisnya, di-assign ke pemilik celah (atau nama yang diminta), dan ditautkan `Relates` ke issue requirement. App memeriksa dulu izin Create, Assign, dan Link work items milik user. Permintaan ulang untuk celah yang tasknya masih terbuka mengembalikan task yang sama. Dengan data sampel bawaan, action ini tetap hanya pratinjau. Prompt Audit Prep Agent kini selalu mengisi assignee (Rovo menolak permintaan tanpa input itu dengan "The request was invalid.").
- Tombol "Load demo data" di TraceGuard setup (khusus admin Jira) membuat proyek CardioSense `CSM` sebagai issue Jira asli, lengkap dengan satu contoh celah G1–G6. Riwayat pull request disimpan sebagai data simulasi.

### Changed
- Scope baru `read:jira-user` untuk mencari assignee `assign_gap`. Admin site harus menyetujui upgrade versi mayor.
- App Jira kini memakai web trigger dinamis, sehingga tidak lagi memenuhi syarat Runs on Atlassian. Admin site harus menyetujui upgrade versi mayor.
- Scope baru `read:space:confluence`, `write:page:confluence`, dan `write:confluence-space`. Admin site harus menyetujui upgrade versi mayor.
- Input `release` pada `generate_evidence_pack` kini opsional (default: rilis berikutnya yang belum dirilis).
- Audit Prep Agent hanya menampilkan tautan yang dikembalikan action TraceGuard; issue, PR, dan halaman lain ditulis sebagai key tanpa tautan karangan.
- App sekarang meminta scope `manage:jira-project`, `manage:jira-configuration`, dan `storage:app`. Admin site harus menyetujui upgrade versi mayor.
- Panel "Trace chain" bisa dibuka dari issue requirement itu sendiri (dicari lewat issue key maupun ID REQ).

### Removed
- Scope Teamwork Graph (`read:graph:issue:jira`, `read:graph:project:jira`, `read:graph:page:confluence`, `read:graph:user:atlassian`) dan database Forge SQL yang tidak pernah dipakai. Instalasi tidak lagi butuh persetujuan scope Graph; admin site harus menyetujui upgrade versi mayor.

### Security
- Data Jira live (halaman proyek, panel Trace chain, macro Confluence, halaman setup, agen Rovo, dan tool MCP) hanya ditampilkan bila user pemanggil punya izin Browse projects di proyek tersebut. Identitas user hanya diambil dari context Forge, tidak pernah dari input action. Sampel bawaan tetap terbuka.
- Evidence pack hanya dipublikasikan ke space Confluence yang bisa dilihat user pemanggil (scope baru `read:confluence-content.permission`).

### Fixed
- Pull request yang dilaporkan app Bitbucket tidak lagi menyimpan nama author. App Bitbucket berhenti mengirimkannya, dan app Jira mengabaikan field itu dari versi lama. Dengan begitu, app tidak menyimpan data pribadi.
- Halaman pengaturan TraceGuard for Bitbucket menolak semua admin workspace karena Bitbucket menghapus endpoint `GET /2.0/user/permissions/workspaces`; cek admin kini memakai `GET /2.0/user/workspaces/{workspace}/permission`.
