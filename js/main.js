'use strict';

// Not a const as it can be overridden when loading a save game
let gameData = {
    taskData: {},
    itemData: {},
    battleData: {},

    storedEnergy: 0,
    evil: 0,
    paused: true,
    timeWarpingEnabled: true,
    autoLearnEnabled: false,
    autoPromoteEnabled: false,

    days: 365 * 14,
    rebirthOneCount: 0,
    rebirthTwoCount: 0,
    totalDays: 365 * 14,

    currentJob: null,
    currentSkill: null,
    currentProperty: null,
    currentMisc: null,
    currentBattle: null,

    stationName: stationNameGenerator.generate(),
    selectedTab: 'jobs',
    settings: {
        darkMode: true,
        sciFiMode: true,
        background: 'space',
    }
};

const tempData = {};

let skillWithLowestMaxXp = null;

const autoPromoteElement = document.getElementById('autoPromote');
const autoLearnElement = document.getElementById('autoLearn');

const tabButtons = {
    'jobs': document.getElementById('jobsTabButton'),
    'skills': document.getElementById('skillsTabButton'),
    'shop': document.getElementById('shopTabButton'),
    'rebirth': document.getElementById('rebirthTabButton'),
    'settings': document.getElementById('settingsTabButton'),
}
const gameOverMessageWinElement = document.getElementById('gameOverMessageWin');
const gameOverMessageLoseElement = document.getElementById('gameOverMessageLose');

function getBaseLog(x, y) {
    return Math.log(y) / Math.log(x);
}

function getBoundTaskEffect(taskName) {
    const task = gameData.taskData[taskName];
    return task.getEffect.bind(task);
}

function getBoundItemEffect(itemName) {
    const item = gameData.itemData[itemName];
    return item.getEffect.bind(item);
}

function getEvil() {
    return gameData.evil;
}

function applyMultipliers(value, multipliers) {
    let finalMultiplier = 1;
    multipliers.forEach(function (multiplierFunction) {
        const multiplier = multiplierFunction();
        finalMultiplier *= multiplier;
    });
    return Math.round(value * finalMultiplier);
}

function applySpeed(value) {
    return value * getGameSpeed() / updateSpeed;
}

function getEvilGain() {
    const evilControl = gameData.taskData['Evil control'];
    const bloodMeditation = gameData.taskData['Blood meditation'];
    return evilControl.getEffect() * bloodMeditation.getEffect();
}

function getGameSpeed() {
    const timeWarping = gameData.taskData['Time warping'];
    const timeWarpingSpeed = gameData.timeWarpingEnabled ? timeWarping.getEffect() : 1;
    return baseGameSpeed * +isPlaying() * timeWarpingSpeed;
}

function getDangerLevel() {
    // TODO use game designed value - right now this is just the age/lifespan
    return gameData.days / getLifespan();
}

function applyEnergyUsage() {
    const usage = applySpeed(getEnergyUsage());
    gameData.storedEnergy -= usage;
    if (gameData.storedEnergy < 0) {
        goBlackout();
    }
}

function getEnergyUsage() {
    let energyUsage = 0;
    energyUsage += gameData.currentProperty.getEnergyUsage();
    for (let misc of gameData.currentMisc) {
        energyUsage += misc.getEnergyUsage();
    }
    return energyUsage;
}

function goBlackout() {
    gameData.storedEnergy = 0;
    gameData.currentProperty = gameData.itemData['Homeless'];
    gameData.currentMisc = [];
}

function hideAllTooltips() {
    visibleTooltips.forEach(function (tooltipTriggerElement) {
        bootstrap.Tooltip.getInstance(tooltipTriggerElement).hide();
    });
}

function setTab(element, selectedTab) {
    const tabs = Array.prototype.slice.call(document.getElementsByClassName('tab'));
    tabs.forEach(function (tab) {
        tab.style.display = 'none';
    });
    document.getElementById(selectedTab).style.display = 'block';

    const tabButtons = document.getElementsByClassName('tabButton');
    for (let tabButton of tabButtons) {
        tabButton.classList.remove('active');
    }
    element.classList.add('active');
    gameData.selectedTab = selectedTab;

    hideAllTooltips();
}

// noinspection JSUnusedGlobalSymbols used in HTML
function setPause() {
    gameData.paused = !gameData.paused;
}

function unpause(){
    gameData.paused = false;
}

// noinspection JSUnusedGlobalSymbols used in HTML
function setTimeWarping() {
    gameData.timeWarpingEnabled = !gameData.timeWarpingEnabled;
}

function setTask(taskName) {
    if (!isPlaying()) return;

    const task = gameData.taskData[taskName];
    if (task instanceof Job) {
        gameData.currentJob = task;
    } else {
        gameData.currentSkill = task;
    }
}

function setProperty(propertyName) {
    if (!isPlaying()) return;

    gameData.currentProperty = gameData.itemData[propertyName];
}

function setMisc(miscName) {
    if (!isPlaying()) return;

    const misc = gameData.itemData[miscName];
    if (gameData.currentMisc.includes(misc)) {
        for (let i = 0; i < gameData.currentMisc.length; i++) {
            if (gameData.currentMisc[i] === misc) {
                gameData.currentMisc.splice(i, 1);
            }
        }
    } else {
        gameData.currentMisc.push(misc);
    }
}

