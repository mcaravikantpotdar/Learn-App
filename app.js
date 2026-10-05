/**
 * Learn-App Core Logic (app.js)
 * Fully Aligned with index.html DOM IDs
 * Features:
 * - Dynamic Recursive Git Tree Scanner (jsons/Class/Subject/Chapter.json)
 * - Session-cached GitHub queries to respect rate limits
 * - Cascading Selectors (Class -> Subject -> Lesson)
 * - KaTeX Math & Inline Code Rendering
 * - Bilingual Fragment Assembly with Drag & Drop + Click Fallback
 * - Timer, Progress Bar, Mastery Points, and Results Screen
 * - Google Apps Script Online Submission + Offline LocalQueue Fallback
 * - Global Leaderboard with Sorting
 */

const AppConfig = {
    githubRepo: 'mcaravikantpotdar/Learn-App',
    branch: 'main',
    gasEndpoint: 'https://script.google.com/macros/s/AKfycbxNWnLdQxUnjOCfWHoyZALx-orP0D1v9Q04ic9hl3Ido3W3gOgRoYiq2MuN-bv687I/exec'
};

const AppState = {
    currentLang: 'en',
    repoCatalog: {}, // { [class]: { [subject]: [ { title, path } ] } }
    selectedClass: '',
    selectedSubject: '',
    selectedQuizPath: '',
    units: [],
    currentUnitIndex: 0,
    assembly: [],
    score: 0,
    studentName: '',
    schoolName: '',
    timerSeconds: 0,
    timerInterval: null
};

// Direct 1-to-1 Mapping to your index.html IDs
const DOM = {
    // Screens
    screens: {
        upload: document.getElementById('uploadScreen'),
        quiz: document.getElementById('quizScreen'),
        results: document.getElementById('resultsScreen'),
        scoreboard: document.getElementById('scoreboardScreen')
    },
    spinner: document.getElementById('loadingSpinner'),
    errorMessage: document.getElementById('errorMessage'),

    // Screen 1: Discovery & Registration
    studentName: document.getElementById('studentName'),
    schoolName: document.getElementById('schoolName'),
    classSelect: document.getElementById('classSelect'),
    subjectGroup: document.getElementById('subjectGroup'),
    subjectSelect: document.getElementById('subjectSelect'),
    lessonGroup: document.getElementById('lessonGroup'),
    quizList: document.getElementById('quizList'),
    startQuiz: document.getElementById('startQuiz'),
    viewScoreboardBtn: document.getElementById('viewScoreboardBtn'),

    // Screen 2: Workbench
    topHomeBtn: document.getElementById('topHomeBtn'),
    topQuitBtn: document.getElementById('topQuitBtn'),
    chapterTitle: document.getElementById('chapterTitle'),
    displayStudentName: document.getElementById('displayStudentName'),
    displaySchoolInfo: document.getElementById('displaySchoolInfo'),
    currentUnitNum: document.getElementById('currentUnitNum'),
    totalUnitsNum: document.getElementById('totalUnitsNum'),
    timer: document.getElementById('timer'),
    masteryScore: document.getElementById('masteryScore'),
    maxScore: document.getElementById('maxScore'),
    unitGrid: document.getElementById('unitGrid'),
    btnEn: document.getElementById('btn-en'),
    btnHi: document.getElementById('btn-hi'),
    lessonTitle: document.getElementById('lesson-title'),
    mediaContainer: document.getElementById('media-container'),
    mediaCaption: document.getElementById('media-caption'),
    lessonTheory: document.getElementById('lesson-theory'),
    challengePrompt: document.getElementById('challenge-prompt'),
    targetZone: document.getElementById('target-zone'),
    fragmentBank: document.getElementById('fragment-bank'),
    feedbackBanner: document.getElementById('feedback-banner'),
    prevBtn: document.getElementById('prevBtn'),
    hintBtn: document.getElementById('hintBtn'),
    btnSubmit: document.getElementById('btn-submit'),
    nextBtn: document.getElementById('nextBtn'),

    // Screen 3: Results
    finalScore: document.getElementById('finalScore'),
    totalPossible: document.getElementById('totalPossible'),
    percentage: document.getElementById('percentage'),
    totalTime: document.getElementById('totalTime'),
    retakeBtn: document.getElementById('retakeBtn'),
    viewScoreboardFromResults: document.getElementById('viewScoreboardFromResults'),
    homeBtn: document.getElementById('homeBtn'),

    // Screen 4: Scoreboard
    backFromScoreboard: document.getElementById('backFromScoreboard'),
    scoreboardBody: document.getElementById('scoreboardBody')
};

