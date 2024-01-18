'use strict';

/**
 * @type {GameData}
 */
let gameData;

/**
 *
 * @type {
 * {
 *   element: HTMLElement,
 *   effectType: EffectType,
 *   getEffect: function(EffectType): number,
 *   getEffects: function(): EffectDefinition[],
 *   isActive: function(): boolean
 * }[]
 * }
 */
const attributeBalanceEntries = [];

/**
 *
 * @type {{element: HTMLElement, taskOrItem: EffectsHolder, isActive: function(): boolean}[]}
 */
const gridLoadBalanceEntries = [];

/**
 *
 * @type {Object.<string, HTMLElement>}
 */
const tabButtons = {
    modules: document.getElementById('modulesTabButton'),
    location: document.getElementById('locationTabButton'),
    captainsLog: document.getElementById('captainsLogTabButton'),
    battles: document.getElementById('battleTabButton'),
    attributes: document.getElementById('attributesTabButton'),
    settings: document.getElementById('settingsTabButton'),
};

function getBaseLog(x, y) {
    return Math.log(y) / Math.log(x);
}

function applyMultipliers(value, multipliers) {
    const finalMultiplier = multipliers.reduce((final, multiplierFn) => final * multiplierFn(), 1);

    return Math.round(value * finalMultiplier);
}

function applySpeed(value) {
    return value * getGameSpeed() / updateSpeed;
}

function calculateHeat() {
    const danger = attributes.danger.getValue();
    let military = 0;
    if (gameData.state !== gameStates.BOSS_FIGHT) {
        military = attributes.military.getValue();
    }

    return Math.max(danger - military, 1);
}

function populationDelta() {
    let growth = 0;
    if (gameData.state !== gameStates.BOSS_FIGHT) {
        growth = attributes.growth.getValue();
    }
    const heat = attributes.heat.getValue();
    const population = attributes.population.getValue();
    return growth - population * 0.01 * heat;
}

function updatePopulation() {
    if (!gameData.state.areAttributesUpdated) return;

    gameData.population += applySpeed(populationDelta());
    gameData.population = Math.max(gameData.population, 1);

    if (gameData.state === gameStates.BOSS_FIGHT && Math.round(gameData.population) === 1) {
        gameData.transitionState(gameStates.DEAD);
    }
}

function getPopulationProgressSpeedMultiplier() {
    // Random ass formula ᕕ( ᐛ )ᕗ
    // Pop 1 = x1
    // Pop 10 ~= x3.4
    // Pop 100 ~= x12
    // Pop 1000 ~= x40
    // Pop 10000 ~= x138
    // Pop 40000 ~= x290
    return Math.max(1, Math.pow(Math.round(gameData.population), 1 / 1.869));
}

function getGameSpeed() {
    return baseGameSpeed;
}

function hideAllTooltips() {
    for (const tooltipTriggerElement of visibleTooltips) {
        // noinspection JSUnresolvedReference
        bootstrap.Tooltip.getInstance(tooltipTriggerElement).hide();
    }
}

function setTab(selectedTab) {
    if (tabButtons[selectedTab].classList.contains('hidden')) {
        // Tab is not available
        return;
    }

    const tabs = document.getElementsByClassName('tab');
    for (const tab of tabs) {
        tab.style.display = 'none';
    }
    document.getElementById(selectedTab).style.display = 'block';

    const tabButtonElements = document.getElementsByClassName('tabButton');
    for (const tabButton of tabButtonElements) {
        tabButton.classList.remove('active');
    }
    tabButtons[selectedTab].classList.add('active');
    gameData.selectedTab = selectedTab;
    gameData.save();

    hideAllTooltips();
}

// noinspection JSUnusedGlobalSymbols used in HTML
function togglePause() {
    if (gameData.state === gameStates.PLAYING) {
        gameData.transitionState(gameStates.PAUSED);
    } else if (gameData.state === gameStates.PAUSED) {
        gameData.transitionState(gameStates.PLAYING);
    }
    // Any other state is ignored
}

function setPointOfInterest(name) {
    if (!gameData.state.canChangeActivation) {
        VFX.shakePlayButton();
        return;
    }

    gameData.activeEntities.pointOfInterest = name;
}

/**
 *
 * @param {Module} module
 * @param {HTMLInputElement} switchElement
 */
function switchModuleActivation(module, switchElement) {
    if (!gameData.state.canChangeActivation) {
        switchElement.checked = false;
        VFX.shakePlayButton();
        return;
    }

    if (!switchElement.checked) {
        module.setActive(false);
        return;
    }

    const gridLoadAfterActivation = attributes.gridLoad.getValue() + module.getGridLoad();
    if (gridLoadAfterActivation > attributes.gridStrength.getValue()) {
        switchElement.checked = false;
        VFX.highlightText(Dom.get().bySelector(`#${module.domId} .gridLoad`), 'flash-text-denied', 'flash-text-denied');
        return;
    }

    module.setActive(true);
}

/**
 *
 * @param {ModuleComponent} component
 * @param {ModuleOperation} operation
 */
function tryActivateOperation(component, operation) {
    if (operation.isActive('self')) {
        // Already active, nothing to do
        return;
    }

    const gridLoadAfterActivation = attributes.gridLoad.getValue()
        + operation.getGridLoad()
        - component.getActiveOperation().getGridLoad();
    if (gridLoadAfterActivation > attributes.gridStrength.getValue()) {
        VFX.highlightText(Dom.get().bySelector(`#${operation.domId} .gridLoad`), 'flash-text-denied', 'flash-text-denied');
        return;
    }

    // This needs to go through the component as it needs to disable other operations
    component.activateOperation(operation);
}

// function setBattle(name) {
//     gameData.currentBattle = gameData.battleData[name];
//     const nameElement = document.getElementById('battleName');
//     nameElement.textContent = gameData.currentBattle.name;
// }
//
// function startBattle(name) {
//     setBattle(name);
//     const progressBar = document.getElementById('battleProgressBar');
//     progressBar.hidden = false;
// }
//
// function concedeBattle() {
//     gameData.currentBattle = null;
//     GameEvents.GameOver.trigger({
//         bossDefeated: false,
//     });
// }

/**
 *
 * @param {string} domId
 * @return {HTMLElement}
 */
function createRequiredRow(domId) {
    const requirementsElement = Dom.new.fromTemplate('level4RequiredTemplate');
    requirementsElement.id = domId;
    requirementsElement.classList.add('level4-requirements');
    return requirementsElement;
}

/**
 *
 * @param {string} categoryName
 * @param {ModuleComponent} component
 * @returns {HTMLElement[]}
 */
function createModuleLevel4Elements(categoryName, component) {
    const level4Elements = [];
    const operations = component.operations;

    for (const operation of operations) {
        const level4Element = Dom.new.fromTemplate('level4TaskTemplate');
        level4Element.id = operation.domId;

        const level4DomGetter = Dom.get(level4Element);
        level4DomGetter.byClass('name').textContent = operation.title;
        const descriptionElement = level4DomGetter.byClass('descriptionTooltip');
        descriptionElement.ariaLabel = operation.title;
        if (isDefined(operation.description)) {
            descriptionElement.title = operation.description;
        } else {
            descriptionElement.removeAttribute('title');
        }
        level4DomGetter.byClass('progressBar').addEventListener('click', tryActivateOperation.bind(this, component, operation));
        formatValue(level4DomGetter.bySelector('.gridLoad > data'), operation.getGridLoad());

        level4Elements.push(level4Element);
    }

    level4Elements.push(createRequiredRow('row_requirements_component_' + component.name));

    return level4Elements;
}

function createModuleLevel3Elements(categoryName, module) {
    const level3Elements = [];

    for (const component of module.components) {
        const level3Element = Dom.new.fromTemplate('level3TaskTemplate');
        const level3DomGetter = Dom.get(level3Element);

        const nameCell = level3DomGetter.byClass('name');
        nameCell.textContent = component.title;
        if (isDefined(component.description)) {
            nameCell.title = component.description;
        } else {
            nameCell.removeAttribute('title');
        }
        const level4Slot = level3DomGetter.byClass('level4');
        level4Slot.append(...createModuleLevel4Elements(categoryName, component));

        level3Elements.push(level3Element);
    }

    return level3Elements;
}

/**
 *
 * @param {string} categoryName
 * @param {ModuleCategory} category
 * @return {HTMLElement[]}
 */
