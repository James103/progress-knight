'use strict';

// TODO replace with requestAnimationFrame for smoothest experience
const updateSpeed = 20;

const baseLifespan = 365 * 70;
const dangerColors = [
    new Color([0, 128, 0], 'RGB'),    // 0% color: dark green
    new Color([255, 255, 0], 'RGB'),  // 50% color: yellow
    new Color([219, 92, 92], 'RGB'),    // 100% color: red
];

const emptyStationName = 'Unknown Station';

// Not const to allow easy game speed increase
// TODO change before release
let baseGameSpeed = 4;

const magnitudes = ['', 'k', 'M', 'B', 'T', 'q', 'Q', 'Sx', 'Sp', 'Oc'];
const metricPrefixes = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y', 'R'];
const units = {
    energy: 'W',
    storedEnergy: 'Wh'
};

const colorPalette = {
    EasyGreen: '#55A630',
    HappyBlue: '#219EBC',
    TomatoRed: '#E63946',
    DangerRed: 'rgb(200, 0, 0)',
    DepressionPurple: '#4A4E69',
    // 'Fundamentals': '#4A4E69',
    // 'Combat': '#FF704D',
    // 'Magic': '#875F9A',
    // 'Dark magic': '#73000F',
    // 'Misc': '#B56576',
    White: '#FFFFFF',
};

/**
 * @type {Object.<string, AttributeDefinition>}
 */
// TODO render those into #attributesDisplay
const attributes = {
    danger: { title: 'Danger', color: colorPalette.DangerRed, icon: 'img/icons/danger.svg',
        getValue: Effect.getTotalValue.bind(this, [EffectType.Danger])},
    gridLoad: { title: 'Grid Load', color: '#2CCBFF', icon: 'img/icons/grid.svg',
        getValue: () => calculateGridLoad() },
    gridStrength: { title: 'Grid Strength', color: '#0C65AD', icon: 'img/icons/grid.svg',
        getValue: () => gridStrength.getGridStrength() },
    growth: { title: 'Growth', color: '#008000', icon: 'img/icons/growth.svg',
        getValue: Effect.getTotalValue.bind(this, [EffectType.Growth])},
    heat: { title: 'Heat', color: 'rgb(245, 166, 35)', icon: 'img/icons/heat.svg',
        getValue: () => calculateHeat() },
    industry: { title: 'Industry', color: 'rgb(97, 173, 50)', icon: 'img/icons/industry.svg',
        getValue: Effect.getTotalValue.bind(this, [EffectType.Industry])},
    military: { title: 'Military', color: '#b3b3b3', icon: 'img/icons/military.svg',
        getValue: Effect.getTotalValue.bind(this, [EffectType.Military, EffectType.MilitaryFactor])},
    population: { title: 'Population', color: 'rgb(46, 148, 231)', icon: 'img/icons/population.svg',
        getValue: () => gameData.population },
    research: { title: 'Research', color: '#cc4ee2', icon: 'img/icons/research.svg',
        getValue: Effect.getTotalValue.bind(this, [EffectType.Research, EffectType.ResearchFactor])},
};

/**
 *
 * @param {function(AttributeDefinition): string} printAttribute renders the provided attribute nicely.
 */
function createAttributeDescriptions(printAttribute) {
    attributes.danger.description = 'Increases ' + printAttribute(attributes.heat) + '.';
    attributes.gridLoad.description = 'Amount of ' + printAttribute(attributes.gridStrength) + ' currently assigned.';
    attributes.gridStrength.description = 'Limits the number of concurrently active operations.';
    attributes.growth.description = 'Increases ' + printAttribute(attributes.population) + '.';
    attributes.heat.description = 'Reduces ' + printAttribute(attributes.population) + '.';
    attributes.industry.description = 'Speeds up operations progress.';
    attributes.military.description = 'Counteracts ' + printAttribute(attributes.danger) + ' and increases damage in Battles.';
    attributes.population.description = 'Affects all work speed.';
    attributes.research.description = 'Unlocks new knowledge.';
}

const gridStrength = new GridStrength({name:'GridStrength', title: 'Grid Strength', maxXp: 100});

/**
 * @type {Object.<string, ModuleOperation>}
 */
