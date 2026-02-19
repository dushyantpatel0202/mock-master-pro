// Question Data - loaded from questions.json
let questions = [];
let totalQuestions = 0;

// State Management
let currentQuestion = 0;
let answers = [];
let markedForReview = [];
let visited = [];
let timeRemaining = 7200; // 120 minutes in seconds
let timerInterval;
let startTime;
let testSubmitted = false;

// Per-question timer state
let questionTimers = [];
let currentQuestionStartTime = null;
let questionTimerInterval = null;

// DOM Elements
const startScreen = document.getElementById('start-screen');
const testScreen = document.getElementById('test-screen');
const resultScreen = document.getElementById('result-screen');
const questionContainer = document.getElementById('question-container');
const optionsContainer = document.getElementById('options-container');
const questionPalette = document.getElementById('question-palette');
const timerDisplay = document.getElementById('timer-display');
const mobileTimer = document.getElementById('mobile-timer');
const currentQNum = document.getElementById('current-q-num');
const questionText = document.getElementById('question-text');
const subjectTag = document.getElementById('subject-tag');
const markReviewBtn = document.getElementById('mark-review-btn');
const reviewIcon = document.getElementById('review-icon');
const reviewText = document.getElementById('review-text');
const prevBtn = document.getElementById('prev-btn');
const answeredCount = document.getElementById('answered-count');
const submitModal = document.getElementById('submit-modal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadQuestions().then(() => {
        checkPreviousSession();
        lucide.createIcons();
    });
});

function initQuestionState() {
    answers = new Array(totalQuestions).fill(null);
    markedForReview = new Array(totalQuestions).fill(false);
    visited = new Array(totalQuestions).fill(false);
    questionTimers = new Array(totalQuestions).fill(0);
}

async function loadQuestions() {
    const sources = [
        'http://localhost:3000/api/questions',
        'mock-backend/questions.json',
        'questions.json'
    ];

    try {
        let data = null;

        for (const source of sources) {
            try {
                const response = await fetch(source);
                if (!response.ok) continue;

                const parsed = await response.json();
                if (Array.isArray(parsed) && parsed.length > 0) {
                    data = parsed;
                    break;
                }
            } catch (sourceError) {
                console.warn(`Question source failed: ${source}`, sourceError);
            }
        }

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('No valid questions source available');
        }

        questions = data;
        totalQuestions = questions.length;
        initQuestionState();
    } catch (err) {
        console.error('Failed to load questions:', err);
        alert('Failed to load questions. Please refresh the page.');
    }
}

function checkPreviousSession() {
    const saved = localStorage.getItem('mockTestSession');
    if (saved) {
        document.getElementById('resume-btn').classList.remove('hidden');
    }
}

function loadPreviousSession() {
    const saved = localStorage.getItem('mockTestSession');
    if (saved) {
        const data = JSON.parse(saved);
        if (confirm('Resume from where you left off?')) {
            currentQuestion = data.currentQuestion || 0;
            if (currentQuestion >= totalQuestions) currentQuestion = 0;
            answers = Array.isArray(data.answers) && data.answers.length === totalQuestions
                ? data.answers
                : new Array(totalQuestions).fill(null);
            markedForReview = Array.isArray(data.markedForReview) && data.markedForReview.length === totalQuestions
                ? data.markedForReview
                : new Array(totalQuestions).fill(false);
            visited = Array.isArray(data.visited) && data.visited.length === totalQuestions
                ? data.visited
                : new Array(totalQuestions).fill(false);
            timeRemaining = typeof data.timeRemaining === 'number' ? data.timeRemaining : 7200;
            questionTimers = Array.isArray(data.questionTimers) && data.questionTimers.length === totalQuestions
                ? data.questionTimers
                : new Array(totalQuestions).fill(0);
            currentQuestionStartTime = data.currentQuestionStartTime || null;
            startTest(true);
        }
    }
}