function createModuleLevel2Elements(categoryName, category, requirementsSlot) {
    const level2Elements = [];

    for (const module of category.modules) {
        const level2Element = Dom.new.fromTemplate('level2Template');
        const level2DomGetter = Dom.get(level2Element);
        level2Element.id = module.domId;
        const nameCell = level2DomGetter.byClass('name');
        nameCell.textContent = module.title;
        if (isDefined(module.description)) {
            nameCell.title = module.description;
        } else {
            nameCell.removeAttribute('title');
        }
        /** @var {HTMLInputElement} */
        const switchElement = level2DomGetter.byClass('moduleActivationSwitch');
        switchElement.id = 'switch_' + module.name;
        switchElement.checked = module.isActive();
        switchElement.addEventListener('click', switchModuleActivation.bind(this, module, switchElement));
        level2DomGetter.byClass('moduleActivationLabel').for = switchElement.id;

        const level3Slot = level2DomGetter.byId('level3');
        level3Slot.replaceWith(...createModuleLevel3Elements(categoryName, module));

        level2Elements.push(level2Element);
    }

    const requirementsElement = Dom.new.fromTemplate('requirementsTemplate');
    requirementsElement.id = 'row_requirements_category_' + categoryName;
    requirementsElement.classList.add('level2-requirements');
    requirementsSlot.replaceWith(requirementsElement);

    return level2Elements;
}

function createModulesUI(categoryDefinition, domId) {
    const slot = Dom.get().byId(domId);
    const level1Elements = [];

    for (const key in categoryDefinition) {
        const level1Element = Dom.new.fromTemplate('level1Template');

        /** @var {ModuleCategory} */
        const category = categoryDefinition[key];
        level1Element.id = category.domId;
        level1Element.classList.add(category.name);

        const level1DomGetter = Dom.get(level1Element);
        const categoryCell = level1DomGetter.byClass('category');
        categoryCell.textContent = category.title;
        if (isDefined(category.description)) {
            categoryCell.title = category.description;
        } else {
            categoryCell.removeAttribute('title');
        }
        level1DomGetter.byClass('level1-header').style.backgroundColor = category.color;

        const level2Slot = level1DomGetter.byId('level2');
        level2Slot.replaceWith(...createModuleLevel2Elements(category.name, category, level1DomGetter.byId('level2Requirements')));

        level1Elements.push(level1Element);
    }

    slot.replaceWith(...level1Elements);

    const requirementsElement = Dom.new.fromTemplate('requirementsTemplate');
    requirementsElement.id = 'row_requirements_moduleCategory';
    requirementsElement.classList.add('level1-requirements');
    Dom.get().byId('moduleCategoryRequirements').replaceWith(requirementsElement);
}

/**
 *
 * @param {PointOfInterest[]} pointsOfInterest
 * @param {string} sectorName
 * @return {HTMLElement[]}
 */
function createLevel4SectorElements(pointsOfInterest, sectorName) {
    const level4Elements = [];
    for (const pointOfInterest of pointsOfInterest) {
        const level4Element = Dom.new.fromTemplate('level4PointOfInterestTemplate');
        level4Element.id = 'row_' + pointOfInterest.name;

        const level4DomGetter = Dom.get(level4Element);
        level4DomGetter.byClass('name').textContent = pointOfInterest.title;
        const descriptionElement = level4DomGetter.byClass('descriptionTooltip');
        descriptionElement.ariaLabel = pointOfInterest.title;
        if (isDefined(pointOfInterest.description)) {
            descriptionElement.title = pointOfInterest.description;
        } else {
            descriptionElement.removeAttribute('title');
        }
        level4DomGetter.byClass('modifier').innerHTML = pointOfInterest.modifiers.map(Modifier.getDescription).join(',\n');
        level4DomGetter.byClass('button').addEventListener('click', () => {
            setPointOfInterest(pointOfInterest.name);
        });
        level4DomGetter.byClass('radio').addEventListener('click', () => {
            setPointOfInterest(pointOfInterest.name);
        });

        level4Elements.push(level4Element);
    }

    level4Elements.push(createRequiredRow('row_requirements_sector_' + sectorName));
    return level4Elements;
}

/**
 *
 * @param {Sector} sector
 * @param {string} sectorName
 * @return {HTMLElement}
 */
function createLevel3SectorElement(sector, sectorName) {
    const level3Element = Dom.new.fromTemplate('level3PointOfInterestTemplate');

    level3Element.id = sector.domId;
    level3Element.classList.add(sectorName);
    level3Element.classList.remove('ps-3');

    const level3DomGetter = Dom.get(level3Element);
    level3DomGetter.byClass('header-row').style.backgroundColor = sector.color;
    const nameCell = level3DomGetter.byClass('name');
    nameCell.textContent = sector.title;
    if (isDefined(sector.description)) {
        nameCell.title = sector.description;
    } else {
        nameCell.removeAttribute('title');
    }

    /** @type {HTMLElement} */
    const level4Slot = level3DomGetter.byClass('level4');
    level4Slot.append(...createLevel4SectorElements(sector.pointsOfInterest, sectorName));
    return level3Element;
}

/**
 * Due to styling reasons, the two rendered levels are actually level 3 + 4 - don't get confused.
 * @param {Object.<string, Sector>} categoryDefinition
 * @param {string} domId
 */
function createSectorsUI(categoryDefinition, domId) {
    const slot = Dom.get().byId(domId);
    const level3Elements = [];

    for (const key in categoryDefinition) {
        const sector = categoryDefinition[key];
        const sectorElement = createLevel3SectorElement(sector, sector.name);
        if (level3Elements.length === 0) {
            sectorElement.classList.remove('mt-2');
        }
        level3Elements.push(sectorElement);
    }

    slot.replaceWith(...level3Elements);

    const requirementsElement = Dom.new.fromTemplate('requirementsTemplate');
    requirementsElement.id = 'row_requirements_sector';
    requirementsElement.classList.add('level1-requirements');
    Dom.get().byId('sectorRequirements').replaceWith(requirementsElement);
}

/**
 *
 * @param {DomGetter} domGetter
 * @param {Battle} battle
 */
function initializeBattleElement(domGetter, battle) {
    domGetter.byClass('name').textContent = battle.title;
    const descriptionElement = domGetter.byClass('descriptionTooltip');
    descriptionElement.ariaLabel = battle.title;
    if (isDefined(battle.description)) {
        descriptionElement.title = battle.description;
    } else {
        descriptionElement.removeAttribute('title');
    }
}

/**
 *
 * @param {Battle[]} battles
 * @return {HTMLElement[]}
 */
function createLevel4BattleElements(battles) {
    const level4Elements = [];
    for (const battle of battles) {
        const level4Element = Dom.new.fromTemplate('level4BattleTemplate');
        level4Element.id = 'row_' + battle.name;
        const domGetter = Dom.get(level4Element);
        initializeBattleElement(domGetter, battle);
        domGetter.byClass('rewards').textContent = battle.getRewardsDescription();
        const clickListener = () => {
            if (battle instanceof BossBattle){
                gameData.transitionState(gameStates.BOSS_FIGHT_INTRO);
            } else {
                battle.toggle();
            }
        };
        domGetter.byClass('progressBar').addEventListener('click', clickListener);
        domGetter.byClass('radio').addEventListener('click', clickListener);

        level4Elements.push(level4Element);
    }

    level4Elements.push(createRequiredRow('row_requirements_battle'));
    return level4Elements;
}

function createUnfinishedBattlesUI() {
    const level3Element = Dom.new.fromTemplate('level3BattleTemplate');

    level3Element.id = 'unfinishedBattles';
    level3Element.classList.remove('ps-3');
    //     level3Element.classList.remove('mt-2');

    const domGetter = Dom.get(level3Element);
    domGetter.byClass('header-row').style.backgroundColor = colorPalette.TomatoRed;
    domGetter.byClass('name').textContent = 'Open';

    /** @type {HTMLElement} */
    const level4Slot = domGetter.byClass('level4');
    level4Slot.append(...createLevel4BattleElements(Object.values(battles)));

    return level3Element;
}

/**
 *
 * @param {Battle[]} battles
 * @return {HTMLElement[]}
 */
function createLevel4FinishedBattleElements(battles) {
    const level4Elements = [];
    for (const battle of battles) {
        const level4Element = Dom.new.fromTemplate('level4BattleTemplate');
        level4Element.id = 'row_done_' + battle.name;
        level4Element.classList.add('hidden');
        const domGetter = Dom.get(level4Element);
        initializeBattleElement(domGetter, battle);
        domGetter.bySelector('.progressBar .progressBackground').style.backgroundColor = lastLayerData.color;
        domGetter.bySelector('.progressBar .progressFill').style.width = '0%';
        domGetter.byClass('action').classList.add('hidden');
        formatValue(
            domGetter.bySelector('.level > data'),
            battle.targetLevel,
            {keepNumber: true},
        );
        domGetter.byClass('xpGain').classList.add('hidden');
        domGetter.byClass('xpLeft').classList.add('hidden');
        domGetter.byClass('danger').classList.add('hidden');
        domGetter.byClass('rewards').textContent = battle.getRewardsDescription();

        // unshift --> battles in reverse order
        level4Elements.unshift(level4Element);
    }

    return level4Elements;
}

