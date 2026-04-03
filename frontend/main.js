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
    
    // Canvas Mode State
    window.canvasMode = { dark: false };
    
    // Globals for UI integration
    window.player = new MathAnimPlayer(document.getElementById("canvas-container"));
    window.visualObjects = [];
    window.frames = [];

    // Default code to initial view
    runCode(tikzInput.value);

    btnRun.addEventListener("click", () => {
        runCode(tikzInput.value);
    });

    // Dark Mode Toggle
    const btnDark = document.getElementById("btn-dark-mode");
    if (btnDark) {
        btnDark.addEventListener("click", () => {
            window.canvasMode.dark = !window.canvasMode.dark;
            applyDarkMode();
            if (window.player && window.player.steps.length > 0) {
                window.player.jumpToStep(window.player.currentStep);
            }
        });
    }

    // Reset View Button
    const btnResetView = document.getElementById("btn-reset-view");
    if (btnResetView) {
        btnResetView.addEventListener("click", () => {
            if (window.player) {
                window.player.resetView();
            }
        });
    }

    const btnCancelExport = document.getElementById("btn-cancel-export");
    if (btnCancelExport) {
        btnCancelExport.addEventListener("click", closeExportModal);
    }
    const btnConfirmExport = document.getElementById("btn-confirm-export");
    if (btnConfirmExport) {
        btnConfirmExport.addEventListener("click", confirmExport);
    }

    const btnCancelEffect = document.getElementById("btn-cancel-effect");
    if (btnCancelEffect) {
        btnCancelEffect.addEventListener("click", closeEffectEditor);
    }
    const btnSaveEffect = document.getElementById("btn-save-effect");
    if (btnSaveEffect) {
        btnSaveEffect.addEventListener("click", saveEffectParams);
    }

    const btnExportAuto = document.getElementById("btn-export-auto");
    if (btnExportAuto) {
        btnExportAuto.addEventListener("click", () => openExportModal(true));
    }
    const btnExport = document.getElementById("btn-export-html");
    if (btnExport) {
        btnExport.addEventListener("click", () => openExportModal(false));
    }
    const btnRefresh = document.getElementById("btn-refresh-canvas");
    if (btnRefresh) {
        btnRefresh.addEventListener("click", () => {
            // Chỉ reset canvas preview, giữ nguyên timeline + effects
            window.player.isPlaying = false;
            window.player.isStopRequested = false;
            if (window.player.animationFrameId) cancelAnimationFrame(window.player.animationFrameId);
            // Re-run code để vẽ lại canvas với timeline hiện tại
            runCode(tikzInput.value);
        });
    }

    initStepUI();
});

function applyDarkMode() {
    const container = document.getElementById("canvas-container");
    const btnDark = document.getElementById("btn-dark-mode");
    if (!container) return;
    
    const isDark = window.canvasMode.dark;
    
    container.style.backgroundColor = isDark ? '#0a0a0a' : '#fff';
    container.style.outlineColor = isDark ? '#333' : '';
    container.classList.toggle('bg-black', isDark);
    container.classList.toggle('bg-white', !isDark);
    
    if (btnDark) {
        btnDark.innerHTML = isDark 
            ? '<i class="fa-solid fa-sun"></i> Light' 
            : '<i class="fa-solid fa-moon"></i> Dark';
        btnDark.classList.toggle('text-yellow-400', isDark);
        btnDark.classList.toggle('hover:text-yellow-300', isDark);
        btnDark.classList.toggle('text-gray-500', !isDark);
        btnDark.classList.toggle('hover:text-gray-800', !isDark);
    }
    
    if (window.player) {
        window.player.darkMode = isDark;
        if (window.player.svgElements) {
            Object.values(window.player.svgElements).forEach(item => {
                if (item.dom) {
                    const currentStroke = item.dom.getAttribute('stroke');
                    const newStroke = window.player.mapStrokeForDarkMode(currentStroke, isDark);
                    item.dom.setAttribute('stroke', newStroke);
                    
                    const currentFill = item.dom.getAttribute('fill');
                    if (currentFill && currentFill !== 'none') {
                        const newFill = window.player.mapFillForDarkMode(currentFill, isDark);
                        item.dom.setAttribute('fill', newFill);
                    }
                }
                if (item.group) {
                    item.group.querySelectorAll('text').forEach(t => {
                        t.setAttribute('fill', isDark ? '#f0f0f0' : '#1a1a1a');
                    });
                }
            });
        }
    }
}

let pendingExport = null;

function openExportModal(isAutoPlay) {
    if (!window.visualObjects || window.visualObjects.length === 0) {
        alert("Please run code and generate animation first!");
        return;
    }
    pendingExport = { isAutoPlay };
    document.getElementById('export-config-modal').classList.remove('hidden');
}

function closeExportModal() {
    document.getElementById('export-config-modal').classList.add('hidden');
    pendingExport = null;
}

function confirmExport() {
    if (!pendingExport) return;
    
    const isAutoPlay = pendingExport.isAutoPlay;
    const bg = document.querySelector('input[name="export-bg"]:checked').value;
    const aspectRatio = document.getElementById('export-aspect-ratio').value;
    const frameStyle = document.getElementById('export-frame-style').value;
    const showGrid = document.getElementById('export-grid').checked;
    
    closeExportModal();
    exportToStandaloneHTML(isAutoPlay, { bg, aspectRatio, frameStyle, showGrid });
}

