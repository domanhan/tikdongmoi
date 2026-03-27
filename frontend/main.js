/**
 * MathAnim Builder - Phase 5: Timeline & Effect System (MVP)
 * 
 * Includes the MathAnimPlayer for step-based animation controls.
 */

const API_URL = "http://localhost:8000/api/bake";
const SCALE = 50; // 1 unit in TikZ = 50px

document.addEventListener("DOMContentLoaded", () => {
    const btnRun = document.getElementById("btn-run");
    const tikzInput = document.getElementById("tikz-input");
    
    // Globals for UI integration
    window.player = new MathAnimPlayer(document.getElementById("canvas-container"));
    window.visualObjects = [];
    window.frames = [];

    // Default code to initial view
    runCode(tikzInput.value);

    btnRun.addEventListener("click", () => {
        runCode(tikzInput.value);
    });

    const btnExportAuto = document.getElementById("btn-export-auto");
    if (btnExportAuto) {
        btnExportAuto.addEventListener("click", () => exportToStandaloneHTML(true));
    }
    const btnExport = document.getElementById("btn-export-html");
    if (btnExport) {
        btnExport.addEventListener("click", () => exportToStandaloneHTML(false));
    }

    initStepUI();
});

async function exportToStandaloneHTML(isAutoPlay = false) {
    if (!window.visualObjects || window.visualObjects.length === 0) {
        alert("Please run code and generate animation first!");
        return;
    }

    const btnId = isAutoPlay ? "btn-export-auto" : "btn-export-html";
    const btnExport = document.getElementById(btnId);
    const originalText = btnExport.innerHTML;
    btnExport.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Exporting...`;
    btnExport.disabled = true;

    try {
        const data = {
            visual_objects: window.visualObjects,
            frames: window.frames,
            steps: window.player.steps
        };
        
        const styleCSS = isAutoPlay ? `
        body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background-color: #fff; }
        #canvas-container { width: 100%; height: 100%; position: relative; background: #fff; }
        ` : `
        body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background-color: #f8fafc; }
        #canvas-container { width: 100%; height: calc(100% - 60px); position: relative; background: #fff; }
        #canvas-container::before {
            content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
            background-size: 50px 50px; background-position: center; pointer-events: none; opacity: 0.5;
        }
        #controls { height: 60px; display: flex; align-items: center; justify-content: center; background: #1e293b; color: white; gap: 20px; box-shadow: 0 -2px 10px rgba(0,0,0,0.1); z-index: 10; position: relative;}
        `;
        
        const controlsHTML = isAutoPlay ? '' : `
    <div id="controls">
        <button id="btn-prev" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"><i class="fa-solid fa-backward-step"></i> Prev</button>
        <div id="step-indicator" class="font-mono text-lg font-bold min-w-[80px] text-center">Step 0</div>
        <button id="btn-play" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold transition flex items-center gap-2"><i class="fa-solid fa-play"></i> Play</button>
        <button id="btn-next" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"><i class="fa-solid fa-forward-step"></i> Next</button>
    </div>`;

        const initScript = isAutoPlay ? `
            // AutoPlay Logic
            player.jumpToStep(0); // Start empty
            
            const startAutoPlay = () => {
                const playNext = () => {
                    if (player.currentStep < parsedData.steps.length) {
                        player.currentStep++;
                        player.playStep(player.currentStep, () => {
                            setTimeout(playNext, 1000); // 1s pause between steps
                        });
                    }
                };
                setTimeout(playNext, 1000); // Wait 1s before starting
            };
            startAutoPlay();
        ` : `
            // Step-by-Step UI Logic
            const btnPlay = document.getElementById("btn-play");
            const btnNext = document.getElementById("btn-next");
            const btnPrev = document.getElementById("btn-prev");
            const labelStep = document.getElementById("step-indicator");

            const updateUI = () => {
                labelStep.innerText = \`Step \${player.currentStep} / \${parsedData.steps.length}\`;
                btnPrev.disabled = player.currentStep <= 0;
                btnNext.disabled = player.currentStep >= parsedData.steps.length;
                btnPrev.style.opacity = btnPrev.disabled ? "0.5" : "1";
                btnNext.style.opacity = btnNext.disabled ? "0.5" : "1";
            };

            btnPlay.addEventListener("click", () => {
                if (player.currentStep < parsedData.steps.length && !player.isPlaying) {
                    player.currentStep++;
                    btnPlay.innerHTML = \`<i class="fa-solid fa-spinner fa-spin"></i> Playing\`;
                    player.playStep(player.currentStep, () => {
                        btnPlay.innerHTML = \`<i class="fa-solid fa-play"></i> Play\`;
                        updateUI();
                    });
                    updateUI();
                } else if (player.currentStep >= parsedData.steps.length) {
                    alert("Animation completed!");
                }
            });

            btnPrev.addEventListener("click", () => {
                if (player.currentStep > 0 && !player.isPlaying) {
                    player.jumpToStep(player.currentStep - 1);
                    updateUI();
                }
            });

            btnNext.addEventListener("click", () => {
                if (player.currentStep < parsedData.steps.length && !player.isPlaying) {
                    player.jumpToStep(player.currentStep + 1);
                    updateUI();
                }
            });

            updateUI();
            
            window.addEventListener("resize", () => {
                player.jumpToStep(player.currentStep);
            });
        `;

        const htmlTemplate = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MathAnim Export ${isAutoPlay ? 'AutoPlay' : 'Interactive'}</title>
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
${styleCSS}
    </style>
</head>
<body class="flex flex-col">

    <div id="canvas-container"></div>
    
${controlsHTML}

    <!-- Data stored safely as JSON block to avoid execution/escaping issues -->
    <script type="application/json" id="mathanim-data">
${JSON.stringify(data)}
    </script>

    <script>
        const SCALE = 50;

        // Class definition injected natively
        ${MathAnimPlayer.toString()}

        window.onload = () => {
            const dataScript = document.getElementById("mathanim-data");
            const parsedData = JSON.parse(dataScript.textContent);
            
            const player = new MathAnimPlayer(document.getElementById("canvas-container"));
            player.init(parsedData.visual_objects, parsedData.frames, parsedData.steps);
            
${initScript}
        };
    </script>
</body>
</html>`;

        const blob = new Blob([htmlTemplate], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const filename = isAutoPlay ? "mathanim_autoplay.html" : "mathanim_interactive.html";
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Export Error:", err);
        alert("Export failed.");
    }

    btnExport.innerHTML = originalText;
    btnExport.disabled = false;
}

async function runCode(code) {
    try {
        const btnRun = document.getElementById("btn-run");
        const originalText = btnRun.innerHTML;
        btnRun.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Baking...`;
        btnRun.disabled = true;

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                code: code,
                param_name: "t",
                t_min: 0,
                t_max: 1,
                total_frames: 60 // Need ~60 frames for 'move' interpolation
            })
        });

        const result = await response.json();
        
        btnRun.innerHTML = originalText;
        btnRun.disabled = false;

        if (result.status === "success") {
            window.visualObjects = result.data.visual_objects;
            window.frames = result.data.frames;
            
            // Re-initialize player
            window.player.init(window.visualObjects, window.frames, window.player.steps);
            updateOutliner(window.visualObjects);
            
            // Removed automatic fallback fading. User will create steps manually or use Auto-assign.
            if (window.player.steps.length > 0) {
                renderStepsUI();
            }
        } else {
            console.error("Backend Error:", result.message);
            alert("Lỗi parse TikZ: " + result.message);
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        alert("Không thể kết nối Backend. Hãy đảm bảo FastAPI đang chạy ở port 8000.");
    }
}