function createFinishedBattlesUI() {
    const level3Element = Dom.new.fromTemplate('level3BattleTemplate');

    level3Element.id = 'finishedBattles';
    level3Element.classList.remove('ps-3');

    const domGetter = Dom.get(level3Element);
    domGetter.byClass('header-row').style.backgroundColor = colorPalette.EasyGreen;
    domGetter.byClass('name').textContent = 'Completed';
    domGetter.byClass('action').classList.add('hidden');
    domGetter.byClass('level').textContent = 'Defeated levels';
    domGetter.byClass('xpGain').classList.add('hidden');
    domGetter.byClass('xpLeft').classList.add('hidden');
    domGetter.byClass('danger').classList.add('hidden');

    /** @type {HTMLElement} */
    const level4Slot = domGetter.byClass('level4');
    level4Slot.append(...createLevel4FinishedBattleElements(Object.values(battles)));

    return level3Element;
}

function createBattlesUI(categoryDefinition, domId) {
    const slot = Dom.get().byId(domId);

    slot.replaceWith(createUnfinishedBattlesUI(), createFinishedBattlesUI());
}

function createModulesQuickDisplay() {
    const slot = Dom.get().byId('modulesQuickTaskDisplay');
    const quickDisplayElements = [];
    for (const moduleName in modules) {
        const module = modules[moduleName];
        const moduleQuickTaskDisplayElement = Dom.new.fromTemplate('moduleQuickTaskDisplayTemplate');
        const moduleDomGetter = Dom.get(moduleQuickTaskDisplayElement);
        moduleQuickTaskDisplayElement.classList.add(moduleName);
        moduleDomGetter.byClass('moduleName').textContent = module.title;
        const componentSlot = moduleDomGetter.byId('componentsQuickTaskDisplay');
        const componentQuickTaskDisplayElements = [];
        for (const component of module.components) {
            for (const operation of component.operations) {
                const componentQuickTaskDisplayElement = Dom.new.fromTemplate('componentQuickTaskDisplayTemplate');
                componentQuickTaskDisplayElement.title = component.title + ': ' + operation.title;
                const componentDomGetter = Dom.get(componentQuickTaskDisplayElement);
                componentQuickTaskDisplayElement.classList.add(component.name, operation.name);
                componentDomGetter.bySelector('.name > .component').textContent = component.title;
                componentDomGetter.bySelector('.name > .operation').textContent = operation.title;
                componentQuickTaskDisplayElements.push(componentQuickTaskDisplayElement);
            }
        }
        componentSlot.replaceWith(...componentQuickTaskDisplayElements);

        quickDisplayElements.push(moduleQuickTaskDisplayElement);
    }
    slot.replaceWith(...quickDisplayElements);
}

function createBattlesQuickDisplay() {
    const slot = Dom.get().byId('battlesQuickTaskDisplay');
    const quickDisplayElements = [];
    for (const battleName in battles) {
        const battle = battles[battleName];
        const quickDisplayElement = Dom.new.fromTemplate('battleQuickTaskDisplayTemplate');
        const componentDomGetter = Dom.get(quickDisplayElement);
        quickDisplayElement.classList.add(battle.name);
        componentDomGetter.byClass('name').textContent = battle.title;

        quickDisplayElements.push(quickDisplayElement);
    }

    slot.replaceWith(...quickDisplayElements);
}

/**
 * @param {AttributeDefinition} attribute
 */
function createAttributeInlineHTML(attribute) {
    return `<span class="attribute" style="color: ${attribute.color}">${attribute.title}</span>`;
}

/**
 *
 * @param {AttributeDefinition} attribute
 * @returns {HTMLElement}
 */
function createAttributeRow(attribute) {
    const dangerRow = Dom.new.fromTemplate('attributeRowTemplate');
    dangerRow.classList.add(attribute.name);
    const dangerDomGetter = Dom.get(dangerRow);
    if (attribute.icon === null) {
        dangerDomGetter.byClass('icon').remove();
    } else {
        dangerDomGetter.byClass('icon').src = attribute.icon;
    }
    let nameElement = dangerDomGetter.byClass('name');
    nameElement.textContent = attribute.title;
    if (attribute.color === null) {
        nameElement.style.removeProperty('color');
    } else {
        nameElement.style.color = attribute.color;
    }
    dangerDomGetter.byClass('description').innerHTML = attribute.description;
    return dangerRow;
}

/**
 *
 * @param {HTMLElement} balanceElement
 * @param {function(EffectType): number} getEffectFn
 * @param {function(): EffectDefinition[]} getEffectsFn
 * @param {EffectType} effectType
 * @param {string} name
 * @param {function():boolean} isActiveFn
 */
function createAttributeBalanceEntry(balanceElement, getEffectFn, getEffectsFn, effectType, name, isActiveFn) {
    const affectsEffectType = getEffectsFn()
        .find((effect) => effect.effectType === effectType) !== undefined;
    if (!affectsEffectType) return;

    const balanceEntryElement = Dom.new.fromTemplate('balanceEntryTemplate');
    const domGetter = Dom.get(balanceEntryElement);
    domGetter.byClass('name').textContent = '(' + name + ')';
    domGetter.byClass('operator').textContent = effectType.operator;
    attributeBalanceEntries.push({
        element: balanceEntryElement,
        effectType: effectType,
        getEffect: getEffectFn,
        getEffects: getEffectsFn,
        isActive: isActiveFn,
    });
    balanceElement.append(balanceEntryElement);
}

/**
 *
 * @param {HTMLElement} rowElement
 * @param {EffectType[]} effectTypes
 */
function createAttributeBalance(rowElement, effectTypes) {
    const balanceElement = Dom.get(rowElement).byClass('balance');
    balanceElement.classList.remove('hidden');

    let onlyMultipliers = effectTypes.every((effectType) => effectType.operator === 'x');

    if (onlyMultipliers) {
        const balanceEntryElement = Dom.new.fromTemplate('balanceEntryTemplate');
        const domGetter = Dom.get(balanceEntryElement);
        domGetter.byClass('operator').textContent = '';
        domGetter.byClass('entryValue').textContent = '1';
        domGetter.byClass('name').textContent = '(Base)';
        balanceElement.append(balanceEntryElement);
    }

    for (const effectType of effectTypes) {
        for (const moduleName in modules) {
            const module = modules[moduleName];
            for (const component of module.components) {
                for (const operation of component.operations) {
                    createAttributeBalanceEntry(
                        balanceElement,
                        operation.getEffect.bind(operation),
                        operation.getEffects.bind(operation),
                        effectType,
                        module.title + ' ' + component.title + ': ' + operation.title,
                        operation.isActive.bind(operation, 'inHierarchy'),
                    );
                }
            }
        }

        for (const key in battles) {
            /** @type {Battle} */
            const battle = battles[key];
            createAttributeBalanceEntry(
                balanceElement,
                battle.getReward.bind(battle),
                () => battle.rewards,
                effectType,
                'Defeated ' + battle.title,
                battle.isDone.bind(battle),
            );
            createAttributeBalanceEntry(
                balanceElement,
                battle.getEffect.bind(battle),
                battle.getEffects.bind(battle),
                effectType,
                'Fighting ' + battle.title,
                () => battle.isActive() && !battle.isDone(),
            );
        }

        for (const key in pointsOfInterest) {
            const pointOfInterest = pointsOfInterest[key];
            createAttributeBalanceEntry(
                balanceElement,
                pointOfInterest.getEffect.bind(pointOfInterest),
                pointOfInterest.getEffects.bind(pointOfInterest),
                effectType,
                'Point of Interest: ' + pointOfInterest.title,
                pointOfInterest.isActive.bind(pointOfInterest),
            );
        }
    }
}

/**
 * @param {HTMLElement} rowElement
 */
function createGridLoadBalance(rowElement) {
    const balanceElement = Dom.get(rowElement).byClass('balance');
    balanceElement.classList.remove('hidden');

    for (const moduleName in modules) {
        const module = modules[moduleName];
        for (const component of module.components) {
            for (const operation of component.operations) {
                if (operation.getGridLoad() === 0) continue;

                const balanceEntryElement = Dom.new.fromTemplate('balanceEntryTemplate');
                const domGetter = Dom.get(balanceEntryElement);
                domGetter.byClass('name').textContent = '(' + module.title + ' ' + component.title + ': ' + operation.title + ')';
                domGetter.byClass('operator').textContent = '+';
                formatValue(domGetter.byClass('entryValue'), operation.getGridLoad());
                gridLoadBalanceEntries.push({
                    element: balanceEntryElement,
                    taskOrItem: operation,
                    isActive: operation.isActive.bind(operation, 'inHierarchy'),
                });
                balanceElement.append(balanceEntryElement);
            }
        }
    }
}