const moduleOperations = {
    StandbyGenerator: new ModuleOperation({
        title: 'Standby Generator', maxXp: 100, gridLoad: 0,
        effects: [{effectType: EffectType.Energy, baseValue: 0.5}],
    }),
    MicroCyborgAutomat: new ModuleOperation({
        title: 'Micro Cyborg Automat', maxXp: 100, gridLoad: 1,
        effects: [{effectType: EffectType.Growth, baseValue: 0.1}],
        requirements: [new AttributeRequirement('playthrough', [{attribute: attributes.gridStrength, requirement: 1}])],
    }),
    KungFuManual: new ModuleOperation({
        title: 'Kung Fu manual', maxXp: 100, gridLoad: 1,
        effects: [{effectType: EffectType.Military, baseValue: 0.1}],
        requirements: [new AttributeRequirement('playthrough', [{attribute: attributes.gridStrength, requirement: 1}])],
    }),
    PocketLaboratory: new ModuleOperation({
        title: 'Pocket Laboratory', maxXp: 100, gridLoad: 1,
        effects: [{effectType: EffectType.Research, baseValue: 0.1}],
        requirements: [new AttributeRequirement('playthrough', [{attribute: attributes.gridStrength, requirement: 1}])],
    }),
    FourDPrinter: new ModuleOperation({
        title: '4D Printer', maxXp: 100, gridLoad: 1,
        effects: [{effectType: EffectType.Industry, baseValue: 0.1}],
        requirements: [new AttributeRequirement('playthrough', [{attribute: attributes.gridStrength, requirement: 1}])],
    }),

    Garbage: new ModuleOperation({
        title: 'Garbage', maxXp: 400, gridLoad: 1,
        description: 'Garbage text.',
        effects: [{effectType: EffectType.Industry, baseValue: 5}, {effectType: EffectType.Energy, baseValue: 5}],
    }),
    Diesel: new ModuleOperation({
        title: 'Diesel', maxXp: 50, gridLoad: 1,
        description: 'Diesel text.',
        effects: [{effectType: EffectType.Growth, baseValue: 5}, {effectType: EffectType.Energy, baseValue: 5}],
    }),
    Plastics: new ModuleOperation({
        title: 'Plastics', maxXp: 100, gridLoad: 1,
        description: 'Plastics text.',
        effects: [{effectType: EffectType.Industry, baseValue: 5}, {effectType: EffectType.Energy, baseValue: 5}],
    }),
    Steel: new ModuleOperation({
        title: 'Steel', maxXp: 200, gridLoad: 1,
        description: 'Steel text.',
        effects: [{effectType: EffectType.Growth, baseValue: 5}, {effectType: EffectType.EnergyFactor, baseValue: 5}],
    }),

    //Population
    QuantumReplicator: new ModuleOperation({
        title: 'Quantum Replicator', maxXp: 400, gridLoad: 1,
        description: 'Introducing the \'Quantum Replicator\'—the ultimate solution for population growth! This futuristic device uses quantum technology to duplicate individuals, allowing you to rapidly expand your population. With each activation, watch as your society flourishes and thrives. Just remember to keep track of the originals, or you might end up with an army of duplicates!',
        effects: [{effectType: EffectType.Growth, baseValue: 5}],
    }),
    BioGenesisChamber: new ModuleOperation({
        title: 'Bio-Genesis Chamber', maxXp: 400, gridLoad: 1,
        description: "Step into the 'Bio-Genesis Chamber,' where life finds a new beginning! This advanced technology can create life forms from scratch, jump-starting your population growth. Simply input the genetic code and environmental parameters, and within moments, you'll have a thriving population ready to build a bright future. Handle with care; creating life is a profound responsibility!",
        effects: [{effectType: EffectType.Growth, baseValue: 5}],
    }),
    NanoFertilityDrones: new ModuleOperation({
        title: 'Nano-Fertility Drones', maxXp: 400, gridLoad: 1,
        description: "Meet the 'Nano-Fertility Drones'—tiny, intelligent machines on a mission to boost your population! These nanobots are programmed to enhance fertility rates, making reproduction more efficient than ever before. Whether you're on a distant planet or in a post-apocalyptic world, these drones ensure your population will grow and thrive against all odds.",
        effects: [{effectType: EffectType.Growth, baseValue: 5}],
    }),
    HoloCommunityHub: new ModuleOperation({
        title: 'Holo-Community Hub', maxXp: 400, gridLoad: 1,
        description: "Create a sense of unity with the 'Holo-Community Hub'! This holographic hub provides a virtual meeting space for your population, regardless of physical distance. As individuals gather in the virtual world, they form stronger bonds, leading to increased cooperation, higher birth rates, and a sense of belonging. Just be prepared for some quirky virtual avatars!",
        effects: [{effectType: EffectType.Growth, baseValue: 5}],
    }),
    TemporalBreedingPods: new ModuleOperation({
        title: 'Temporal Breeding Pods', maxXp: 400, gridLoad: 1,
        description: "Venture into the temporal realm with 'Temporal Breeding Pods'! These extraordinary chambers manipulate time itself to accelerate the aging process. Individuals placed inside age rapidly, allowing for generations to be born and raised in a fraction of the time. Witness your population skyrocket as you harness the mysteries of time travel!",
        effects: [{effectType: EffectType.Growth, baseValue: 5}],
    }),

    //Military
    BallisticTurrets: new ModuleOperation({
        title: 'Ballistic Turrets', maxXp: 100, gridLoad: 1,
        effects: [{effectType: EffectType.Military, baseValue: 2}],
    }),
    LaserTurrets: new ModuleOperation({
        title: 'Laser Turrets', maxXp: 400, gridLoad: 1,
        effects: [{effectType: EffectType.Military, baseValue: 5}],
    }),
    FighterSquadron: new ModuleOperation({
        title: 'Fighter Squadron', maxXp: 150, gridLoad: 1,
        effects: [{effectType: EffectType.Military, baseValue: 3}],
    }),
    EliteForce: new ModuleOperation({
        title: 'Elite Force', maxXp: 1000, gridLoad: 1,
        effects: [{effectType: EffectType.Military, baseValue: 10}],
    }),
};

