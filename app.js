/**
 * Learn-App Core Logic (app.js)
 * Hardened Architecture: Full Lifecycle, Caching, Offline Support, Sanitization, Math Rendering & Drag-Drop
 */

const AppState = {
    // --- CONFIGURATION ---
    githubRepo: 'mcaravikantpotdar/Learn-App', // e.g., 'LearnApp/curriculum'
    gasEndpoint: 'https://script.google.com/macros/s/AKfycbxNWnLdQxUnjOCfWHoyZALx-orP0D1v9Q04ic9hl3Ido3W3gOgRoYiq2MuN-bv687I/exec',        // Your deployment web app URL
    // ---------------------
    currentLang: 'en',
    curriculumManifest: null,
    selectedQuizPath: '',
    units: [],
    currentUnitIndex: 0,
    assembly: [],
    score: 0,
    studentId: '',
    schoolName: ''
};

const UI = {
    screens: {
        home: document.getElementById('home-screen'),
        quiz: document.getElementById('quiz-screen'),
        leaderboard: document.getElementById('leaderboard-screen') // Assuming you have a wrapper for leaderboard
    },
    
    // --- Home Screen Elements ---
    classSelect: document.getElementById('class-select'),
    subjectSelect: document.getElementById('subject-select'),
    quizList: document.getElementById('quiz-list'),
    btnStart: document.getElementById('btn-start'),
    btnViewLeaderboard: document.getElementById('btn-view-leaderboard'),
    btnBackHome: document.getElementById('btn-back-home'),
    studentName: document.getElementById('student-name'),
    schoolName: document.getElementById('school-name'),
    leaderboardTable: document.getElementById('leaderboard-body'),
    
    // --- Quiz Screen Elements ---
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
// 1. INITIALIZATION & ROUTING
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    syncOfflineScores();
    loadManifest(); // Load the Class/Subject structure on startup
});

function bindEvents() {
    // Language Toggles
    UI.langBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            UI.langBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            AppState.currentLang = e.target.dataset.lang;
            renderCurrentUnit();
        });
    });

    // Quiz Actions
    UI.btnCheck?.addEventListener('click', checkAnswer);
    UI.btnNext?.addEventListener('click', nextUnit);

    // Home Screen Actions
    UI.classSelect?.addEventListener('change', populateSubjects);
    UI.subjectSelect?.addEventListener('change', populateQuizzes);
    UI.btnStart?.addEventListener('click', startQuizWorkflow);
    
    // Leaderboard Actions
    UI.btnViewLeaderboard?.addEventListener('click', showLeaderboard);
    UI.btnBackHome?.addEventListener('click', () => showScreen('home'));
}

function showScreen(screenName) {
    Object.values(UI.screens).forEach(s => s?.classList.remove('active'));
    UI.screens[screenName]?.classList.add('active');
}

// ==========================================
// 2. HOME SCREEN: CASCADING DROPDOWNS & MANIFEST
// ==========================================

async function loadManifest() {
    if(UI.spinner) UI.spinner.classList.add('active');
    const cacheKey = 'learnApp_manifest_cache';
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
        AppState.curriculumManifest = JSON.parse(cachedData);
        populateClasses();
        if(UI.spinner) UI.spinner.classList.remove('active');
        return;
    }

    try {
        // Assuming a manifest.json exists at root detailing the folder structure
        const res = await fetch(`https://api.github.com/repos/${AppState.githubRepo}/contents/manifest.json`);
        if (!res.ok) throw new Error("Manifest not found or rate limit hit.");
        
        const data = await res.json();
        const decodedContent = decodeURIComponent(escape(atob(data.content)));
        AppState.curriculumManifest = JSON.parse(decodedContent);
        
        sessionStorage.setItem(cacheKey, JSON.stringify(AppState.curriculumManifest));
        populateClasses();
    } catch (error) {
        console.error("Failed to load manifest:", error);
        // Fallback or error state
    } finally {
        if(UI.spinner) UI.spinner.classList.remove('active');
    }
}

function populateClasses() {
    if (!UI.classSelect || !AppState.curriculumManifest) return;
    UI.classSelect.innerHTML = '<option value="">Select Class</option>';
    Object.keys(AppState.curriculumManifest).forEach(className => {
        UI.classSelect.innerHTML += `<option value="${className}">${className}</option>`;
    });
    UI.subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    UI.quizList.innerHTML = '';
}

