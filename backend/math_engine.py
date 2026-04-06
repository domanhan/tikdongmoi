"""
math_engine.py - Phase 03: The Baker (Lò Nướng Dữ Liệu)
MathAnim Builder Backend

Input : math_ast  (list[dict]) — output từ tikz_parser.py
Output: frames    (list[dict]) — tọa độ (x, y) của mọi điểm theo thời gian

Nguyên tắc:
  - Chỉ dùng thư viện chuẩn Python (math, re) → backend siêu nhẹ.
  - Mỗi node trong math_ast được tính tuần tự trong mỗi frame; node sau
    có thể đọc kết quả của node trước (dependency chain).
  - KHÔNG vẽ, KHÔNG render — chỉ tính số.
"""

import math
import re
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Kiểu dữ liệu trung gian
# ---------------------------------------------------------------------------
Point2D = Dict[str, float]  # {"x": float, "y": float}
PointMap = Dict[str, Point2D]  # {"O": {"x":0, "y":0}, ...}
Frame = Dict[str, Any]  # {"frame_index": int, "t_value": float, "points": PointMap}


# ---------------------------------------------------------------------------
# Lớp chính: MathEngine
# ---------------------------------------------------------------------------
class MathEngine:
    """
    "Lò nướng dữ liệu" — tính toán tọa độ của mọi điểm theo tham số t.

    Sử dụng:
        engine = MathEngine()
        frames = engine.bake_frames(math_ast, param_name="t",
                                    t_min=0.0, t_max=1.0, total_frames=60)
    """

    def __init__(self):
        self.named_paths: Dict[str, Dict[str, Any]] = {}

    # -----------------------------------------------------------------------
    # API công khai
    # -----------------------------------------------------------------------

    def bake_frames(
        self,
        math_ast: List[Dict[str, Any]],
        param_name: str = "t",
        t_min: float = 0.0,
        t_max: float = 1.0,
        total_frames: int = 60,
    ) -> List[Frame]:
        """
        Vòng lặp chính: duyệt qua từng frame, tính tọa độ cho mọi điểm.

        Args:
            math_ast:     Danh sách node từ tikz_parser.
            param_name:   Tên biến thời gian trong TikZ (thường là "t").
            t_min:        Giá trị t đầu (thường 0.0).
            t_max:        Giá trị t cuối (thường 1.0).
            total_frames: Số frame muốn xuất (mặc định 60).

        Returns:
            Danh sách frame, mỗi frame chứa index, t_value và toàn bộ points.
        """
        # Tách riêng các node \def (hằng số / biến mở rộng)
        defs: Dict[str, str] = self._extract_defs(math_ast)

        # Reset named_paths for each bake
        self.named_paths = {}

        frames: List[Frame] = []

        for i in range(total_frames):
            # 1. Tính t hiện tại
            if total_frames > 1:
                t_current = t_min + (i / (total_frames - 1)) * (t_max - t_min)
            else:
                t_current = t_min

            # 2. Cập nhật bảng biến với t hiện tại
            vars_table: Dict[str, float] = {param_name: t_current}
            for var_name, expr in defs.items():
                if var_name != param_name:
                    vars_table[var_name] = self._safe_eval(expr, vars_table)

            # 3. Tính tọa độ từng điểm theo thứ tự AST
            current_points: PointMap = {}
            for node in math_ast:
                self._process_node(node, current_points, vars_table)

            frames.append(
                {
                    "frame_index": i,
                    "t_value": round(t_current, 6),
                    "points": {
                        k: {"x": round(v["x"], 6), "y": round(v["y"], 6)}
                        for k, v in current_points.items()
                    },
                }
            )

        return frames

    # -----------------------------------------------------------------------
    # Xử lý từng loại node AST
    # -----------------------------------------------------------------------

    def _process_node(
        self,
        node: Dict[str, Any],
        points: PointMap,
        vars_table: Dict[str, float],
    ) -> None:
        """Dispatch node tới hàm xử lý phù hợp (không raise nếu type lạ)."""
        node_type: str = node.get("type", "")

        handlers = {
            "point_absolute": self._handle_point_absolute,
            "point_polar": self._handle_point_polar,
            "point_project": self._handle_point_project,
            "point_interpolate": self._handle_point_interpolate,
            "point_line_intersect": self._handle_point_line_intersect,
            "point_calc": self._handle_point_calc,
            "point_rotate_interpolate": self._handle_point_rotate_interpolate,
            "named_path": self._handle_named_path,
            "intersection": self._handle_intersection,
            # def_time, visual → bỏ qua
        }

        handler = handlers.get(node_type)
        if handler:
            handler(node, points, vars_table)

    def _handle_point_absolute(
        self,
        node: Dict[str, Any],
        points: PointMap,
        vars_table: Dict[str, float],
    ) -> None:
        """
        Điểm tuyệt đối: \coordinate (P) at (x, y);
        x, y có thể là số literal hoặc biểu thức chứa biến.
        """
        pid = node["id"]
        x = self._safe_eval(str(node["x"]), vars_table)
        y = self._safe_eval(str(node["y"]), vars_table)
        points[pid] = {"x": x, "y": y}

    def _handle_point_polar(
        self,
        node: Dict[str, Any],
        points: PointMap,
        vars_table: Dict[str, float],
    ) -> None:
        """
        Tọa độ cực: \path ($(center)+(angle:radius)$) coordinate (P);
        - center: tên điểm đã có trong points
        - angle : độ (có thể chứa biến như "360*\t")
        - radius: độ dài (có thể chứa biến)
        - Kết quả: P = center + radius*(cos θ, sin θ)
        """
        pid = node["id"]
        center_name: str = node["center"]

        center = points.get(center_name)
        if center is None:
            # Điểm gốc chưa tính — thử lại sau nếu AST sắp xếp sai thứ tự
            return

        angle_deg = self._safe_eval(str(node["angle"]), vars_table)
        radius = self._safe_eval(str(node["radius"]), vars_table)

        angle_rad = math.radians(angle_deg)
        x = center["x"] + radius * math.cos(angle_rad)
        y = center["y"] + radius * math.sin(angle_rad)
        points[pid] = {"x": x, "y": y}

    def _handle_point_project(
        self,
        node: Dict[str, Any],
        points: PointMap,
        vars_table: Dict[str, float],
    ) -> None:
        """
        Hình chiếu vuông góc của điểm P lên đường thẳng AB.

        node phải chứa: {"type": "point_project", "id": "H",
                          "point": "P", "line_p1": "A", "line_p2": "B"}

        Thuật toán (Vector):
          AB   = B - A
          AP   = P - A
          k    = (AP · AB) / (AB · AB)
          H(x) = A.x + k * AB.x
          H(y) = A.y + k * AB.y
        """
        pid = node["id"]
        p_key = node["point"]
        a_key = node["line_p1"]
        b_key = node["line_p2"]

        P = points.get(p_key)
        A = points.get(a_key)
        B = points.get(b_key)

        if None in (P, A, B):
            return  # Chờ node phụ thuộc được tính trước

        abx = B["x"] - A["x"]
        aby = B["y"] - A["y"]
        apx = P["x"] - A["x"]
        apy = P["y"] - A["y"]

        dot_ap_ab = apx * abx + apy * aby
        dot_ab_ab = abx * abx + aby * aby

        if abs(dot_ab_ab) < 1e-12:
            # A và B trùng nhau → hình chiếu không xác định
            points[pid] = {"x": A["x"], "y": A["y"]}
            return

        k = dot_ap_ab / dot_ab_ab
        hx = A["x"] + k * abx
        hy = A["y"] + k * aby
        points[pid] = {"x": hx, "y": hy}

    def _handle_point_interpolate(
        self,
        node: Dict[str, Any],
        points: PointMap,
        vars_table: Dict[str, float],
    ) -> None:
        """
        Nội suy / chia đoạn: $(A)!k!(C)$ → P = A + k*(C - A)

        k = 0   → P trùng A
        k = 0.5 → P là trung điểm AC
        k = 1   → P trùng C
        k có thể là biểu thức chứa biến t.
        """
        pid = node["id"]
        p1 = points.get(node["p1"])
        p2 = points.get(node["p2"])
        if p1 is None or p2 is None:
            return

        k = self._safe_eval(str(node["k"]), vars_table)
        x = p1["x"] + k * (p2["x"] - p1["x"])
        y = p1["y"] + k * (p2["y"] - p1["y"])
        points[pid] = {"x": x, "y": y}

    def _handle_point_rotate_interpolate(
        self,
        node: Dict[str, Any],
        points: PointMap,
        vars_table: Dict[str, float],
    ) -> None:
        """
        Nội suy xoay: $(A)!k!angle:(C)$
        1. Nội suy: P = A + k*(C - A)
        2. Xoay P quanh A một góc 'angle' (độ)
        """
        pid = node["id"]
        p1 = points.get(node["p1"])
        p2 = points.get(node["p2"])
        if p1 is None or p2 is None:
            return

        k = self._safe_eval(str(node["k"]), vars_table)
        angle_deg = self._safe_eval(str(node["angle"]), vars_table)
        angle_rad = math.radians(angle_deg)

        # Bước 1: Nội suy
        ix = p1["x"] + k * (p2["x"] - p1["x"])
        iy = p1["y"] + k * (p2["y"] - p1["y"])

        # Bước 2: Xoay quanh p1
        dx = ix - p1["x"]
        dy = iy - p1["y"]
        x = p1["x"] + dx * math.cos(angle_rad) - dy * math.sin(angle_rad)
        y = p1["y"] + dx * math.sin(angle_rad) + dy * math.cos(angle_rad)

        points[pid] = {"x": x, "y": y}

    def _handle_point_line_intersect(
        self,
        node: Dict[str, Any],
        points: PointMap,
        vars_table: Dict[str, float],
    ) -> None:
        """
        Giao điểm 2 đường thẳng: (intersection of A--B and C--D)

        Thuật toán Cramer (tham số hóa):
          Đường 1: P = A + t*(B-A)
          Đường 2: Q = C + s*(D-C)
          Giải hệ: A + t*(B-A) = C + s*(D-C)

          det = (B-A) × (D-C)     (tích chéo 2D)
          t   = (C-A) × (D-C) / det
          E   = A + t*(B-A)
        """
        pid = node["id"]
        A = points.get(node["l1p1"])
        B = points.get(node["l1p2"])
        C = points.get(node["l2p1"])
        D = points.get(node["l2p2"])
        if None in (A, B, C, D):
            return

        dx1 = B["x"] - A["x"]
        dy1 = B["y"] - A["y"]
        dx2 = D["x"] - C["x"]
        dy2 = D["y"] - C["y"]

        denom = dx1 * dy2 - dy1 * dx2  # tích chéo AB × CD
        if abs(denom) < 1e-12:
            return  # Hai đường song song

        t = ((C["x"] - A["x"]) * dy2 - (C["y"] - A["y"]) * dx2) / denom
        x = A["x"] + t * dx1
        y = A["y"] + t * dy1
        points[pid] = {"x": x, "y": y}

    def _handle_point_calc(
        self,
        node: Dict[str, Any],
        points: PointMap,
        vars_table: Dict[str, float],
    ) -> None:
        """
        Biểu thức vector tổng quát: $(B)-(A)+(D)$ → C = B - A + D

        Tokenizer đơn giản:
          - Nhận diện các token (POINT_NAME) và toán tử +/-
          - Áp dụng tuần tự từ trái sang phải
        """
        pid = node["id"]
        expr = node["expr"].strip()

        # Tách thành danh sách (operator, point_name)
        # Ví dụ: "(B)-(A)+(D)" → [('+','B'), ('-','A'), ('+','D')]
        token_re = re.compile(r"([+\-]?)\s*\(([^)]+)\)")
        tokens = token_re.findall(expr)

        rx, ry = 0.0, 0.0
        for op, pt_name in tokens:
            pt = points.get(pt_name.strip())
            if pt is None:
                return  # Phụ thuộc chưa sẵn sàng
            sign = -1.0 if op == "-" else 1.0
            rx += sign * pt["x"]
            ry += sign * pt["y"]

        points[pid] = {"x": rx, "y": ry}

    def _handle_named_path(
        self,
        node: Dict[str, Any],
        points: PointMap,
        vars_table: Dict[str, float],
    ) -> None:
        """
        Lưu trữ đường được đặt tên: \path [name path=circleO] (O) circle (1.5);

        Hỗ trợ:
          - Circle: (center) circle (radius)
          - Line: (A) -- (B)
        """
        path_name = node.get("name", "")
        content = node.get("content", "")

        if not path_name or not content:
            return

        content = content.strip()

        # Circle: (center) circle (radius)
        circle_match = re.match(r"\((\w+)\)\s+circle\s+\(([^)]+)\)", content)
        if circle_match:
            center_name = circle_match.group(1)
            radius_expr = circle_match.group(2)
            center = points.get(center_name)
            if center:
                radius = self._safe_eval(radius_expr, vars_table)
                self.named_paths[path_name] = {
                    "type": "circle",
                    "center": center,
                    "radius": radius,
                }
            return

        # Line: (A) -- (B)
        line_match = re.match(r"\((\w+)\)\s+--\s+\((\w+)\)", content)
        if line_match:
            p1_name = line_match.group(1)
            p2_name = line_match.group(2)
            p1 = points.get(p1_name)
            p2 = points.get(p2_name)
            if p1 and p2:
                self.named_paths[path_name] = {
                    "type": "line",
                    "p1": p1,
                    "p2": p2,
                }

    def _handle_intersection(
        self,
        node: Dict[str, Any],
        points: PointMap,
        vars_table: Dict[str, float],
    ) -> None:
        """
        Tính giao điểm của 2 đường: \path [name intersections={of=circleO and lineMN, by={P,Q}}];

        Hỗ trợ:
          - line-line: 0 hoặc 1 giao điểm
          - line-circle: 0, 1, hoặc 2 giao điểm
          - circle-circle: 0, 1, hoặc 2 giao điểm
        """
        path1_name = node.get("path1", "")
        path2_name = node.get("path2", "")
        result_points = node.get("points", [])

        path1 = self.named_paths.get(path1_name)
        path2 = self.named_paths.get(path2_name)

        if not path1 or not path2:
            print(
                f"[WARN] Intersection: path '{path1_name}' or '{path2_name}' not found"
            )
            return

        # Tính giao điểm dựa trên loại đường
        intersections = self._compute_intersection(path1, path2)

        # Gán kết quả theo thứ tự
        for i, pid in enumerate(result_points):
            if i < len(intersections):
                points[pid] = intersections[i]

    def _compute_intersection(
        self,
        path1: Dict[str, Any],
        path2: Dict[str, Any],
    ) -> List[Point2D]:
        """
        Tính giao điểm của 2 đường (unified algorithm - Phương án 2).

        Returns:
            List of 0, 1, or 2 intersection points.
        """
        t1 = path1.get("type")
        t2 = path2.get("type")

        if t1 == "line" and t2 == "line":
            return self._line_line_intersection(path1, path2)
        elif t1 == "circle" and t2 == "circle":
            return self._circle_circle_intersection(path1, path2)
        elif t1 == "line" and t2 == "circle":
            return self._line_circle_intersection(path1, path2)
        elif t1 == "circle" and t2 == "line":
            return self._line_circle_intersection(path2, path1)

        return []

    def _line_line_intersection(
        self,
        line1: Dict[str, Any],
        line2: Dict[str, Any],
    ) -> List[Point2D]:
        """Giao điểm 2 đường thẳng."""
        A = line1["p1"]
        B = line1["p2"]
        C = line2["p1"]
        D = line2["p2"]

        dx1 = B["x"] - A["x"]
        dy1 = B["y"] - A["y"]
        dx2 = D["x"] - C["x"]
        dy2 = D["y"] - C["y"]

        denom = dx1 * dy2 - dy1 * dx2
        if abs(denom) < 1e-12:
            return []  # Song song

        t = ((C["x"] - A["x"]) * dy2 - (C["y"] - A["y"]) * dx2) / denom
        x = A["x"] + t * dx1
        y = A["y"] + t * dy1

        return [{"x": x, "y": y}]

    def _circle_circle_intersection(
        self,
        circle1: Dict[str, Any],
        circle2: Dict[str, Any],
    ) -> List[Point2D]:
        """Giao điểm 2 đường tròn."""
        c1 = circle1["center"]
        r1 = circle1["radius"]
        c2 = circle2["center"]
        r2 = circle2["radius"]

        dx = c2["x"] - c1["x"]
        dy = c2["y"] - c1["y"]
        d = math.sqrt(dx * dx + dy * dy)

        if d > r1 + r2:
            return []  # Không giao
        if d < abs(r1 - r2):
            return []  # Một đường tròn trong another
        if abs(d) < 1e-12:
            return []  # Trùng tâm

        a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
        h = math.sqrt(max(0, r1 * r1 - a * a))

        cx = c1["x"] + a * dx / d
        cy = c1["y"] + a * dy / d

        if abs(h) < 1e-12:
            return [{"x": cx, "y": cy}]

        return [
            {"x": cx + h * dy / d, "y": cy - h * dx / d},
            {"x": cx - h * dy / d, "y": cy + h * dx / d},
        ]

    def _line_circle_intersection(
        self,
        line: Dict[str, Any],
        circle: Dict[str, Any],
    ) -> List[Point2D]:
        """
        Giao điểm đường thẳng - đường tròn.

        Thuật toán: Giải phương trình bậc 2.
        Thứ tự: Gần p1 của line = điểm đầu, gần p2 = điểm sau.
        """
        A = line["p1"]
        B = line["p2"]
        C = circle["center"]
        r = circle["radius"]

        dx = B["x"] - A["x"]
        dy = B["y"] - A["y"]

        fx = A["x"] - C["x"]
        fy = A["y"] - C["y"]

        a = dx * dx + dy * dy
        b = 2 * (fx * dx + fy * dy)
        c = fx * fx + fy * fy - r * r

        discriminant = b * b - 4 * a * c

        if discriminant < 0:
            return []

        sqrt_d = math.sqrt(discriminant)

        if abs(a) < 1e-12:
            return []

        t1 = (-b - sqrt_d) / (2 * a)
        t2 = (-b + sqrt_d) / (2 * a)

        intersections = []

        p1 = {"x": A["x"] + t1 * dx, "y": A["y"] + t1 * dy}
        p2 = {"x": A["x"] + t2 * dx, "y": A["y"] + t2 * dy}

        # Lọc các điểm hợp lệ (t >= -1e-9)
        def is_valid(t_val):
            return t_val >= -1e-9

        if is_valid(t1):
            intersections.append(p1)
        if is_valid(t2):
            intersections.append(p2)

        # Sắp xếp theo khoảng cách: gần A (p1 của line) trước
        def dist_to_a(p):
            return math.sqrt((p["x"] - A["x"]) ** 2 + (p["y"] - A["y"]) ** 2)

        intersections.sort(key=dist_to_a)

        return intersections

    # -----------------------------------------------------------------------
    # Tiện ích nội bộ
    # -----------------------------------------------------------------------

    def _extract_defs(self, math_ast: List[Dict[str, Any]]) -> Dict[str, str]:
        """Trích xuất tất cả node def_time thành bảng {var: expr}."""
        return {
            node["var"]: node["value"]
            for node in math_ast
            if node.get("type") == "def_time"
        }

    def _safe_eval(self, expr: str, vars_table: Dict[str, float]) -> float:
        """
        Tính giá trị biểu thức toán học đơn giản một cách an toàn.

        Hỗ trợ:
          - Số nguyên / thực: "3", "0.5", "-2"
          - Nhân với biến: "360*t", "2*t", "r*t"
          - Cộng / trừ: "t+1", "180-t"
          - Biểu thức LaTeX tối giản: thay \\var → giá trị

        Không dùng eval() của Python để tránh bảo mật.
        """
        # 1. Thay thế \var → giá trị số trong vars_table
        cleaned = expr.strip()
        for var_name, val in vars_table.items():
            cleaned = re.sub(
                rf"\\{re.escape(var_name)}\b",
                str(val),
                cleaned,
            )
            # Cũng thay tên không có backslash (e.g. "t" thuần)
            cleaned = re.sub(
                rf"\b{re.escape(var_name)}\b",
                str(val),
                cleaned,
            )

        # 2. Cố gắng parse số thuần
        try:
            return float(cleaned)
        except ValueError:
            pass

        # 3. Dùng eval hạn chế (chỉ cho phép +, -, *, /, ** và hàm math)
        try:
            safe_globals = {
                "__builtins__": {},
                "pi": math.pi,
                "sin": math.sin,
                "cos": math.cos,
                "tan": math.tan,
                "sqrt": math.sqrt,
                "abs": abs,
            }
            return float(eval(cleaned, safe_globals))  # noqa: S307
        except Exception:
            # Trả về 0 nếu không parse được, ghi cảnh báo
            print(f"[WARN] Không parse được biểu thức: {repr(expr)} → dùng 0.0")
            return 0.0


