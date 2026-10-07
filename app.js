/**
 * LearnApp Core Controller (app.js)
 * Fully Aligned with Student Authentication (Sheet2), Real-Time GitHub Tree
 * Discovery, Interactive Sequencing, KaTeX, and Cloud Telemetry.
 */

const AppConfig = {
    githubRepo: 'mcaravikantpotdar/Learn-App',
    branch: 'main',
    gasEndpoint: 'https://script.google.com/macros/s/AKfycbxNWnLdQxUnjOCfWHoyZALx-orP0D1v9Q04ic9hl3Ido3W3gOgRoYiq2MuN-bv687I/exec'
};

const AppState = {
    currentLang: 'en',
    repoCatalog: {}, 
    selectedClass: '',
    selectedSubject: '',
    selectedQuizPath: '',
    chapterTitleString: '',
    units: [],
    currentUnitIndex: 0,
    assembly: [],
    score: 0,
    maxScore: 0,
    unitProgress: {}, 
    
    // Authenticated Student State (Loaded from Sheet2)
    studentAuth: {
        isVerified: false,
        studentId: '',
        studentName: '',
        schoolName: ''
    },

    timerSeconds: 0,
    timerInterval: null,
    scoreboardData: [],
    sortConfig: { key: 'date', asc: false }
};

// 1-to-1 Mapping to index.html DOM IDs
const DOM = {
    screens: {
        upload: document.getElementById('uploadScreen'),
        quiz: document.getElementById('quizScreen'),
        results: document.getElementById('resultsScreen'),
        scoreboard: document.getElementById('scoreboardScreen')
    },
    spinner: document.getElementById('loadingSpinner'),
    errorMessage: document.getElementById('errorMessage'),

    // Authentication Elements
    studentIdInput: document.getElementById('studentIdInput'),
    verifyStudentBtn: document.getElementById('verifyStudentBtn'),
    authStatusBadge: document.getElementById('authStatusBadge'),
    authStatusText: document.getElementById('authStatusText'),

    // Curriculum Selection Elements
    classSelect: document.getElementById('classSelect'),
    subjectGroup: document.getElementById('subjectGroup'),
    subjectSelect: document.getElementById('subjectSelect'),
    lessonGroup: document.getElementById('lessonGroup'),
    quizList: document.getElementById('quizList'),
    startQuiz: document.getElementById('startQuiz'),
    viewScoreboardBtn: document.getElementById('viewScoreboardBtn'),

    // Workbench Elements
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

    // Results Dashboard Elements
    finalScore: document.getElementById('finalScore'),
    totalPossible: document.getElementById('totalPossible'),
    percentage: document.getElementById('percentage'),
    totalTime: document.getElementById('totalTime'),
    retakeBtn: document.getElementById('retakeBtn'),
    viewScoreboardFromResults: document.getElementById('viewScoreboardFromResults'),
    homeBtn: document.getElementById('homeBtn'),

    // Scoreboard Elements
    backFromScoreboard: document.getElementById('backFromScoreboard'),
    leaderboardHeaders: document.getElementById('leaderboardHeaders'),
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
    // Student Authentication Listeners
    DOM.verifyStudentBtn?.addEventListener('click', handleStudentVerification);
    DOM.studentIdInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleStudentVerification();
    });

    // Navigation & Screen Switches
    DOM.topHomeBtn?.addEventListener('click', resetToMainMenu);
    DOM.homeBtn?.addEventListener('click', resetToMainMenu);
    DOM.topQuitBtn?.addEventListener('click', finishModule);
    DOM.retakeBtn?.addEventListener('click', restartCurrentModule);
    
    const showScore = () => { switchScreen('scoreboard'); fetchScoreboard(); };
    DOM.viewScoreboardBtn?.addEventListener('click', showScore);
    DOM.viewScoreboardFromResults?.addEventListener('click', showScore);
    
    DOM.backFromScoreboard?.addEventListener('click', () => {
        if (AppState.units.length > 0) switchScreen('quiz');
        else switchScreen('upload');
    });

    if (DOM.leaderboardHeaders) {
        DOM.leaderboardHeaders.addEventListener('click', (e) => {
            const th = e.target.closest('th');
            if (th && th.dataset.sort) sortScoreboard(th.dataset.sort);
        });
    }

    // Curriculum Selection Cascades
    DOM.classSelect?.addEventListener('change', handleClassChange);
    DOM.subjectSelect?.addEventListener('change', handleSubjectChange);
    DOM.startQuiz?.addEventListener('click', handleStartQuiz);

    // Bilingual Toggles
    DOM.btnEn?.addEventListener('click', () => setLanguage('en'));
    DOM.btnHi?.addEventListener('click', () => setLanguage('hi'));

    // Workbench Interaction
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

