class ConceptBuilder {
    constructor() {
        this.lessonData = null;
        this.currentUnitIndex = 0;
        this.currentLang = 'en';
        
        // Persistent State Store: tracks assemblies, banks, and scores across languages and units
        this.unitStates = {}; 
        this.masteryScores = {}; 

        this.initElements();
        this.bindEvents();
        this.loadLesson();
    }

    initElements() {
        this.el = {
            title: document.getElementById('chapterTitle'),
            unitNum: document.getElementById('currentUnitNum'),
            totalNum: document.getElementById('totalUnitsNum'),
            masteryScore: document.getElementById('masteryScore'),
            maxScore: document.getElementById('maxScore'),
            unitGrid: document.getElementById('unitGrid'),
            
            btnEn: document.getElementById('btn-en'),
            btnHi: document.getElementById('btn-hi'),
            
            lessonTitle: document.getElementById('lesson-title'),
            theory: document.getElementById('lesson-theory'),
            mediaContainer: document.getElementById('media-container'),
            mediaCaption: document.getElementById('media-caption'),
            
            prompt: document.getElementById('challenge-prompt'),
            targetZone: document.getElementById('target-zone'),
            fragmentBank: document.getElementById('fragment-bank'),
            
            btnPrev: document.getElementById('prevBtn'),
            btnNext: document.getElementById('nextBtn'),
            btnHint: document.getElementById('hintBtn'),
            btnSubmit: document.getElementById('btn-submit'),
            feedback: document.getElementById('feedback-banner')
        };
    }

    bindEvents() {
        this.el.btnEn.addEventListener('click', () => this.switchLanguage('en'));
        this.el.btnHi.addEventListener('click', () => this.switchLanguage('hi'));
        
        this.el.btnPrev.addEventListener('click', () => this.navigateUnit(-1));
        this.el.btnNext.addEventListener('click', () => this.navigateUnit(1));
        
        this.el.btnSubmit.addEventListener('click', () => this.checkAnswer());
        this.el.btnHint.addEventListener('click', () => this.giveHint());
    }

