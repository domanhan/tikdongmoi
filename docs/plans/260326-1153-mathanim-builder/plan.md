# Plan: MathAnim Builder
Created: 26-03-2026 11:53
Status: 🟡 In Progress

## Overview
Dự án "MathAnim Builder" - Web App cho phép giáo viên Toán nhập code TikZ và xuất ra file HTML hoạt cảnh tương tác.
Sử dụng mô hình "Data Baking" với 2 thế giới:
1. **Math World** (Vô hình, Backend xử lý): Tính toán tọa độ, khung xương.
2. **Visual World** (Hữu hình, Frontend xử lý): Hiển thị hình ảnh, da thịt.

## Tech Stack
- Frontend: HTML/JS/TailwindCSS
- Backend: Python (FastAPI + Regex Parser + Math Engine)

## Phases

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 01 | Project Setup & UI Shell | ✅ Complete | 100% |
| 02 | TikZ Parser - AST Generator | ✅ Complete | 100% |
| 03 | Math Engine - The Baker (Backend Python) | ✅ Complete | 100% |
| 04 | Frontend Renderer - SVG Canvas | ✅ Complete | 100% |
| 05 | Timeline & Effect System - UI | 🟡 In Progress | 90% |
| 06 | HTML Exporter | 🟡 In Progress | 0% |

## Quick Commands
- Continue Phase 3: `/code phase-03`
- Check progress: `/next`
- Save context: `/save-brain`
