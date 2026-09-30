class ConceptApp {
    constructor() {
        // App Configuration
        this.GITHUB_CONFIG = { owner: "mcaravikantpotdar", repo: "Learn-App", path: "jsons" };
        this.SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxNWnLdQxUnjOCfWHoyZALx-orP0D1v9Q04ic9hl3Ido3W3gOgRoYiq2MuN-bv687I/exec";
        
        // System Feedback Localization
        this.SYSTEM_MESSAGES = {
            incomplete: { en: "❌ The sentence is incomplete. Add more clauses.", hi: "❌ वाक्य अधूरा है। और खंड जोड़ें।" },
            orderError: { en: "❌ The logical order is incorrect. Check your connections.", hi: "❌ तार्किक क्रम सही नहीं है। संयोजन की जाँच करें।" }
        };

        // State & Data
        this.fullLibraryData = {};
        this.lessonData = null;
        this.studentInfo = { name: '', school: '', class: '', subject: '', path: '' };
        
        this.currentUnitIndex = 0;
        this.currentLang = 'en';
        this.unitStates = {}; 
        this.masteryScores = {}; 
        
        // Master Clock
        this.totalElapsedSeconds = 0;
        this.masterTimer = null;
        this.scoreboardData = [];
        this.sortConfig = { key: 'date', asc: false };

        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.autoScanGitHubLibrary();
    }

    cacheDOM() {
        const ids = [
            'studentName', 'schoolName', 'classSelect', 'subjectGroup', 'subjectSelect', 
            'lessonGroup', 'quizList', 'startQuiz', 'viewScoreboardBtn', 'errorMessage',
            'chapterTitle', 'displayStudentName', 'displaySchoolInfo', 'currentUnitNum', 
            'totalUnitsNum', 'masteryScore', 'maxScore', 'unitGrid', 'timer',
            'btn-en', 'btn-hi', 'lesson-title', 'lesson-theory', 'media-container', 'media-caption',
            'challenge-prompt', 'target-zone', 'fragment-bank', 'feedback-banner',
            'prevBtn', 'btn-submit', 'hintBtn', 'nextBtn', 'topHomeBtn', 'topQuitBtn',
            'finalScore', 'totalPossible', 'percentage', 'totalTime', 'retakeBtn', 
            'viewScoreboardFromResults', 'homeBtn', 'scoreboardBody', 'backFromScoreboard', 'leaderboardHeaders'
        ];
        ids.forEach(id => { 
            const el = document.getElementById(id);
            if (!el) console.warn(`ID not found: ${id}`);
            this.el = this.el || {};
            this.el[id] = el;
        });
    }

    bindEvents() {
        // Form Validation
        const checkForm = () => this.validateStartForm();
        this.el.studentName.addEventListener('input', checkForm);
        this.el.schoolName.addEventListener('input', checkForm);
        this.el.classSelect.addEventListener('change', (e) => this.handleClassSelection(e.target.value));
        this.el.subjectSelect.addEventListener('change', (e) => this.handleSubjectSelection(e.target.value));
        
        // Buttons
        this.el.startQuiz.addEventListener('click', () => this.handleStart());
        this.el.topHomeBtn.addEventListener('click', () => window.location.reload());
        this.el.topQuitBtn.addEventListener('click', () => this.completeModule());
        this.el.homeBtn.addEventListener('click', () => window.location.reload());
        this.el.retakeBtn.addEventListener('click', () => this.handleStart());
        
        // Languages & Navigation
        this.el['btn-en'].addEventListener('click', () => this.switchLanguage('en'));
        this.el['btn-hi'].addEventListener('click', () => this.switchLanguage('hi'));
        this.el.prevBtn.addEventListener('click', () => this.navigateUnit(-1));
        this.el.nextBtn.addEventListener('click', () => this.navigateUnit(1));
        
        // Interaction
        this.el['btn-submit'].addEventListener('click', () => this.checkAnswer());
        this.el.hintBtn.addEventListener('click', () => this.giveHint());
        
        // Scoreboard
        const showScore = () => { this.showScreen('scoreboardScreen'); this.fetchScoreboard(); };
        this.el.viewScoreboardBtn.addEventListener('click', showScore);
        this.el.viewScoreboardFromResults.addEventListener('click', showScore);
        this.el.backFromScoreboard.addEventListener('click', () => {
            if (this.lessonData) this.showScreen('quizScreen');
            else this.showScreen('uploadScreen');
        });
        if (this.el.leaderboardHeaders) {
            this.el.leaderboardHeaders.addEventListener('click', (e) => {
                const th = e.target.closest('th');
                if (th && th.dataset.sort) this.sortScoreboard(th.dataset.sort);
            });
        }
    }

    /* --- UTILS & SANITIZERS --- */
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
        const t = document.getElementById(screenId);
        if (t) { t.style.display = 'block'; setTimeout(() => t.classList.add('active'), 10); window.scrollTo({top:0, behavior:'smooth'}); }
    }
    
    showLoading(show) {
        const s = document.getElementById('loadingSpinner');
        if (s) { show ? s.classList.add('active') : s.classList.remove('active'); }
    }

    // Zero-Crash Markdown to HTML Code Sanitizer
    formatText(text) {
        if (!text) return '';
        // Find anything wrapped in backticks `...`
        return text.replace(/`([^`]+)`/g, (match, codeBlock) => {
            // Escape angle brackets inside the backticks so the browser doesn't execute them
            const safeCode = codeBlock.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #db2777;">${safeCode}</code>`;
        });
    }

    triggerMathRender() {
        if (window.renderMathInElement) {
            try {
                document.querySelectorAll('.math-render').forEach(el => {
                    renderMathInElement(el, { 
                        delimiters: [ 
                            {left: "$$", right: "$$", display: true}, 
                            {left: "$", right: "$", display: false} 
                        ],
                        throwOnError: false // Protects against silent math syntax crashes
                    });
                });
            } catch (err) {
                console.warn("KaTeX rendering encountered an issue:", err);
            }
        }
    }

    /* --- GITHUB SCANNER --- */
    async autoScanGitHubLibrary() {
        const { owner, repo, path } = this.GITHUB_CONFIG;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
        try {
            const res = await fetch(apiUrl, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            const data = await res.json();
            const jsonFiles = data.tree.filter(i => i.path.startsWith(`${path}/`) && i.path.toLowerCase().endsWith('.json'));
            this.parseLibraryTree(jsonFiles);
            this.renderClassDropdown();
        } catch (error) {
            this.el.errorMessage.textContent = `Library Error: ${error.message}. Checking localhost...`;
        }
    }

    parseLibraryTree(files) {
        files.forEach(file => {
            const parts = file.path.split('/');
            if (parts.length < 4) return;
            const className = parts[1].replace(/_/g, ' ').replace(/-/g, ' ');
            const subjectName = parts[2].replace(/_/g, ' ').replace(/-/g, ' ');
            const lessonName = parts[3].replace('.json', '').replace(/_/g, ' ').replace(/-/g, ' ');
            if (!this.fullLibraryData[className]) this.fullLibraryData[className] = {};
            if (!this.fullLibraryData[className][subjectName]) this.fullLibraryData[className][subjectName] = [];
            this.fullLibraryData[className][subjectName].push({ displayName: lessonName, path: `https://raw.githubusercontent.com/${this.GITHUB_CONFIG.owner}/${this.GITHUB_CONFIG.repo}/main/${file.path}` });
        });
    }

    renderClassDropdown() {
        const classes = Object.keys(this.fullLibraryData).sort();
        classes.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls; opt.textContent = cls;
            this.el.classSelect.appendChild(opt);
        });
    }

    handleClassSelection(cls) {
        this.studentInfo.class = cls; this.studentInfo.subject = ''; this.studentInfo.path = '';
        this.el.subjectGroup.style.display = 'block';
        this.el.lessonGroup.style.display = 'none';
        this.el.subjectSelect.innerHTML = '<option value="" disabled selected>Choose Subject...</option>';
        Object.keys(this.fullLibraryData[cls]).sort().forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub; opt.textContent = sub;
            this.el.subjectSelect.appendChild(opt);
        });
        this.validateStartForm();
    }

    handleSubjectSelection(sub) {
        this.studentInfo.subject = sub; this.studentInfo.path = '';
        this.el.lessonGroup.style.display = 'block';
        this.el.quizList.innerHTML = '';
        this.fullLibraryData[this.studentInfo.class][sub].forEach(lesson => {
            const btn = document.createElement('div');
            btn.className = 'quiz-btn'; btn.textContent = `📂 ${lesson.displayName}`;
            btn.onclick = () => {
                document.querySelectorAll('.quiz-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected'); this.studentInfo.path = lesson.path;
                this.validateStartForm();
            };
            this.el.quizList.appendChild(btn);
        });
        this.validateStartForm();
    }

    validateStartForm() {
        this.studentInfo.name = this.el.studentName.value.trim();
        this.studentInfo.school = this.el.schoolName.value.trim();
        const ok = this.studentInfo.name && this.studentInfo.school && this.studentInfo.class && this.studentInfo.subject && this.studentInfo.path;
        this.el.startQuiz.disabled = !ok;
    }

    /* --- LESSON ENGINE --- */
    async handleStart() {
        this.showLoading(true);
        try {
            const r = await fetch(this.studentInfo.path);
            if (!r.ok) throw new Error("Fetch failed");
            this.lessonData = await r.json();
            
            this.totalElapsedSeconds = 0;
            if (this.masterTimer) clearInterval(this.masterTimer);
            this.masterTimer = setInterval(() => {
                this.totalElapsedSeconds++;
                const m = String(Math.floor(this.totalElapsedSeconds / 60)).padStart(2, '0');
                const s = String(this.totalElapsedSeconds % 60).padStart(2, '0');
                this.el.timer.textContent = `${m}:${s}`;
            }, 1000);

            this.initStates();
            
            // Header Info
            this.el.displayStudentName.innerText = `👤 ${this.studentInfo.name}`;
            this.el.displaySchoolInfo.innerText = `${this.studentInfo.class} •${this.studentInfo.subject}`;
            
            const metaTitle = this.lessonData.metadata.chapter_title;
            this.el.chapterTitle.innerText = metaTitle[this.currentLang] || metaTitle.en || metaTitle;
            this.el.totalUnitsNum.innerText = this.lessonData.learning_units.length;
            this.el.maxScore.innerText = this.lessonData.learning_units.length * 20;

            this.showScreen('quizScreen');
            this.renderGrid();
            this.showUnit(0);
        } catch (e) {
            this.el.errorMessage.textContent = `Error: ${e.message}`;
        } finally {
            this.showLoading(false);
        }
    }

    initStates() {
        this.unitStates = {}; this.masteryScores = {};
        this.lessonData.learning_units.forEach(unit => {
            const uid = unit.unit_id;
            this.masteryScores[uid] = { en: 0, hi: 0 };
            
            // Schema resiliency for older/newer JSON variations
            const chalEn = unit.challenges.en || unit.challenges.english || unit.challenges;
            const chalHi = unit.challenges.hi || unit.challenges.hindi || unit.challenges;

            this.unitStates[uid] = {
                en: this.createLangState(chalEn),
                hi: this.createLangState(chalHi)
            };
        });
    }

    createLangState(challenge) {
        const targets = challenge.target_sequence || challenge.fragments || [];
        const distractors = challenge.distractors || [];
        
        let allFragments = [
            ...targets.map(f => ({ ...f, isTarget: true })),
            ...distractors.map(f => ({ ...f, isTarget: false }))
        ];
        return { bank: this.shuffleArray(allFragments), assembly: [], isSolved: false, attempts: 0, hintUsed: false };
    }

    renderGrid() {
        this.el.unitGrid.innerHTML = '';
        this.lessonData.learning_units.forEach((unit, idx) => {
            const uid = unit.unit_id;
            const totalScore = this.masteryScores[uid].en + this.masteryScores[uid].hi;
            const badge = document.createElement('div');
            badge.className = `question-number`;
            if (totalScore === 20) badge.classList.add('correct');
            else if (totalScore > 0) badge.classList.add('attempted');
            if (idx === this.currentUnitIndex) badge.classList.add('current');

            badge.innerHTML = `<div class="q-number">${idx + 1}</div><div class="marks">${totalScore}/20</div>`;
            badge.onclick = () => this.showUnit(idx);
            this.el.unitGrid.appendChild(badge);
        });

        let globalTotal = 0;
        Object.values(this.masteryScores).forEach(s => globalTotal += (s.en + s.hi));
        this.el.masteryScore.innerText = globalTotal;
    }

    navigateUnit(direction) {
        let next = this.currentUnitIndex + direction;
        if (next >= 0 && next < this.lessonData.learning_units.length) this.showUnit(next);
        else if (next >= this.lessonData.learning_units.length) this.completeModule();
    }

    switchLanguage(lang) {
        if (this.currentLang === lang) return;
        this.currentLang = lang;
        this.el['btn-en'].classList.toggle('active', lang === 'en');
        this.el['btn-hi'].classList.toggle('active', lang === 'hi');
        
        const metaTitle = this.lessonData.metadata.chapter_title;
        this.el.chapterTitle.innerText = metaTitle[lang] || metaTitle.en || metaTitle;
        this.showUnit(this.currentUnitIndex);
    }

    showUnit(index) {
        this.currentUnitIndex = index;
        const unit = this.lessonData.learning_units[index];
        const state = this.unitStates[unit.unit_id][this.currentLang];
        
        this.el.currentUnitNum.innerText = index + 1;
        this.renderGrid();

        // Title and Sanitized Theory 
        const instTitle = unit.instruction.title || unit.title;
        this.el['lesson-title'].innerText = instTitle[this.currentLang] || instTitle.en || instTitle;
        
        const instTheory = unit.instruction.theory || unit.theory || unit.instruction.text;
        const rawTheory = instTheory[this.currentLang] || instTheory.en || instTheory; 
        this.el['lesson-theory'].innerHTML = this.formatText(rawTheory);
        
        // Media rendering
        if (unit.instruction.media && unit.instruction.media.svg_code) {
            this.el['media-container'].style.display = 'block';
            this.el['media-container'].innerHTML = unit.instruction.media.svg_code;
            this.el['media-caption'].innerText = unit.instruction.media.caption[this.currentLang] || unit.instruction.media.caption.en || '';
        } else {
            this.el['media-container'].style.display = 'none';
            this.el['media-caption'].innerText = '';
        }

        const challenge = unit.challenges[this.currentLang] || unit.challenges.en || unit.challenges;
        this.el['challenge-prompt'].innerHTML = this.formatText(challenge.prompt || "Assemble the correct sequence.");
        this.el['feedback-banner'].style.display = 'none';
        this.el['target-zone'].classList.remove('success-lock');

        // Render fragments first, THEN trigger Math Rendering
        this.renderFragments(state);
        this.triggerMathRender();

        this.el.prevBtn.disabled = (index === 0);
        this.el.nextBtn.innerText = (index === this.lessonData.learning_units.length - 1) ? "🏁 Finish" : "Next Unit →";
        
        if (state.isSolved) {
            this.el['target-zone'].classList.add('success-lock');
            const takeaway = unit.key_takeaway[this.currentLang] || unit.key_takeaway.en || unit.key_takeaway;
            this.showFeedback(`🎉 <strong>Solved! (+${this.masteryScores[unit.unit_id][this.currentLang]} pts)</strong><br><br><em>Takeaway:</em>${this.formatText(takeaway)}`, 'success');
            this.el['btn-submit'].disabled = true;
            this.el.hintBtn.disabled = true;
        }
    }

    renderFragments(state) {
        this.el['fragment-bank'].innerHTML = '';
        this.el['target-zone'].innerHTML = '';

        state.bank.forEach(frag => {
            const chip = document.createElement('div');
            chip.className = 'fragment-chip';
            chip.innerHTML = this.formatText(frag.text); 
            if (!state.isSolved) chip.onclick = () => this.moveFragment(frag, 'bank', 'assembly');
            this.el['fragment-bank'].appendChild(chip);
        });

        state.assembly.forEach((frag, index) => {
            const chip = document.createElement('div');
            chip.className = 'fragment-chip';
            let txt = frag.text;
            // Only auto-capitalize plain text, leaving HTML/Math syntax intact
            if (index === 0 && !txt.trim().startsWith('<') && !txt.trim().startsWith('$') && !txt.trim().startsWith('`')) {
                txt = txt.charAt(0).toUpperCase() + txt.slice(1);
            }
            chip.innerHTML = this.formatText(txt);
            if (!state.isSolved) chip.onclick = () => this.moveFragment(frag, 'assembly', 'bank');
            this.el['target-zone'].appendChild(chip);
        });

        if (!state.isSolved) {
            this.el['btn-submit'].disabled = state.assembly.length === 0;
            this.el.hintBtn.disabled = state.hintUsed;
        }
        
        // Re-trigger math render for newly added DOM elements
        this.triggerMathRender();
    }

    moveFragment(fragment, from, to) {
        const unit = this.lessonData.learning_units[this.currentUnitIndex];
        const state = this.unitStates[unit.unit_id][this.currentLang];
        if (state.isSolved) return;
        state[from] = state[from].filter(f => f.id !== fragment.id);
        state[to].push(fragment);
        this.el['feedback-banner'].style.display = 'none';
        this.renderFragments(state);
    }

    giveHint() {
        const unit = this.lessonData.learning_units[this.currentUnitIndex];
        const state = this.unitStates[unit.unit_id][this.currentLang];
        state.hintUsed = true;
        
        const challenge = unit.challenges[this.currentLang] || unit.challenges.en || unit.challenges;
        this.showFeedback(`💡 <strong>Hint:</strong> ${this.formatText(challenge.hint)}`, 'secondary');
        this.el.hintBtn.disabled = true;
    }

    checkAnswer() {
        const unit = this.lessonData.learning_units[this.currentUnitIndex];
        const challenge = unit.challenges[this.currentLang] || unit.challenges.en || unit.challenges;
        const state = this.unitStates[unit.unit_id][this.currentLang];
        const targets = challenge.target_sequence || challenge.fragments || [];
        
        state.attempts++;

        const distractor = state.assembly.find(f => !f.isTarget);
        if (distractor) {
            this.showFeedback(`❌ ${this.formatText(distractor.penalty_explanation)}`, 'error');
            return;
        }

        if (state.assembly.length !== targets.length) {
            // Option C pedagogical logic check
            let matchedIdx = -1;
            for(let i=0; i<state.assembly.length; i++) {
                if (state.assembly[i].id === targets[i].id) matchedIdx = i; else break;
            }
            if (matchedIdx >= 0 && matchedIdx < targets.length - 1) {
                const nextExpected = targets[matchedIdx + 1];
                if (nextExpected.role_hint) {
                    const hintText = nextExpected.role_hint[this.currentLang] || nextExpected.role_hint.en || nextExpected.role_hint;
                    this.showFeedback(`⚠️ <strong>Next Step:</strong> ${this.formatText(hintText)}`, 'secondary');
                    return;
                }
            }
            this.showFeedback(this.SYSTEM_MESSAGES.incomplete[this.currentLang], 'error');
            return;
        }

        let isCorrect = true;
        for (let i = 0; i < targets.length; i++) {
            if (state.assembly[i].id !== targets[i].id) { isCorrect = false; break; }
        }

        if (isCorrect) this.handleSuccess(unit, state);
        else this.showFeedback(this.SYSTEM_MESSAGES.orderError[this.currentLang], 'error');
    }

    handleSuccess(unit, state) {
        state.isSolved = true;
        let marks = 10;
        if (state.attempts > 1) marks -= 2;
        if (state.hintUsed) marks -= 2;
        marks = Math.max(2, marks);

        const uid = unit.unit_id;
        if (marks > this.masteryScores[uid][this.currentLang]) {
            this.masteryScores[uid][this.currentLang] = marks;
        }

        this.renderGrid();
        this.el['target-zone'].classList.add('success-lock');
        this.renderFragments(state);

        const takeaway = unit.key_takeaway[this.currentLang] || unit.key_takeaway.en || unit.key_takeaway;
        let successHtml = `🎉 <strong>Correct! (+${marks} pts)</strong><br><br><em>Takeaway:</em> ${this.formatText(takeaway)}`;
        
        const otherLang = this.currentLang === 'en' ? 'hi' : 'en';
        if (this.masteryScores[uid][otherLang] === 0) {
            successHtml += `<br><br><small>💡 Switch to ${otherLang === 'en' ? 'English' : 'Hindi'} to claim your remaining 10 Mastery Points for this unit!</small>`;
        }
        this.showFeedback(successHtml, 'success');
        this.el['btn-submit'].disabled = true;
        this.el.hintBtn.disabled = true;
    }

    showFeedback(message, type) {
        this.el['feedback-banner'].innerHTML = message;
        this.el['feedback-banner'].className = `feedback-banner ${type} math-render`;
        this.el['feedback-banner'].style.display = 'block';
        this.triggerMathRender();
    }

    shuffleArray(array) {
        let newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    }

    /* --- RESULTS & DB SUBMIT --- */
    completeModule() {
        if (this.masterTimer) { clearInterval(this.masterTimer); this.masterTimer = null; }
        let total = 0;
        Object.values(this.masteryScores).forEach(s => total += (s.en + s.hi));
        const max = this.lessonData.learning_units.length * 20;
        
        this.el.finalScore.innerText = total;
        this.el.totalPossible.innerText = max;
        this.el.percentage.innerText = max > 0 ? Math.round((total/max)*100) + '%' : '0%';
        
        const m = String(Math.floor(this.totalElapsedSeconds / 60)).padStart(2, '0');
        const s = String(this.totalElapsedSeconds % 60).padStart(2, '0');
        this.el.totalTime.innerText = `${m}:${s}`;
        
        this.showScreen('resultsScreen');
        this.submitToDatabase(total, max, `${m}:${s}`);
    }

    async submitToDatabase(score, max, time) {
        const metaTitle = this.lessonData.metadata.chapter_title;
        const finalTitle = metaTitle.en || metaTitle;
        
        const payload = {
            action: 'submit',
            studentName: this.studentInfo.name,
            schoolName: this.studentInfo.school,
            class: this.studentInfo.class,
            subject: this.studentInfo.subject,
            lesson: finalTitle,
            mode: "LEARNING",
            score: `${score}/${max}`,
            timeTaken: `'${time}` 
        };
        try { await fetch(this.SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) }); } 
        catch (e) { console.warn("Submit silently failed", e); }
    }

    /* --- SCOREBOARD LOGIC --- */
    async fetchScoreboard() {
        this.el.scoreboardBody.innerHTML = '<tr><td colspan="9" style="padding:40px; text-align:center;">Syncing...</td></tr>';
        try {
            const r = await fetch(`${this.SCRIPT_URL}?action=get&t=${Date.now()}`);
            this.scoreboardData = await r.json(); 
            this.sortScoreboard('date');
        } catch (e) { 
            this.el.scoreboardBody.innerHTML = '<tr><td colspan="9" style="color:#ef4444; text-align:center;">Server Error.</td></tr>'; 
        }
    }

    sortScoreboard(key) {
        if (this.sortConfig.key === key) this.sortConfig.asc = !this.sortConfig.asc;
        else { this.sortConfig.key = key; this.sortConfig.asc = (key === 'student' || key === 'class'); }
        
        document.querySelectorAll('#leaderboardHeaders th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
        const active = document.querySelector(`#leaderboardHeaders th[data-sort="${key}"]`);
        if (active) active.classList.add(this.sortConfig.asc ? 'sort-asc' : 'sort-desc');

        const cleanEfficiency = (s) => {
            let raw = String(s || '').replace('⏱️', '').replace("'", "").trim();
            if (raw.includes('T')) raw = raw.split('T')[1].split('.')[0];
            if (raw.startsWith('00:')) raw = raw.substring(3);
            return raw || '0:00';
        };

        const data = [...this.scoreboardData];
        data.sort((a, b) => {
            let vA, vB;
            switch (key) {
                case 'rank': 
                case 'score': vA = parseFloat(a[7]) || 0; vB = parseFloat(b[7]) || 0; break;
                case 'date': vA = new Date(a[0]); vB = new Date(b[0]); break;
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
            if (vA < vB) return this.sortConfig.asc ? -1 : 1;
            if (vA > vB) return this.sortConfig.asc ? 1 : -1;
            return 0;
        });

        this.el.scoreboardBody.innerHTML = data.slice(0, 50).map((r, i) => `
            <tr>
                <td style="padding:15px; font-weight:bold;">${i+1}</td>
                <td style="padding:15px; font-size:11px;">${r[0] ? new Date(r[0]).toLocaleDateString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                <td style="padding:15px;"><strong>${r[1]}</strong><br><small>${r[2]}</small></td>
                <td style="padding:15px; font-size:12px;">${r[3]}</td>
                <td style="padding:15px; font-size:12px;">${r[4]}</td>
                <td style="padding:15px; font-size:12px;">${r[5]}</td>
                <td style="padding:15px;"><span class="stat-badge ${r[6] === 'TEST' ? 'strict' : ''}">${r[6]}</span></td>
                <td style="padding:15px; font-weight:800; color:#2563eb;">${r[7]}</td>
                <td style="padding:15px; font-size:12px;">⏱️ ${cleanEfficiency(r[8])}</td>
            </tr>
        `).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => { window.conceptApp = new ConceptApp(); });