// ==========================================
// 1. INITIALIZATION & ROUTING
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    bindGlobalEvents();
    syncOfflineScores();
    scanRepositoryTree();
});

function bindGlobalEvents() {
    // Navigation / Screens
    DOM.topHomeBtn?.addEventListener('click', () => switchScreen('upload'));
    DOM.topQuitBtn?.addEventListener('click', finishModule);
    DOM.homeBtn?.addEventListener('click', () => switchScreen('upload'));
    DOM.retakeBtn?.addEventListener('click', restartCurrentModule);
    DOM.viewScoreboardBtn?.addEventListener('click', showScoreboard);
    DOM.viewScoreboardFromResults?.addEventListener('click', showScoreboard);
    DOM.backFromScoreboard?.addEventListener('click', () => switchScreen('upload'));

    // Dropdown Cascade
    DOM.classSelect?.addEventListener('change', handleClassChange);
    DOM.subjectSelect?.addEventListener('change', handleSubjectChange);
    DOM.startQuiz?.addEventListener('click', handleStartQuiz);

    // Language Toggles
    DOM.btnEn?.addEventListener('click', () => setLanguage('en'));
    DOM.btnHi?.addEventListener('click', () => setLanguage('hi'));

    // Quiz Controls
    DOM.btnSubmit?.addEventListener('click', verifyAssembly);
    DOM.nextBtn?.addEventListener('click', handleNextUnit);
    DOM.prevBtn?.addEventListener('click', handlePrevUnit);
    DOM.hintBtn?.addEventListener('click', handleShowHint);
}

function switchScreen(screenKey) {
    Object.values(DOM.screens).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
    if (DOM.screens[screenKey]) {
        DOM.screens[screenKey].classList.add('active');
    }
}

function toggleSpinner(show) {
    if (DOM.spinner) DOM.spinner.classList.toggle('active', show);
}

// ==========================================
// 2. DYNAMIC GITHUB TREE SCANNER
// ==========================================

async function scanRepositoryTree() {
    toggleSpinner(true);
    const cacheKey = `learnApp_catalog_${AppConfig.githubRepo}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
        AppState.repoCatalog = JSON.parse(cached);
        populateClassDropdown();
        toggleSpinner(false);
        return;
    }

    try {
        const url = `https://api.github.com/repos/${AppConfig.githubRepo}/git/trees/${AppConfig.branch}?recursive=1`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error(`GitHub Tree API status: ${res.status}`);
        
        const data = await res.json();
        const catalog = {};

        // Parse paths matching: jsons/{Class}/{Subject}/{Chapter}.json
        (data.tree || []).forEach(node => {
            if (node.type === 'blob' && node.path.startsWith('jsons/') && node.path.endsWith('.json')) {
                const segments = node.path.split('/');
                if (segments.length === 4) {
                    const cls = segments[1];
                    const subj = segments[2];
                    const fileName = segments[3];
                    const title = fileName.replace('.json', '').replace(/[-_]/g, ' ');

                    if (!catalog[cls]) catalog[cls] = {};
                    if (!catalog[cls][subj]) catalog[cls][subj] = [];

                    catalog[cls][subj].push({
                        title: title,
                        path: node.path
                    });
                }
            }
        });

        AppState.repoCatalog = catalog;
        sessionStorage.setItem(cacheKey, JSON.stringify(catalog));
        populateClassDropdown();
    } catch (err) {
        console.error("Scanner Error:", err);
        if (DOM.errorMessage) {
            DOM.errorMessage.innerText = "Error loading repository modules. Please check connection.";
            DOM.errorMessage.style.display = 'block';
        }
    } finally {
        toggleSpinner(false);
    }
}

function populateClassDropdown() {
    if (!DOM.classSelect) return;
    DOM.classSelect.innerHTML = '<option value="" disabled selected>Choose Class...</option>';
    
    const classes = Object.keys(AppState.repoCatalog).sort();
    classes.forEach(cls => {
        DOM.classSelect.innerHTML += `<option value="${cls}">${cls}</option>`;
    });

    if (DOM.subjectGroup) DOM.subjectGroup.style.display = 'none';
    if (DOM.lessonGroup) DOM.lessonGroup.style.display = 'none';
    if (DOM.startQuiz) DOM.startQuiz.disabled = true;
}

