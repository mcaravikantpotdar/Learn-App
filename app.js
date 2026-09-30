/**
 * Learn-App Core Logic (app.js)
 * Hardened Architecture: Caching, Offline Support, Sanitization, Math Rendering & Drag-Drop Sorting
 */

const AppState = {
    currentLang: 'en',
    units: [],
    currentUnitIndex: 0,
    assembly: [],
    score: 0,
    maxScore: 0,
    studentId: '',
    githubRepo: 'YOUR_GITHUB_USERNAME/YOUR_REPO_NAME', // Update this
    gasEndpoint: 'YOUR_GOOGLE_APPS_SCRIPT_URL'         // Update this
};

const UI = {
    screens: {
        home: document.getElementById('home-screen'),
        quiz: document.getElementById('quiz-screen')
    },
    spinner: document.getElementById('loading-spinner'),
    lessonTitle: document.getElementById('lesson-title'),
    theoryContent: document.getElementById('theory-content'),
    mediaViewport: document.getElementById('media-viewport'),
    mediaCaption: document.getElementById('media-caption'),
    promptBar: document.getElementById('prompt-bar'),
    assemblyLine: document.getElementById('assembly-line'),
    fragmentPool: document.getElementById('fragment-pool'),
    feedbackBanner: document.getElementById('feedback-banner'),
    questionGrid: document.getElementById('question-grid'),
    btnCheck: document.getElementById('btn-check'),
    btnNext: document.getElementById('btn-next'),
    langBtns: document.querySelectorAll('.lang-btn')
};

// ==========================================
// 1. INITIALIZATION & OFFLINE SYNC
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    syncOfflineScores();
    loadCurriculum();
});

function bindEvents() {
    UI.langBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            UI.langBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            AppState.currentLang = e.target.dataset.lang;
            renderCurrentUnit();
        });
    });

    UI.btnCheck.addEventListener('click', checkAnswer);
    UI.btnNext.addEventListener('click', nextUnit);
}

function showScreen(screenName) {
    Object.values(UI.screens).forEach(s => s?.classList.remove('active'));
    UI.screens[screenName]?.classList.add('active');
}

// ==========================================
// 2. INFRASTRUCTURE: GITHUB FETCH & CACHING
// ==========================================

async function loadCurriculum() {
    UI.spinner.classList.add('active');
    const cacheKey = 'learnApp_curriculum_cache';
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
        console.log("Loaded curriculum from session cache.");
        processCurriculum(JSON.parse(cachedData));
        UI.spinner.classList.remove('active');
        return;
    }

    try {
        const res = await fetch(`https://api.github.com/repos/${AppState.githubRepo}/contents/curriculum.json`);
        if (!res.ok) throw new Error("GitHub rate limit hit or file not found.");
        
        const data = await res.json();
        const decodedContent = decodeURIComponent(escape(atob(data.content)));
        const parsedJson = JSON.parse(decodedContent);
        
        sessionStorage.setItem(cacheKey, JSON.stringify(parsedJson));
        processCurriculum(parsedJson);
    } catch (error) {
        console.error("Failed to load curriculum:", error);
        UI.feedbackBanner.innerHTML = "Error loading curriculum. Please try again later.";
        UI.feedbackBanner.className = 'feedback-banner error';
    } finally {
        UI.spinner.classList.remove('active');
    }
}

function processCurriculum(data) {
    AppState.units = data.learning_units || [];
    startModule();
}

function startModule() {
    AppState.currentUnitIndex = 0;
    AppState.score = 0;
    buildQuestionGrid();
    showScreen('quiz');
    renderCurrentUnit();
}

// ==========================================
// 3. RENDERING & AGGRESSIVE SANITIZATION
// ==========================================

function formatText(text) {
    if (!text) return '';
    let safeText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    safeText = safeText.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-family:monospace; border: 1px solid #cbd5e1; color:#0f172a;">$1</code>');
    return safeText;
}

function triggerMathRender() {
    if (typeof renderMathInElement === 'function') {
        const targets = ['.theory-content', '.prompt-bar', '.feedback-banner', '.fragment-chip', '.media-caption'];
        targets.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                renderMathInElement(el, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false}
                    ],
                    throwOnError: false
                });
            });
        });
    }
}