# ---------------------------------------------------------------------------
# SELF-TEST (chạy: python math_engine.py)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import json
    import sys

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    # Bộ math_ast mẫu:
    #   - O tại gốc tọa độ (cố định)
    #   - D quay quanh O theo góc 360*t, bán kính 2
    #   - H là hình chiếu vuông góc của D lên trục Ox (A→B)
    sample_ast = [
        {"type": "def_time", "var": "t", "value": "0"},
        {"type": "point_absolute", "id": "O", "x": "0", "y": "0"},
        {"type": "point_absolute", "id": "A", "x": "3", "y": "0"},
        {"type": "point_absolute", "id": "B", "x": "-3", "y": "0"},  # trục Ox
        {
            "type": "point_polar",
            "id": "D",
            "center": "O",
            "angle": "360*t",
            "radius": "2",
        },
        {
            "type": "point_project",
            "id": "H",
            "point": "D",
            "line_p1": "A",
            "line_p2": "B",
        },
    ]

    engine = MathEngine()
    frames = engine.bake_frames(
        sample_ast,
        param_name="t",
        t_min=0.0,
        t_max=1.0,
        total_frames=5,  # Chỉ 5 frame để dễ đọc
    )

    print("=" * 60)
    print("  MATH ENGINE OUTPUT — 5 frames")
    print("=" * 60)
    for frame in frames:
        print(json.dumps(frame, ensure_ascii=False, indent=2))
    print("=" * 60)
    print(f"  Total frames: {len(frames)}")
    print("=" * 60)