/**
 * UI Integration for Outliner and Effect Menu
 */
function updateOutliner(visualObjects) {
    const outliner = document.getElementById("outliner");
    outliner.innerHTML = ""; 

    visualObjects.forEach(obj => {
        const item = document.createElement("div");
        item.className = "outliner-item p-2 mb-2 bg-white border border-gray-200 rounded shadow-sm text-sm hover:border-blue-400 cursor-pointer transition-colors";
        
        let iconColor = "bg-gray-500";
        if (obj.type.includes("draw")) iconColor = "bg-transparent border-2 border-blue-500";
        if (obj.type.includes("fill")) iconColor = "bg-red-500";
        if (obj.type.includes("node")) iconColor = "bg-purple-500 text-white flex items-center justify-center text-[8px]";

        let iconMarkup = `<span class="inline-flex w-4 h-4 rounded-full ${iconColor}"></span>`;
        if (obj.type.includes("node")) {
            iconMarkup = `<span class="inline-flex w-4 h-4 rounded-sm ${iconColor}">T</span>`;
        }

        item.innerHTML = `
            <div class="flex items-center gap-2">
                ${iconMarkup}
                <div>
                    <div class="font-bold text-gray-800">${obj._id} <span class="text-xs font-normal text-gray-400">(${obj.type})</span></div>
                    <div class="font-mono text-[10px] text-gray-500 truncate max-w-[120px]" title="${obj._src}">${obj._src}</div>
                </div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            // Highlight selected
            document.querySelectorAll('.outliner-item').forEach(el => el.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-50'));
            item.classList.add('ring-2', 'ring-blue-400', 'bg-blue-50');
            renderOutlinerProps(obj);
        });

        outliner.appendChild(item);
    });
}

window.selectedOutlinerObj = null;
window.renderOutlinerProps = (obj) => {
    window.selectedOutlinerObj = obj;
    const propsContainer = document.getElementById("outliner-props");
    
    // Determine default effect based on type
    let defaultType = "fade_in";
    if (obj.type === "draw_circle") defaultType = "draw_light";
    else if (obj.type.includes("draw")) defaultType = "draw";
    else if (obj.type.includes("fill")) defaultType = "fill";
    
    propsContainer.innerHTML = `
        <div class="font-bold text-gray-800 border-b pb-2 mb-2 break-all text-sm">${obj._id}</div>
        
        <div class="mb-2">
            <label class="block text-xs font-bold text-gray-700 mb-1">Effect</label>
            <select id="prop-effect" class="w-full text-sm border border-gray-300 bg-white rounded px-2 py-1">
                <option value="draw" ${defaultType==='draw'?'selected':''}>Draw</option>
                <option value="draw_light" ${defaultType==='draw_light'?'selected':''}>Draw Light</option>
                <option value="draw_dashed_light" ${defaultType==='draw_dashed_light'?'selected':''}>Dashed Light</option>
                <option value="fade_in" ${defaultType==='fade_in'?'selected':''}>Fade In</option>
                <option value="fill" ${defaultType==='fill'?'selected':''}>Fill</option>
                <option value="move" ${defaultType==='move'?'selected':''}>Move</option>
            </select>
        </div>
        
        <div class="mb-2">
            <label class="block text-xs font-bold text-gray-700 mb-1">Duration (ms)</label>
            <input type="number" id="prop-duration" class="w-full text-sm border border-gray-300 rounded px-2 py-1" value="1000" step="100">
        </div>

        <div class="mb-2">
            <label class="block text-xs font-bold text-gray-700 mb-1">Color (optional)</label>
            <input type="text" id="prop-color" class="w-full text-sm border border-gray-300 rounded px-2 py-1" placeholder="#ff0000, red...">
        </div>

        <div class="mb-4">
            <label class="block text-xs font-bold text-gray-700 mb-1">Params (JSON)</label>
            <textarea id="prop-params" class="w-full text-xs font-mono border border-gray-300 rounded px-2 py-1 h-14" placeholder='{"opacity": 0.5}'></textarea>
        </div>

        <button onclick="window.addEffectFromProps()" class="w-full bg-blue-600 hover:bg-blue-500 text-white rounded py-1.5 text-sm font-bold shadow-sm transition">
            <i class="fa-solid fa-plus"></i> Add to Step
        </button>
    `;
};

window.addEffectFromProps = () => {
    if (!window.selectedOutlinerObj) return;
    let currentStep = window.player.currentStep;
    if (window.player.steps.length === 0) {
        window.player.steps.push([]);
        window.player.currentStep = 1;
        currentStep = 1;
    } else if (currentStep < 1) {
        currentStep = window.player.steps.length;
    }
    
    const effType = document.getElementById("prop-effect").value;
    const duration = parseInt(document.getElementById("prop-duration").value) || 1000;
    const color = document.getElementById("prop-color").value.trim();
    const paramsStr = document.getElementById("prop-params").value.trim();
    
    let params = undefined;
    if (paramsStr) {
        try { params = JSON.parse(paramsStr); }
        catch (e) { alert("Lỗi JSON Format"); return; }
    }
    
    const objId = window.selectedOutlinerObj._id;
    window.player.steps[currentStep - 1].push({
        target_id: objId,
        type: effType,
        duration: duration,
        color: color || undefined,
        params: params
    });
    
    renderStepsUI();
};

function initStepUI() {

    // Step Managers
    document.getElementById('btn-auto-assign').addEventListener('click', () => {
        console.log("Auto-assign clicked. visualObjects:", window.visualObjects);
        if (!window.visualObjects || window.visualObjects.length === 0) {
            alert("Vui lòng Run Code trước để tạo các đối tượng.");
            return;
        }
        if (!confirm("Tự động tạo các Step từng phần tử một cho tất cả đối tượng? (Sẽ ghi đè Timeline hiện tại)")) return;
        
        window.player.steps = [];
        window.player.currentStep = 0;
        
        window.visualObjects.forEach((obj, idx) => {
            let effectType = "fade_in";
            let duration = 800;
            
            // Logic gắn hiệu ứng phù hợp cho từng loại
            const type = obj.type || "";
            if (type === "draw_circle") {
                effectType = "draw_light";
                duration = 1500;
            } else if (type === "draw_lines") {
                effectType = "draw";
                duration = 1000;
            } else if (type === "draw_right_angle" || type === "draw_angle") {
                effectType = "draw";
                duration = 800;
            } else if (type === "fill_node") {
                effectType = "fade_in";
                duration = 600;
            } else if (type === "node_label") {
                effectType = "fade_in";
                duration = 500;
            } else if (type === "draw_line_label") {
                effectType = "draw";
                duration = 1000;
            } else if (type.includes("draw")) {
                effectType = "draw";
                duration = 1000;
            }
            
            console.log(`Auto: Adding obj ${obj._id} with effect ${effectType}`);
            window.player.steps.push([{
                target_id: obj._id,
                type: effectType,
                duration: duration
            }]);
        });
        
        if (window.player.steps.length > 0) window.player.currentStep = 1;
        console.log("Auto: Final steps count:", window.player.steps.length);
        renderStepsUI();
    });

    document.getElementById('btn-add-step').addEventListener('click', () => {
        window.player.steps.push([]);
        window.player.currentStep = window.player.steps.length;
        renderStepsUI();
    });

    document.getElementById('btn-play-step').addEventListener('click', () => {
        if (window.player.currentStep > 0 && !window.player.isPlaying) {
            const btnPlay = document.getElementById('btn-play-step');
            const btnStop = document.getElementById('btn-stop-step');
            
            btnPlay.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Playing...`;
            btnPlay.disabled = true;
            btnStop.disabled = false;

            window.player.playStep(window.player.currentStep, () => {
                btnPlay.innerHTML = `<i class="fa-solid fa-play"></i> Play Step`;
                btnPlay.disabled = false;
                btnStop.disabled = true;
            });
        }
    });

    document.getElementById('btn-stop-step').addEventListener('click', () => {
        window.player.stop();
        const btnPlay = document.getElementById('btn-play-step');
        const btnPlayAll = document.getElementById('btn-play-all');
        const btnStop = document.getElementById('btn-stop-step');

        btnPlay.innerHTML = `<i class="fa-solid fa-play"></i> Play Step`;
        btnPlay.disabled = false;
        btnPlayAll.disabled = false;
        btnStop.disabled = true;
    });

    document.getElementById('btn-play-all').addEventListener('click', () => {
        if (window.player.steps.length > 0 && !window.player.isPlaying) {
            window.player.currentStep = 1;
            renderStepsUI();
            
            const btnAll = document.getElementById('btn-play-all');
            const btnStop = document.getElementById('btn-stop-step');
            const originalAllText = btnAll.innerHTML;
            
            const playSequence = () => {
                if (window.player.currentStep > window.player.steps.length || window.player.isStopRequested) {
                    btnAll.innerHTML = originalAllText;
                    btnAll.disabled = false;
                    btnStop.disabled = true;
                    window.player.isStopRequested = false;
                    return;
                }
                
                btnAll.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Playing...`;
                btnAll.disabled = true;
                btnStop.disabled = false;
                
                window.player.playStep(window.player.currentStep, () => {
                    if (window.player.currentStep < window.player.steps.length && !window.player.isStopRequested) {
                        window.player.currentStep++;
                        renderStepsUI();
                        setTimeout(playSequence, 800);
                    } else {
                        btnAll.innerHTML = originalAllText;
                        btnAll.disabled = false;
                        btnStop.disabled = true;
                        window.player.isStopRequested = false;
                    }
                });
            };
            
            playSequence();
        }
    });

    // Event Delegation cho các nút Xóa hiệu ứng trong Timeline
    const timelineContainer = document.getElementById('timeline-steps');
    if (timelineContainer) {
        timelineContainer.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-eff-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const stepIdx = parseInt(deleteBtn.getAttribute('data-step'));
                const effIdx = parseInt(deleteBtn.getAttribute('data-eff'));
                console.log(`Deleting: step ${stepIdx}, eff ${effIdx}`);
                window.deleteEffect(stepIdx, effIdx);
            }
        });
    } else {
        console.error("Critical: #timeline-steps not found!");
    }
}

function renderStepsUI() {
    const container = document.getElementById('timeline-steps');
    container.innerHTML = "";
    
    if (window.player.steps.length > 0) {
        document.getElementById('btn-play-step').disabled = false;
        document.getElementById('btn-play-all').disabled = false;
    } else {
        document.getElementById('btn-play-step').disabled = true;
        document.getElementById('btn-play-all').disabled = true;
    }

    window.player.steps.forEach((stepEffects, index) => {
        const stepNum = index + 1;
        const isActive = stepNum === window.player.currentStep;
        
        let effectsHtml = stepEffects.length === 0 ? 
            `<div class="text-xs text-gray-400 italic text-center w-full py-2">Chưa có hiệu ứng. Bấm nút 🪄 ở bảng trên để thêm.</div>` : "";
            
        stepEffects.forEach((eff, effIdx) => {
            let icon = "fa-eye";
            let color = "text-green-600";
            if (eff.type.includes("draw")) { icon="fa-pen-nib"; color="text-blue-600"; }
            if (eff.type === ("move")) { icon="fa-arrows-up-down-left-right"; color="text-purple-600"; }
            if (eff.type === ("fill")) { icon="fa-fill-drip"; color="text-red-600"; }
            
            let formatStr = `${eff.duration}ms`;
            if (eff.color) formatStr += `, ${eff.color}`;
            
            effectsHtml += `
                <div class="flex flex-col text-xs bg-gray-50 border border-gray-200 rounded p-2 mb-1 cursor-pointer hover:border-blue-400 group" 
                    draggable="true" 
                    ondragstart="window.handleDragStart(event, ${index}, ${effIdx})" 
                    ondragover="window.handleDragOver(event)" 
                    ondrop="window.handleDrop(event, ${index}, ${effIdx})"
                    onclick="window.openEffectEditor(${index}, ${effIdx})">
                    <div class="flex justify-between items-center">
                        <span class="font-mono text-gray-700 font-bold">${eff.target_id}</span>
                        <div class="flex gap-2 items-center">
                            <span class="${color} font-medium flex items-center gap-1"><i class="fa-solid ${icon}"></i> ${eff.type} (${formatStr})</span>
                            <button class="text-red-500 hover:text-red-700 hidden group-hover:block delete-eff-btn" data-step="${index}" data-eff="${effIdx}"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
        });

        const stepDiv = document.createElement('div');
        stepDiv.className = `step-container border rounded-md mb-4 shadow-sm overflow-hidden ${isActive ? 'bg-white border-blue-500 ring-1 ring-blue-500' : 'bg-gray-50 border-gray-300'}`;
        stepDiv.innerHTML = `
            <div class="px-3 py-1.5 border-b flex justify-between items-center cursor-pointer transition-colors ${isActive ? 'bg-blue-100 border-blue-300' : 'bg-gray-200 border-gray-300 hover:bg-gray-300'}" 
                 onclick="window.player.currentStep=${stepNum}; renderStepsUI();"
                 ondragover="window.handleDragOver(event)"
                 ondrop="window.handleStepDrop(event, ${index})">
                <span class="font-bold ${isActive ? 'text-blue-800' : 'text-gray-700'} text-sm">Step ${stepNum}</span>
                <span class="text-xs ${isActive ? 'text-blue-600' : 'text-gray-500'} bg-white px-1.5 py-0.5 rounded border border-gray-200">${stepEffects.length} effects</span>
            </div>
            <div class="p-2 min-h-[40px] flex flex-col">
                ${effectsHtml}
            </div>
        `;
        container.appendChild(stepDiv);
    });
}