function renderCurrentUnit() {
    const unit = AppState.units[AppState.currentUnitIndex];
    if (!unit) return;

    const lang = AppState.currentLang;
    const challenge = unit.challenges[lang] || unit.challenges.en;
    const media = unit.instruction.media;

    UI.lessonTitle.innerHTML = formatText(unit.instruction.title[lang] || unit.instruction.title.en);
    UI.theoryContent.innerHTML = formatText(unit.instruction.theory[lang] || unit.instruction.theory.en);
    UI.promptBar.innerHTML = formatText(challenge.prompt);
    
    if (media.type === 'svg') {
        UI.mediaViewport.innerHTML = media.svg_code;
    }
    UI.mediaCaption.innerHTML = formatText(media.caption[lang] || media.caption.en || '');

    UI.feedbackBanner.className = 'feedback-banner';
    UI.feedbackBanner.innerHTML = '';
    UI.btnCheck.disabled = false;
    UI.btnNext.disabled = true;
    UI.assemblyLine.classList.remove('success-lock');

    buildFragments(challenge);
    updateQuestionGridUI();
    triggerMathRender();
}

// ==========================================
// 4. FRAGMENT ASSEMBLY & DRAG-AND-DROP
// ==========================================

let draggedChip = null;

function buildFragments(challenge) {
    AppState.assembly = [];
    UI.assemblyLine.innerHTML = '';
    UI.fragmentPool.innerHTML = '';

    let allFragments = [...challenge.target_sequence];
    if (challenge.distractors) {
        allFragments = allFragments.concat(challenge.distractors);
    }
    
    for (let i = allFragments.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allFragments[i], allFragments[j]] = [allFragments[j], allFragments[i]];
    }

    allFragments.forEach(frag => {
        const chip = document.createElement('div');
        chip.className = 'fragment-chip';
        chip.dataset.id = frag.id;
        chip.innerHTML = formatText(frag.text);
        chip.fragData = frag; 

        chip.addEventListener('click', () => toggleFragment(chip));
        
        chip.draggable = true;
        chip.addEventListener('dragstart', handleDragStart);
        chip.addEventListener('dragend', handleDragEnd);

        UI.fragmentPool.appendChild(chip);
    });

    UI.assemblyLine.addEventListener('dragover', handleDragOver);
}

function toggleFragment(chip) {
    if (UI.assemblyLine.classList.contains('success-lock')) return;

    if (chip.parentElement === UI.fragmentPool) {
        UI.assemblyLine.appendChild(chip);
    } else {
        UI.fragmentPool.appendChild(chip);
    }
    syncAssemblyArray();
}

function handleDragStart(e) {
    if (UI.assemblyLine.classList.contains('success-lock')) {
        e.preventDefault();
        return;
    }
    draggedChip = this;
    setTimeout(() => this.classList.add('dragging'), 0);
    this.style.opacity = '0.5';
}

function handleDragEnd() {
    this.classList.remove('dragging');
    this.style.opacity = '1';
    draggedChip = null;
    syncAssemblyArray();
}

function handleDragOver(e) {
    e.preventDefault();
    if (UI.assemblyLine.classList.contains('success-lock') || !draggedChip) return;
    
    const afterElement = getDragAfterElement(UI.assemblyLine, e.clientX, e.clientY);
    if (afterElement == null) {
        UI.assemblyLine.appendChild(draggedChip);
    } else {
        UI.assemblyLine.insertBefore(draggedChip, afterElement);
    }
}