/**
 * @type {Object.<string, ModuleComponent>}
 */
const moduleComponents = {
    RescueCapsule: new ModuleComponent({
        title: 'Rescue Capsule',
        description: 'A small pod, big enough to house a single person. Ideal to escape from the station as a last resort.',
        operations: [moduleOperations.StandbyGenerator, moduleOperations.MicroCyborgAutomat, moduleOperations.KungFuManual, moduleOperations.PocketLaboratory, moduleOperations.FourDPrinter],
    }),
    Fuel: new ModuleComponent({
        title: 'Fuel',
        operations: [moduleOperations.Garbage, moduleOperations.Diesel],
    }),
    Products: new ModuleComponent({
        title: 'Products',
        operations: [moduleOperations.Plastics, moduleOperations.Steel],
    }),
    Replication: new ModuleComponent({
        title: 'Replication',
        operations: [moduleOperations.QuantumReplicator, moduleOperations.BioGenesisChamber, moduleOperations.NanoFertilityDrones],
    }),
    Living: new ModuleComponent({
        title: 'Living',
        operations: [moduleOperations.HoloCommunityHub, moduleOperations.TemporalBreedingPods],
    }),
    Turrets: new ModuleComponent({
        title: 'Turrets',
        operations: [moduleOperations.BallisticTurrets, moduleOperations.LaserTurrets],
    }),
    Squads: new ModuleComponent({
        title: 'Squads',
        operations: [moduleOperations.FighterSquadron, moduleOperations.EliteForce],
    }),
};

/**
 * @type {Object.<string, Module>}
 */
const modules = {
    ISASM: new Module({
        title: 'I.S.A.S.M',
        description: 'Indestructible Space Adventurer Survival Module',
        components: [moduleComponents.RescueCapsule]}
    ),
    Furnace: new Module({
        title: 'Furnace Module',
        description: '',
        components: [moduleComponents.Fuel, moduleComponents.Products],
    }),
    Hive: new Module({
        title: 'Hive Module',
        description: '',
        components: [moduleComponents.Replication, moduleComponents.Living],
    }),
    WeaponBay: new Module({
        title: 'Weapon Bay',
        description: '',
        components: [moduleComponents.Turrets, moduleComponents.Squads],
    }),
};

