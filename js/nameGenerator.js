'use strict';

function mergeWordLists(...lists) {
    return _.union(_.flatten(lists));
}

const prefixes = [
    'Ancestral',
    'Arcane',
    'Ascended',
    'Astral',
    'Celestial',
    'Chosen',
    'Cosmic',
    'Crystal',
    'Dark',
    'Doomed',
    'Eldritch',
    'Eternal',
    'Ethereal',
    'First',
    'Galactic',
    'Haunted',
    'Immortal',
    'Impenetrable',
    'Interplanetary',
    'Last',
    'Lunar',
    'Mystic',
    'Orbital',
    'Unescapable',
];
const shortAbstractWords = [
    'Doom',
    'Fate',
    'Light',
    'Null',
    'Shadow',
    'Storm',
    'Void',
    'War',
];
const abstractWords = mergeWordLists(shortAbstractWords, [
    'Chaos',
    'Death',
    'Destruction',
    'Force',
    'Immortality',
    'Inferno',
    'Tempest',
    'Terror',
    'Twilight',
    'Vengeance',
]);

const shortSpaceReferences = [
    'Cloud',
    'Moon',
    'Sky',
    'Space',
    'Star',
    'Thunder',
    'Warp',
];
const longSpaceReferences = [
    'Asteroid',
    'Deep Space',
    'Galaxy',
    'Nebula',
    'Orbit',
    'Outer Space',
    'Planet',
    'Supernova',
];

const spaceReferences = mergeWordLists(shortSpaceReferences, longSpaceReferences);

const places = [
    'Bastion',
    'Castle',
    'Citadel',
    'City',
    'Colony',
    'Fortress',
    'Haven',
    'Home',
    'Megalopolis',
    'Metropolis',
    'Outpost',
    'Palace',
    'Port',
    'Sanctum',
    'Stronghold',
    'Town',
    'Watch',
];
const shortStationTypes = [
    'Base',
    'Forge',
    'Gate',
    'Keep',
    'Port',
    'Spire',
];
const longStationTypes = [
    'Asylum',
    'Citadel',
    'Commando Base',
    'Crucible',
    'Fortress',
    'Haven',
    'Lighthouse',
    'Nexus',
    'Observatory',
    'Outpost',
    'Pharos',
    'Pinnacle',
    'Sanctum',
    'Spire',
    'Station',
];
/**
 * Actually space references that could also indicate a giant space station.
 */
const oversizedStationTypes = [
    'Asteroid',
    'Earth',
    'Moon',
    'Orb',
    'Portal',
    'Rock',
    'Star',
];

const abstractStations = [
    'Conflux',
    'Defense',
    'Destroyer',
    'Dome',
    'Machine',
    'Phalanx',
    'Plate',
    'Prism',
    'Prison',
    'Throne',
    'War Machine',
];
const stationTypes = mergeWordLists(shortStationTypes, longStationTypes);
const colorWords = [
    'Black',
    'Blue',
    'Dark',
    'Neon',
    'Red',
];

const elementWords = [
    'Fire',
    'Laser',
    'Light',
    'Steel',
    'Stone',
    'Storm',
    'Stream',
];

// TODO unused words, could be integrated later on
// const uncategorized = [
//     'neutreon power',
// ];
// const longColor = [
//     'Purple',
//     'Violett',
// ];
// const mythicalReferences = [
//     'Fenris',
//     'Elysium',
//     'Tartarus',
//     'Empyrean'
// ];
// const moreSuffices = [
//     'Reborn',
//     'United',
//     'in the sky',
//     'of Chaos',
// ];
// end of unused words

const numberWords = [
    'Zero',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve'
];

const unevenNumbers = [1, 3, 5, 7, 9, 11, 13].map(number => String(number));
const thousands = [3, 5, 7, 9].map(number => String(1000 * number));

/**
 * Prime numbers and 11*n
 */
const interestingNumbers = [
    11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
    22, 33, 44, 55, 66, 77, 88, 99
];

const yearNumbers = interestingNumbers
    .map(number => _.random(2, 9) * 1000 + number)
    .map(number => String(number));