function createAttributesDisplay() {
    const attributeContainers = Dom.get().allBySelector('[data-attribute]');
    for (/** @var {HTMLElement} */ const attributeContainer of attributeContainers) {
        /** @var {AttributeDefinition} */
        const attribute = attributes[attributeContainer.dataset.attribute];
        const domGetter = Dom.get(attributeContainer);
        attributeContainer.dataset.bsTitle = attribute.description;
        const iconElement = domGetter.byClass('icon');
        iconElement.src = attribute.icon;
        iconElement.alt = attribute.title + ' icon';
        const labelElement = domGetter.byClass('label');
        labelElement.style.color = attribute.color;
        labelElement.textContent = attribute.title;
    }
}

function createAttributesUI() {
    const slot = Dom.get().byId('attributeRows');
    const rows = [];

    // Danger
    const dangerRow = createAttributeRow(attributes.danger);
    Dom.get(dangerRow).byClass('balance').classList.remove('hidden');
    createAttributeBalance(dangerRow, [EffectType.Danger]);
    rows.push(dangerRow);

    // Grid Load
    const gridLoadRow = createAttributeRow(attributes.gridLoad);
    Dom.get(gridLoadRow).byClass('balance').classList.remove('hidden');
    createGridLoadBalance(gridLoadRow);
    rows.push(gridLoadRow);

    // Grid Strength
    const gridStrengthRow = createAttributeRow(attributes.gridStrength);
    const gridStrengthFormulaElement = Dom.get(gridStrengthRow).byClass('formula');
    gridStrengthFormulaElement.classList.remove('hidden');
    gridStrengthFormulaElement.innerHTML = '+<data value="0" class="delta">?</data> per cycle';
    rows.push(gridStrengthRow);

    // Growth
    const growthRow = createAttributeRow(attributes.growth);
    Dom.get(growthRow).byClass('balance').classList.remove('hidden');
    createAttributeBalance(growthRow, [EffectType.Growth]);
    rows.push(growthRow);

    // Heat
    const heatRow = createAttributeRow(attributes.heat);
    const heatFormulaElement = Dom.get(heatRow).byClass('formula');
    heatFormulaElement.classList.remove('hidden');
    heatFormulaElement.innerHTML = 'max(' + createAttributeInlineHTML(attributes.danger) + ' - ' + createAttributeInlineHTML(attributes.military) + ', 1)';
    rows.push(heatRow);

    // Industry
    const industryRow = createAttributeRow(attributes.industry);
    Dom.get(industryRow).byClass('balance').classList.remove('hidden');
    createAttributeBalance(industryRow, [EffectType.Industry]);
    rows.push(industryRow);

    // Military
    const militaryRow = createAttributeRow(attributes.military);
    Dom.get(militaryRow).byClass('balance').classList.remove('hidden');
    createAttributeBalance(militaryRow, [EffectType.Military, EffectType.MilitaryFactor]);
    rows.push(militaryRow);

    // Population
    const populationRow = createAttributeRow(attributes.population);
    const populationFormulaElement = Dom.get(populationRow).byClass('formula');
    populationFormulaElement.classList.remove('hidden');
    populationFormulaElement.innerHTML =
        createAttributeInlineHTML(attributes.growth) + ' - ' +
        createAttributeInlineHTML(attributes.population) + ' * 0.01 * ' +
        createAttributeInlineHTML(attributes.heat) + '<br />&wedgeq; <data value="0" class="delta">?</data> per cycle';
    rows.push(populationRow);

    // Research
    const researchRow = createAttributeRow(attributes.research);
    Dom.get(researchRow).byClass('balance').classList.remove('hidden');
    createAttributeBalance(researchRow, [EffectType.Research, EffectType.ResearchFactor]);
    rows.push(researchRow);

    slot.append(...rows);
}

function createEnergyGridDisplay() {
    const tickElementsTop = [];
    const tickElementsBottom = [];
    for (let i = 0; i < (5 * 8 + 1); i++) {
        tickElementsTop.push(Dom.new.fromTemplate('tickTemplate'));
        tickElementsBottom.push(Dom.new.fromTemplate('tickTemplate'));
    }

    Dom.get().byId('ticksTop').replaceWith(...tickElementsTop);
    Dom.get().byId('ticksBottom').replaceWith(...tickElementsBottom);
}

/**
 * Does layout calculations Raoul's too stupid to do in pure CSS.
 */
function adjustLayout() {
    const headerHeight = Dom.outerHeight(Dom.get().byId('stationOverview'));
    Dom.get().byId('contentWrapper').style.maxHeight = `calc(100vh - ${headerHeight}px)`;
}

function cleanUpDom() {
    for (const template of document.querySelectorAll('template')) {
        if (template.classList.contains('keep')) continue;

        template.remove();
    }
}

function updateModulesQuickDisplay() {
    for (const key in modules) {
        const module = modules[key];
        let container = Dom.get().bySelector('.quickTaskDisplayContainer.' + module.name);
        if (!module.isActive()) {
            container.classList.add('hidden');
            continue;
        }

        container.classList.remove('hidden');
        const containerDomGetter = Dom.get(container);
        for (const component of module.components) {
            for (const operation of component.operations) {
                let quickDisplayElement = containerDomGetter.bySelector('.quickTaskDisplay.' + component.name + '.' + operation.name);
                const componentDomGetter = Dom.get(quickDisplayElement);

                if (!operation.isActive('self')) {
                    quickDisplayElement.classList.add('hidden');
                    continue;
                }

                quickDisplayElement.classList.remove('hidden');
                formatValue(
                    componentDomGetter.bySelector('.name > .level'),
                    operation.level,
                    {keepNumber: true},
                );
                setProgress(componentDomGetter.byClass('progressFill'), operation.xp / operation.getMaxXp());
            }
        }
    }
}

/**
 *
 * @param {HTMLElement} progressBar
 * @param {LayeredTask} battle
 */
function setBattleProgress(progressBar, battle) {
    const domGetter = Dom.get(progressBar);
    if (battle.isDone()) {
        domGetter.byClass('progressBackground').style.backgroundColor = lastLayerData.color;
        domGetter.byClass('progressFill').style.width = '0%';
        domGetter.byClass('name').textContent = battle.title + ' defeated!';
        return;
    }

    const progressBarFill = domGetter.byClass('progressFill');
    setProgress(progressBarFill, 1 - (battle.xp / battle.getMaxXp()), false);

    if (!(battle instanceof BossBattle)) {
        return;
    }

    const layerLevel = battle.level % layerData.length;
    progressBarFill.style.backgroundColor = layerData[layerLevel].color;
    if (battle.getDisplayedLevel() === 1) {
        domGetter.byClass('progressBackground').style.backgroundColor = lastLayerData.color;
    } else {
        const nextLayerLevel = (battle.level + 1) % layerData.length;
        domGetter.byClass('progressBackground').style.backgroundColor = layerData[nextLayerLevel].color;
    }
}

function updateBattlesQuickDisplay() {
    for (const battleName in battles) {
        /** @type {Battle} */
        const battle = battles[battleName];
        const quickDisplayElement = Dom.get().bySelector('#battleTabButton .quickTaskDisplay.' + battle.name);
        const componentDomGetter = Dom.get(quickDisplayElement);
        if (battle instanceof BossBattle) {
            if (!isBossBattleAvailable()) {
                quickDisplayElement.classList.add('hidden');
                continue;
            }
        } else if (!battle.isActive()) {
            quickDisplayElement.classList.add('hidden');
            continue;
        }

        quickDisplayElement.classList.remove('hidden');
        componentDomGetter.byClass('progressFill').classList.toggle('current', battle.isActive() && !battle.isDone());
        formatValue(
            componentDomGetter.byClass('level'),
            battle.getDisplayedLevel(),
            {keepNumber: true},
        );
        setBattleProgress(componentDomGetter.byClass('progressBar'), battle);
    }
}

/**
 *
 * @param {HTMLElement} progressFillElement
 * @param {number} progress between 0.0 and 1.0
 * @param {boolean} increasing set to false if it's not a progress bar but a regress bar
 *
 * @return {number} clamped progress value.
 */
