'use strict';

/**
 * @param {String} html representing a single element
 * @return {Element}
 */
function htmlToElement(html) {
    let template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    // noinspection JSValidateTypes
    return template.content.firstChild;
}


/**
 *
 * @param {{[cssProperty]: function(): string }} styleObject
 * @return {string}
 */
function renderStyle(styleObject) {
    let result = '';
    for (const [property, valueFn] of Object.entries(styleObject)) {
        result += property + ': ' + valueFn() + ';';
    }
    return result;
}

/**
 * Note: `visibility: hidden` is considered visible for this function as its still part of the dom & layout.
 *
 * @param {HTMLElement} element
 * @return {boolean}
 *
 */
function isVisible(element) {
    // Glorious stolen jQuery logic
    return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

/**
 * Note: `visibility: hidden` is considered visible for this function as its still part of the dom & layout.
 *
 * @param {HTMLElement} element
 * @return {boolean}
 */
function isHidden(element) {
    return !isVisible(element);
}

/**
 *
 * @param {Element} element
 * @param {number} timeout milliseconds until to remove the element from DOM
 */
function killAfter(element, timeout) {
    setTimeout(() => {
        element.remove();
    }, timeout);
}

/**
 * @param {Element} element
 * @param {number} animationCount how many animations need to end before the element is removed?
 */
function killAfterAnimation(element, animationCount = 1) {
    // Little construct to capture `animationsEnded` per instance
    ((animationsEnded) => {
        element.addEventListener('animationend', () => {
            animationsEnded++;
            if (animationsEnded >= animationCount) {
                element.remove();
            }
        });
    })(0);
}

function randomSize(factor = 4) {
    let rnd = randomInt(1 + factor + factor * factor + factor * factor * factor);
    if (rnd < 1) {
        return 3;
    }

    if (rnd < 1 + factor) {
        return 2;
    }

    if (rnd < 1 + factor + factor * factor) {
        return 1;
    }

    return 0;
}

class VFX {
    static #playButtonShakeTimeout;

    static flash(element, baseColor) {
        let flashElement = htmlToElement(`<div class="flash" style="color: ${baseColor}"></div>`);
        killAfterAnimation(flashElement);
        element.append(flashElement);
    }

    static shakePlayButton() {
        clearTimeout(VFX.#playButtonShakeTimeout);
        Dom.get().byId('pauseButton').classList.add('shake-strong-tilt-move');
        VFX.#playButtonShakeTimeout = setTimeout(() => {
            Dom.get().byId('pauseButton').classList.remove('shake-strong-tilt-move');
        }, 150);
    }
}

class ParticleSystem {
    static followMouseInterval;

    static followMouse(enabled = true) {
        if (!enabled) {
            clearInterval(ParticleSystem.followMouseInterval);
            ParticleSystem.followMouseInterval = undefined;
            return;
        }

        ParticleSystem.mousePos = {x: 0, y: 0};

        window.addEventListener('mousemove', (event) => {
            ParticleSystem.mousePos = {x: event.clientX, y: event.clientY};
        });

        window.addEventListener('click', (event) => {
            ParticleSystem.#onetimeSplash(
                document.body,
                60,
                () => window.innerWidth - event.clientX,
                () => event.clientY
            );
        });

        ParticleSystem.followMouseInterval = setInterval(() => {
            let mousePos = ParticleSystem.mousePos;
            let particleElement = htmlToElement(`
<div style="transform: rotate(${randomInt(360)}deg); top: ${mousePos.y}px; left: ${mousePos.x}px; position: absolute">
    <div class="particle size${randomSize()}" style=""></div>
</div>`);
            killAfterAnimation(particleElement);
            document.body.append(particleElement);
        }, 20);
    }

    static followProgressBars(enabled = true) {
        if (!enabled) {
            clearInterval(ParticleSystem.followProgressBarsInterval);
            return;
        }

        ParticleSystem.followProgressBarsInterval = setInterval(() => {
            if (!isPlaying()) {
                return;
            }

            document.querySelectorAll('.progressFill.current').forEach((element) => {
                // Don't spawn particles on elements that are invisible
                if (isHidden(element)) return;

                // TODO higher progress speed = more particles
                let particleElement = htmlToElement(`
<div style="position: absolute; transform: rotate(${randomInt(360)}deg); top: ${randomInt(element.clientHeight)}px; right: 0;">
<div class="particle size${randomSize()}" style=""></div>
</div>`);
                killAfterAnimation(particleElement);
                element.append(particleElement);
            });
        }, 30);
    }

    /**
     *
     * @param {HTMLElement} element
     * @param {number} numberOfParticles
     * @param {'left'|'right'} direction
     */
    static onetimeSplash(element, numberOfParticles, direction) {
        let height = element.clientHeight;
        ParticleSystem.#onetimeSplash(
            element,
            numberOfParticles,
            {
                top: () => gaussianRandomInt(0, height) + 'px',
                [direction]: () => 0
            }
        );
    }

    static #onetimeSplash(element, numberOfParticles, styleObject) {
        for (let i = 0; i < numberOfParticles; i++) {
            let particleElement = htmlToElement(`
<div style="position: absolute; transform: rotate(${-60 + randomInt(120)}deg); animation: fade-out 600ms ease-in-out; ${renderStyle(styleObject)}">
    <div class="particle size${randomSize(3)}" style="animation-duration: 600ms, 600ms; opacity: 0.6; scale: 0.5"></div>
</div>`);
            killAfterAnimation(particleElement);
            element.append(particleElement);
        }
    }
}

// ParticleSystem.followMouse(true);
ParticleSystem.followProgressBars(true);

GameEvents.TaskLevelChanged.subscribe((taskInfo) => {
    // Only show animations if the level went up
    if (taskInfo.previousLevel >= taskInfo.nextLevel) return;

    const numberOfParticles = 10;
    const direction = taskInfo.type === 'Battle' ? 'left' : 'right';
    let taskProgressBar;
    if (taskInfo.type === 'Battle') {
        taskProgressBar = getBattleElement(taskInfo.name);
    } else if (taskInfo.type === 'GridStrength') {
        taskProgressBar = document.getElementById('energyDisplay').querySelector('.energy-fill')
    } else {
        const taskElement = getTaskElement(taskInfo.name);
        taskProgressBar = taskElement.querySelector('.progressBar');
    }
    if (isVisible(taskProgressBar)) {
        // Don't spawn particles on elements that are invisible
        ParticleSystem.onetimeSplash(taskProgressBar, numberOfParticles, direction);
        VFX.flash(taskProgressBar);
    }
    const quickTaskProgressBar = document.querySelector(`.quickTaskDisplay .${taskInfo.type}.${taskInfo.name}.progressBar`);

    // Doesn't have a quick display
    if (taskInfo.type === 'GridStrength')  return;

    ParticleSystem.onetimeSplash(quickTaskProgressBar, numberOfParticles, direction);
    VFX.flash(quickTaskProgressBar);
});

// TODO particle anpassungen ausprobieren
//      - round particles
//      - particles mostly in 4 directions (diagonally) instead of all directions
//      - particles outside instead of inside
//      - particle opacity variety instead of size variety
//      - move particles the same range but have them spawn further away
// TODO flash into overlay on progress finish
// TODO bump numbers on increase
