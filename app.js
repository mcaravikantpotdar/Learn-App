/**
 * LearnApp Core Controller (app.js)
 * Option 1: Side-by-Side Dual Columns with Unified "Verify Assembly"
 * Includes Backward-Compatibility Fallbacks for Legacy JSON schemas.
 */

const AppConfig = {
    githubRepo: 'mcaravikantpotdar/Learn-App',
    branch: 'main',
    gasEndpoint: 'https://script.google.com/macros/s/AKfycbxNWnLdQxUnjOCfWHoyZALx-orP0D1v9Q04ic9hl3Ido3W3gOgRoYiq2MuN-bv687I/exec'
};

const AppState = {
    repoCatalog: {}, 
    selectedClass: '',
    selectedSubject: '',
    selectedQuizPath: '',
    chapterTitleString: '',
    units: [],
    currentUnitIndex: 0,
    
    // Independent Assembly State for Both Tracks
    assemblyEn: [],
    assemblyHi: [],
    
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
    lessonTitle: document.getElementById('lesson-title'),
    mediaContainer: document.getElementById('media-container'),
    mediaCaption: document.getElementById('media-caption'),

    // Side-by-Side Dual Column Panels
    lessonTheoryEn: document.getElementById('lessonTheoryEn'),
    lessonTheoryHi: document.getElementById('lessonTheoryHi'),
    challengePromptEn: document.getElementById('challengePromptEn'),
    challengePromptHi: document.getElementById('challengePromptHi'),
    
    // Left Track (English)
    enStatusPill: document.getElementById('enStatusPill'),
    targetZoneEn: document.getElementById('targetZoneEn'),
    fragmentBankEn: document.getElementById('fragmentBankEn'),
    feedbackEn: document.getElementById('feedbackEn'),

    // Right Track (Hindi)
    hiStatusPill: document.getElementById('hiStatusPill'),
    targetZoneHi: document.getElementById('targetZoneHi'),
    fragmentBankHi: document.getElementById('fragmentBankHi'),
    feedbackHi: document.getElementById('feedbackHi'),

    // Unified Feedback & Controls
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

    // Workbench Interaction
    DOM.btnSubmit?.addEventListener('click', verifyUnifiedAssembly);
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
        const url = `https://api.github.com/repos/${AppConfig.githubRepo}/git/trees/${AppConfig.branch}?recursive=1`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error(`GitHub API Error ${res.status}:${res.statusText}`);
        
        const data = await res.json();
        const catalog = {};

        (data.tree || []).forEach(node => {
            if (node.type === 'blob' && node.path.startsWith('jsons/') && node.path.toLowerCase().endsWith('.json')) {
                const segments = node.path.split('/');
                
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

    const masteryPerUnit = data.metadata?.scoring_model?.dual_language_mastery_max || 20;
    AppState.maxScore = AppState.units.length * masteryPerUnit;
    
    // Safely extract chapter title string for DB submission
    const safeTitleEn = typeof data.metadata?.chapter_title === 'string' ? data.metadata.chapter_title : (data.metadata?.chapter_title?.en || "Learning Module");
    AppState.chapterTitleString = safeTitleEn;

    AppState.units.forEach((_, idx) => {
        AppState.unitProgress[idx] = {
            attempted: false,
            enSolved: false,
            hiSolved: false,
            marks: 0
        };
    });

    if (DOM.chapterTitle) {
        const safeTitleHi = typeof data.metadata?.chapter_title === 'string' ? '' : (data.metadata?.chapter_title?.hi || '');
        DOM.chapterTitle.innerText = `${safeTitleEn}${safeTitleHi ? ' / ' + safeTitleHi : ''}`;
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
            node.classList.add('attempted');
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

    // Update track pills
    const curr = AppState.unitProgress[AppState.currentUnitIndex];
    if (curr) {
        if (DOM.enStatusPill) {
            DOM.enStatusPill.className = `track-pill ${curr.enSolved ? 'solved' : ''}`;
            DOM.enStatusPill.innerText = curr.enSolved ? 'Mastered ✅ (+10)' : 'Incomplete';
        }
        if (DOM.hiStatusPill) {
            DOM.hiStatusPill.className = `track-pill ${curr.hiSolved ? 'solved' : ''}`;
            DOM.hiStatusPill.innerText = curr.hiSolved ? 'पूर्ण ✅ (+10)' : 'अपूर्ण';
        }
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
        const containers = [
            DOM.lessonTheoryEn, DOM.lessonTheoryHi, DOM.challengePromptEn, DOM.challengePromptHi,
            DOM.targetZoneEn, DOM.targetZoneHi, DOM.fragmentBankEn, DOM.fragmentBankHi,
            DOM.feedbackBanner, DOM.mediaCaption, DOM.feedbackEn, DOM.feedbackHi
        ];
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

function renderCurrentUnit() {
    const unit = AppState.units[AppState.currentUnitIndex];
    if (!unit) return;

    // --- BULLETPROOF SCHEMA FALLBACKS (Prevents crashes on old JSONs) ---
    const titleEn = typeof unit.instruction.title === 'string' ? unit.instruction.title : (unit.instruction.title?.en || 'Module');
    const titleHi = typeof unit.instruction.title === 'string' ? '' : (unit.instruction.title?.hi || '');
    
    const theoryEn = typeof unit.instruction.theory === 'string' ? unit.instruction.theory : (unit.instruction.theory?.en || '');
    const theoryHi = typeof unit.instruction.theory === 'string' ? '' : (unit.instruction.theory?.hi || '');
    
    const challengeEn = unit.challenges.en || unit.challenges; // Fallback to root challenges object
    const challengeHi = unit.challenges.hi || unit.challenges; // Fallback to root challenges object
    const media = unit.instruction.media;
    // -------------------------------------------------------------------

    if (DOM.currentUnitNum) DOM.currentUnitNum.innerText = AppState.currentUnitIndex + 1;
    
    if (DOM.lessonTitle) {
        DOM.lessonTitle.innerHTML = `${formatMarkup(titleEn)} <span style="font-weight:400; opacity:0.75;">${titleHi ? '| ' + formatMarkup(titleHi) : ''}</span>`;
    }

    if (DOM.lessonTheoryEn) DOM.lessonTheoryEn.innerHTML = formatMarkup(theoryEn);
    if (DOM.lessonTheoryHi) DOM.lessonTheoryHi.innerHTML = formatMarkup(theoryHi);

    if (DOM.challengePromptEn) DOM.challengePromptEn.innerHTML = formatMarkup(challengeEn.prompt || '');
    if (DOM.challengePromptHi) DOM.challengePromptHi.innerHTML = formatMarkup(challengeHi.prompt || '');

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
        DOM.mediaCaption.innerHTML = formatMarkup(`${media?.caption?.en || ''} ${media?.caption?.hi ? '— ' + media?.caption?.hi : ''}`);
    }

    // Reset feedback alerts
    if (DOM.feedbackBanner) {
        DOM.feedbackBanner.style.display = 'none';
        DOM.feedbackBanner.innerHTML = '';
    }
    if (DOM.feedbackEn) DOM.feedbackEn.style.display = 'none';
    if (DOM.feedbackHi) DOM.feedbackHi.style.display = 'none';

    const p = AppState.unitProgress[AppState.currentUnitIndex];

    // Setup Target Zones locking
    if (DOM.targetZoneEn) {
        DOM.targetZoneEn.classList.toggle('success-locked', p.enSolved);
        DOM.targetZoneEn.style.pointerEvents = p.enSolved ? 'none' : 'auto';
    }
    if (DOM.targetZoneHi) {
        DOM.targetZoneHi.classList.toggle('success-locked', p.hiSolved);
        DOM.targetZoneHi.style.pointerEvents = p.hiSolved ? 'none' : 'auto';
    }

    buildTrackFragmentPool('en', challengeEn, p.enSolved);
    buildTrackFragmentPool('hi', challengeHi, p.hiSolved);

    const isFullySolved = p.enSolved && p.hiSolved;
    if (DOM.btnSubmit) DOM.btnSubmit.disabled = isFullySolved;
    if (DOM.nextBtn) DOM.nextBtn.disabled = !isFullySolved;
    if (DOM.prevBtn) DOM.prevBtn.disabled = (AppState.currentUnitIndex === 0);

    updateUnitGridStatus();
    applyKaTeX();
}

// ==========================================
// 7. DUAL-TRACK DRAG & DROP SELECTION SYSTEM
// ==========================================

let activeDraggedTrackItem = null;

function buildTrackFragmentPool(lang, challenge, isLocked) {
    const isEn = (lang === 'en');
    const targetZone = isEn ? DOM.targetZoneEn : DOM.targetZoneHi;
    const fragmentBank = isEn ? DOM.fragmentBankEn : DOM.fragmentBankHi;

    if (!targetZone || !fragmentBank || !challenge.target_sequence) return;
    targetZone.innerHTML = '';
    fragmentBank.innerHTML = '';

    if (isEn) AppState.assemblyEn = [];
    else AppState.assemblyHi = [];

    if (isLocked) {
        challenge.target_sequence.forEach(frag => {
            const chip = document.createElement('div');
            chip.className = 'fragment-chip';
            chip.dataset.id = frag.id;
            chip.dataset.lang = lang;
            chip.innerHTML = formatMarkup(frag.text);
            chip.fragRef = frag;
            targetZone.appendChild(chip);
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
        chip.dataset.lang = lang;
        chip.innerHTML = formatMarkup(frag.text);
        chip.fragRef = frag;

        chip.addEventListener('click', () => toggleChipPlacement(chip, lang));
        chip.draggable = true;
        chip.addEventListener('dragstart', handleTrackDragStart);
        chip.addEventListener('dragend', handleTrackDragEnd);

        fragmentBank.appendChild(chip);
    });

    targetZone.addEventListener('dragover', (e) => handleTrackDragOverZone(e, targetZone, lang));
}

function toggleChipPlacement(chip, lang) {
    const isEn = (lang === 'en');
    const targetZone = isEn ? DOM.targetZoneEn : DOM.targetZoneHi;
    const fragmentBank = isEn ? DOM.fragmentBankEn : DOM.fragmentBankHi;

    if (targetZone.classList.contains('success-locked')) return;

    AppState.unitProgress[AppState.currentUnitIndex].attempted = true;
    updateUnitGridStatus();

    if (chip.parentElement === fragmentBank) {
        targetZone.appendChild(chip);
    } else {
        fragmentBank.appendChild(chip);
    }
    syncAssemblyFromTrackDOM(lang);
}

function handleTrackDragStart(e) {
    const lang = this.dataset.lang;
    const isEn = (lang === 'en');
    const targetZone = isEn ? DOM.targetZoneEn : DOM.targetZoneHi;
    if (targetZone.classList.contains('success-locked')) {
        e.preventDefault();
        return;
    }
    activeDraggedTrackItem = this;
    this.classList.add('dragging');
}

function handleTrackDragEnd() {
    if (!activeDraggedTrackItem) return;
    const lang = activeDraggedTrackItem.dataset.lang;
    activeDraggedTrackItem.classList.remove('dragging');
    activeDraggedTrackItem = null;
    syncAssemblyFromTrackDOM(lang);
}

function handleTrackDragOverZone(e, targetZone, lang) {
    e.preventDefault();
    if (!activeDraggedTrackItem || activeDraggedTrackItem.dataset.lang !== lang) return;
    if (targetZone.classList.contains('success-locked')) return;

    const afterElement = getDropTargetElement(targetZone, e.clientX, e.clientY);
    if (afterElement == null) {
        targetZone.appendChild(activeDraggedTrackItem);
    } else {
        targetZone.insertBefore(activeDraggedTrackItem, afterElement);
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

function syncAssemblyFromTrackDOM(lang) {
    const isEn = (lang === 'en');
    const targetZone = isEn ? DOM.targetZoneEn : DOM.targetZoneHi;
    const chips = targetZone.querySelectorAll('.fragment-chip');
    
    if (isEn) {
        AppState.assemblyEn = Array.from(chips).map(c => c.fragRef);
    } else {
        AppState.assemblyHi = Array.from(chips).map(c => c.fragRef);
    }

    if (DOM.btnSubmit) {
        DOM.btnSubmit.disabled = (AppState.assemblyEn.length === 0 && AppState.assemblyHi.length === 0);
    }
}

// ==========================================
// 8. UNIFIED VERIFICATION & EVALUATION
// ==========================================

function verifyUnifiedAssembly() {
    const unit = AppState.units[AppState.currentUnitIndex];
    const p = AppState.unitProgress[AppState.currentUnitIndex];
    p.attempted = true;

    // Safely extract challenges fallback
    const challengeEn = unit.challenges.en || unit.challenges;
    const challengeHi = unit.challenges.hi || unit.challenges;

    let enResult = evaluateTrack('en', challengeEn, AppState.assemblyEn, p.enSolved);
    let hiResult = evaluateTrack('hi', challengeHi, AppState.assemblyHi, p.hiSolved);

    // Apply English verification outcome
    if (!p.enSolved) {
        if (enResult.status === 'correct') {
            p.enSolved = true;
            p.marks += 10;
            AppState.score += 10;
            DOM.targetZoneEn.classList.add('success-locked');
            renderTrackFeedback('en', '✅ Correct English sequence!', '#10b981', 'rgba(16, 185, 129, 0.1)');
        } else if (enResult.status === 'distractor') {
            renderTrackFeedback('en', `❌ ${formatMarkup(enResult.message)}`, '#ef4444', 'rgba(239, 68, 68, 0.1)');
        } else if (enResult.status === 'incomplete') {
            renderTrackFeedback('en', `💡 Next Hint: ${formatMarkup(enResult.message)}`, '#0284c7', 'rgba(2, 132, 199, 0.1)');
        } else {
            renderTrackFeedback('en', '❌ Sequence incorrect. Reorder and recheck.', '#ef4444', 'rgba(239, 68, 68, 0.1)');
        }
    }

    // Apply Hindi verification outcome
    if (!p.hiSolved) {
        if (hiResult.status === 'correct') {
            p.hiSolved = true;
            p.marks += 10;
            AppState.score += 10;
            DOM.targetZoneHi.classList.add('success-locked');
            renderTrackFeedback('hi', '✅ सही हिंदी क्रम!', '#10b981', 'rgba(16, 185, 129, 0.1)');
        } else if (hiResult.status === 'distractor') {
            renderTrackFeedback('hi', `❌ ${formatMarkup(hiResult.message)}`, '#ef4444', 'rgba(239, 68, 68, 0.1)');
        } else if (hiResult.status === 'incomplete') {
            renderTrackFeedback('hi', `💡 संकेत: ${formatMarkup(hiResult.message)}`, '#0284c7', 'rgba(2, 132, 199, 0.1)');
        } else {
            renderTrackFeedback('hi', '❌ क्रम गलत है। टोकनों को पुनः व्यवस्थित करें।', '#ef4444', 'rgba(239, 68, 68, 0.1)');
        }
    }

    if (DOM.masteryScore) DOM.masteryScore.innerText = AppState.score;
    updateUnitGridStatus();

    // Both tracks completed successfully
    if (p.enSolved && p.hiSolved) {
        const takeawayEn = typeof unit.key_takeaway === 'string' ? unit.key_takeaway : (unit.key_takeaway?.en || "Great job!");
        const takeawayHi = typeof unit.key_takeaway === 'string' ? '' : (unit.key_takeaway?.hi || "शानदार कार्य!");
        renderFeedbackBanner(`✅ <strong>Mastered Both Languages! (+20 pts)</strong><br><br>• <strong>EN:</strong> ${formatMarkup(takeawayEn)}<br>• <strong>HI:</strong> ${formatMarkup(takeawayHi)}`, '#15803d', '#f0fdf4');
        DOM.btnSubmit.disabled = true;
        DOM.nextBtn.disabled = false;
    } else if (p.enSolved || p.hiSolved) {
        renderFeedbackBanner(`⚡ One track mastered (+10 pts)! Complete the second track to unlock the next unit.`, '#f59e0b', '#fffbeb');
    }
}

function evaluateTrack(lang, challenge, assembly, alreadySolved) {
    if (alreadySolved) return { status: 'correct' };
    const targetSeq = challenge.target_sequence || [];

    const distractorHit = assembly.find(f => f.category === 'logical' || f.category === 'grammatical');
    if (distractorHit) {
        return { status: 'distractor', message: distractorHit.penalty_explanation };
    }

    if (assembly.length < targetSeq.length) {
        const nextTarget = targetSeq[assembly.length];
        if (nextTarget) {
             const hintMsg = nextTarget.role_hint?.[lang] || nextTarget.role_hint?.en || nextTarget.role_hint || "Add the next element.";
             return { status: 'incomplete', message: hintMsg };
        }
    }

    let isCorrect = true;
    for (let i = 0; i < targetSeq.length; i++) {
        if (assembly[i].id !== targetSeq[i].id) {
            isCorrect = false;
            break;
        }
    }

    return isCorrect ? { status: 'correct' } : { status: 'wrong' };
}

function renderTrackFeedback(lang, html, color, bg) {
    const el = (lang === 'en') ? DOM.feedbackEn : DOM.feedbackHi;
    if (!el) return;
    el.innerHTML = html;
    el.style.cssText = `display:block; margin-top:8px; padding:8px 12px; border-radius:6px; border:1px solid ${color}; background:${bg}; color:${color}; font-size:12px;`;
    applyKaTeX();
}

function renderFeedbackBanner(html, color, bg) {
    if (!DOM.feedbackBanner) return;
    DOM.feedbackBanner.innerHTML = html;
    DOM.feedbackBanner.style.cssText = `display:block; padding:12px 16px; margin-top:12px; border-radius:8px; border:1px solid ${color}; background:${bg}; color:${color}; font-size:13px;`;
    applyKaTeX();
}

function handleShowHint() {
    const unit = AppState.units[AppState.currentUnitIndex];
    const hintEn = typeof unit.challenges.en === 'object' ? unit.challenges.en.hint : (unit.challenges.hint || '');
    const hintHi = typeof unit.challenges.hi === 'object' ? unit.challenges.hi.hint : '';
    renderFeedbackBanner(`💡 <strong>Hints:</strong><br>• <strong>EN:</strong> ${formatMarkup(hintEn)}<br>• <strong>HI:</strong> ${formatMarkup(hintHi)}`, '#0284c7', '#f0f9ff');
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
