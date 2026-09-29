class QuizApp {
    constructor() {
        this.quizEngine = new QuizEngine();
        // UPDATED: User's new Script URL
        this.SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxNWnLdQxUnjOCfWHoyZALx-orP0D1v9Q04ic9hl3Ido3W3gOgRoYiq2MuN-bv687I/exec";
        this.ADMIN_PASSWORD = "Admin@2026";
        this.GITHUB_CONFIG = { owner: "mcaravikantpotdar", repo: "Multi-Class-Quiz", path: "jsons" };
        
        this.fullLibraryData = {};
        this.selectedClass = null;
        this.selectedSubject = null;
        this.selectedQuizPath = null;
        
        this.currentAttempts = {};
        this.hintUsed = {};
        this.shuffledOrders = {};
        this.scoreboardData = [];
        this.sortConfig = { key: 'date', asc: false };
        
        this.init();
    }

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await this.autoScanGitHubLibrary();
    }

    cacheDOM() {
        const ids = [
            'studentName', 'schoolName', 'quizList', 'startQuiz', 'viewScoreboardBtn', 
            'viewScoreboardFromResults', 'backFromScoreboard', 'topHomeBtn', 'topQuitBtn', 
            'nextBtn', 'prevBtn', 'hintBtn', 'quitBtn', 'confirmQuit', 'cancelQuit', 
            'retakeBtn', 'homeBtn', 'adminGear', 'adminModal', 'adminPassword', 
            'confirmReset', 'closeAdmin', 'adminError', 'quitModal', 'errorMessage',
            'optionsContainer', 'questionGrid', 'questionEn', 'questionHi',
            'resultsBreakdown', 'finalScore', 'totalPossible', 'percentage', 'totalTime',
            'leaderboardHeaders', 'scoreboardBody', 'classSelect', 'subjectSelect', 
            'subjectGroup', 'lessonGroup'
        ];
        ids.forEach(id => { 
            const el = document.getElementById(id);
            if (!el) console.warn(`QuizApp: ID "${id}" not found in HTML.`);
            this[id] = el; 
        });
        this.quizListContainer = this.quizList;
        this.errorDiv = this.errorMessage;
    }

    bindEvents() {
        if (this.studentName) this.studentName.addEventListener('input', () => this.validateStartForm());
        if (this.schoolName) this.schoolName.addEventListener('input', () => this.validateStartForm());
        
        if (this.classSelect) this.classSelect.addEventListener('change', (e) => this.handleClassSelection(e.target.value));
        if (this.subjectSelect) this.subjectSelect.addEventListener('change', (e) => this.handleSubjectSelection(e.target.value));

        if (this.startQuiz) this.startQuiz.addEventListener('click', () => this.handleStart());
        
        const showScore = () => { QuizUtils.showScreen('scoreboardScreen'); this.fetchScoreboard(); };
        if (this.viewScoreboardBtn) this.viewScoreboardBtn.addEventListener('click', showScore);
        if (this.viewScoreboardFromResults) this.viewScoreboardFromResults.addEventListener('click', showScore);
        
        if (this.backFromScoreboard) {
            this.backFromScoreboard.addEventListener('click', () => {
                if (this.quizEngine.quizData) QuizUtils.showScreen('quizScreen');
                else QuizUtils.showScreen('uploadScreen');
            });
        }

        if (this.leaderboardHeaders) {
            this.leaderboardHeaders.addEventListener('click', (e) => {
                const th = e.target.closest('th');
                if (th && th.dataset.sort) this.sortScoreboard(th.dataset.sort);
            });
        }

        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.nextQuestion());
        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.previousQuestion());
        if (this.topHomeBtn) this.topHomeBtn.addEventListener('click', () => window.location.reload());
        if (this.hintBtn) this.hintBtn.addEventListener('click', () => this.showHint());
        
        const openQuit = () => { if (this.quitModal) this.quitModal.classList.add('active'); };
        if (this.quitBtn) this.quitBtn.addEventListener('click', openQuit);
        if (this.topQuitBtn) this.topQuitBtn.addEventListener('click', openQuit);
        
        if (this.cancelQuit) this.cancelQuit.addEventListener('click', () => this.quitModal.classList.remove('active'));
        if (this.confirmQuit) this.confirmQuit.addEventListener('click', () => this.quitQuiz());
        if (this.retakeBtn) this.retakeBtn.addEventListener('click', () => {
            this.quizEngine.nuclearReset();
            this.startActualQuiz();
        });
        if (this.homeBtn) this.homeBtn.addEventListener('click', () => window.location.reload());
        
        if (this.adminGear) {
            this.adminGear.onclick = () => {
                if (this.adminModal) this.adminModal.classList.add('active');
            };
        }
        
        if (this.closeAdmin) this.closeAdmin.addEventListener('click', () => this.adminModal.classList.remove('active'));
        if (this.adminPassword) this.adminPassword.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.handleDatabaseReset(); });
        if (this.confirmReset) this.confirmReset.addEventListener('click', () => this.handleDatabaseReset());

        // FIX: Single delegated event listener for options to prevent memory leaks
        if (this.optionsContainer) {
            this.optionsContainer.addEventListener('click', (e) => {
                const card = e.target.closest('.option-card');
                if (card && !card.classList.contains('disabled')) {
                    const optKey = card.dataset.key; // Read the injected key
                    if (optKey) this.selectOption(optKey);
                }
            });
        }
    }

    async autoScanGitHubLibrary() {
        const { owner, repo } = this.GITHUB_CONFIG;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
        try {
            const response = await fetch(apiUrl, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`GitHub Error: ${response.status}`);
            const data = await response.json();
            const jsonFiles = data.tree.filter(item => item.path.startsWith('jsons/') && item.path.toLowerCase().endsWith('.json'));
            this.parseLibraryTree(jsonFiles);
            this.renderClassDropdown();
        } catch (error) {
            if (this.errorDiv) this.errorDiv.textContent = `Library Error: ${error.message}`;
        }
    }

    parseLibraryTree(files) {
        files.forEach(file => {
            const parts = file.path.split('/');
            if (parts.length < 4) return;
            const className = this.cleanName(parts[1]);
            const subjectName = this.cleanName(parts[2]);
            const lessonName = this.cleanName(parts[3].replace('.json', ''));
            if (!this.fullLibraryData[className]) this.fullLibraryData[className] = {};
            if (!this.fullLibraryData[className][subjectName]) this.fullLibraryData[className][subjectName] = [];
            this.fullLibraryData[className][subjectName].push({ displayName: lessonName, path: file.path });
        });
    }

    cleanName(str) { return str.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }

    renderClassDropdown() {
        if (!this.classSelect) return;
        const classes = Object.keys(this.fullLibraryData).sort();
        classes.forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls; opt.textContent = cls;
            this.classSelect.appendChild(opt);
        });
    }

    handleClassSelection(cls) {
        this.selectedClass = cls; this.selectedSubject = null; this.selectedQuizPath = null;
        if (this.subjectGroup) this.subjectGroup.style.display = 'block';
        if (this.lessonGroup) this.lessonGroup.style.display = 'none';
        if (this.subjectSelect) {
            this.subjectSelect.innerHTML = '<option value="" disabled selected>Choose Subject...</option>';
            const subjects = Object.keys(this.fullLibraryData[cls]).sort();
            subjects.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub; opt.textContent = sub;
                this.subjectSelect.appendChild(opt);
            });
        }
        this.validateStartForm();
    }

    handleSubjectSelection(sub) {
        this.selectedSubject = sub; this.selectedQuizPath = null;
        if (this.lessonGroup) this.lessonGroup.style.display = 'block';
        this.renderLessonButtons();
        this.validateStartForm();
    }

    renderLessonButtons() {
        if (!this.quizListContainer || !this.selectedClass || !this.selectedSubject) return;
        this.quizListContainer.innerHTML = '';
        const lessons = this.fullLibraryData[this.selectedClass][this.selectedSubject];
        lessons.forEach(lesson => {
            const btn = document.createElement('div');
            btn.className = 'quiz-btn'; btn.textContent = `📂 ${lesson.displayName}`;
            btn.onclick = () => {
                document.querySelectorAll('.quiz-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected'); this.selectedQuizPath = lesson.path;
                this.validateStartForm();
            };
            this.quizListContainer.appendChild(btn);
        });
    }

    validateStartForm() {
        const ok = this.studentName?.value.trim() && this.schoolName?.value.trim() && this.selectedClass && this.selectedSubject && this.selectedQuizPath;
        if (this.startQuiz) this.startQuiz.disabled = !ok;
    }

    async handleStart() {
        QuizUtils.showLoading(true);
        try {
            this.quizEngine.nuclearReset();
            const r = await fetch(`${this.selectedQuizPath}?t=${Date.now()}`);
            const data = await r.json();
            this.quizEngine.loadQuizData(data, this.studentName.value, this.schoolName.value);
            this.startActualQuiz();
        } catch (e) { if (this.errorDiv) this.errorDiv.textContent = `Load Error: ${e.message}`; }
        finally { QuizUtils.showLoading(false); }
    }

    startActualQuiz() {
        const modeInput = document.querySelector('input[name="quizMode"]:checked');
        const mode = modeInput ? modeInput.value : 'practice';
        this.quizEngine.setMode(mode);
        Object.keys(this.quizEngine.userAnswers).forEach(id => { if (this.quizEngine.userAnswers[id].hintUsed) this.hintUsed[id] = true; });
        
        const metadata = this.quizEngine.quizData.metadata;
        const titleEl = document.getElementById('chapterTitle');
        const totalEl = document.getElementById('totalQuestions');
        if (titleEl) titleEl.textContent = metadata.chapter_title;
        if (totalEl) totalEl.textContent = this.quizEngine.getTotalQuestions();
        
        this.updateHeaderIdentity();
        QuizUtils.showScreen('quizScreen');
        this.renderQuestionGrid();
        this.showQuestion(this.quizEngine.currentQuestionIndex);
    }

    updateHeaderIdentity() {
        const old = document.getElementById('identityBar'); if(old) old.remove();
        const html = `<div id="identityBar"><div class="id-student-info"><div class="id-name">👤 ${this.studentName.value}</div><div class="id-school">${this.selectedClass} • ${this.selectedSubject}</div></div><div class="stat-badge ${this.quizEngine.mode === 'test' ? 'strict' : ''}">${this.quizEngine.mode.toUpperCase()} MODE</div></div>`;
        const temp = document.createElement('div'); temp.innerHTML = html.trim();
        const header = document.querySelector('.quiz-header');
        if (header) header.insertBefore(temp.firstChild, header.firstChild);
    }

    showQuestion(i) {
        this.quizEngine.stopTimer();
        this.quizEngine.currentQuestionIndex = i;
        const q = this.quizEngine.getCurrentQuestion();
        if (!q || !q.question) return;

        // --- NEW: Safe Image Rendering Logic ---
        const imageHtml = q.question_image ? `<div class="quiz-image-container"><img src="${q.question_image}" class="quiz-img" alt="Question Diagram"></div>` : '';
        
        const qText = q.question;
        if (this.questionEn) this.questionEn.innerHTML = imageHtml + ((typeof qText === 'object') ? qText.en : qText);
        if (this.questionHi) this.questionHi.innerHTML = (typeof qText === 'object') ? qText.hi : '';
        
        const currentQEl = document.getElementById('currentQuestion');
        if (currentQEl) currentQEl.textContent = i + 1;
        
        this.renderOptions(q);
        document.querySelectorAll('#feedbackContainer, #hintArea').forEach(el => el.remove());
        
        // SAFE FALLBACKS FOR OPTIONAL FIELDS
        const enExpl = q.explanation?.en || (typeof q.explanation === 'string' ? q.explanation : 'Check takeaway.');
        const hiExpl = q.explanation?.hi || '';
        const explImg = q.explanation?.expl_image ? `<img src="${q.explanation.expl_image}" class="expl-img">` : '';

        const fb = `<div id="feedbackContainer" style="display:none;"><div class="feedback-area explanation-area"><h4>✅ Explanation</h4><div>${enExpl}</div><div style="margin-top:5px; opacity:0.8;">${hiExpl}</div>${explImg}</div><div class="key-takeaway-area"><h4>🔑 Key Takeaway</h4><div>${q.key_takeaway?.en || ''}</div><div style="margin-top:5px; opacity:0.8;">${q.key_takeaway?.hi || ''}</div></div></div><div id="hintArea" class="feedback-area hint-area" style="display:none;"><h4>💡 Hint</h4><div>${q.hint?.en || 'Try narrowing it down.'}</div><div style="margin-top:5px; opacity:0.8;">${q.hint?.hi || ''}</div></div>`;
            
        if (this.optionsContainer) this.optionsContainer.insertAdjacentHTML('afterend', fb);
        this.updateQuestionGrid();
        this.updateNavigation();
        
        this.quizEngine.startTimer(q.question_id, (t) => { 
            const timerEl = document.getElementById('timer');
            if (timerEl) timerEl.textContent = t;
        }, () => this.showQuestion(i));

        const fbCont = document.getElementById('feedbackContainer');
        const hArea = document.getElementById('hintArea');
        if (this.quizEngine.isQuestionDisabled(q.question_id) && this.quizEngine.mode === 'practice' && fbCont) fbCont.style.display = 'block';
        if (this.hintUsed[q.question_id] && hArea) hArea.style.display = 'block';
        if (this.hintBtn) this.hintBtn.disabled = this.quizEngine.isQuestionDisabled(q.question_id) || this.hintUsed[q.question_id];
    }

    renderOptions(q) {
        if (!this.optionsContainer) return;
        this.optionsContainer.innerHTML = '';
        const order = this.getShuffledOptions(q);
        const ans = this.quizEngine.userAnswers[q.question_id];
        
        order.forEach((key, idx) => {
            const card = document.createElement('div'); card.className = 'option-card';
            const data = q.options[key];
            // Safe rendering for image-based options
            const optImg = data.opt_image ? `<div class="option-img-container"><img src="${data.opt_image}" class="option-img"></div>` : '';
            
            card.innerHTML = `${optImg}<div class="option-label">${['A','B','C','D'][idx] || '?'}</div><div class="option-content"><div class="opt-lang en">${data.en || data}</div><div class="opt-lang hi">${data.hi || ''}</div></div>`;
            if (ans) {
                if (this.quizEngine.mode === 'practice') {
                    if (ans.history.includes(key)) card.classList.add(key === q.correct_option ? 'correct' : 'wrong');
                    else if (this.quizEngine.isQuestionDisabled(q.question_id) && key === q.correct_option) card.classList.add('correct');
                } else if (key === ans.selectedOption) card.classList.add('selected-only');
            }
            
            if (this.quizEngine.isQuestionDisabled(q.question_id)) {
                card.classList.add('disabled');
            } else {
                // FIX: Inject the key into the DOM for the delegated listener
                card.dataset.key = key; 
            }
            this.optionsContainer.appendChild(card);
        });
    }

    getShuffledOptions(q) {
        if (this.shuffledOrders[q.question_id]) return this.shuffledOrders[q.question_id];
        // UPDATED: Dynamic options detection instead of hardcoded 'abcd'
        let o = Object.keys(q.options);
        if (!JSON.stringify(q.options).toLowerCase().match(/both|all of|none of/)) {
            for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
        }
        this.shuffledOrders[q.question_id] = o; return o;
    }

    selectOption(opt) {
        const qId = this.quizEngine.getCurrentQuestion().question_id;
        this.currentAttempts[qId] = (this.currentAttempts[qId] || 0) + 1;
        this.quizEngine.recordAnswer(qId, opt, this.currentAttempts[qId], this.hintUsed[qId]);
        this.showQuestion(this.quizEngine.currentQuestionIndex);
        const scoreEl = document.getElementById('currentScore');
        if (scoreEl) scoreEl.textContent = this.quizEngine.score;
    }

    showHint() {
        const qId = this.quizEngine.getCurrentQuestion().question_id;
        this.hintUsed[qId] = true;
        const hArea = document.getElementById('hintArea');
        if (hArea) hArea.style.display = 'block';
        if (this.hintBtn) this.hintBtn.disabled = true;
    }

    updateNavigation() {
        const isLast = this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1;
        if (this.nextBtn) this.nextBtn.textContent = isLast ? '🏁 Finish' : 'Next →';
        if (this.prevBtn) this.prevBtn.disabled = this.quizEngine.currentQuestionIndex === 0;
    }

    renderQuestionGrid() {
        if (!this.questionGrid) return;
        this.questionGrid.innerHTML = '';
        this.quizEngine.quizData.questions.forEach((q, i) => {
            const el = document.createElement('div');
            el.className = `question-number ${this.quizEngine.getQuestionStatus(q.question_id)}`;
            if (i === this.quizEngine.currentQuestionIndex) el.classList.add('current');
            const marks = this.quizEngine.getQuestionMarks(q.question_id);
            el.innerHTML = `<div class="q-number">${i + 1}</div><div class="marks">${marks ? marks.display : ''}</div>`;
            el.onclick = () => { if (i !== this.quizEngine.currentQuestionIndex) this.showQuestion(i); };
            this.questionGrid.appendChild(el);
        });
    }

    updateQuestionGrid() { this.renderQuestionGrid(); }

    previousQuestion() { this.showQuestion(this.quizEngine.currentQuestionIndex - 1); }
    nextQuestion() { 
        if (this.quizEngine.currentQuestionIndex === this.quizEngine.getTotalQuestions() - 1) this.completeQuiz();
        else this.showQuestion(this.quizEngine.currentQuestionIndex + 1);
    }
    
    quitQuiz() {
        if (this.quitModal) this.quitModal.classList.remove('active');
        this.completeQuiz(true);
    }

    completeQuiz(forced = false) { 
        try {
            const res = this.quizEngine.getResults();
            if (!forced && res.unattemptedCount > 0) {
                if (!confirm(`Finish with ${res.unattemptedCount} unattempted questions?`)) return;
            }
            this.quizEngine.stopTimer(); QuizUtils.createConfetti(); 
            try {
                if (this.finalScore) this.finalScore.textContent = res.totalScore; 
                if (this.totalPossible) this.totalPossible.textContent = res.maxScore; 
                if (this.percentage) this.percentage.textContent = res.percentage + '%'; 
                if (this.totalTime) this.totalTime.textContent = res.timeTaken; 
                this.renderResultsBreakdown(res); 
            } catch (uiError) { console.warn("UI sync error:", uiError); }
            QuizUtils.showScreen('resultsScreen'); 
            this.submitScore(res); 
            this.quizEngine.nuclearReset(); 
        } catch (error) { console.error("QuizApp: recovery reset", error); this.quizEngine.nuclearReset(); }
    }

    renderResultsBreakdown(res) {
        if (!this.resultsBreakdown) return;
        this.resultsBreakdown.innerHTML = res.questions.map((q, i) => {
            const a = res.userAnswers[q.question_id];
            const status = (a && a.isCorrect) ? 'correct' : ((!a || a.isPartial) ? 'skipped' : 'wrong');
            const qEn = (typeof q.question === 'object') ? q.question.en : q.question;
            const correctOpt = q.options[q.correct_option];
            const correctText = (typeof correctOpt === 'object') ? correctOpt.en : correctOpt;
            return `<div class="result-item ${status}"><div class="result-meta">Q${i+1} • ${a?.marks || 0} Marks</div><div class="result-question">${qEn}</div><div style="font-size:13px; color:#64748b;">Answer: ${correctText}</div></div>`;
        }).join('');
    }

    async fetchScoreboard() {
        if (!this.scoreboardBody) return;
        this.scoreboardBody.innerHTML = '<tr><td colspan="9" style="padding:40px; text-align:center;">Syncing...</td></tr>';
        try {
            const r = await fetch(`${this.SCRIPT_URL}?action=get&t=${Date.now()}`);
            this.scoreboardData = await r.json(); this.sortScoreboard('date');
        } catch (e) { this.scoreboardBody.innerHTML = '<tr><td colspan="9" style="color:#ef4444; text-align:center;">Server Error.</td></tr>'; }
    }

    cleanEfficiency(s) {
        let raw = String(s || '').replace('⏱️', '').replace("'", "").trim();
        if (raw.includes('T')) raw = raw.split('T')[1].split('.')[0];
        if (raw.startsWith('00:')) raw = raw.substring(3);
        return raw || '0:00';
    }

    sortScoreboard(key) {
        if (this.sortConfig.key === key) this.sortConfig.asc = !this.sortConfig.asc;
        else { this.sortConfig.key = key; this.sortConfig.asc = (key === 'student' || key === 'class'); }
        
        const headers = document.querySelectorAll('#leaderboardHeaders th');
        headers.forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
        const active = document.querySelector(`#leaderboardHeaders th[data-sort="${key}"]`);
        if (active) active.classList.add(this.sortConfig.asc ? 'sort-asc' : 'sort-desc');

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
                        const clean = this.cleanEfficiency(s);
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

        this.scoreboardBody.innerHTML = data.slice(0, 50).map((r, i) => `
            <tr>
                <td style="padding:15px; font-weight:bold;">${i+1}</td>
                <td style="padding:15px; font-size:11px;">${r[0] ? new Date(r[0]).toLocaleDateString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                <td style="padding:15px;"><strong>${r[1]}</strong><br><small>${r[2]}</small></td>
                <td style="padding:15px; font-size:12px;">${r[3]}</td>
                <td style="padding:15px; font-size:12px;">${r[4]}</td>
                <td style="padding:15px; font-size:12px;">${r[5]}</td>
                <td style="padding:15px;"><span class="tag ${r[6] === 'TEST' ? 'strict' : ''}">${r[6]}</span></td>
                <td style="padding:15px; font-weight:800; color:#2563eb;">${r[7]}</td>
                <td style="padding:15px; font-size:12px;">⏱️ ${this.cleanEfficiency(r[8])}</td>
            </tr>
        `).join('');
    }

    async handleDatabaseReset() {
        if (this.adminPassword?.value !== this.ADMIN_PASSWORD) { if (this.adminError) this.adminError.textContent = '❌ Incorrect Password'; return; }
        if (!confirm("Erase all records?")) return;
        QuizUtils.showLoading(true);
        try {
            await fetch(this.SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ action: 'clear_all_records', password: this.adminPassword.value }) });
            alert("✅ Reset Complete."); this.adminModal.classList.remove('active'); this.fetchScoreboard();
        } catch (e) { alert("Error."); } finally { QuizUtils.showLoading(false); }
    }

    async submitScore(res) {
        const lockedTime = `'${res.timeTaken}`;
        // PAYLOAD UPDATED FOR 9 COLUMNS IN BACKEND
        const p = { 
            action: 'submit', 
            studentName: this.studentName.value, 
            schoolName: this.schoolName.value, 
            class: this.selectedClass,
            subject: this.selectedSubject,
            lesson: this.quizEngine.quizData.metadata.chapter_title, 
            mode: this.quizEngine.mode.toUpperCase(), 
            score: `${res.totalScore}/${res.maxScore}`, 
            timeTaken: lockedTime 
        };
        try { await fetch(this.SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(p) }); } catch (e) { }
    }
}
document.addEventListener('DOMContentLoaded', () => { window.app = new QuizApp(); });