const defaultModules = [
    modules.ISASM
];

/**
 * @type {Object.<string, ModuleCategory>}
 */
const moduleCategories = {
    EmergencySupplies: new ModuleCategory({
        title: 'Emergency Quarters',
        color: colorPalette.DepressionPurple,
        modules: [modules.ISASM],
    }),
    Fundamentals: new ModuleCategory({
        title: 'Fundamentals',
        color: colorPalette.EasyGreen,
        modules: [modules.Furnace],
        requirements: [new AttributeRequirement('playthrough', [{attribute: attributes.gridStrength, requirement: 2}])],
    }),
    Population: new ModuleCategory({
        title: 'Population',
        color: colorPalette.HappyBlue,
        modules: [modules.Hive],
        requirements: [new AttributeRequirement('playthrough', [{attribute: attributes.gridStrength, requirement: 3}])],
    }),
    Military: new ModuleCategory({
        title: 'Military',
        color: colorPalette.TomatoRed,
        modules: [modules.WeaponBay],
        requirements: [new AttributeRequirement('playthrough', [
            {attribute: attributes.military, requirement: 10},
            {attribute: attributes.gridStrength, requirement: 3}
        ])],
    }),
};

/*
 *           100_000
 *         1_000_000
 *         7_500_000
 *        40_000_000
 *       150_000_000
 * 1_000_000_000_000
 */

/**
 * @type {Object.<string, FactionDefinition>}
 */
const factions = {
    NovaFlies: {
        title: 'Nova Flies', maxXp: 20,
        description: 'Similar to earth\'s long lost fireflies these bugs are glowing on their own. Experiencing their gigantic numbers and blinding brightness quickly explains the name.',
    },
    Astrogoblins: {
        title: 'Astrogoblins', maxXp: 50,
        description: 'Mischievous beings that can be found in every corner of the galaxy, Astrogoblins zip around in makeshift spacecrafts, armed with primitive weapons and a liking for interstellar chaos.'
    },
    CometCrawlers: {
        title: 'Comet Crawlers', maxXp: 100,
        description: 'These beagle-sized beetles travel on the surface of comets as they are attracted by metal alloys that are unfortunately also commonly found in space stations. They will attack in large numbers if they sense one of their own being harmed.'
    },
    SpacePirates: {
        title: 'Space Pirates', maxXp: 1_000,
        description: 'Buccaneers sailing the astral seas, Space Pirates are notorious for their flashy ships, over-the-top personalities, and the relentless pursuit of rare space booty.'
    },
    ThunderDragon: {
        title: 'Thunder Dragon', maxXp: 100_000,
        description: 'Roaming the cosmic storm clouds, Thunder Dragons are colossal beings of electric energy. Lightning crackles across their scales as they soar through the galactic skies.'
    },
    AstralSharks: {
        title: 'Astral Sharks', maxXp: 750_000,
        description: 'Legends of the cosmic deep, Astral Sharks glide through space with celestial fins and stardust-infused teeth. They\'re the titans of the galactic oceans.'
    },

    Destroyer: {
        title: 'The Destroyer', maxXp: 500,
    },
};

/**
 * @type {Object.<string, Battle>}
 */
