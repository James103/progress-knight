'use strict';

class Task {
    constructor(baseData) {
        this.type = this.constructor.name.toLowerCase();
        this.baseData = baseData;
        this.name = baseData.name;
        this.level = 0;
        this.maxLevel = 0;
        this.xp = 0;

        this.xpMultipliers = [];
    }

    do(){
        this.increaseXp();
    }

    getMaxXp() {
        return Math.round(this.baseData.maxXp * (this.level + 1) * Math.pow(1.01, this.level));
    }

    getXpLeft() {
        return Math.round(this.getMaxXp() - this.xp);
    }

    pushDefaultMultipliers(){
        this.xpMultipliers.push(this.getMaxLevelMultiplier.bind(this));

        //this.populationEffectMethods.push(getBoundTaskEffect('Dark influence'));
        //this.xpMultipliers.push(getBoundTaskEffect('Demon training'));
    }

    getMaxLevelMultiplier() {
        return 1 + this.maxLevel / 10;
    }

    getXpGain() {
        return applyMultipliers(10, this.xpMultipliers);
    }

    increaseXp() {
        this.xp += applySpeed(this.getXpGain());
        if (this.xp >= this.getMaxXp()) {
            this.levelUp();
        }
    }

    levelUp() {
        let excess = this.xp - this.getMaxXp();
        const previousLevel = this.level;
        while (excess >= 0) {
            this.level += 1;
            excess -= this.getMaxXp();
        }
        if (this.level > previousLevel) {
            GameEvents.TaskLevelChanged.trigger({
                type: this.type,
                name: this.baseData.name,
                previousLevel: previousLevel,
                nextLevel: this.level,
            });
        }
        this.xp = this.getMaxXp() + excess;
    }
}

class Job extends Task {
    constructor(baseData) {
        super(baseData);
        this.energyGenerationMultipliers = [];
    }

    static createEntity(entityData) {
        return new Job(entityData);
    }

    pushDefaultMultipliers(){
        super.pushDefaultMultipliers();
        this.energyGenerationMultipliers.push(this.getLevelMultiplier.bind(this));
        //this.energyGenerationMultipliers.push(getBoundTaskEffect('Demon\'s wealth'));
        //this.xpMultipliers.push(getBoundTaskEffect('Productivity'));
        //this.xpMultipliers.push(getBoundItemEffect('Personal squire'));
    }

    do(){
        super.do();
    }

    getLevelMultiplier() {
        return 1 + Math.log10(this.level + 1);
    }

    getEnergyGeneration() {
        return applyMultipliers(this.baseData.energyGeneration, this.energyGenerationMultipliers);
    }

    getEnergyUsage() {
        return this.baseData.energyConsumption;
    }

    getEffect(effectType) {
        const effects = this.baseData.effects.filter((effect) => effect.effectType === effectType);
        let effect = 1;
        for (let ef of effects){
            effect *= ef.baseValue;
        }
        return effect;
    }
}

class Skill extends Task {
    constructor(baseData) {
        super(baseData);
    }

    pushDefaultMultipliers() {
        super.pushDefaultMultipliers();
        //this.xpMultipliers.push(getBoundTaskEffect('Concentration'));
        //this.xpMultipliers.push(getBoundItemEffect('Book'));
        //this.xpMultipliers.push(getBoundItemEffect('Study desk'));
        //this.xpMultipliers.push(getBoundItemEffect('Library'));
    }

    getEffect() {
        return 1 + this.baseData.effects * this.level;
    }

    getEffects(val) {
        return 1 + val * this.level;
    }

    getEffectDescription() {
        let output = "";
        for (let effect of this.baseData.effects){
            output += 'x' + this.getEffects(effect.baseValue).toFixed(2);
            output += ' ' + effect.description;
        }

        return output;
    }
}

class Item {
    constructor(baseData) {
        this.baseData = baseData;
        this.name = baseData.name;
        this.expenseMultipliers = [];
    }