// --- TIMELINE EDITING LOGIC --- //
window.draggedEffect = null;

window.handleDragStart = (e, stepIdx, effIdx) => {
    window.draggedEffect = { stepIdx, effIdx };
    e.dataTransfer.effectAllowed = 'move';
};

window.handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
};

window.handleDrop = (e, targetStepIdx, targetEffIdx) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.draggedEffect) return;
    const { stepIdx, effIdx } = window.draggedEffect;
    if (stepIdx === targetStepIdx && effIdx === targetEffIdx) return;
    
    const effect = window.player.steps[stepIdx].splice(effIdx, 1)[0];
    window.player.steps[targetStepIdx].splice(targetEffIdx, 0, effect);
    
    window.draggedEffect = null;
    renderStepsUI();
};

window.handleStepDrop = (e, targetStepIdx) => {
    e.preventDefault();
    if (!window.draggedEffect) return;
    const { stepIdx, effIdx } = window.draggedEffect;
    
    // Prevent trigger if it dropped on the effect item itself (handled by handleDrop)
    if (e.target.closest('.group')) return;

    const effect = window.player.steps[stepIdx].splice(effIdx, 1)[0];
    window.player.steps[targetStepIdx].push(effect);
    
    window.draggedEffect = null;
    renderStepsUI();
};