function setProgress(progressFillElement, progress, increasing = true) {
    // Clamp value to [0.0, 1.0]
    progress = Math.max(0.0, Math.min(progress, 1.0));
    XFastdom.mutate(() => {
        // Make sure to disable the transition if the progress is being reset
        const previousProgress = parseFloat(progressFillElement.dataset.progress);
        if ((increasing && (previousProgress - progress) >= 0.01) ||
            (!increasing && (progress - previousProgress) >= 0.01)
        ) {
            progressFillElement.style.transitionDuration = '0s';
        } else {
            progressFillElement.style.removeProperty('transition-duration');
        }
        progressFillElement.style.width = (progress * 100) + '%';
    });

    return progress;
}

/**
 * @param {Requirement[]|null} unfulfilledRequirements
 * @param {{
 *     hasUnfulfilledRequirements: boolean,
 *     requirementsElement: HTMLElement,
 *     setHtmlCache: function(string),
 *     getHtmlCache: function(): string,
 * }} context
 * @return {boolean} true if the entity is available, false if not
 */
function updateRequirements(unfulfilledRequirements, context) {
    // Block all following entities
    if (context.hasUnfulfilledRequirements) {
        return false;
    }

    if (unfulfilledRequirements !== null) {
        // Only first requirement is shown
        if (context.hasUnfulfilledRequirements !== true) {
            const html = unfulfilledRequirements
                .map(requirement => requirement.toHtml())
                .join(', ');
            if (html !== context.getHtmlCache()) {
                Dom.get(context.requirementsElement).byClass('rendered').innerHTML = html;
                context.setHtmlCache(html);
            }
            context.hasUnfulfilledRequirements = true;
        }

        return false;
    }

    return true;
}

let moduleCategoryRequirementsHtmlCache = '';

function updateModuleCategoryRows() {
    // noinspection JSUnusedGlobalSymbols
    const requirementsContext = {
        hasUnfulfilledRequirements: false,
        requirementsElement: Dom.get().byId('row_requirements_moduleCategory'),
        setHtmlCache: (newValue) => {
            moduleCategoryRequirementsHtmlCache = newValue;
        },
        getHtmlCache: () => moduleCategoryRequirementsHtmlCache,
    };
    for (const key in moduleCategories) {
        const category = moduleCategories[key];

        const categoryAvailable = updateRequirements(category.getUnfulfilledRequirements(), requirementsContext);
        Dom.get().byId(category.domId).classList.toggle('hidden', !categoryAvailable);
    }

    requirementsContext.requirementsElement.classList.toggle('hidden', !requirementsContext.hasUnfulfilledRequirements);
}

const moduleRequirementsHtmlCache = {};

function updateModuleRows() {
    // We need to iterate on the categories to correctly scope the requirements
    for (const key in moduleCategories) {
        const category = moduleCategories[key];

        // noinspection JSUnusedGlobalSymbols
        const requirementsContext = {
            hasUnfulfilledRequirements: false,
            requirementsElement: Dom.get().byId('row_requirements_category_' + category.name),
            setHtmlCache: (newValue) => {
                moduleRequirementsHtmlCache[category.name] = newValue;
            },
            getHtmlCache: () => {
                if (moduleRequirementsHtmlCache.hasOwnProperty(category.name)) {
                    return moduleRequirementsHtmlCache[category.name];
                }

                return '';
            },
        };

        for (const module of category.modules) {
            const row = document.getElementById(module.domId);

            if (!updateRequirements(module.getUnfulfilledRequirements(), requirementsContext)) {
                row.classList.add('hidden');
                continue;
            }

            row.classList.remove('hidden');
            const isActive = module.isActive();
            row.classList.toggle('inactive', !isActive);

            const domGetter = Dom.get(row);
            const level2Header = domGetter.byClass('level2-header');
            level2Header.classList.toggle('bg-light', isActive);
            level2Header.classList.toggle('text-dark', isActive);
            level2Header.classList.toggle('bg-dark', !isActive);
            level2Header.classList.toggle('text-light', !isActive);

            formatValue(domGetter.byClass('level'), module.getLevel());
            formatValue(domGetter.bySelector('.gridLoad > data'), module.getGridLoad());
        }

        requirementsContext.requirementsElement.classList.toggle('hidden', !requirementsContext.hasUnfulfilledRequirements);
    }
}

const moduleOperationRequirementsHtmlCache = {};

function updateModuleOperationRows() {
    for (const key in moduleComponents) {
        const component = moduleComponents[key];

        // noinspection JSUnusedGlobalSymbols
        const requirementsContext = {
            hasUnfulfilledRequirements: false,
            requirementsElement: Dom.get().byId('row_requirements_component_' + component.name),
            setHtmlCache: (newValue) => {
                moduleOperationRequirementsHtmlCache[component.name] = newValue;
            },
            getHtmlCache: () => {
                if (moduleOperationRequirementsHtmlCache.hasOwnProperty(component.name)) {
                    return moduleOperationRequirementsHtmlCache[component.name];
                }

                return '';
            },
        };

        for (const operation of component.operations) {
            const row = Dom.get().byId(operation.domId);

            if (!updateRequirements(operation.getUnfulfilledRequirements(), requirementsContext)) {
                row.classList.add('hidden');
                continue;
            }
            row.classList.remove('hidden');

            const domGetter = Dom.get(row);
            formatValue(domGetter.bySelector('.level > data'), operation.level, {keepNumber: true});
            formatValue(domGetter.bySelector('.xpGain > data'), operation.getXpGain());
            formatValue(domGetter.bySelector('.xpLeft > data'), operation.getXpLeft());

            let maxLevelElement = domGetter.bySelector('.maxLevel > data');
            formatValue(maxLevelElement, operation.maxLevel, {keepNumber: true});
            maxLevelElement = maxLevelElement.parentElement;
            gameData.rebirthOneCount > 0 ? maxLevelElement.classList.remove('hidden') : maxLevelElement.classList.add('hidden');

            const progressFillElement = domGetter.byClass('progressFill');
            setProgress(progressFillElement, operation.xp / operation.getMaxXp());
            progressFillElement.classList.toggle('current', operation.isActive('self'));

            domGetter.byClass('effect').textContent = operation.getEffectDescription();
        }

        requirementsContext.requirementsElement.classList.toggle('hidden', !requirementsContext.hasUnfulfilledRequirements);
    }
}

let battleRequirementsHtmlCache = '';

function updateBattleRows() {
    // Determine visibility
    const maxBattles = maximumAvailableBattles();
    let visibleBattles = 0;
    const visibleFactions = {};
    const bossRow = Dom.get().byId('row_' + bossBattle.name);

    // noinspection JSUnusedGlobalSymbols
    const requirementsContext = {
        hasUnfulfilledRequirements: false,
        requirementsElement: Dom.get().byId('row_requirements_battle'),
        setHtmlCache: (newValue) => {
            battleRequirementsHtmlCache = newValue;
        },
        getHtmlCache: () => {
            return battleRequirementsHtmlCache;
        },
    };

    for (const key in battles) {
        /** @type {Battle} */
        const battle = battles[key];
        const row = Dom.get().byId('row_' + battle.name);

        if (battle.isDone()) {
            row.classList.add('hidden');
            Dom.get().byId('row_done_' + battle.name).classList.remove('hidden');
            continue;
        }

        const unfulfilledRequirements = [];
        if (visibleBattles >= maxBattles.limit) {
            if (maxBattles.requirement === null) {
                unfulfilledRequirements.push({
                    toHtml: () => {
                        return `Win open battles`;
                    },
                });
            } else {
                unfulfilledRequirements.push(maxBattles.requirement);
            }
        }

        if (visibleFactions.hasOwnProperty(battle.faction.name)) {
            unfulfilledRequirements.push({
                toHtml: () => {
                    return `${battle.faction.name} defeated`;
                },
            });
        }

        if (!(battle instanceof BossBattle)) {
            if (!updateRequirements(
                unfulfilledRequirements.length === 0 ? null : unfulfilledRequirements,
                requirementsContext)
            ) {
                row.classList.add('hidden');
                continue;
            }

            visibleBattles++;
            visibleFactions[battle.faction.name] = true;

            row.classList.remove('hidden');
        }

        const domGetter = Dom.get(row);
        formatValue(domGetter.bySelector('.level > data'), battle.getDisplayedLevel(), {keepNumber: true});
        formatValue(domGetter.bySelector('.xpGain > data'), battle.getXpGain());
        formatValue(domGetter.bySelector('.xpLeft > data'), battle.getXpLeft());

        setBattleProgress(domGetter.byClass('progressBar'), battle);

        const isActive = battle.isActive();
        domGetter.byClass('progressFill').classList.toggle('current', isActive);
        domGetter.byClass('active').style.backgroundColor = isActive ? colorPalette.TomatoRed : colorPalette.White;
        formatValue(domGetter.bySelector('.danger > data'), battle.getEffect(EffectType.Danger));

        if (isBossBattleAvailable() &&
            visibleBattles === bossBattle.distance
        ) {
            if (row.nextElementSibling !== bossRow) { // Do not update the DOM if not necessary
                row.after(bossRow);
            }
        }
    }

    if (isBossBattleAvailable() && !bossBattle.isDone()) {
        bossRow.classList.remove('hidden');
        if (visibleBattles < bossBattle.distance) {
            // There are fewer battles visible than the boss distance --> move boss in last position.
            // Is the bossRow already the last element?
            if (bossRow.nextElementSibling !== null) { // Do not update the DOM if not necessary
                Dom.get()
                    .bySelector('#unfinishedBattles tbody.level4')
                    .append(bossRow);
            }
        } else if (bossBattle.distance === 0) {
            // Boss should be in first position.
            // Is the bossRow already the first element?
            if (bossRow.previousElementSibling !== null) { // Do not update the DOM if not necessary
                Dom.get()
                    .bySelector('#unfinishedBattles tbody.level4')
                    .prepend(bossRow);
            }
        }
    } else {
        bossRow.classList.add('hidden');
    }

    requirementsContext.requirementsElement.classList.toggle('hidden', !requirementsContext.hasUnfulfilledRequirements);
}