    pushDefaultMultipliers(){
        //this.expenseMultipliers.push(getBoundTaskEffect('Bargaining'));
        //this.expenseMultipliers.push(getBoundTaskEffect('Intimidation'));
    }

    getEffect() {
        if (gameData.currentProperty !== this && !gameData.currentMisc.includes(this)) return 1;
        return this.baseData.effects;
    }

    getEffectDescription() {
        return "not implemented";
        let description = this.baseData.description;
        if (itemCategories['Properties'].includes(this.name)) {
            description = 'Population';
        }
        return 'x' + this.baseData.effects.toFixed(1) + ' ' + description;
    }

    getEnergyUsage() {
        return applyMultipliers(this.baseData.expense, this.expenseMultipliers);
    }
}

class Module{
    #enabled = false;

    constructor(baseData) {
        this.data = baseData;
        this.name = baseData.name;
        this.components = baseData.components;
    }

    do(){
        //Do whatever a module does
    }

    toggleEnabled(){
        this.#enabled = !this.#enabled;
        for (let component in this.components){
            component.setEnabled(this.#enabled)
        }
        if (this.#enabled){
            if (!gameData.currentModules.hasOwnProperty(this.name)){
                gameData.currentModules[this.name] = this;
            }
        }
        else{
            if (gameData.currentModules.hasOwnProperty(this.name)) {
                delete gameData.currentModules [this.name];
            }
        }
    }
}

class ModuleComponent{
    /**
     *
     * @param {{name: string, operations: object[]}} baseData
     */
    constructor(baseData){
        this.name = baseData.name;
        this.operations = baseData.operations;
        this.currentMode = null;
    }

    setEnabled(value) {
        if (this.currentMode !== null){
            this.currentMode.setEnabled(value);
        }
    }

    //Support only one active mode
    //Introduce default mode?
    setActiveMode(modeId){
        if (this.currentMode === modeId) return;

        for (let mode of this.operations){
            if (mode === modeId){
                this.currentMode = mode;
            }
            mode.setEnabled(mode === modeId);
        }
    }
}

class ModuleOperation extends Job{
    enabled = false;

    do(){
        super.do();
    }

    setEnabled(value) {
        if (this.enabled === value) return;
        this.enabled = value;
        if (this.enabled){
            if (!gameData.currentOperations.hasOwnProperty(this.name)){
                gameData.currentOperations[this.name] = this;
            }
        }
        else{
            if (gameData.currentOperations.hasOwnProperty(this.name)) {
                delete gameData.currentOperations[this.name];
            }
        }
    }

    toggleEnabled(){
        this.setEnabled(!this.enabled);
    }
}

class Requirement {
    constructor(type, elements, requirements) {
        this.type = type;
        this.elements = elements;
        this.requirements = requirements;
        this.completed = false;
    }

    isCompleted() {
        if (this.completed) return true;
        for (const requirement of this.requirements) {
            if (!this.getCondition(requirement)) {
                return false;
            }
        }
        this.completed = true;
        return true;
    }

    getCondition(requirement) {
        throw new TypeError('getCondition not implemented.');
    }
}

class TaskRequirement extends Requirement {
    constructor(elements, requirements) {
        super('task', elements, requirements);
    }

    getCondition(requirement) {
        return gameData.taskData[requirement.task].level >= requirement.requirement;
    }
}

class StoredEnergyRequirement extends Requirement {
    constructor(elements, requirements) {
        super('storedEnergy', elements, requirements);
    }

    getCondition(requirement) {
        return gameData.storedEnergy >= requirement.requirement;
    }
}

class AgeRequirement extends Requirement {
    constructor(elements, requirements) {
        super('age', elements, requirements);
    }

    getCondition(requirement) {
        return daysToYears(gameData.days) >= requirement.requirement;
    }
}

class EvilRequirement extends Requirement {
    constructor(elements, requirements) {
        super('evil', elements, requirements);
    }

    getCondition(requirement) {
        return gameData.evil >= requirement.requirement;
    }
}