window.deleteEffect = (stepIdx, effIdx) => {
    if (confirm("Xóa hiệu ứng này?")) {
        window.player.steps[stepIdx].splice(effIdx, 1);
        renderStepsUI();
    }
};

window.openEffectEditor = (stepIdx, effIdx) => {
    const eff = window.player.steps[stepIdx][effIdx];
    document.getElementById('edit-step-idx').value = stepIdx;
    document.getElementById('edit-eff-idx').value = effIdx;
    document.getElementById('edit-duration').value = eff.duration || 1000;
    document.getElementById('edit-color').value = eff.color || '';
    document.getElementById('edit-params').value = eff.params ? JSON.stringify(eff.params) : '';
    document.getElementById('effect-editor-modal').classList.remove('hidden');
};

window.closeEffectEditor = () => {
    document.getElementById('effect-editor-modal').classList.add('hidden');
};

window.saveEffectParams = () => {
    const stepIdx = parseInt(document.getElementById('edit-step-idx').value);
    const effIdx = parseInt(document.getElementById('edit-eff-idx').value);
    const eff = window.player.steps[stepIdx][effIdx];
    
    eff.duration = parseInt(document.getElementById('edit-duration').value) || 1000;
    eff.color = document.getElementById('edit-color').value.trim();
    const paramsStr = document.getElementById('edit-params').value.trim();
    if (paramsStr) {
        try {
            eff.params = JSON.parse(paramsStr);
        } catch (e) {
            alert("Lỗi JSON Format");
            return;
        }
    } else {
        delete eff.params;
    }
    
    window.closeEffectEditor();
    renderStepsUI();
    
    // Auto jump so user can replay easily
    window.player.jumpToStep(stepIdx);
    window.player.currentStep = stepIdx + 1;
};