const latinOrdinalNumbers = [
    'Primus',
    'Secundus',
    'Tertius',
    'Quartus',
    'Quintus',
    'Sextus',
    'Septimus',
    'Octavus',
    'Nonus',
    'Decimus'
];

const romanNumbers = [ // Excluded numbers are too long/unaesthetic
    1, 2, 3, 4, 5, 6, 7,/* 8, */ 9, 10,
    11, 12/*,13*/, 14, 15, 16/*,17,18*/, 19
].map(convertToRoman);

class NameGenerator {
    #name = '';
    #maxLength = 20;
    #separator = ' ';
    #parts = [];
    #skipNextSeparator = false;
    #lowercasePartIndex = [];

    constructor(name = '') {
        this.#name = name;
    }

    getName() {
        return this.#name;
    }

    /**
     * @param {number} maxLength
     * @return {NameGenerator} this
     */
    maxLength(maxLength) {
        this.#maxLength = maxLength;
        return this;
    }

    /**
     * @param {string} separator
     * @return {NameGenerator} this
     */
    separator(separator) {
        this.#separator = separator;
        return this;
    }

    /**
     *
     * @param {string|any[]|function(): any} namePart
     * @return {NameGenerator} this
     */
    add(namePart) {
        if (this.#parts.length > 0) {
            if (!this.#skipNextSeparator) {
                this.#parts.push(this.#separator);
            } else {
                this.#skipNextSeparator = false;
            }
        }
        this.#parts.push(namePart);
        return this;
    }

    /**
     *
     * @param {string|any[]|function(): any} namePart
     * @return {NameGenerator} this
     */
    addOptional(namePart) {
        return this.add(['', namePart]);
    }

    /**
     * @return {NameGenerator} this
     */
    skipSeparator() {
        this.#skipNextSeparator = true;
        return this;
    }

    /**
     * @return {NameGenerator} this
     */
    lowercaseNextLetter() {
        this.#lowercasePartIndex.push(this.#parts.length);
        return this;
    }

    /**
     * @return {string} a built name
     */
    generate() {
        return this.#parts.map(this.#generatePart.bind(this)).join('');
    }

    /**
     * @param {string|any[]|function(): any} namePart
     * @param index original index of the part
     */
    #generatePart(namePart, index) {
        if (!namePart) {
            return '';
        }

        // Strings are just used - they are the exit condition for the recursive loop
        if (typeof namePart === 'string') {
            if (this.#lowercasePartIndex.includes(index)) {
                return namePart.substr(0, 1).toLowerCase() + namePart.substr(1);
            }
            return namePart;
        }

        // Functions are resolved and then handled recursively
        if (typeof namePart === 'function') {
            return this.#generatePart(namePart(), index);
        }

        // Array has to be checked before object, as all arrays are objects as well
        // A random element inside the array is picked and then handled recursively
        if (Array.isArray(namePart)) {
            return this.#generatePart(namePart[randomInt(namePart.length)], index);
        }

        // All values of an object are joined into an array which in turn is handled recursively
        // e.g. { a: ['1', '2'], b: ['3', '4'] } --> [['1','2'], ['3','4']] --> (randomly) ['3','4'] --> randomly '4'
        if (typeof namePart === 'object') {
            return this.#generatePart(Object.values(namePart), index);
        }
    }

    bound() {
        return this.generate.bind(this);
    }
}

const hairSpace = '\u200A';

