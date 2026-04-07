import sys

sys.path.insert(0, ".")
from tikz_parser import parse_tikz
from math_engine import MathEngine

code = r"""
\def\t{110}
\coordinate (O) at (0,0);
\path ($(O)+(\t:2)$) coordinate (A);
\path ($(O)+(-30:2)$) coordinate (C);
\path ($(O)+(-150:2)$) coordinate (B);
\path ($(B)!(A)!(C)$) coordinate (H);
\path ($(B)!(H)!(A)$) coordinate (M);
\path ($(C)!(H)!(A)$) coordinate (N);
\path [name path = mn] (M)--(N);
\path [name path = circ1] (O) circle (2);
\path [name intersections={of=circ1 and mn, by={K,Q}}];
"""

ast = parse_tikz(code)

print("=== AST Types ===")
for i, n in enumerate(ast["math_ast"]):
    print(
        f"  {i}: {n.get('type')} -> {n.get('id') or n.get('name') or n.get('points')}"
    )

engine = MathEngine()
frames = engine.bake_frames(ast["math_ast"])

pts = frames[0]["points"]
print("\n=== Points ===")
for name in ["O", "A", "B", "C", "H", "M", "N", "K", "Q"]:
    p = pts.get(name)
    if p:
        print(f"  {name}: ({p['x']:.4f}, {p['y']:.4f})")
    else:
        print(f"  {name}: None")