/**
 * MathAnimPlayer: Handles timeline, states, and SVG DOM manipulation
 */
class MathAnimPlayer {
    constructor(container) {
        this.container = container;
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("width", "100%");
        this.svg.setAttribute("height", "100%");
        this.svg.style.position = "absolute";
        this.svg.style.top = "0";
        this.svg.style.left = "0";
        
        this.container.innerHTML = "";
        this.container.appendChild(this.svg);
        
        // State
        this.visualObjects = [];
        this.frames = [];
        this.svgElements = {}; // Mapping visual_obj._id -> { dom, group }
        
        this.steps = []; // Array of Arrays of effects
        this.currentStep = -1;
        this.isPlaying = false;
        this.isStopRequested = false;
        this.animationFrameId = null;
        
        // Effect layers
        this.glowLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svg.appendChild(this.glowLayer);
    }

    transformX(mathX) { return this.container.clientWidth / 2 + mathX * SCALE; }
    transformY(mathY) { return this.container.clientHeight / 2 - mathY * SCALE; }

    init(visualObjects, frames, steps) {
        this.visualObjects = visualObjects;
        this.frames = frames;
        this.steps = steps || [];
        
        // Clear SVG but keep layers order
        this.svg.innerHTML = "";
        const mainLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.glowLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svg.appendChild(mainLayer);
        this.svg.appendChild(this.glowLayer);

        this.svgElements = {};
        const points0 = frames.length > 0 ? frames[0].points : {};
        const getPt = (name) => points0[name] || { x: 0, y: 0 };

        const parseOpts = (optStr) => {
            const attrs = { stroke: "#333", "stroke-width": "2", fill: "none" };
            if (!optStr) return attrs;
            if (optStr.includes("blue")) attrs.stroke = "#3b82f6";
            if (optStr.includes("red")) attrs.stroke = "#ef4444";
            if (optStr.includes("green")) attrs.stroke = "#22c55e";
            if (optStr.includes("black")) attrs.stroke = "#000000";
            if (optStr.includes("thick")) attrs["stroke-width"] = "3";
            if (optStr.includes("dashed")) attrs["stroke-dasharray"] = "5,5";
            return attrs;
        };

        // Instantiate elements hidden (opacity 0)
        this.visualObjects.forEach(obj => {
            let dom = null;
            let isText = false;
            let group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.style.opacity = "0"; // All hidden by default

            if (obj.type === "draw_circle") {
                const center = getPt(obj.center);
                let r = parseFloat(obj.radius) || 1;
                dom = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                dom.setAttribute("cx", this.transformX(center.x));
                dom.setAttribute("cy", this.transformY(center.y));
                dom.setAttribute("r", r * SCALE);
                const attrs = parseOpts(obj.options);
                for (let k in attrs) dom.setAttribute(k, attrs[k]);
                group.appendChild(dom);
            }
            else if (obj.type === "draw_lines") {
                const pts = obj.points.map(pName => getPt(pName));
                let d = "";
                pts.forEach((p, idx) => {
                    const mappedX = this.transformX(p.x);
                    const mappedY = this.transformY(p.y);
                    if (idx === 0) d += `M ${mappedX} ${mappedY} `;
                    else d += `L ${mappedX} ${mappedY} `;
                });
                if (obj.close_path) d += "Z";
                
                dom = document.createElementNS("http://www.w3.org/2000/svg", "path");
                dom.setAttribute("d", d);
                const attrs = parseOpts(obj.options);
                // default if not specified
                if (!attrs.fill && obj.close_path) attrs.fill = "none"; 
                for (let k in attrs) dom.setAttribute(k, attrs[k]);
                group.appendChild(dom);
            }
            else if (obj.type === "fill_node" || obj.type === "node_label" || obj.type === "draw_line_label") {
                // Complex objects treated as grouped
                this.updateComplexObject(obj, group, points0);
                dom = group; 
            }
            
            if (obj.type !== "fill_node" && obj.type !== "node_label" && obj.type !== "draw_line_label") {
                // simple elements cache
            }

            mainLayer.appendChild(group);
            this.svgElements[obj._id] = { dom: dom, group: group, obj: obj };
        });
    }