const numbering = [
    new NameGenerator('Any Number Display')
        .add([
            numberWords,
            romanNumbers,
            unevenNumbers,
            thousands,
            yearNumbers,
            latinOrdinalNumbers
        ])
        .bound(),
    new NameGenerator('Letter Separator Number')
        .add('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))
        .skipSeparator()
        .add(['-', '_', hairSpace + '|' + hairSpace, '/', ':'])
        .skipSeparator()
        .add([
            unevenNumbers,
            thousands,
        ])
        .bound(),
    new NameGenerator('Letter Separator Roman number')
        .add('ABCDEGHJKLMNOPQRSTUW'.split(''))
        .skipSeparator()
        .add(['-', hairSpace + '|' + hairSpace, ':'])
        .skipSeparator()
        .add(romanNumbers)
        .bound()
];
const spaceStationNameGenerator = new NameGenerator()
    .add([
        /**
         * Examples:
         *  Astral Starbase
         *  Eternal Spaceport K-7
         *  Ancestral Shadowbase G-IV
         *  Eldrith Thunderforge
         *  Last Stormport
         */
        new NameGenerator('[Prefix] (Abstract|Space)Station [Number]')
            .add(prefixes)
            .add([shortAbstractWords, shortSpaceReferences])
            .skipSeparator()
            .lowercaseNextLetter()
            .add(shortStationTypes)
            .addOptional(numbering)
            .bound(),

        /**
         * Examples:
         *  Cloud City
         *  Space Town II
         *  Space Colony 2088
         */
        new NameGenerator('Space Place [Number]')
            .add(spaceReferences)
            .add(places)
            .addOptional(numbering)
            .bound(),

        /**
         * Examples
         *  The Galaxy Spire
         *  The Deep Space Outpost
         *  The Star Crucible
         */
        new NameGenerator('The Space Station')
            .add('The')
            .add(spaceReferences)
            .add(longStationTypes)
            .bound(),
        /**
         * Examples
         *  Space Station K-7
         *  Moon Spire 9044
         *  Sky Citadel V:1
         *  Asteroid Nexus 7000
         */
        new NameGenerator('Space Station Number')
            .add(spaceReferences)
            .add(longStationTypes)
            .add(numbering)
            .bound(),

        /**
         * Examples
         *  Blacksteel Haven T:3000
         *  Blackstone Fortress
         *  Neonstorm Outpost U/7000
         *  Darkfire Observatory
         */
        new NameGenerator('ColorElement Station [Number]')
            .add(colorWords)
            .skipSeparator()
            .lowercaseNextLetter()
            .add(elementWords)
            .add(stationTypes)
            .addOptional(numbering)
            .bound(),

        /**
         * Examples:
         *  Immortal Citadel
         *  Unescapable Nexus
         *  Astral Outpost D:IX
         *  Arcane Sanctum XV
         */
        new NameGenerator('Prefix Station [Number]')
            .add(prefixes)
            .add(longStationTypes)
            .addOptional(numbering)
            .bound(),

        /**
         * Examples:
         *  Death Star
         *  Neon Moon
         *  Void Asylum 13
         *  Shadow Earth S|7000
         */
        new NameGenerator('(Abstract|Color)(Star|Station) [Number]')
            .add([abstractWords, colorWords])
            .add([oversizedStationTypes, stationTypes])
            .addOptional(numbering)
            .bound(),

        /**
         * Examples:
         *  The Moon Defense
         *  The Chaos Phalanx
         *  The Death Throne
         *  The Supernova Prison
         */
        new NameGenerator('The (Abstract|Color)(Star|Station)')
            .add('The')
            .add([abstractWords, spaceReferences])
            .add(abstractStations)
            .bound(),
        /**
         * Examples:
         *  Outer Space Defense Primus
         *  Warp Destroyer D:X
         *  Tempest Prison 2055
         *  Star Machine V-9000
         */
        new NameGenerator('(Abstract|Color)(Star|Station) [Number]')
            .add([abstractWords, spaceReferences])
            .add(abstractStations)
            .add(numbering)
            .bound(),

        /**
         * Examples
         *  Starfire Base V
         *  Warpstorm Observatory
         *  Thunderstorm Keep XII
         *  Spacelight Asylum H-11
         */
        new NameGenerator('SpaceElement Station [Number]')
            .add(shortSpaceReferences)
            .skipSeparator()
            .lowercaseNextLetter()
            .add(elementWords)
            .add(stationTypes)
            .addOptional(numbering)
            .bound()

        /**
         * TODO Sector based names
         * Examples
         *  Port Maw
         *  Port Wander
         *  Neptune Haven
         */
    ]);

// TODO Have "prefix" OR "suffix" but at least one of those
// TODO allow for tracing of name generation --> which "decisions" have been made by the generator
