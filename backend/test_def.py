import sys

sys.path.insert(0, ".")
from tikz_parser import parse_tikz
from math_engine import MathEngine

# Simulate what the actual frontend sends (raw backslash + t, NOT tab)
code = (
    "\\def\\t{110}\n\\coordinate (O) at (0,0);\n\\path ($(O)+(\\t:2)$) coordinate (A);"
)

ast = parse_tikz(code)
print("=== AST ===")
for n in ast["math_ast"]:
    if n.get("type") == "def_time":
        print(f"def_time: var={repr(n['var'])}, value={repr(n['value'])}")
    elif n.get("type") == "point_polar":
        angle = n["angle"]
        print(
            f"point_polar: angle={repr(angle)}, angle_bytes={[ord(c) for c in angle]}"
        )

        engine = MathEngine()
        vars_table = {"t": 110.0}
        result = engine._safe_eval(angle, vars_table)
        print(f"_safe_eval result: {result}")