    addEffect(step, target_id, effect_type, duration) {
        if (step > 0 && step <= this.steps.length) {
            this.steps[step-1].push({ target_id, type: effect_type, duration });
        }
    }

    playStep(stepNum, onComplete) {
        if (this.isPlaying || stepNum < 1 || stepNum > this.steps.length) {
            if (onComplete) onComplete();
            return;
        }
        this.isPlaying = true;
        const effects = this.steps[stepNum-1];
        if (effects.length === 0) {
            this.isPlaying = false;
            if (onComplete) onComplete();
            return;
        }

        const startTime = performance.now();
        const maxDuration = Math.max(...effects.map(e => e.duration));

        effects.forEach(eff => this._initEffectState(eff));

        const animate = (time) => {
            if (this.isStopRequested) {
                this._finishStop(effects, onComplete);
                return;
            }

            const elapsed = time - startTime;
            let allDone = true;

            effects.forEach(eff => {
                let progress = Math.min(elapsed / eff.duration, 1.0);
                // easeInOutQuad
                let ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
                this._applyEffectTick(eff, ease);
                
                if (progress < 1.0) allDone = false;
            });

            if (!allDone) {
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.isPlaying = false;
                this.animationFrameId = null;
                effects.forEach(eff => this._cleanupEffect(eff));
                if (onComplete) onComplete();
            }
        };
        this.animationFrameId = requestAnimationFrame(animate);
    }