let sectorRequirementsHtmlCache = '';
const pointOfInterestRequirementsHtmlCache = {};

function updateSectorRows() {
    // noinspection JSUnusedGlobalSymbols
    const sectorRequirementsContext = {
        hasUnfulfilledRequirements: false,
        requirementsElement: Dom.get().byId('row_requirements_sector'),
        setHtmlCache: (newValue) => {
            sectorRequirementsHtmlCache = newValue;
        },
        getHtmlCache: () => sectorRequirementsHtmlCache,
    };

    for (const key in sectors) {
        const sector = sectors[key];

        const categoryAvailable = updateRequirements(sector.getUnfulfilledRequirements(), sectorRequirementsContext);
        Dom.get().byId(sector.domId).classList.toggle('hidden', !categoryAvailable);

        // noinspection JSUnusedGlobalSymbols
        const requirementsContext = {
            hasUnfulfilledRequirements: false,
            requirementsElement: Dom.get().byId('row_requirements_sector_' + sector.name),
            setHtmlCache: (newValue) => {
                pointOfInterestRequirementsHtmlCache[sector.name] = newValue;
            },
            getHtmlCache: () => {
                if (pointOfInterestRequirementsHtmlCache.hasOwnProperty(sector.name)) {
                    return pointOfInterestRequirementsHtmlCache[sector.name];
                }

                return '';
            },
        };

        for (const pointOfInterest of sector.pointsOfInterest) {
            const row = Dom.get().byId('row_' + pointOfInterest.name);

            if (!updateRequirements(pointOfInterest.getUnfulfilledRequirements(), requirementsContext)) {
                row.classList.add('hidden');
                continue;
            }
            row.classList.remove('hidden');

            const domGetter = Dom.get(row);
            const isActive = pointOfInterest.isActive();
            domGetter.byClass('active').style.backgroundColor = isActive ? 'rgb(12, 101, 173)' : 'white';
            domGetter.byClass('button').classList.toggle('btn-dark', !isActive);
            domGetter.byClass('button').classList.toggle('btn-warning', isActive);
            domGetter.byClass('effect').textContent = pointOfInterest.getEffectDescription();
            formatValue(domGetter.bySelector('.danger > data'), pointOfInterest.getEffect(EffectType.Danger));
        }

        requirementsContext.requirementsElement.classList.toggle('hidden', !requirementsContext.hasUnfulfilledRequirements);
    }

    sectorRequirementsContext.requirementsElement.classList.toggle('hidden', !sectorRequirementsContext.hasUnfulfilledRequirements);
}

function updateHeaderRows() {
    for (const maxLevelElement of document.querySelectorAll('.level3 .maxLevel')) {
        maxLevelElement.classList.toggle('hidden', gameData.rebirthOneCount === 0);
    }
}

function updateAttributeRows() {
    for (const balanceEntry of attributeBalanceEntries) {
        if (balanceEntry.isActive()) {
            formatValue(
                Dom.get(balanceEntry.element).byClass('entryValue'),
                balanceEntry.getEffect(balanceEntry.effectType),
            );
            balanceEntry.element.classList.remove('hidden');
        } else {
            balanceEntry.element.classList.add('hidden');
        }
    }

    for (const balanceEntry of gridLoadBalanceEntries) {
        balanceEntry.element.classList.toggle('hidden', !balanceEntry.isActive());
    }
}

/**
 *
 * @param {number} amount
 * @param {HTMLDataElement} dataElement
 * @param {{prefixes?: string[], unit?: string, forceSign?: boolean}} formatConfig
 */
function formatEnergyValue(amount, dataElement, formatConfig = {}) {
    formatValue(dataElement, amount, Object.assign({
        unit: units.energy,
        prefixes: metricPrefixes,
    }, formatConfig));
}

function updateEnergyGridBar() {
    const energyDisplayElement = Dom.get().byId('energyGridDisplay');
    const domGetter = Dom.get(energyDisplayElement);

    const currentGridLoad = attributes.gridLoad.getValue();
    const currentGridStrength = attributes.gridStrength.getValue();
    const gridLoadElement = domGetter.byClass('gridLoad');
    const gridStrengthElement = domGetter.byClass('gridStrength');
    if (currentGridLoad === 0) {
        gridLoadElement.style.left = '0';
        gridLoadElement.style.removeProperty('translate');
        gridLoadElement.style.removeProperty('right');
    } else if (currentGridLoad === 1) {
        gridLoadElement.style.left = '50%';
        gridLoadElement.style.translate = '-50% 0';
        gridLoadElement.style.removeProperty('right');
    } else {
        // Using right alignment to respect the gridStrength element
        const rightLimit = gridStrengthElement.offsetWidth;
        const relativeGridLoad = 100 * (1 - currentGridLoad / currentGridStrength);
        gridLoadElement.style.right = `max(${relativeGridLoad}%, ${rightLimit}px)`;
        gridLoadElement.style.removeProperty('translate');
        gridLoadElement.style.removeProperty('left');
    }

    formatValue(Dom.get(gridLoadElement).bySelector('data'), currentGridLoad, {keepNumber: true});
    formatValue(Dom.get(gridStrengthElement).bySelector('data'), currentGridStrength, {keepNumber: true});

    const numberOfBoxes = Dom.get().allBySelector('#gridStrength > .grid-strength-box').length;
    if (numberOfBoxes > currentGridStrength) {
        for (let i = 0; i < (numberOfBoxes - currentGridStrength); i++) {
            Dom.get().bySelector('#gridStrength .grid-strength-box').remove();
        }
    } else if (currentGridStrength > numberOfBoxes) {
        for (let i = numberOfBoxes; i < currentGridStrength; i++) {
            const gridStrengthBox = Dom.new.fromTemplate('gridStrengthBoxTemplate');
            Dom.get().byId('gridStrength').append(gridStrengthBox);
        }
    }

    Dom.get().allBySelector('#gridStrength > .grid-strength-box').forEach((gridStrengthBox, index) => {
        gridStrengthBox.classList.toggle('in-use', index < currentGridLoad);
    });

    const energyGeneratedElement = domGetter.byClass('energyGenerated');
    formatEnergyValue(gridStrength.getXpGain(), Dom.get(energyGeneratedElement).bySelector('data'), {forceSign: true});
    const energyLeftElement = domGetter.byClass('energyLeft');
    formatEnergyValue(gridStrength.getXpLeft(), Dom.get(energyLeftElement).bySelector('data'));

    const progressFillElement = domGetter.byClass('progressFill');
    progressFillElement.classList.toggle('current', getGeneratedEnergy() > 0);
    const energyProgress = setProgress(progressFillElement, gridStrength.xp / gridStrength.getMaxXp());

    // Using right alignment to respect the energyLeft element
    const relativeEnergy = 100 * (1 - energyProgress);
    const leftLimit = energyGeneratedElement.offsetWidth + (gameData.settings.sciFiMode ? 30 : 0);
    const rightLimit = energyLeftElement.offsetWidth;
    energyGeneratedElement.style.right = `clamp(${rightLimit}px, ${relativeEnergy}%, calc(100% - ${leftLimit}px))`;
}

function updateHeatDisplay() {
    const mediumHeat = 1000;
    const maxHeat = 8000;

    const heat = attributes.heat.getValue();
    let heatText = (heat).toFixed(0);
    let color;
    if (heat < mediumHeat) {
        color = lerpColor(
            dangerColors[0],
            dangerColors[1],
            heat / mediumHeat,
            'RGB',
        ).toString('rgb');
    } else {
        color = lerpColor(
            dangerColors[1],
            dangerColors[2],
            (heat - mediumHeat) / (maxHeat - mediumHeat),
            'RGB',
        ).toString('rgb');
    }

    const heatElement1 = Dom.get().byId('heatDisplay');
    heatElement1.textContent = heatText;
    heatElement1.style.color = color;

    const heatElement2 = Dom.get().bySelector('#attributeRows > .heat .value');
    heatElement2.textContent = heatText;
    heatElement2.style.color = color;
}