function populateSubjects() {
    const selectedClass = UI.classSelect.value;
    UI.subjectSelect.innerHTML = '<option value="">Select Subject</option>';
    UI.quizList.innerHTML = '';
    
    if (selectedClass && AppState.curriculumManifest[selectedClass]) {
        Object.keys(AppState.curriculumManifest[selectedClass]).forEach(subject => {
            UI.subjectSelect.innerHTML += `<option value="${subject}">${subject}</option>`;
        });
    }
}

function populateQuizzes() {
    const selectedClass = UI.classSelect.value;
    const selectedSubject = UI.subjectSelect.value;
    UI.quizList.innerHTML = '';
    
    if (selectedClass && selectedSubject) {
        const quizzes = AppState.curriculumManifest[selectedClass][selectedSubject];
        quizzes.forEach(quiz => {
            const btn = document.createElement('button');
            btn.className = 'quiz-btn';
            btn.innerText = quiz.title;
            btn.dataset.path = quiz.path; // e.g., 'Ch5-HTML.json'
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.quiz-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                AppState.selectedQuizPath = btn.dataset.path;
            });
            UI.quizList.appendChild(btn);
        });
    }
}

// ==========================================
// 3. QUIZ INITIALIZATION & FETCHING
// ==========================================

async function startQuizWorkflow() {
    const studentName = UI.studentName?.value.trim();
    const schoolName = UI.schoolName?.value.trim();
    
    if (!studentName || !AppState.selectedQuizPath) {
        alert("Please enter your name and select a chapter to begin.");
        return;
    }
    
    AppState.studentId = studentName;
    AppState.schoolName = schoolName || 'Unknown School';
    
    await loadQuizData(AppState.selectedQuizPath);
}

async function loadQuizData(filePath) {
    if(UI.spinner) UI.spinner.classList.add('active');
    const cacheKey = `learnApp_quiz_${filePath}`;
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
        AppState.units = JSON.parse(cachedData).learning_units || [];
        initModule();
        return;
    }

    try {
        const res = await fetch(`https://api.github.com/repos/${AppState.githubRepo}/contents/${filePath}`);
        if (!res.ok) throw new Error("Failed to load quiz data.");
        
        const data = await res.json();
        const decodedContent = decodeURIComponent(escape(atob(data.content)));
        const parsedJson = JSON.parse(decodedContent);
        
        sessionStorage.setItem(cacheKey, JSON.stringify(parsedJson));
        AppState.units = parsedJson.learning_units || [];
        initModule();
    } catch (error) {
        console.error("Quiz load error:", error);
        alert("Could not load the chapter data. Please try again.");
    } finally {
        if(UI.spinner) UI.spinner.classList.remove('active');
    }
}

function initModule() {
    AppState.currentUnitIndex = 0;
    AppState.score = 0;
    buildQuestionGrid();
    showScreen('quiz');
    renderCurrentUnit();
}

// ==========================================
// 4. RENDERING & AGGRESSIVE SANITIZATION
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
// 5. FRAGMENT ASSEMBLY & DRAG-AND-DROP
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
// 6. VALIDATION & FEEDBACK
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
        
        AppState.score += 10; // Accumulate score
        
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
// 7. NAVIGATION & OFFLINE DATA SAVING
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
        studentId: AppState.studentId,
        school: AppState.schoolName,
        chapter: AppState.units[0]?.chapter_id || "Unknown",
        score: AppState.score,
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

// ==========================================
// 8. LEADERBOARD
// ==========================================

async function showLeaderboard() {
    showScreen('leaderboard');
    if (!UI.leaderboardTable) return;
    
    UI.leaderboardTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading scores...</td></tr>';
    
    try {
        const res = await fetch(`${AppState.gasEndpoint}?action=getScores`);
        const data = await res.json();
        
        UI.leaderboardTable.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach((row, index) => {
                UI.leaderboardTable.innerHTML += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${row.studentId || 'Guest'}</td>
                        <td>${row.school || 'N/A'}</td>
                        <td><strong>${row.score || 0}</strong></td>
                    </tr>
                `;
            });
        } else {
            UI.leaderboardTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">No scores recorded yet.</td></tr>';
        }
    } catch (error) {
        console.error("Leaderboard fetch error:", error);
        UI.leaderboardTable.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Failed to load leaderboard.</td></tr>';
    }
}