    stop() {
        if (this.isPlaying) {
            this.isStopRequested = true;
        }
    }

    _finishStop(effects, onComplete) {
        this.isPlaying = false;
        this.isStopRequested = false;
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
        
        effects.forEach(eff => this._cleanupEffect(eff));
        
        // Jump to current state to ensure valid visuals
        this.jumpToStep(this.currentStep);
        
        if (onComplete) onComplete();
    }

    jumpToStep(targetStep) {
        // Reset everything to hidden
        Object.values(this.svgElements).forEach(item => {
            if (item.group) item.group.style.opacity = "0";
            if (item.dom && item.dom.style) {
                item.dom.style.strokeDasharray = "none"; 
                item.dom.style.strokeDashoffset = "0";
            }
        });
        
        // Apply effects sequentially without animation
        for(let i=0; i<targetStep; i++) {
            const effects = this.steps[i];
            if (!effects) continue;
            effects.forEach(eff => {
                this._initEffectState(eff);
                this._applyEffectTick(eff, 1.0); // 100% progress
                this._cleanupEffect(eff);
            });
        }
        this.currentStep = targetStep;
    }

    _initEffectState(eff) {
        const item = this.svgElements[eff.target_id];
        if (!item) return;
        
        // Ensure element is visible if it's supposed to appear
        if (eff.type === "fade_in" || eff.type === "draw" || eff.type === "draw_light" || eff.type === "draw_dashed_light") {
            item.group.style.opacity = "1";
        }
        
        if (eff.type.includes("draw") && item.dom && item.dom.getTotalLength) {
            // Overdraw by 5 pixels to close the gap in circles or polygons
            const baseLen = item.dom.getTotalLength();
            const len = baseLen + 5; 
            eff.length = len;
            item.dom.style.strokeDasharray = len;
            item.dom.style.strokeDashoffset = len; // Hide initially
            
            if (eff.type === "draw_dashed_light") {
                item.dom.style.strokeDasharray = (eff.params && eff.params.dashed) ? eff.params.dashed : "5,10";
            }
            if (eff.type === "draw_light" || eff.type === "draw_dashed_light") {
                const spark = document.createElementNS("http://www.w3.org/2000/svg", "g");
                const coreColor = eff.color || (eff.type === "draw_dashed_light" ? "#f97316" : "#eab308");
                
                const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                glow.setAttribute("r", "8");
                glow.setAttribute("fill", coreColor);
                glow.setAttribute("opacity", "0.4");
                glow.setAttribute("filter", "drop-shadow(0 0 6px " + coreColor + ")");
                
                const core = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                core.setAttribute("r", "4");
                core.setAttribute("fill", "#ffffff");

                spark.appendChild(glow);
                spark.appendChild(core);
                this.glowLayer.appendChild(spark);
                eff.spark = spark;
                eff.sparkCoreConfig = { color: coreColor };
            }
        }

        if (eff.type === "fade_in" || eff.type === "fill") {
            item.group.style.opacity = "0";
        }
    }

    _applyEffectTick(eff, progress) {
        const item = this.svgElements[eff.target_id];
        if (!item) return;

        if (eff.type === "fade_in") {
            item.group.style.opacity = progress.toString();
        }
        else if (eff.type === "fill") {
            // Apply fill color from param
            const fillColor = eff.color || "rgba(169, 177, 214, 0.5)"; // Default from reference
            let opacity = 1.0;
            if (eff.params && eff.params.opacity) opacity = parseFloat(eff.params.opacity);
            item.group.style.opacity = (progress * opacity).toString();
            
            // if it's a circle or something we might need to set fill
            if (item.dom) {
                // To preserve stroke vs fill
                if (!item.dom.getAttribute('data-origin-fill')) {
                    item.dom.setAttribute('data-origin-fill', item.dom.getAttribute('fill') || 'none');
                }
                item.dom.setAttribute("fill", fillColor);
            }
        }
        else if (eff.type.includes("draw") && item.dom && item.dom.getTotalLength) {
            
            // Apply color if requested
            if (eff.color) item.dom.style.stroke = eff.color;

            if (eff.type === "draw") {
                item.dom.style.strokeDashoffset = eff.length * (1 - progress);
            } else if (eff.type === "draw_light" || eff.type === "draw_dashed_light") {
                if (eff.type === "draw_light") {
                    item.dom.style.strokeDasharray = eff.length;
                    item.dom.style.strokeDashoffset = eff.length * (1 - progress);
                } else {
                    let dashParams = (eff.params && eff.params.dashed) ? eff.params.dashed : "5,10";
                    item.dom.style.strokeDasharray = dashParams;
                    item.dom.style.strokeDashoffset = eff.length * (1 - progress); 
                }
                
                if (eff.spark) {
                    const pt = item.dom.getPointAtLength(eff.length * progress);
                    eff.spark.setAttribute("transform", `translate(${pt.x}, ${pt.y})`);
                    
                    // Allow custom spark color
                    if (eff.color && eff.color !== eff.sparkCoreConfig.color) {
                        eff.spark.firstChild.setAttribute("fill", eff.color);
                        eff.spark.firstChild.setAttribute("filter", "drop-shadow(0 0 6px " + eff.color + ")");
                        eff.sparkCoreConfig.color = eff.color;
                    }
                }
            }
        }
        else if (eff.type === "move" && this.frames.length > 0) {
            // progress 0->1 mapped to frame index
            const fIndex = Math.min(Math.floor(progress * this.frames.length), this.frames.length - 1);
            const pts = this.frames[fIndex].points;
            
            // Rebuild/Update attributes based on obj type
            if (item.obj.type === "draw_circle") {
                const c = pts[item.obj.center] || {x:0, y:0};
                item.dom.setAttribute("cx", this.transformX(c.x));
                item.dom.setAttribute("cy", this.transformY(c.y));
            }
            else if (item.obj.type === "draw_lines") {
                const mappedPts = item.obj.points.map(pName => pts[pName] || {x:0, y:0});
                let d = "";
                mappedPts.forEach((p, idx) => {
                    const mappedX = this.transformX(p.x);
                    const mappedY = this.transformY(p.y);
                    if (idx === 0) d += `M ${mappedX} ${mappedY} `;
                    else d += `L ${mappedX} ${mappedY} `;
                });
                if (item.obj.close_path) d += "Z";
                item.dom.setAttribute("d", d);
            }
            else {
                // Complex objects -> clear group and update
                this.updateComplexObject(item.obj, item.group, pts);
            }
        }
    }

