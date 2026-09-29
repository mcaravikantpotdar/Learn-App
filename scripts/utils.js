class QuizUtils {
    /**
     * Toggles the global loading spinner.
     */
    static showLoading(show = true) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            if (show) spinner.classList.add('active');
            else spinner.classList.remove('active');
        }
    }

    /**
     * Manages screen transitions with a safety wipe of active classes.
     */
    static showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
            screen.style.display = 'none';
        });

        const target = document.getElementById(screenId);
        if (target) {
            target.style.display = 'block';
            setTimeout(() => target.classList.add('active'), 10);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    /**
     * Triggers a confetti celebration.
     */
    static createConfetti() {
        const colors = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#7c3aed'];
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.style.position = 'fixed';
            confetti.style.zIndex = '9999';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.top = '-10px';
            confetti.style.width = Math.random() * 10 + 5 + 'px';
            confetti.style.height = Math.random() * 10 + 5 + 'px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.borderRadius = '50%';
            document.body.appendChild(confetti);
            
            const animationDuration = Math.random() * 2 + 1.5;
            confetti.animate([
                { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
                { transform: `translate(${Math.random() * 200 - 100}px, 100vh) rotate(${Math.random() * 720}deg)`, opacity: 0 }
            ], { duration: animationDuration * 1000 });
            
            setTimeout(() => confetti.remove(), animationDuration * 1000);
        }
    }

    /**
     * HYBRID VALIDATOR: Supports numeric IDs and flexible option naming.
     */
    static validateQuizJSON(data) {
        const errors = [];
        if (!data || !data.metadata || !data.questions) {
            return { isValid: false, errors: ['Invalid JSON: Metadata or Questions missing.'] };
        }

        data.questions.forEach((q, i) => {
            const qNum = i + 1;
            // Allow string or number IDs
            if (q.question_id === undefined) errors.push(`Q${qNum} missing ID`);
            
            // Check for bilingual question text
            if (!q.question?.en || !q.question?.hi) {
                errors.push(`Q${qNum} missing bilingual question text`);
            }

            // Ensure at least two options exist regardless of their keys
            if (!q.options || typeof q.options !== 'object' || Object.keys(q.options).length < 2) {
                errors.push(`Q${qNum} must have at least 2 options`);
            }

            if (!q.correct_option) errors.push(`Q${qNum} missing correct_option`);
        });

        return { isValid: errors.length === 0, errors: errors };
    }
}
