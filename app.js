/**
 * Learn-App Core Logic (app.js)
 * Fully Integrated: Dynamic Recursive Repo Scanner, Cascading Filters,
 * Drag-and-Drop Assembly, KaTeX Rendering, Offline Score Sync & Leaderboard.
 */

const AppState = {
    // Repository & Backend Configuration
    githubRepo: 'mcaravikantpotdar/Learn-App',
    branch: 'main',
    gasEndpoint: 'https://script.google.com/macros/s/AKfycbxNWnLdQxUnjOCfWHoyZALx-orP0D1v9Q04ic9hl3Ido3W3gOgRoYiq2MuN-bv687I/exec',
    
    // Application Runtime State
    currentLang: 'en',
    repoCatalog: {}, // Structured as: { [class]: { [subject]: [ { title, path } ] } }
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
        leaderboard: document.getElementById('leaderboard-screen')
    },
    
    // Home Screen Controls
    classSelect: document.getElementById('class-select'),
    subjectSelect: document.getElementById('subject-select'),
    quizList: document.getElementById('quiz-list'),
    btnStart: document.getElementById('btn-start'),
    btnViewLeaderboard: document.getElementById('btn-view-leaderboard'),
    btnBackHome: document.getElementById('btn-back-home'),
    studentName: document.getElementById('student-name'),
    schoolName: document.getElementById('school-name'),
    leaderboardTable: document.getElementById('leaderboard-body'),
    
    // Quiz Screen Controls
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
    scanRepositoryTree();
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

    // Quiz Navigation & Verification
    UI.btnCheck?.addEventListener('click', checkAnswer);
    UI.btnNext?.addEventListener('click', nextUnit);

    // Dynamic Cascading Dropdowns
    UI.classSelect?.addEventListener('change', populateSubjects);
    UI.subjectSelect?.addEventListener('change', populateQuizzes);
    UI.btnStart?.addEventListener('click', startQuizWorkflow);
    
    // Leaderboard Controls
    UI.btnViewLeaderboard?.addEventListener('click', showLeaderboard);
    UI.btnBackHome?.addEventListener('click', () => showScreen('home'));
}

function showScreen(screenName) {
    Object.values(UI.screens).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
    if (UI.screens[screenName]) {
        UI.screens[screenName].classList.add('active');
    }
}

// ==========================================
// 2. DYNAMIC GITHUB TREE SCANNER
// ==========================================

async function scanRepositoryTree() {
    toggleSpinner(true);
    const cacheKey = `learnApp_treeCatalog_${AppState.githubRepo}`;
    const cachedTree = sessionStorage.getItem(cacheKey);

    if (cachedTree) {
        AppState.repoCatalog = JSON.parse(cachedTree);
        populateClasses();
        toggleSpinner(false);
        return;
    }

    try {
        // Recursive Git Trees API: Retrieves the complete repo structure in 1 call
        const response = await fetch(`https://api.github.com/repos/${AppState.githubRepo}/git/trees/${AppState.branch}?recursive=1`);
        
        if (!response.ok) {
            throw new Error(`GitHub API returned status ${response.status}`);
        }
        
        const data = await response.json();
        const tree = data.tree || [];
        const catalog = {};

        // Filter and map paths matching: jsons/{Class}/{Subject}/{Chapter}.json
        tree.forEach(node => {
            if (node.type === 'blob' && node.path.startsWith('jsons/') && node.path.endsWith('.json')) {
                const parts = node.path.split('/');
                
                // Format: jsons / [Class] / [Subject] / [File.json]
                if (parts.length === 4) {
                    const className = parts[1];
                    const subjectName = parts[2];
                    const fileName = parts[3];
                    const cleanTitle = fileName.replace('.json', '').replace(/[-_]/g, ' ');

                    if (!catalog[className]) {
                        catalog[className] = {};
                    }
                    if (!catalog[className][subjectName]) {
                        catalog[className][subjectName] = [];
                    }

                    catalog[className][subjectName].push({
                        title: cleanTitle,
                        path: node.path
                    });
                }
            }
        });

        AppState.repoCatalog = catalog;
        sessionStorage.setItem(cacheKey, JSON.stringify(catalog));
        populateClasses();
    } catch (error) {
        console.error("Repository scan failed:", error);
        alert("Failed to load curriculum catalog from GitHub. Please check your network or repository settings.");
    } finally {
        toggleSpinner(false);
    }
}