function handleClassChange() {
    AppState.selectedClass = DOM.classSelect.value;
    AppState.selectedSubject = '';
    AppState.selectedQuizPath = '';

    if (!DOM.subjectSelect) return;
    DOM.subjectSelect.innerHTML = '<option value="" disabled selected>Choose Subject...</option>';
    
    if (DOM.quizList) {
        DOM.quizList.innerHTML = '<p style="padding:10px; opacity:0.6; font-size: 13px;">Select subject next</p>';
    }

    if (AppState.selectedClass && AppState.repoCatalog[AppState.selectedClass]) {
        const subjects = Object.keys(AppState.repoCatalog[AppState.selectedClass]).sort();
        subjects.forEach(subj => {
            DOM.subjectSelect.innerHTML += `<option value="${subj}">${subj}</option>`;
        });
        if (DOM.subjectGroup) DOM.subjectGroup.style.display = 'block';
    } else {
        if (DOM.subjectGroup) DOM.subjectGroup.style.display = 'none';
    }

    if (DOM.lessonGroup) DOM.lessonGroup.style.display = 'none';
    if (DOM.startQuiz) DOM.startQuiz.disabled = true;
}

function handleSubjectChange() {
    AppState.selectedSubject = DOM.subjectSelect.value;
    AppState.selectedQuizPath = '';

    if (!DOM.quizList) return;
    DOM.quizList.innerHTML = '';

    if (AppState.selectedClass && AppState.selectedSubject) {
        const quizzes = AppState.repoCatalog[AppState.selectedClass][AppState.selectedSubject] || [];
        
        quizzes.forEach(quiz => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quiz-select-btn';
            btn.innerText = quiz.title;
            btn.style.cssText = "display:block; width:100%; text-align:left; padding:10px 14px; margin-bottom:6px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; cursor:pointer; font-weight:500; font-size:14px;";

            btn.addEventListener('click', () => {
                document.querySelectorAll('.quiz-select-btn').forEach(b => {
                    b.style.borderColor = '#e2e8f0';
                    b.style.background = '#f8fafc';
                    b.style.color = '#0f172a';
                });
                btn.style.borderColor = '#2563eb';
                btn.style.background = '#eff6ff';
                btn.style.color = '#1d4ed8';

                AppState.selectedQuizPath = quiz.path;
                validateStartReady();
            });

            DOM.quizList.appendChild(btn);
        });

        if (DOM.lessonGroup) DOM.lessonGroup.style.display = 'block';
    } else {
        if (DOM.lessonGroup) DOM.lessonGroup.style.display = 'none';
    }
}

function validateStartReady() {
    const nameValid = DOM.studentName?.value.trim().length > 0;
    const pathValid = AppState.selectedQuizPath.length > 0;
    if (DOM.startQuiz) {
        DOM.startQuiz.disabled = !(nameValid && pathValid);
    }
}

DOM.studentName?.addEventListener('input', validateStartReady);

// ==========================================
// 3. QUIZ INITIALIZATION & PARSING
// ==========================================

async function handleStartQuiz() {
    AppState.studentName = DOM.studentName.value.trim();
    AppState.schoolName = DOM.schoolName?.value.trim() || 'General';

    toggleSpinner(true);
    const cacheKey = `learnApp_file_${AppState.selectedQuizPath}`;
    const cached = sessionStorage.getItem(cacheKey);

    if (cached) {
        setupQuizFromData(JSON.parse(cached));
        toggleSpinner(false);
        return;
    }

    try {
        const url = `https://api.github.com/repos/${AppConfig.githubRepo}/contents/${AppState.selectedQuizPath}?ref=${AppConfig.branch}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch chapter error: ${res.statusText}`);

        const fileJson = await res.json();
        const rawContent = decodeURIComponent(escape(atob(fileJson.content)));
        const parsed = JSON.parse(rawContent);

        sessionStorage.setItem(cacheKey, JSON.stringify(parsed));
        setupQuizFromData(parsed);
    } catch (err) {
        console.error("Quiz Fetch Error:", err);
        alert("Failed to load the selected chapter JSON. Please check file formatting.");
    } finally {
        toggleSpinner(false);
    }
}