function setBattle(name) {
    gameData.currentBattle = gameData.battleData[name];
    const nameTitle = document.getElementById('battleName');
    nameTitle.textContent = gameData.currentBattle.name;
}

function createData(data, baseData) {
    for (let key in baseData) {
        const entity = baseData[key];
        createEntity(data, entity);
    }
}

function createEntity(data, entity) {
    if ('maxLayers' in entity) {
        const battle = new Battle(entity);
        battle.init();
        data[entity.name] = battle;
    } else if ('energyGeneration' in entity) {
        data[entity.name] = new Job(entity);
    } else if ('maxXp' in entity) {
        data[entity.name] = new Skill(entity);
    } else {
        data[entity.name] = new Item(entity);
    }
    // TODO get rid of whitespace ids
    data[entity.name].id = 'row ' + entity.name;
}

function createRequiredRow(categoryName) {
    const requiredRow = Dom.new.fromTemplate('level4RequiredTemplate');
    requiredRow.classList.add('requiredRow', removeSpaces(categoryName));
    requiredRow.id = categoryName;
    return requiredRow;
}

/**
 *
 * @param categoryDefinition
 * @param {string} domId
 */
function createAllRows(categoryDefinition, domId) {
    const slot = Dom.get().byId(domId);

    const level1Elements = [];
    for (let categoryName in categoryDefinition) {
        const level1Element = Dom.new.fromTemplate('level1Template');
        level1Elements.push(level1Element);

        level1Element.classList.add(removeSpaces(categoryName));
        const level1DomGetter = Dom.get(level1Element);
        level1DomGetter.byClass('category').textContent = categoryName;
        level1DomGetter.byClass('value').textContent = '';
        level1DomGetter.byClass('level1-header')
            .style.backgroundColor = headerRowColors[categoryName];

        const level2Slot = level1DomGetter.byId('level2');
        const level2Element = Dom.new.fromTemplate('level2Template');
        const level2DomGetter = Dom.get(level2Element);
        level2DomGetter.byClass('name').textContent = 'Module name';
        level2DomGetter.byClass('level').textContent = '0';
        level2Slot.replaceWith(level2Element);

        const level3Slot = level2DomGetter.byId('level3');
        let level3Element;
        if (domId === 'itemTable') {
            level3Element = Dom.new.fromTemplate('level3ItemTemplate');
        } else {
            level3Element = Dom.new.fromTemplate('level3TaskTemplate');
        }
        const level3DomGetter = Dom.get(level3Element);
        level3DomGetter.byClass('name').textContent = 'Component name';
        if (domId === 'jobTable') {
            level3DomGetter.byClass('valueType').textContent = 'Generated/cycle';
        } else if (domId === 'skillTable') {
            level3DomGetter.byClass('valueType').textContent = 'Effect';
        }
        level3Slot.replaceWith(level3Element);

        /** @type {HTMLElement} */
        const level4Slot = level3DomGetter.byClass('level4');
        const level4Elements = [];
        const category = categoryDefinition[categoryName];
        category.forEach(function (name) {
            let level4Element;
            if (domId === 'itemTable') {
                level4Element = Dom.new.fromTemplate('level4ItemTemplate');
            } else {
                level4Element = Dom.new.fromTemplate('level4TaskTemplate');
            }
            const level4DomGetter = Dom.get(level4Element);
            level4DomGetter.byClass('name').textContent = name;
            let descriptionElement = level4DomGetter.byClass('descriptionTooltip');
            descriptionElement.ariaLabel = name;
            descriptionElement.title = tooltips[name];
            level4Element.id = 'row ' + name;
            if (domId === 'itemTable') {
                if (categoryName === 'Properties') {
                    level4DomGetter.byClass('button').onclick = function () {
                        setProperty(name);
                    };
                    level4DomGetter.byClass('radio').onclick = function () {
                        setProperty(name);
                    };
                } else {
                    level4DomGetter.byClass('button').onclick = function () {
                        setMisc(name);
                    };
                    level4DomGetter.byClass('radio').onclick = function () {
                        setMisc(name);
                    };
                }
            } else {
                level4DomGetter.byClass('progressBar').onclick = function () {
                    setTask(name);
                };
            }

            level4Elements.push(level4Element);
        });

        level4Elements.push(createRequiredRow(categoryName));

        level4Slot.append(...level4Elements);
    }

    slot.replaceWith(...level1Elements);
}

function cleanUpDom() {
    document.querySelectorAll('template').forEach(function (template) {
        template.remove();
    });
}

function initSidebar() {
    const energyDisplayElement = document.querySelector('#energyDisplay');
    energyDisplayElement.addEventListener('click', function () {
        energyDisplayElement.classList.toggle('detailed');
    });
}

function updateQuickTaskDisplay(taskType) {
    const currentTask = taskType === 'job' ? gameData.currentJob : gameData.currentSkill;
    const progressBar = document.querySelector(`.quickTaskDisplay .${taskType}`);
    progressBar.getElementsByClassName('name')[0].textContent = currentTask.name + ' lvl ' + currentTask.level;
    setProgress(progressBar.getElementsByClassName('progressFill')[0], currentTask.xp / currentTask.getMaxXp());
}

