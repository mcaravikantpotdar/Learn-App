class QuizEngine {
    constructor() {
        this.quizData = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.score = 0;
        this.startTime = null;
        this.timer = null;
        this.currentTimer = 99;
        this.mode = 'practice';
        this.questionTimers = {};
        this.questionTimeSpent = {};
        this.currentQuestionId = null;
        
        // --- IDENTITY & MASTER CLOCK ---
        this.studentName = '';
        this.schoolName = '';
        this.totalElapsedSeconds = 0;
        this.overallTimer = null;
    }

    setMode(mode) { this.mode = mode; }

    loadQuizData(data, name = '', school = '') {
        const validation = QuizUtils.validateQuizJSON(data);
        if (!validation.isValid) throw new Error(`Data Error: ${validation.errors[0]}`);
        
        this.quizData = data;
        this.studentName = name;
        this.schoolName = school;
        
        this.loadProgress();
    }

    getCurrentQuestion() { return this.quizData.questions[this.currentQuestionIndex]; }
    getTotalQuestions() { return this.quizData ? this.quizData.questions.length : 0; }
    getMaxScore() { return this.getTotalQuestions() * 4; }

    recordAnswer(questionId, selectedOption, attemptNumber, hintUsed = false) {
        const question = this.quizData.questions.find(q => q.question_id === questionId);
        if (!question) return;
        const isCorrect = String(selectedOption) === String(question.correct_option);
        let marks = 0;
        if (!this.userAnswers[questionId]) {
            this.userAnswers[questionId] = { history: [], attempts: 0, isCorrect: false, marks: 0, hintUsed: hintUsed };
        }
        const currentData = this.userAnswers[questionId];
        if (!currentData.history.includes(selectedOption)) currentData.history.push(selectedOption);

        if (this.mode === 'test') {
            marks = isCorrect ? (hintUsed ? 2 : 4) : 0;
            currentData.attempts = 3;
        } else {
            if (isCorrect) {
                switch (attemptNumber) {
                    case 1: marks = hintUsed ? 3 : 4; break;
                    case 2: marks = hintUsed ? 2 : 3; break;
                    case 3: marks = hintUsed ? 1 : 2; break;
                }
            } else if (attemptNumber === 3) marks = hintUsed ? 0 : 1;
            currentData.attempts = attemptNumber;
        }
        currentData.selectedOption = selectedOption;
        currentData.isCorrect = isCorrect;
        currentData.marks = marks;
        currentData.hintUsed = hintUsed;
        currentData.answeredAt = new Date().toISOString();
        const finalized = (isCorrect || currentData.attempts >= 3);
        currentData.isPartial = !finalized;
        
        if (finalized) this.stopTimer();
        this.calculateScore();
        this.saveProgress();
        return { isCorrect, marks };
    }

    startTimer(questionId, onTick, onExpire) {
        if (!this.overallTimer) {
            this.overallTimer = setInterval(() => {
                this.totalElapsedSeconds++;
                // FIX: Throttle synchronous I/O operations. Save only every 5 seconds.
                if (this.totalElapsedSeconds % 5 === 0) {
                    this.saveProgress();
                }
            }, 1000);
        }

        if (this.isQuestionDisabled(questionId)) {
            onTick(this.questionTimers[questionId] || 0);
            return;
        }
        this.stopTimer();
        const startSeconds = this.initializeQuestionTimer(questionId);
        this.currentTimer = startSeconds;
        this.currentQuestionId = questionId;
        const endTime = Date.now() + (startSeconds * 1000);
        onTick(this.currentTimer);
        this.timer = setInterval(() => {
            const distance = endTime - Date.now();
            this.currentTimer = Math.ceil(distance / 1000);
            if (this.currentTimer >= 0) onTick(this.currentTimer);
            if (this.currentTimer <= 0) {
                this.recordTimeout(questionId, this.userAnswers[questionId]?.hintUsed);
                onExpire();
            }
        }, 200);
    }

    stopTimer() {
        if (this.currentQuestionId && this.currentTimer >= 0) {
            this.questionTimers[this.currentQuestionId] = this.currentTimer;
            this.questionTimeSpent[this.currentQuestionId] = (this.mode === 'test' ? 40 : 99) - this.currentTimer;
        }
        // FIX: Strict interval clearing to prevent zombie threads
        if (this.timer) { 
            clearInterval(this.timer); 
            this.timer = null; 
        }
    }

    recordTimeout(questionId, hintUsed = false) {
        this.userAnswers[questionId] = { selectedOption: null, history: [], attempts: 3, isCorrect: false, marks: 0, hintUsed: hintUsed, isTimeout: true, isPartial: false };
        this.stopTimer();
        this.calculateScore();
        this.saveProgress();
    }

    initializeQuestionTimer(qId) {
        if (this.questionTimers[qId] === undefined) {
            this.questionTimers[qId] = (this.mode === 'test') ? 40 : 99;
            this.questionTimeSpent[qId] = 0;
        }
        return this.questionTimers[qId];
    }

    calculateScore() {
        this.score = Object.values(this.userAnswers).filter(ans => !ans.isPartial).reduce((t, a) => t + a.marks, 0);
    }

    getQuestionStatus(qId) {
        const a = this.userAnswers[qId];
        if (!a) return 'unanswered';
        if (a.isCorrect) return 'correct';
        if (a.attempts >= 3) return 'wrong';
        return 'attempted';
    }

    isQuestionDisabled(qId) {
        const a = this.userAnswers[qId];
        return a && !a.isPartial && (a.isCorrect || a.attempts >= 3);
    }

    getQuestionMarks(qId) {
        const a = this.userAnswers[qId];
        return (!a || a.isPartial) ? null : { obtained: a.marks, display: `${a.marks}/4` };
    }

    saveProgress() {
        const p = { 
            studentName: this.studentName,
            schoolName: this.schoolName,
            currentQuestionIndex: this.currentQuestionIndex,
            userAnswers: this.userAnswers,
            score: this.score,
            questionTimers: this.questionTimers,
            questionTimeSpent: this.questionTimeSpent,
            mode: this.mode,
            totalElapsedSeconds: this.totalElapsedSeconds
        };
        localStorage.setItem('quizProgress', JSON.stringify(p));
    }

    loadProgress() {
        const s = localStorage.getItem('quizProgress');
        if (s) {
            try {
                const p = JSON.parse(s);
                if (p.studentName !== this.studentName || p.schoolName !== this.schoolName) {
                    this.clearProgress();
                    return false;
                }
                this.currentQuestionIndex = p.currentQuestionIndex || 0;
                this.userAnswers = p.userAnswers || {};
                this.score = p.score || 0;
                this.questionTimers = p.questionTimers || {};
                this.questionTimeSpent = p.questionTimeSpent || {};
                this.mode = p.mode || 'practice';
                this.totalElapsedSeconds = p.totalElapsedSeconds || 0;
                return true;
            } catch (e) { console.error('Save Corrupted'); }
        }
        return false;
    }

    /**
     * NUCLEAR RESET: Ensures absolute memory clearing.
     */
    nuclearReset() {
        if (this.overallTimer) { clearInterval(this.overallTimer); this.overallTimer = null; }
        this.totalElapsedSeconds = 0;
        this.quizData = null; // CRITICAL: Clear stale questions
        this.clearProgress();
    }

    clearProgress() {
        localStorage.removeItem('quizProgress');
        if (this.overallTimer) { clearInterval(this.overallTimer); this.overallTimer = null; }
        this.currentQuestionIndex = 0;
        this.userAnswers = {};
        this.score = 0;
        this.questionTimers = {};
        this.questionTimeSpent = {};
        this.totalElapsedSeconds = 0;
        this.stopTimer();
    }

    getResults() {
        const mins = Math.floor(this.totalElapsedSeconds / 60);
        const secs = this.totalElapsedSeconds % 60;
        return {
            totalScore: this.score,
            maxScore: this.getMaxScore(),
            percentage: this.getMaxScore() > 0 ? Math.round((this.score / this.getMaxScore()) * 100) : 0,
            timeTaken: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
            userAnswers: this.userAnswers,
            questions: this.quizData.questions,
            unattemptedCount: this.quizData.questions.length - Object.keys(this.userAnswers).filter(id => !this.userAnswers[id].isPartial).length
        };
    }
}