function populateClasses() {
    if (!UI.classSelect) return;
    UI.classSelect.innerHTML = '<option value="">-- Select Class --</option>';
    
    const classes = Object.keys(AppState.repoCatalog);
    classes.sort().forEach(className => {
        UI.classSelect.innerHTML += `<option value="${className}">${className}</option>`;
    });

    if (UI.subjectSelect) UI.subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
    if (UI.quizList) UI.quizList.innerHTML = '';
}

function populateSubjects() {
    const selectedClass = UI.classSelect.value;
    if (!UI.subjectSelect) return;
    
    UI.subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
    if (UI.quizList) UI.quizList.innerHTML = '';
    AppState.selectedQuizPath = '';

    if (selectedClass && AppState.repoCatalog[selectedClass]) {
        const subjects = Object.keys(AppState.repoCatalog[selectedClass]);
        subjects.sort().forEach(subject => {
            UI.subjectSelect.innerHTML += `<option value="${subject}">${subject}</option>`;
        });
    }
}

function populateQuizzes() {
    const selectedClass = UI.classSelect.value;
    const selectedSubject = UI.subjectSelect.value;
    if (!UI.quizList) return;
    
    UI.quizList.innerHTML = '';
    AppState.selectedQuizPath = '';

    if (selectedClass && selectedSubject && AppState.repoCatalog[selectedClass][selectedSubject]) {
        const quizzes = AppState.repoCatalog[selectedClass][selectedSubject];
        
        quizzes.forEach(quiz => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'quiz-btn';
            btn.innerText = quiz.title;
            btn.dataset.path = quiz.path;

            btn.addEventListener('click', () => {
                document.querySelectorAll('.quiz-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                AppState.selectedQuizPath = quiz.path;
            });

            UI.quizList.appendChild(btn);
        });
    }
}

// ==========================================
// 3. QUIZ WORKFLOW & DATA LOADING
// ==========================================

async function startQuizWorkflow() {
    const studentName = UI.studentName?.value.trim();
    const school = UI.schoolName?.value.trim();

    if (!studentName) {
        alert("Please enter your name.");
        UI.studentName?.focus();
        return;
    }

    if (!AppState.selectedQuizPath) {
        alert("Please select a chapter from the list.");
        return;
    }

    AppState.studentId = studentName;
    AppState.schoolName = school || 'General';

    await loadQuizData(AppState.selectedQuizPath);
}

async function loadQuizData(filePath) {
    toggleSpinner(true);
    const cacheKey = `learnApp_file_${filePath}`;
    const cachedFile = sessionStorage.getItem(cacheKey);

    if (cachedFile) {
        const parsed = JSON.parse(cachedFile);
        AppState.units = parsed.learning_units || [];
        toggleSpinner(false);
        initModule();
        return;
    }

    try {
        const response = await fetch(`https://api.github.com/repos/${AppState.githubRepo}/contents/${filePath}?ref=${AppState.branch}`);
        if (!response.ok) throw new Error(`Could not fetch file: ${response.statusText}`);

        const fileData = await response.json();
        const decodedContent = decodeURIComponent(escape(atob(fileData.content)));
        const parsedJson = JSON.parse(decodedContent);

        sessionStorage.setItem(cacheKey, JSON.stringify(parsedJson));
        AppState.units = parsedJson.learning_units || [];
        initModule();
    } catch (error) {
        console.error("Quiz load error:", error);
        alert("Error loading chapter data. Please verify the JSON file structure.");
    } finally {
        toggleSpinner(false);
    }
}

