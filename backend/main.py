import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel
from typing import Optional, List
import json
import uvicorn
from backend.tikz_parser import parse_tikz
from backend.math_engine import MathEngine

app = FastAPI(title="MathAnim Builder API")

# Setup CORS cho frontend gọi Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os

# Mount frontend static files
app.mount(
    "/view",
    StaticFiles(
        directory=os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
    ),
    name="static",
)

templates = Jinja2Templates(
    directory=os.path.join(os.path.dirname(__file__), "templates")
)


class TikzInput(BaseModel):
    code: str


class BakeInput(BaseModel):
    code: str
    param_name: str = "t"
    t_min: float = 0.0
    t_max: float = 1.0
    total_frames: int = 60


class ExportInput(BaseModel):
    visual_objects: list
    frames: list
    steps: list


@app.post("/api/parse")
async def parse_tikz_code(data: TikzInput):
    """
    Nhận Tikz code từ frontend → trả về Math AST + Visual Objects.
    """
    try:
        result = parse_tikz(data.code)
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/bake")
async def bake_frames(data: BakeInput):
    """
    Phase 3: Nhận Tikz code → Parse AST → Bake frames.
    Trả về cả visual_objects (cho Phase 4 vẽ) và frames (tọa độ theo thời gian).
    """
    try:
        print(
            f"[DEBUG BAKE] param_name={data.param_name}, t_min={data.t_min}, t_max={data.t_max}, total_frames={data.total_frames}"
        )
        parsed = parse_tikz(data.code)
        engine = MathEngine()
        frames = engine.bake_frames(
            parsed["math_ast"],
            param_name=data.param_name,
            t_min=data.t_min,
            t_max=data.t_max,
            total_frames=data.total_frames,
        )
        # Debug: check first and last frame points
        if frames:
            print(f"[DEBUG BAKE] Frame 0 A: {frames[0]['points'].get('A')}")
            print(f"[DEBUG BAKE] Frame last A: {frames[-1]['points'].get('A')}")
        return {
            "status": "success",
            "data": {
                "visual_objects": parsed["visual_objects"],
                "frames": frames,
            },
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/")
def read_root():
    return {"message": "MathAnim Builder Backend is running!"}


@app.get("/view")
def read_frontend():
    from fastapi.responses import FileResponse

    return FileResponse(
        os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "frontend", "index.html"
        )
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