function getDragAfterElement(container, x, y) {
    const draggableElements = [...container.querySelectorAll('.fragment-chip:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (y > box.top && y < box.bottom && offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function syncAssemblyArray() {
    const chips = UI.assemblyLine.querySelectorAll('.fragment-chip');
    AppState.assembly = Array.from(chips).map(chip => chip.fragData);
}

// ==========================================
// 5. VALIDATION & FEEDBACK
// ==========================================

function checkAnswer() {
    const unit = AppState.units[AppState.currentUnitIndex];
    const challenge = unit.challenges[AppState.currentLang] || unit.challenges.en;
    const targets = challenge.target_sequence;

    if (AppState.assembly.length === 0) return;

    const distractor = AppState.assembly.find(f => f.category === 'logical' || f.category === 'grammatical');
    if (distractor) {
        showFeedback(`❌ ${formatText(distractor.penalty_explanation)}`, 'error');
        return;
    }

    if (AppState.assembly.length < targets.length) {
        const nextExpected = targets[AppState.assembly.length];
        const hintText = nextExpected.role_hint[AppState.currentLang] || nextExpected.role_hint.en || nextExpected.role_hint;
        showFeedback(`💡 <strong>Hint:</strong> ${formatText(hintText)}`, 'secondary');
        return;
    }

    let isCorrect = true;
    for (let i = 0; i < targets.length; i++) {
        if (AppState.assembly[i].id !== targets[i].id) {
            isCorrect = false;
            break;
        }
    }

    if (isCorrect) {
        const takeawayText = unit.key_takeaway[AppState.currentLang] || unit.key_takeaway.en;
        showFeedback(`✅ <strong>Correct!</strong><br><br>${formatText(takeawayText)}`, 'success');
        UI.assemblyLine.classList.add('success-lock');
        UI.btnCheck.disabled = true;
        UI.btnNext.disabled = false;
        
        const qNode = document.querySelector(`.question-number[data-index="${AppState.currentUnitIndex}"]`);
        if (qNode) qNode.classList.add('correct');
    } else {
        showFeedback(`❌ Sequence incorrect. Review the structure and try again.`, 'error');
    }
}

function showFeedback(html, type) {
    UI.feedbackBanner.innerHTML = html;
    UI.feedbackBanner.className = `feedback-banner ${type}`;
    triggerMathRender();
}

// ==========================================
// 6. NAVIGATION & OFFLINE DATA SAVING
// ==========================================

function buildQuestionGrid() {
    UI.questionGrid.innerHTML = '';
    AppState.units.forEach((unit, index) => {
        const div = document.createElement('div');
        div.className = 'question-number';
        div.dataset.index = index;
        div.innerHTML = `<span class="q-number">${index + 1}</span>`;
        div.addEventListener('click', () => {
            AppState.currentUnitIndex = index;
            renderCurrentUnit();
        });
        UI.questionGrid.appendChild(div);
    });
}

function updateQuestionGridUI() {
    document.querySelectorAll('.question-number').forEach(node => {
        node.classList.remove('current');
        if (parseInt(node.dataset.index) === AppState.currentUnitIndex) {
            node.classList.add('current');
            node.classList.add('attempted');
        }
    });
}

function nextUnit() {
    if (AppState.currentUnitIndex < AppState.units.length - 1) {
        AppState.currentUnitIndex++;
        renderCurrentUnit();
    } else {
        finishModule();
    }
}

function finishModule() {
    UI.mediaViewport.innerHTML = `<div style="text-align:center; padding: 40px; color: white;"><h3>🎉 Module Complete!</h3></div>`;
    UI.theoryContent.innerHTML = "You have successfully completed all units in this chapter.";
    UI.btnNext.style.display = 'none';
    UI.btnCheck.style.display = 'none';
    UI.assemblyLine.innerHTML = '';
    UI.fragmentPool.innerHTML = '';
    
    const payload = {
        studentId: AppState.studentId || "Guest",
        chapter: AppState.units[0]?.chapter_id || "Unknown",
        completedAt: new Date().toISOString()
    };
    saveScore(payload);
}

async function saveScore(payload) {
    try {
        const res = await fetch(AppState.gasEndpoint, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });
        console.log("Score synced to server.");
    } catch (error) {
        console.warn("Network offline. Queueing score locally.");
        let queue = JSON.parse(localStorage.getItem('offlineScoreQueue') || '[]');
        queue.push(payload);
        localStorage.setItem('offlineScoreQueue', JSON.stringify(queue));
    }
}

async function syncOfflineScores() {
    let queue = JSON.parse(localStorage.getItem('offlineScoreQueue') || '[]');
    if (queue.length === 0) return;
    
    console.log(`Syncing ${queue.length} offline scores...`);
    let failed = [];
    
    for (let payload of queue) {
        try {
            await fetch(AppState.gasEndpoint, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(payload)
            });
        } catch (err) {
            failed.push(payload);
        }
    }
    
    localStorage.setItem('offlineScoreQueue', JSON.stringify(failed));
}
