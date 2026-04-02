# -*- coding: utf-8 -*-
import json
from tikz_parser import parse_tikz
from math_engine import MathEngine

code = r"""
\begin{tikzpicture}
\def\t{30}
\coordinate (O) at (0,0);
\path ($(O)+(\t:2)$) coordinate  (A);
\path ($(O)+(-50:2)$) coordinate  (B);
\path ($(O)+(-150:2)$) coordinate  (C);
\path ($(A)!.1!90:(O)$) coordinate (a);
\path ($(B)!.1!-90:(O)$) coordinate (b);
\path (intersection of A--a and B--b) coordinate (M);
\draw (O) circle (2);
\draw (A)--(B)--(C)--cycle;
\fill (A) circle (1pt) node[above]{$A$};
\draw (A)--(M)--(B);
\draw (O)--(B);
\draw (O)--(M);
\draw pic[draw,angle radius =2mm]{right angle = O--A--M};
\draw pic[draw,angle radius =2mm]{right angle = M--B--O};
\end{tikzpicture}
"""

result = parse_tikz(code)

print("=== MATH AST ===")
for node in result["math_ast"]:
    print(json.dumps(node, ensure_ascii=False, indent=2))

print("\n=== VISUAL OBJECTS ===")
for obj in result["visual_objects"]:
    print(json.dumps(obj, ensure_ascii=False, indent=2))

# Bake frames
engine = MathEngine()
frames = engine.bake_frames(
    result["math_ast"],
    param_name="t",
    t_min=30,
    t_max=60,
    total_frames=3,
)

print("\n=== FRAMES ===")
for frame in frames:
    print(f"\nFrame {frame['frame_index']}, t={frame['t_value']}:")
    for name, pt in frame["points"].items():
        print(f"  {name}: ({pt['x']:.4f}, {pt['y']:.4f})")