function resetToMainMenu() {
    stopTimer();
    AppState.units = [];
    AppState.selectedQuizPath = '';
    AppState.currentUnitIndex = 0;
    AppState.score = 0;
    
    if (DOM.quizList) {
        document.querySelectorAll('.quiz-select-btn').forEach(b => b.classList.remove('selected'));
    }
    validateStartReady();
    switchScreen('upload');
}

function toggleSpinner(show) {
    if (DOM.spinner) DOM.spinner.classList.toggle('active', show);
}

// ==========================================
// 2. STUDENT VERIFICATION SYSTEM (SHEET2)
// ==========================================

async function handleStudentVerification() {
    const rawId = DOM.studentIdInput?.value.trim().toUpperCase();
    if (!rawId) {
        setAuthBadgeState('error', 'Please enter a valid Student ID.');
        return;
    }

    toggleSpinner(true);
    setAuthBadgeState('unverified', 'Verifying ID against student database...');

    try {
        const url = `${AppConfig.gasEndpoint}?action=verifyStudent&studentId=${encodeURIComponent(rawId)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.success && data.found) {
            AppState.studentAuth.isVerified = true;
            AppState.studentAuth.studentId = data.studentId;
            AppState.studentAuth.studentName = data.studentName;
            AppState.studentAuth.schoolName = data.schoolName;

            setAuthBadgeState('verified', `Verified: ${data.studentName} (${data.schoolName})`);
        } else {
            AppState.studentAuth.isVerified = false;
            setAuthBadgeState('error', data.message || 'Student ID not recognized in database.');
        }
    } catch (err) {
        console.error("Auth Error:", err);
        AppState.studentAuth.isVerified = false;
        setAuthBadgeState('error', 'Server unreachable. Verification failed.');
    } finally {
        toggleSpinner(false);
        validateStartReady();
    }
}

function setAuthBadgeState(state, message) {
    if (!DOM.authStatusBadge || !DOM.authStatusText) return;

    DOM.authStatusBadge.className = `auth-status-badge ${state}`;
    DOM.authStatusText.innerText = message;
}

// ==========================================
// 3. DYNAMIC GITHUB TREE SCANNER
// ==========================================

async function scanRepositoryTree() {
    toggleSpinner(true);
    if (DOM.errorMessage) DOM.errorMessage.style.display = 'none';

    try {
        // Standard clean GitHub Git Trees endpoint
        const url = `https://api.github.com/repos/${AppConfig.githubRepo}/git/trees/${AppConfig.branch}?recursive=1`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error(`GitHub API Error ${res.status}:${res.statusText}`);
        
        const data = await res.json();
        const catalog = {};

        (data.tree || []).forEach(node => {
            if (node.type === 'blob' && node.path.startsWith('jsons/') && node.path.toLowerCase().endsWith('.json')) {
                const segments = node.path.split('/');
                
                // Matches structure: jsons / [Class] / [Subject] / [File.json]
                if (segments.length >= 4) {
                    const cls = cleanTitleFormat(segments[1]);
                    const subj = cleanTitleFormat(segments[2]);
                    const fileName = segments[segments.length - 1];
                    const title = cleanTitleFormat(fileName.replace(/\.json$/i, ''));

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
        populateClassDropdown();
    } catch (err) {
        console.error("Scanner Error:", err);
        if (DOM.errorMessage) {
            DOM.errorMessage.innerText = `Library Load Error: ${err.message}`;
            DOM.errorMessage.style.display = 'block';
        }
    } finally {
        toggleSpinner(false);
    }
}

function cleanTitleFormat(str) {
    return str.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
    validateStartReady();
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
    validateStartReady();
}

function handleSubjectChange() {
    AppState.selectedSubject = DOM.subjectSelect.value;
    AppState.selectedQuizPath = '';

    if (!DOM.quizList) return;
    DOM.quizList.innerHTML = '';

    if (AppState.selectedClass && AppState.selectedSubject) {
        const quizzes = AppState.repoCatalog[AppState.selectedClass][AppState.selectedSubject] || [];
        
        quizzes.forEach(quiz => {
            const btn = document.createElement('div');
            btn.className = 'quiz-select-btn';
            btn.innerText = `📂 ${quiz.title}`;

            btn.addEventListener('click', () => {
                document.querySelectorAll('.quiz-select-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                AppState.selectedQuizPath = quiz.path;
                validateStartReady();
            });

            DOM.quizList.appendChild(btn);
        });

        if (DOM.lessonGroup) DOM.lessonGroup.style.display = 'block';
    } else {
        if (DOM.lessonGroup) DOM.lessonGroup.style.display = 'none';
    }
    validateStartReady();
}

function validateStartReady() {
    const isAuth = AppState.studentAuth.isVerified;
    const isPathValid = AppState.selectedQuizPath && AppState.selectedQuizPath.length > 0;
    
    if (DOM.startQuiz) {
        DOM.startQuiz.disabled = !(isAuth && isPathValid);
    }
}

// ==========================================
// 4. QUIZ INITIALIZATION & PARSING
// ==========================================

async function handleStartQuiz() {
    toggleSpinner(true);
    try {
        const url = `https://api.github.com/repos/${AppConfig.githubRepo}/contents/${AppState.selectedQuizPath}?ref=${AppConfig.branch}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch chapter error: ${res.statusText}`);

        const fileJson = await res.json();
        const rawContent = decodeURIComponent(escape(atob(fileJson.content)));
        const parsed = JSON.parse(rawContent);

        setupQuizFromData(parsed);
    } catch (err) {
        console.error("Quiz Fetch Error:", err);
        alert("Failed to load chapter JSON. Verify JSON syntax and integrity.");
    } finally {
        toggleSpinner(false);
    }
}

function setupQuizFromData(data) {
    AppState.units = data.learning_units || [];
    AppState.currentUnitIndex = 0;
    AppState.score = 0;
    AppState.timerSeconds = 0;
    AppState.unitProgress = {};

    if (!AppState.units.length) {
        alert("This module does not contain any valid learning units.");
        return;
    }

    // Dynamic max score based on units length
    const masteryPerUnit = data.metadata?.scoring_model?.dual_language_mastery_max || 20;
    AppState.maxScore = AppState.units.length * masteryPerUnit;
    AppState.chapterTitleString = data.metadata?.chapter_title?.en || "Learning Module";

    AppState.units.forEach((_, idx) => {
        AppState.unitProgress[idx] = {
            attempted: false,
            enSolved: false,
            hiSolved: false,
            marks: 0
        };
    });

    if (DOM.chapterTitle) {
        DOM.chapterTitle.innerText = data.metadata?.chapter_title?.[AppState.currentLang] || data.metadata?.chapter_title?.en || "Learning Module";
    }
    if (DOM.displayStudentName) DOM.displayStudentName.innerText = `👤 ${AppState.studentAuth.studentName}`;
    if (DOM.displaySchoolInfo) DOM.displaySchoolInfo.innerText = `${AppState.selectedClass} •${AppState.selectedSubject}`;
    if (DOM.totalUnitsNum) DOM.totalUnitsNum.innerText = AppState.units.length;
    if (DOM.maxScore) DOM.maxScore.innerText = AppState.maxScore;
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
    AppState.unitProgress = {};
    AppState.units.forEach((_, idx) => {
        AppState.unitProgress[idx] = { attempted: false, enSolved: false, hiSolved: false, marks: 0 };
    });
    if (DOM.masteryScore) DOM.masteryScore.innerText = 0;
    startTimer();
    renderUnitGrid();
    switchScreen('quiz');
    renderCurrentUnit();
}

// ==========================================
// 5. TIMER & QUESTION GRID (WITH MARKS)
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
        const div = document.createElement('div');
        div.className = 'question-number';
        div.dataset.index = idx;
        
        div.innerHTML = `
            <div class="q-number">${idx + 1}</div>
            <div class="marks" id="marks-${idx}">0</div>
        `;

        div.addEventListener('click', () => {
            AppState.currentUnitIndex = idx;
            renderCurrentUnit();
        });

        DOM.unitGrid.appendChild(div);
    });
}

function updateUnitGridStatus() {
    AppState.units.forEach((_, idx) => {
        const node = document.querySelector(`.question-number[data-index="${idx}"]`);
        const marksEl = document.getElementById(`marks-${idx}`);
        const p = AppState.unitProgress[idx];
        if (!node) return;

        node.className = 'question-number';
        
        if (p.marks >= 20) {
            node.classList.add('correct');
        } else if (p.marks >= 10) {
            node.classList.add('correct');
        } else if (p.attempted) {
            node.classList.add('attempted');
        }

        if (idx === AppState.currentUnitIndex) {
            node.classList.add('current');
        }

        if (marksEl) {
            marksEl.innerText = p.marks > 0 ? `+${p.marks}` : '0';
        }
    });

    updateLanguageButtonsStatus();
}

function updateLanguageButtonsStatus() {
    const p = AppState.unitProgress[AppState.currentUnitIndex];
    if (!p) return;

    if (DOM.btnEn) {
        DOM.btnEn.innerText = p.enSolved ? "English ✅ [10 pts]" : "English [10 pts]";
    }
    if (DOM.btnHi) {
        DOM.btnHi.innerText = p.hiSolved ? "हिंदी ✅ [10 pts]" : "हिंदी [10 pts]";
    }
}

// ==========================================
// 6. RENDERING, KA-TEX & FORMATTING
// ==========================================

function formatMarkup(str) {
    if (!str) return '';
    let sanitized = String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return sanitized.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
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

    if (DOM.feedbackBanner) {
        DOM.feedbackBanner.style.display = 'none';
        DOM.feedbackBanner.innerHTML = '';
    }

    const currentProgress = AppState.unitProgress[AppState.currentUnitIndex];
    const isAlreadySolved = (lang === 'en' && currentProgress.enSolved) || (lang === 'hi' && currentProgress.hiSolved);

    if (DOM.targetZone) {
        if (isAlreadySolved) {
            DOM.targetZone.classList.add('success-locked');
            DOM.targetZone.style.pointerEvents = 'none';
        } else {
            DOM.targetZone.classList.remove('success-locked');
            DOM.targetZone.style.pointerEvents = 'auto';
        }
    }

    if (DOM.btnSubmit) DOM.btnSubmit.disabled = isAlreadySolved;
    if (DOM.nextBtn) DOM.nextBtn.disabled = !isAlreadySolved;
    if (DOM.prevBtn) DOM.prevBtn.disabled = (AppState.currentUnitIndex === 0);

    buildFragmentPool(challenge, isAlreadySolved);
    updateUnitGridStatus();
    applyKaTeX();
}

// ==========================================
// 7. DRAG AND DROP & SELECTION SYSTEM
// ==========================================

let activeDraggedItem = null;

function buildFragmentPool(challenge, isLocked = false) {
    AppState.assembly = [];
    if (!DOM.targetZone || !DOM.fragmentBank) return;

    DOM.targetZone.innerHTML = '';
    DOM.fragmentBank.innerHTML = '';

    if (isLocked) {
        challenge.target_sequence.forEach(frag => {
            const chip = document.createElement('div');
            chip.className = 'fragment-chip';
            chip.dataset.id = frag.id;
            chip.innerHTML = formatMarkup(frag.text);
            chip.fragRef = frag;
            DOM.targetZone.appendChild(chip);
        });
        return;
    }

    let fragments = [...challenge.target_sequence];
    if (challenge.distractors) {
        fragments = fragments.concat(challenge.distractors);
    }

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

        chip.addEventListener('click', () => toggleChipPlacement(chip));
        chip.draggable = true;
        chip.addEventListener('dragstart', handleDragStart);
        chip.addEventListener('dragend', handleDragEnd);

        DOM.fragmentBank.appendChild(chip);
    });

    DOM.targetZone.addEventListener('dragover', handleDragOverZone);
}