async function exportToStandaloneHTML(isAutoPlay = false, options = {}) {
    const { bg = 'white', frameStyle = 'none', showGrid = true, aspectRatio = 'free' } = options;

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

        const bgColors = {
            white: { body: '#ffffff', canvas: '#ffffff', gridDots: '#e5e7eb' },
            black: { body: '#0a0a0a', canvas: '#0a0a0a', gridDots: '#333333' },
            current: window.canvasMode.dark 
                ? { body: '#0a0a0a', canvas: '#0a0a0a', gridDots: '#333333' }
                : { body: '#f8fafc', canvas: '#ffffff', gridDots: '#e5e7eb' }
        };
        const colors = bgColors[bg] || bgColors.white;

        const frameCSS = {
            none: '',
            thin: 'border: 1px solid #ccc;',
            thick: 'border: 3px solid #888;',
            rounded: 'border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);',
            shadow: 'box-shadow: 0 8px 40px rgba(0,0,0,0.25);'
        };

        const aspectCSS = {
            '16:9': 'aspect-ratio: 16/9; max-width: 90%; max-height: 90%; margin: auto;',
            '9:16': 'aspect-ratio: 9/16; max-height: 90%; margin: auto;',
            '1:1': 'aspect-ratio: 1/1; max-width: 70%; max-height: 90%; margin: auto;'
        };

        const gridCSS = showGrid ? `
            #canvas-container::before {
                content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background-image: radial-gradient(${colors.gridDots} 1px, transparent 1px);
                background-size: 50px 50px; background-position: center; pointer-events: none; opacity: 0.5;
            }` : '';

        const styleCSS = isAutoPlay ? `
            body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background-color: ${colors.body}; display: flex; align-items: center; justify-content: center; }
            #canvas-container { width: 100%; height: 100%; position: relative; background: ${colors.canvas}; ${frameCSS[frameStyle]} ${aspectCSS[aspectRatio]} }
            ${gridCSS}
        ` : `
            body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background-color: ${colors.body}; }
            #canvas-container { width: 100%; height: calc(100% - 60px); position: relative; background: ${colors.canvas}; ${frameCSS[frameStyle]} ${aspectCSS[aspectRatio]} }
            ${gridCSS}
            #controls { height: 60px; display: flex; align-items: center; justify-content: center; background: #1e293b; color: white; gap: 20px; box-shadow: 0 -2px 10px rgba(0,0,0,0.1); z-index: 10; position: relative;}
        `;
        
        const controlsHTML = isAutoPlay ? '' : `
    <div id="controls">
        <button id="btn-prev" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"><i class="fa-solid fa-backward-step"></i> Prev</button>
        <div id="step-indicator" class="font-mono text-lg font-bold min-w-[80px] text-center">Step 0</div>
        <button id="btn-play" class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold transition flex items-center gap-2"><i class="fa-solid fa-play"></i> Play</button>
        <button id="btn-next" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"><i class="fa-solid fa-forward-step"></i> Next</button>
    </div>`;

        const isDarkExport = bg === 'black' || (bg === 'current' && window.canvasMode.dark);

        const initScript = isAutoPlay ? `
            player.jumpToStep(0);
            
            const startAutoPlay = () => {
                const playNext = () => {
                    if (player.currentStep < parsedData.steps.length) {
                        player.currentStep++;
                        player.playStep(player.currentStep, () => {
                            setTimeout(playNext, 1000);
                        });
                    }
                };
                setTimeout(playNext, 1000);
            };
            startAutoPlay();
        ` : `
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
            player.darkMode = ${isDarkExport ? 'true' : 'false'};
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

        // Tự động đọc @param từ code TikZ
        let paramConfig = { param_name: "t", t_min: 0, t_max: 1, total_frames: 60 };
        const paramMatch = code.match(/@param:\s*\{([^}]+)\}/);
        if (paramMatch) {
            const params = paramMatch[1];
            const nameMatch = params.match(/name:\s*(\w+)/);
            const minMatch = params.match(/min:\s*([\d.]+)/);
            const maxMatch = params.match(/max:\s*([\d.]+)/);
            const framesMatch = params.match(/frames:\s*(\d+)/);
            if (nameMatch) paramConfig.param_name = nameMatch[1];
            if (minMatch) paramConfig.t_min = parseFloat(minMatch[1]);
            if (maxMatch) paramConfig.t_max = parseFloat(maxMatch[1]);
            if (framesMatch) paramConfig.total_frames = parseInt(framesMatch[1]);
        }

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                code: code,
                param_name: paramConfig.param_name,
                t_min: paramConfig.t_min,
                t_max: paramConfig.t_max,
                total_frames: paramConfig.total_frames
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
                <option value="time_shift" ${defaultType==='time_shift'?'selected':''}>Time Shift (Move)</option>
                <option value="change_style" ${defaultType==='change_style'?'selected':''}>Change Style</option>
            </select>
        </div>
        
        <div class="mb-2">
            <label class="block text-xs font-bold text-gray-700 mb-1">Duration (ms)</label>
            <input type="number" id="prop-duration" class="w-full text-sm border border-gray-300 rounded px-2 py-1" value="1000" step="100">
        </div>

        <div id="prop-dynamic-options"></div>

        <button onclick="window.addEffectFromProps()" class="w-full bg-blue-600 hover:bg-blue-500 text-white rounded py-1.5 text-sm font-bold shadow-sm transition mt-3">
            <i class="fa-solid fa-plus"></i> Add to Step
        </button>
    `;
    
    // Render dynamic options and bind change event
    window.renderPropDynamicOptions(defaultType);
    document.getElementById('prop-effect').addEventListener('change', (e) => {
        window.renderPropDynamicOptions(e.target.value);
    });
};