const battles = {
    Astrogoblins10: new Battle({
        title: 'Wimpy',
        targetLevel: 10,
        faction: factions.Astrogoblins,
        effects: [{effectType: EffectType.Danger, baseValue: 10}],
        rewards: [{effectType: EffectType.Research, baseValue: 2}, {effectType: EffectType.MilitaryFactor, baseValue: 0.1}]
    }),
    CometCrawlers10: new Battle({
        title: 'Handful of',
        targetLevel: 10,
        faction: factions.CometCrawlers,
        effects: [{effectType: EffectType.Danger, baseValue: 20}],
        rewards: [{effectType: EffectType.Growth, baseValue: 2}, {effectType: EffectType.MilitaryFactor, baseValue: 0.1}]
    }),
    Astrogoblins20: new Battle({
        title: 'Courageous',
        targetLevel: 20,
        faction: factions.Astrogoblins,
        effects: [{effectType: EffectType.Danger, baseValue: 50}],
        rewards: [{effectType: EffectType.Military, baseValue: 2}, {effectType: EffectType.MilitaryFactor, baseValue: 0.1}]
    }),
    SpacePirates10: new Battle({
        title: 'Roaming',
        targetLevel: 10,
        faction: factions.SpacePirates,
        effects: [{effectType: EffectType.Danger, baseValue: 100}],
        rewards: [{effectType: EffectType.Military, baseValue: 5}, {effectType: EffectType.MilitaryFactor, baseValue: 0.1}]
    }),
    ThunderDragon10: new Battle({
        title: 'Decrepit',
        targetLevel: 10,
        faction: factions.ThunderDragon,
        effects: [{effectType: EffectType.Danger, baseValue: 200}],
        rewards: [{effectType: EffectType.Research, baseValue: 5}, {effectType: EffectType.MilitaryFactor, baseValue: 0.1}]
    }),
    AstralSharks10: new Battle({
        title: 'Lone',
        targetLevel: 10,
        faction: factions.AstralSharks,
        effects: [{effectType: EffectType.Danger, baseValue: 500}],
        rewards: [{effectType: EffectType.ResearchFactor, baseValue: 1.5}, {effectType: EffectType.MilitaryFactor, baseValue: 0.1}]
    }),
    NovaFlies200: new Battle({
        title: 'Countless',
        targetLevel: 200,
        faction: factions.NovaFlies,
        effects: [{effectType: EffectType.Danger, baseValue: 300}],
        rewards: [{effectType: EffectType.Growth, baseValue: 20}, {effectType: EffectType.MilitaryFactor, baseValue: 0.1}]
    }),

    // Destroyer: new BossBattle({
    //     title: '',
    //     maxLevel: 5,
    //     faction: factions.Destroyer,
    //     effects: [{effectType: EffectType.Danger, baseValue: Number.POSITIVE_INFINITY}],
    //     rewards: [],
    //     progressBarId: 'battleProgressBar',
    //     layerLabel: 'Tentacles layer'
    // }),
};

const battleRequirements = [
    new AttributeRequirement('playthrough', [{attribute: attributes.research, requirement: 10}]),
    new AttributeRequirement('playthrough', [{attribute: attributes.research, requirement: 20}]),
    new AttributeRequirement('playthrough', [{attribute: attributes.research, requirement: 50}]),
    new AttributeRequirement('playthrough', [{attribute: attributes.research, requirement: 100}]),
];

/**
 *
 * @return {{limit: number, requirement: AttributeRequirement|null}}
 */
function maximumAvailableBattles() {
    const research = attributes.research.getValue();
    if (research >= 100) return {limit: 5, requirement: null};
    if (research >= 50) return {limit: 4, requirement: battleRequirements[3]};
    if (research >= 20) return {limit: 3, requirement: battleRequirements[2]};
    if (research >= 10) return {limit: 2, requirement: battleRequirements[1]};
    return {limit: 1, requirement: battleRequirements[0]};
}

/**
 * @type {Object.<string, PointOfInterest>}
 */
const pointsOfInterest = {
    FunkySector: new PointOfInterest({
        title: 'Funky Sector',
        description: '',
        effects: [{effectType: EffectType.Industry, baseValue: 5}, {effectType: EffectType.Danger, baseValue: 10}],
        modifiers: [{modifies: [moduleOperations.QuantumReplicator, moduleOperations.Diesel], from: EffectType.Growth, to: EffectType.Research}],
    }),
    VideoGameLand: new PointOfInterest({
        title: 'Video Game Land',
        description: '',
        effects: [{effectType: EffectType.Military, baseValue: 5}, {effectType: EffectType.Danger, baseValue: 25}],
        modifiers: [{modifies: [moduleOperations.BallisticTurrets, moduleOperations.LaserTurrets], from: EffectType.Military, to: EffectType.Energy}],
    }),
    Gurkenland: new PointOfInterest({
        title: 'Gurkenland',
        description: '',
        effects: [{effectType: EffectType.Growth, baseValue: 5}, {effectType: EffectType.Danger, baseValue: 50}],
        modifiers: [{modifies: [moduleOperations.Plastics], from: EffectType.Industry, to: EffectType.Growth}, {modifies: [moduleOperations.Steel], from: EffectType.Growth, to: EffectType.Industry}],
        requirements: [new FactionLevelsDefeatedRequirement('playthrough', [{faction: factions.AstralSharks, requirement: 10}])],
    }),
};