function setupQuizFromData(data) {
    AppState.units = data.learning_units || [];
    AppState.currentUnitIndex = 0;
    AppState.score = 0;
    AppState.timerSeconds = 0;

    if (!AppState.units.length) {
        alert("This module does not contain any valid learning units.");
        return;
    }

    // Populate header info
    if (DOM.chapterTitle) {
        DOM.chapterTitle.innerText = data.metadata?.chapter_title?.[AppState.currentLang] || data.metadata?.chapter_title?.en || "Learning Module";
    }
    if (DOM.displayStudentName) DOM.displayStudentName.innerText = `👤 ${AppState.studentName}`;
    if (DOM.displaySchoolInfo) DOM.displaySchoolInfo.innerText = `${AppState.selectedClass} •${AppState.selectedSubject}`;
    if (DOM.totalUnitsNum) DOM.totalUnitsNum.innerText = AppState.units.length;
    if (DOM.maxScore) DOM.maxScore.innerText = AppState.units.length * 10;
    if (DOM.masteryScore) DOM.masteryScore.innerText = 0;

    startTimer();
    renderUnitGrid();
    switchScreen('quiz');
    renderCurrentUnit();
}

function restartCurrentModule() {
    AppState.currentUnitIndex = 0;
    AppState.score = 0;
    AppState.timerSeconds = 0;
    if (DOM.masteryScore) DOM.masteryScore.innerText = 0;
    startTimer();
    renderUnitGrid();
    switchScreen('quiz');
    renderCurrentUnit();
}

// ==========================================
// 4. TIMER & GRID SYSTEM
// ==========================================

function startTimer() {
    clearInterval(AppState.timerInterval);
    AppState.timerInterval = setInterval(() => {
        AppState.timerSeconds++;
        const mins = String(Math.floor(AppState.timerSeconds / 60)).padStart(2, '0');
        const secs = String(AppState.timerSeconds % 60).padStart(2, '0');
        if (DOM.timer) DOM.timer.innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(AppState.timerInterval);
}

function renderUnitGrid() {
    if (!DOM.unitGrid) return;
    DOM.unitGrid.innerHTML = '';

    AppState.units.forEach((_, idx) => {
        const cell = document.createElement('div');
        cell.className = 'unit-indicator';
        cell.dataset.index = idx;
        cell.style.cssText = "width:32px; height:32px; border-radius:6px; display:inline-flex; align-items:center; justify-content:center; background:#e2e8f0; font-weight:600; font-size:13px; cursor:pointer; margin:3px;";
        cell.innerText = idx + 1;

        cell.addEventListener('click', () => {
            AppState.currentUnitIndex = idx;
            renderCurrentUnit();
        });

        DOM.unitGrid.appendChild(cell);
    });
}

function updateUnitGridStatus() {
    document.querySelectorAll('.unit-indicator').forEach(node => {
        const idx = parseInt(node.dataset.index, 10);
        node.style.border = (idx === AppState.currentUnitIndex) ? '2px solid #2563eb' : 'none';
    });
}

// ==========================================
// 5. RENDERING, KA-TEX & FORMATTING
// ==========================================

function formatMarkup(str) {
    if (!str) return '';
    let sanitized = String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return sanitized.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9; padding:2px 5px; border-radius:4px; color:#0f172a; font-family:monospace;">$1</code>');
}

function applyKaTeX() {
    if (typeof renderMathInElement === 'function') {
        const containers = [DOM.lessonTheory, DOM.challengePrompt, DOM.targetZone, DOM.fragmentBank, DOM.feedbackBanner, DOM.mediaCaption];
        containers.forEach(el => {
            if (el) {
                renderMathInElement(el, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
                    ],
                    throwOnError: false
                });
            }
        });
    }
}

function setLanguage(lang) {
    AppState.currentLang = lang;
    if (lang === 'en') {
        DOM.btnEn?.classList.add('active');
        DOM.btnHi?.classList.remove('active');
    } else {
        DOM.btnHi?.classList.add('active');
        DOM.btnEn?.classList.remove('active');
    }
    renderCurrentUnit();
}