function updateText() {
    //Sidebar
    document.getElementById('cyclesSinceLastEncounter').textContent = Number(getFormattedCycle(gameData.cycles, 0)).toLocaleString('en-US');
    document.getElementById('cyclesTotal').textContent = Number(getFormattedCycle(gameData.totalCycles, baseCycle)).toLocaleString('en-US');
    const pauseButton = document.getElementById('pauseButton');
    if (gameData.state === gameStates.PAUSED) {
        pauseButton.textContent = 'Play';
        pauseButton.classList.replace('btn-secondary', 'btn-primary');
    } else if (gameData.state === gameStates.PLAYING) {
        pauseButton.textContent = 'Pause';
        pauseButton.classList.replace('btn-primary', 'btn-secondary');
    }
    // TODO else???

    const danger = attributes.danger.getValue();
    formatValue(Dom.get().byId('dangerDisplay'), danger);
    formatValue(Dom.get().bySelector('#attributeRows > .danger .value'), danger);

    updateEnergyGridBar();
    formatValue(Dom.get().bySelector('#attributeRows > .gridLoad .value'), attributes.gridLoad.getValue());
    formatValue(Dom.get().bySelector('#attributeRows > .gridStrength .value'), attributes.gridStrength.getValue());
    formatValue(Dom.get().bySelector('#attributeRows > .gridStrength .delta'), gridStrength.getDelta());

    const growth = attributes.growth.getValue();
    formatValue(Dom.get().byId('growthDisplay'), growth);
    formatValue(Dom.get().bySelector('#attributeRows > .growth .value'), growth);

    updateHeatDisplay();

    const industry = attributes.industry.getValue();
    formatValue(Dom.get().byId('industryDisplay'), industry);
    formatValue(Dom.get().bySelector('#attributeRows > .industry .value'), industry);

    const military = attributes.military.getValue();
    formatValue(Dom.get().byId('militaryDisplay'), military);
    formatValue(Dom.get().bySelector('#attributeRows > .military .value'), military);

    const population = attributes.population.getValue();
    formatValue(Dom.get().byId('populationDisplay'), population, {forceInteger: true});
    formatValue(Dom.get().byId('populationProgressSpeedDisplay'), getPopulationProgressSpeedMultiplier(), {});
    formatValue(Dom.get().bySelector('#attributeRows > .population .value'), population, {forceInteger: true});
    formatValue(Dom.get().bySelector('#attributeRows > .population .delta'), populationDelta(), {forceSign: true});

    const research = attributes.research.getValue();
    formatValue(Dom.get().byId('researchDisplay'), research);
    formatValue(Dom.get().bySelector('#attributeRows > .research .value'), research);
}

function updateHtmlElementRequirements() {
    for (const htmlElementWithRequirement of elementRequirements) {
        const completed = htmlElementWithRequirement.isCompleted();
        for (const element of htmlElementWithRequirement.elementsWithRequirements) {
            element.classList.toggle('hidden', !completed);
        }
        for (const element of htmlElementWithRequirement.elementsToShowRequirements) {
            element.classList.toggle('hidden', completed);
        }
    }
}

function updateBodyClasses() {
    document.getElementById('body').classList.toggle('game-paused', gameData.state === gameStates.PAUSED);
    document.getElementById('body').classList.toggle('game-playing', gameData.state === gameStates.PLAYING);
}

function doTasks() {
    for (const key of gameData.activeEntities.operations) {
        const operation = moduleOperations[key];
        if (!operation.isActive('parent')) continue;
        operation.do();
    }

    for (const battleName of gameData.activeEntities.battles) {
        const battle = battles[battleName];
        if (battle.isDone()) {
            if (gameData.selectedTab === 'battles') {
                // Quality of life - a battle is done and the player is already on the battles tab
                // or visited it first after the battle was completed --> deactivate battle
                battle.stop();
                // TODO VFX should not be called, but triggered via Event
                VFX.flash(Dom.get().bySelector('#row_done_' + battle.name + ' .progressBar'));
            }

            continue;
        }

        battle.do();
        if (gameData.state === gameStates.PLAYING &&
            isBossBattleAvailable() &&
            battle.isDone()
        ) {
            bossBattle.decrementDistance();
        }
    }

    gridStrength.do();
}

function getGeneratedEnergy() {
    return Effect.getTotalValue([EffectType.Energy, EffectType.EnergyFactor]);
}

function calculateGridLoad() {
    let gridLoad = 0;

    for (const key of gameData.activeEntities.operations) {
        const operation = moduleOperations[key];
        if (!operation.isActive('parent')) continue;

        gridLoad += operation.getGridLoad();
    }

    return gridLoad;
}

function getFormattedCycle(ticks, base) {
    const decimalPlaces = 0;
    const incrementPerTick = 1;

    const totalCycle = base + incrementPerTick * ticks;
    const roundedCycle = totalCycle.toFixed(decimalPlaces);
    
    return roundedCycle;
}

function formatValueWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function increaseDate() {
    if (!gameData.state.isTimeProgressing) return;

    const increase = applySpeed(1);
    gameData.cycles += increase;
    gameData.totalCycles += increase;

    if (!isBossBattleAvailable() && gameData.cycles >= getLifespan()) {
        gameData.bossBattleAvailable = true;
        gameData.transitionState(gameStates.PAUSED);
        GameEvents.BossAppearance.trigger(undefined);
    }
}

function updateBossDistance() {
    if (gameData.state !== gameStates.PLAYING) return;
    if (!isBossBattleAvailable()) return;

    // How much time has past since the boss' arrival?
    const overtime = gameData.cycles - getLifespan();
    // Translate the elapsed time into distance according to config
    bossBattle.coveredDistance = Math.floor(overtime / bossBattleApproachInterval);
}

/**
 *
 * @param {HTMLDataElement} dataElement
 * @param {number} value
 * @param {{prefixes?: string[], unit?: string, forceSign?: boolean, keepNumber?: boolean, forceInteger?: boolean, toLocale?: string}} config
 */
function formatValue(dataElement, value, config = {}) {
    // TODO render full number + unit into dataElement.title
    dataElement.value = String(value);

    const defaultConfig = {
        prefixes: magnitudes,
        unit: '',
        forceSign: false,
        keepNumber: false,
        forceInteger: false,
        toLocale: '',
    };
    config = Object.assign({}, defaultConfig, config);

    const toString = (value) => {
        if (config.hasOwnProperty('toLocale') && config.toLocale !== '') {
            return Number(value).toLocaleString(toLocale);
        }
        if (config.forceInteger || Number.isInteger(value)) {
            return value.toFixed(0);
        } else if (Math.abs(value) < 1) {
            return value.toFixed(2);
        } else {
            return value.toPrecision(3);
        }
    };

    // what tier? (determines SI symbol)
    const tier = Math.max(0, Math.log10(Math.abs(value)) / 3 | 0);

    let prefix = '';
    if (config.forceSign) {
        if (Math.abs(value) <= 0.001) {
            prefix = '±';
        } else if (value > 0) {
            prefix = '+';
        }
    }

    if (config.keepNumber) {
        dataElement.textContent = prefix + value;
        delete dataElement.dataset.unit;
        return;
    }

    // get suffix and determine scale
    let suffix = config.prefixes[tier];
    if (typeof config.unit === 'string' && config.unit.length > 0) {
        dataElement.dataset.unit = suffix + config.unit;
    } else if (suffix.length > 0) {
        dataElement.dataset.unit = suffix;
    } else {
        delete dataElement.dataset.unit;
    }

    if (tier === 0) {
        dataElement.textContent = prefix + toString(value);
        return;
    }
    const scale = Math.pow(10, tier * 3);

    // scale the number
    const scaled = value / scale;

    // format number and add suffix
    dataElement.textContent = prefix + toString(scaled);
}

function getModuleOperationElement(operationName) {
    if (!moduleOperations.hasOwnProperty(operationName)) {
        console.log('ModuleOperation not found in data: ' + operationName);
        return null;
    }
    const task = moduleOperations[operationName];
    return document.getElementById(task.domId);
}

function getBattleElement(taskName) {
    if (!battles.hasOwnProperty(taskName)) {
        console.log('Battle not found in data: ' + taskName);
        return;
    }
    const battle = battles[taskName];
    if (battle instanceof BossBattle) {
        return document.getElementById(battle.progressBarId);
    }

    return Dom.get().byId('row_' + battle.name);
}