function startTest(resuming = false) {
    if (!totalQuestions) {
        alert('Questions are still loading. Please try again.');
        return;
    }
    // Reset state if starting fresh
    if (!resuming) {
        currentQuestion = 0;
        initQuestionState();
        if (visited.length > 0) visited[0] = true;
        timeRemaining = 7200;
        testSubmitted = false;
    }
    
    // Hide/Show screens
    startScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    testScreen.classList.remove('hidden');
    startTime = Date.now();
    
    // Render initial state
    renderQuestion();
    renderPalette();
    startTimer();
    updateStats();
    
    // Auto-save every 30 seconds (only set up once)
    if (!window.autoSaveInterval) {
        window.autoSaveInterval = setInterval(saveSession, 30000);
    }
    
    // Prevent accidental navigation
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);
}

function handleBeforeUnload(e) {
    if (!testSubmitted) {
        e.preventDefault();
        e.returnValue = '';
    }
}

function renderQuestion() {
    // Safety check
    if (currentQuestion < 0 || currentQuestion >= totalQuestions) {
        currentQuestion = 0;
    }
    
    const q = questions[currentQuestion];
    
    // Ensure q exists
    if (!q) {
        console.error('Question not found at index:', currentQuestion);
        return;
    }
    
    currentQNum.textContent = currentQuestion + 1;
    questionText.textContent = q.question || 'Question not available';
    subjectTag.textContent = q.subject || 'General';
    
    // Render options
    optionsContainer.innerHTML = '';
    q.options.forEach((opt, idx) => {
        const isSelected = answers[currentQuestion] === idx;
        const btn = document.createElement('button');
        btn.className = `option-card w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
            isSelected 
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
        }`;
        btn.onclick = () => selectOption(idx);
        btn.innerHTML = `
            <div class="w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 text-gray-500'
            }">
                ${isSelected ? '<i data-lucide="check" class="w-4 h-4"></i>' : String.fromCharCode(65 + idx)}
            </div>
            <span class="font-medium">${opt}</span>
        `;
        optionsContainer.appendChild(btn);
    });
    
    // Update review button state
    updateReviewButton();
    
    // Update prev button state
    prevBtn.disabled = currentQuestion === 0;
    
    visited[currentQuestion] = true;
    renderPalette();
    lucide.createIcons();

    // Start per-question timer
    startQuestionTimer();
}

function selectOption(index) {
    answers[currentQuestion] = index;
    renderQuestion();
    updateStats();
}

function toggleMarkReview() {
    markedForReview[currentQuestion] = !markedForReview[currentQuestion];
    updateReviewButton();
    renderPalette();
}

function updateReviewButton() {
    const isMarked = markedForReview[currentQuestion];
    if (isMarked) {
        reviewIcon.classList.add('fill-orange-500', 'text-orange-500');
        reviewText.textContent = 'Unmark Review';
        reviewText.classList.add('text-orange-500');
    } else {
        reviewIcon.classList.remove('fill-orange-500', 'text-orange-500');
        reviewText.textContent = 'Mark for Review';
        reviewText.classList.remove('text-orange-500');
    }
}

function previousQuestion() {
    if (currentQuestion > 0) {
        pauseCurrentQuestionTimer();
        currentQuestion--;
        renderQuestion();
    }
}

function saveAndNext() {
    if (currentQuestion < totalQuestions - 1) {
        pauseCurrentQuestionTimer();
        currentQuestion++;
        renderQuestion();
    } else {
        submitTest();
    }
}

function clearResponse() {
    answers[currentQuestion] = null;
    renderQuestion();
    updateStats();
}

function jumpToQuestion(index) {
    pauseCurrentQuestionTimer();
    currentQuestion = index;
    renderQuestion();
}

