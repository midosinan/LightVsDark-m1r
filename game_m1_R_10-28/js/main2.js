// =============================================================================
// شاشة الترحيب وتوجيه اللاعب: (تحدي ناس حقيقيين) أو (تحدي الكمبيوتر)
// هذا الملف هو "المفتاح" الوحيد بين الوضعين؛ كل وضع يعيش في ملفه المستقل (online.js / ai.js)
// ولا يعرف أحدهما الآخر.
// =============================================================================
(function () {
    'use strict';

    const NAME_KEY = 'faction-player-name';
    const welcomeScreen = document.querySelector('#welcome-screen');
    const nameInput = document.querySelector('#welcome-name-input');
    const nameError = document.querySelector('#welcome-error');
    const challengeHumans = document.querySelector('#challenge-humans');
    const challengeComputer = document.querySelector('#challenge-computer');
    const languageToggle = document.querySelector('#language-toggle');
    const backToWelcome = document.querySelector('#back-to-welcome');
    const headerSubtitle = document.querySelector('.header-subtitle');
    const pickDark = document.querySelector('#join-dark-team');
    const pickLight = document.querySelector('#join-light-team');
    const pickDarkTitle = document.querySelector('#join-dark-team-title');
    const pickLightTitle = document.querySelector('#join-light-team-title');
    const feedbackTrigger = document.querySelector('#feedback-trigger');
    const feedbackModal = document.querySelector('#feedback-modal');
    const feedbackNoteInput = document.querySelector('#feedback-note-input');
    const feedbackSubmitButton = document.querySelector('#feedback-submit');
    const feedbackCloseButton = document.querySelector('#feedback-close');
    const feedbackMessage = document.querySelector('#feedback-message');
    const developerModal = document.querySelector('#developer-secret-modal');
    const developerPasswordInput = document.querySelector('#developer-secret-password');
    const developerLoginButton = document.querySelector('#developer-secret-login');
    const developerCloseButton = document.querySelector('#developer-secret-close');
    const developerContent = document.querySelector('#developer-secret-content');
    const developerMessage = document.querySelector('#developer-secret-message');
    const developerFeedbackList = document.querySelector('#developer-feedback-list');
    const developerDeleteNotesButton = document.querySelector('#developer-delete-notes');

    let mode = null;   // null | 'online' | 'ai'
    let developerContextClickTimer = null;
    let developerContextClickCount = 0;
    let developerNotesOperation = 0;

    function syncOrientationPrompt() {
        const isPortrait = window.matchMedia('(orientation: portrait)').matches;
        const isSmallScreen = window.matchMedia('(max-width: 800px)').matches;

        document.body.classList.toggle('is-small-portrait', isSmallScreen && isPortrait);
    }

    function selectOnlineTeam(team) {
        if (mode !== 'online') return;

        App.selectedOnlineTeam = team;
        selectionScreen.querySelectorAll('.faction-card').forEach((card) => {
            const isSelected = card.classList.contains(team === 'light' ? 'dawn-faction' : 'shadow-faction');
            card.classList.toggle('is-selected', isSelected);
        });
        [pickLight, pickLightTitle].forEach((button) => button.setAttribute('aria-pressed', String(team === 'light')));
        [pickDark, pickDarkTitle].forEach((button) => button.setAttribute('aria-pressed', String(team === 'dark')));

        const lang = document.documentElement.getAttribute('lang') || 'en';
        headerSubtitle.textContent = translations[lang].welcome.onlineTeamSelected.replace(
            '{team}',
            translations[lang].selection[team === 'light' ? 'lightFaction' : 'darkFaction']
        );
    }

    function show(screen, visible) {
        screen.hidden = !visible;
        screen.classList.toggle('screen-hidden', !visible);
    }

    function feedbackText(key, fallback) {
        const lang = document.documentElement.getAttribute('lang') || 'en';
        return translations[lang]?.feedback?.[key] || fallback;
    }

    function syncFeedbackTriggerVisibility() {
        feedbackTrigger.hidden = battleScreen.hidden
            || battleScreen.classList.contains('screen-hidden');
    }

    async function readFeedbackResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            return { ok: false, error: null };
        }
        try {
            return await response.json();
        } catch (error) {
            return { ok: false, error: null };
        }
    }

    function feedbackApiError(response, payload, fallbackKey) {
        if (response.status === 404) {
            if (fallbackKey === 'deleteFailed') {
                return feedbackText(
                    'deleteEndpointNotFound',
                    'The delete feature is not available on the server yet. Deploy the latest server.js and refresh the game.'
                );
            }
            return feedbackText('apiNotFound', 'Feedback API not found on the configured game server.');
        }
        if (response.status === 503 && payload?.error) {
            return feedbackText('adminNotConfigured', 'Developer access is not configured on the server.');
        }
        if (response.status >= 500 && !payload?.error) {
            return feedbackText('backendUnavailable', 'Could not connect to the game server. Check the server connection and try again.');
        }
        if (response.status === 401) {
            return feedbackText('accessDenied', 'Access denied.');
        }
        return payload?.error || feedbackText(fallbackKey, 'The request failed. Please try again.');
    }

    async function postGameServer(path, body) {
        const serverUrl = String(window.GAME_SERVER_URL || '').trim().replace(/\/+$/, '');
        if (!serverUrl) {
            const error = new Error('The game server URL is not configured.');
            error.name = 'ServerNotConfiguredError';
            throw error;
        }
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 45000);
        try {
            return await fetch(`${serverUrl}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    function openFeedbackModal() {
        feedbackModal.classList.remove('screen-hidden');
        feedbackModal.setAttribute('aria-hidden', 'false');
        feedbackMessage.textContent = '';
        feedbackNoteInput.focus();
    }

    function closeFeedbackModal() {
        feedbackModal.classList.add('screen-hidden');
        feedbackModal.setAttribute('aria-hidden', 'true');
        feedbackNoteInput.value = '';
        feedbackMessage.textContent = '';
    }

    function openDeveloperModal() {
        developerNotesOperation += 1;
        developerLoginButton.disabled = false;
        developerLoginButton.removeAttribute('aria-busy');
        developerDeleteNotesButton.disabled = false;
        developerDeleteNotesButton.removeAttribute('aria-busy');
        developerModal.classList.remove('screen-hidden');
        developerModal.setAttribute('aria-hidden', 'false');
        developerPasswordInput.value = '';
        developerPasswordInput.focus();
        developerMessage.textContent = '';
        developerFeedbackList.replaceChildren();
        developerContent.hidden = true;
    }

    function closeDeveloperModal() {
        developerNotesOperation += 1;
        developerLoginButton.disabled = false;
        developerLoginButton.removeAttribute('aria-busy');
        developerDeleteNotesButton.disabled = false;
        developerDeleteNotesButton.removeAttribute('aria-busy');
        developerModal.classList.add('screen-hidden');
        developerModal.setAttribute('aria-hidden', 'true');
        developerPasswordInput.value = '';
        developerMessage.textContent = '';
        developerFeedbackList.replaceChildren();
        developerContent.hidden = true;
    }

    function handleDeveloperContextMenu(event) {
        event.preventDefault();
        developerContextClickCount += 1;
        if (developerContextClickTimer) {
            window.clearTimeout(developerContextClickTimer);
        }
        if (developerContextClickCount >= 2) {
            developerContextClickCount = 0;
            developerContextClickTimer = null;
            openDeveloperModal();
            return;
        }
        developerContextClickTimer = window.setTimeout(() => {
            developerContextClickCount = 0;
            developerContextClickTimer = null;
        }, 800);
    }

    function renderDeveloperNotes(notes) {
        developerFeedbackList.replaceChildren();
        if (notes.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = feedbackText('noNotes', 'No notes yet.');
            developerFeedbackList.append(emptyItem);
            return;
        }
        notes.forEach((item) => {
            const listItem = document.createElement('li');
            const note = document.createElement('span');
            note.textContent = String(item.message || '');
            const timestamp = document.createElement('small');
            timestamp.textContent = new Date(item.createdAt || Date.now()).toLocaleString();
            listItem.append(note, timestamp);
            developerFeedbackList.append(listItem);
        });
    }

    async function loadDeveloperNotes() {
        if (developerLoginButton.disabled) return;
        const operation = ++developerNotesOperation;
        const password = developerPasswordInput.value;
        if (!password.trim()) {
            developerMessage.textContent = feedbackText('passwordRequired', 'Password required.');
            developerPasswordInput.focus();
            return;
        }
        developerLoginButton.disabled = true;
        developerLoginButton.setAttribute('aria-busy', 'true');
        developerLoginButton.textContent = feedbackText('loadingNotes', 'Loading notes...');
        developerMessage.textContent = feedbackText('loadingNotes', 'Loading notes...');
        developerFeedbackList.replaceChildren();
        try {
            const response = await postGameServer('/api/developer-access', { password });
            const payload = await readFeedbackResponse(response);
            if (operation !== developerNotesOperation) return;
            if (!response.ok || !payload?.ok) {
                developerMessage.textContent = feedbackApiError(response, payload, 'loadFailed');
                return;
            }
            developerMessage.textContent = feedbackText('accessGranted', 'Access granted.');
            developerContent.hidden = false;
            const items = Array.isArray(payload.notes) ? payload.notes : [];
            renderDeveloperNotes(items);
        } catch (error) {
            if (operation !== developerNotesOperation) return;
            developerMessage.textContent = error.name === 'AbortError'
                ? feedbackText('requestTimedOut', 'The server took too long to respond. Please try again.')
                : error.name === 'ServerNotConfiguredError'
                    ? feedbackText('serverNotConfigured', 'The game server URL is not configured.')
                    : feedbackText('backendUnavailable', 'Could not connect to the game server. Check the server connection and try again.');
        } finally {
            if (operation === developerNotesOperation) {
                developerLoginButton.disabled = false;
                developerLoginButton.removeAttribute('aria-busy');
                developerLoginButton.textContent = feedbackText('adminOpen', 'Open');
            }
        }
    }

    async function deleteDeveloperNotes() {
        if (developerDeleteNotesButton.disabled) return;
        const confirmation = feedbackText(
            'deleteAllConfirmation',
            'Delete all developer notes? This cannot be undone.'
        );
        if (!window.confirm(confirmation)) return;

        const operation = ++developerNotesOperation;
        developerLoginButton.disabled = true;
        developerDeleteNotesButton.disabled = true;
        developerDeleteNotesButton.setAttribute('aria-busy', 'true');
        developerMessage.textContent = feedbackText('deletingNotes', 'Deleting notes...');
        const password = developerPasswordInput.value;
        try {
            const response = await postGameServer('/api/developer-notes/delete', { password });
            const payload = await readFeedbackResponse(response);
            if (operation !== developerNotesOperation) return;
            if (!response.ok || !payload?.ok) {
                developerMessage.textContent = feedbackApiError(response, payload, 'deleteFailed');
                return;
            }

            const verificationResponse = await postGameServer('/api/developer-access', { password });
            const verification = await readFeedbackResponse(verificationResponse);
            if (operation !== developerNotesOperation) return;
            if (!verificationResponse.ok || !verification?.ok) {
                developerMessage.textContent = feedbackApiError(verificationResponse, verification, 'deleteFailed');
                return;
            }

            const remainingNotes = Array.isArray(verification.notes) ? verification.notes : [];
            renderDeveloperNotes(remainingNotes);
            if (remainingNotes.length > 0) {
                developerMessage.textContent = feedbackText('deleteVerificationFailed', 'Some notes are still saved. Please try deleting them again.');
                return;
            }
            developerMessage.textContent = feedbackText('deleteAllSuccess', 'All notes were deleted.');
        } catch (error) {
            if (operation !== developerNotesOperation) return;
            developerMessage.textContent = error.name === 'AbortError'
                ? feedbackText('requestTimedOut', 'The server took too long to respond. Please try again.')
                : error.name === 'ServerNotConfiguredError'
                    ? feedbackText('serverNotConfigured', 'The game server URL is not configured.')
                    : feedbackText('backendUnavailable', 'Could not connect to the game server. Check the server connection and try again.');
        } finally {
            if (operation === developerNotesOperation) {
                developerLoginButton.disabled = false;
                developerDeleteNotesButton.disabled = false;
                developerDeleteNotesButton.removeAttribute('aria-busy');
            }
        }
    }

    async function submitFeedbackNote() {
        const message = feedbackNoteInput.value.trim();
        if (!message) {
            feedbackMessage.textContent = feedbackText('emptyNote', 'Write a note before sending.');
            feedbackNoteInput.focus();
            return;
        }
        feedbackSubmitButton.disabled = true;
        feedbackSubmitButton.setAttribute('aria-busy', 'true');
        feedbackMessage.textContent = feedbackText('sending', 'Sending...');
        try {
            const response = await postGameServer('/api/developer-note', { message });
            const payload = await readFeedbackResponse(response);
            if (!response.ok || !payload?.ok) {
                feedbackMessage.textContent = feedbackApiError(response, payload, 'sendFailed');
                return;
            }
            feedbackNoteInput.value = '';
            feedbackMessage.textContent = feedbackText('sent', 'Thank you! Your note was sent.');
        } catch (error) {
            feedbackMessage.textContent = error.name === 'AbortError'
                ? feedbackText('requestTimedOut', 'The server took too long to respond. Please try again.')
                : error.name === 'ServerNotConfiguredError'
                    ? feedbackText('serverNotConfigured', 'The game server URL is not configured.')
                    : feedbackText('backendUnavailable', 'Could not connect to the game server. Check the server connection and try again.');
        } finally {
            feedbackSubmitButton.disabled = false;
            feedbackSubmitButton.removeAttribute('aria-busy');
        }
    }

    function readName() {
        const name = nameInput.value.trim().slice(0, 20);
        nameError.hidden = Boolean(name);
        if (!name) { nameInput.focus(); return ''; }
        try { localStorage.setItem(NAME_KEY, name); } catch (error) { /* التخزين غير متاح: لا مشكلة */ }
        return name;
    }

    const App = {
        playerName: '',

        showWelcome() {
            if (mode === 'online') OnlineMode.exit();
            if (mode === 'ai') AIMode.exit();
            mode = null;
            languageToggle.disabled = false;
            App.selectedOnlineTeam = null;
            selectionScreen.querySelectorAll('.faction-card').forEach((card) => card.classList.remove('is-selected'));
            pickLight.disabled = true;
            pickDark.disabled = true;
            pickLightTitle.disabled = true;
            pickDarkTitle.disabled = true;
            show(selectionScreen, false);
            show(battleScreen, false);
            show(welcomeScreen, true);
            nameInput.focus();
        },

        // الشاشة الرئيسية للوضع الحالي: قائمة اللاعبين (أونلاين) أو اختيار الفريق (كمبيوتر)
        showModeHome() {
            if (!mode) { App.showWelcome(); return; }
            show(welcomeScreen, false);
            show(battleScreen, false);
            selectionScreen.classList.toggle('mode-online', mode === 'online');
            selectionScreen.classList.toggle('mode-ai', mode === 'ai');
            pickLight.disabled = mode !== 'ai';
            pickDark.disabled = mode !== 'ai';
            pickLightTitle.disabled = mode !== 'ai';
            pickDarkTitle.disabled = mode !== 'ai';
            if (mode === 'online') {
                pickLight.disabled = false;
                pickDark.disabled = false;
                pickLightTitle.disabled = false;
                pickDarkTitle.disabled = false;
                App.selectedOnlineTeam = null;
                selectionScreen.querySelectorAll('.faction-card').forEach((card) => card.classList.remove('is-selected'));
            }
            
            // Get translations based on current language
            const lang = document.documentElement.getAttribute('lang') || 'en';
            const t = translations[lang];
            const greetingKey = mode === 'online' ? 'onlineGreeting' : 'aiGreeting';
            const greeting = t.welcome[greetingKey].replace('{name}', App.playerName);
            
            headerSubtitle.textContent = greeting;
            show(selectionScreen, true);
        },

        enterOnline() {
            const name = readName();
            if (!name) return;
            App.playerName = name;
            App.selectedOnlineTeam = null;
            mode = 'online';
            OnlineMode.enter(name);
            App.showModeHome();
        },

        enterComputer() {
            const lang = document.documentElement.getAttribute('lang') || 'en';
            const name = nameInput.value.trim().slice(0, 20)
                || translations[lang].welcome.defaultPlayerName;
            nameError.hidden = true;
            App.playerName = name;
            try { localStorage.setItem(NAME_KEY, name); } catch (error) { /* التخزين غير متاح: لا مشكلة */ }
            mode = 'ai';
            App.showModeHome();
        }
    };
    App.selectedOnlineTeam = null;
    window.App = App;

    challengeHumans.addEventListener('click', App.enterOnline);
    challengeComputer.addEventListener('click', App.enterComputer);
    backToWelcome.addEventListener('click', App.showWelcome);
    feedbackTrigger?.addEventListener('click', openFeedbackModal);
    syncFeedbackTriggerVisibility();
    new MutationObserver(syncFeedbackTriggerVisibility).observe(battleScreen, {
        attributes: true,
        attributeFilter: ['class', 'hidden']
    });
    feedbackCloseButton?.addEventListener('click', closeFeedbackModal);
    feedbackSubmitButton?.addEventListener('click', submitFeedbackNote);
    feedbackModal?.addEventListener('click', (event) => {
        if (event.target === feedbackModal) closeFeedbackModal();
    });
    languageToggle?.addEventListener('contextmenu', handleDeveloperContextMenu);
    developerCloseButton?.addEventListener('click', closeDeveloperModal);
    developerLoginButton?.addEventListener('click', loadDeveloperNotes);
    developerDeleteNotesButton?.addEventListener('click', deleteDeveloperNotes);
    window.addEventListener('resize', syncOrientationPrompt);
    window.addEventListener('orientationchange', syncOrientationPrompt);
    window.screen.orientation?.addEventListener?.('change', syncOrientationPrompt);
    syncOrientationPrompt();
    developerPasswordInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') loadDeveloperNotes();
    });
    developerModal?.addEventListener('click', (event) => {
        if (event.target === developerModal) closeDeveloperModal();
    });
    // اختيار القائد يبدأ مباراة الكمبيوتر مباشرة.
    const chooseComputerTeam = (team) => {
        if (mode === 'ai') AIMode.start(team, getSelectedTurnDurationMs());
        else selectOnlineTeam(team);
    };
    pickLight.addEventListener('click', () => chooseComputerTeam('light'));
    pickDark.addEventListener('click', () => chooseComputerTeam('dark'));
    pickLightTitle.addEventListener('click', () => chooseComputerTeam('light'));
    pickDarkTitle.addEventListener('click', () => chooseComputerTeam('dark'));
    nameInput.addEventListener('input', () => { nameError.hidden = true; });

    try { nameInput.value = localStorage.getItem(NAME_KEY) || ''; } catch (error) { nameInput.value = ''; }
    App.showWelcome();
})();