window.renderPropDynamicOptions = (effectType) => {
    const container = document.getElementById('prop-dynamic-options');
    if (!container) return;
    
    let html = '';
    if (effectType === 'draw' || effectType === 'draw_light' || effectType === 'draw_dashed_light') {
        html = `
            <div class="mb-2">
                <label class="block text-xs font-bold text-gray-700 mb-1">Stroke Color</label>
                <div class="flex gap-2">
                    <input type="color" id="prop-color-picker" value="#333333" class="w-8 h-8 rounded cursor-pointer border border-gray-300">
                    <input type="text" id="prop-color" class="flex-1 text-sm border border-gray-300 rounded px-2 py-1" placeholder="#ff0000, red, blue...">
                </div>
            </div>
            <div class="mb-2">
                <label class="block text-xs font-bold text-gray-700 mb-1">Stroke Width</label>
                <select id="prop-stroke-width" class="w-full text-sm border border-gray-300 bg-white rounded px-2 py-1">
                    <option value="">Mặc định</option>
                    <option value="1">1px (mỏng)</option>
                    <option value="2">2px (thường)</option>
                    <option value="3">3px (dày)</option>
                    <option value="4">4px (rất dày)</option>
                </select>
            </div>
            ${effectType === 'draw_dashed_light' ? `
            <div class="mb-2">
                <label class="block text-xs font-bold text-gray-700 mb-1">Dash Pattern</label>
                <input type="text" id="prop-dashed" class="w-full text-sm font-mono border border-gray-300 rounded px-2 py-1" placeholder="5,10" value="5,10">
                <p class="text-[10px] text-gray-400 mt-0.5">Format: dash,gap (ví dụ: 5,10)</p>
            </div>` : ''}
        `;
    } else if (effectType === 'fill') {
        html = `
            <div class="mb-2">
                <label class="block text-xs font-bold text-gray-700 mb-1">Fill Color</label>
                <div class="flex gap-2">
                    <input type="color" id="prop-fill-color-picker" value="#a9b1d6" class="w-8 h-8 rounded cursor-pointer border border-gray-300">
                    <input type="text" id="prop-color" class="flex-1 text-sm border border-gray-300 rounded px-2 py-1" placeholder="#a9b1d6, red, rgba...">
                </div>
            </div>
            <div class="mb-2">
                <label class="block text-xs font-bold text-gray-700 mb-1">Opacity</label>
                <input type="range" id="prop-fill-opacity" min="0" max="1" step="0.05" value="0.5" class="w-full">
                <div class="flex justify-between text-[10px] text-gray-400">
                    <span>0%</span>
                    <span id="prop-opacity-value">50%</span>
                    <span>100%</span>
                </div>
            </div>
        `;
    } else if (effectType === 'time_shift') {
        html = `
            <div class="mb-2 p-2 bg-blue-50 rounded border border-blue-200">
                <p class="text-[10px] text-blue-600"><i class="fa-solid fa-info-circle mr-1"></i>Time Shift di chuyển tất cả đối tượng theo frames đã bake từ backend. Không cần cấu hình thêm.</p>
            </div>
        `;
    } else if (effectType === 'fade_in') {
        html = `
            <div class="mb-2">
                <label class="block text-xs font-bold text-gray-700 mb-1">Fade Color</label>
                <div class="flex gap-2">
                    <input type="color" id="prop-color-picker" value="#ffffff" class="w-8 h-8 rounded cursor-pointer border border-gray-300">
                    <input type="text" id="prop-color" class="flex-1 text-sm border border-gray-300 rounded px-2 py-1" placeholder="#ff0000, red...">
                </div>
            </div>
        `;
    } else if (effectType === 'change_style') {
        html = `
            <div class="mb-2">
                <label class="block text-xs font-bold text-gray-700 mb-1">New Stroke Color</label>
                <div class="flex gap-2">
                    <input type="color" id="prop-color-picker" value="#333333" class="w-8 h-8 rounded cursor-pointer border border-gray-300">
                    <input type="text" id="prop-color" class="flex-1 text-sm border border-gray-300 rounded px-2 py-1" placeholder="#ff0000, red...">
                </div>
            </div>
            <div class="mb-2">
                <label class="block text-xs font-bold text-gray-700 mb-1">New Stroke Width</label>
                <select id="prop-stroke-width" class="w-full text-sm border border-gray-300 bg-white rounded px-2 py-1">
                    <option value="">Giữ nguyên</option>
                    <option value="1">1px</option>
                    <option value="2">2px</option>
                    <option value="3">3px</option>
                    <option value="4">4px</option>
                </select>
            </div>
            <div class="mb-2">
                <label class="block text-xs font-bold text-gray-700 mb-1">Dash Pattern (optional)</label>
                <input type="text" id="prop-dashed" class="w-full text-sm font-mono border border-gray-300 rounded px-2 py-1" placeholder="5,5 hoặc none">
            </div>
            <div class="mb-2">
                <label class="block text-xs font-bold text-gray-700 mb-1">Fill Color (optional)</label>
                <input type="text" id="prop-fill-color" class="w-full text-sm border border-gray-300 rounded px-2 py-1" placeholder="red, rgba(255,0,0,0.5)...">
            </div>
        `;
    } else {
        html = `
            <div class="mb-2">
                <label class="block text-xs font-bold text-gray-700 mb-1">Color (optional)</label>
                <input type="text" id="prop-color" class="w-full text-sm border border-gray-300 rounded px-2 py-1" placeholder="#ff0000, red...">
            </div>
        `;
    }
    container.innerHTML = html;
    
    // Bind opacity slider
    const opacitySlider = document.getElementById('prop-fill-opacity');
    const opacityValue = document.getElementById('prop-opacity-value');
    if (opacitySlider && opacityValue) {
        opacitySlider.addEventListener('input', () => {
            opacityValue.textContent = Math.round(opacitySlider.value * 100) + '%';
        });
    }
    
    // Bind color picker sync
    const colorPicker = document.getElementById('prop-color-picker');
    const colorInput = document.getElementById('prop-color');
    if (colorPicker && colorInput) {
        colorPicker.addEventListener('input', () => { colorInput.value = colorPicker.value; });
        colorInput.addEventListener('input', () => { 
            if (/^#[0-9a-fA-F]{6}$/.test(colorInput.value)) colorPicker.value = colorInput.value; 
        });
    }
    
    const fillColorPicker = document.getElementById('prop-fill-color-picker');
    const fillColorInput = document.getElementById('prop-color');
    if (fillColorPicker && fillColorInput) {
        fillColorPicker.addEventListener('input', () => { fillColorInput.value = fillColorPicker.value; });
        fillColorInput.addEventListener('input', () => { 
            if (/^#[0-9a-fA-F]{6}$/.test(fillColorInput.value)) fillColorPicker.value = fillColorInput.value; 
        });
    }
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
    
    // Collect params from dynamic UI
    let params = {};
    let color = undefined;
    
    if (effType === 'draw' || effType === 'draw_light' || effType === 'draw_dashed_light' || effType === 'change_style') {
        color = document.getElementById("prop-color")?.value.trim() || undefined;
        const sw = document.getElementById("prop-stroke-width")?.value;
        if (sw) params.strokeWidth = sw;
        const dashed = document.getElementById("prop-dashed")?.value.trim();
        if (dashed && dashed !== 'none') params.dashed = dashed;
        if (effType === 'change_style') {
            const fillC = document.getElementById("prop-fill-color")?.value.trim();
            if (fillC) params.fill = fillC;
        }
    } else if (effType === 'fill') {
        color = document.getElementById("prop-color")?.value.trim() || "rgba(169, 177, 214, 0.5)";
        const opacity = document.getElementById("prop-fill-opacity")?.value;
        if (opacity) params.opacity = parseFloat(opacity);
    }
    
    // Remove empty params
    if (Object.keys(params).length === 0) params = undefined;
    
    const objId = window.selectedOutlinerObj._id;
    window.player.steps[currentStep - 1].push({
        target_id: objId,
        type: effType,
        duration: duration,
        color: color,
        params: params
    });
    
    renderStepsUI();
};

function initStepUI() {

    // Step Managers
    document.getElementById('btn-auto-assign').addEventListener('click', () => {
        if (!window.visualObjects || window.visualObjects.length === 0) {
            alert("Vui lòng Run Code trước để tạo các đối tượng.");
            return;
        }
        
        // Quay lại logic mỗi object 1 step (tuần tự)
        window.player.steps = [];
        window.player.currentStep = 0;
        
        window.visualObjects.forEach((obj) => {
            let effectType = "fade_in";
            let duration = 800;
            
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
            
            window.player.steps.push([{
                target_id: obj._id,
                type: effectType,
                duration: duration
            }]);
        });
        
        if (window.player.steps.length > 0) window.player.currentStep = 1;
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

    const timelineContainer = document.getElementById('timeline-steps');
    if (timelineContainer) {
        // Chặn drag khi nhấn vào nút delete
        timelineContainer.addEventListener('mousedown', (e) => {
            const btnDel = e.target.closest('[data-action="delete-eff"], [data-action="delete-step"]');
            if (btnDel) {
                e.preventDefault(); // Chặn dragstart
            }
        });

        // Router tập trung duy nhất cho mọi hành động trên Timeline
        timelineContainer.addEventListener('click', (e) => {
            
            // 1. Kiểm tra nút Xóa Effect (Ưu tiên cao nhất)
            const btnDelEff = e.target.closest('[data-action="delete-eff"]');
            if (btnDelEff) {
                e.stopPropagation(); // Chặn sủi bọt ngay lập tức
                const stepIdx = parseInt(btnDelEff.dataset.step);
                const effIdx = parseInt(btnDelEff.dataset.eff);
                window.deleteEffect(stepIdx, effIdx);
                return;
            }

            // 2. Kiểm tra nút Xóa Step
            const btnDelStep = e.target.closest('[data-action="delete-step"]');
            if (btnDelStep) {
                e.stopPropagation();
                const stepIdx = parseInt(btnDelStep.dataset.step);
                window.deleteStep(stepIdx);
                return;
            }

            // 3. Kiểm tra mở Editor (Click vào khung hiệu ứng)
            const effItem = e.target.closest('[data-action="edit-eff"]');
            if (effItem) {
                const stepIdx = parseInt(effItem.dataset.step);
                const effIdx = parseInt(effItem.dataset.eff);
                window.openEffectEditor(stepIdx, effIdx);
                return;
            }

            // 4. Kiểm tra chọn Step (Click vào Header)
            const stepHeader = e.target.closest('[data-action="select-step"]');
            if (stepHeader) {
                const stepIdx = parseInt(stepHeader.dataset.step);
                window.player.currentStep = stepIdx + 1;
                renderStepsUI();
                return;
            }
        });
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
            if (eff.type === "time_shift") { icon="fa-arrows-up-down-left-right"; color="text-purple-600"; }
            if (eff.type === ("fill")) { icon="fa-fill-drip"; color="text-red-600"; }
            
            let formatStr = `${eff.duration}ms`;
            if (eff.color) formatStr += `, ${eff.color}`;
            
            effectsHtml += `
                <div class="flex flex-col text-xs bg-gray-50 border border-gray-200 rounded p-2 mb-1 cursor-pointer hover:border-blue-400 group effect-item" 
                    draggable="true" 
                    data-action="edit-eff" data-step="${index}" data-eff="${effIdx}"
                    ondragstart="window.handleDragStart(event, ${index}, ${effIdx})" 
                    ondragend="window.handleDragEnd(event)"
                    ondragover="window.handleDragOver(event)" 
                    ondragleave="window.handleDragLeave(event)"
                    ondrop="window.handleDrop(event, ${index}, ${effIdx})">
                    <div class="flex justify-between items-center pointer-events-none">
                        <span class="font-mono text-gray-700 font-bold">${eff.target_id}</span>
                        <div class="flex gap-2 items-center">
                            <span class="${color} font-medium flex items-center gap-1"><i class="fa-solid ${icon}"></i> ${eff.type} (${formatStr})</span>
                        </div>
                    </div>
                    <div class="flex justify-end mt-1">
                        <button class="text-red-500 hover:text-red-700 hidden group-hover:block pointer-events-auto" 
                                data-action="delete-eff" data-step="${index}" data-eff="${effIdx}" 
                                title="Xóa hiệu ứng này" draggable="false">
                            <i class="fa-solid fa-trash" draggable="false"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        const stepDiv = document.createElement('div');
        stepDiv.className = `step-container border rounded-md mb-4 shadow-sm overflow-hidden ${isActive ? 'bg-white border-blue-500 ring-1 ring-blue-500' : 'bg-gray-50 border-gray-300'}`;
        stepDiv.innerHTML = `
            <div class="px-3 py-1.5 border-b flex justify-between items-center cursor-pointer transition-colors step-header ${isActive ? 'bg-blue-100 border-blue-300' : 'bg-gray-200 border-gray-300 hover:bg-gray-300'}" 
                 data-action="select-step" data-step="${index}"
                 ondragover="window.handleDragOver(event)"
                 ondragleave="window.handleDragLeave(event)"
                 ondrop="window.handleStepDrop(event, ${index})">
                <div class="flex items-center gap-2 pointer-events-none">
                    <span class="font-bold ${isActive ? 'text-blue-800' : 'text-gray-700'} text-sm">Step ${stepNum}</span>
                    <div class="flex gap-2 items-center">
                        <span class="text-xs ${isActive ? 'text-blue-600' : 'text-gray-500'} bg-white px-1.5 py-0.5 rounded border border-gray-200">${stepEffects.length} effects</span>
                    </div>
                </div>
                <button class="text-red-400 hover:text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded transition pointer-events-auto" 
                        data-action="delete-step" data-step="${index}" 
                        title="Xóa toàn bộ Step này" draggable="false">
                    <i class="fa-solid fa-trash-can" draggable="false"></i>
                </button>
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
    e.target.style.opacity = '0.4';
};

window.handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const stepContainer = e.target.closest('.step-container');
    if (stepContainer) {
        stepContainer.classList.add('ring-2', 'ring-blue-400', 'bg-blue-50');
    }
};

window.handleDragLeave = (e) => {
    const stepContainer = e.target.closest('.step-container');
    if (stepContainer) {
        stepContainer.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-50');
    }
};

window.handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    document.querySelectorAll('.step-container').forEach(sc => {
        sc.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-50');
    });
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
        // Ép SVG cập nhật lại ngay lập tức (Hard Reset)
        window.player.jumpToStep(window.player.currentStep);
    }
};

window.deleteStep = (stepIdx) => {
    if (confirm(`Xóa toàn bộ Step ${stepIdx + 1}?`)) {
        window.player.steps.splice(stepIdx, 1);
        
        // Điều chỉnh lại currentStep nếu nó vượt quá giới hạn
        if (window.player.currentStep > window.player.steps.length) {
            window.player.currentStep = window.player.steps.length;
        }
        if (window.player.currentStep < 0) window.player.currentStep = 0;
        
        renderStepsUI();
        // Ép SVG cập nhật lại ngay lập tức (Hard Reset)
        window.player.jumpToStep(window.player.currentStep);
    }
};

window.openEffectEditor = (stepIdx, effIdx) => {
    const eff = window.player.steps[stepIdx][effIdx];
    document.getElementById('edit-step-idx').value = stepIdx;
    document.getElementById('edit-eff-idx').value = effIdx;
    document.getElementById('edit-duration').value = eff.duration || 1000;
    document.getElementById('edit-effect-type').value = eff.type || 'fade_in';
    document.getElementById('modal-title').textContent = `Edit Effect: ${eff.target_id}`;
    
    // Render dynamic options
    window.renderEditDynamicOptions(eff.type || 'fade_in', eff);
    
    document.getElementById('effect-editor-modal').classList.remove('hidden');
    
    // Bind effect type change
    document.getElementById('edit-effect-type').onchange = (e) => {
        window.renderEditDynamicOptions(e.target.value, eff);
    };
};

window.renderEditDynamicOptions = (effectType, eff) => {
    const container = document.getElementById('edit-dynamic-options');
    const params = eff.params || {};
    let html = '';
    
    if (effectType === 'draw' || effectType === 'draw_light' || effectType === 'draw_dashed_light') {
        const colorVal = eff.color || '#333333';
        html = `
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-700 mb-1">Stroke Color</label>
                <div class="flex gap-2">
                    <input type="color" id="edit-color-picker" value="${colorVal}" class="w-8 h-8 rounded cursor-pointer border border-gray-300">
                    <input type="text" id="edit-color" class="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5" value="${eff.color || ''}" placeholder="#ff0000, red...">
                </div>
            </div>
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-700 mb-1">Stroke Width</label>
                <select id="edit-stroke-width" class="w-full text-sm border border-gray-300 bg-white rounded px-2 py-1.5">
                    <option value="">Mặc định</option>
                    <option value="1" ${params.strokeWidth==='1'?'selected':''}>1px (mỏng)</option>
                    <option value="2" ${params.strokeWidth==='2'?'selected':''}>2px (thường)</option>
                    <option value="3" ${params.strokeWidth==='3'?'selected':''}>3px (dày)</option>
                    <option value="4" ${params.strokeWidth==='4'?'selected':''}>4px (rất dày)</option>
                </select>
            </div>
            ${effectType === 'draw_dashed_light' ? `
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-700 mb-1">Dash Pattern</label>
                <input type="text" id="edit-dashed" class="w-full text-sm font-mono border border-gray-300 rounded px-2 py-1.5" placeholder="5,10" value="${params.dashed || '5,10'}">
            </div>` : ''}
        `;
    } else if (effectType === 'fill') {
        const colorVal = eff.color || '#a9b1d6';
        const opacityVal = params.opacity || 0.5;
        html = `
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-700 mb-1">Fill Color</label>
                <div class="flex gap-2">
                    <input type="color" id="edit-fill-color-picker" value="${colorVal}" class="w-8 h-8 rounded cursor-pointer border border-gray-300">
                    <input type="text" id="edit-color" class="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5" value="${eff.color || ''}" placeholder="#a9b1d6, red...">
                </div>
            </div>
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-700 mb-1">Opacity</label>
                <input type="range" id="edit-fill-opacity" min="0" max="1" step="0.05" value="${opacityVal}" class="w-full">
                <div class="flex justify-between text-[10px] text-gray-400">
                    <span>0%</span>
                    <span id="edit-opacity-value">${Math.round(opacityVal*100)}%</span>
                    <span>100%</span>
                </div>
            </div>
        `;
    } else if (effectType === 'time_shift') {
        html = `
            <div class="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                <p class="text-[10px] text-blue-600"><i class="fa-solid fa-info-circle mr-1"></i>Time Shift di chuyển tất cả đối tượng theo frames đã bake từ backend. Không cần cấu hình thêm.</p>
            </div>
        `;
    } else if (effectType === 'change_style') {
        const colorVal = eff.color || '#333333';
        html = `
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-700 mb-1">New Stroke Color</label>
                <div class="flex gap-2">
                    <input type="color" id="edit-color-picker" value="${colorVal}" class="w-8 h-8 rounded cursor-pointer border border-gray-300">
                    <input type="text" id="edit-color" class="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5" value="${eff.color || ''}" placeholder="#ff0000, red...">
                </div>
            </div>
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-700 mb-1">New Stroke Width</label>
                <select id="edit-stroke-width" class="w-full text-sm border border-gray-300 bg-white rounded px-2 py-1.5">
                    <option value="">Giữ nguyên</option>
                    <option value="1" ${params.strokeWidth==='1'?'selected':''}>1px</option>
                    <option value="2" ${params.strokeWidth==='2'?'selected':''}>2px</option>
                    <option value="3" ${params.strokeWidth==='3'?'selected':''}>3px</option>
                    <option value="4" ${params.strokeWidth==='4'?'selected':''}>4px</option>
                </select>
            </div>
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-700 mb-1">Dash Pattern (optional)</label>
                <input type="text" id="edit-dashed" class="w-full text-sm font-mono border border-gray-300 rounded px-2 py-1.5" placeholder="5,5 hoặc none" value="${params.dashed || ''}">
            </div>
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-700 mb-1">Fill Color (optional)</label>
                <input type="text" id="edit-fill-color" class="w-full text-sm border border-gray-300 rounded px-2 py-1.5" placeholder="red, rgba(255,0,0,0.5)..." value="${params.fill || ''}">
            </div>
        `;
    } else if (effectType === 'fade_in') {
        const colorVal = eff.color || '#ffffff';
        html = `
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-700 mb-1">Fade Color</label>
                <div class="flex gap-2">
                    <input type="color" id="edit-color-picker" value="${colorVal}" class="w-8 h-8 rounded cursor-pointer border border-gray-300">
                    <input type="text" id="edit-color" class="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5" value="${eff.color || ''}" placeholder="#ff0000, red...">
                </div>
            </div>
        `;
    } else {
        html = `
            <div class="mb-3">
                <label class="block text-xs font-bold text-gray-700 mb-1">Color (optional)</label>
                <input type="text" id="edit-color" class="w-full text-sm border border-gray-300 rounded px-2 py-1.5" value="${eff.color || ''}" placeholder="#ff0000, red...">
            </div>
        `;
    }
    container.innerHTML = html;
    
    // Bind opacity slider
    const opacitySlider = document.getElementById('edit-fill-opacity');
    const opacityValue = document.getElementById('edit-opacity-value');
    if (opacitySlider && opacityValue) {
        opacitySlider.addEventListener('input', () => {
            opacityValue.textContent = Math.round(opacitySlider.value * 100) + '%';
        });
    }
    
    // Bind color picker sync
    const colorPicker = document.getElementById('edit-color-picker');
    const colorInput = document.getElementById('edit-color');
    if (colorPicker && colorInput) {
        colorPicker.addEventListener('input', () => { colorInput.value = colorPicker.value; });
        colorInput.addEventListener('input', () => { 
            if (/^#[0-9a-fA-F]{6}$/.test(colorInput.value)) colorPicker.value = colorInput.value; 
        });
    }
    
    const fillColorPicker = document.getElementById('edit-fill-color-picker');
    const fillColorInput = document.getElementById('edit-color');
    if (fillColorPicker && fillColorInput) {
        fillColorPicker.addEventListener('input', () => { fillColorInput.value = fillColorPicker.value; });
        fillColorInput.addEventListener('input', () => { 
            if (/^#[0-9a-fA-F]{6}$/.test(fillColorInput.value)) fillColorPicker.value = fillColorInput.value; 
        });
    }
};

window.closeEffectEditor = () => {
    document.getElementById('effect-editor-modal').classList.add('hidden');
};

window.saveEffectParams = () => {
    const stepIdx = parseInt(document.getElementById('edit-step-idx').value);
    const effIdx = parseInt(document.getElementById('edit-eff-idx').value);
    const eff = window.player.steps[stepIdx][effIdx];
    
    eff.type = document.getElementById('edit-effect-type').value;
    eff.duration = parseInt(document.getElementById('edit-duration').value) || 1000;
    
    let params = {};
    let color = undefined;
    const effType = eff.type;
    
    if (effType === 'draw' || effType === 'draw_light' || effType === 'draw_dashed_light' || effType === 'change_style' || effType === 'fade_in') {
        color = document.getElementById("edit-color")?.value.trim() || undefined;
        const sw = document.getElementById("edit-stroke-width")?.value;
        if (sw) params.strokeWidth = sw;
        const dashed = document.getElementById("edit-dashed")?.value.trim();
        if (dashed && dashed !== 'none') params.dashed = dashed;
        if (effType === 'change_style') {
            const fillC = document.getElementById("edit-fill-color")?.value.trim();
            if (fillC) params.fill = fillC;
        }
    } else if (effType === 'fill') {
        color = document.getElementById("edit-color")?.value.trim() || "rgba(169, 177, 214, 0.5)";
        const opacity = document.getElementById("edit-fill-opacity")?.value;
        if (opacity) params.opacity = parseFloat(opacity);
    }
    
    if (Object.keys(params).length === 0) {
        delete eff.params;
    } else {
        eff.params = params;
    }
    eff.color = color;
    
    window.closeEffectEditor();
    renderStepsUI();
    
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
        
        // Auto-center offset
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Pan & Zoom
        this.panX = 0;
        this.panY = 0;
        this.zoom = 1;
        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;
        
        // Dark mode
        this.darkMode = false;
    }

    transformX(mathX) { return this.container.clientWidth / 2 + this.panX + ((mathX - this.offsetX) * SCALE * this.zoom); }
    transformY(mathY) { return this.container.clientHeight / 2 + this.panY - ((mathY - this.offsetY) * SCALE * this.zoom); }

    setupPanZoom() {
        this.container.style.cursor = 'grab';
        
        this.container.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            this.isPanning = true;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            this.container.style.cursor = 'grabbing';
            e.preventDefault();
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            this.panX += e.clientX - this.lastPanX;
            this.panY += e.clientY - this.lastPanY;
            this.lastPanX = e.clientX;
            this.lastPanY = e.clientY;
            this.jumpToStep(this.currentStep);
        });
        
        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.container.style.cursor = 'grab';
            }
        });
        
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const newZoom = Math.max(0.1, Math.min(10, this.zoom * zoomFactor));
            
            const rect = this.container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left - rect.width / 2;
            const mouseY = e.clientY - rect.top - rect.height / 2;
            
            this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
            this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
            this.zoom = newZoom;
            
            this.jumpToStep(this.currentStep);
        }, { passive: false });
    }

    resetView() {
        this.panX = 0;
        this.panY = 0;
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        
        if (this.frames && this.frames.length > 0) {
            const points0 = this.frames[0].points;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            Object.values(points0).forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });
            if (isFinite(minX)) {
                this.offsetX = (minX + maxX) / 2;
                this.offsetY = (minY + maxY) / 2;
            }
        }
        this.jumpToStep(this.currentStep);
    }

    mapStrokeForDarkMode(color, isDark) {
        if (!color) return isDark ? '#f0f0f0' : '#333333';
        const darkMap = {
            '#333': '#f0f0f0', '#333333': '#f0f0f0',
            '#000': '#f0f0f0', '#000000': '#f0f0f0',
            '#1a1a1a': '#f0f0f0',
            '#3b82f6': '#60a5fa',
            '#ef4444': '#f87171',
            '#22c55e': '#4ade80',
        };
        const lightMap = {
            '#f0f0f0': '#333333', '#ffffff': '#333333', '#fff': '#333333',
            '#60a5fa': '#3b82f6',
            '#f87171': '#ef4444',
            '#4ade80': '#22c55e',
        };
        return isDark ? (darkMap[color] || color) : (lightMap[color] || color);
    }

    mapFillForDarkMode(color, isDark) {
        if (!color || color === 'none') return 'none';
        return color;
    }

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

        // Tính bounding box từ tất cả points để auto-center
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        Object.values(points0).forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });
        if (isFinite(minX)) {
            this.offsetX = (minX + maxX) / 2;
            this.offsetY = (minY + maxY) / 2;
        } else {
            this.offsetX = 0;
            this.offsetY = 0;
        }

        const parseOpts = (optStr) => {
            const isDark = this.darkMode;
            const defaultStroke = isDark ? '#f0f0f0' : '#333';
            const attrs = { stroke: defaultStroke, "stroke-width": "2", fill: "none" };
            if (!optStr) return attrs;
            if (optStr.includes("blue")) attrs.stroke = isDark ? '#60a5fa' : '#3b82f6';
            if (optStr.includes("red")) attrs.stroke = isDark ? '#f87171' : '#ef4444';
            if (optStr.includes("green")) attrs.stroke = isDark ? '#4ade80' : '#22c55e';
            if (optStr.includes("black")) attrs.stroke = isDark ? '#f0f0f0' : '#000000';
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
                dom.setAttribute("r", r * SCALE * this.zoom);
                dom.setAttribute("stroke-linecap", "round");
                dom.setAttribute("stroke-linejoin", "round");
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
                dom.setAttribute("stroke-linejoin", "round");
                dom.setAttribute("stroke-linecap", "round");
                const attrs = parseOpts(obj.options);
                // default if not specified
                if (!attrs.fill && obj.close_path) attrs.fill = "none"; 
                for (let k in attrs) dom.setAttribute(k, attrs[k]);
                group.appendChild(dom);
            }
            else if (obj.type === "draw_line") {
                const p1 = getPt(obj.p1);
                const p2 = getPt(obj.p2);
                dom = document.createElementNS("http://www.w3.org/2000/svg", "line");
                dom.setAttribute("x1", this.transformX(p1.x));
                dom.setAttribute("y1", this.transformY(p1.y));
                dom.setAttribute("x2", this.transformX(p2.x));
                dom.setAttribute("y2", this.transformY(p2.y));
                dom.setAttribute("stroke-linecap", "round");
                const attrs = parseOpts(obj.options);
                for (let k in attrs) dom.setAttribute(k, attrs[k]);
                group.appendChild(dom);
            }
            else if (obj.type === "fill_node" || obj.type === "node_label" || obj.type === "draw_line_label") {
                // Complex objects treated as grouped
                this.updateComplexObject(obj, group, points0);
                dom = group; 
            }
            else if (obj.type === "draw_right_angle" || obj.type === "draw_angle") {
                // Góc vuông / góc thường - vẽ path hình chữ L nhỏ
                const p1 = getPt(obj.p1);
                const vertex = getPt(obj.vertex);
                const p2 = getPt(obj.p2);
                
                const size = 2; // 2mm ≈ 0.15 unit, dùng fixed 0.15
                const angleSize = 0.15;
                
                // Vector từ vertex đến p1 và p2
                const v1x = p1.x - vertex.x, v1y = p1.y - vertex.y;
                const v2x = p2.x - vertex.x, v2y = p2.y - vertex.y;
                const len1 = Math.sqrt(v1x*v1x + v1y*v1y) || 1;
                const len2 = Math.sqrt(v2x*v2x + v2y*v2y) || 1;
                
                // Điểm trên 2 cạnh cách vertex một khoảng angleSize
                const ax = vertex.x + (v1x/len1) * angleSize;
                const ay = vertex.y + (v1y/len1) * angleSize;
                const bx = vertex.x + (v2x/len2) * angleSize;
                const by = vertex.y + (v2y/len2) * angleSize;
                
                // Điểm góc vuông
                const cx = ax + (bx - vertex.x);
                const cy = ay + (by - vertex.y);
                
                const d = `M ${this.transformX(ax)} ${this.transformY(ay)} L ${this.transformX(cx)} ${this.transformY(cy)} L ${this.transformX(bx)} ${this.transformY(by)}`;
                dom = document.createElementNS("http://www.w3.org/2000/svg", "path");
                dom.setAttribute("d", d);
                dom.setAttribute("fill", "none");
                dom.setAttribute("stroke", this.darkMode ? '#f0f0f0' : '#333');
                dom.setAttribute("stroke-width", "1");
                dom.setAttribute("stroke-linejoin", "round");
                dom.setAttribute("stroke-linecap", "round");
                group.appendChild(dom);
            }
            
            if (obj.type !== "fill_node" && obj.type !== "node_label" && obj.type !== "draw_line_label") {
                // simple elements cache
            }

            mainLayer.appendChild(group);
            const attrs = parseOpts(obj.options);
            this.svgElements[obj._id] = { 
                dom: dom, 
                group: group, 
                obj: obj,
                originalStroke: attrs.stroke,
                originalFill: attrs.fill,
                originalStrokeWidth: attrs["stroke-width"] || "2"
            };
        });
        
        this.setupPanZoom();
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
        // [BƯỚC 1: HARD RESET] Trả toàn bộ SVG về trạng thái nguyên bản (Frame 0)
        const points0 = (this.frames && this.frames.length > 0) ? this.frames[0].points : {};
        
        Object.values(this.svgElements).forEach(item => {
            const obj = item.obj;
            // 1. Reset Opacity
            item.group.style.opacity = "0";
            
            // 2. Reset Stroke/Fill/Dash
            if (item.dom && item.dom.style) {
                item.dom.style.strokeDasharray = "none"; 
                item.dom.style.strokeDashoffset = "0";
                item.dom.style.stroke = item.originalStroke || (this.darkMode ? '#f0f0f0' : '#333');
                item.dom.setAttribute("stroke-width", item.originalStrokeWidth || "2");
                item.dom.style.transition = "none"; // Reset transition
                
                // Khôi phục Fill màu gốc
                const fillFromAttr = item.dom.getAttribute('data-origin-fill');
                item.dom.setAttribute("fill", fillFromAttr || item.originalFill || "none");
            }
            
            // 3. Reset Tọa độ & Hình dáng về Frame 0
            if (obj.type === "draw_circle") {
                const center = points0[obj.center] || { x: 0, y: 0 };
                item.dom.setAttribute("cx", this.transformX(center.x));
                item.dom.setAttribute("cy", this.transformY(center.y));
                let r = parseFloat(obj.radius) || 1;
                item.dom.setAttribute("r", r * SCALE * this.zoom);
            } else if (obj.type === "draw_lines") {
                const pts = obj.points.map(pName => points0[pName] || { x: 0, y: 0 });
                let d = "";
                pts.forEach((p, idx) => {
                    const mappedX = this.transformX(p.x);
                    const mappedY = this.transformY(p.y);
                    if (idx === 0) d += `M ${mappedX} ${mappedY} `;
                    else d += `L ${mappedX} ${mappedY} `;
                });
                if (obj.close_path) d += "Z";
                item.dom.setAttribute("d", d);
            } else if (obj.type === "draw_line") {
                const p1 = points0[obj.p1] || { x: 0, y: 0 };
                const p2 = points0[obj.p2] || { x: 0, y: 0 };
                item.dom.setAttribute("x1", this.transformX(p1.x));
                item.dom.setAttribute("y1", this.transformY(p1.y));
                item.dom.setAttribute("x2", this.transformX(p2.x));
                item.dom.setAttribute("y2", this.transformY(p2.y));
            } else if (obj.type === "draw_right_angle" || obj.type === "draw_angle") {
                this.updateComplexObject(obj, item.group, points0);
            } else {
                // Object phức tạp (điểm, chữ, label)
                this.updateComplexObject(obj, item.group, points0);
            }
        });
        
        // [BƯỚC 2: FAST-FORWARD] Áp dụng nhanh các hiệu ứng đến Step mục tiêu
        for(let i=0; i<targetStep; i++) {
            const effects = this.steps[i];
            if (!effects) continue;
            effects.forEach(eff => {
                this._initEffectState(eff);
                this._applyEffectTick(eff, 1.0); // Chạy 100% progress ngay
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
            if (eff.color) {
                if (item.dom) {
                    item.dom.style.stroke = eff.color;
                }
                if (item.group) {
                    item.group.querySelectorAll('text').forEach(t => {
                        t.setAttribute('fill', eff.color);
                    });
                }
            }
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
            // Apply stroke width from params
            if (eff.params && eff.params.strokeWidth) item.dom.setAttribute("stroke-width", eff.params.strokeWidth);

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
        else if (eff.type === "change_style") {
            // Apply only once to trigger CSS transition
            if (progress > 0 && !eff._styleApplied) {
                item.dom.style.transition = `all ${eff.duration}ms ease-in-out`;
                if (eff.color) item.dom.style.stroke = eff.color;
                if (eff.params) {
                    if (eff.params.dashed) item.dom.style.strokeDasharray = eff.params.dashed;
                    if (eff.params.strokeWidth) item.dom.setAttribute("stroke-width", eff.params.strokeWidth);
                    if (eff.params.fill) item.dom.setAttribute("fill", eff.params.fill);
                }
                eff._styleApplied = true;
            }
        }
        else if (eff.type === "time_shift" && this.frames.length > 0) {
            const totalFrames = this.frames.length;
            let fIndex = Math.round(progress * (totalFrames - 1));
            fIndex = Math.max(0, Math.min(fIndex, totalFrames - 1));
            const currentPts = this.frames[fIndex].points;
            
            // DUYỆT QUA TẤT CẢ OBJECT ĐỂ UPDATE (hiệu ứng toàn cục)
            this.visualObjects.forEach(obj => {
                const subItem = this.svgElements[obj._id];
                if (!subItem) return;
                
                // Set visible — time_shift cần object hiện rõ
                subItem.group.style.opacity = "1";
                
                if (subItem.dom) {
                    // Tắt CSS transition để không bị giật
                    subItem.dom.style.transition = "none";
                    // Xóa stroke-dash để đường luôn vẽ đầy (không bị draw effect chồng)
                    subItem.dom.style.strokeDasharray = "none";
                    subItem.dom.style.strokeDashoffset = "0";
                }

                // Cập nhật Hình Tròn
                if (obj.type === "draw_circle") {
                    const c = currentPts[obj.center] || {x:0, y:0};
                    subItem.dom.setAttribute("cx", this.transformX(c.x));
                    subItem.dom.setAttribute("cy", this.transformY(c.y));
                    let r = parseFloat(obj.radius) || 1;
                    subItem.dom.setAttribute("r", r * SCALE * this.zoom);
                }
                // Cập nhật Đường thẳng đơn (A)--(B)
                else if (obj.type === "draw_line") {
                    const p1 = currentPts[obj.p1] || {x:0, y:0};
                    const p2 = currentPts[obj.p2] || {x:0, y:0};
                    subItem.dom.setAttribute("x1", this.transformX(p1.x));
                    subItem.dom.setAttribute("y1", this.transformY(p1.y));
                    subItem.dom.setAttribute("x2", this.transformX(p2.x));
                    subItem.dom.setAttribute("y2", this.transformY(p2.y));
                }
                // Cập nhật Đa giác nhiều điểm (A)--(B)--(C)--cycle
                else if (obj.type === "draw_lines") {
                    const mappedPts = obj.points.map(pName => currentPts[pName] || {x:0, y:0});
                    let d = "";
                    mappedPts.forEach((p, idx) => {
                        if (idx === 0) d += `M ${this.transformX(p.x)} ${this.transformY(p.y)} `;
                        else d += `L ${this.transformX(p.x)} ${this.transformY(p.y)} `;
                    });
                    if (obj.close_path) d += "Z";
                    subItem.dom.setAttribute("d", d);
                }
                // Cập nhật các Node Phức tạp (Nhãn chữ, chấm điểm)
                else if (["fill_node", "node_label", "draw_line_label"].includes(obj.type)) {
                    this.updateComplexObject(obj, subItem.group, currentPts);
                }
                // Cập nhật góc vuông / góc thường
                else if (obj.type === "draw_right_angle" || obj.type === "draw_angle") {
                    const p1 = currentPts[obj.p1] || {x:0, y:0};
                    const vertex = currentPts[obj.vertex] || {x:0, y:0};
                    const p2 = currentPts[obj.p2] || {x:0, y:0};
                    
                    const angleSize = 0.15;
                    const v1x = p1.x - vertex.x, v1y = p1.y - vertex.y;
                    const v2x = p2.x - vertex.x, v2y = p2.y - vertex.y;
                    const len1 = Math.sqrt(v1x*v1x + v1y*v1y) || 1;
                    const len2 = Math.sqrt(v2x*v2x + v2y*v2y) || 1;
                    
                    const ax = vertex.x + (v1x/len1) * angleSize;
                    const ay = vertex.y + (v1y/len1) * angleSize;
                    const bx = vertex.x + (v2x/len2) * angleSize;
                    const by = vertex.y + (v2y/len2) * angleSize;
                    const cx = ax + (bx - vertex.x);
                    const cy = ay + (by - vertex.y);
                    
                    const d = `M ${this.transformX(ax)} ${this.transformY(ay)} L ${this.transformX(cx)} ${this.transformY(cy)} L ${this.transformX(bx)} ${this.transformY(by)}`;
                    subItem.dom.setAttribute("d", d);
                }
            });
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
        if (eff.type === "change_style") {
            if (item.dom) item.dom.style.transition = "none";
            eff._styleApplied = false;
        }
        if (eff.spark) {
            eff.spark.remove();
        }
    }

    updateComplexObject(obj, group, points) {
        group.innerHTML = "";
        const getPt = (name) => points[name] || { x: 0, y: 0 };
        const parseOpts = (optStr) => {
            const isDark = this.darkMode;
            const defaultStroke = isDark ? '#f0f0f0' : '#333';
            const attrs = { stroke: defaultStroke, "stroke-width": "2", fill: "none" };
            if (!optStr) return attrs;
            if (optStr.includes("blue")) attrs.stroke = isDark ? '#60a5fa' : '#3b82f6';
            if (optStr.includes("red")) attrs.stroke = isDark ? '#f87171' : '#ef4444';
            if (optStr.includes("green")) attrs.stroke = isDark ? '#4ade80' : '#22c55e';
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
            // Cập nhật lại dom reference
            const item = this.svgElements[obj._id];
            if (item) item.dom = dot;
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
            // Cập nhật lại dom reference
            const item = this.svgElements[obj._id];
            if (item) item.dom = line;
        }
        else if (obj.type === "draw_right_angle" || obj.type === "draw_angle") {
            const p1 = getPt(obj.p1);
            const vertex = getPt(obj.vertex);
            const p2 = getPt(obj.p2);
            
            const angleSize = 0.15;
            const v1x = p1.x - vertex.x, v1y = p1.y - vertex.y;
            const v2x = p2.x - vertex.x, v2y = p2.y - vertex.y;
            const len1 = Math.sqrt(v1x*v1x + v1y*v1y) || 1;
            const len2 = Math.sqrt(v2x*v2x + v2y*v2y) || 1;
            
            const ax = vertex.x + (v1x/len1) * angleSize;
            const ay = vertex.y + (v1y/len1) * angleSize;
            const bx = vertex.x + (v2x/len2) * angleSize;
            const by = vertex.y + (v2y/len2) * angleSize;
            const cx = ax + (bx - vertex.x);
            const cy = ay + (by - vertex.y);
            
            const d = `M ${this.transformX(ax)} ${this.transformY(ay)} L ${this.transformX(cx)} ${this.transformY(cy)} L ${this.transformX(bx)} ${this.transformY(by)}`;
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", d);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", this.darkMode ? '#f0f0f0' : '#333');
            path.setAttribute("stroke-width", "1");
            path.setAttribute("stroke-linejoin", "round");
            path.setAttribute("stroke-linecap", "round");
            group.appendChild(path);
            // Cập nhật lại dom reference — QUAN TRỌNG để time_shift update được
            const item = this.svgElements[obj._id];
            if (item) item.dom = path;
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
        svgText.setAttribute("font-family", "'Times New Roman', Times, serif");
        svgText.setAttribute("font-style", "italic");
        svgText.setAttribute("font-size", "18px");
        svgText.setAttribute("fill", this.darkMode ? '#f0f0f0' : '#1a1a1a');
        svgText.setAttribute("stroke", "none");
        svgText.setAttribute("paint-order", "fill");
        svgText.textContent = cleanText;
        group.appendChild(svgText);
    }
}