function renderPalette() {
    questionPalette.innerHTML = '';
    for (let i = 0; i < totalQuestions; i++) {
        const btn = document.createElement('button');
        btn.className = `question-palette-btn w-full aspect-square rounded-lg text-sm font-semibold relative ${
            i === currentQuestion ? 'ring-2 ring-indigo-600 ring-offset-2' : ''
        } ${
            answers[i] !== null && markedForReview[i] ? 'bg-purple-500 text-white' :
            answers[i] !== null ? 'bg-green-500 text-white' :
            markedForReview[i] ? 'bg-orange-400 text-white' :
            visited[i] ? 'bg-red-100 border-2 border-red-500 text-red-700' :
            'bg-gray-200 text-gray-600'
        }`;
        btn.textContent = i + 1;
        btn.onclick = () => jumpToQuestion(i);
        questionPalette.appendChild(btn);
    }
}

function updateStats() {
    const answered = answers.filter(a => a !== null).length;
    if (answeredCount) answeredCount.textContent = `${answered}/${totalQuestions}`;
}

function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        saveSession();
        
        if (timeRemaining <= 300) { // Last 5 minutes
            document.getElementById('header-timer').classList.add('timer-warning', 'text-red-600');
        }
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            confirmSubmit();
        }
    }, 1000);
}

function updateTimerDisplay() {
    // Ensure timeRemaining is a number
    if (typeof timeRemaining !== 'number' || isNaN(timeRemaining)) {
        timeRemaining = 7200;
    }
    
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    const seconds = timeRemaining % 60;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    if (timerDisplay) timerDisplay.textContent = timeStr;
    if (mobileTimer) mobileTimer.textContent = timeStr;
}

function formatQuestionTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function startQuestionTimer() {
    // If already timing this question, don't reset
    if (currentQuestionStartTime !== null) return;
    currentQuestionStartTime = Date.now();
    if (questionTimerInterval) clearInterval(questionTimerInterval);
    questionTimerInterval = setInterval(updateQuestionTimerDisplay, 1000);
    updateQuestionTimerDisplay();
}

function pauseCurrentQuestionTimer() {
    if (currentQuestionStartTime !== null) {
        const elapsed = Math.floor((Date.now() - currentQuestionStartTime) / 1000);
        questionTimers[currentQuestion] = (questionTimers[currentQuestion] || 0) + elapsed;
        currentQuestionStartTime = null;
    }
    if (questionTimerInterval) {
        clearInterval(questionTimerInterval);
        questionTimerInterval = null;
    }
}

function updateQuestionTimerDisplay() {
    if (currentQuestionStartTime === null) return;
    const elapsed = Math.floor((Date.now() - currentQuestionStartTime) / 1000);
    const total = (questionTimers[currentQuestion] || 0) + elapsed;
    const display = document.getElementById('question-timer-display');
    if (display) display.textContent = formatQuestionTime(total);
}

function saveSession() {
    const sessionData = {
        currentQuestion,
        answers,
        markedForReview,
        visited,
        timeRemaining,
        questionTimers,
        currentQuestionStartTime,
        timestamp: Date.now()
    };
    localStorage.setItem('mockTestSession', JSON.stringify(sessionData));
}

function submitTest() {
    const answered = answers.filter(a => a !== null).length;
    const marked = markedForReview.filter(m => m).length;
    const unanswered = totalQuestions - answered;
    
    document.getElementById('submit-answered').textContent = answered;
    document.getElementById('submit-marked').textContent = marked;
    document.getElementById('submit-unanswered').textContent = unanswered;
    document.getElementById('submit-timer').textContent = timerDisplay.textContent;
    
    submitModal.classList.remove('hidden');
}

function closeSubmitModal() {
    submitModal.classList.add('hidden');
}

function confirmSubmit() {
    clearInterval(timerInterval);
    pauseCurrentQuestionTimer();
    testSubmitted = true;
    // Calculate final stats before clearing session
    let correct = answers.filter((a, idx) => a === questions[idx].correct).length;
    let wrong = answers.filter((a, idx) => a !== null && a !== questions[idx].correct).length;
    const percentage = totalQuestions ? Math.round((correct / totalQuestions) * 100) : 0;
    const timeTaken = document.getElementById('timer-display').textContent; // Using global timer

    // Prepare data for MongoDB
    const resultData = {
        score: correct,
        correct: correct,
        wrong: wrong,
        totalQuestions: totalQuestions,
        percentage: percentage + '%',
        timeTaken: timeTaken
    };

    // Send result to Backend
    fetch('http://localhost:3000/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultData)
    })
    .then(response => response.json())
    .then(data => console.log(data.message))
    .catch(err => console.error('Error saving result:', err));
    localStorage.removeItem('mockTestSession');
    submitModal.classList.add('hidden');
    testScreen.classList.add('hidden');
    showResults();
}