/**
 * @type {Object.<string, Sector>}
 */
const sectors = {
    // Twilight
    DanceSector: new Sector({
        title: 'Dance Sector',
        color: '#C71585',
        pointsOfInterest: [pointsOfInterest.FunkySector],
    }),
    NerdSector: new Sector({
        title: 'Nerd Sector',
        color: '#219EBC',
        pointsOfInterest: [pointsOfInterest.VideoGameLand, pointsOfInterest.Gurkenland],
        requirements: [new OperationLevelRequirement('playthrough', [{operation: moduleOperations.EliteForce, requirement: 100}])],
    }),
};

const defaultPointOfInterest = 'FunkySector';

const permanentUnlocks = ['Scheduling', 'Shop', 'Automation', 'Quick task display'];

const layerData = [
    new LayerData('#ffe119'),
    new LayerData('#f58231'),
    new LayerData('#e6194B'),
    new LayerData('#911eb4'),
    new LayerData('#4363d8'),
    new LayerData('#47ff00'),
];

const lastLayerData = new LayerData('#000000');

/**
 * Requirements of arbitrary {@link HTMLElement}s in the layout.
 * @type {*[]}
 */
const elementRequirements = [
    // TODO hide gridBar and associated elements
    new HtmlElementWithRequirement(
        [Dom.get().byId('attributesTabButton')],
        [new AttributeRequirement('permanent', [{
            attribute: attributes.research,
            requirement: 25
        }])]),
];

/**
 *
 * @param {function(string): HTMLElement} getTaskElement
 * @param {function(string): HTMLElement} getItemElement
 * @return {Record.<string, Requirement>}
 */
