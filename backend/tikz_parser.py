"""
tikz_parser.py - Trái tim của Backend MathAnim Builder

Mô hình "Data Baking" với AST chi tiết:
  - math_ast: Bộ xương tọa độ (coordinate, path calc, intersections, def)
  - visual_objects: Da thịt hình ảnh (draw, fill, node)

Mỗi lệnh được bóc tách thành cấu trúc key-value riêng biệt,
KHÔNG còn dump thô vào key "content" nữa.
"""

import re
from typing import Any, Dict, List, Optional, Tuple


# =============================================================================
# TỪ ĐIỂN REGEX CHI TIẾT (Pattern Registry)
# =============================================================================

# --- Thế giới Vô hình (Math World) ---
MATH_PATTERNS: List[Tuple[str, re.Pattern, str]] = [
    (
        "def_time",
        re.compile(r"\\def\\([a-zA-Z0-9_]+)\{([^}]+)\}"),
        "Bien thoi gian / hang so",
    ),
    (
        "point_absolute",
        re.compile(r"\\coordinate\s*\(([^)]+)\)\s*at\s*\(([^,]+),\s*([^)]+)\)\s*;"),
        "Diem tuyet doi",
    ),
    (
        "point_polar",
        re.compile(
            r"\\path\s*\(\$\(([^)]+)\)\s*\+\s*\(([^:]+):([^)]+)\)\$\)\s*coordinate\s*\(([^)]+)\)\s*;"
        ),
        "Toa do cuc (calc)",
    ),
    (
        # $(A)!k!angle:(C)$ - Nội suy xoay: từ A đi k lần đoạn AC, xoay angle độ
        "point_rotate_interpolate",
        re.compile(
            r"\\path\s*\(\$\(([^)]+)\)!([^!(]+)!(-?\d+\.?\d*):?\(([^)]+)\)\$\)\s*coordinate\s*\(([^)]+)\)\s*;"
        ),
        "Nội suy xoay quanh điểm",
    ),
    (
        # $(A)!(B)!(C)$ - Hinh chieu vuong goc cua B len AC
        "point_project_calc",
        re.compile(
            r"\\path\s*\(\$\(([^)]+)\)!\(([^)]+)\)!\(([^)]+)\)\$\)\s*coordinate\s*\(([^)]+)\)\s*;"
        ),
        "Hinh chieu B len AC (calc !B!)",
    ),
    (
        # $(A)!k!(C)$ - Noi suy / chia doan
        "point_interpolate",
        re.compile(
            r"\\path\s*\(\$\(([^)]+)\)!([^!(]+)!\(([^)]+)\)\$\)\s*coordinate\s*\(([^)]+)\)\s*;"
        ),
        "Noi suy A-k-C",
    ),
    (
        # (intersection of A--B and C--D)
        "point_line_intersect",
        re.compile(
            r"\\path\s*\(intersection of\s+([A-Za-z0-9_]+)--([A-Za-z0-9_]+)"
            r"\s+and\s+([A-Za-z0-9_]+)--([A-Za-z0-9_]+)\)\s*coordinate\s*\(([^)]+)\)\s*;"
        ),
        "Giao diem 2 duong thang",
    ),
    (
        # $(expr vector)$ - Phep tinh vector tong quat (B)-(A)+(D)
        "point_calc",
        re.compile(r"\\path\s*\(\$(.+?)\$\)\s*coordinate\s*\(([^)]+)\)\s*;"),
        "Bieu thuc vector tong quat",
    ),
    (
        "intersection",
        re.compile(
            r"\\path\s*\[name intersections=\{of=([^ ]+)\s+and\s+([^,]+),\s*by=\{([^}]+)\}\}\]\s*;"
        ),
        "Giao diem 2 duong (name intersections)",
    ),
    (
        "named_path",
        re.compile(r"\\path\s*\[name path\s*=\s*([^\]]+)\]\s*(.*?)\s*;"),
        "Duong dat ten",
    ),
]