function showResults() {
    resultScreen.classList.remove('hidden');
    
    let correct = 0;
    let wrong = 0;
    const subjectStats = {};
    
    questions.forEach((q, idx) => {
        if (!subjectStats[q.subject]) {
            subjectStats[q.subject] = { total: 0, correct: 0 };
        }
        subjectStats[q.subject].total++;
        
        if (answers[idx] === q.correct) {
            correct++;
            subjectStats[q.subject].correct++;
        } else if (answers[idx] !== null) {
            wrong++;
        }
    });
    
    const percentage = totalQuestions ? Math.round((correct / totalQuestions) * 100) : 0;
    const timeTaken = 7200 - timeRemaining;
    
    // Update result cards
    document.getElementById('result-score').textContent = correct;
    document.getElementById('result-correct').textContent = correct;
    document.getElementById('result-wrong').textContent = wrong;
    document.getElementById('result-percentage').textContent = percentage + '%';
    
    // Time stats
    const hours = Math.floor(timeTaken / 3600);
    const minutes = Math.floor((timeTaken % 3600) / 60);
    const seconds = timeTaken % 60;
    document.getElementById('result-time-taken').textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('result-total-time').textContent = '02:00:00';
    document.getElementById('result-avg-time').textContent = totalQuestions ? Math.round(timeTaken / totalQuestions) + 's' : '0s';

    // Per-question time stats
    const answeredTimers = questionTimers.filter((t, idx) => answers[idx] !== null);
    if (answeredTimers.length > 0) {
        const maxTime = Math.max(...answeredTimers);
        const minTime = Math.min(...answeredTimers);
        const avgTime = Math.round(answeredTimers.reduce((a, b) => a + b, 0) / answeredTimers.length);
        document.getElementById('result-fastest-q').textContent = formatQuestionTime(minTime);
        document.getElementById('result-slowest-q').textContent = formatQuestionTime(maxTime);
        document.getElementById('result-avg-q-time').textContent = formatQuestionTime(avgTime);
    } else {
        document.getElementById('result-fastest-q').textContent = '--:--';
        document.getElementById('result-slowest-q').textContent = '--:--';
        document.getElementById('result-avg-q-time').textContent = '--:--';
    }
    
    // Subject breakdown
    const breakdownContainer = document.getElementById('subject-breakdown');
    breakdownContainer.innerHTML = '';
    
    Object.entries(subjectStats).forEach(([subject, stats]) => {
        const subjectPercentage = Math.round((stats.correct / stats.total) * 100);
        let colorClass = 'bg-red-500';
        if (subjectPercentage >= 80) colorClass = 'bg-green-500';
        else if (subjectPercentage >= 60) colorClass = 'bg-blue-500';
        else if (subjectPercentage >= 40) colorClass = 'bg-yellow-500';
        
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg';
        div.innerHTML = `
            <div class="flex-1">
                <div class="flex justify-between mb-2">
                    <span class="font-medium text-gray-900">${subject}</span>
                    <span class="font-semibold text-gray-700">${stats.correct}/${stats.total} (${subjectPercentage}%)</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="${colorClass} h-2 rounded-full transition-all" style="width: ${subjectPercentage}%"></div>
                </div>
            </div>
        `;
        breakdownContainer.appendChild(div);
    });
    
    // Scroll to top
    window.scrollTo(0, 0);
}

