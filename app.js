function setupQuizFromData(data) {
    AppState.units = data.learning_units || [];
    AppState.currentUnitIndex = 0;
    AppState.score = 0;
    AppState.timerSeconds = 0;
    AppState.unitProgress = {};

    if (!AppState.units.length) {
        alert('This module does not contain any valid learning units.');
        return;
    }

    const masteryPerUnit = data.metadata?.scoring_model?.dual_language_mastery_max || 20;
    AppState.maxScore = AppState.units.length * masteryPerUnit;
    AppState.chapterTitleString = data.metadata?.chapter_title?.en || 'Learning Module';

    AppState.units.forEach(function(_, idx) {
        AppState.unitProgress[idx] = {
            attempted: false,
            enSolved: false,
            hiSolved: false,
            marks: 0
        };
    });

    if (DOM.chapterTitle) {
        DOM.chapterTitle.innerText = data.metadata?.chapter_title?.[AppState.currentLang] || data.metadata?.chapter_title?.en || 'Learning Module';
    }
    if (DOM.displayStudentName) DOM.displayStudentName.innerText = '👤 ' + AppState.studentName;
    if (DOM.displaySchoolInfo) DOM.displaySchoolInfo.innerText = AppState.selectedClass + ' • ' + AppState.selectedSubject;
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
    AppState.units.forEach(function(_, idx) {
        AppState.unitProgress[idx] = {
            attempted: false,
            enSolved: false,
            hiSolved: false,
            marks: 0
        };
    });
    if (DOM.masteryScore) DOM.masteryScore.innerText = 0;
    startTimer();
    renderUnitGrid();
    switchScreen('quiz');
    renderCurrentUnit();
}

function startTimer() {
    clearInterval(AppState.timerInterval);
    AppState.timerInterval = setInterval(function() {
        AppState.timerSeconds++;
        const mins = String(Math.floor(AppState.timerSeconds / 60)).padStart(2, '0');
        const secs = String(AppState.timerSeconds % 60).padStart(2, '0');
        if (DOM.timer) DOM.timer.innerText = mins + ':' + secs;
    }, 1000);
}

function stopTimer() {
    clearInterval(AppState.timerInterval);
}

function renderUnitGrid() {
    if (!DOM.unitGrid) return;
    DOM.unitGrid.innerHTML = '';

    AppState.units.forEach(function(_, idx) {
        const div = document.createElement('div');
        div.className = 'question-number';
        div.dataset.index = idx;

        div.innerHTML = '<div class="q-number">' + (idx + 1) + '</div><div class="marks" id="marks-' + idx + '">0</div>';

        div.addEventListener('click', function() {
            AppState.currentUnitIndex = idx;
            renderCurrentUnit();
        });

        DOM.unitGrid.appendChild(div);
    });
}

function updateUnitGridStatus() {
    AppState.units.forEach(function(_, idx) {
        const node = document.querySelector('.question-number[data-index="' + idx + '"]');
        const marksEl = document.getElementById('marks-' + idx);
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
            marksEl.innerText = p.marks > 0 ? '+' + p.marks : '0';
        }
    });

    updateLanguageButtonsStatus();
}

function updateLanguageButtonsStatus() {
    const p = AppState.unitProgress[AppState.currentUnitIndex];
    if (!p) return;

    if (DOM.btnEn) {
        DOM.btnEn.innerText = p.enSolved ? 'English ✅ [10 pts]' : 'English [10 pts]';
    }
    if (DOM.btnHi) {
        DOM.btnHi.innerText = p.hiSolved ? 'हिंदी ✅ [10 pts]' : 'हिंदी [10 pts]';
    }
}


function formatMarkup(str) {
    if (!str) return '';
    let sanitized = String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return sanitized.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
}

