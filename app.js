class ConceptBuilder {
    constructor() {
        this.lessonData = null;
        this.currentUnitIndex = 0;
        this.currentLang = 'en';
        
        // State for current challenge
        this.bank = [];
        this.assembly = [];
        this.attempts = 0;
        this.hintUsed = false;
        
        // Mastery Tracking (Scores per unit per language)
        this.scores = {}; 

        this.initElements();
        this.bindEvents();
        this.loadLesson();
    }

    initElements() {
        // UI Elements
        this.el = {
            title: document.getElementById('lesson-title'),
            theory: document.getElementById('lesson-theory'),
            mediaContainer: document.getElementById('media-container'),
            mediaCaption: document.getElementById('media-caption'),
            prompt: document.getElementById('challenge-prompt'),
            targetZone: document.getElementById('target-zone'),
            fragmentBank: document.getElementById('fragment-bank'),
            btnEn: document.getElementById('btn-en'),
            btnHi: document.getElementById('btn-hi'),
            btnHint: document.getElementById('btn-hint'),
            btnSubmit: document.getElementById('btn-submit'),
            feedback: document.getElementById('feedback-banner'),
            mastery: document.getElementById('mastery-score')
        };
    }

    bindEvents() {
        this.el.btnEn.addEventListener('click', () => this.switchLanguage('en'));
        this.el.btnHi.addEventListener('click', () => this.switchLanguage('hi'));
        
        this.el.btnSubmit.addEventListener('click', () => this.checkAnswer());
        this.el.btnHint.addEventListener('click', () => this.giveHint());
    }

    async loadLesson() {
        try {
            // 1. Detect repo owner and repo name dynamically from GitHub Pages URL
            const hostname = window.location.hostname;
            const pathname = window.location.pathname.split('/').filter(Boolean);
            
            let targetJsonUrl = '';

            if (hostname.includes('github.io') && pathname.length > 0) {
                const owner = hostname.split('.')[0];
                const repo = pathname[0]; 
                const apiFolderUrl = `https://api.github.com/repos/${owner}/${repo}/contents/jsons/Class-11/Comp.Sc.`;

                // 2. Scan the directory via GitHub API
                const dirResponse = await fetch(apiFolderUrl);
                let files;
                
                if (!dirResponse.ok) {
                    // Fallback attempt without trailing dot if folder naming differs
                    const altApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/jsons/Class-11/Comp.Sc`;
                    const altRes = await fetch(altApiUrl);
                    if (!altRes.ok) throw new Error(`GitHub API directory scan failed: ${dirResponse.status}`);
                    files = await altRes.json();
                } else {
                    files = await dirResponse.json();
                }

                // 3. Find the first JSON file regardless of its exact filename
                const jsonFile = files.find(file => file.name.toLowerCase().endsWith('.json'));
                if (!jsonFile) throw new Error("No .json file found in jsons/Class-11/Comp.Sc./");

                targetJsonUrl = jsonFile.download_url; // Direct raw CDN link
            } else {
                // Local fallback (e.g., Live Server)
                targetJsonUrl = 'jsons/Class-11/Comp.Sc./fundamentals-of-computer.json';
            }

            // 4. Fetch the discovered JSON
            const response = await fetch(targetJsonUrl);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);

            this.lessonData = await response.json();
            this.renderUnit();
        } catch (error) {
            console.error("Auto-discovery failed:", error);
            this.el.title.innerText = `Error Loading Lesson File: ${error.message}. Check Console.`;
        }
    }

    renderUnit() {
        const unit = this.lessonData.learning_units[this.currentUnitIndex];
        
        // Reset states
        this.assembly = [];
        this.attempts = 0;
        this.hintUsed = false;
        this.el.feedback.style.display = 'none';
        
        // Render Instruction Card
        this.el.title.innerText = unit.instruction.title[this.currentLang];
        this.el.theory.innerText = unit.instruction.theory[this.currentLang];
        
        // Render Media (SVG)
        if (unit.instruction.media && unit.instruction.media.svg_code) {
            this.el.mediaContainer.style.display = 'block';
            this.el.mediaContainer.innerHTML = unit.instruction.media.svg_code;
            this.el.mediaCaption.innerText = unit.instruction.media.caption[this.currentLang];
        } else {
            this.el.mediaContainer.style.display = 'none';
            this.el.mediaCaption.innerText = '';
        }

        this.setupChallenge(unit);
    }

    setupChallenge(unit) {
        const challenge = unit.challenges[this.currentLang];
        this.el.prompt.innerText = challenge.prompt;

        // Combine targets and distractors, then shuffle
        let allFragments = [
            ...challenge.target_sequence.map(f => ({ ...f, isTarget: true })),
            ...challenge.distractors.map(f => ({ ...f, isTarget: false }))
        ];
        
        this.bank = this.shuffleArray(allFragments);
        this.assembly = [];
        
        this.renderFragments();
    }

    switchLanguage(lang) {
        if (this.currentLang === lang) return;
        this.currentLang = lang;
        
        this.el.btnEn.classList.toggle('active', lang === 'en');
        this.el.btnHi.classList.toggle('active', lang === 'hi');
        
        this.renderUnit();
    }

    renderFragments() {
        this.el.fragmentBank.innerHTML = '';
        this.el.targetZone.innerHTML = '';

        // Render Bank (Always lowercase)
        this.bank.forEach(frag => {
            const chip = document.createElement('div');
            chip.className = 'fragment-chip';
            chip.innerText = frag.text;
            chip.onclick = () => this.moveToAssembly(frag);
            this.el.fragmentBank.appendChild(chip);
        });

        // Render Assembly Line (Dynamic Capitalization for slot 0)
        this.assembly.forEach((frag, index) => {
            const chip = document.createElement('div');
            chip.className = 'fragment-chip';
            
            // Capitalize if it's the very first fragment
            let displayText = frag.text;
            if (index === 0) {
                displayText = displayText.charAt(0).toUpperCase() + displayText.slice(1);
            }
            
            chip.innerText = displayText;
            chip.onclick = () => this.moveToBank(frag);
            this.el.targetZone.appendChild(chip);
        });

        // Enable/Disable Submit Button
        this.el.btnSubmit.disabled = this.assembly.length === 0;
    }

    moveToAssembly(fragment) {
        this.bank = this.bank.filter(f => f.id !== fragment.id);
        this.assembly.push(fragment);
        this.renderFragments();
        this.el.feedback.style.display = 'none'; // Clear previous errors
    }

    moveToBank(fragment) {
        this.assembly = this.assembly.filter(f => f.id !== fragment.id);
        this.bank.push(fragment);
        this.renderFragments();
        this.el.feedback.style.display = 'none';
    }

    giveHint() {
        const unit = this.lessonData.learning_units[this.currentUnitIndex];
        this.hintUsed = true;
        this.showFeedback(unit.challenges[this.currentLang].hint, 'secondary');
    }

    checkAnswer() {
        this.attempts++;
        const unit = this.lessonData.learning_units[this.currentUnitIndex];
        const challenge = unit.challenges[this.currentLang];
        const targets = challenge.target_sequence;

        // 1. Check for Distractors
        const distractor = this.assembly.find(f => !f.isTarget);
        if (distractor) {
            this.showFeedback(`❌ ${distractor.penalty_explanation}`, 'error');
            return;
        }

        // 2. Check Length
        if (this.assembly.length !== targets.length) {
            this.showFeedback("❌ The sentence is incomplete or has missing clauses.", 'error');
            return;
        }

        // 3. Check Exact Order
        let isCorrect = true;
        for (let i = 0; i < targets.length; i++) {
            if (this.assembly[i].id !== targets[i].id) {
                isCorrect = false;
                break;
            }
        }

        if (isCorrect) {
            this.handleSuccess(unit);
        } else {
            this.showFeedback("❌ The logical order is incorrect. Check your clause connections.", 'error');
        }
    }

    handleSuccess(unit) {
        // Calculate Score
        let marks = 10;
        if (this.attempts > 1) marks -= 2;
        if (this.hintUsed) marks -= 2;
        marks = Math.max(2, marks); // Floor at 2 pts

        // Save Score
        const unitKey = unit.unit_id;
        if (!this.scores[unitKey]) this.scores[unitKey] = { en: 0, hi: 0 };
        
        // Only update if current attempt is better than previous
        if (marks > this.scores[unitKey][this.currentLang]) {
            this.scores[unitKey][this.currentLang] = marks;
        }

        this.updateMasteryDisplay();

        // Show Success & Key Takeaway
        let successHtml = `🎉 <strong>Correct! (+${marks} pts)</strong><br><br>`;
        successHtml += `<em>Takeaway:</em> ${unit.key_takeaway[this.currentLang]}`;
        
        // If they haven't done the other language yet
        const otherLang = this.currentLang === 'en' ? 'hi' : 'en';
        const otherScore = this.scores[unitKey][otherLang];
        if (otherScore === 0) {
            successHtml += `<br><br><small>💡 Switch to ${otherLang === 'en' ? 'English' : 'Hindi'} to claim your remaining 10 Mastery Points!</small>`;
        }

        this.showFeedback(successHtml, 'success');
        
        // Disable buttons on success
        this.el.btnSubmit.disabled = true;
        this.el.btnHint.disabled = true;
    }

    updateMasteryDisplay() {
        let total = 0;
        for (const unit in this.scores) {
            total += this.scores[unit].en + this.scores[unit].hi;
        }
        this.el.mastery.innerText = total;
    }

    showFeedback(message, type) {
        this.el.feedback.innerHTML = message;
        this.el.feedback.className = `feedback-banner ${type}`;
        this.el.feedback.style.display = 'block';
    }

    shuffleArray(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }
}

// Boot up the engine when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.conceptApp = new ConceptBuilder();
});