function getPointOfInterestElement(name) {
    if (!pointsOfInterest.hasOwnProperty(name)) {
        console.log('Point of Interest not found in data: ' + name);
        return null;
    }

    const pointOfInterest = pointsOfInterest[name];
    return document.getElementById(pointOfInterest.domId);
}

/**
 * @param {boolean} force
 */
function toggleVfxFollowProgressBars(force = undefined) {
    if (force === undefined) {
        gameData.settings.vfx.followProgressBars = !gameData.settings.vfx.followProgressBars;
    } else {
        gameData.settings.vfx.followProgressBars = force;
    }
    VFX.followProgressBars(gameData.settings.vfx.followProgressBars);
    gameData.save();
}

/**
 * @param {boolean} force
 */
function toggleLightDarkMode(force = undefined) {
    if (force === undefined) {
        gameData.settings.darkMode = !gameData.settings.darkMode;
    } else {
        gameData.settings.darkMode = force;
    }
    document.documentElement.dataset['bsTheme'] = gameData.settings.darkMode ? 'dark' : 'light';
    gameData.save();
}

/**
 * @param {boolean} force
 */
function toggleSciFiMode(force = undefined) {
    const body = document.getElementById('body');
    gameData.settings.sciFiMode = body.classList.toggle('sci-fi', force);
    gameData.save();
}

function setBackground(background) {
    const body = document.getElementById('body');
    body.classList.forEach((cssClass, index, classList) => {
        if (cssClass.startsWith('background-')) {
            classList.remove(cssClass);
        }
    });

    body.classList.add('background-' + background);
    document.querySelector(`.background-${background} > input[type="radio"]`).checked = true;
    gameData.settings.background = background;
    gameData.save();
}

function resetBattle(name) {
    const battle = battles[name];
    battle.level = 0;
    battle.xp = 0;
}

function startNewPlaythrough() {
    gameData.rebirthOneCount += 1;
    playthroughReset('UPDATE_MAX_LEVEL');
}

// function rebirthTwo() {
//     gameData.rebirthTwoCount += 1;
//     playthroughReset('RESET_MAX_LEVEL');
// }

/**
 * @param {MaxLevelBehavior} maxLevelBehavior
 */
function playthroughReset(maxLevelBehavior) {
    gameData.initValues();
    gameData.resetCurrentValues();

    for (const key in moduleOperations) {
        const operation = moduleOperations[key];
        operation.reset(maxLevelBehavior);
    }

    gridStrength.reset(maxLevelBehavior);

    for (const key in battles) {
        const battle = battles[key];
        battle.reset(maxLevelBehavior);
    }

    for (const key in moduleComponents) {
        const component = moduleComponents[key];
        component.reset(maxLevelBehavior);
    }

    for (const key in modules) {
        const module = modules[key];
        module.reset(maxLevelBehavior);
    }

    for (const key in moduleCategories) {
        const category = moduleCategories[key];
        category.reset(maxLevelBehavior);
    }

    for (const key in sectors) {
        const sector = sectors[key];
        sector.reset(maxLevelBehavior);
    }

    for (const key in pointsOfInterest) {
        const pointOfInterest = pointsOfInterest[key];
        pointOfInterest.reset(maxLevelBehavior);
    }

    for (const elementRequirement of elementRequirements) {
        elementRequirement.reset();
    }

    setTab('modules');
    gameData.transitionState(gameStates.NEW);
}

function getLifespan() {
    //Lifespan not defined in station design, if years are not reset this will break the game
    //const immortality = gameData.taskData['Immortality'];
    //const superImmortality = gameData.taskData['Super immortality'];
    //return bossCycle * immortality.getEffect() * superImmortality.getEffect();
    return bossCycle;
}

function isBossBattleAvailable() {
    return gameData.bossBattleAvailable;
}

function updateUI() {
    if (document.hidden) {
        // Tab is currently not active - no need to update the UI
        return;
    }

    updateModuleCategoryRows();
    updateModuleRows();
    updateModuleOperationRows();

    updateBattleRows();
    updateSectorRows();

    updateHeaderRows();
    updateModulesQuickDisplay();
    updateBattlesQuickDisplay();
    updateAttributeRows();

    updateHtmlElementRequirements();

    updateText();
    updateBodyClasses();
}

function update() {
    increaseDate();
    updateBossDistance();
    doTasks();
    updatePopulation();
    updateUI();
}

function rerollStationName() {
    setStationName(stationNameGenerator.generate());
}

const visibleTooltips = [];

function initTooltips() {
    const tooltipTriggerElements = document.querySelectorAll('[title], [data-bs-title]');
    const tooltipConfig = {container: 'body', trigger: 'hover', sanitize: false};
    for (const tooltipTriggerElement of tooltipTriggerElements) {
        // noinspection JSUnresolvedReference
        new bootstrap.Tooltip(tooltipTriggerElement, tooltipConfig);
        tooltipTriggerElement.addEventListener('show.bs.tooltip', () => {
            visibleTooltips.push(tooltipTriggerElement);
        });
        tooltipTriggerElement.addEventListener('hide.bs.tooltip', () => {
            let indexOf = visibleTooltips.indexOf(tooltipTriggerElement);
            if (indexOf !== -1) {
                visibleTooltips.splice(indexOf);
            }
        });
    }
}

/**
 * @param {string} newStationName
 */
function setStationName(newStationName) {
    if (newStationName) {
        gameData.stationName = newStationName;
    } else {
        gameData.stationName = emptyStationName;
    }
    Dom.get().byId('nameDisplay').textContent = gameData.stationName;
    for (const stationNameInput of Dom.get().allByClass('stationNameInput')) {
        stationNameInput.value = newStationName;
    }
    // saveGameData();
}

function initStationName() {
    setStationName(gameData.stationName);
    const stationNameDisplayElement = document.getElementById('nameDisplay');
    stationNameDisplayElement.addEventListener('click', (event) => {
        event.preventDefault();

        setTab('settings');
        /** @var {HTMLInputElement} */
        const settingsStationNameInput = Dom.get().byId('settingsStationNameInput');
        settingsStationNameInput.focus();
        settingsStationNameInput.select();
    });
    for (const stationNameInput of Dom.get().allByClass('stationNameInput')) {
        stationNameInput.placeholder = emptyStationName;
        stationNameInput.addEventListener('input', (event) => {
            setStationName(event.target.value);
        });
    }
}

function initSettings() {
    const background = gameData.settings.background;
    if (isString(background)) {
        setBackground(background);
    }

    if (isBoolean(gameData.settings.darkMode)) {
        toggleLightDarkMode(gameData.settings.darkMode);
    }
    if (isBoolean(gameData.settings.sciFiMode)) {
        toggleSciFiMode(gameData.settings.sciFiMode);
    }
    // gameData.settings.vfx.followProgressBars is applied in the VFX module itself - we just need to adjust the UI
    Dom.get().byId('vfxProgressBarFollowSwitch').checked = gameData.settings.vfx.followProgressBars;
}

function displayLoaded() {
    document.getElementById('main').classList.add('ready');
}

function assignNames(data) {
    for (const [key, val] of Object.entries(data)) {
        val.name = key;
    }
}

function initConfigNames() {
    assignNames(gameStates);
    gridStrength.name = 'gridStrength';
    assignNames(attributes);
    assignNames(moduleCategories);
    assignNames(modules);
    assignNames(moduleComponents);
    assignNames(moduleOperations);
    assignNames(factions);
    assignNames(battles);
    assignNames(pointsOfInterest);
    assignNames(sectors);
}

function init() {
    initConfigNames();

    gameData = new GameData();
    /*
     * During the setup a lot of functions are called that trigger an auto save.
     * To not save various times, saving is skipped until the game is actually
     * under player control.
     */
    gameData.skipSave = true;

    gameData.tryLoading();

    createModulesUI(moduleCategories, 'modulesTable');
    createSectorsUI(sectors, 'sectorTable');
    createBattlesUI(battles, 'battlesTable');
    createModulesQuickDisplay();
    createBattlesQuickDisplay();

    adjustLayout();

    createAttributeDescriptions(createAttributeInlineHTML);
    createAttributesDisplay();
    createAttributesUI();
    createEnergyGridDisplay();

    //setCustomEffects();

    if (tabButtons.hasOwnProperty(gameData.selectedTab)) {
        setTab(gameData.selectedTab);
    } else {
        setTab('modules');
    }
    initTooltips();
    initStationName();
    initSettings();

    cleanUpDom();

    gameData.skipSave = false;
    displayLoaded();

    update();
    setInterval(update, 1000 / updateSpeed);
    setInterval(gameData.save.bind(gameData), 3000);
}

init();