    _cleanupEffect(eff) {
        const item = this.svgElements[eff.target_id];
        if (!item) return;

        if (eff.type === "draw_dashed_light") {
            // Turn solid after done
            let makeSolid = true;
            if (eff.params && eff.params.keepDashed) makeSolid = false;
            if (makeSolid && item.dom) item.dom.style.strokeDasharray = "none";
        }
        if (eff.spark) {
            eff.spark.remove();
        }
    }

    updateComplexObject(obj, group, points) {
        group.innerHTML = "";
        const getPt = (name) => points[name] || { x: 0, y: 0 };
        const parseOpts = (optStr) => {
            const attrs = { stroke: "#333", "stroke-width": "2", fill: "none" };
            if (!optStr) return attrs;
            if (optStr.includes("blue")) attrs.stroke = "#3b82f6";
            if (optStr.includes("red")) attrs.stroke = "#ef4444";
            if (optStr.includes("green")) attrs.stroke = "#22c55e";
            if (optStr.includes("thick")) attrs["stroke-width"] = "3";
            return attrs;
        };

        if (obj.type === "fill_node") {
            const pt = getPt(obj.point);
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", this.transformX(pt.x));
            dot.setAttribute("cy", this.transformY(pt.y));
            dot.setAttribute("r", "4");
            const fillAttrs = parseOpts(obj.fill_options);
            dot.setAttribute("fill", fillAttrs.stroke || "#333");
            group.appendChild(dot);
            this._addTextNode(group, pt, obj.label, obj.node_options);
        }
        else if (obj.type === "node_label") {
            this._addTextNode(group, getPt(obj.at), obj.label, obj.options);
        }
        else if (obj.type === "draw_line_label") {
            const p1 = getPt(obj.p1); const p2 = getPt(obj.p2);
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", this.transformX(p1.x)); line.setAttribute("y1", this.transformY(p1.y));
            line.setAttribute("x2", this.transformX(p2.x)); line.setAttribute("y2", this.transformY(p2.y));
            const attrs = parseOpts(obj.options);
            for (let k in attrs) line.setAttribute(k, attrs[k]);
            group.appendChild(line);
            const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2;
            this._addTextNode(group, {x: midX, y: midY}, obj.label, obj.node_options);
        }
    }

    _addTextNode(group, pt, text, node_options) {
        const cleanText = text.replace(/\$/g, "");
        const svgText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        let tx = this.transformX(pt.x); let ty = this.transformY(pt.y);
        let dx = 0; let dy = 0; let anchor = "middle"; let baseline = "middle";
        if (node_options) {
            if (node_options.includes("above")) { dy = -15; baseline = "baseline"; }
            if (node_options.includes("below")) { dy = 15; baseline = "hanging"; }
            if (node_options.includes("right")) { dx = 15; anchor = "start"; }
            if (node_options.includes("left")) { dx = -15; anchor = "end"; }
        }
        svgText.setAttribute("x", tx + dx); svgText.setAttribute("y", ty + dy);
        svgText.setAttribute("text-anchor", anchor); svgText.setAttribute("dominant-baseline", baseline);
        svgText.setAttribute("font-family", "serif"); svgText.setAttribute("font-style", "italic");
        svgText.setAttribute("font-size", "16px"); svgText.setAttribute("fill", "#000");
        svgText.textContent = cleanText;
        group.appendChild(svgText);
    }
}