# --- Thế giới Hữu hình (Visual World) ---
VISUAL_PATTERNS: List[Tuple[str, re.Pattern, str]] = [
    (
        "draw_circle",
        re.compile(r"\\draw\s*(?:\[(.*?)\])?\s*\(([^)]+)\)\s*circle\s*\(([^)]+)\)\s*;"),
        "Ve duong tron",
    ),
    (
        # draw_right_angle phai truoc draw_angle de tranh bi bat nham
        "draw_right_angle",
        re.compile(
            r"\\draw\s*pic\s*(?:\[(.*?)\])?\s*\{right angle\s*=\s*"
            r"([A-Za-z0-9_]+)--([A-Za-z0-9_]+)--([A-Za-z0-9_]+)\}\s*;"
        ),
        "Danh dau goc vuong",
    ),
    (
        "draw_angle",
        re.compile(
            r"\\draw\s*pic\s*(?:\[(.*?)\])?\s*\{angle\s*=\s*"
            r"([A-Za-z0-9_]+)--([A-Za-z0-9_]+)--([A-Za-z0-9_]+)\}\s*;"
        ),
        "Danh dau goc",
    ),
    (
        # draw_line_label truoc draw_line (specific hon)
        "draw_line_label",
        re.compile(
            r"\\draw\s*(?:\[(.*?)\])?\s*\(([^)]+)\)\s*--\s*\(([^)]+)\)"
            r"\s*node\s*(?:\[(.*?)\])?\s*\{([^}]+)\}\s*;"
        ),
        "Doan thang co nhan o giua",
    ),
    (
        "draw_lines",
        re.compile(r"\\draw\s*(?:\[(.*?)\])?\s*([^-;]+--[^;]+)\s*;"),
        "Ve duong (nhieu diem)",
    ),
    (
        "draw_bezier",
        re.compile(
            r"\\draw\s*(?:\[(.*?)\])?\s*\(([^)]+)\)\s*controls\s*(.*?)\s*\.\.\s*\(([^)]+)\)\s*;"
        ),
        "Duong cong Bezier (controls)",
    ),
    (
        "draw_arc",
        re.compile(r"\\draw\s*(?:\[(.*?)\])?\s*\(([^)]+)\)\s*arc\s*\(([^)]+)\)\s*;"),
        "Cung tron",
    ),
    (
        "fill_node",
        re.compile(
            r"\\fill\s*(?:\[(.*?)\])?\s*\(([^)]+)\)\s*circle\s*\([^)]+\)"
            r"\s*node\s*(?:\[(.*?)\])?\s*\{([^}]+)\}\s*;"
        ),
        "Cham diem + nhan",
    ),
    (
        "fill_shape",
        re.compile(r"\\fill\s*(?:\[(.*?)\])?\s*(.*?)\s*;"),
        "To mau",
    ),
    (
        "node_label",
        re.compile(r"\\node\s*(?:\[(.*?)\])?\s*at\s*\(([^)]+)\)\s*\{([^}]+)\}\s*;"),
        "Nhan chu (node at)",
    ),
]


# =============================================================================
# CÁC HÀM TRÍCH XUẤT RIÊNG CHO TỪNG LOẠI
# =============================================================================


def _extract_math(cmd_type: str, m: re.Match) -> Dict[str, Any]:
    """Chuyển match groups thành dict AST có cấu trúc rõ ràng."""
    g = m.groups()

    if cmd_type == "def_time":
        return {"type": cmd_type, "var": g[0].strip(), "value": g[1].strip()}

    if cmd_type == "point_absolute":
        return {
            "type": cmd_type,
            "id": g[0].strip(),
            "x": g[1].strip(),
            "y": g[2].strip(),
        }

    if cmd_type == "point_polar":
        return {
            "type": cmd_type,
            "center": g[0].strip(),
            "angle": g[1].strip(),
            "radius": g[2].strip(),
            "id": g[3].strip(),
        }

    if cmd_type == "point_project_calc":
        # $(A)!(B)!(C)$ → H = projection of B onto line AC
        # groups: (line_p1, point, line_p2, id)
        return {
            "type": "point_project",  # Dùng chung handler với point_project
            "line_p1": g[0].strip(),
            "point": g[1].strip(),
            "line_p2": g[2].strip(),
            "id": g[3].strip(),
        }

    if cmd_type == "point_interpolate":
        # $(A)!k!(C)$ → P = A + k*(C - A)
        return {
            "type": cmd_type,
            "p1": g[0].strip(),
            "k": g[1].strip(),
            "p2": g[2].strip(),
            "id": g[3].strip(),
        }

    if cmd_type == "point_rotate_interpolate":
        # $(A)!k!angle:(C)$ → từ A đi k lần đoạn AC, xoay angle độ quanh A
        return {
            "type": cmd_type,
            "p1": g[0].strip(),
            "k": g[1].strip(),
            "angle": g[2].strip(),
            "p2": g[3].strip(),
            "id": g[4].strip(),
        }

    if cmd_type == "point_line_intersect":
        # (intersection of A--B and C--D)
        return {
            "type": cmd_type,
            "l1p1": g[0].strip(),
            "l1p2": g[1].strip(),
            "l2p1": g[2].strip(),
            "l2p2": g[3].strip(),
            "id": g[4].strip(),
        }

    if cmd_type == "point_calc":
        # $(expr)$ — biểu thức vector tổng quát
        return {
            "type": cmd_type,
            "expr": g[0].strip(),
            "id": g[1].strip(),
        }

    if cmd_type == "intersection":
        raw_points = g[2].strip()
        points = [p.strip() for p in raw_points.split(",") if p.strip()]
        return {
            "type": cmd_type,
            "path1": g[0].strip(),
            "path2": g[1].strip(),
            "points": points,
        }

    if cmd_type == "named_path":
        return {
            "type": cmd_type,
            "name": g[0].strip(),
            "content": g[1].strip(),
        }

    return {"type": cmd_type, "raw_groups": g}