function initModule() {
    if (!AppState.units.length) {
        alert("This chapter has no available learning units.");
        return;
    }
    AppState.currentUnitIndex = 0;
    AppState.score = 0;
    buildQuestionGrid();
    showScreen('quiz');
    renderCurrentUnit();
}

function toggleSpinner(show) {
    if (UI.spinner) {
        UI.spinner.classList.toggle('active', show);
    }
}

// ==========================================
// 4. RENDERING, SANITIZATION & KATEX
// ==========================================

function formatText(text) {
    if (!text) return '';
    let safe = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    safe = safe.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    return safe;
}

function triggerMathRender() {
    if (typeof renderMathInElement === 'function') {
        const targets = ['.theory-content', '.prompt-bar', '.feedback-banner', '.fragment-chip', '.media-caption'];
        targets.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                renderMathInElement(el, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
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

    if (UI.lessonTitle) UI.lessonTitle.innerHTML = formatText(unit.instruction.title[lang] || unit.instruction.title.en);
    if (UI.theoryContent) UI.theoryContent.innerHTML = formatText(unit.instruction.theory[lang] || unit.instruction.theory.en);
    if (UI.promptBar) UI.promptBar.innerHTML = formatText(challenge.prompt);
    
    if (UI.mediaViewport) {
        if (media && media.type === 'svg') {
            UI.mediaViewport.innerHTML = media.svg_code;
        } else {
            UI.mediaViewport.innerHTML = '';
        }
    }
    
    if (UI.mediaCaption) {
        UI.mediaCaption.innerHTML = formatText(media?.caption?.[lang] || media?.caption?.en || '');
    }

    if (UI.feedbackBanner) {
        UI.feedbackBanner.className = 'feedback-banner';
        UI.feedbackBanner.innerHTML = '';
    }
    
    if (UI.btnCheck) UI.btnCheck.disabled = false;
    if (UI.btnNext) UI.btnNext.disabled = true;
    if (UI.assemblyLine) UI.assemblyLine.classList.remove('success-lock');

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
    if (!UI.assemblyLine || !UI.fragmentPool) return;
    
    UI.assemblyLine.innerHTML = '';
    UI.fragmentPool.innerHTML = '';

    let allFragments = [...challenge.target_sequence];
    if (challenge.distractors) {
        allFragments = allFragments.concat(challenge.distractors);
    }
    
    // Fisher-Yates shuffle
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

        // Click to toggle between pool and assembly line
        chip.addEventListener('click', () => toggleFragment(chip));
        
        // Drag-and-drop support
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
// 6. VALIDATION & FEEDBACK ENGINE
// ==========================================

function checkAnswer() {
    const unit = AppState.units[AppState.currentUnitIndex];
    const challenge = unit.challenges[AppState.currentLang] || unit.challenges.en;
    const targets = challenge.target_sequence;

    if (AppState.assembly.length === 0) return;

    // Check for distractor penalties
    const distractor = AppState.assembly.find(f => f.category === 'logical' || f.category === 'grammatical');
    if (distractor) {
        showFeedback(`❌ ${formatText(distractor.penalty_explanation)}`, 'error');
        return;
    }

    // Sequence too short: provide contextual role hint
    if (AppState.assembly.length < targets.length) {
        const nextExpected = targets[AppState.assembly.length];
        const hintText = nextExpected.role_hint?.[AppState.currentLang] || nextExpected.role_hint?.en || nextExpected.role_hint;
        showFeedback(`💡 <strong>Hint:</strong> ${formatText(hintText)}`, 'secondary');
        return;
    }

    // Verify ordering
    let isCorrect = true;
    for (let i = 0; i < targets.length; i++) {
        if (AppState.assembly[i].id !== targets[i].id) {
            isCorrect = false;
            break;
        }
    }

    if (isCorrect) {
        const takeaway = unit.key_takeaway?.[AppState.currentLang] || unit.key_takeaway?.en || 'Great job!';
        showFeedback(`✅ <strong>Correct!</strong><br><br>${formatText(takeaway)}`, 'success');
        UI.assemblyLine.classList.add('success-lock');
        UI.btnCheck.disabled = true;
        UI.btnNext.disabled = false;
        
        AppState.score += 10;
        
        const qNode = document.querySelector(`.question-number[data-index="${AppState.currentUnitIndex}"]`);
        if (qNode) qNode.classList.add('correct');
    } else {
        showFeedback(`❌ The sequence is incorrect. Reorder the fragments and check again.`, 'error');
    }
}

function showFeedback(html, type) {
    if (!UI.feedbackBanner) return;
    UI.feedbackBanner.innerHTML = html;
    UI.feedbackBanner.className = `feedback-banner ${type}`;
    triggerMathRender();
}

// ==========================================
// 7. PROGRESSION & OFFLINE QUEUE
// ==========================================

function buildQuestionGrid() {
    if (!UI.questionGrid) return;
    UI.questionGrid.innerHTML = '';
    
    AppState.units.forEach((_, index) => {
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
        if (parseInt(node.dataset.index, 10) === AppState.currentUnitIndex) {
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
    if (UI.mediaViewport) {
        UI.mediaViewport.innerHTML = `<div style="text-align:center; padding: 40px; color: #38bdf8;"><h3>🎉 Module Complete!</h3><p>Your score: ${AppState.score}</p></div>`;
    }
    if (UI.theoryContent) UI.theoryContent.innerHTML = "Congratulations! You have completed all interactive units for this chapter.";
    if (UI.btnNext) UI.btnNext.style.display = 'none';
    if (UI.btnCheck) UI.btnCheck.style.display = 'none';
    if (UI.assemblyLine) UI.assemblyLine.innerHTML = '';
    if (UI.fragmentPool) UI.fragmentPool.innerHTML = '';
    
    const payload = {
        studentId: AppState.studentId,
        school: AppState.schoolName,
        chapter: AppState.selectedQuizPath,
        score: AppState.score,
        completedAt: new Date().toISOString()
    };
    saveScore(payload);
}

async function saveScore(payload) {
    try {
        await fetch(AppState.gasEndpoint, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.warn("Server unavailable. Queuing score locally for offline sync.");
        const queue = JSON.parse(localStorage.getItem('offlineScoreQueue') || '[]');
        queue.push(payload);
        localStorage.setItem('offlineScoreQueue', JSON.stringify(queue));
    }
}

async function syncOfflineScores() {
    const queue = JSON.parse(localStorage.getItem('offlineScoreQueue') || '[]');
    if (queue.length === 0) return;
    
    const remaining = [];
    for (const item of queue) {
        try {
            await fetch(AppState.gasEndpoint, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
        } catch (err) {
            remaining.push(item);
        }
    }
    localStorage.setItem('offlineScoreQueue', JSON.stringify(remaining));
}

// ==========================================
// 8. LEADERBOARD SYSTEM
// ==========================================

async function showLeaderboard() {
    showScreen('leaderboard');
    if (!UI.leaderboardTable) return;
    
    UI.leaderboardTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading scores...</td></tr>';
    
    try {
        const response = await fetch(`${AppState.gasEndpoint}?action=getScores`);
        const data = await response.json();
        
        UI.leaderboardTable.innerHTML = '';
        if (Array.isArray(data) && data.length > 0) {
            data.forEach((entry, idx) => {
                UI.leaderboardTable.innerHTML += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${entry.studentId || 'Guest'}</td>
                        <td>${entry.school || 'General'}</td>
                        <td><strong>${entry.score || 0}</strong></td>
                    </tr>
                `;
            });
        } else {
            UI.leaderboardTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">No scores found.</td></tr>';
        }
    } catch (error) {
        console.error("Leaderboard fetch error:", error);
        UI.leaderboardTable.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#ef4444;">Failed to load leaderboard.</td></tr>';
    }
}