function updateBattleTaskDisplay() {
    const currentTask = gameData.currentBattle;
    if (currentTask === null || currentTask.isDone()) {
        return;
    }
    const progressBar = document.getElementById('battleProgressBar');
    const battleNameElement = document.getElementById('battleName');
    battleNameElement.textContent = currentTask.name;
    progressBar.getElementsByClassName('name')[0].textContent = currentTask.name + ' layer ' + (currentTask.maxLayers - currentTask.level);
    setProgress(progressBar.getElementsByClassName('progressFill')[0], 1 - (currentTask.xp / currentTask.getMaxXp()));
}

/**
 *
 * @param {HTMLElement} progressFillElement
 * @param {number} progress between 0.0 and 1.0
 * @param {boolean} increasing set to false if its not a progress bar but a regress bar
 */
function setProgress(progressFillElement, progress, increasing = true) {
    // Clamp value to [0.0, 1.0]
    progress = Math.max(0.0, Math.min(progress, 1.0));
    // Make sure to disable the transition if the progress is being reset
    const previousProgress = parseFloat(progressFillElement.dataset.progress);
    if ((increasing && (previousProgress - progress) >= 0.01) ||
        (!increasing && (previousProgress - progress) >= 0.01)
    ) {
        progressFillElement.style.transitionDuration = '0s';
    } else {
        progressFillElement.style.removeProperty('transition-duration');
    }
    progressFillElement.dataset.progress = String(progress);
    progressFillElement.style.width = (progress * 100) + '%';
    let parentElement = progressFillElement.closest('.progress');
    if (parentElement !== null) {
        parentElement.ariaValueNow = (progress * 100).toFixed(1);
    }
}

function updateRequiredRows(data, categoryType) {
    const requiredRows = document.getElementsByClassName('requiredRow');
    for (let requiredRow of requiredRows) {
        let nextEntity = null;
        const category = categoryType[requiredRow.id];
        if (category == null) {
            continue;
        }
        for (let i = 0; i < category.length; i++) {
            const entityName = category[i];
            if (i >= category.length - 1) break;
            let requirements = gameData.requirements[entityName];
            if (requirements && i === 0) {
                if (!requirements.isCompleted()) {
                    nextEntity = data[entityName];
                    break;
                }
            }

            const nextIndex = i + 1;
            if (nextIndex >= category.length) {
                break;
            }
            const nextEntityName = category[nextIndex];
            let nextEntityRequirements = gameData.requirements[nextEntityName];

            if (!nextEntityRequirements.isCompleted()) {
                nextEntity = data[nextEntityName];
                break;
            }
        }

        if (nextEntity == null) {
            requiredRow.classList.add('hiddenTask');
        } else {
            requiredRow.classList.remove('hiddenTask');
            const requirementObject = gameData.requirements[nextEntity.name];
            let requirements = requirementObject.requirements;

            const energyStoredElement = requiredRow.getElementsByClassName('energy-stored')[0];
            const levelElement = requiredRow.getElementsByClassName('levels')[0];
            const evilElement = requiredRow.getElementsByClassName('evil')[0];


            let finalText = [];
            if (data === gameData.taskData) {
                energyStoredElement.classList.add('hiddenTask');
                if (requirementObject instanceof EvilRequirement) {
                    levelElement.classList.add('hiddenTask');
                    evilElement.classList.remove('hiddenTask');
                    formatValue(evilElement, requirements[0].requirement, {unit: 'evil'});
                } else {
                    evilElement.classList.add('hiddenTask');
                    levelElement.classList.remove('hiddenTask');
                    for (let requirement of requirements) {
                        const task = gameData.taskData[requirement.task];
                        if (task.level >= requirement.requirement) continue;
                        const text = requirement.task + ' level ' +
                            '<data value="' + task.level + '">' + task.level + '</data>' + '/' +
                            '<data value="' + requirement.requirement + '">' + requirement.requirement + '</data>';
                        finalText.push(text);
                    }
                    levelElement.innerHTML = finalText.join(', ');
                }
            } else if (data === gameData.itemData) {
                evilElement.classList.add('hiddenTask');
                levelElement.classList.add('hiddenTask');
                energyStoredElement.classList.remove('hiddenTask');
                updateEnergyDisplay(
                    requirements[0].requirement,
                    energyStoredElement.getElementsByTagName('data')[0],
                    {unit: units.storedEnergy}
                );
            }
        }
    }
}