    async loadLesson() {
        try {
            // 1. Dynamic GitHub Auto-Discovery
            const hostname = window.location.hostname;
            const pathname = window.location.pathname.split('/').filter(Boolean);
            let targetJsonUrl = '';

            if (hostname.includes('github.io') && pathname.length > 0) {
                const owner = hostname.split('.')[0];
                const repo = pathname[0]; 
                const apiFolderUrl = `https://api.github.com/repos/${owner}/${repo}/contents/jsons/Class-11/Comp.Sc.`;

                const dirResponse = await fetch(apiFolderUrl);
                let files;
                if (!dirResponse.ok) {
                    // Handle trailing dot fallback
                    const altApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/jsons/Class-11/Comp.Sc`;
                    const altRes = await fetch(altApiUrl);
                    if (!altRes.ok) throw new Error(`API scan failed: ${dirResponse.status}`);
                    files = await altRes.json();
                } else {
                    files = await dirResponse.json();
                }

                const jsonFile = files.find(file => file.name.toLowerCase().endsWith('.json'));
                if (!jsonFile) throw new Error("No .json file found in directory.");
                targetJsonUrl = jsonFile.download_url;
            } else {
                targetJsonUrl = 'jsons/Class-11/Comp.Sc./fundamentals-of-computer.json';
            }

            // 2. Fetch JSON
            const response = await fetch(targetJsonUrl);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            this.lessonData = await response.json();
            
            // 3. Initialize Persistent States
            this.initStates();
            
            // 4. Render UI
            this.el.title.innerText = this.lessonData.metadata.chapter_title[this.currentLang] || this.lessonData.metadata.chapter_title.en;
            this.el.totalNum.innerText = this.lessonData.learning_units.length;
            this.el.maxScore.innerText = this.lessonData.learning_units.length * 20;
            
            this.renderGrid();
            this.showUnit(0);
            
        } catch (error) {
            console.error("Auto-discovery failed:", error);
            this.el.title.innerText = "Error Loading Lesson File.";
        }
    }

    initStates() {
        this.lessonData.learning_units.forEach(unit => {
            const uid = unit.unit_id;
            this.masteryScores[uid] = { en: 0, hi: 0 };
            this.unitStates[uid] = {
                en: this.createLangState(unit.challenges.en),
                hi: this.createLangState(unit.challenges.hi)
            };
        });
    }

    createLangState(challenge) {
        let allFragments = [
            ...challenge.target_sequence.map(f => ({ ...f, isTarget: true })),
            ...challenge.distractors.map(f => ({ ...f, isTarget: false }))
        ];
        return {
            bank: this.shuffleArray(allFragments),
            assembly: [],
            isSolved: false,
            attempts: 0,
            hintUsed: false
        };
    }

    renderGrid() {
        this.el.unitGrid.innerHTML = '';
        this.lessonData.learning_units.forEach((unit, idx) => {
            const uid = unit.unit_id;
            const scoreEN = this.masteryScores[uid].en;
            const scoreHI = this.masteryScores[uid].hi;
            const totalScore = scoreEN + scoreHI;

            const badge = document.createElement('div');
            badge.className = `question-number`;
            
            // Status classes mapped to your Multi-Class-Quiz CSS
            if (totalScore === 20) badge.classList.add('correct');
            else if (totalScore > 0) badge.classList.add('attempted');

            if (idx === this.currentUnitIndex) badge.classList.add('current');

            badge.innerHTML = `
                <div class="q-number">${idx + 1}</div>
                <div class="marks">${totalScore}/20</div>
            `;
            badge.onclick = () => this.showUnit(idx);
            this.el.unitGrid.appendChild(badge);
        });

        // Update overall mastery
        let globalTotal = 0;
        Object.values(this.masteryScores).forEach(s => globalTotal += (s.en + s.hi));
        this.el.masteryScore.innerText = globalTotal;
    }

    navigateUnit(direction) {
        let nextIndex = this.currentUnitIndex + direction;
        if (nextIndex >= 0 && nextIndex < this.lessonData.learning_units.length) {
            this.showUnit(nextIndex);
        }
    }

    switchLanguage(lang) {
        if (this.currentLang === lang) return;
        this.currentLang = lang;
        
        this.el.btnEn.classList.toggle('active', lang === 'en');
        this.el.btnHi.classList.toggle('active', lang === 'hi');
        
        // Re-render the current unit with the preserved state of the new language
        this.showUnit(this.currentUnitIndex);
    }

    showUnit(index) {
        this.currentUnitIndex = index;
        const unit = this.lessonData.learning_units[index];
        const state = this.unitStates[unit.unit_id][this.currentLang];
        
        this.el.unitNum.innerText = index + 1;
        this.renderGrid(); // Updates the '.current' highlight

        // 1. Render Instruction Card
        this.el.lessonTitle.innerText = unit.instruction.title[this.currentLang];
        this.el.theory.innerText = unit.instruction.theory[this.currentLang];
        
        if (unit.instruction.media && unit.instruction.media.svg_code) {
            this.el.mediaContainer.style.display = 'block';
            this.el.mediaContainer.innerHTML = unit.instruction.media.svg_code;
            this.el.mediaCaption.innerText = unit.instruction.media.caption[this.currentLang];
        } else {
            this.el.mediaContainer.style.display = 'none';
            this.el.mediaCaption.innerText = '';
        }

        // 2. Render Challenge Board
        const challenge = unit.challenges[this.currentLang];
        this.el.prompt.innerText = challenge.prompt;
        
        this.el.feedback.style.display = 'none';
        this.el.targetZone.classList.remove('success-lock');

        this.renderFragments(state);

        // 3. Update Controls Navigation
        this.el.btnPrev.disabled = (index === 0);
        this.el.btnNext.innerText = (index === this.lessonData.learning_units.length - 1) ? "🏁 Finish" : "Next Unit →";
        
        // 4. Restore Success UI if already solved
        if (state.isSolved) {
            this.el.targetZone.classList.add('success-lock');
            this.showFeedback(`🎉 <strong>Solved! (+${this.masteryScores[unit.unit_id][this.currentLang]} pts)</strong><br><br><em>Takeaway:</em> ${unit.key_takeaway[this.currentLang]}`, 'success');
            this.el.btnSubmit.disabled = true;
            this.el.btnHint.disabled = true;
        }
    }

    renderFragments(state) {
        this.el.fragmentBank.innerHTML = '';
        this.el.targetZone.innerHTML = '';

        // Render Bank
        state.bank.forEach(frag => {
            const chip = document.createElement('div');
            chip.className = 'fragment-chip';
            chip.innerText = frag.text;
            if (!state.isSolved) {
                chip.onclick = () => this.moveFragment(frag, 'bank', 'assembly');
            }
            this.el.fragmentBank.appendChild(chip);
        });

        // Render Assembly (Dynamic Capitalization for Slot 0)
        state.assembly.forEach((frag, index) => {
            const chip = document.createElement('div');
            chip.className = 'fragment-chip';
            
            let displayText = frag.text;
            if (index === 0) {
                displayText = displayText.charAt(0).toUpperCase() + displayText.slice(1);
            }
            chip.innerText = displayText;
            
            if (!state.isSolved) {
                chip.onclick = () => this.moveFragment(frag, 'assembly', 'bank');
            }
            this.el.targetZone.appendChild(chip);
        });

        if (!state.isSolved) {
            this.el.btnSubmit.disabled = state.assembly.length === 0;
            this.el.btnHint.disabled = state.hintUsed;
        }
    }

    moveFragment(fragment, from, to) {
        const unit = this.lessonData.learning_units[this.currentUnitIndex];
        const state = this.unitStates[unit.unit_id][this.currentLang];
        
        if (state.isSolved) return; // Locked

        state[from] = state[from].filter(f => f.id !== fragment.id);
        state[to].push(fragment);
        
        this.el.feedback.style.display = 'none';
        this.renderFragments(state);
    }

    giveHint() {
        const unit = this.lessonData.learning_units[this.currentUnitIndex];
        const state = this.unitStates[unit.unit_id][this.currentLang];
        state.hintUsed = true;
        this.showFeedback(`💡 <strong>Hint:</strong> ${unit.challenges[this.currentLang].hint}`, 'secondary');
        this.el.btnHint.disabled = true;
    }

    checkAnswer() {
        const unit = this.lessonData.learning_units[this.currentUnitIndex];
        const challenge = unit.challenges[this.currentLang];
        const state = this.unitStates[unit.unit_id][this.currentLang];
        const targets = challenge.target_sequence;

        state.attempts++;

        // Distractor Check
        const distractor = state.assembly.find(f => !f.isTarget);
        if (distractor) {
            this.showFeedback(`❌ ${distractor.penalty_explanation}`, 'error');
            return;
        }

        // Length Check
        if (state.assembly.length !== targets.length) {
            this.showFeedback("❌ The sentence is incomplete or has missing clauses.", 'error');
            return;
        }

        // Order Check
        let isCorrect = true;
        for (let i = 0; i < targets.length; i++) {
            if (state.assembly[i].id !== targets[i].id) {
                isCorrect = false;
                break;
            }
        }

        if (isCorrect) {
            this.handleSuccess(unit, state);
        } else {
            this.showFeedback("❌ The logical order is incorrect. Check your clause connections.", 'error');
        }
    }

    handleSuccess(unit, state) {
        state.isSolved = true;
        
        // Calculate Score
        let marks = 10;
        if (state.attempts > 1) marks -= 2;
        if (state.hintUsed) marks -= 2;
        marks = Math.max(2, marks); // Floor at 2 pts

        // Save Score
        const uid = unit.unit_id;
        if (marks > this.masteryScores[uid][this.currentLang]) {
            this.masteryScores[uid][this.currentLang] = marks;
        }

        this.renderGrid(); // Updates the top badge color and total score

        // Render Success Display
        this.el.targetZone.classList.add('success-lock');
        this.renderFragments(state); // Re-render to apply lock visuals

        let successHtml = `🎉 <strong>Correct! (+${marks} pts)</strong><br><br>`;
        successHtml += `<em>Takeaway:</em> ${unit.key_takeaway[this.currentLang]}`;
        
        const otherLang = this.currentLang === 'en' ? 'hi' : 'en';
        if (this.masteryScores[uid][otherLang] === 0) {
            successHtml += `<br><br><small>💡 Switch to ${otherLang === 'en' ? 'English' : 'Hindi'} to claim your remaining 10 Mastery Points for this unit!</small>`;
        }

        this.showFeedback(successHtml, 'success');
        this.el.btnSubmit.disabled = true;
        this.el.btnHint.disabled = true;
    }

    showFeedback(message, type) {
        this.el.feedback.innerHTML = message;
        this.el.feedback.className = `feedback-banner ${type}`;
        this.el.feedback.style.display = 'block';
    }

    shuffleArray(array) {
        let newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.conceptApp = new ConceptBuilder();
});