function reviewAnswers() {
    const reviewSection = document.getElementById('review-section');
    const reviewContainer = document.getElementById('review-questions');
    
    reviewSection.classList.remove('hidden');
    reviewContainer.innerHTML = '';
    
    questions.forEach((q, idx) => {
        const userAnswer = answers[idx];
        const isCorrect = userAnswer === q.correct;
        const isUnattempted = userAnswer === null;
        
        const card = document.createElement('div');
        card.className = `p-6 rounded-xl border-2 ${
            isCorrect ? 'border-green-200 bg-green-50' : 
            isUnattempted ? 'border-gray-200 bg-gray-50' : 
            'border-red-200 bg-red-50'
        }`;
        
        let statusBadge = '';
        if (isCorrect) {
            statusBadge = '<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">Correct</span>';
        } else if (isUnattempted) {
            statusBadge = '<span class="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">Unattempted</span>';
        } else {
            statusBadge = '<span class="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">Incorrect</span>';
        }
        
        card.innerHTML = `
            <div class="flex items-start justify-between mb-4">
                <div>
                    <span class="text-sm text-gray-500 mb-1 block">Question ${idx + 1} • ${q.subject} • <span class="text-blue-600">Time: ${formatQuestionTime(questionTimers[idx] || 0)}</span></span>
                    <h4 class="font-medium text-gray-900">${q.question}</h4>
                </div>
                ${statusBadge}
            </div>
            <div class="space-y-2">
                ${q.options.map((opt, optIdx) => {
                    let classes = 'p-3 rounded-lg text-sm flex items-center gap-2 ';
                    if (optIdx === q.correct) {
                        classes += 'bg-green-100 text-green-800 font-medium';
                    } else if (optIdx === userAnswer && !isCorrect) {
                        classes += 'bg-red-100 text-red-800';
                    } else {
                        classes += 'bg-white border border-gray-200 text-gray-600';
                    }
                    
                    let icon = '';
                    if (optIdx === q.correct) {
                        icon = '<i data-lucide="check-circle" class="w-4 h-4 text-green-600"></i>';
                    } else if (optIdx === userAnswer && !isCorrect) {
                        icon = '<i data-lucide="x-circle" class="w-4 h-4 text-red-600"></i>';
                    } else {
                        icon = '<span class="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center text-xs">' + String.fromCharCode(65 + optIdx) + '</span>';
                    }
                    
                    return `<div class="${classes}">${icon} ${opt}</div>`;
                }).join('')}
            </div>
        `;
        
        reviewContainer.appendChild(card);
    });
    
    lucide.createIcons();
    reviewSection.scrollIntoView({ behavior: 'smooth' });
}

function restartTest() {
    if (confirm('Are you sure you want to restart? All progress will be lost.')) {
        localStorage.removeItem('mockTestSession');
        location.reload();
    }
}

function downloadResult() {
    const correct = answers.filter((a, idx) => a === questions[idx].correct).length;
    const wrong = answers.filter((a, idx) => a !== null && a !== questions[idx].correct).length;
    const unattempted = answers.filter(a => a === null).length;
    const percentage = totalQuestions ? Math.round((correct / totalQuestions) * 100) : 0;
    
    const content = `
MOCK TEST RESULT
================

Date: ${new Date().toLocaleString()}
Score: ${correct}/${totalQuestions} (${percentage}%)
Correct Answers: ${correct}
Wrong Answers: ${wrong}
Unattempted: ${unattempted}

Time Taken: ${document.getElementById('result-time-taken').textContent}

Subject-wise Breakdown:
${Array.from(document.querySelectorAll('#subject-breakdown > div')).map(div => {
    const text = div.innerText.replace(/\n/g, ' ');
    return `- ${text}`;
}).join('\n')}
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MockTest_Result_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (!testScreen || testScreen.classList.contains('hidden')) return;
    
    if (e.key === 'ArrowLeft' && currentQuestion > 0) {
        e.preventDefault();
        previousQuestion();
    } else if (e.key === 'ArrowRight' && currentQuestion < totalQuestions - 1) {
        e.preventDefault();
        saveAndNext();
    } else if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        selectOption(parseInt(e.key) - 1);
    } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMarkReview();
    }
});