def _extract_visual(cmd_type: str, m: re.Match) -> Dict[str, Any]:
    """Chuyển match groups thành dict Visual Object có cấu trúc rõ ràng."""
    g = m.groups()

    if cmd_type == "draw_circle":
        return {
            "type": cmd_type,
            "options": (g[0] or "").strip(),
            "center": g[1].strip(),
            "radius": g[2].strip(),
        }

    if cmd_type == "draw_right_angle":
        # groups: options, p1, vertex, p2
        opts = (g[0] or "").strip()
        # Extract angle radius from options (e.g. "draw, angle radius=2mm")
        radius_match = re.search(r"angle\s*radius\s*=\s*([\d.]+)\s*(mm|pt|cm)?", opts)
        radius_mm = 2.0  # default
        if radius_match:
            val = float(radius_match.group(1))
            unit = radius_match.group(2) or "mm"
            if unit == "pt":
                radius_mm = val * 0.3528  # 1pt ≈ 0.3528mm
            elif unit == "cm":
                radius_mm = val * 10
            else:
                radius_mm = val
        return {
            "type": cmd_type,
            "options": opts,
            "p1": g[1].strip(),
            "vertex": g[2].strip(),
            "p2": g[3].strip(),
            "radius_mm": radius_mm,
        }

    if cmd_type == "draw_angle":
        # groups: options, p1, vertex, p2
        opts = (g[0] or "").strip()
        # Extract angle radius from options
        radius_match = re.search(r"angle\s*radius\s*=\s*([\d.]+)\s*(mm|pt|cm)?", opts)
        radius_mm = 2.0  # default
        if radius_match:
            val = float(radius_match.group(1))
            unit = radius_match.group(2) or "mm"
            if unit == "pt":
                radius_mm = val * 0.3528
            elif unit == "cm":
                radius_mm = val * 10
            else:
                radius_mm = val
        return {
            "type": cmd_type,
            "options": opts,
            "p1": g[1].strip(),
            "vertex": g[2].strip(),
            "p2": g[3].strip(),
            "radius_mm": radius_mm,
        }

    if cmd_type == "draw_line_label":
        # groups: options, p1, p2, node_options, label
        return {
            "type": cmd_type,
            "options": (g[0] or "").strip(),
            "p1": g[1].strip(),
            "p2": g[2].strip(),
            "node_options": (g[3] or "").strip(),
            "label": g[4].strip(),
        }

    if cmd_type == "draw_lines":
        options = (g[0] or "").strip()
        path_str = g[1].strip()
        # Parse points: split by '--'
        parts = [p.strip() for p in path_str.split("--")]
        points = []
        close_path = False
        for p in parts:
            if p == "cycle":
                close_path = True
            else:
                p = p.strip("()")
                points.append(p)

        return {
            "type": cmd_type,
            "options": options,
            "points": points,
            "close_path": close_path,
        }

    if cmd_type == "draw_line":
        return {
            "type": cmd_type,
            "options": (g[0] or "").strip(),
            "p1": g[1].strip(),
            "p2": g[2].strip(),
        }

    if cmd_type == "draw_bezier":
        # groups: options, p1, controls_expr, p2
        return {
            "type": cmd_type,
            "options": (g[0] or "").strip(),
            "p1": g[1].strip(),
            "controls_expr": g[2].strip(),
            "p2": g[3].strip(),
        }

    if cmd_type == "draw_arc":
        opts = (g[0] or "").strip()
        start = g[1].strip()
        arc_params = g[2].strip()

        # Parse startAngle:endAngle:radius
        arc_match = re.match(r"([^:]+):([^:]+):(.+)", arc_params)
        if arc_match:
            return {
                "type": cmd_type,
                "options": opts,
                "start": start,
                "start_angle": arc_match.group(1).strip(),
                "end_angle": arc_match.group(2).strip(),
                "radius": arc_match.group(3).strip(),
            }

        return {
            "type": cmd_type,
            "options": opts,
            "start": start,
            "arc_params": arc_params,
        }

    if cmd_type == "fill_node":
        return {
            "type": cmd_type,
            "fill_options": (g[0] or "").strip(),
            "point": g[1].strip(),
            "node_options": (g[2] or "").strip(),
            "label": g[3].strip(),
        }

    if cmd_type == "fill_shape":
        return {
            "type": cmd_type,
            "options": (g[0] or "").strip(),
            "content": g[1].strip(),
        }

    if cmd_type == "node_label":
        return {
            "type": cmd_type,
            "options": (g[0] or "").strip(),
            "at": g[1].strip(),
            "label": g[2].strip(),
        }

    return {"type": cmd_type, "raw_groups": g}