function createRequirements(getTaskElement, getItemElement) {
    return {
        /*
        //Other
        'Arcane energy': new TaskRequirement(Dom.get().allByClass('arcaneEnergy'), [{task: 'Concentration', requirement: 200}, {task: 'Meditation', requirement: 200}]),
        'Dark magic': new EvilRequirement(Dom.get().allByClass('darkMagic'), [{requirement: 1}]),
        'Shop': new StoredEnergyRequirement([Dom.get().byId('locationTabButton')], [{requirement: gameData.itemData['Tent'].getGridLoad() * 50}]),
        'Rebirth tab': new AgeRequirement([Dom.get().byId('rebirthTabButton')], [{requirement: 25}]),
        'Rebirth note 1': new AgeRequirement([Dom.get().byId('rebirthNote1')], [{requirement: 45}]),
        'Rebirth note 2': new AgeRequirement([Dom.get().byId('rebirthNote2')], [{requirement: 65}]),
        'Rebirth note 3': new AgeRequirement([Dom.get().byId('rebirthNote3')], [{requirement: 200}]),
        'Evil info': new EvilRequirement([Dom.get().byId('evilInfo')], [{requirement: 1}]),
        'Time warping info': new TaskRequirement(Dom.get().allByClass('timeWarping'), [{task: 'Mage', requirement: 10}]),
        'Automation': new AgeRequirement([Dom.get().byId('automation')], [{requirement: 20}]),
        'Quick task display': new AgeRequirement(Dom.get().allByClass('quickTaskDisplay'), [{requirement: 20}]),
        */

        //Common generators
        //'Beggar': new TaskRequirement([getTaskElement('Beggar')], []),
        //'Farmer': new TaskRequirement([getTaskElement('Farmer')], [{task: 'Beggar', requirement: 10}]),
        /*
        'Fisherman': new TaskRequirement([getTaskElement('Fisherman')], [{task: 'Farmer', requirement: 10}]),
        'Miner': new TaskRequirement([getTaskElement('Miner')], [{task: 'Strength', requirement: 10}, {task: 'Fisherman', requirement: 10}]),
        'Blacksmith': new TaskRequirement([getTaskElement('Blacksmith')], [{task: 'Strength', requirement: 30}, {task: 'Miner', requirement: 10}]),
        'Merchant': new TaskRequirement([getTaskElement('Merchant')], [{task: 'Bargaining', requirement: 50}, {task: 'Blacksmith', requirement: 10}]),
*/
        //Military
        /*
        'Squire': new TaskRequirement([getTaskElement('Squire')], [{task: 'Strength', requirement: 5}]),
        'Footman': new TaskRequirement([getTaskElement('Footman')], [{task: 'Strength', requirement: 20}, {task: 'Squire', requirement: 10}]),
        'Veteran footman': new TaskRequirement([getTaskElement('Veteran footman')], [{task: 'Battle tactics', requirement: 40}, {task: 'Footman', requirement: 10}]),
        'Knight': new TaskRequirement([getTaskElement('Knight')], [{task: 'Strength', requirement: 100}, {task: 'Veteran footman', requirement: 10}]),
        'Veteran knight': new TaskRequirement([getTaskElement('Veteran knight')], [{task: 'Battle tactics', requirement: 150}, {task: 'Knight', requirement: 10}]),
        'Elite knight': new TaskRequirement([getTaskElement('Elite knight')], [{task: 'Strength', requirement: 300}, {task: 'Veteran knight', requirement: 10}]),
        'Holy knight': new TaskRequirement([getTaskElement('Holy knight')], [{task: 'Mana control', requirement: 500}, {task: 'Elite knight', requirement: 10}]),
        'Legendary knight': new TaskRequirement([getTaskElement('Legendary knight')], [{task: 'Mana control', requirement: 1000}, {task: 'Battle tactics', requirement: 1000}, {task: 'Holy knight', requirement: 10}]),
/*
        //The Arcane Association
        'Student': new TaskRequirement([getTaskElement('Student')], [{task: 'Concentration', requirement: 200}, {task: 'Meditation', requirement: 200}]),
        'Apprentice mage': new TaskRequirement([getTaskElement('Apprentice mage')], [{task: 'Mana control', requirement: 400}, {task: 'Student', requirement: 10}]),
        'Mage': new TaskRequirement([getTaskElement('Mage')], [{task: 'Mana control', requirement: 700}, {task: 'Apprentice mage', requirement: 10}]),
        'Wizard': new TaskRequirement([getTaskElement('Wizard')], [{task: 'Mana control', requirement: 1000}, {task: 'Mage', requirement: 10}]),
        'Master wizard': new TaskRequirement([getTaskElement('Master wizard')], [{task: 'Mana control', requirement: 1500}, {task: 'Wizard', requirement: 10}]),
        'Chairman': new TaskRequirement([getTaskElement('Chairman')], [{task: 'Mana control', requirement: 2000}, {task: 'Master wizard', requirement: 10}]),
*/
        //Fundamentals
        //'Bargaining': new TaskRequirement([getTaskElement('Bargaining')], [{task: 'Concentration', requirement: 20}]),
        /*
        'Meditation': new TaskRequirement([getTaskElement('Meditation')], [{task: 'Concentration', requirement: 30}, {task: 'Productivity', requirement: 20}]),

        //Combat
        'Strength': new TaskRequirement([getTaskElement('Strength')], []),
        'Battle tactics': new TaskRequirement([getTaskElement('Battle tactics')], [{task: 'Concentration', requirement: 20}]),
        'Muscle memory': new TaskRequirement([getTaskElement('Muscle memory')], [{task: 'Concentration', requirement: 30}, {task: 'Strength', requirement: 30}]),

        //Magic
        'Mana control': new TaskRequirement([getTaskElement('Mana control')], [{task: 'Concentration', requirement: 200}, {task: 'Meditation', requirement: 200}]),
        'Immortality': new TaskRequirement([getTaskElement('Immortality')], [{task: 'Apprentice mage', requirement: 10}]),
        'Time warping': new TaskRequirement([getTaskElement('Time warping')], [{task: 'Mage', requirement: 10}]),
        'Super immortality': new TaskRequirement([getTaskElement('Super immortality')], [{task: 'Chairman', requirement: 1000}]),

        //Dark magic
        'Dark influence': new EvilRequirement([getTaskElement('Dark influence')], [{requirement: 1}]),
        'Evil control': new EvilRequirement([getTaskElement('Evil control')], [{requirement: 1}]),
        'Intimidation': new EvilRequirement([getTaskElement('Intimidation')], [{requirement: 1}]),
        'Demon training': new EvilRequirement([getTaskElement('Demon training')], [{requirement: 25}]),
        'Blood meditation': new EvilRequirement([getTaskElement('Blood meditation')], [{requirement: 75}]),
        'Demon\'s wealth': new EvilRequirement([getTaskElement('Demon\'s wealth')], [{requirement: 500}]),
*/
        //Properties
        // FunkySector: new GridStrengthRequirement([getItemElement('FunkySector')], [{requirement: 0}]),
        /*
        'Tent': new StoredEnergyRequirement([getPointOfInterestElement('Tent')], [{requirement: 0}]),
        'Wooden hut': new StoredEnergyRequirement([getPointOfInterestElement('Wooden hut')], [{requirement: gameData.itemData['Wooden hut'].getGridLoad() * 100}]),
        'Cottage': new StoredEnergyRequirement([getPointOfInterestElement('Cottage')], [{requirement: gameData.itemData['Cottage'].getGridLoad() * 100}]),
        'House': new StoredEnergyRequirement([getPointOfInterestElement('House')], [{requirement: gameData.itemData['House'].getGridLoad() * 100}]),
        'Large house': new StoredEnergyRequirement([getPointOfInterestElement('Large house')], [{requirement: gameData.itemData['Large house'].getGridLoad() * 100}]),
        'Small palace': new StoredEnergyRequirement([getPointOfInterestElement('Small palace')], [{requirement: gameData.itemData['Small palace'].getGridLoad() * 100}]),
        'Grand palace': new StoredEnergyRequirement([getPointOfInterestElement('Grand palace')], [{requirement: gameData.itemData['Grand palace'].getGridLoad() * 100}]),
*/
        //Misc
        // VideoGameLand: new GridStrengthRequirement([getItemElement('VideoGameLand')], [{requirement: 0}]),
        // Gurkenland: new GridStrengthRequirement([getItemElement('Gurkenland')], [{requirement: 0}]),
        /*
        'Dumbbells': new StoredEnergyRequirement([getPointOfInterestElement('Dumbbells')], [{requirement: gameData.itemData['Dumbbells'].getGridLoad() * 100}]),
        'Personal squire': new StoredEnergyRequirement([getPointOfInterestElement('Personal squire')], [{requirement: gameData.itemData['Personal squire'].getGridLoad() * 100}]),
        'Steel longsword': new StoredEnergyRequirement([getPointOfInterestElement('Steel longsword')], [{requirement: gameData.itemData['Steel longsword'].getGridLoad() * 100}]),
        'Butler': new StoredEnergyRequirement([getPointOfInterestElement('Butler')], [{requirement: gameData.itemData['Butler'].getGridLoad() * 100}]),
        'Sapphire charm': new StoredEnergyRequirement([getPointOfInterestElement('Sapphire charm')], [{requirement: gameData.itemData['Sapphire charm'].getGridLoad() * 100}]),
        'Study desk': new StoredEnergyRequirement([getPointOfInterestElement('Study desk')], [{requirement: gameData.itemData['Study desk'].getGridLoad() * 100}]),
        'Library': new StoredEnergyRequirement([getPointOfInterestElement('Library')], [{requirement: gameData.itemData['Library'].getGridLoad() * 100}]),
   */
    };
}

function setCustomEffects() {
    // const bargaining = gameData.taskData['Bargaining'];
    // bargaining.getEffect = function () {
    //     let multiplier = 1 - getBaseLog(7, bargaining.level + 1) / 10;
    //     if (multiplier < 0.1) {
    //         multiplier = 0.1;
    //     }
    //     return multiplier;
    // };
    //
    // const intimidation = gameData.taskData['Intimidation'];
    // intimidation.getEffect = function () {
    //     let multiplier = 1 - getBaseLog(7, intimidation.level + 1) / 10;
    //     if (multiplier < 0.1) {
    //         multiplier = 0.1;
    //     }
    //     return multiplier;
    // };
    //
    // const immortality = gameData.taskData['Immortality'];
    // immortality.getEffect = function () {
    //     return 1 + getBaseLog(33, immortality.level + 1);
    // };
}
