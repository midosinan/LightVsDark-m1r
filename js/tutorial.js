(() => {
    const modal = document.querySelector('#tutorial-modal');
    const openButton = document.querySelector('#open-tutorial');
    const closeButton = document.querySelector('#tutorial-close');
    const backButton = document.querySelector('#tutorial-back');
    const nextButton = document.querySelector('#tutorial-next');
    const pauseButton = document.querySelector('#tutorial-pause');
    const skipButton = document.querySelector('#tutorial-skip');
    const stepCount = document.querySelector('#tutorial-step-count');
    const stepTitle = document.querySelector('#tutorial-step-title');
    const stepMessage = document.querySelector('#tutorial-step-message');
    const stepProgress = document.querySelector('.tutorial-progress');
    const progressBar = document.querySelector('#tutorial-progress-bar');
    const autoIndicator = document.querySelector('#tutorial-auto-indicator');
    const roundLabel = document.querySelector('#tutorial-round');
    const turnLabel = document.querySelector('#tutorial-turn');
    const market = document.querySelector('#tutorial-market');
    const marketCard = document.querySelector('#tutorial-market-card');
    const AUTO_ADVANCE_MS = 15000;
    let currentStep = 0;
    let autoAdvanceTimer = null;
    let isPaused = false;
    let lastFocusedElement = null;

    const scenes = [
        {
            round: 1, turn: 'turnLight', lightGold: 5, darkGold: 5, lightHealth: 20, darkHealth: 20,
            lightCards: [], darkCards: [], highlight: 'toolbar', focus: 'hand'
        },
        {
            round: 1, turn: 'turnLight', lightGold: 5, darkGold: 5, lightHealth: 20, darkHealth: 20,
            lightCards: [], darkCards: [], highlight: 'scoreboard', focus: 'scoreboard'
        },
        {
            round: 1, turn: 'turnDark', lightGold: 2, darkGold: 2, lightHealth: 20, darkHealth: 20,
            lightCards: [{ id: 'cunning-trader', health: 8, attack: 6, cost: 3, feature: 'trader' }],
            darkCards: [{ id: 'dread-priest', health: 9, attack: 4, cost: 3, feature: 'priest' }],
            highlight: 'field', focus: 'hand'
        },
        {
            round: 1, turn: 'turnResolve', lightGold: 2, darkGold: 2, lightHealth: 20, darkHealth: 20,
            lightCards: [{ id: 'cunning-trader', health: 4, attack: 6, cost: 3, feature: 'trader' }],
            darkCards: [{ id: 'dread-priest', health: 3, attack: 4, cost: 3, feature: 'priest' }],
            highlight: 'field', focus: 'attack', attack: true
        },
        {
            round: 3, turn: 'turnLight', lightGold: 6, darkGold: 9, lightHealth: 20, darkHealth: 14,
            lightCards: [{ id: 'cunning-trader', health: 4, attack: 6, cost: 3, feature: 'trader' }],
            darkCards: [{ id: 'silent-neighbor', health: 8, attack: 3, cost: 2, feature: 'silence' }],
            highlight: 'market', focus: 'bank', showMarket: true,
            marketCard: { id: 'forced-tax', cost: 3 }
        },
        {
            round: 3, turn: 'turnLight', lightGold: 7, darkGold: 8, lightHealth: 18, darkHealth: 14,
            lightCards: [
                { id: 'light-healer', health: 8, attack: 1, cost: 2, feature: 'healer' },
                { id: 'forced-tax', health: 10, attack: 4, cost: 1, bank: true, feature: 'tax' }
            ],
            darkCards: [{ id: 'silent-neighbor', health: 8, attack: 3, cost: 2, feature: 'silence' }],
            highlight: 'scoreboard', focus: 'exchange', exchange: true
        },
        {
            round: 3, turn: 'turnDark', lightGold: 7, darkGold: 8, lightHealth: 18, darkHealth: 14,
            lightCards: [
                { id: 'cunning-trader', health: 4, attack: 6, cost: 3, feature: 'trader', blocked: true },
                { id: 'light-healer', health: 8, attack: 1, cost: 2, feature: 'healer' }
            ],
            darkCards: [{ id: 'silent-neighbor', health: 8, attack: 3, cost: 2, feature: 'silence' }],
            highlight: 'field', focus: 'graveyard'
        },
        {
            round: 4, turn: 'turnLight', lightGold: 10, darkGold: 7, lightHealth: 18, darkHealth: 8,
            lightCards: [
                { id: 'light-shield', health: 7, attack: 4, cost: 7, feature: 'shield' },
                { id: 'cunning-trader', health: 4, attack: 6, cost: 3, feature: 'trader' },
                { id: 'falcon', health: 10, attack: 3, cost: 2, feature: 'falcon' },
                { id: 'vault-guardian', health: 13, attack: 8, cost: 4, feature: 'vault' }
            ],
            darkCards: [{ id: 'hell-dragon', health: 15, attack: 8, cost: 6, feature: 'dragon' }],
            highlight: 'field', focus: 'hand'
        },
        {
            round: 5, turn: 'turnLight', lightGold: 10, darkGold: 4, lightHealth: 16, darkHealth: 3,
            lightCards: [{ id: 'cunning-trader', health: 4, attack: 6, cost: 3, feature: 'trader' }],
            darkCards: [], highlight: 'field', focus: 'attack', leaderAttack: true
        },
        {
            round: 5, turn: 'turnResolve', lightGold: 10, darkGold: 4, lightHealth: 16, darkHealth: 0,
            lightCards: [{ id: 'cunning-trader', health: 4, attack: 6, cost: 3, feature: 'trader' }],
            darkCards: [], highlight: 'result', focus: 'endTurn', result: 'light'
        }
    ];

    const controlKeys = ['bank', 'exchange', 'luck', 'hand', 'graveyard', 'attack', 'endTurn'];

    function getLanguage() {
        return document.documentElement.getAttribute('lang') || 'en';
    }

    function getTutorialText(key) {
        return getNestedValue(translations[getLanguage()], `selection.tutorial.${key}`);
    }

    function getCardDefinition(id) {
        const languageCards = translations[getLanguage()].cards;
        const isLightCard = ['falcon', 'light-healer', 'cunning-trader', 'vault-guardian', 'light-shield', 'sword-of-justice'].includes(id);
        const cards = isLightCard ? languageCards.light : languageCards.dark;
        const cardIndex = {
            falcon: 0, 'light-healer': 1, 'cunning-trader': 2, 'vault-guardian': 3, 'light-shield': 4, 'sword-of-justice': 5,
            'silent-neighbor': 0, 'hell-dragon': 1, 'dark-ghoul': 2, 'dread-priest': 3, 'valley-of-screams': 4, 'box-monster': 5
        }[id];
        if (cardIndex !== undefined) return { name: cards[cardIndex].name, image: `assets/images/cards/${isLightCard ? 'Good' : 'Evil'}/${id}.png` };
        return {
            name: getNestedValue(translations[getLanguage()], `selection.cards.${id === 'forced-tax' ? 'tax' : id}`),
            image: 'assets/images/bank-cards/forced-tax.jpg'
        };
    }

    function createCard(card) {
        const definition = getCardDefinition(card.id);
        const element = document.createElement('div');
        element.className = `tutorial-card${card.blocked ? ' is-blocked' : ''}`;

        const image = document.createElement('img');
        image.src = definition.image;
        image.alt = definition.name;
        image.loading = 'lazy';

        const name = document.createElement('span');
        name.className = 'tutorial-card-name';
        name.textContent = definition.name;

        const stats = document.createElement('small');
        stats.textContent = `❤ ${card.health}  ⚔ ${card.attack}`;

        const cost = document.createElement('span');
        cost.className = 'tutorial-card-cost';
        cost.textContent = `◉ ${card.cost}`;

        element.append(image, name, stats, cost);
        if (card.feature) {
            const feature = document.createElement('small');
            feature.className = 'tutorial-card-effect';
            feature.textContent = getTutorialText(`cardFeatures.${card.feature}`);
            element.append(feature);
            element.title = feature.textContent;
        }
        if (card.blocked) {
            const blocked = document.createElement('span');
            blocked.className = 'tutorial-card-blocked';
            blocked.textContent = '🔇';
            blocked.setAttribute('aria-label', getLanguage() === 'ar' ? 'ممنوع من الهجوم' : 'Attack blocked');
            element.append(blocked);
        }
        if (card.bank) element.classList.add('is-bank-card');
        return element;
    }

    function renderCardRow(team, cards) {
        const row = document.querySelector(`[data-tutorial-cards="${team}"]`);
        row.replaceChildren();
        for (let slotIndex = 0; slotIndex < 4; slotIndex += 1) {
            const slot = document.createElement('div');
            slot.className = 'tutorial-slot';
            if (cards[slotIndex]) {
                slot.append(createCard(cards[slotIndex]));
                if (scenes[currentStep].attack && team === 'dark' && slotIndex === 0) slot.classList.add('is-targeted');
                if (scenes[currentStep].attack && team === 'light' && slotIndex === 0) slot.classList.add('is-attacking');
            }
            row.append(slot);
        }
    }

    function renderMarketCard(card) {
        marketCard.replaceChildren();
        if (!card) return;
        const definition = getCardDefinition(card.id);
        const image = document.createElement('img');
        image.src = definition.image;
        image.alt = definition.name;
        const name = document.createElement('strong');
        name.textContent = definition.name;
        const cost = document.createElement('span');
        cost.textContent = `◉ ${card.cost}`;
        marketCard.append(image, name, cost);
    }

    function renderStep() {
        const language = getLanguage();
        const translationsForLanguage = translations[language];
        const steps = translationsForLanguage.selection.tutorial.steps;
        const scene = scenes[currentStep];
        const step = steps[currentStep];

        if (!step) throw new Error(`Missing tutorial translation for step ${currentStep + 1} (${language}).`);
        stepCount.textContent = `${currentStep + 1} / ${scenes.length}`;
        stepTitle.textContent = step.title;
        stepMessage.textContent = step.message;
        roundLabel.textContent = String(scene.round);
        turnLabel.textContent = getTutorialText(scene.turn);
        for (const team of ['light', 'dark']) {
            document.querySelector(`[data-tutorial-gold="${team}"]`).textContent = String(scene[`${team}Gold`]);
            document.querySelector(`[data-tutorial-health="${team}"]`).textContent = String(scene[`${team}Health`]);
            renderCardRow(team, scene[`${team}Cards`]);
        }

        market.hidden = !scene.showMarket;
        renderMarketCard(scene.marketCard);
        const board = document.querySelector('#tutorial-board');
        board.dataset.highlight = scene.highlight;
        board.classList.toggle('has-attack', Boolean(scene.attack || scene.leaderAttack));
        board.classList.toggle('has-leader-attack', Boolean(scene.leaderAttack));
        board.classList.toggle('has-result', Boolean(scene.result));
        board.dataset.focus = scene.focus || '';
        document.querySelector('#tutorial-exchange').hidden = !scene.exchange;
        document.querySelector('#tutorial-result').hidden = !scene.result;
        if (scene.exchange) {
            document.querySelector('#tutorial-exchange').textContent = getTutorialText('exchangeExample');
        }
        if (scene.result) {
            document.querySelector('#tutorial-result').textContent = getTutorialText('victory');
        }
        document.querySelector('#tutorial-scoreboard').dataset.highlight = scene.highlight;
        const controls = translationsForLanguage.selection.tutorial.controls;
        for (const key of controlKeys) {
            const control = document.querySelector(`[data-tutorial-control="${key}"]`);
            control.querySelector('strong').textContent = controls[key].title;
            control.querySelector('small').textContent = controls[key].description;
        }
        document.querySelector('#tutorial-toolbar').setAttribute('aria-label', getTutorialText('controlsLabel'));
        backButton.disabled = currentStep === 0;
        nextButton.textContent = currentStep === scenes.length - 1 ? getTutorialText('restart') : getTutorialText('next');
        stepProgress.setAttribute('aria-valuemax', String(scenes.length));
        stepProgress.setAttribute('aria-valuenow', String(currentStep + 1));
        progressBar.style.width = `${((currentStep + 1) / scenes.length) * 100}%`;
        updatePlaybackControls();
    }

    function clearAutoAdvance() {
        if (autoAdvanceTimer !== null) {
            window.clearTimeout(autoAdvanceTimer);
            autoAdvanceTimer = null;
        }
    }

    function scheduleAutoAdvance() {
        clearAutoAdvance();
        if (!modal.classList.contains('screen-hidden') && !isPaused && currentStep < scenes.length - 1) {
            autoAdvanceTimer = window.setTimeout(() => {
                autoAdvanceTimer = null;
                currentStep += 1;
                renderStep();
                scheduleAutoAdvance();
            }, AUTO_ADVANCE_MS);
        }
    }

    function updatePlaybackControls() {
        pauseButton.textContent = getTutorialText(isPaused ? 'resume' : 'pause');
        autoIndicator.textContent = getTutorialText(isPaused ? 'paused' : 'playing');
        autoIndicator.classList.toggle('is-paused', isPaused);
    }

    function openTutorial() {
        lastFocusedElement = document.activeElement;
        currentStep = 0;
        isPaused = false;
        modal.classList.remove('screen-hidden');
        modal.setAttribute('aria-hidden', 'false');
        renderStep();
        scheduleAutoAdvance();
        nextButton.focus();
    }

    function closeTutorial() {
        clearAutoAdvance();
        modal.classList.add('screen-hidden');
        modal.setAttribute('aria-hidden', 'true');
        lastFocusedElement?.focus();
    }

    openButton.addEventListener('click', openTutorial);
    closeButton.addEventListener('click', closeTutorial);
    skipButton.addEventListener('click', closeTutorial);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeTutorial();
    });
    backButton.addEventListener('click', () => {
        if (currentStep === 0) return;
        clearAutoAdvance();
        currentStep -= 1;
        renderStep();
        scheduleAutoAdvance();
    });
    nextButton.addEventListener('click', () => {
        clearAutoAdvance();
        if (currentStep === scenes.length - 1) {
            currentStep = 0;
            isPaused = false;
        } else {
            currentStep += 1;
        }
        renderStep();
        scheduleAutoAdvance();
    });
    pauseButton.addEventListener('click', () => {
        isPaused = !isPaused;
        if (isPaused) clearAutoAdvance();
        updatePlaybackControls();
        if (!isPaused) scheduleAutoAdvance();
    });
    document.addEventListener('keydown', (event) => {
        if (modal.classList.contains('screen-hidden')) return;
        if (event.key === 'Escape') closeTutorial();
        if (event.key === 'ArrowRight') backButton.click();
        if (event.key === 'ArrowLeft') nextButton.click();
    });
    new MutationObserver(() => {
        if (!modal.classList.contains('screen-hidden')) renderStep();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
})();