# =============================================================================
# HÀM PARSE CHÍNH
# =============================================================================


def parse_tikz(tikz_code: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Parser chính. Nhận TikZ code, trả về:
      {
        "math_ast":      [ {...}, ... ],   # Thế giới Vô hình
        "visual_objects": [ {...}, ... ],   # Thế giới Hữu hình
      }

    Raises RuntimeError nếu phát hiện cú pháp không hợp lệ ở lệnh cụ thể.
    """
    math_ast: List[Dict[str, Any]] = []
    visual_objects: List[Dict[str, Any]] = []

    # --- Bước 1: Gom các lệnh TikZ (tách theo dấu ';') ---
    commands: List[str] = _collect_commands(tikz_code)

    for cmd_idx, cmd in enumerate(commands):
        try:
            # Bỏ qua môi trường và comment
            if not cmd or cmd.startswith("%"):
                continue
            if re.match(r"\\(begin|end)\b", cmd):
                continue

            matched = False

            # --- Bước 2a: Thử các pattern Math World ---
            for cmd_type, pattern, _desc in MATH_PATTERNS:
                m = pattern.search(cmd)
                if m:
                    node = _extract_math(cmd_type, m)
                    node["_id"] = f"math_{len(math_ast)}"
                    node["_src"] = cmd
                    math_ast.append(node)
                    matched = True
                    break

            if matched:
                continue

            # --- Bước 2b: Thử các pattern Visual World ---
            for cmd_type, pattern, _desc in VISUAL_PATTERNS:
                m = pattern.search(cmd)
                if m:
                    node = _extract_visual(cmd_type, m)
                    node["_id"] = f"obj_{len(visual_objects)}"
                    node["_src"] = cmd
                    visual_objects.append(node)
                    matched = True
                    break

            # Nếu không khớp bất kỳ pattern nào, cảnh báo (không crash)
            if not matched:
                _warn_unrecognized(cmd_idx + 1, cmd)

        except Exception as exc:
            raise RuntimeError(
                f"Lỗi cú pháp tại Lệnh thứ {cmd_idx + 1}: {exc}\n"
                f"  >> Nội dung lệnh: {cmd[:120]}"
            ) from exc

    # Debug: log góc
    for vo in visual_objects:
        if "angle" in vo.get("type", ""):
            print(
                f"[DEBUG ANGLE] type={vo['type']} p1={vo.get('p1')} vertex={vo.get('vertex')} p2={vo.get('p2')} radius={vo.get('radius_mm')} opts={vo.get('options')}"
            )

    return {"math_ast": math_ast, "visual_objects": visual_objects}


# =============================================================================
# HÀM TIỆN ÍCH NỘI BỘ
# =============================================================================


def _collect_commands(tikz_code: str) -> List[str]:
    """
    Tách code thành danh sách lệnh đầy đủ.

    Quy tắc kết thúc lệnh:
      1. Dòng kết thúc bằng ';'  → lệnh kiểu \coordinate, \draw, ...
      2. Dòng kết thúc bằng '}'  → lệnh kiểu \def\var{value}
         (chỉ áp dụng cho dòng bắt đầu bằng \\def)
    """
    _DEF_RE = re.compile(r"\\def\\[a-zA-Z0-9_]+\{[^}]+\}")
    commands: List[str] = []
    current: List[str] = []

    # Validate: warn if code is on a single line (potential parsing issue)
    if "\n" not in tikz_code and ";" in tikz_code:
        try:
            print(
                "[WARN] TikZ code is on a single line. Consider using newlines for better parsing."
            )
        except UnicodeEncodeError:
            print("[WARN] Single-line TikZ code detected.")

    for line in tikz_code.split("\n"):
        stripped = line.strip()
        if not stripped or stripped.startswith("%"):
            continue

        # Các environment tags không kết thúc bằng ';' nhưng không được gộp vào lệnh sau
        if stripped.startswith("\\begin") or stripped.startswith("\\end"):
            if current:
                commands.append(" ".join(current))
                current = []
            commands.append(stripped)
            continue

        # Nếu dòng chứa \def, tách ra riêng trước
        remaining = stripped
        while True:
            def_m = _DEF_RE.search(remaining)
            if not def_m:
                break
            before = remaining[: def_m.start()].strip()
            def_cmd = def_m.group(0)
            after = remaining[def_m.end() :].strip()

            # Phần trước \def (nếu có) ghép vào current
            if before:
                current.append(before)
                if before.endswith(";"):
                    commands.append(" ".join(current))
                    current = []

            # Lệnh \def là 1 lệnh độc lập
            if current:
                commands.append(" ".join(current))
                current = []
            commands.append(def_cmd)

            remaining = after

        # Phần còn lại (sau khi đã bóc hết \def)
        if remaining:
            current.append(remaining)
            if remaining.endswith(";"):
                commands.append(" ".join(current))
                current = []

    if current:
        tail = " ".join(current).strip()
        if tail:
            commands.append(tail)

    return commands


def _warn_unrecognized(line_num: int, cmd: str) -> None:
    """In cảnh báo ra console nhưng không dừng quá trình parse."""
    preview = cmd[:80] + ("..." if len(cmd) > 80 else "")
    try:
        print(f"[WARN] Lenh thu {line_num} khong khop pattern nao: {preview}")
    except UnicodeEncodeError:
        print(f"[WARN] Command #{line_num}: unrecognized")


# =============================================================================
# SELF-TEST (chạy: python tikz_parser.py)
# =============================================================================

if __name__ == "__main__":
    import json
    import sys

    # Fix encoding cho Windows terminal
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    sample = r"""
\begin{tikzpicture}
% --- Math World ---
\def\t{0.5}
\coordinate (O) at (0,0);
\coordinate (A) at (3,0);
\path [name path=circleO] (O) circle (2);
\path ($( O)+(60:2)$) coordinate (B);
\path [name intersections={of=circleO and lineAB, by={P,Q}}];

% --- Visual World ---
\draw [thick, blue] (O) circle (2);
\draw [red, dashed] (O) -- (A);
\fill [black] (O) circle (2pt) node[below left] {$O$};
\node [above] at (B) {$B$};
\end{tikzpicture}
"""

    try:
        result = parse_tikz(sample)

        print("=" * 60)
        print("  THẾ GIỚI VÔ HÌNH — math_ast")
        print("=" * 60)
        for item in result["math_ast"]:
            print(json.dumps(item, ensure_ascii=False, indent=2))

        print("\n" + "=" * 60)
        print("  THẾ GIỚI HỮU HÌNH — visual_objects")
        print("=" * 60)
        for item in result["visual_objects"]:
            print(json.dumps(item, ensure_ascii=False, indent=2))

    except RuntimeError as e:
        print(f"\n❌ LỖI PARSER: {e}")