function applyKaTeX() {
    if (typeof renderMathInElement === 'function') {
        const containers = [DOM.lessonTheory, DOM.challengePrompt, DOM.targetZone, DOM.fragmentBank, DOM.feedbackBanner, DOM.mediaCaption];
        containers.forEach(function(el) {
            if (el) {
                renderMathInElement(el, {
                    delimiters: [
                        { left: '\\[', right: '\\]', display: true },
                        { left: '\\(', right: '\\)', display: false }
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
        if (DOM.btnEn) DOM.btnEn.classList.add('active');
        if (DOM.btnHi) DOM.btnHi.classList.remove('active');
    } else {
        if (DOM.btnHi) DOM.btnHi.classList.add('active');
        if (DOM.btnEn) DOM.btnEn.classList.remove('active');
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

let activeDraggedItem = null;

function buildFragmentPool(challenge, isLocked) {
    AppState.assembly = [];
    if (!DOM.targetZone || !DOM.fragmentBank) return;

    DOM.targetZone.innerHTML = '';
    DOM.fragmentBank.innerHTML = '';

    if (isLocked) {
        challenge.target_sequence.forEach(function(frag) {
            const chip = document.createElement('div');
            chip.className = 'fragment-chip';
            chip.dataset.id = frag.id;
            chip.innerHTML = formatMarkup(frag.text);
            chip.fragRef = frag;
            DOM.targetZone.appendChild(chip);
        });
        renderTargetZoneSlots(challenge.target_sequence.length);
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

    fragments.forEach(function(frag) {
        const chip = document.createElement('div');
        chip.className = 'fragment-chip';
        chip.dataset.id = frag.id;
        chip.innerHTML = formatMarkup(frag.text);
        chip.fragRef = frag;

        chip.addEventListener('click', function() { toggleChipPlacement(chip, challenge.target_sequence.length); });
        chip.draggable = true;
        chip.addEventListener('dragstart', handleDragStart);
        chip.addEventListener('dragend', handleDragEnd);

        DOM.fragmentBank.appendChild(chip);
    });

    renderTargetZoneSlots(challenge.target_sequence.length);
    DOM.targetZone.addEventListener('dragover', handleDragOverZone);
}

function renderTargetZoneSlots(targetCount) {
    if (!DOM.targetZone) return;

    const existingSlots = DOM.targetZone.querySelectorAll('.slot-placeholder');
    existingSlots.forEach(function(s) { s.remove(); });

    const placedChips = DOM.targetZone.querySelectorAll('.fragment-chip');
    const remainingSlots = targetCount - placedChips.length;

    for (let i = 0; i < remainingSlots; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot-placeholder';
        slot.style.cssText = 'border: 1.5px dashed #93c5fd; border-radius: 8px; padding: 8px 14px; font-size: 13px; color: #93c5fd; font-weight: 600; background: #f0f7ff; user-select: none; display: inline-flex; align-items: center;';
        slot.innerText = '[ Slot ' + (placedChips.length + i + 1) + ' ]';
        DOM.targetZone.appendChild(slot);
    }
}

function toggleChipPlacement(chip, targetCount) {
    if (DOM.targetZone.classList.contains('success-locked')) return;

    AppState.unitProgress[AppState.currentUnitIndex].attempted = true;
    updateUnitGridStatus();

    if (chip.parentElement === DOM.fragmentBank) {
        DOM.targetZone.appendChild(chip);
    } else {
        DOM.fragmentBank.appendChild(chip);
    }
    syncAssemblyFromDOM(targetCount);
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
    const unit = AppState.units[AppState.currentUnitIndex];
    const challenge = unit.challenges[AppState.currentLang] || unit.challenges.en;
    syncAssemblyFromDOM(challenge.target_sequence.length);
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
    return elements.reduce(function(closest, child) {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        if (y > box.top && y < box.bottom && offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function syncAssemblyFromDOM(targetCount) {
    const chips = DOM.targetZone.querySelectorAll('.fragment-chip');
    AppState.assembly = Array.from(chips).map(function(c) { return c.fragRef; });

    if (DOM.btnSubmit) {
        DOM.btnSubmit.disabled = (AppState.assembly.length === 0);
    }

    renderTargetZoneSlots(targetCount || AppState.assembly.length);
}

function verifyAssembly() {
    const unit = AppState.units[AppState.currentUnitIndex];
    const lang = AppState.currentLang;
    const challenge = unit.challenges[lang] || unit.challenges.en;
    const targetSeq = challenge.target_sequence;
    const p = AppState.unitProgress[AppState.currentUnitIndex];

    p.attempted = true;

    const distractorHit = AppState.assembly.find(function(f) { return f.category === 'logical' || f.category === 'grammatical'; });
    if (distractorHit) {
        renderFeedback('❌ ' + formatMarkup(distractorHit.penalty_explanation), '#ef4444', '#fef2f2');
        updateUnitGridStatus();
        saveSessionProgress();
        return;
    }

    if (AppState.assembly.length < targetSeq.length) {
        const nextTarget = targetSeq[AppState.assembly.length];
        const hintMsg = nextTarget.role_hint?.[lang] || nextTarget.role_hint?.en || nextTarget.role_hint;
        renderFeedback('💡 <strong>Next Step Hint:</strong> ' + formatMarkup(hintMsg), '#0284c7', '#f0f9ff');
        updateUnitGridStatus();
        saveSessionProgress();
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
        const takeaway = unit.key_takeaway?.[lang] || unit.key_takeaway?.en || 'Great work!';
        renderFeedback('✅ <strong>Mastered!</strong><br><br>' + formatMarkup(takeaway), '#15803d', '#f0fdf4');

        DOM.targetZone.classList.add('success-locked');
        DOM.btnSubmit.disabled = true;
        if (DOM.nextBtn) DOM.nextBtn.disabled = false;

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
        saveSessionProgress();
    } else {
        renderFeedback('❌ Incorrect arrangement. Reorder the fragments and verify again.', '#ef4444', '#fef2f2');
        updateUnitGridStatus();
        saveSessionProgress();
    }
}

function handleShowHint() {
    const unit = AppState.units[AppState.currentUnitIndex];
    const challenge = unit.challenges[AppState.currentLang] || unit.challenges.en;
    renderFeedback('💡 <strong>Hint:</strong> ' + formatMarkup(challenge.hint), '#0284c7', '#f0f9ff');
}

function renderFeedback(html, color, bg) {
    if (!DOM.feedbackBanner) return;
    DOM.feedbackBanner.innerHTML = html;
    DOM.feedbackBanner.style.cssText = 'display:block; padding:12px 16px; margin-top:12px; border-radius:8px; border:1px solid ' + color + '; background:' + bg + '; color:' + color + '; font-size:14px;';
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


function finishModule() {
    stopTimer();
    switchScreen('results');

    const totalPossible = AppState.maxScore;
    const percentage = totalPossible > 0 ? Math.round((AppState.score / totalPossible) * 100) : 0;
    const mins = String(Math.floor(AppState.timerSeconds / 60)).padStart(2, '0');
    const secs = String(AppState.timerSeconds % 60).padStart(2, '0');
    const timeFormatted = mins + ':' + secs;

    if (DOM.finalScore) DOM.finalScore.innerText = AppState.score;
    if (DOM.totalPossible) DOM.totalPossible.innerText = totalPossible;
    if (DOM.percentage) DOM.percentage.innerText = percentage + '%';
    if (DOM.totalTime) DOM.totalTime.innerText = timeFormatted;

    const scorePayload = {
        action: 'submit',
        studentName: AppState.studentName,
        schoolName: AppState.schoolName,
        class: AppState.selectedClass,
        subject: AppState.selectedSubject,
        lesson: AppState.chapterTitleString,
        mode: 'LEARNING',
        score: AppState.score + '/' + totalPossible,
        timeTaken: "'" + timeFormatted
    };

    transmitScore(scorePayload);
    localStorage.removeItem('learnApp_activeSession');
}

async function transmitScore(payload) {
    try {
        await fetch(AppConfig.gasEndpoint, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.warn('Server unreachable. Storing score in local queue.', err);
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
        } catch (e) {
            unSynced.push(item);
        }
    }
    localStorage.setItem('learnApp_offlineQueue', JSON.stringify(unSynced));
}

async function fetchScoreboard() {
    if (!DOM.scoreboardBody) return;
    DOM.scoreboardBody.innerHTML = '<tr><td colspan="9" style="padding:40px; text-align:center;">Syncing...</td></tr>';

    try {
        const r = await fetch(AppConfig.gasEndpoint + '?action=get&t=' + Date.now());
        AppState.scoreboardData = await r.json();
        sortScoreboard('date');
    } catch (e) {
        console.error('Scoreboard fetch error:', e);
        DOM.scoreboardBody.innerHTML = '<tr><td colspan="9" style="color:#ef4444; padding:40px; text-align:center;">Server Error.</td></tr>';
    }
}

function cleanEfficiency(s) {
    let raw = String(s || '').replace('⏱️', '').replace("'", '').trim();
    if (raw.includes('T')) raw = raw.split('T')[0];
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
    headers.forEach(function(th) { th.classList.remove('sort-asc', 'sort-desc'); });
    const active = document.querySelector('#leaderboardHeaders th[data-sort="' + key + '"]');
    if (active) active.classList.add(AppState.sortConfig.asc ? 'sort-asc' : 'sort-desc');

    const data = [...AppState.scoreboardData];
    data.sort(function(a, b) {
        let vA, vB;
        switch (key) {
            case 'rank':
            case 'score':
                vA = parseFloat(String(a[7] || '').split('/')[0]) || 0;
                vB = parseFloat(String(b[7] || '').split('/')[0]) || 0;
                break;
            case 'date':
                vA = new Date(a[0] || 0).getTime();
                vB = new Date(b[0] || 0).getTime();
                break;
            case 'student': vA = String(a[1] || '').toLowerCase(); vB = String(b[1] || '').toLowerCase(); break;
            case 'class': vA = String(a[3] || '').toLowerCase(); vB = String(b[3] || '').toLowerCase(); break;
            case 'subject': vA = String(a[4] || '').toLowerCase(); vB = String(b[4] || '').toLowerCase(); break;
            case 'chapter': vA = String(a[5] || '').toLowerCase(); vB = String(b[5] || '').toLowerCase(); break;
            case 'mode': vA = String(a[6] || '').toLowerCase(); vB = String(b[6] || '').toLowerCase(); break;
            case 'efficiency':
                const toSecs = function(s) {
                    const clean = cleanEfficiency(s);
                    const p = clean.split(':').map(Number);
                    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : (p.length === 2 ? p[0] * 60 + p[1] : parseFloat(clean) || 0);
                };
                vA = toSecs(a[8]); vB = toSecs(b[8]); break;
            default: vA = 0; vB = 0;
        }
        if (vA < vB) return AppState.sortConfig.asc ? -1 : 1;
        if (vA > vB) return AppState.sortConfig.asc ? 1 : -1;
        return 0;
    });

    DOM.scoreboardBody.innerHTML = data.slice(0, 50).map(function(r, i) {
        return '<tr>' +
            '<td style="padding:15px; font-weight:bold;">' + (i + 1) + '</td>' +
            '<td style="padding:15px; font-size:11px;">' + (r[0] ? new Date(r[0]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-') + '</td>' +
            '<td style="padding:15px;"><strong>' + (r[1] || '-') + '</strong><br><small style="color:#64748b;">' + (r[2] || '-') + '</small></td>' +
            '<td style="padding:15px; font-size:12px;">' + (r[3] || '-') + '</td>' +
            '<td style="padding:15px; font-size:12px;">' + (r[4] || '-') + '</td>' +
            '<td style="padding:15px; font-size:12px;">' + (r[5] || '-') + '</td>' +
            '<td style="padding:15px;"><span style="background:#eff6ff; color:#1d4ed8; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:600;">' + (r[6] || 'LEARNING') + '</span></td>' +
            '<td style="padding:15px; font-weight:800; color:#2563eb;">' + (r[7] || '0') + '</td>' +
            '<td style="padding:15px; font-size:12px;">⏱️ ' + cleanEfficiency(r[8]) + '</td>' +
        '</tr>';
    }).join('');
}