function toggleChipPlacement(chip) {
    if (DOM.targetZone.classList.contains('success-locked')) return;

    AppState.unitProgress[AppState.currentUnitIndex].attempted = true;
    updateUnitGridStatus();

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
    this.classList.add('dragging');
}

function handleDragEnd() {
    this.classList.remove('dragging');
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
    const elements = [...container.querySelectorAll('.fragment-chip:not(.dragging)')];
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
// 8. VERIFICATION & FEEDBACK
// ==========================================

function verifyAssembly() {
    const unit = AppState.units[AppState.currentUnitIndex];
    const lang = AppState.currentLang;
    const challenge = unit.challenges[lang] || unit.challenges.en;
    const targetSeq = challenge.target_sequence;
    const p = AppState.unitProgress[AppState.currentUnitIndex];

    p.attempted = true;

    const distractorHit = AppState.assembly.find(f => f.category === 'logical' || f.category === 'grammatical');
    if (distractorHit) {
        renderFeedback(`❌ ${formatMarkup(distractorHit.penalty_explanation)}`, '#ef4444', '#fef2f2');
        updateUnitGridStatus();
        return;
    }

    if (AppState.assembly.length < targetSeq.length) {
        const nextTarget = targetSeq[AppState.assembly.length];
        const hintMsg = nextTarget.role_hint?.[lang] || nextTarget.role_hint?.en || nextTarget.role_hint;
        renderFeedback(`💡 <strong>Next Step Hint:</strong> ${formatMarkup(hintMsg)}`, '#0284c7', '#f0f9ff');
        updateUnitGridStatus();
        return;
    }

    let correct = true;
    for (let i = 0; i < targetSeq.length; i++) {
        if (AppState.assembly[i].id !== targetSeq[i].id) {
            correct = false;
            break;
        }
    }

    if (correct) {
        const takeaway = unit.key_takeaway?.[lang] || unit.key_takeaway?.en || "Great work!";
        renderFeedback(`✅ <strong>Mastered!</strong><br><br>${formatMarkup(takeaway)}`, '#15803d', '#f0fdf4');
        
        DOM.targetZone.classList.add('success-locked');
        DOM.btnSubmit.disabled = true;
        DOM.nextBtn.disabled = false;

        if (lang === 'en' && !p.enSolved) {
            p.enSolved = true;
            p.marks += 10;
            AppState.score += 10;
        } else if (lang === 'hi' && !p.hiSolved) {
            p.hiSolved = true;
            p.marks += 10;
            AppState.score += 10;
        }

        if (DOM.masteryScore) DOM.masteryScore.innerText = AppState.score;
        updateUnitGridStatus();
    } else {
        renderFeedback(`❌ Incorrect arrangement. Reorder the fragments and verify again.`, '#ef4444', '#fef2f2');
        updateUnitGridStatus();
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
// 9. MODULE COMPLETION & SYNC (AUTHENTICATED)
// ==========================================

function finishModule() {
    stopTimer();
    switchScreen('results');

    const totalPossible = AppState.maxScore;
    const percentage = totalPossible > 0 ? Math.round((AppState.score / totalPossible) * 100) : 0;
    const mins = String(Math.floor(AppState.timerSeconds / 60)).padStart(2, '0');
    const secs = String(AppState.timerSeconds % 60).padStart(2, '0');
    const timeFormatted = `${mins}:${secs}`;

    if (DOM.finalScore) DOM.finalScore.innerText = AppState.score;
    if (DOM.totalPossible) DOM.totalPossible.innerText = totalPossible;
    if (DOM.percentage) DOM.percentage.innerText = `${percentage}%`;
    if (DOM.totalTime) DOM.totalTime.innerText = timeFormatted;

    // Transmits verified Student Name & School from Sheet2
    const scorePayload = {
        action: 'submit',
        studentName: AppState.studentAuth.studentName,
        schoolName: AppState.studentAuth.schoolName,
        class: AppState.selectedClass,
        subject: AppState.selectedSubject,
        lesson: AppState.chapterTitleString,
        mode: 'LEARNING',
        score: `${AppState.score}/${totalPossible}`,
        timeTaken: `'${timeFormatted}`
    };

    transmitScore(scorePayload);
}

async function transmitScore(payload) {
    try {
        await fetch(AppConfig.gasEndpoint, {
            method: 'POST',
            mode: 'no-cors',
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
                body: JSON.stringify(item)
            });
        } catch {
            unSynced.push(item);
        }
    }
    localStorage.setItem('learnApp_offlineQueue', JSON.stringify(unSynced));
}

// ==========================================
// 10. LEADERBOARD SYSTEM
// ==========================================

async function fetchScoreboard() {
    if (!DOM.scoreboardBody) return;
    DOM.scoreboardBody.innerHTML = '<tr><td colspan="9" style="padding:40px; text-align:center;">Syncing...</td></tr>';
    
    try {
        const r = await fetch(`${AppConfig.gasEndpoint}?action=get&t=${Date.now()}`);
        AppState.scoreboardData = await r.json();
        sortScoreboard('date');
    } catch (e) {
        console.error("Scoreboard fetch error:", e);
        DOM.scoreboardBody.innerHTML = '<tr><td colspan="9" style="color:#ef4444; padding:40px; text-align:center;">Server Error.</td></tr>';
    }
}

function cleanEfficiency(s) {
    let raw = String(s || '').replace('⏱️', '').replace("'", "").trim();
    if (raw.includes('T')) raw = raw.split('T')[1].split('.')[0];
    if (raw.startsWith('00:')) raw = raw.substring(3);
    return raw || '0:00';
}

function sortScoreboard(key) {
    if (AppState.sortConfig.key === key) {
        AppState.sortConfig.asc = !AppState.sortConfig.asc;
    } else {
        AppState.sortConfig.key = key;
        AppState.sortConfig.asc = (key === 'student' || key === 'class');
    }
    
    const headers = document.querySelectorAll('#leaderboardHeaders th');
    headers.forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
    const active = document.querySelector(`#leaderboardHeaders th[data-sort="${key}"]`);
    if (active) active.classList.add(AppState.sortConfig.asc ? 'sort-asc' : 'sort-desc');

    const data = [...AppState.scoreboardData];
    data.sort((a, b) => {
        let vA, vB;
        switch (key) {
            case 'rank': 
            case 'score': 
                vA = parseFloat(String(a[7] || '').split('/')[0]) || 0; 
                vB = parseFloat(String(b[7] || '').split('/')[0]) || 0; 
                break;
            case 'date': 
                vA = new Date(a[0]); 
                vB = new Date(b[0]); 
                break;
            case 'student': vA = String(a[1]).toLowerCase(); vB = String(b[1]).toLowerCase(); break;
            case 'class': vA = String(a[3]).toLowerCase(); vB = String(b[3]).toLowerCase(); break;
            case 'subject': vA = String(a[4]).toLowerCase(); vB = String(b[4]).toLowerCase(); break;
            case 'chapter': vA = String(a[5]).toLowerCase(); vB = String(b[5]).toLowerCase(); break;
            case 'mode': vA = String(a[6]).toLowerCase(); vB = String(b[6]).toLowerCase(); break;
            case 'efficiency': 
                const toSecs = (s) => {
                    const clean = cleanEfficiency(s);
                    const p = clean.split(':').map(Number);
                    return p.length === 3 ? p[0]*3600 + p[1]*60 + p[2] : (p.length === 2 ? p[0]*60 + p[1] : parseFloat(clean) || 0);
                };
                vA = toSecs(a[8]); vB = toSecs(b[8]); break;
            default: vA = 0; vB = 0;
        }
        if (vA < vB) return AppState.sortConfig.asc ? -1 : 1;
        if (vA > vB) return AppState.sortConfig.asc ? 1 : -1;
        return 0;
    });

    DOM.scoreboardBody.innerHTML = data.slice(0, 50).map((r, i) => `
        <tr>
            <td style="padding:15px; font-weight:bold;">${i+1}</td>
            <td style="padding:15px; font-size:11px;">${r[0] ? new Date(r[0]).toLocaleDateString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : '-'}</td>
            <td style="padding:15px;"><strong>${r[1]}</strong><br><small style="color:#64748b;">${r[2]}</small></td>
            <td style="padding:15px; font-size:12px;">${r[3]}</td>
            <td style="padding:15px; font-size:12px;">${r[4]}</td>
            <td style="padding:15px; font-size:12px;">${r[5]}</td>
            <td style="padding:15px;"><span style="background:#eff6ff; color:#1d4ed8; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600;">${r[6]}</span></td>
            <td style="padding:15px; font-weight:800; color:#2563eb;">${r[7]}</td>
            <td style="padding:15px; font-size:12px;">⏱️ ${cleanEfficiency(r[8])}</td>
        </tr>
    `).join('');
}