function renderCurrentUnit() {
    const unit = AppState.units[AppState.currentUnitIndex];
    if (!unit) return;

    const lang = AppState.currentLang;
    const challenge = unit.challenges[lang] || unit.challenges.en;
    const media = unit.instruction.media;

    if (DOM.currentUnitNum) DOM.currentUnitNum.innerText = AppState.currentUnitIndex + 1;
    if (DOM.lessonTitle) DOM.lessonTitle.innerHTML = formatMarkup(unit.instruction.title[lang] || unit.instruction.title.en);
    if (DOM.lessonTheory) DOM.lessonTheory.innerHTML = formatMarkup(unit.instruction.theory[lang] || unit.instruction.theory.en);
    if (DOM.challengePrompt) DOM.challengePrompt.innerHTML = formatMarkup(challenge.prompt);

    // SVG / Media Viewport
    if (DOM.mediaContainer) {
        if (media && media.type === 'svg') {
            DOM.mediaContainer.innerHTML = media.svg_code;
            DOM.mediaContainer.style.display = 'block';
        } else {
            DOM.mediaContainer.innerHTML = '';
            DOM.mediaContainer.style.display = 'none';
        }
    }

    if (DOM.mediaCaption) {
        DOM.mediaCaption.innerHTML = formatMarkup(media?.caption?.[lang] || media?.caption?.en || '');
    }

    // Reset feedback & controls
    if (DOM.feedbackBanner) {
        DOM.feedbackBanner.style.display = 'none';
        DOM.feedbackBanner.innerHTML = '';
    }

    if (DOM.targetZone) {
        DOM.targetZone.classList.remove('success-locked');
        DOM.targetZone.style.pointerEvents = 'auto';
    }

    if (DOM.btnSubmit) DOM.btnSubmit.disabled = true;
    if (DOM.nextBtn) DOM.nextBtn.disabled = true;
    if (DOM.prevBtn) DOM.prevBtn.disabled = (AppState.currentUnitIndex === 0);

    buildFragmentPool(challenge);
    updateUnitGridStatus();
    applyKaTeX();
}

// ==========================================
// 6. DRAG AND DROP & SELECTION SYSTEM
// ==========================================

let activeDraggedItem = null;

function buildFragmentPool(challenge) {
    AppState.assembly = [];
    if (!DOM.targetZone || !DOM.fragmentBank) return;

    DOM.targetZone.innerHTML = '';
    DOM.fragmentBank.innerHTML = '';

    let fragments = [...challenge.target_sequence];
    if (challenge.distractors) {
        fragments = fragments.concat(challenge.distractors);
    }

    // Shuffle
    for (let i = fragments.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fragments[i], fragments[j]] = [fragments[j], fragments[i]];
    }

    fragments.forEach(frag => {
        const chip = document.createElement('div');
        chip.className = 'fragment-chip';
        chip.dataset.id = frag.id;
        chip.innerHTML = formatMarkup(frag.text);
        chip.fragRef = frag;
        chip.style.cssText = "display:inline-block; padding:8px 14px; margin:4px; background:#ffffff; border:1.5px solid #cbd5e1; border-radius:8px; cursor:pointer; font-weight:500; font-size:14px; user-select:none; transition:all 0.15s ease;";

        // Click-to-toggle
        chip.addEventListener('click', () => toggleChipPlacement(chip));

        // Drag-and-drop
        chip.draggable = true;
        chip.addEventListener('dragstart', handleDragStart);
        chip.addEventListener('dragend', handleDragEnd);

        DOM.fragmentBank.appendChild(chip);
    });

    DOM.targetZone.addEventListener('dragover', handleDragOverZone);
}

function toggleChipPlacement(chip) {
    if (DOM.targetZone.classList.contains('success-locked')) return;

    if (chip.parentElement === DOM.fragmentBank) {
        DOM.targetZone.appendChild(chip);
    } else {
        DOM.fragmentBank.appendChild(chip);
    }
    syncAssemblyFromDOM();
}

function handleDragStart(e) {
    if (DOM.targetZone.classList.contains('success-locked')) {
        e.preventDefault();
        return;
    }
    activeDraggedItem = this;
    this.style.opacity = '0.4';
}

function handleDragEnd() {
    this.style.opacity = '1';
    activeDraggedItem = null;
    syncAssemblyFromDOM();
}