function updateTaskRows() {
    for (let key in gameData.taskData) {
        const task = gameData.taskData[key];
        const row = document.getElementById('row ' + task.name);
        formatValue(row.querySelector('.level > data'), task.level, {keepNumber: true});
        formatValue(row.querySelector('.xpGain > data'), task.getXpGain());
        formatValue(row.querySelector('.xpLeft > data'), task.getXpLeft());

        let maxLevel = row.querySelector('.maxLevel > data');
        formatValue(maxLevel, task.maxLevel, {keepNumber: true});
        maxLevel = maxLevel.parentElement;
        gameData.rebirthOneCount > 0 ? maxLevel.classList.remove('hidden') : maxLevel.classList.add('hidden');

        const progressFill = row.getElementsByClassName('progressFill')[0];
        setProgress(progressFill, task.xp / task.getMaxXp());
        if (task === gameData.currentJob || task === gameData.currentSkill) {
            progressFill.classList.add('current');
        } else {
            progressFill.classList.remove('current');
        }

        const valueElement = row.getElementsByClassName('value')[0];
        valueElement.getElementsByClassName('energy-generated')[0].style.display = task instanceof Job ? 'block' : 'none';
        valueElement.getElementsByClassName('effect')[0].style.display = task instanceof Skill ? 'block' : 'none';

        const skipSkillElement = row.getElementsByClassName('skipSkill')[0];
        if (task instanceof Skill && autoLearnElement.checked) {
            skipSkillElement.style.removeProperty('display');
        } else {
            skipSkillElement.style.display = 'none';
        }

        if (task instanceof Job) {
            updateEnergyDisplay(task.getEnergyGeneration(), valueElement.querySelector('.energy-generated > data'));
        } else {
            valueElement.getElementsByClassName('effect')[0].textContent = task.getEffectDescription();
        }
    }
}

function updateItemRows() {
    for (let key in gameData.itemData) {
        const item = gameData.itemData[key];
        const row = document.getElementById('row ' + item.name);
        const button = row.getElementsByClassName('button')[0];
        button.disabled = gameData.storedEnergy < item.getEnergyUsage();
        const active = row.getElementsByClassName('active')[0];
        const color = itemCategories['Properties'].includes(item.name) ? headerRowColors['Properties'] : headerRowColors['Misc'];
        active.style.backgroundColor = gameData.currentMisc.includes(item) || item === gameData.currentProperty ? color : 'white';
        row.getElementsByClassName('effect')[0].textContent = item.getEffectDescription();
        updateEnergyDisplay(item.getEnergyUsage(), row.querySelector('.energy-usage > data'));
    }
}

function updateHeaderRows(categories) {
    for (let categoryName in categories) {
        const className = removeSpaces(categoryName);
        const headerRow = document.getElementsByClassName(className)[0];
        const maxLevelElement = headerRow.getElementsByClassName('maxLevel')[0];
        gameData.rebirthOneCount > 0 ? maxLevelElement.classList.remove('hidden') : maxLevelElement.classList.add('hidden');
        const skipSkillElement = headerRow.getElementsByClassName('skipSkill')[0];
        if (categories === skillCategories && autoLearnElement.checked) {
            skipSkillElement.style.removeProperty('display');
        } else {
            skipSkillElement.style.display = 'none';
        }
    }
}

function updateEnergyBar() {
    const energyDisplayElement = document.getElementById('energyDisplay');
    updateEnergyDisplay(getEnergyGeneration(), energyDisplayElement.querySelector('.energy-generated > data'));
    updateEnergyDisplay(getNet(), energyDisplayElement.querySelector('.energy-net > data'), {forceSign: true});
    updateEnergyDisplay(gameData.storedEnergy, energyDisplayElement.querySelector('.energy-stored > data'), {unit: units.storedEnergy});
    updateEnergyDisplay(getMaxEnergy(), energyDisplayElement.querySelector('.energy-max > data'), {unit: units.storedEnergy});
    updateEnergyDisplay(getEnergyUsage(), energyDisplayElement.querySelector('.energy-usage > data'));
    setProgress(energyDisplayElement.querySelector('.energy-fill'), gameData.storedEnergy / getMaxEnergy());
}

function updateDangerDisplay() {
    const dangerLevel = getDangerLevel();
    const dangerLevelElement = document.getElementById('dangerLevel');
    dangerLevelElement.textContent = (dangerLevel * 100).toFixed(1) + '%';
    if (dangerLevel < 0.5) {
        dangerLevelElement.style.color = lerpColor(
            dangerColors[0],
            dangerColors[1],
            dangerLevel / 0.5,
            'RGB'
        ).toString('rgb');
    } else {
        dangerLevelElement.style.color = lerpColor(
            dangerColors[1],
            dangerColors[2],
            (dangerLevel - 0.5) / 0.5,
            'RGB'
        ).toString('rgb');
    }
}

function updateText() {
    //Sidebar
    document.getElementById('ageDisplay').textContent = String(daysToYears(gameData.days));
    document.getElementById('dayDisplay').textContent = String(getDay()).padStart(3, '0');
    document.getElementById('stationAge').textContent = String(daysToYears(gameData.totalDays));
    const pauseButton = document.getElementById('pauseButton');
    // TODO could also show "Touch the eye" as third state when dead
    if (gameData.paused) {
        pauseButton.textContent = 'Play';
        pauseButton.classList.replace('btn-secondary', 'btn-primary');
    } else {
        pauseButton.textContent = 'Pause';
        pauseButton.classList.replace('btn-primary', 'btn-secondary');
    }

    const deathText = document.getElementById('deathText');
    if (isAlive()) {
        deathText.classList.add('hidden');
    } else {
        deathText.classList.remove('hidden');
    }

    updateDangerDisplay();
    updateEnergyBar();

    document.getElementById('happinessDisplay').textContent = formatPopulation(getPopulation());

    document.getElementById('evilDisplay').textContent = gameData.evil.toFixed(1);
    document.getElementById('evilGainDisplay').textContent = getEvilGain().toFixed(1);

    document.getElementById('timeWarpingDisplay').textContent = 'x' + gameData.taskData['Time warping'].getEffect().toFixed(2);
    document.getElementById('timeWarpingButton').textContent = gameData.timeWarpingEnabled ? 'Disable warp' : 'Enable warp';
}

