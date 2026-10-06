/**
 * Learn-App Core Logic (app.js)
 * Fully Dynamic Plug-and-Play Scanner, Cascading Filters, kaTeX,
 * Real-Time Scoreboard, and Google Apps Script Backend Integration.
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
    studentName: '',
    schoolName: '',
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

    studentName: document.getElementById('studentName'),
    schoolName: document.getElementById('schoolName'),
    classSelect: document.getElementById('classSelect'),
    subjectGroup: document.getElementById('subjectGroup'),
    subjectSelect: document.getElementById('subjectSelect'),
    lessonGroup: document.getElementById('lessonGroup'),
    quizList: document.getElementById('quizList'),
    startQuiz: document.getElementById('startQuiz'),
    viewScoreboardBtn: document.getElementById('viewScoreboardBtn'),

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

    finalScore: document.getElementById('finalScore'),
    totalPossible: document.getElementById('totalPossible'),
    percentage: document.getElementById('percentage'),
    totalTime: document.getElementById('totalTime'),
    retakeBtn: document.getElementById('retakeBtn'),
    viewScoreboardFromResults: document.getElementById('viewScoreboardFromResults'),
    homeBtn: document.getElementById('homeBtn'),

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

    DOM.classSelect?.addEventListener('change', handleClassChange);
    DOM.subjectSelect?.addEventListener('change', handleSubjectChange);
    DOM.startQuiz?.addEventListener('click', handleStartQuiz);

    DOM.btnEn?.addEventListener('click', () => setLanguage('en'));
    DOM.btnHi?.addEventListener('click', () => setLanguage('hi'));

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
// 2. DYNAMIC GITHUB TREE SCANNER (REAL-TIME)
// ==========================================

async function scanRepositoryTree() {
    toggleSpinner(true);
    try {
        // Cache-busting timestamp guarantees newly committed classes/subjects are retrieved immediately
        const url = `https://api.github.com/repos/${AppConfig.githubRepo}/git/trees/${AppConfig.branch}?recursive=1&t=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-cache' });
        
        if (!res.ok) throw new Error(`GitHub Tree API status: ${res.status}`);
        
        const data = await res.json();
        const catalog = {};

        (data.tree || []).forEach(node => {
            if (node.type === 'blob' && node.path.startsWith('jsons/') && node.path.toLowerCase().endsWith('.json')) {
                const segments = node.path.split('/');
                
                // Expects: jsons / [Class] / [Subject] / [File.json]
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
            DOM.errorMessage.innerText = "Error loading repository modules. Please check connection.";
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