function handleDragOverZone(e) {
    e.preventDefault();
    if (!activeDraggedItem || DOM.targetZone.classList.contains('success-locked')) return;

    const afterElement = getDropTargetElement(DOM.targetZone, e.clientX, e.clientY);
    if (afterElement == null) {
        DOM.targetZone.appendChild(activeDraggedItem);
    } else {
        DOM.targetZone.insertBefore(activeDraggedItem, afterElement);
    }
}

function getDropTargetElement(container, x, y) {
    const elements = [...container.querySelectorAll('.fragment-chip:not([style*="opacity: 0.4"])')];
    return elements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (y > box.top && y < box.bottom && offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function syncAssemblyFromDOM() {
    const chips = DOM.targetZone.querySelectorAll('.fragment-chip');
    AppState.assembly = Array.from(chips).map(c => c.fragRef);
    if (DOM.btnSubmit) {
        DOM.btnSubmit.disabled = (AppState.assembly.length === 0);
    }
}

// ==========================================
// 7. VERIFICATION & FEEDBACK
// ==========================================

function verifyAssembly() {
    const unit = AppState.units[AppState.currentUnitIndex];
    const challenge = unit.challenges[AppState.currentLang] || unit.challenges.en;
    const targetSeq = challenge.target_sequence;

    // Check for distractor penalties
    const distractorHit = AppState.assembly.find(f => f.category === 'logical' || f.category === 'grammatical');
    if (distractorHit) {
        renderFeedback(`❌ ${formatMarkup(distractorHit.penalty_explanation)}`, '#ef4444', '#fef2f2');
        return;
    }

    // Sequence too short: provide contextual role hint
    if (AppState.assembly.length < targetSeq.length) {
        const nextTarget = targetSeq[AppState.assembly.length];
        const hintMsg = nextTarget.role_hint?.[AppState.currentLang] || nextTarget.role_hint?.en || nextTarget.role_hint;
        renderFeedback(`💡 <strong>Next Step Hint:</strong> ${formatMarkup(hintMsg)}`, '#0284c7', '#f0f9ff');
        return;
    }

    // Sequence verification
    let correct = true;
    for (let i = 0; i < targetSeq.length; i++) {
        if (AppState.assembly[i].id !== targetSeq[i].id) {
            correct = false;
            break;
        }
    }

    if (correct) {
        const takeaway = unit.key_takeaway?.[AppState.currentLang] || unit.key_takeaway?.en || "Great work!";
        renderFeedback(`✅ <strong>Mastered!</strong><br><br>${formatMarkup(takeaway)}`, '#15803d', '#f0fdf4');
        
        DOM.targetZone.classList.add('success-locked');
        DOM.targetZone.style.pointerEvents = 'none';
        DOM.btnSubmit.disabled = true;
        DOM.nextBtn.disabled = false;

        // Points
        AppState.score += 10;
        if (DOM.masteryScore) DOM.masteryScore.innerText = AppState.score;

        // Grid indicator
        const gridNode = document.querySelector(`.unit-indicator[data-index="${AppState.currentUnitIndex}"]`);
        if (gridNode) {
            gridNode.style.background = '#22c55e';
            gridNode.style.color = '#ffffff';
        }
    } else {
        renderFeedback(`❌ Incorrect arrangement. Reorder the fragments and verify again.`, '#ef4444', '#fef2f2');
    }
}

function handleShowHint() {
    const unit = AppState.units[AppState.currentUnitIndex];
    const challenge = unit.challenges[AppState.currentLang] || unit.challenges.en;
    renderFeedback(`💡 <strong>Hint:</strong> ${formatMarkup(challenge.hint)}`, '#0284c7', '#f0f9ff');
}

function renderFeedback(html, color, bg) {
    if (!DOM.feedbackBanner) return;
    DOM.feedbackBanner.innerHTML = html;
    DOM.feedbackBanner.style.cssText = `display:block; padding:12px 16px; margin-top:12px; border-radius:8px; border:1px solid ${color}; background:${bg}; color:${color}; font-size:14px;`;
    applyKaTeX();
}

function handleNextUnit() {
    if (AppState.currentUnitIndex < AppState.units.length - 1) {
        AppState.currentUnitIndex++;
        renderCurrentUnit();
    } else {
        finishModule();
    }
}

function handlePrevUnit() {
    if (AppState.currentUnitIndex > 0) {
        AppState.currentUnitIndex--;
        renderCurrentUnit();
    }
}

// ==========================================
// 8. MODULE COMPLETION & SYNC
// ==========================================

function finishModule() {
    stopTimer();
    switchScreen('results');

    const totalPossible = AppState.units.length * 10;
    const percentage = totalPossible > 0 ? Math.round((AppState.score / totalPossible) * 100) : 0;
    const mins = String(Math.floor(AppState.timerSeconds / 60)).padStart(2, '0');
    const secs = String(AppState.timerSeconds % 60).padStart(2, '0');

    if (DOM.finalScore) DOM.finalScore.innerText = AppState.score;
    if (DOM.totalPossible) DOM.totalPossible.innerText = totalPossible;
    if (DOM.percentage) DOM.percentage.innerText = `${percentage}%`;
    if (DOM.totalTime) DOM.totalTime.innerText = `${mins}:${secs}`;

    const scorePayload = {
        studentId: AppState.studentName,
        school: AppState.schoolName,
        class: AppState.selectedClass,
        subject: AppState.selectedSubject,
        chapter: AppState.selectedQuizPath,
        score: AppState.score,
        time: `${mins}:${secs}`,
        completedAt: new Date().toISOString()
    };

    transmitScore(scorePayload);
}

async function transmitScore(payload) {
    try {
        await fetch(AppConfig.gasEndpoint, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.warn("Server unreachable. Storing score in local queue.", err);
        const queue = JSON.parse(localStorage.getItem('learnApp_offlineQueue') || '[]');
        queue.push(payload);
        localStorage.setItem('learnApp_offlineQueue', JSON.stringify(queue));
    }
}

async function syncOfflineScores() {
    const queue = JSON.parse(localStorage.getItem('learnApp_offlineQueue') || '[]');
    if (queue.length === 0) return;

    const unSynced = [];
    for (const item of queue) {
        try {
            await fetch(AppConfig.gasEndpoint, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
        } catch {
            unSynced.push(item);
        }
    }
    localStorage.setItem('learnApp_offlineQueue', JSON.stringify(unSynced));
}

// ==========================================
// 9. LEADERBOARD SYSTEM
// ==========================================

async function showScoreboard() {
    switchScreen('scoreboard');
    if (!DOM.scoreboardBody) return;

    DOM.scoreboardBody.innerHTML = '<tr><td colspan="9" style="padding:40px; text-align:center; color: #64748b;">Loading scores...</td></tr>';

    try {
        const res = await fetch(`${AppConfig.gasEndpoint}?action=getScores`);
        const scores = await res.json();

        DOM.scoreboardBody.innerHTML = '';
        if (Array.isArray(scores) && scores.length > 0) {
            scores.forEach((entry, idx) => {
                const dateStr = entry.completedAt ? entry.completedAt.split('T')[0] : 'Recent';
                const chapterClean = entry.chapter ? entry.chapter.split('/').pop().replace('.json', '') : 'Module';

                DOM.scoreboardBody.innerHTML += `
                    <tr style="border-bottom: 1px solid #f1f5f9; text-align: center;">
                        <td style="padding: 12px;"><strong>#${idx + 1}</strong></td>
                        <td style="padding: 12px; font-size:12px; color:#64748b;">${dateStr}</td>
                        <td style="padding: 12px; font-weight:600;">${entry.studentId || 'Guest'}</td>
                        <td style="padding: 12px;">${entry.class || '-'}</td>
                        <td style="padding: 12px;">${entry.subject || '-'}</td>
                        <td style="padding: 12px;">${chapterClean}</td>
                        <td style="padding: 12px;"><span style="background:#eff6ff; color:#1d4ed8; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600;">LEARNING</span></td>
                        <td style="padding: 12px; font-weight:700; color:#16a34a;">${entry.score || 0}</td>
                        <td style="padding: 12px; font-family:monospace;">${entry.time || '--:--'}</td>
                    </tr>
                `;
            });
        } else {
            DOM.scoreboardBody.innerHTML = '<tr><td colspan="9" style="padding:40px; text-align:center; color: #64748b;">No scoreboard records found.</td></tr>';
        }
    } catch (err) {
        console.error("Scoreboard Fetch Error:", err);
        DOM.scoreboardBody.innerHTML = '<tr><td colspan="9" style="padding:40px; text-align:center; color: #ef4444;">Failed to retrieve online scoreboard.</td></tr>';
    }
}