/**
 *
 * @param {number} amount
 * @param {HTMLDataElement} dataElement
 * @param {{prefixes?: string[], unit?: string, forceSign?: boolean}} formatConfig
 */
function updateEnergyDisplay(amount, dataElement, formatConfig = {}) {
    formatValue(dataElement, amount, Object.assign({
        unit: units.energy,
        prefixes: metricPrefixes
    }, formatConfig));
}

function setSignDisplay() {
    const signDisplay = document.getElementById('signDisplay');
    if (getEnergyGeneration() > getEnergyUsage()) {
        signDisplay.textContent = '+';
        signDisplay.style.color = 'green';
    } else if (getEnergyUsage() > getEnergyGeneration()) {
        signDisplay.textContent = '-';
        signDisplay.style.color = 'red';
    } else {
        signDisplay.textContent = '';
        signDisplay.style.color = 'gray';
    }
}

function getNet() {
    return getEnergyGeneration() - getEnergyUsage();
}

function hideEntities() {
    for (let key in gameData.requirements) {
        const requirement = gameData.requirements[key];
        const completed = requirement.isCompleted();
        for (let element of requirement.elements) {
            if (completed) {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        }
    }
}

function updateBodyClasses() {
    document.getElementById('body').classList.toggle('game-paused', !isPlaying());
    document.getElementById('body').classList.toggle('game-playing', isPlaying());
}

function doTask(task) {
    if (task == null) return;
    if (task instanceof LayeredTask && task.isDone()) return;
    task.increaseXp();
    if (task instanceof Job) {
        generateEnergy();
    }
}

function getEnergyGeneration() {
    let energy = 0;
    energy += gameData.currentJob.getEnergyGeneration();
    return energy;
}

function getMaxEnergy() {
    // TODO
    return 1000 + getEnergyGeneration() * 1000;
}

function generateEnergy() {
    const generated = applySpeed(getEnergyGeneration());
    gameData.storedEnergy += generated;
}

function daysToYears(days) {
    return Math.floor(days / 365);
}

function getCategoryFromEntityName(categoryType, entityName) {
    for (let categoryName in categoryType) {
        const category = categoryType[categoryName];
        if (category.includes(entityName)) {
            return category;
        }
    }
}

function getNextEntity(data, categoryType, entityName) {
    const category = getCategoryFromEntityName(categoryType, entityName);
    const nextIndex = category.indexOf(entityName) + 1;
    if (nextIndex > category.length - 1) return null;
    const nextEntityName = category[nextIndex];
    return data[nextEntityName];
}

function autoPromote() {
    gameData.autoPromoteEnabled = autoPromoteElement.checked;
    if (!autoPromoteElement.checked) return;
    const nextEntity = getNextEntity(gameData.taskData, jobCategories, gameData.currentJob.name);
    if (nextEntity == null) return;
    const requirement = gameData.requirements[nextEntity.name];
    if (requirement.isCompleted()) gameData.currentJob = nextEntity;
}

function checkSkillSkipped(skill) {
    const row = document.getElementById('row ' + skill.name);
    return row.getElementsByClassName('checkbox')[0].checked;
}

function setSkillWithLowestMaxXp() {
    const xpDict = {};

    for (let skillName in gameData.taskData) {
        const skill = gameData.taskData[skillName];
        const requirement = gameData.requirements[skillName];
        if (skill instanceof Skill && requirement.isCompleted() && !checkSkillSkipped(skill)) {
            xpDict[skill.name] = skill.level; //skill.getMaxXp() / skill.getXpGain()
        }
    }

    if (Object.values(xpDict).length === 0) {
        skillWithLowestMaxXp = gameData.taskData['Concentration'];
        return;
    }

    const skillName = getKeyOfLowestValueFromDict(xpDict);
    skillWithLowestMaxXp = gameData.taskData[skillName];
}

function getKeyOfLowestValueFromDict(dict) {
    const values = Object.values(dict);

    values.sort(function (a, b) {
        return a - b;
    });

    for (let key in dict) {
        if (dict[key] === values[0]) {
            return key;
        }
    }
}

function autoLearn() {
    gameData.autoLearnEnabled = autoLearnElement.checked;
    if (!autoLearnElement.checked || !skillWithLowestMaxXp) return;
    gameData.currentSkill = skillWithLowestMaxXp;
}

function yearsToDays(years) {
    return years * 365;
}

function getDay() {
    return Math.floor(gameData.days - daysToYears(gameData.days) * 365);
}

function increaseDays() {
    const increase = applySpeed(1);
    if (gameData.days >= getLifespan()) return;

    gameData.days += increase;
    gameData.totalDays += increase;
}

/**
 *
 * @param {HTMLDataElement} dataElement
 * @param {number} value
 * @param {{prefixes?: string[], unit?: string, forceSign?: boolean, keepNumber?: boolean}} config
 */
function formatValue(dataElement, value, config = {}) {
    dataElement.value = String(value);

    const defaultConfig = {
        prefixes: magnitudes,
        unit: '',
        forceSign: false,
        keepNumber: false,
    };
    config = Object.assign({}, defaultConfig, config);

    // what tier? (determines SI symbol)
    const tier = Math.log10(Math.abs(value)) / 3 | 0;

    let prefix = '';
    if (config.forceSign) {
        if (Math.abs(value) <= 0.001) {
            prefix = '±';
        } else if (value > 0) {
            prefix = '+';
        }
    }

    // get suffix and determine scale
    let suffix = config.prefixes[tier];
    if (typeof config.unit === 'string' && config.unit.length > 0) {
        dataElement.dataset.unit = suffix + config.unit;
    } else if (suffix.length > 0) {
        dataElement.dataset.unit = suffix;
    }

    if (config.keepNumber) {
        dataElement.textContent = prefix + value;
        return;
    }

    if (tier === 0) {
        if (Number.isInteger(value)) {
            dataElement.textContent = prefix + value.toFixed(0);
        } else {
            dataElement.textContent = prefix + value.toPrecision(3);
        }
        return;
    }
    const scale = Math.pow(10, tier * 3);

    // scale the number
    const scaled = value / scale;

    // format number and add suffix
    dataElement.textContent = prefix + scaled.toPrecision(3);
}

/**
 *
 * @param {number} value
 * @param {{prefixes?: string[], unit?: string, forceSign?: boolean}} config
 * @return {string}
 */
function format(value, config = {}) {
    const defaultConfig = {
        prefixes: magnitudes,
        unit: '',
        forceSign: false,
    };
    config = Object.assign({}, defaultConfig, config);

    // what tier? (determines SI symbol)
    const tier = Math.log10(Math.abs(value)) / 3 | 0;

    let prefix = '';
    if (config.forceSign) {
        if (Math.abs(value) <= 0.001) {
            prefix = '±';
        } else if (value > 0) {
            prefix = '+';
        }
    }

    // get suffix and determine scale
    let suffix = config.prefixes[tier];
    if (typeof config.unit === 'string' && config.unit.length > 0) {
        suffix = ' ' + suffix + config.unit;
    }

    if (tier === 0) {
        return prefix + value.toFixed(0) + suffix;
    }
    const scale = Math.pow(10, tier * 3);

    // scale the number
    const scaled = value / scale;

    // format number and add suffix
    return prefix + scaled.toPrecision(3) + suffix;
}

function formatPopulation(population) {
    // Create some reasonable display numbers
    if (population > 1.4 && population <= 10.4) return (population * 2).toFixed(0);

    return population.toFixed(0);
}

function getTaskElement(taskName) {
    const task = gameData.taskData[taskName];
    return document.getElementById(task.id);
}

function getBattleElement(taskName) {
    const task = gameData.battleData[taskName];
    return document.getElementById(task.baseData.progressBarId);
}

function getItemElement(itemName) {
    const item = gameData.itemData[itemName];
    return document.getElementById(item.id);
}

function getElementsByClass(className) {
    return document.getElementsByClassName(removeSpaces(className));
}

function toggleLightDarkMode(force = undefined) {
    if (force === undefined) {
        gameData.settings.darkMode = !gameData.settings.darkMode;
    } else {
        gameData.settings.darkMode = force;
    }
    document.documentElement.dataset['bsTheme'] = gameData.settings.darkMode ? 'dark' : 'light';
}

function toggleSciFiMode(force = undefined) {
    const body = document.getElementById('body');
    gameData.settings.sciFiMode = body.classList.toggle('sci-fi', force);
}

function setBackground(background) {
    const body = document.getElementById('body');
    body.classList.forEach(function (cssClass, index, classList) {
        if (cssClass.startsWith('background-')) {
            classList.remove(cssClass);
        }
    });

    body.classList.add('background-' + background);
    gameData.settings.background = background;
}

// TODO remove this function, it's an anti-pattern
function removeSpaces(string) {
    return string.replace(/ /g, '');
}

function rebirthOne() {
    gameData.rebirthOneCount += 1;

    rebirthReset();
}

function rebirthTwo() {
    gameData.rebirthTwoCount += 1;
    gameData.evil += getEvilGain();

    rebirthReset();

    for (let taskName in gameData.taskData) {
        const task = gameData.taskData[taskName];
        task.maxLevel = 0;
    }
}

function rebirthReset() {
    setTab(tabButtons.jobs, 'jobs');

    // TODO encapsulate with start data
    gameData.storedEnergy = 0;
    gameData.days = 365 * 14;
    gameData.currentJob = gameData.taskData['Beggar'];
    gameData.currentSkill = gameData.taskData['Concentration'];
    gameData.currentProperty = gameData.itemData['Homeless'];
    gameData.currentMisc = [];
    gameData.autoLearnEnabled = false;
    gameData.autoPromoteEnabled = false;

    for (let taskName in gameData.taskData) {
        const task = gameData.taskData[taskName];
        if (task.level > task.maxLevel) task.maxLevel = task.level;
        task.level = 0;
        task.xp = 0;
    }

    for (let key in gameData.requirements) {
        const requirement = gameData.requirements[key];
        if (requirement.completed && permanentUnlocks.includes(key)) continue;
        requirement.completed = false;
    }
}

function getLifespan() {
    const immortality = gameData.taskData['Immortality'];
    const superImmortality = gameData.taskData['Super immortality'];
    return baseLifespan * immortality.getEffect() * superImmortality.getEffect();
}

function isAlive() {
    return gameData.days < getLifespan();
}

/**
 * Player is alive and game is not paused aka the game is actually running.
 */
function isPlaying() {
    return !gameData.paused && isAlive();
}

function assignMethods() {
    for (let key in gameData.taskData) {
        let task = gameData.taskData[key];
        if (task.baseData.energyGeneration) {
            task.baseData = jobBaseData[task.name];
            task = Object.assign(new Job(jobBaseData[task.name]), task);

        } else {
            task.baseData = skillBaseData[task.name];
            task = Object.assign(new Skill(skillBaseData[task.name]), task);
        }
        gameData.taskData[key] = task;
    }

    for (let key in gameData.itemData) {
        let item = gameData.itemData[key];
        item.baseData = itemBaseData[item.name];
        item = Object.assign(new Item(itemBaseData[item.name]), item);
        gameData.itemData[key] = item;
    }

    for (let key in gameData.battleData) {
        let battle = gameData.battleData[key];
        battle.baseData = battleBaseData[battle.name];
        battle = Object.assign(new Battle(battleBaseData[battle.name]), battle);
        battle.init();
        gameData.battleData[key] = battle;
    }

    for (let key in gameData.requirements) {
        let requirement = gameData.requirements[key];
        switch (requirement.type) {
            case 'task':
                requirement = Object.assign(new TaskRequirement(requirement.elements, requirement.requirements), requirement);
                break;
            case 'storedEnergy':
                requirement = Object.assign(new StoredEnergyRequirement(requirement.elements, requirement.requirements), requirement);
                break;
            case 'age':
                requirement = Object.assign(new AgeRequirement(requirement.elements, requirement.requirements), requirement);
                break;
            case 'evil':
                requirement = Object.assign(new EvilRequirement(requirement.elements, requirement.requirements), requirement);
                break;
        }

        const tempRequirement = tempData['requirements'][key];
        requirement.elements = tempRequirement.elements;
        requirement.requirements = tempRequirement.requirements;
        gameData.requirements[key] = requirement;
    }

    gameData.currentJob = gameData.taskData[gameData.currentJob.name];
    gameData.currentSkill = gameData.taskData[gameData.currentSkill.name];
    gameData.currentProperty = gameData.itemData[gameData.currentProperty.name];
    if (gameData.currentBattle !== null) {
        preparedBattle = gameData.currentBattle.name;
        startBossBattle();
    }

    const newArray = [];
    for (let misc of gameData.currentMisc) {
        newArray.push(gameData.itemData[misc.name]);
    }
    gameData.currentMisc = newArray;
}

function replaceSaveDict(dict, saveDict) {
    for (let key in dict) {
        if (!(key in saveDict)) {
            saveDict[key] = dict[key];
        } else if (dict === gameData.requirements) {
            if (saveDict[key].type !== tempData['requirements'][key].type) {
                saveDict[key] = tempData['requirements'][key];
            }
        }
    }

    for (let key in saveDict) {
        if (!(key in dict)) {
            delete saveDict[key];
        }
    }
}

function saveGameData() {
    localStorage.setItem('gameDataSave', JSON.stringify(gameData));
}

function loadGameData() {
    const gameDataSave = JSON.parse(localStorage.getItem('gameDataSave'));

    if (gameDataSave !== null) {
        replaceSaveDict(gameData, gameDataSave);
        replaceSaveDict(gameData.requirements, gameDataSave.requirements);
        replaceSaveDict(gameData.taskData, gameDataSave.taskData);
        replaceSaveDict(gameData.itemData, gameDataSave.itemData);
        replaceSaveDict(gameData.battleData, gameDataSave.battleData);

        gameData = gameDataSave;
    } else {
        GameEvents.NewGameStarted.trigger(undefined);
    }

    assignMethods();
}

function updateUI() {
    updateTaskRows();
    updateItemRows();
    updateRequiredRows(gameData.taskData, jobCategories);
    updateRequiredRows(gameData.taskData, skillCategories);
    updateRequiredRows(gameData.itemData, itemCategories);
    updateHeaderRows(jobCategories);
    updateHeaderRows(skillCategories);
    updateQuickTaskDisplay('job');
    updateQuickTaskDisplay('skill');
    updateBattleTaskDisplay();
    hideEntities();
    updateText();
    updateBodyClasses();
}

function update() {
    increaseDays();
    autoPromote();
    autoLearn();
    doTask(gameData.currentJob);
    doTask(gameData.currentSkill);
    doTask(gameData.currentBattle);
    applyEnergyUsage();
    updateUI();
}

function resetGameData() {
    localStorage.clear();
    location.reload();
}

function rerollStationName() {
    setStationName(stationNameGenerator.generate());
}

function importGameData() {
    const importExportBox = document.getElementById('importExportBox');
    gameData = JSON.parse(window.atob(importExportBox.value));
    saveGameData();
    location.reload();
}

function exportGameData() {
    const importExportBox = document.getElementById('importExportBox');
    importExportBox.value = window.btoa(JSON.stringify(gameData));
}

const visibleTooltips = [];

function initTooltips(){
    const tooltipTriggerElements = document.querySelectorAll('[title]');
    const tooltipConfig = {container: 'body', trigger: 'hover'};
    tooltipTriggerElements.forEach(function (tooltipTriggerElement) {
        new bootstrap.Tooltip(tooltipTriggerElement, tooltipConfig);
        tooltipTriggerElement.addEventListener('show.bs.tooltip', function (){
            visibleTooltips.push(tooltipTriggerElement);
        });
        tooltipTriggerElement.addEventListener('hide.bs.tooltip', function () {
            let indexOf = visibleTooltips.indexOf(tooltipTriggerElement);
            if (indexOf !== -1) {
                visibleTooltips.splice(indexOf);
            }
        });
    });
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
    for (let stationNameInput of Dom.get().allByClass('stationNameInput')) {
        stationNameInput.value = newStationName;
    }
}

function initStationName() {
    setStationName(gameData.stationName);
    const stationNameDisplayElement = document.getElementById('nameDisplay');
    stationNameDisplayElement.addEventListener('click', function (event) {
        event.preventDefault();

        setTab(tabButtons.settings, 'settings');
    });
    for (let stationNameInput of Dom.get().allByClass('stationNameInput')) {
        stationNameInput.placeholder = emptyStationName;
        stationNameInput.addEventListener('input', function (event) {
            setStationName(event.target.value);
        });
    }
}

function initCurrentValues() {
    gameData.currentJob = gameData.taskData['Beggar'];
    gameData.currentSkill = gameData.taskData['Concentration'];
    gameData.currentProperty = gameData.itemData['Homeless'];
    gameData.currentMisc = []
}

let preparedBattle;

function initBattle(name) {
    const gameOverMessageWinElement = document.getElementById('gameOverMessageWin');
    const gameOverMessageLoseElement = document.getElementById('gameOverMessageLose');
    const battleFlavorMessageElement = document.getElementById('battleFlavorMessage');
    gameOverMessageWinElement.hidden = true;
    gameOverMessageLoseElement.hidden = true;
    battleFlavorMessageElement.hidden = false;

    preparedBattle = name;
    document.getElementById('battleStartButton').onclick = startBossBattle;

    GameEvents.GameOver.subscribe(function (data) {
        if (data.bossDefeated) {
            gameOverMessageWinElement.hidden = false;
        } else {
            gameOverMessageLoseElement.hidden = false;
        }
        battleFlavorMessageElement.hidden = true;

        const battleStartButton = document.getElementById('battleStartButton');
        battleStartButton.hidden = true;
    });
}

function startBossBattle() {
    setBattle(preparedBattle);
    const progressBar = document.getElementById('battleProgressBar');
    progressBar.hidden = false;

    const battleStartButton = document.getElementById('battleStartButton');
    battleStartButton.hidden = true;
}

function initSettings() {
    const background = gameData.settings.background;
    if (isString(background)) {
        document.querySelector(`.background-${background} > input[type="radio"]`).checked = true;
        setBackground(background);
    }

    if (isBoolean(gameData.settings.darkMode)) {
        toggleLightDarkMode(gameData.settings.darkMode);
    }
    if (isBoolean(gameData.settings.sciFiMode)) {
        toggleSciFiMode(gameData.settings.sciFiMode);
    }
}

function displayLoaded() {
    document.getElementById('main').style.opacity = '1.0';
}

function init() {
    createAllRows(jobCategories, 'jobTable');
    createAllRows(skillCategories, 'skillTable');
    createAllRows(itemCategories, 'itemTable');

    cleanUpDom();

    initSidebar();

    createData(gameData.taskData, jobBaseData);
    createData(gameData.taskData, skillBaseData);
    createData(gameData.battleData, battleBaseData);
    createData(gameData.itemData, itemBaseData);

    initCurrentValues();
    initBattle('Destroyer');

    gameData.requirements = createRequirements(getElementsByClass, getTaskElement, getItemElement);

    tempData['requirements'] = {};
    for (let key in gameData.requirements) {
        tempData['requirements'][key] = gameData.requirements[key];
    }

    loadGameData();

    setCustomEffects();
    addMultipliers();

    if (tabButtons.hasOwnProperty(gameData.selectedTab)) {
        setTab(tabButtons[gameData.selectedTab], gameData.selectedTab);
    } else {
        setTab(tabButtons.jobs, 'jobs');
    }
    autoLearnElement.checked = gameData.autoLearnEnabled;
    autoPromoteElement.checked = gameData.autoPromoteEnabled;
    initTooltips();
    initStationName();
    initSettings();

    displayLoaded();

    update();
    setInterval(update, 1000 / updateSpeed);
    setInterval(saveGameData, 3000);
    GameEvents.TaskLevelChanged.subscribe(function (taskInfo) {
        if (taskInfo.type === 'skill') {
            setSkillWithLowestMaxXp();
        }
    });
}

init();
